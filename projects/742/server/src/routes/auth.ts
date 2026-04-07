import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();

// Environment / config
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

// In-memory user store for demonstration purposes.
// Replace with real DB integration in production.
type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const usersById = new Map<string, UserRecord>();
const usersByEmail = new Map<string, UserRecord>();

let nextUserId = 1;

// Schemas
const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1),
});

// Types
type JwtPayload = {
  sub: string;
  email: string;
};

type AuthenticatedRequest = Request & {
  user?: UserRecord;
};

// Helpers
function createToken(user: UserRecord): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid Authorization header format' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = usersById.get(decoded.sub);

    if (!user) {
      return res.status(401).json({ error: 'User not found for token' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Routes

// POST /register
router.post('/register', async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.flatten(),
    });
  }

  const { email, password, name } = parseResult.data;

  const normalizedEmail = email.toLowerCase();

  if (usersByEmail.has(normalizedEmail)) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();
    const id = String(nextUserId++);

    const user: UserRecord = {
      id,
      email: normalizedEmail,
      passwordHash,
      name: name ?? null,
      createdAt: now,
      updatedAt: now,
    };

    usersById.set(id, user);
    usersByEmail.set(normalizedEmail, user);

    const token = createToken(user);

    return res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    // In production, log the error
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /login
router.post('/login', async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.flatten(),
    });
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase();

  const user = usersByEmail.get(normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  try {
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createToken(user);

    return res.status(200).json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    // In production, log the error
    return res.status(500).json({ error: 'Failed to login user' });
  }
});

// GET /me
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    user: serializeUser(req.user),
  });
});

export default router;