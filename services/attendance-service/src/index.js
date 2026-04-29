'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { initDB }          = require('./utils/db');
const absensiRoutes       = require('./routes/absensi.routes');
const cutiRoutes          = require('./routes/cuti.routes');
const laporanRoutes       = require('./routes/laporan.routes');

const app  = express();
const PORT = process.env.PORT || 3003;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin:         process.env.CORS_ORIGIN || '*',
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({
    status:       'ok',
    service:      'attendance-service',
    organization: 'Yayasan Satwa Lestari',
    timestamp:    new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/absensi', absensiRoutes);
app.use('/api/cuti',    cutiRoutes);
app.use('/api/laporan', laporanRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    pesan:  `Rute ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[attendance-service] Unhandled error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    pesan:  'Terjadi kesalahan server yang tidak terduga. Silakan coba lagi nanti.',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`[attendance-service] Yayasan Satwa Lestari — berjalan di port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[attendance-service] Gagal memulai server:', err.message);
  process.exit(1);
});

module.exports = app;
