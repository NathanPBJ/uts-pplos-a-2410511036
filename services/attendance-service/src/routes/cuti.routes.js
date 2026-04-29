'use strict';

const { Router }                              = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticate, authorize }             = require('../middleware/auth.middleware');
const ctrl                                    = require('../controllers/cuti.controller');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      status:    'error',
      pesan:     'Data yang dikirim tidak valid.',
      kesalahan: errors.array().map((e) => ({ kolom: e.path, pesan: e.msg })),
    });
  }
  return next();
}

// ─── POST /api/cuti ───────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('employee_id')
      .notEmpty().withMessage('ID pegawai wajib diisi.')
      .isInt({ min: 1 }).withMessage('ID pegawai harus berupa angka positif.'),
    body('tanggal_mulai')
      .notEmpty().withMessage('Tanggal mulai wajib diisi.')
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format tanggal_mulai harus YYYY-MM-DD.'),
    body('tanggal_selesai')
      .notEmpty().withMessage('Tanggal selesai wajib diisi.')
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format tanggal_selesai harus YYYY-MM-DD.'),
    body('alasan')
      .notEmpty().withMessage('Alasan cuti wajib diisi.')
      .isLength({ min: 10, max: 500 }).withMessage('Alasan minimal 10 karakter, maksimal 500 karakter.'),
  ],
  validate,
  ctrl.ajukan,
);

// ─── GET /api/cuti ────────────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  [
    query('status')
      .optional()
      .isIn(['pending', 'disetujui', 'ditolak']).withMessage("Status harus 'pending', 'disetujui', atau 'ditolak'."),
    query('halaman').optional().isInt({ min: 1 }).withMessage('Halaman harus angka positif.'),
    query('per_halaman').optional().isInt({ min: 1, max: 100 }).withMessage('Per halaman harus antara 1 dan 100.'),
  ],
  validate,
  ctrl.daftar,
);

// ─── GET /api/cuti/:id ────────────────────────────────────────────────────────

router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('ID cuti harus berupa UUID yang valid.')],
  validate,
  ctrl.detail,
);

// ─── PATCH /api/cuti/:id/setujui — Admin ─────────────────────────────────────

router.patch(
  '/:id/setujui',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID().withMessage('ID cuti harus berupa UUID yang valid.'),
    body('catatan_admin').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  ctrl.setujui,
);

// ─── PATCH /api/cuti/:id/tolak — Admin ───────────────────────────────────────

router.patch(
  '/:id/tolak',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID().withMessage('ID cuti harus berupa UUID yang valid.'),
    body('catatan_admin')
      .optional().isString().isLength({ max: 500 }),
  ],
  validate,
  ctrl.tolak,
);

// ─── DELETE /api/cuti/:id — Batalkan oleh pegawai ────────────────────────────

router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('ID cuti harus berupa UUID yang valid.')],
  validate,
  ctrl.batalkan,
);

module.exports = router;
