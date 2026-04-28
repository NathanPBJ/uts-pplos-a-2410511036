'use strict';

const mysql = require('mysql2/promise');

// ─── Connection Pool ──────────────────────────────────────────────────────────

const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306', 10),
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASSWORD || '',
  database:          process.env.DB_NAME     || 'auth_db',
  waitForConnections: true,
  connectionLimit:   parseInt(process.env.DB_POOL_LIMIT || '10', 10),
  queueLimit:        0,
  charset:           'utf8mb4',
  timezone:          '+00:00',
});

// ─── DDL Statements ───────────────────────────────────────────────────────────

const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36)      NOT NULL DEFAULT (UUID()),
    name            VARCHAR(150)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    password        VARCHAR(255)      NULL COMMENT 'NULL for OAuth-only accounts',
    role            ENUM('admin','staff','viewer') NOT NULL DEFAULT 'viewer',
    oauth_provider  VARCHAR(50)       NULL COMMENT 'google | github | etc.',
    oauth_id        VARCHAR(255)      NULL,
    avatar_url      TEXT              NULL,
    is_active       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email        (email),
    UNIQUE KEY uq_users_oauth        (oauth_provider, oauth_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_REFRESH_TOKENS_TABLE = `
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          CHAR(36)     NOT NULL DEFAULT (UUID()),
    user_id     CHAR(36)     NOT NULL,
    token       TEXT         NOT NULL COMMENT 'Hashed refresh token',
    expires_at  DATETIME     NOT NULL,
    revoked     TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_refresh_tokens_user_id (user_id),
    CONSTRAINT fk_refresh_tokens_user
      FOREIGN KEY (user_id) REFERENCES users (id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_TOKEN_BLACKLIST_TABLE = `
  CREATE TABLE IF NOT EXISTS token_blacklist (
    id          CHAR(36)     NOT NULL DEFAULT (UUID()),
    token_jti   VARCHAR(255) NOT NULL COMMENT 'JWT jti claim',
    expires_at  DATETIME     NOT NULL  COMMENT 'Mirror of JWT exp — used for cleanup',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_token_blacklist_jti (token_jti),
    KEY idx_token_blacklist_expires   (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// ─── initDB ───────────────────────────────────────────────────────────────────

/**
 * Creates all required tables if they do not already exist.
 * Call this once on service startup (before the HTTP server starts).
 *
 * @returns {Promise<void>}
 */
async function initDB() {
  const conn = await pool.getConnection();
  try {
    console.log('[auth-service] Initializing database schema…');

    await conn.query(CREATE_USERS_TABLE);
    console.log('[auth-service] ✔  Table `users` ready');

    await conn.query(CREATE_REFRESH_TOKENS_TABLE);
    console.log('[auth-service] ✔  Table `refresh_tokens` ready');

    await conn.query(CREATE_TOKEN_BLACKLIST_TABLE);
    console.log('[auth-service] ✔  Table `token_blacklist` ready');

    console.log('[auth-service] Database schema initialization complete.');
  } catch (err) {
    console.error('[auth-service] Failed to initialize database schema:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { pool, initDB };
