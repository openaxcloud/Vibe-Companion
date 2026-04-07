import { Router, Request, Response } from "express";
import authRouter from "./auth";
import productsRouter from "./products";
import cartRouter from "./cart";
import checkoutRouter from "./checkout";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";
import healthRouter from "./health";

const router = Router();

router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/cart", cartRouter);
router.use("/checkout", checkoutRouter);
router.use("/orders", ordersRouter);
router.use("/webhooks", webhooksRouter);
router.use("/health", healthRouter);

router.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "API root",
    routes: [
      "/auth",
      "/products",
      "/cart",
      "/checkout",
      "/orders",
      "/webhooks",
      "/health",
    ],
  });
});

export default router;