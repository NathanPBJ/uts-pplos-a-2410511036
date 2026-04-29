'use strict';

const { Router }                              = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticate, authorize }             = require('../middleware/auth.middleware');
const ctrl                                    = require('../controllers/absensi.controller');

const router = Router();

// ─── Validation helper ────────────────────────────────────────────────────────

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: 'error',
      pesan:  'Data yang dikirim tidak valid.',
      kesalahan: errors.array().map((e) => ({ kolom: e.path, pesan: e.msg })),
    });
  }
  return next();
}

// ─── Absensi Masuk ────────────────────────────────────────────────────────────

router.post(
  '/masuk',
  authenticate,
  [
    body('employee_id')
      .notEmpty().withMessage('ID pegawai wajib diisi.')
      .isInt({ min: 1 }).withMessage('ID pegawai harus berupa angka positif.'),
  ],
  validate,
  ctrl.clockIn,
);

// ─── Absensi Pulang ───────────────────────────────────────────────────────────

router.patch(
  '/pulang',
  authenticate,
  [
    body('employee_id')
      .notEmpty().withMessage('ID pegawai wajib diisi.')
      .isInt({ min: 1 }).withMessage('ID pegawai harus berupa angka positif.'),
  ],
  validate,
  ctrl.clockOut,
);

// ─── Tandai Alpha (Admin) ─────────────────────────────────────────────────────

router.post(
  '/alpha',
  authenticate,
  authorize('admin'),
  [
    body('employee_id')
      .notEmpty().withMessage('ID pegawai wajib diisi.')
      .isInt({ min: 1 }).withMessage('ID pegawai harus berupa angka positif.'),
    body('tanggal')
      .optional()
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format tanggal harus YYYY-MM-DD.'),
    body('keterangan').optional().isString(),
  ],
  validate,
  ctrl.tandaiAlpha,
);

// ─── Riwayat Absensi ──────────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  [
    query('tanggal_mulai').optional().isDate({ format: 'YYYY-MM-DD' }).withMessage('Format tanggal_mulai harus YYYY-MM-DD.'),
    query('tanggal_selesai').optional().isDate({ format: 'YYYY-MM-DD' }).withMessage('Format tanggal_selesai harus YYYY-MM-DD.'),
    query('halaman').optional().isInt({ min: 1 }).withMessage('Halaman harus angka positif.'),
    query('per_halaman').optional().isInt({ min: 1, max: 100 }).withMessage('Per halaman harus antara 1 dan 100.'),
  ],
  validate,
  ctrl.riwayat,
);

// ─── Detail Absensi ───────────────────────────────────────────────────────────

router.get(
  '/:id',
  authenticate,
  [
    param('id').isInt({ min: 1 }).withMessage('ID absensi harus berupa angka positif.'),
  ],
  validate,
  ctrl.detail,
);

module.exports = router;
