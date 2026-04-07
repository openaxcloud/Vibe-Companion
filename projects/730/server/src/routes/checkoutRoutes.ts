import express, { Request, Response, NextFunction, Router } from "express";
import Stripe from "stripe";
import { body, query, validationResult } from "express-validator";
import { v4 as uuidv4 } from "uuid";

const router: Router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

interface CartItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  price: number; // in smallest currency unit (e.g. cents)
  quantity: number;
  currency: string;
}

interface CreateCheckoutSessionBody {
  items: CartItem[];
  customerEmail?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

interface CreatePaymentIntentBody {
  amount: number; // smallest currency unit
  currency: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

interface CompleteCheckoutBody {
  paymentIntentId: string;
}

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitAmount: number;
  currency: string;
}

interface Order {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  email?: string;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  rawStripePaymentIntent?: Stripe.PaymentIntent;
}

// Placeholder: replace with real persistence (e.g. database)
const inMemoryOrders: Map<string, Order> = new Map();

const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
  ) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "ValidationError",
      details: errors.array(),
    });
    return;
  }
  next();
};

const toOrderStatus = (pi: Stripe.PaymentIntent): Order["status"] => {
  if (pi.status === "succeeded") return "paid";
  if (pi.status === "requires_payment_method" || pi.status === "requires_confirmation") {
    return "pending";
  }
  if (pi.status === "processing") return "pending";
  return "failed";
};

router.post(
  "/start",
  [
    body("items").isArray({ min: 1 }).withMessage("items must be a non-empty array"),
    body("items.*.id").isString().withMessage("item id must be string"),
    body("items.*.name").isString().withMessage("item name must be string"),
    body("items.*.price").isInt({ gt: 0 }).withMessage("item price must be positive int (smallest currency unit)"),
    body("items.*.quantity").isInt({ gt: 0 }).withMessage("item quantity must be positive"),
    body("items.*.currency").isString().withMessage("item currency must be string"),
    body("customerEmail").optional().isEmail().withMessage("customerEmail must be a valid email"),
    body("metadata").optional().isObject().withMessage("metadata must be an object"),
    body("successUrl").optional().isURL().withMessage("successUrl must be a valid URL"),
    body("cancelUrl").optional().isURL().withMessage("cancelUrl must be a valid URL"),
  ],
  validateRequest,
  asyncHandler(async (req: Request<unknown, unknown, CreateCheckoutSessionBody>, res: Response) => {
    const { items, customerEmail, metadata, successUrl, cancelUrl } = req.body;

    const currency = items[0].currency;
    if (!items.every((item) => item.currency === currency)) {
      res.status(400).json({
        error: "InvalidCurrency",
        message: "All items must have the same currency.",
      });
      return;
    }

    const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (amount <= 0) {
      res.status(400).json({
        error: "InvalidAmount",
        message: "Total amount must be greater than 0.",
      });
      return;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      receipt_email: customerEmail,
      metadata: {
        ...metadata,
        order_items: JSON.stringify(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unitAmount: item.price,
            currency: item.currency,
          }))
        ),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(201).json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });
  })
);

router.post(
  "/intent",
  [
    body("amount").isInt({ gt: 0 }).withMessage("amount must be positive int (smallest currency unit)"),
    body("currency").isString().withMessage("currency must be string"),
    body("customerEmail").optional().isEmail().withMessage("customerEmail must be a valid email"),
    body("metadata").optional().isObject().withMessage("metadata must be an object"),
  ],
  validateRequest,
  asyncHandler(async (req: Request<unknown, unknown, CreatePaymentIntentBody>, res: Response) => {
    const { amount, currency, customerEmail, metadata } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      receipt_email: customerEmail,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(201).json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });
  })
);

router.get(
  "/intent/client-secret",
  [query("paymentIntentId").isString().withMessage("paymentIntentId is required")],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentIntentId } = req.query as { paymentIntentId: string };

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent.client_secret) {
      res.status(404).json({
        error: "ClientSecretNotFound",
        message: "Client secret not found for this payment intent.",
      });
      return;
    }

    res.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  })
);

router.post(
  "/complete",
  [body("paymentIntentId").isString().withMessage("paymentIntentId is required")],
  validateRequest,
  asyncHandler(async (req: Request<unknown, unknown, CompleteCheckoutBody>, res: Response) => {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      res.status(400).json({
        error: "PaymentNotCompleted",
        message: "Payment is not completed yet.",
        status: paymentIntent.status,
      });
      return;
    }

    const existingOrder = Array.from(inMemoryOrders.values()).find(
      (order) => order.paymentIntentId === paymentIntent.id
    );
    if (existingOrder) {
      res.json(existingOrder);
      return;
    }

    let items: OrderItem[] = [];
    const metadata = paymentIntent.metadata || {};
    if (metadata.order_items) {
      try {
        const parsed = JSON.parse(metadata.order_items as string);
        if (Array.isArray(parsed)) {
          items = parsed.map((item: any) => ({
            productId: String(item.id),
            name: String(item.name),
            quantity: Number(item.quantity),
            unitAmount: Number(item.unitAmount),
            currency: String(item.currency),
          }));
        }
      } catch {
        items = [];
      }
    }

    const order: Order = {
      id: uuidv4(),
      paymentIntentId: paymentIntent.id,
      amount: typeof paymentIntent.amount === "number" ? paymentIntent.amount : 0,
      currency: paymentIntent.currency,
      status: toOrderStatus(paymentIntent),
      email: paymentIntent.receipt_email || undefined,
      items,
      createdAt: new Date(),
      updatedAt: new Date(),
      rawStripePaymentIntent: paymentIntent,
    };

    inMemoryOrders.set(order.id, order);

    res.status(201).json(order);
  })
);

router.get(
  "/orders/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = inMemoryOrders.get(id);
    if (!order) {
      res.status(404).json({