'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const { authenticate }  = require('../middleware/auth.middleware');
const ctrl              = require('../controllers/auth.controller');

const router = Router();

// ─── Aturan Validasi ──────────────────────────────────────────────────────────

const validasiDaftar = [
  body('nama')
    .trim()
    .notEmpty().withMessage('Nama tidak boleh kosong.')
    .isLength({ min: 2, max: 150 }).withMessage('Nama harus antara 2 hingga 150 karakter.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email tidak boleh kosong.')
    .isEmail().withMessage('Format email tidak valid.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password tidak boleh kosong.')
    .isLength({ min: 8 }).withMessage('Password minimal 8 karakter.')
    .matches(/[A-Z]/).withMessage('Password harus mengandung minimal satu huruf kapital.')
    .matches(/[0-9]/).withMessage('Password harus mengandung minimal satu angka.'),
];

const validasiMasuk = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email tidak boleh kosong.')
    .isEmail().withMessage('Format email tidak valid.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password tidak boleh kosong.'),
];

const validasiPerbaruiToken = [
  body('refresh_token')
    .notEmpty().withMessage('Refresh token tidak boleh kosong.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/daftar
router.post('/daftar', validasiDaftar, ctrl.daftar);

// POST /api/auth/masuk
router.post('/masuk', validasiMasuk, ctrl.masuk);

// POST /api/auth/perbarui-token
router.post('/perbarui-token', validasiPerbaruiToken, ctrl.perbaruiToken);

// POST /api/auth/keluar  — butuh token valid
router.post('/keluar', authenticate, ctrl.keluar);

// GET /api/auth/profil  — butuh token valid
router.get('/profil', authenticate, ctrl.profil);

module.exports = router;
