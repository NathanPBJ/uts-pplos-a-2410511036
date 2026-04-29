'use strict';

require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const rateLimit      = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt            = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 8000;

const AUTH_URL       = process.env.AUTH_SERVICE_URL       || 'http://auth-service:3001';
const EMPLOYEE_URL   = process.env.EMPLOYEE_SERVICE_URL   || 'http://employee-service:8080';
const ATTENDANCE_URL = process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3003';
const JWT_SECRET     = process.env.JWT_ACCESS_SECRET      || 'changeme_access_secret_min32chars';
const JWT_ISSUER     = process.env.JWT_ISSUER             || 'yayasan-satwa-lestari';
const JWT_AUDIENCE   = process.env.JWT_AUDIENCE           || 'ys-lestari-clients';

// ─── Middleware Global ────────────────────────────────────────────────────────

app.use(cors());
app.disable('x-powered-by');

// Rate limiter 60 req/menit per IP
const limiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (_req, res) => res.status(429).json({
    status: 'error',
    pesan:  'Terlalu banyak permintaan. Coba lagi dalam satu menit.',
  }),
});
app.use(limiter);

// ─── Rute Publik (tanpa JWT) ──────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  { method: 'POST', path: '/api/auth/daftar'        },
  { method: 'POST', path: '/api/auth/masuk'          },
  { method: 'POST', path: '/api/auth/perbarui-token' },
  { method: 'GET',  path: '/api/auth/oauth/google'           },
  { method: 'GET',  path: '/api/auth/oauth/google/callback'  },
];

function isPublic(req) {
  return PUBLIC_ROUTES.some(
    (r) => r.method === req.method && req.path === r.path,
  );
}

// ─── Middleware Validasi JWT ──────────────────────────────────────────────────

function jwtGuard(req, res, next) {
  if (isPublic(req)) return next();

  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      status: 'error',
      pesan:  'Token akses diperlukan.',
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      issuer:   JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch (err) {
    const pesan = err.name === 'TokenExpiredError'
      ? 'Token akses sudah kadaluarsa.'
      : 'Token akses tidak valid.';
    return res.status(401).json({ status: 'error', pesan });
  }

  if (payload.type !== 'access') {
    return res.status(401).json({
      status: 'error',
      pesan:  'Token bukan tipe access.',
    });
  }

  // Teruskan identitas ke downstream service via header
  req.headers['x-user-id']    = String(payload.sub);
  req.headers['x-user-role']  = payload.role  || '';
  req.headers['x-user-email'] = payload.email || '';
  req.headers['x-user-name']  = payload.name  || '';

  next();
}

app.use(jwtGuard);

// ─── Error Handler Proxy ──────────────────────────────────────────────────────

function onProxyError(err, _req, res) {
  console.error('[gateway] proxy error:', err.message);
  if (!res.headersSent) {
    res.status(502).json({
      status: 'error',
      pesan:  'Layanan tidak dapat dijangkau. Coba beberapa saat lagi.',
    });
  }
}

// ─── Proxy Factories ──────────────────────────────────────────────────────────

function proxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: { error: onProxyError },
  });
}

// ─── Routing ──────────────────────────────────────────────────────────────────

// Auth Service
app.use('/api/auth', proxy(AUTH_URL));

// Employee Service
app.use('/api/departemen',      proxy(EMPLOYEE_URL));
app.use('/api/jabatan',         proxy(EMPLOYEE_URL));
app.use('/api/pegawai',         proxy(EMPLOYEE_URL));
app.use('/api/riwayat-jabatan', proxy(EMPLOYEE_URL));

// Attendance Service
app.use('/api/absensi', proxy(ATTENDANCE_URL));
app.use('/api/cuti',    proxy(ATTENDANCE_URL));
app.use('/api/laporan', proxy(ATTENDANCE_URL));

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    pesan:  'Endpoint tidak ditemukan.',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[gateway] berjalan di port ${PORT}`);
});
