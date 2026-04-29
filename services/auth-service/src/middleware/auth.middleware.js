'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { pool }              = require('../utils/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Kirim respons error yang seragam.
 *
 * @param {import('express').Response} res
 * @param {number}  statusCode
 * @param {string}  pesan
 */
function kirimError(res, statusCode, pesan) {
  return res.status(statusCode).json({
    status:  'error',
    pesan,
  });
}

/**
 * Ekstrak Bearer token dari header Authorization.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function ekstrakBearerToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Periksa apakah jti ada di tabel token_blacklist.
 *
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
async function isTokenDicabut(jti) {
  const [rows] = await pool.query(
    `SELECT id
       FROM token_blacklist
      WHERE token_jti = ?
        AND expires_at > NOW()
      LIMIT 1`,
    [jti]
  );
  return rows.length > 0;
}

// ─── authenticate ─────────────────────────────────────────────────────────────

/**
 * Middleware: verifikasi JWT Access Token dari header Authorization.
 *
 * Alur:
 *  1. Ekstrak Bearer token dari header.
 *  2. Verifikasi signature & expiry menggunakan ACCESS_SECRET.
 *  3. Cek apakah token (jti) sudah ada di blacklist.
 *  4. Pasang payload ke req.user agar handler berikutnya bisa menggunakannya.
 *
 * @type {import('express').RequestHandler}
 */
async function authenticate(req, res, next) {
  try {
    // 1. Ambil token
    const token = ekstrakBearerToken(req);
    if (!token) {
      return kirimError(res, 401, 'Akses ditolak. Token autentikasi tidak ditemukan.');
    }

    // 2. Verifikasi token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return kirimError(res, 401, 'Sesi Anda telah berakhir. Silakan login kembali.');
      }
      if (err.name === 'JsonWebTokenError') {
        return kirimError(res, 401, 'Token tidak valid atau telah dimanipulasi.');
      }
      if (err.name === 'NotBeforeError') {
        return kirimError(res, 401, 'Token belum aktif. Silakan coba beberapa saat lagi.');
      }
      throw err; // error tak terduga → tangkap di bawah
    }

    // 3. Cek blacklist
    if (payload.jti) {
      const dicabut = await isTokenDicabut(payload.jti);
      if (dicabut) {
        return kirimError(res, 401, 'Token telah dicabut. Silakan login kembali.');
      }
    }

    // 4. Pasang user ke request
    req.user = {
      id:    payload.sub,
      email: payload.email,
      role:  payload.role,
      name:  payload.name,
      jti:   payload.jti,
    };

    next();
  } catch (err) {
    console.error('[auth-service][authenticate] Error tidak terduga:', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan server. Silakan coba lagi nanti.');
  }
}

// ─── authorize ────────────────────────────────────────────────────────────────

/**
 * Middleware factory: pastikan user yang sudah login memiliki salah satu role
 * yang diizinkan.
 *
 * Contoh penggunaan:
 *   router.delete('/user/:id', authenticate, authorize('admin'), handler);
 *   router.get('/laporan',     authenticate, authorize('admin', 'manajer'), handler);
 *
 * @param {...string} rolesDiizinkan  - Daftar role yang boleh mengakses endpoint.
 * @returns {import('express').RequestHandler}
 */
function authorize(...rolesDiizinkan) {
  return (req, res, next) => {
    // Pastikan authenticate sudah dipanggil lebih dulu
    if (!req.user) {
      return kirimError(
        res, 401,
        'Akses ditolak. Anda belum terautentikasi.'
      );
    }

    const roleUser = req.user.role;

    if (!rolesDiizinkan.includes(roleUser)) {
      return kirimError(
        res, 403,
        `Akses ditolak. Halaman ini hanya dapat diakses oleh: ${rolesDiizinkan.join(', ')}.`
      );
    }

    next();
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { authenticate, authorize };
