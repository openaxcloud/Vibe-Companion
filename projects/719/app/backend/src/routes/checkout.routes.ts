import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import dotenv from "dotenv";
import { getCartById, validateCartIntegrity } from "../services/cart.service";
import { getProductById, validateInventoryForCart, decrementInventoryForCart } from "../services/inventory.service";
import { createOrder, updateOrderPaymentStatus, getOrderById } from "../services/order.service";
import { authenticateUser } from "../middleware/auth.middleware";
import { logger } from "../utils/logger";

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

const router: Router = express.Router();

type AuthedRequest = Request & {
  user?: {
    id: string;
    email?: string;
  };
};

const createPaymentIntentSchema = z.object({
  cartId: z.string().min(1, "cartId is required"),
  currency: z.string().default("usd"),
  paymentMethodType: z.enum(["card"]).default("card"),
});

const confirmOrderSchema = z.object({
  paymentIntentId: z.string().min(1, "paymentIntentId is required"),
  cartId: z.string().min(1, "cartId is required"),
});

router.post(
  "/create-payment-intent",
  authenticateUser,
  async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = createPaymentIntentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.flatten(),
        });
        return;
      }

      const { cartId, currency, paymentMethodType } = parseResult.data;

      const cart = await getCartById(cartId, req.user?.id);
      if (!cart) {
        res.status(404).json({ error: "Cart not found" });
        return;
      }

      const cartValidation = await validateCartIntegrity(cart);
      if (!cartValidation.isValid) {
        res.status(400).json({
          error: "Cart validation failed",
          issues: cartValidation.issues,
        });
        return;
      }

      const inventoryValidation = await validateInventoryForCart(cart);
      if (!inventoryValidation.isValid) {
        res.status(409).json({
          error: "Insufficient inventory for one or more items",
          issues: inventoryValidation.issues,
        });
        return;
      }

      const lineItemsDetails = await Promise.all(
        cart.items.map(async (item) => {
          const product = await getProductById(item.productId);
          const unitPriceCents = Math.round(product.price * 100);
          return {
            name: product.name,
            quantity: item.quantity,
            unitPriceCents,
          };
        })
      );

      const amount = lineItemsDetails.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0
      );

      if (amount <= 0) {
        res.status(400).json({ error: "Cart total must be greater than zero" });
        return;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        payment_method_types: [paymentMethodType],
        metadata: {
          cartId,
          userId: req.user?.id ?? "",
        },
      });

      const order = await createOrder({
        userId: req.user?.id ?? null,
        cartId,
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: "pending",
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: lineItemsDetails.find((d) => d.name === item.productName)?.unitPriceCents ?? 0,
        })),
      });

      res.status(201).json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        orderId: order.id,
      });
    } catch (error) {
      logger.error("Error in /create-payment-intent", { error });
      next(error);
    }
  }
);

router.post(
  "/confirm",
  authenticateUser,
  async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = confirmOrderSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.flatten(),
        });
        return;
      }

      const { paymentIntentId, cartId } = parseResult.data;

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent) {
        res.status(404).json({ error: "PaymentIntent not found" });
        return;
      }

      if (paymentIntent.status !== "succeeded") {
        res.status(400).json({
          error: "Payment not completed",
          status: paymentIntent.status,
        });
        return;
      }

      if (paymentIntent.metadata.cartId !== cartId) {
        res.status(400).json({ error: "PaymentIntent cartId mismatch" });
        return;
      }

      const order = await getOrderById({ stripePaymentIntentId: paymentIntentId });
      if (!order) {
        res.status(404).json({ error: "Order not found for payment intent" });
        return;
      }

      if (order.status === "paid") {
        res.status(200).json({ message: "Order already confirmed", orderId: order.id });
        return;
      }

      const cart = await getCartById(cartId, req.user?.id);
      if (!cart) {
        res.status(404).json({ error: "Cart not found" });
        return;
      }

      const inventoryValidation = await validateInventoryForCart(cart);
      if (!inventoryValidation.isValid) {
        res.status(409).json({
          error: "Insufficient inventory to finalize order",
          issues: inventoryValidation.issues,
        });
        return;
      }

      await decrementInventoryForCart(cart);
      const updatedOrder = await updateOrderPaymentStatus(order.id, "paid");

      res.status(200).json({
        message: "Order confirmed",
        orderId: updatedOrder.id,
        status: updatedOrder.status,
      });
    } catch (error) {
      logger.error("Error in /confirm", { error });
      next(error);
    }
  }
);

export default router;