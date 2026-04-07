import express, { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { checkoutController } from "../controllers/checkout.controller";

const router: Router = Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response, next: NextFunction) => {
    checkoutController.handleStripeWebhook(req, res, next);
  }
);

export default router;