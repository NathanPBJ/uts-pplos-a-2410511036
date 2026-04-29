'use strict';

const { pool }   = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Cari user berdasarkan ID.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, oauth_provider, oauth_id, avatar_url, is_active,
            created_at, updated_at
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Cari user berdasarkan email (termasuk kolom password untuk keperluan login).
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, name, email, password, role, oauth_provider, oauth_id,
            avatar_url, is_active, created_at, updated_at
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

/**
 * Cari user berdasarkan provider + oauth_id.
 *
 * @param {string} provider  - Contoh: 'google'
 * @param {string} oauthId
 * @returns {Promise<object|null>}
 */
async function findByOAuth(provider, oauthId) {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, oauth_provider, oauth_id, avatar_url, is_active,
            created_at, updated_at
       FROM users
      WHERE oauth_provider = ?
        AND oauth_id       = ?
      LIMIT 1`,
    [provider, oauthId]
  );
  return rows[0] ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Buat user baru (registrasi lokal).
 *
 * @param {{ name: string, email: string, password: string, role?: string }} data
 * @returns {Promise<object>}  User yang baru dibuat (tanpa password).
 */
async function create({ name, email, password, role = 'viewer' }) {
  const id = uuidv4();

  await pool.query(
    `INSERT INTO users (id, name, email, password, role, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, name, email, password, role]
  );

  return {
    id,
    name,
    email,
    role,
    oauth_provider: null,
    oauth_id:       null,
    avatar_url:     null,
    is_active:      1,
  };
}

/**
 * Buat user baru via OAuth (provider eksternal).
 *
 * @param {{ name: string, email: string|null, oauthProvider: string, oauthId: string, avatarUrl?: string, role?: string }} data
 * @returns {Promise<object>}
 */
async function createOAuth({ name, email, oauthProvider, oauthId, avatarUrl = null, role = 'viewer' }) {
  const id = uuidv4();

  await pool.query(
    `INSERT INTO users (id, name, email, password, role, oauth_provider, oauth_id, avatar_url, is_active)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 1)`,
    [id, name, email, role, oauthProvider, oauthId, avatarUrl]
  );

  return {
    id,
    name,
    email,
    role,
    oauth_provider: oauthProvider,
    oauth_id:       oauthId,
    avatar_url:     avatarUrl,
    is_active:      1,
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Perbarui data profil user (name, avatar_url).
 *
 * @param {string} id
 * @param {{ name?: string, avatarUrl?: string }} data
 * @returns {Promise<boolean>}  true jika baris berhasil diubah.
 */
async function updateProfile(id, { name, avatarUrl }) {
  const fields = [];
  const values = [];

  if (name !== undefined)      { fields.push('name = ?');       values.push(name);      }
  if (avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(avatarUrl); }

  if (fields.length === 0) return false;

  fields.push('updated_at = NOW()');
  values.push(id);

  const [result] = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return result.affectedRows > 0;
}

/**
 * Perbarui password user (sudah di-hash sebelum dipanggil).
 *
 * @param {string} id
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
async function updatePassword(id, hashedPassword) {
  const [result] = await pool.query(
    `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
    [hashedPassword, id]
  );
  return result.affectedRows > 0;
}

/**
 * Tautkan akun OAuth ke user yang sudah ada.
 *
 * @param {string} id
 * @param {{ oauthProvider: string, oauthId: string, avatarUrl?: string }} data
 * @returns {Promise<boolean>}
 */
async function linkOAuth(id, { oauthProvider, oauthId, avatarUrl }) {
  const [result] = await pool.query(
    `UPDATE users
        SET oauth_provider = ?,
            oauth_id       = ?,
            avatar_url     = COALESCE(avatar_url, ?),
            updated_at     = NOW()
      WHERE id = ?`,
    [oauthProvider, oauthId, avatarUrl ?? null, id]
  );
  return result.affectedRows > 0;
}

/**
 * Aktifkan / nonaktifkan user.
 *
 * @param {string}  id
 * @param {boolean} isActive
 * @returns {Promise<boolean>}
 */
async function setActive(id, isActive) {
  const [result] = await pool.query(
    `UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
  return result.affectedRows > 0;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Hapus user secara permanen (hard delete).
 * Gunakan setActive(id, false) untuk soft delete.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const [result] = await pool.query(
    `DELETE FROM users WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  findById,
  findByEmail,
  findByOAuth,
  create,
  createOAuth,
  updateProfile,
  updatePassword,
  linkOAuth,
  setActive,
  remove,
};
