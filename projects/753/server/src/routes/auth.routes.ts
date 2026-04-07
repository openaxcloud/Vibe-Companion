import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

const authRouter = Router();

interface User {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
}

interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'passwordHash'>;
}

const usersStore: User[] = [];

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
};

const findUserByEmail = (email: string): User | undefined => {
  return usersStore.find((user) => user.email.toLowerCase() === email.toLowerCase());
};

const toPublicUser = (user: User): Omit<User, 'passwordHash'> => {
  const { passwordHash, ...rest } = user;
  return rest;
};

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
    return;
  }
  next();
};

const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authorization header missing or invalid' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { userId?: string; email?: string };
    const userId = decoded.userId;
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid token payload' });
      return;
    }
    const user = usersStore.find((u) => u.id === userId);
    if (!user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not found' });
      return;
    }
    req.user = toPublicUser(user);
    next();
  } catch (error) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid or expired token' });
  }
};

authRouter.post(
  '/register',
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be a non-empty string up to 100 characters'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, name } = req.body as { email: string; password: string; name?: string };

    const existingUser = findUserByEmail(email);
    if (existingUser) {
      res.status(StatusCodes.CONFLICT).json({ message: 'Email is already registered' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: generateId(),
      email,
      passwordHash,
      name,
      createdAt: new Date(),
    };

    usersStore.push(newUser);

    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(StatusCodes.CREATED).json({
      user: toPublicUser(newUser),
      token,
    });
  }
);

authRouter.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').isString().withMessage('Password is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };

    const user = findUserByEmail(email);
    if (!user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(StatusCodes.OK).json({
      user: toPublicUser(user),
      token,
    });
  }
);

authRouter.post('/logout', (req: Request, res: Response): void => {
  res.status(StatusCodes.OK).json({ message: 'Logged out successfully. Please discard your token.' });
});

authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Not authenticated' });
    return;
  }
  res.status(StatusCodes.OK).json({ user: req.user });
});

export default authRouter;