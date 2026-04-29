'use strict';

const { Router }                              = require('express');
const { query, validationResult }             = require('express-validator');
const { authenticate, authorize }             = require('../middleware/auth.middleware');
const ctrl                                    = require('../controllers/report.controller');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      status:    'error',
      pesan:     'Parameter yang dikirim tidak valid.',
      kesalahan: errors.array().map((e) => ({ kolom: e.path, pesan: e.msg })),
    });
  }
  return next();
}

const validasiPeriode = [
  query('bulan')
    .notEmpty().withMessage('Parameter bulan wajib diisi.')
    .isInt({ min: 1, max: 12 }).withMessage('Bulan harus antara 1 dan 12.'),
  query('tahun')
    .notEmpty().withMessage('Parameter tahun wajib diisi.')
    .isInt({ min: 2020, max: 2100 }).withMessage('Tahun tidak valid.'),
];

// GET /api/laporan/bulanan?bulan=1&tahun=2024&employee_id=
// Rekap JSON — semua role bisa akses (staff hanya bisa lihat rekap sendiri via employee_id)
router.get(
  '/bulanan',
  authenticate,
  [
    ...validasiPeriode,
    query('employee_id').optional().isInt({ min: 1 }).withMessage('employee_id harus berupa angka positif.'),
  ],
  validate,
  ctrl.rekapBulanan,
);

// GET /api/laporan/bulanan/export?bulan=1&tahun=2024
// Export .docx — hanya admin
router.get(
  '/bulanan/export',
  authenticate,
  authorize('admin'),
  validasiPeriode,
  validate,
  ctrl.exportDocx,
);

module.exports = router;
