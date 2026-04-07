import express, { Router } from "express";
import type { Request, Response } from "express";
import authRouter from "./auth";
import productsRouter from "./products";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import webhooksRouter from "./webhooks";
import healthRouter from "./health";

const router: Router = express.Router();

router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/cart", cartRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);
router.use("/webhooks", webhooksRouter);
router.use("/health", healthRouter);

router.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "API root",
    routes: [
      "/auth",
      "/products",
      "/cart",
      "/orders",
      "/payments",
      "/webhooks",
      "/health",
    ],
  });
});

export default router;