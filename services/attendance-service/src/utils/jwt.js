'use strict';

const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ISSUER        = process.env.JWT_ISSUER   || 'yayasan-satwa-lestari';
const AUDIENCE      = process.env.JWT_AUDIENCE || 'ysl-services';

/**
 * Verifikasi access token yang dikirim oleh client melalui API Gateway.
 * Melempar JsonWebTokenError / TokenExpiredError jika tidak valid.
 */
function verifyAccessToken(token) {
  if (!ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET belum dikonfigurasi di environment.');
  }
  return jwt.verify(token, ACCESS_SECRET, {
    issuer:   ISSUER,
    audience: AUDIENCE,
  });
}

module.exports = { verifyAccessToken };
