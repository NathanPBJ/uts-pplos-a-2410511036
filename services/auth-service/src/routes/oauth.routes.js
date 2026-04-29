'use strict';

const { Router }   = require('express');
const passport     = require('passport');
const bcrypt       = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { pool }                                    = require('../utils/db');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');

const router = Router();

// ─── GET /api/auth/oauth/google ───────────────────────────────────────────────
// Arahkan pengguna ke halaman login Google (Authorization Code flow).

router.get(
  '/google',
  passport.authenticate('google', {
    scope:   ['profile', 'email'],
    session: false,
  })
);

// ─── GET /api/auth/oauth/google/callback ─────────────────────────────────────
// Google mengarahkan kembali ke sini setelah pengguna memberi izin.

router.get('/google/callback', (req, res) => {
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    // Kesalahan dari Google / jaringan
    if (err) {
      console.error('[oauth.routes][google/callback]', err.message);
      return res.status(500).json({
        status: 'error',
        pesan:  'Terjadi kesalahan saat memproses login Google. Silakan coba lagi.',
      });
    }

    // Autentikasi ditolak (akun nonaktif, dll.)
    if (!user) {
      const alasan = info?.message ?? 'Login dengan Google gagal.';
      const pesan  = alasan === 'Account is deactivated.'
        ? 'Akun Anda telah dinonaktifkan. Hubungi administrator untuk informasi lebih lanjut.'
        : 'Login dengan Google gagal. Silakan coba lagi.';

      return res.status(401).json({ status: 'error', pesan });
    }

    try {
      // Buat access token + refresh token
      const accessToken                          = generateAccessToken(user);
      const { token: refreshToken, expiresAt }   = generateRefreshToken(user);

      // Simpan refresh token (hashed) ke database
      const hashedRefresh = await bcrypt.hash(refreshToken, 10);
      await pool.query(
        `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), user.id, hashedRefresh, expiresAt]
      );

      return res.status(200).json({
        status: 'sukses',
        pesan:  'Login dengan Google berhasil. Selamat datang di Yayasan Satwa Lestari!',
        data: {
          pengguna: {
            id:             user.id,
            nama:           user.name,
            email:          user.email,
            peran:          user.role,
            foto_profil:    user.avatar_url  ?? null,
            provider_oauth: user.oauth_provider ?? 'google',
          },
          token: {
            akses:         accessToken,
            perbarui:      refreshToken,
            tipe:          'Bearer',
            berlaku_menit: 15,
          },
        },
      });
    } catch (dbErr) {
      console.error('[oauth.routes][google/callback] DB error:', dbErr.message);
      return res.status(500).json({
        status: 'error',
        pesan:  'Login Google berhasil, namun terjadi kesalahan saat menyimpan sesi. Silakan coba lagi.',
      });
    }
  })(req, res);
});

module.exports = router;
