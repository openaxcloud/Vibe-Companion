import express, { Request, Response, Router } from "express";
import authRouter from "./auth";
import productRouter from "./product";
import categoryRouter from "./category";
import cartRouter from "./cart";
import checkoutRouter from "./checkout";
import orderRouter from "./order";
import webhookRouter from "./webhook";

const router: Router = express.Router();

// Healthcheck endpoint
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Versioned API router
const v1Router: Router = express.Router();

// Mount feature routers under v1
v1Router.use("/auth", authRouter);
v1Router.use("/products", productRouter);
v1Router.use("/categories", categoryRouter);
v1Router.use("/cart", cartRouter);
v1Router.use("/checkout", checkoutRouter);
v1Router.use("/orders", orderRouter);
v1Router.use("/webhooks", webhookRouter);

// Mount v1 router
router.use("/v1", v1Router);

export default router;