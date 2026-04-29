'use strict';

const bcrypt                                      = require('bcryptjs');
const { validationResult }                        = require('express-validator');
const { v4: uuidv4 }                              = require('uuid');
const { pool }                                    = require('../utils/db');
const userModel                                   = require('../models/user.model');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  decodeToken,
}                                                 = require('../utils/jwt');

// ─── Helper ───────────────────────────────────────────────────────────────────

function kirimError(res, kode, pesan) {
  return res.status(kode).json({ status: 'error', pesan });
}

function kirimSukses(res, kode, pesan, data = {}) {
  return res.status(kode).json({ status: 'sukses', pesan, ...data });
}

function formatValidasiError(errors) {
  return errors.array().map((e) => ({
    kolom: e.path ?? e.param,
    pesan: e.msg,
  }));
}

// ─── daftar ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/daftar
 * Registrasi akun baru dengan email dan password.
 */
async function daftar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: 'error',
      pesan:  'Data yang dikirim tidak valid.',
      kesalahan: formatValidasiError(errors),
    });
  }

  const { nama, email, password } = req.body;

  try {
    // Cek email sudah terdaftar
    const existing = await userModel.findByEmail(email);
    if (existing) {
      return kirimError(res, 409, 'Email sudah terdaftar. Silakan gunakan email lain atau masuk dengan akun yang ada.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await userModel.create({
      name:     nama,
      email,
      password: hashedPassword,
      role:     'staff',
    });

    return kirimSukses(res, 201, 'Akun berhasil dibuat. Silakan masuk untuk melanjutkan.', {
      data: {
        id:    user.id,
        nama:  user.name,
        email: user.email,
        peran: user.role,
      },
    });
  } catch (err) {
    console.error('[auth.controller][daftar]', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan server. Pendaftaran gagal, silakan coba lagi.');
  }
}

// ─── masuk ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/masuk
 * Login dengan email + password. Mengembalikan access token dan refresh token.
 */
async function masuk(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: 'error',
      pesan:  'Data yang dikirim tidak valid.',
      kesalahan: formatValidasiError(errors),
    });
  }

  const { email, password } = req.body;

  try {
    const user = await userModel.findByEmail(email);

    if (!user) {
      return kirimError(res, 401, 'Email atau password salah.');
    }

    if (!user.is_active) {
      return kirimError(res, 403, 'Akun Anda telah dinonaktifkan. Hubungi administrator untuk informasi lebih lanjut.');
    }

    if (!user.password) {
      return kirimError(res, 401, 'Akun ini terdaftar melalui Google. Silakan masuk menggunakan Google.');
    }

    const passwordCocok = await bcrypt.compare(password, user.password);
    if (!passwordCocok) {
      return kirimError(res, 401, 'Email atau password salah.');
    }

    const accessToken                      = generateAccessToken(user);
    const { token: refreshToken, jti, expiresAt } = generateRefreshToken(user);

    // Hash refresh token sebelum disimpan
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);

    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), user.id, hashedRefresh, expiresAt]
    );

    return kirimSukses(res, 200, 'Berhasil masuk. Selamat bekerja!', {
      data: {
        pengguna: {
          id:           user.id,
          nama:         user.name,
          email:        user.email,
          peran:        user.role,
          foto_profil:  user.avatar_url ?? null,
          provider_oauth: user.oauth_provider ?? null,
        },
        token: {
          akses:          accessToken,
          perbarui:       refreshToken,
          tipe:           'Bearer',
          berlaku_menit:  15,
        },
      },
    });
  } catch (err) {
    console.error('[auth.controller][masuk]', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan server. Login gagal, silakan coba lagi.');
  }
}

// ─── perbaruiToken ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/perbarui-token
 * Tukar refresh token lama dengan access token baru (dan refresh token baru).
 */
async function perbaruiToken(req, res) {
  const { refresh_token: refreshToken } = req.body;

  if (!refreshToken) {
    return kirimError(res, 400, 'Refresh token tidak ditemukan dalam permintaan.');
  }

  try {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return kirimError(res, 401, 'Sesi Anda telah berakhir. Silakan login kembali.');
      }
      return kirimError(res, 401, 'Refresh token tidak valid.');
    }

    // Ambil semua refresh token aktif milik user ini
    const [rows] = await pool.query(
      `SELECT id, token
         FROM refresh_tokens
        WHERE user_id   = ?
          AND revoked   = 0
          AND expires_at > NOW()`,
      [payload.sub]
    );

    // Cocokkan refresh token yang dikirim dengan yang tersimpan (hashed)
    let tokenRow = null;
    for (const row of rows) {
      const cocok = await bcrypt.compare(refreshToken, row.token);
      if (cocok) { tokenRow = row; break; }
    }

    if (!tokenRow) {
      return kirimError(res, 401, 'Refresh token tidak dikenali atau sudah dicabut.');
    }

    // Cabut refresh token lama (rotasi token)
    await pool.query(
      `UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`,
      [tokenRow.id]
    );

    // Ambil data user terbaru
    const user = await userModel.findById(payload.sub);
    if (!user || !user.is_active) {
      return kirimError(res, 403, 'Akun tidak ditemukan atau telah dinonaktifkan.');
    }

    // Buat token baru
    const newAccessToken                          = generateAccessToken(user);
    const { token: newRefreshToken, expiresAt }   = generateRefreshToken(user);

    const hashedNewRefresh = await bcrypt.hash(newRefreshToken, 10);
    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), user.id, hashedNewRefresh, expiresAt]
    );

    return kirimSukses(res, 200, 'Token berhasil diperbarui.', {
      data: {
        token: {
          akses:         newAccessToken,
          perbarui:      newRefreshToken,
          tipe:          'Bearer',
          berlaku_menit: 15,
        },
      },
    });
  } catch (err) {
    console.error('[auth.controller][perbaruiToken]', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan server. Gagal memperbarui token.');
  }
}

// ─── keluar ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/keluar
 * Logout: masukkan access token ke blacklist & cabut refresh token.
 * Membutuhkan middleware authenticate sebelumnya.
 */
async function keluar(req, res) {
  try {
    const { jti } = req.user; // dari middleware authenticate

    // Decode token untuk ambil exp (tidak perlu verifikasi ulang)
    const authHeader = req.headers['authorization'] || '';
    const rawToken   = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (rawToken) {
      const decoded = decodeToken(rawToken);
      if (decoded?.exp) {
        const expiresAt = new Date(decoded.exp * 1000);
        await pool.query(
          `INSERT IGNORE INTO token_blacklist (id, token_jti, expires_at)
           VALUES (?, ?, ?)`,
          [uuidv4(), jti, expiresAt]
        );
      }
    }

    // Cabut semua refresh token aktif milik user ini
    await pool.query(
      `UPDATE refresh_tokens
          SET revoked = 1
        WHERE user_id = ?
          AND revoked = 0`,
      [req.user.id]
    );

    return kirimSukses(res, 200, 'Anda berhasil keluar. Sampai jumpa!');
  } catch (err) {
    console.error('[auth.controller][keluar]', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan server. Gagal melakukan logout.');
  }
}

// ─── profil ───────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/profil
 * Mengembalikan data profil pengguna yang sedang login.
 * Membutuhkan middleware authenticate sebelumnya.
 */
async function profil(req, res) {
  try {
    const user = await userModel.findById(req.user.id);

    if (!user) {
      return kirimError(res, 404, 'Data pengguna tidak ditemukan.');
    }

    return kirimSukses(res, 200, 'Data profil berhasil dimuat.', {
      data: {
        id:             user.id,
        nama:           user.name,
        email:          user.email,
        peran:          user.role,
        foto_profil:    user.avatar_url ?? null,
        provider_oauth: user.oauth_provider ?? null,
        aktif:          Boolean(user.is_active),
        dibuat_pada:    user.created_at,
        diperbarui_pada: user.updated_at,
      },
    });
  } catch (err) {
    console.error('[auth.controller][profil]', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan server. Gagal memuat profil.');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { daftar, masuk, perbaruiToken, keluar, profil };
