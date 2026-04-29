'use strict';

const dayjs                          = require('dayjs');
const customParseFormat              = require('dayjs/plugin/customParseFormat');
const { pool, getSettings }          = require('../utils/db');
const { getPegawai, updatePoinPegawai } = require('../utils/employeeClient');

dayjs.extend(customParseFormat);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowWIB() {
  // MySQL pool timezone sudah '+07:00', tapi untuk perbandingan JS kita pakai offset manual
  return dayjs().utcOffset(7);
}

/**
 * Hitung status kehadiran dan berapa menit terlambat.
 * @param {dayjs.Dayjs} waktuMasuk
 * @param {string}      jamMasuk       '08:00:00'
 * @param {number}      toleransiMenit
 * @returns {{ status: string, terlambatMenit: number }}
 */
function hitungStatusMasuk(waktuMasuk, jamMasuk, toleransiMenit) {
  const [h, m] = jamMasuk.split(':').map(Number);
  const batas  = waktuMasuk.clone().hour(h).minute(m + toleransiMenit).second(0);

  if (waktuMasuk.isAfter(batas)) {
    const terlambatMenit = waktuMasuk.diff(batas.clone().minute(m), 'minute');
    return { status: 'telat', terlambatMenit };
  }
  return { status: 'hadir', terlambatMenit: 0 };
}

// ─── Clock-In ─────────────────────────────────────────────────────────────────

/**
 * POST /api/absensi/masuk
 * Body: { employee_id }
 * Hanya admin atau pegawai itu sendiri (employee_id == req.user.sub).
 */
async function clockIn(req, res) {
  const { employee_id } = req.body;

  // Pastikan pegawai hanya bisa absen untuk dirinya sendiri kecuali admin
  if (req.user.role !== 'admin' && String(req.user.sub) !== String(employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda hanya dapat melakukan absensi untuk diri sendiri.',
    });
  }

  let pegawai;
  try {
    pegawai = await getPegawai(employee_id);
  } catch (err) {
    return res.status(err.status || 503).json({ status: 'error', pesan: err.message });
  }

  const settings    = await getSettings();
  const sekarang    = nowWIB();
  const tanggal     = sekarang.format('YYYY-MM-DD');
  const waktuMasuk  = sekarang.format('YYYY-MM-DD HH:mm:ss');

  // Cek sudah absen hari ini
  const [existing] = await pool.query(
    'SELECT id, waktu_masuk, waktu_pulang FROM attendances WHERE employee_id = ? AND tanggal = ?',
    [employee_id, tanggal],
  );
  if (existing.length > 0) {
    return res.status(409).json({
      status: 'error',
      pesan:  `Pegawai ${pegawai.nama} sudah tercatat hadir pada ${tanggal}.`,
    });
  }

  const { status, terlambatMenit } = hitungStatusMasuk(
    sekarang,
    settings.jamMasuk,
    settings.toleransiMenit,
  );

  const poinDelta = status === 'telat' ? settings.poinTelat : settings.poinTepat;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO attendances
        (employee_id, employee_nip, employee_name, tanggal,
         waktu_masuk, status, terlambat_menit, poin_delta, keterangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pegawai.id, pegawai.nip, pegawai.nama, tanggal,
        waktuMasuk, status, terlambatMenit, poinDelta,
        status === 'telat'
          ? `Terlambat ${terlambatMenit} menit dari jam masuk ${settings.jamMasuk}`
          : null,
      ],
    );

    await conn.commit();

    // Update poin di employee-service (non-blocking — gagal tidak batalkan transaksi)
    updatePoinPegawai(pegawai.id, poinDelta).catch(() => {});

    const pesanStatus = status === 'telat'
      ? `Terlambat ${terlambatMenit} menit. Poin berkurang ${Math.abs(poinDelta)}.`
      : `Tepat waktu. Poin bertambah ${poinDelta}.`;

    return res.status(201).json({
      status: 'sukses',
      pesan:  `Absensi masuk ${pegawai.nama} berhasil dicatat. ${pesanStatus}`,
      data: {
        id:              result.insertId,
        employee_id:     pegawai.id,
        employee_nip:    pegawai.nip,
        employee_name:   pegawai.nama,
        tanggal,
        waktu_masuk:     waktuMasuk,
        status,
        terlambat_menit: terlambatMenit,
        poin_delta:      poinDelta,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[attendance-service] clockIn error:', err);
    return res.status(500).json({
      status: 'error',
      pesan:  'Terjadi kesalahan saat mencatat absensi masuk.',
    });
  } finally {
    conn.release();
  }
}

// ─── Clock-Out ────────────────────────────────────────────────────────────────

/**
 * PATCH /api/absensi/pulang
 * Body: { employee_id }
 */
async function clockOut(req, res) {
  const { employee_id } = req.body;

  if (req.user.role !== 'admin' && String(req.user.sub) !== String(employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda hanya dapat melakukan absensi pulang untuk diri sendiri.',
    });
  }

  const tanggal    = nowWIB().format('YYYY-MM-DD');
  const waktuPulang = nowWIB().format('YYYY-MM-DD HH:mm:ss');

  const [rows] = await pool.query(
    'SELECT id, employee_id, employee_name, waktu_masuk, waktu_pulang, status FROM attendances WHERE employee_id = ? AND tanggal = ?',
    [employee_id, tanggal],
  );

  if (rows.length === 0) {
    return res.status(404).json({
      status: 'error',
      pesan:  `Belum ada data absensi masuk untuk pegawai ini pada ${tanggal}. Lakukan absensi masuk terlebih dahulu.`,
    });
  }

  const absensi = rows[0];

  if (absensi.waktu_pulang) {
    return res.status(409).json({
      status: 'error',
      pesan:  `Absensi pulang pegawai ini sudah tercatat pada ${tanggal}.`,
    });
  }

  await pool.query(
    'UPDATE attendances SET waktu_pulang = ? WHERE id = ?',
    [waktuPulang, absensi.id],
  );

  return res.status(200).json({
    status: 'sukses',
    pesan:  `Absensi pulang ${absensi.employee_name} berhasil dicatat.`,
    data: {
      id:           absensi.id,
      employee_id:  absensi.employee_id,
      employee_name: absensi.employee_name,
      tanggal,
      waktu_masuk:  absensi.waktu_masuk,
      waktu_pulang: waktuPulang,
      status:       absensi.status,
    },
  });
}

// ─── Tandai Alpha ─────────────────────────────────────────────────────────────

/**
 * POST /api/absensi/alpha
 * Body: { employee_id, tanggal?, keterangan? }
 * Hanya admin.
 */
async function tandaiAlpha(req, res) {
  const { employee_id, tanggal: tglInput, keterangan } = req.body;
  const tanggal = tglInput || nowWIB().format('YYYY-MM-DD');

  let pegawai;
  try {
    pegawai = await getPegawai(employee_id);
  } catch (err) {
    return res.status(err.status || 503).json({ status: 'error', pesan: err.message });
  }

  const [existing] = await pool.query(
    'SELECT id FROM attendances WHERE employee_id = ? AND tanggal = ?',
    [employee_id, tanggal],
  );
  if (existing.length > 0) {
    return res.status(409).json({
      status: 'error',
      pesan:  `Sudah ada data absensi untuk pegawai ${pegawai.nama} pada ${tanggal}.`,
    });
  }

  const settings = await getSettings();

  await pool.query(
    `INSERT INTO attendances
      (employee_id, employee_nip, employee_name, tanggal,
       status, terlambat_menit, poin_delta, keterangan)
     VALUES (?, ?, ?, ?, 'alpha', 0, ?, ?)`,
    [pegawai.id, pegawai.nip, pegawai.nama, tanggal, settings.poinAlpha, keterangan || null],
  );

  updatePoinPegawai(pegawai.id, settings.poinAlpha).catch(() => {});

  return res.status(201).json({
    status: 'sukses',
    pesan:  `Pegawai ${pegawai.nama} ditandai alpha pada ${tanggal}. Poin berkurang ${Math.abs(settings.poinAlpha)}.`,
  });
}

// ─── Riwayat ──────────────────────────────────────────────────────────────────

/**
 * GET /api/absensi?employee_id=&tanggal_mulai=&tanggal_selesai=&halaman=&per_halaman=
 */
async function riwayat(req, res) {
  const {
    employee_id,
    tanggal_mulai,
    tanggal_selesai,
    halaman     = 1,
    per_halaman = 20,
  } = req.query;

  // Pegawai (non-admin) hanya bisa melihat riwayat milik sendiri
  if (req.user.role !== 'admin' && String(req.user.sub) !== String(employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda hanya dapat melihat riwayat absensi milik sendiri.',
    });
  }

  const limit  = Math.min(parseInt(per_halaman, 10) || 20, 100);
  const offset = (Math.max(parseInt(halaman, 10) || 1, 1) - 1) * limit;

  const where   = [];
  const params  = [];

  if (employee_id) { where.push('employee_id = ?');  params.push(employee_id); }
  if (tanggal_mulai)   { where.push('tanggal >= ?'); params.push(tanggal_mulai); }
  if (tanggal_selesai) { where.push('tanggal <= ?'); params.push(tanggal_selesai); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM attendances ${whereClause}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT * FROM attendances ${whereClause} ORDER BY tanggal DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return res.status(200).json({
    status: 'sukses',
    pesan:  'Daftar riwayat absensi berhasil dimuat.',
    data:   rows,
    meta: {
      total,
      halaman:     parseInt(halaman, 10) || 1,
      per_halaman: limit,
      total_halaman: Math.ceil(total / limit),
    },
  });
}

// ─── Detail ───────────────────────────────────────────────────────────────────

/**
 * GET /api/absensi/:id
 */
async function detail(req, res) {
  const { id } = req.params;

  const [[row]] = await pool.query('SELECT * FROM attendances WHERE id = ?', [id]);

  if (!row) {
    return res.status(404).json({
      status: 'error',
      pesan:  `Data absensi dengan ID ${id} tidak ditemukan.`,
    });
  }

  // Pegawai non-admin hanya boleh lihat milik sendiri
  if (req.user.role !== 'admin' && String(req.user.sub) !== String(row.employee_id)) {
    return res.status(403).json({
      status: 'error',
      pesan:  'Anda tidak memiliki akses untuk melihat data absensi ini.',
    });
  }

  return res.status(200).json({
    status: 'sukses',
    pesan:  'Data absensi berhasil dimuat.',
    data:   row,
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { clockIn, clockOut, tandaiAlpha, riwayat, detail };
