import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("[WARN] SESSION_SECRET not set, using random value (sessions won't persist across restarts)");
}

const PgSession = connectPgSimple(session);
let sessionStore: session.Store;
if (process.env.DATABASE_URL) {
  sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: "session",
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
    errorLog: (err: Error) => console.error("[PgSessionStore]", err.message),
  });
  console.log("[Session Store] Using PostgreSQL (persistent)");
} else {
  sessionStore = new session.MemoryStore();
  console.log("[Session Store] Using MemoryStore (fallback)");
}

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  name: "ecode.sid",
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === "production" || !!process.env.REPL_ID,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" || !!process.env.REPL_ID ? "none" as const : "lax" as const,
  },
});

export function ensureCsrfToken(req: Request, _res: Response, next: NextFunction) {
  if (req.session && !(req.session as any).csrfToken) {
    (req.session as any).csrfToken = crypto.randomBytes(32).toString("hex");
  }
  next();
}

export { sessionStore };
