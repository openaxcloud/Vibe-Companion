import express, { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { JwtPayload } from "jsonwebtoken";
import { PrismaClient, User } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: User;
}

interface JwtUserPayload {
  id: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set. Authentication will not work correctly.");
}

const generateToken = (user: User): string => {
  const payload: JwtUserPayload = {
    id: user.id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization header missing or malformed" });
      return;
    }

    const token = authHeader.split(" ")[1];
    let decoded: JwtPayload | string;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const payload = decoded as JwtUserPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      res.status(401).json({ error: "User associated with token not found" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    body("name").optional().isString().isLength({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
      return;
    }

    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name?: string;
    };

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name: name || null,
        },
      });

      const token = generateToken(user);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      console.error("Error during registration:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isString().withMessage("Password is required"),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const token = generateToken(user);

      res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      console.error("Error during login:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
});

export default router;