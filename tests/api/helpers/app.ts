/**
 * Minimal Express test app factory.
 * Sets required env vars before any server module is imported.
 */

// Must be set before any server imports run
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-that-is-exactly-32ch';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-!!!';
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-padded!';
process.env.DISABLE_CSRF = 'true';
// Empty string avoids "DATABASE_URL must be set" throw when db.ts is NOT mocked
process.env.DATABASE_URL = '';

import express from 'express';
import session from 'express-session';

/** Returns a fresh Express app wired with JSON + memory-store session. */
export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
    })
  );

  /** Inject an authenticated session without going through the login flow. */
  app.get('/test/login', (req, res) => {
    (req.session as any).userId = req.query.userId ?? '1';
    req.session.save(() => res.json({ ok: true }));
  });

  return app;
}
