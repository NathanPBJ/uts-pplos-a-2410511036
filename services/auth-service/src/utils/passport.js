'use strict';

const passport      = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { v4: uuidv4 }               = require('uuid');
const { pool }                     = require('./db');

// ─── Guard ────────────────────────────────────────────────────────────────────

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    '[auth-service] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.'
  );
}

// ─── Google OAuth 2.0 Strategy ───────────────────────────────────────────────

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback',
      scope:        ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId  = profile.id;
        const email     = profile.emails?.[0]?.value   ?? null;
        const name      = profile.displayName          ?? 'Google User';
        const avatarUrl = profile.photos?.[0]?.value   ?? null;

        // ── 1. Look up by oauth_provider + oauth_id ─────────────────────────
        const [rows] = await pool.query(
          `SELECT id, name, email, role, oauth_provider, oauth_id, avatar_url, is_active
             FROM users
            WHERE oauth_provider = 'google'
              AND oauth_id       = ?
            LIMIT 1`,
          [googleId]
        );

        if (rows.length > 0) {
          // ── 2a. User exists — optionally refresh avatar / name ───────────
          const existing = rows[0];

          if (!existing.is_active) {
            return done(null, false, { message: 'Account is deactivated.' });
          }

          // Silently keep profile data up to date
          await pool.query(
            `UPDATE users
                SET name       = ?,
                    avatar_url = ?,
                    updated_at = NOW()
              WHERE id = ?`,
            [name, avatarUrl, existing.id]
          );

          return done(null, { ...existing, name, avatar_url: avatarUrl });
        }

        // ── 2b. No existing Google user — try to find by email ─────────────
        if (email) {
          const [byEmail] = await pool.query(
            `SELECT id, name, email, role, oauth_provider, oauth_id, avatar_url, is_active
               FROM users
              WHERE email = ?
              LIMIT 1`,
            [email]
          );

          if (byEmail.length > 0) {
            const linked = byEmail[0];

            if (!linked.is_active) {
              return done(null, false, { message: 'Account is deactivated.' });
            }

            // Link Google identity to the existing account
            await pool.query(
              `UPDATE users
                  SET oauth_provider = 'google',
                      oauth_id       = ?,
                      avatar_url     = COALESCE(avatar_url, ?),
                      updated_at     = NOW()
                WHERE id = ?`,
              [googleId, avatarUrl, linked.id]
            );

            return done(null, {
              ...linked,
              oauth_provider: 'google',
              oauth_id:       googleId,
              avatar_url:     linked.avatar_url ?? avatarUrl,
            });
          }
        }

        // ── 3. Brand-new user — create record ─────────────────────────────
        const newId = uuidv4();

        await pool.query(
          `INSERT INTO users
             (id, name, email, password, role, oauth_provider, oauth_id, avatar_url, is_active)
           VALUES
             (?,  ?,    ?,     NULL,     'viewer', 'google', ?,        ?,          1)`,
          [newId, name, email, googleId, avatarUrl]
        );

        const newUser = {
          id:             newId,
          name,
          email,
          role:           'viewer',
          oauth_provider: 'google',
          oauth_id:       googleId,
          avatar_url:     avatarUrl,
          is_active:      1,
        };

        return done(null, newUser);
      } catch (err) {
        console.error('[auth-service][passport] Google OAuth error:', err.message);
        return done(err);
      }
    }
  )
);

// ─── No sessions (stateless JWT) — stubs required by Passport internals ───────

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─── Export configured passport instance ─────────────────────────────────────

module.exports = passport;
