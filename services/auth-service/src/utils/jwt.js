'use strict';

const jwt  = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// ─── Secrets & Config ─────────────────────────────────────────────────────────

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error(
    '[auth-service] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables.'
  );
}

const ACCESS_TOKEN_TTL  = '15m';   // 15 minutes
const REFRESH_TOKEN_TTL = '7d';    // 7 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a standard JWT payload.
 *
 * @param {object} user  - Plain user object from the database.
 * @returns {object}       JWT payload.
 */
function buildPayload(user) {
  return {
    sub:   user.id,
    email: user.email,
    role:  user.role,
    name:  user.name,
  };
}

// ─── Generate ─────────────────────────────────────────────────────────────────

/**
 * Generate a short-lived Access Token (15 minutes).
 *
 * @param {object} user  - User object { id, email, role, name }.
 * @returns {string}       Signed JWT string.
 */
function generateAccessToken(user) {
  const payload = {
    ...buildPayload(user),
    jti:  uuidv4(),   // unique token ID — used for blacklisting
    type: 'access',
  };

  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    issuer:    process.env.JWT_ISSUER || 'yayasan-satwa-lestari',
    audience:  process.env.JWT_AUDIENCE || 'ys-lestari-clients',
  });
}

/**
 * Generate a long-lived Refresh Token (7 days).
 *
 * @param {object} user  - User object { id, email, role, name }.
 * @returns {{ token: string, jti: string, expiresAt: Date }}
 *   Returns the signed token string, its jti, and the absolute expiry Date
 *   so the caller can persist them in the `refresh_tokens` table.
 */
function generateRefreshToken(user) {
  const jti = uuidv4();

  const payload = {
    ...buildPayload(user),
    jti,
    type: 'refresh',
  };

  const token = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
    issuer:    process.env.JWT_ISSUER   || 'yayasan-satwa-lestari',
    audience:  process.env.JWT_AUDIENCE || 'ys-lestari-clients',
  });

  // Calculate absolute expiry for DB storage
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days

  return { token, jti, expiresAt };
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Verify an Access Token.
 *
 * @param {string} token  - JWT string from the Authorization header.
 * @returns {object}        Decoded payload.
 * @throws {JsonWebTokenError | TokenExpiredError | NotBeforeError}
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, ACCESS_SECRET, {
    issuer:   process.env.JWT_ISSUER   || 'yayasan-satwa-lestari',
    audience: process.env.JWT_AUDIENCE || 'ys-lestari-clients',
  });

  if (decoded.type !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token type: expected access token.');
  }

  return decoded;
}

/**
 * Verify a Refresh Token.
 *
 * @param {string} token  - JWT string from the request body / cookie.
 * @returns {object}        Decoded payload.
 * @throws {JsonWebTokenError | TokenExpiredError | NotBeforeError}
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, REFRESH_SECRET, {
    issuer:   process.env.JWT_ISSUER   || 'yayasan-satwa-lestari',
    audience: process.env.JWT_AUDIENCE || 'ys-lestari-clients',
  });

  if (decoded.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('Invalid token type: expected refresh token.');
  }

  return decoded;
}

/**
 * Decode a token WITHOUT verifying the signature.
 * Useful for extracting the jti/exp of an already-expired token during logout.
 *
 * @param {string} token
 * @returns {object|null}
 */
function decodeToken(token) {
  return jwt.decode(token);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
