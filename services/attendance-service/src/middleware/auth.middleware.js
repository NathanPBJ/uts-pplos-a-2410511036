'use strict';

const { verifyAccessToken } = require('../utils/jwt');

/**
 * Verifikasi Bearer token dari header Authorization.
 * Menyimpan payload JWT di req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      status: 'error',
      pesan:  'Token autentikasi tidak disertakan. Sertakan Bearer token pada header Authorization.',
    });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        pesan:  'Token telah kedaluwarsa. Silakan perbarui token Anda.',
      });
    }
    return res.status(401).json({
      status: 'error',
      pesan:  'Token tidak valid atau telah dimanipulasi.',
    });
  }
}

/**
 * Otorisasi berdasarkan role.
 * @param {...string} roles  mis. authorize('admin') atau authorize('admin','staff')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', pesan: 'Anda belum terautentikasi.' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        pesan:  `Akses ditolak. Hanya ${roles.join(' atau ')} yang diizinkan.`,
      });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
