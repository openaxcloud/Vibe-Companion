import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

if (!JWT_SECRET) {
  // In a real app you'd handle this more gracefully at startup
  // but for this isolated module, we throw to avoid silent failure.
  throw new Error('JWT_SECRET is not set in environment variables');
}

const registerSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(128),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;

interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
}

interface AuthenticatedUserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResponse {
  token: string;
  user: AuthenticatedUserProfile;
}

const buildUserProfile = (user: User): AuthenticatedUserProfile => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signAuthToken = (user: User): string => {
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

const asyncHandler =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = registerSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'ValidationError',
        details: parseResult.error.flatten(),
      });
    }

    const { email, password, name } = parseResult.data as RegisterBody;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'UserExists',
        message: 'A user with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    const token = signAuthToken(newUser);
    const userProfile = buildUserProfile(newUser);

    const response: AuthResponse = {
      token,
      user: userProfile,
    };

    return res.status(201).json(response);
  })
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'ValidationError',
        details: parseResult.error.flatten(),
      });
    }

    const { email, password } = parseResult.data as LoginBody;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: 'InvalidCredentials',
        message: 'Invalid email or password.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'InvalidCredentials',
        message: 'Invalid email or password.',
      });
    }

    const token = signAuthToken(user);
    const userProfile = buildUserProfile(user);

    const response: AuthResponse = {
      token,
      user: userProfile,
    };

    return res.status(200).json(response);
  })
);

export default router;