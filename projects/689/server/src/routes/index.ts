import express, { Router } from "express";
import authRouter from "./auth";
import productsRouter from "./products";
import cartRouter from "./cart";
import checkoutRouter from "./checkout";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";
import adminRouter from "./admin";

const router: Router = express.Router();

// Health check / root endpoint
router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API is running",
    version: process.env.npm_package_version || "unknown",
  });
});

// Public / customer-facing routes
router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/cart", cartRouter);
router.use("/checkout", checkoutRouter);
router.use("/orders", ordersRouter);

// Webhooks (usually called by external providers)
router.use("/webhooks", webhooksRouter);

// Admin / backoffice routes
router.use("/admin", adminRouter);

export default router;