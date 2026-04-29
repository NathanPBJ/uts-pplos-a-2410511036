'use strict';

const dayjs          = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const { pool }       = require('../utils/db');
const { getPegawai } = require('../utils/employeeClient');

// ─── Helper ───────────────────────────────────────────────────────────────────

async function prosesInternal(conn, cuti, statusBaru, catatan, namaAdmin) {
  await conn.query(
    `UPDATE leave_requests
        SET status = ?, diproses_oleh = ?, catatan_admin = ?
      WHERE id = ?`,
    [statusBaru, namaAdmin, catatan || null, cuti.id],
  );

  if (statusBaru === 'disetujui') {
    let current = dayjs(cuti.tanggal_mulai);
    const selesai = dayjs(cuti.tanggal_selesai);

    while (!current.isAfter(selesai)) {
      await conn.query(
        `INSERT IGNORE INTO attendances
           (employee_id, employee_nip, employee_name, tanggal, status, poin_delta, keterangan)
         VALUES (?, ?, ?, ?, 'cuti', 0, ?)`,
        [
          cuti.employee_id, cuti.employee_nip, cuti.employee_name,
          current.format('YYYY-MM-DD'),
          `Cuti disetujui — ID pengajuan: ${cuti.id}`,
        ],
      );
      current = current.add(1, 'day');
    }
  }
}

// ─── Ajukan Cuti ─────────────────────────────────────────────────────────────

async function ajukan(req, res) {
  const { employee_id, tanggal_mulai, tanggal_selesai, alasan } = req.body;

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda hanya dapat mengajukan cuti untuk diri sendiri.',
    });
  }

  let pegawai;
  try {
    pegawai = await getPegawai(employee_id);
  } catch (err) {
    return res.status(err.status || 503).json({ status: 'error', pesan: err.message });
  }

  const mulai      = dayjs(tanggal_mulai);
  const selesai    = dayjs(tanggal_selesai);
  const jumlahHari = selesai.diff(mulai, 'day') + 1;

  if (jumlahHari < 1) {
    return res.status(422).json({
      status: 'error',
      pesan:  'Tanggal selesai tidak boleh sebelum tanggal mulai.',
    });
  }

  const [bentrok] = await pool.query(
    `SELECT id FROM leave_requests
     WHERE employee_id = ?
       AND status IN ('pending','disetujui')
       AND tanggal_mulai <= ?
       AND tanggal_selesai >= ?`,
    [employee_id, tanggal_selesai, tanggal_mulai],
  );

  if (bentrok.length > 0) {
    return res.status(409).json({
      status: 'error',
      pesan:  'Terdapat pengajuan cuti yang tumpang-tindih dengan periode yang dipilih.',
    });
  }

  const id = uuidv4();
  await pool.query(
    `INSERT INTO leave_requests
       (id, employee_id, employee_nip, employee_name,
        tanggal_mulai, tanggal_selesai, jumlah_hari, alasan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, pegawai.id, pegawai.nip, pegawai.nama, tanggal_mulai, tanggal_selesai, jumlahHari, alasan],
  );

  return res.status(201).json({
    status: 'sukses',
    pesan:  `Pengajuan cuti ${pegawai.nama} selama ${jumlahHari} hari berhasil dikirim dan menunggu persetujuan admin.`,
    data:   { id, employee_name: pegawai.nama, tanggal_mulai, tanggal_selesai, jumlah_hari: jumlahHari, alasan, status: 'pending' },
  });
}

// ─── Setujui Cuti ─────────────────────────────────────────────────────────────

async function setujui(req, res) {
  const { id } = req.params;
  const [[cuti]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

  if (!cuti) return res.status(404).json({ status: 'error', pesan: 'Pengajuan cuti tidak ditemukan.' });

  if (cuti.status !== 'pending') {
    return res.status(409).json({
      status: 'error',
      pesan:  `Pengajuan ini sudah diproses sebelumnya dengan status '${cuti.status}'.`,
    });
  }

  const namaAdmin = req.user.name || req.user.email || `Admin ID ${req.user.sub}`;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await prosesInternal(conn, cuti, 'disetujui', req.body.catatan_admin, namaAdmin);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('[cuti.controller] setujui error:', err);
    return res.status(500).json({ status: 'error', pesan: 'Gagal memproses persetujuan cuti.' });
  } finally {
    conn.release();
  }

  return res.status(200).json({
    status: 'sukses',
    pesan:  `Pengajuan cuti ${cuti.employee_name} selama ${cuti.jumlah_hari} hari telah disetujui. Record absensi otomatis dibuat.`,
    data:   { id, status: 'disetujui', diproses_oleh: namaAdmin },
  });
}

// ─── Tolak Cuti ───────────────────────────────────────────────────────────────

async function tolak(req, res) {
  const { id } = req.params;
  const [[cuti]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

  if (!cuti) return res.status(404).json({ status: 'error', pesan: 'Pengajuan cuti tidak ditemukan.' });

  if (cuti.status !== 'pending') {
    return res.status(409).json({
      status: 'error',
      pesan:  `Pengajuan ini sudah diproses sebelumnya dengan status '${cuti.status}'.`,
    });
  }

  const namaAdmin = req.user.name || req.user.email || `Admin ID ${req.user.sub}`;
  await pool.query(
    `UPDATE leave_requests SET status = 'ditolak', diproses_oleh = ?, catatan_admin = ? WHERE id = ?`,
    [namaAdmin, req.body.catatan_admin || null, id],
  );

  return res.status(200).json({
    status: 'sukses',
    pesan:  `Pengajuan cuti ${cuti.employee_name} ditolak.`,
    data:   { id, status: 'ditolak', diproses_oleh: namaAdmin, catatan_admin: req.body.catatan_admin || null },
  });
}

// ─── Batalkan Cuti ────────────────────────────────────────────────────────────

async function batalkan(req, res) {
  const { id } = req.params;
  const [[cuti]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

  if (!cuti) return res.status(404).json({ status: 'error', pesan: 'Pengajuan cuti tidak ditemukan.' });

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(cuti.employee_id)) {
    return res.status(403).json({ status: 'error', pesan: 'Anda tidak berhak membatalkan cuti ini.' });
  }

  if (cuti.status !== 'pending') {
    return res.status(409).json({
      status: 'error',
      pesan:  `Hanya pengajuan berstatus 'pending' yang dapat dibatalkan. Status saat ini: '${cuti.status}'.`,
    });
  }

  await pool.query(
    `UPDATE leave_requests SET status = 'ditolak', catatan_admin = ? WHERE id = ?`,
    ['Dibatalkan oleh pegawai.', id],
  );

  return res.status(200).json({ status: 'sukses', pesan: 'Pengajuan cuti berhasil dibatalkan.' });
}

// ─── Daftar Cuti ──────────────────────────────────────────────────────────────

async function daftar(req, res) {
  const { employee_id, status: filterStatus, halaman = 1, per_halaman = 20 } = req.query;

  if (req.user.role !== 'admin' && !employee_id) {
    return res.status(422).json({ status: 'error', pesan: 'Parameter employee_id wajib diisi.' });
  }

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(employee_id)) {
    return res.status(403).json({ status: 'error', pesan: 'Anda hanya dapat melihat cuti milik sendiri.' });
  }

  const limit  = Math.min(parseInt(per_halaman, 10) || 20, 100);
  const offset = (Math.max(parseInt(halaman, 10) || 1, 1) - 1) * limit;
  const where  = [];
  const params = [];

  if (employee_id)  { where.push('employee_id = ?'); params.push(employee_id); }
  if (filterStatus) { where.push('status = ?');      params.push(filterStatus); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM leave_requests ${clause}`, params);
  const [rows]        = await pool.query(
    `SELECT * FROM leave_requests ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return res.status(200).json({
    status: 'sukses',
    pesan:  'Daftar pengajuan cuti berhasil dimuat.',
    data:   rows,
    meta:   { total, halaman: parseInt(halaman, 10) || 1, per_halaman: limit, total_halaman: Math.ceil(total / limit) },
  });
}

// ─── Detail Cuti ──────────────────────────────────────────────────────────────

async function detail(req, res) {
  const { id } = req.params;
  const [[cuti]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

  if (!cuti) return res.status(404).json({ status: 'error', pesan: 'Pengajuan cuti tidak ditemukan.' });

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(cuti.employee_id)) {
    return res.status(403).json({ status: 'error', pesan: 'Anda tidak memiliki akses ke data cuti ini.' });
  }

  return res.status(200).json({ status: 'sukses', pesan: 'Detail pengajuan cuti berhasil dimuat.', data: cuti });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { ajukan, setujui, tolak, batalkan, daftar, detail };
