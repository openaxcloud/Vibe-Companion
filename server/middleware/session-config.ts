import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const isProduction = process.env.NODE_ENV === "production";
const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DOMAINS || process.env.REPL_SLUG);

if (!process.env.SESSION_SECRET) {
  if (isProduction) {
    throw new Error("SESSION_SECRET is required in production");
  }
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("[session] SESSION_SECRET not set — generated ephemeral secret (sessions will not survive restart)");
}

const PgStore = connectPgSimple(session);
let store: session.Store;

if (process.env.DATABASE_URL) {
  store = new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: "user_sessions",
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
    errorLog: (err: Error) => console.error("[session][pg-store]", err.message),
  });
  console.log("[session] store=postgres table=user_sessions");
} else {
  if (isProduction) {
    throw new Error("DATABASE_URL is required in production for persistent session storage");
  }
  store = new session.MemoryStore();
  console.warn("[session] store=memory (DEV ONLY — sessions lost on restart)");
}

export const sessionStore = store;

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  store,
  name: "ecode.sid",
  proxy: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProduction || isReplit,
    sameSite: isProduction || isReplit ? ("none" as const) : ("lax" as const),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
});

export function ensureCsrfToken(req: Request, _res: Response, next: NextFunction) {
  if (req.session && !(req.session as any).csrfToken) {
    (req.session as any).csrfToken = crypto.randomBytes(32).toString("hex");
  }
  next();
}
