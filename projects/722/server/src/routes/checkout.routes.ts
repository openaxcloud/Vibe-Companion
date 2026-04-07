import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import { ZodError, z } from "zod";
import { getLogger } from "../utils/logger";
import { prisma } from "../db/client";
import { stripe } from "../services/stripe";
import { authenticate } from "../middleware/authenticate";
import { AppError } from "../utils/errors";

const router = Router();
const logger = getLogger("checkout.routes");

const CartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const CreateIntentSchema = z.object({
  cartId: z.string().min(1).optional(),
  cartItems: z.array(CartItemSchema).optional(),
  currency: z.string().default("usd"),
  paymentMethodType: z.enum(["card", "us_bank_account"]).default("card"),
  customerId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const ConfirmOrderSchema = z.object({
  paymentIntentId: z.string().min(1),
  cartId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  billingAddressId: z.string().optional(),
  additionalMetadata: z.record(z.string(), z.string()).optional(),
});

type CreateIntentBody = z.infer<typeof CreateIntentSchema>;
type ConfirmOrderBody = z.infer<typeof ConfirmOrderSchema>;

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const error = new AppError("Validation failed", httpStatus.BAD_REQUEST, {
      errors: result.array(),
    });
    next(error);
    return;
  }
  next();
};

const parseZodBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AppError("Invalid request body", httpStatus.BAD_REQUEST, {
        issues: err.issues,
      });
    }
    throw err;
  }
};

const calculateCartTotals = async (opts: {
  cartId?: string;
  cartItems?: { productId: string; quantity: number }[];
  userId: string;
}): Promise<{ amount: number; currency: string; items: any[] }> => {
  const { cartId, cartItems, userId } = opts;

  if (!cartId && (!cartItems || cartItems.length === 0)) {
    throw new AppError(
      "Either cartId or cartItems must be provided",
      httpStatus.BAD_REQUEST
    );
  }

  if (cartId) {
    const cart = await prisma.cart.findFirst({
      where: { id: cartId, userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new AppError("Cart not found", httpStatus.NOT_FOUND);
    }

    const amount = cart.items.reduce((total, item) => {
      const price = item.product.priceCents;
      return total + price * item.quantity;
    }, 0);

    return {
      amount,
      currency: "usd",
      items: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        priceCents: item.product.priceCents,
      })),
    };
  }

  const productIds = Array.from(new Set((cartItems || []).map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  let amount = 0;
  const items: any[] = [];

  for (const item of cartItems || []) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new AppError(`Product not found: undefined`, httpStatus.BAD_REQUEST);
    }
    const lineAmount = product.priceCents * item.quantity;
    amount += lineAmount;
    items.push({
      productId: product.id,
      quantity: item.quantity,
      priceCents: product.priceCents,
    });
  }

  return {
    amount,
    currency: "usd",
    items,
  };
};

router.post(
  "/create-intent",
  authenticate,
  body("cartId").optional().isString(),
  body("cartItems").optional().isArray(),
  body("currency").optional().isString(),
  body("paymentMethodType").optional().isString(),
  body("customerId").optional().isString(),
  body("metadata").optional().isObject(),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      next(new AppError("Unauthorized", httpStatus.UNAUTHORIZED));
      return;
    }

    let data: CreateIntentBody;
    try {
      data = parseZodBody(CreateIntentSchema, req.body);
    } catch (err) {
      next(err);
      return;
    }

    try {
      const { amount, currency, items } = await calculateCartTotals({
        cartId: data.cartId,
        cartItems: data.cartItems,
        userId,
      });

      if (amount <= 0) {
        throw new AppError("Cart total must be greater than zero", httpStatus.BAD_REQUEST);
      }

      const idempotencyKey = uuidv4();

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount,
          currency: data.currency || currency,
          payment_method_types: [data.paymentMethodType],
          customer: data.customerId,
          metadata: {
            userId,
            cartId: data.cartId ?? "",
            ...data.metadata,
          },
        },
        {
          idempotencyKey,
        }
      );

      logger.info("Created payment intent", {
        userId,
        paymentIntentId: paymentIntent.id,
        amount,
      });

      res.status(httpStatus.CREATED).json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency: data.currency || currency,
        items,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/confirm",
  authenticate,
  body("paymentIntentId").isString().notEmpty(),
  body("cartId").optional().isString(),
  body("shippingAddressId").optional().isString(),
  body("billingAddressId").optional().isString(),
  body("additionalMetadata").optional().isObject(),
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      next(new AppError("Unauthorized", httpStatus.UNAUTHORIZED));
      return;
    }

    let data: ConfirmOrderBody;
    try {
      data = parseZodBody(ConfirmOrderSchema, req.body);
    } catch (err) {
      next(err);
      return;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        data.paymentIntentId
      );

      if (!paymentIntent) {
        throw new AppError("PaymentIntent not found", httpStatus.NOT_FOUND);
      }

      if (paymentIntent.metadata?.userId !== userId) {
        throw new AppError("Forbidden", httpStatus.FORBIDDEN);
      }

      if (
        paymentIntent.status !== "succeeded" &&
        paymentIntent.status !== "requires_capture"
      ) {
        throw new AppError(
          `PaymentIntent not in a finalizable state: undefined`,
          httpStatus.BAD_REQUEST
        );
      }

      let cartId = data.cartId || (paymentIntent.metadata?.cartId || undefined);
      let cart = null;

      if (cartId) {
        cart = await prisma.cart.findFirst({
          where: { id: cartId, userId },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        if (!cart) {
          throw new AppError("Cart not found", httpStatus.NOT_FOUND);
        }
      }

      const amountFromIntent = paymentIntent.amount_received || paymentIntent.amount;
      if (!amountFromIntent || amountFromIntent <= 0) {
        throw new AppError(
          "Invalid payment amount on PaymentIntent",
          httpStatus.BAD_REQUEST
        );
      }

      const existingOrder = await prisma.order.findFirst({
        where: { paymentIntentId: data.paymentIntentId },
      });

      if (existingOrder) {
        res.status(httpStatus.OK).json({
          orderId: existingOrder.id,
          status: existingOrder.status,
        });
        return;
      }

      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            userId,
            paymentIntentId: data.paymentIntentId,