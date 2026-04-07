import express, { Router, Request, Response } from "express";
import authRoutes from "./auth";
import productsRoutes from "./products";
import cartRoutes from "./cart";
import checkoutRoutes from "./checkout";
import ordersRoutes from "./orders";
import adminRoutes from "./admin";
import inventoryRoutes from "./inventory";
import webhooksRoutes from "./webhooks";

const router: Router = express.Router();

router.use("/auth", authRoutes);
router.use("/products", productsRoutes);
router.use("/cart", cartRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/orders", ordersRoutes);
router.use("/admin", adminRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/webhooks", webhooksRoutes);

router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default router;