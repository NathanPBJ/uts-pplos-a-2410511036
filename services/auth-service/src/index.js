require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const passport = require('passport');

const { initDB } = require('./utils/db');

// Import routes
const authRoutes  = require('./routes/auth.routes');
const oauthRoutes = require('./routes/oauth.routes');

// Import passport config
require('./utils/passport');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.CORS_ORIGIN || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Stateless JWT — tidak pakai session
app.use(passport.initialize());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:       'ok',
    service:      'auth-service',
    organization: 'Yayasan Satwa Lestari',
    timestamp:    new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/auth/oauth', oauthRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    pesan:  `Rute ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[auth-service] Unhandled error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    pesan:  'Terjadi kesalahan server yang tidak terduga. Silakan coba lagi nanti.',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`[auth-service] Yayasan Satwa Lestari — berjalan di port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[auth-service] Gagal memulai server:', err.message);
  process.exit(1);
});

module.exports = app;
