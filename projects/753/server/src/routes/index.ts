import express, { Request, Response, NextFunction, Router } from "express";
import type { JwtPayload } from "jsonwebtoken";
import authRouter from "./auth";
import productsRouter from "./products";
import cartRouter from "./cart";
import checkoutRouter from "./checkout";
import ordersRouter from "./orders";
import adminRouter from "./admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "user" | "admin";
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const router: Router = express.Router();

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

router.get("/health", (req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.get("/me", requireAuth, (req: Request, res: Response): void => {
  const user = req.user as AuthenticatedUser;
  res.status(200).json({
    id: user.id,
    email: user.email,
    role: user.role,
  });
});

router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/cart", cartRouter);
router.use("/checkout", checkoutRouter);
router.use("/orders", ordersRouter);
router.use("/admin", adminRouter);

export default router;