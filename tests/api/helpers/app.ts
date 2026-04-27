import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "../../../server/storage";

export function buildBaseApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "test-secret-ci-1234567890abcdef",
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
      name: "ecode.sid",
      cookie: { secure: false, sameSite: "lax", httpOnly: true },
    }),
  );
  return app;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId;
  if (userId) {
    if (typeof userId !== "string") (req.session as any).userId = String(userId);
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

export async function createTestUser() {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@api-test.internal`;
  const hash = await bcrypt.hash("testpass123", 1);
  const user = await storage.createUser({ email, password: hash, displayName: "API Test User" });
  return { id: String(user.id), email };
}

export async function deleteTestUser(userId: string) {
  try {
    await storage.deleteUser(userId);
  } catch {}
}

export async function createTestProject(userId: string) {
  const p = await storage.createProject(userId, {
    name: `test-project-${Date.now()}`,
    language: "javascript",
    visibility: "private",
  });
  return { id: String(p.id) };
}

export async function deleteTestProject(projectId: string, userId: string) {
  try {
    await storage.deleteProject(projectId, userId);
  } catch {}
}

export function injectUser(userId: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req.session as any).userId = userId;
    next();
  };
}
