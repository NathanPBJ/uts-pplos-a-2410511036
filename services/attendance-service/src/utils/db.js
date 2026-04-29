'use strict';

const mysql = require('mysql2/promise');

// ─── Connection Pool ──────────────────────────────────────────────────────────

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'attendance_db',
  waitForConnections: true,
  connectionLimit:    parseInt(process.env.DB_POOL_LIMIT || '10', 10),
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+07:00', // WIB — penting untuk validasi jam masuk/pulang
});

// ─── DDL ─────────────────────────────────────────────────────────────────────

const CREATE_ATTENDANCES = `
  CREATE TABLE IF NOT EXISTS attendances (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    employee_id      INT UNSIGNED    NOT NULL              COMMENT 'ID dari employee-service',
    employee_nip     VARCHAR(20)     NOT NULL,
    employee_name    VARCHAR(150)    NOT NULL,
    tanggal          DATE            NOT NULL,
    waktu_masuk      DATETIME        NULL,
    waktu_pulang     DATETIME        NULL,
    status           ENUM('hadir','telat','alpha','cuti','libur')
                                     NOT NULL DEFAULT 'hadir',
    terlambat_menit  INT             NOT NULL DEFAULT 0,
    poin_delta       INT             NOT NULL DEFAULT 0
                                     COMMENT '+10 hadir, -5 telat, -20 alpha',
    keterangan       TEXT            NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE  KEY uq_absensi_harian  (employee_id, tanggal),
    KEY     idx_tanggal            (tanggal),
    KEY     idx_employee_id        (employee_id),
    KEY     idx_status             (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_LEAVE_REQUESTS = `
  CREATE TABLE IF NOT EXISTS leave_requests (
    id               CHAR(36)        NOT NULL DEFAULT (UUID()),
    employee_id      INT UNSIGNED    NOT NULL,
    employee_nip     VARCHAR(20)     NOT NULL,
    employee_name    VARCHAR(150)    NOT NULL,
    tanggal_mulai    DATE            NOT NULL,
    tanggal_selesai  DATE            NOT NULL,
    jumlah_hari      INT UNSIGNED    NOT NULL,
    alasan           TEXT            NOT NULL,
    status           ENUM('pending','disetujui','ditolak')
                                     NOT NULL DEFAULT 'pending',
    diproses_oleh    VARCHAR(150)    NULL      COMMENT 'Nama admin yang memproses',
    catatan_admin    TEXT            NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_employee_id   (employee_id),
    KEY idx_status        (status),
    KEY idx_tanggal_mulai (tanggal_mulai)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// Tabel singleton — selalu 1 baris (id = 1)
const CREATE_ATTENDANCE_SETTINGS = `
  CREATE TABLE IF NOT EXISTS attendance_settings (
    id                INT  NOT NULL DEFAULT 1,
    jam_masuk         TIME NOT NULL DEFAULT '08:00:00',
    toleransi_menit   INT  NOT NULL DEFAULT 15
                           COMMENT 'Menit toleransi sebelum dianggap telat',
    jam_pulang        TIME NOT NULL DEFAULT '17:00:00',
    poin_tepat_waktu  INT  NOT NULL DEFAULT  10,
    poin_telat        INT  NOT NULL DEFAULT  -5,
    poin_alpha        INT  NOT NULL DEFAULT -20,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_settings_singleton CHECK (id = 1)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const SEED_ATTENDANCE_SETTINGS = `
  INSERT IGNORE INTO attendance_settings
    (id, jam_masuk, toleransi_menit, jam_pulang, poin_tepat_waktu, poin_telat, poin_alpha)
  VALUES
    (1, '08:00:00', 15, '17:00:00', 10, -5, -20);
`;

// ─── initDB ───────────────────────────────────────────────────────────────────

async function initDB() {
  const conn = await pool.getConnection();
  try {
    console.log('[attendance-service] Menginisialisasi skema database…');

    await conn.query(CREATE_ATTENDANCES);
    console.log('[attendance-service] ✔  Tabel `attendances` siap');

    await conn.query(CREATE_LEAVE_REQUESTS);
    console.log('[attendance-service] ✔  Tabel `leave_requests` siap');

    await conn.query(CREATE_ATTENDANCE_SETTINGS);
    await conn.query(SEED_ATTENDANCE_SETTINGS);
    console.log('[attendance-service] ✔  Tabel `attendance_settings` siap');

    console.log('[attendance-service] Inisialisasi database selesai.');
  } catch (err) {
    console.error('[attendance-service] Gagal inisialisasi database:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

// ─── getSettings ─────────────────────────────────────────────────────────────

/**
 * Ambil konfigurasi jadwal kerja & poin dari DB.
 * @returns {Promise<{jamMasuk, toleransiMenit, jamPulang, poinTepat, poinTelat, poinAlpha}>}
 */
async function getSettings() {
  const [rows] = await pool.query('SELECT * FROM attendance_settings WHERE id = 1 LIMIT 1');
  const s = rows[0];
  return {
    jamMasuk:       s.jam_masuk,        // '08:00:00'
    toleransiMenit: s.toleransi_menit,  // 15
    jamPulang:      s.jam_pulang,       // '17:00:00'
    poinTepat:      s.poin_tepat_waktu, // 10
    poinTelat:      s.poin_telat,       // -5
    poinAlpha:      s.poin_alpha,       // -20
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { pool, initDB, getSettings };
