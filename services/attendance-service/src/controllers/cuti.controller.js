'use strict';

const dayjs            = require('dayjs');
const { v4: uuidv4 }   = require('uuid');
const { pool }         = require('../utils/db');
const { getPegawai }   = require('../utils/employeeClient');

function nowWIB() {
  return dayjs().utcOffset(7);
}

// ─── Ajukan Cuti ─────────────────────────────────────────────────────────────

/**
 * POST /api/cuti
 * Body: { employee_id, tanggal_mulai, tanggal_selesai, alasan }
 */
async function ajukanCuti(req, res) {
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

  const mulai    = dayjs(tanggal_mulai);
  const selesai  = dayjs(tanggal_selesai);
  const jumlahHari = selesai.diff(mulai, 'day') + 1;

  if (jumlahHari < 1) {
    return res.status(422).json({
      status: 'error',
      pesan:  'Tanggal selesai tidak boleh sebelum tanggal mulai.',
    });
  }

  // Cek bentrok dengan cuti pending/disetujui yang sudah ada
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
    pesan:  `Pengajuan cuti ${pegawai.nama} selama ${jumlahHari} hari berhasil dikirim dan menunggu persetujuan.`,
    data: {
      id,
      employee_id:     pegawai.id,
      employee_name:   pegawai.nama,
      tanggal_mulai,
      tanggal_selesai,
      jumlah_hari:     jumlahHari,
      alasan,
      status:          'pending',
    },
  });
}

// ─── Proses Cuti (Admin) ──────────────────────────────────────────────────────

/**
 * PATCH /api/cuti/:id/proses
 * Body: { status: 'disetujui'|'ditolak', catatan_admin? }
 * Hanya admin.
 */
async function prosesCuti(req, res) {
  const { id }              = req.params;
  const { status, catatan_admin } = req.body;

  if (!['disetujui', 'ditolak'].includes(status)) {
    return res.status(422).json({
      status: 'error',
      pesan:  "Status harus berupa 'disetujui' atau 'ditolak'.",
    });
  }

  const [[cuti]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

  if (!cuti) {
    return res.status(404).json({
      status: 'error',
      pesan:  `Pengajuan cuti dengan ID ${id} tidak ditemukan.`,
    });
  }

  if (cuti.status !== 'pending') {
    return res.status(409).json({
      status: 'error',
      pesan:  `Pengajuan cuti ini sudah diproses sebelumnya dengan status '${cuti.status}'.`,
    });
  }

  const diprosesoleh = req.user.nama || req.user.email || `Admin (ID ${req.user.sub})`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE leave_requests
          SET status = ?, diproses_oleh = ?, catatan_admin = ?
        WHERE id = ?`,
      [status, diprosesoleh, catatan_admin || null, id],
    );

    // Jika disetujui, buat record absensi 'cuti' untuk setiap hari
    if (status === 'disetujui') {
      const mulai   = dayjs(cuti.tanggal_mulai);
      const selesai = dayjs(cuti.tanggal_selesai);
      let current   = mulai;

      while (!current.isAfter(selesai)) {
        const tanggal = current.format('YYYY-MM-DD');

        // INSERT IGNORE supaya tidak error jika sudah ada record pada hari itu
        await conn.query(
          `INSERT IGNORE INTO attendances
            (employee_id, employee_nip, employee_name, tanggal, status, poin_delta, keterangan)
           VALUES (?, ?, ?, ?, 'cuti', 0, ?)`,
          [
            cuti.employee_id, cuti.employee_nip, cuti.employee_name,
            tanggal,
            `Cuti disetujui — ID pengajuan: ${cuti.id}`,
          ],
        );
        current = current.add(1, 'day');
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('[attendance-service] prosesCuti error:', err);
    return res.status(500).json({
      status: 'error',
      pesan:  'Terjadi kesalahan saat memproses pengajuan cuti.',
    });
  } finally {
    conn.release();
  }

  const pesanStatus = status === 'disetujui'
    ? `Pengajuan cuti ${cuti.employee_name} telah disetujui.`
    : `Pengajuan cuti ${cuti.employee_name} ditolak.`;

  return res.status(200).json({
    status: 'sukses',
    pesan:  pesanStatus,
  });
}

// ─── Daftar Cuti ─────────────────────────────────────────────────────────────

/**
 * GET /api/cuti?employee_id=&status=&halaman=&per_halaman=
 */
async function daftarCuti(req, res) {
  const {
    employee_id,
    status: filterStatus,
    halaman     = 1,
    per_halaman = 20,
  } = req.query;

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda hanya dapat melihat daftar cuti milik sendiri.',
    });
  }

  const limit  = Math.min(parseInt(per_halaman, 10) || 20, 100);
  const offset = (Math.max(parseInt(halaman, 10) || 1, 1) - 1) * limit;

  const where  = [];
  const params = [];

  if (employee_id)   { where.push('employee_id = ?'); params.push(employee_id); }
  if (filterStatus)  { where.push('status = ?');      params.push(filterStatus); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM leave_requests ${whereClause}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT * FROM leave_requests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return res.status(200).json({
    status: 'sukses',
    pesan:  'Daftar pengajuan cuti berhasil dimuat.',
    data:   rows,
    meta: {
      total,
      halaman:       parseInt(halaman, 10) || 1,
      per_halaman:   limit,
      total_halaman: Math.ceil(total / limit),
    },
  });
}

// ─── Detail Cuti ─────────────────────────────────────────────────────────────

/**
 * GET /api/cuti/:id
 */
async function detailCuti(req, res) {
  const { id } = req.params;

  const [[cuti]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

  if (!cuti) {
    return res.status(404).json({
      status: 'error',
      pesan:  `Pengajuan cuti dengan ID ${id} tidak ditemukan.`,
    });
  }

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(cuti.employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda tidak memiliki akses untuk melihat data cuti ini.',
    });
  }

  return res.status(200).json({
    status: 'sukses',
    pesan:  'Detail pengajuan cuti berhasil dimuat.',
    data:   cuti,
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { ajukanCuti, prosesCuti, daftarCuti, detailCuti };
