import { Router } from "express";
import authRouter from "./auth";
import productsRouter from "./products";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import checkoutRouter from "./checkout";

const router = Router();

router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/cart", cartRouter);
router.use("/orders", ordersRouter);
router.use("/checkout", checkoutRouter);

export default router;