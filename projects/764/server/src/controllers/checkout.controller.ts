import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import createHttpError from 'http-errors';
import { Types } from 'mongoose';
import dotenv from 'dotenv';
import { OrderModel } from '../models/order.model';
import { ProductModel } from '../models/product.model';
import { CartModel } from '../models/cart.model';
import { UserModel } from '../models/user.model';
import { mongoSession } from '../db/mongoSession';
import { logger } from '../utils/logger';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

if (!stripeWebhookSecret) {
  logger.warn('STRIPE_WEBHOOK_SECRET is not defined; webhook verification will fail.');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
});

type AuthedRequest = Request & {
  user?: {
    id: string;
    email?: string;
  };
};

interface CreatePaymentIntentBody {
  cartId?: string;
  items?: Array<{
    productId: string;
    quantity: number;
  }>;
  currency?: string;
  metadata?: Record<string, string>;
}

interface StripeCheckoutMetadata {
  userId: string;
  cartId?: string;
  orderType: 'cart' | 'direct';
}

const calculateOrderAmountFromItems = async (
  items: Array<{ productId: string; quantity: number }>
): Promise<number> => {
  if (!items || items.length === 0) {
    throw createHttpError(400, 'No items provided');
  }

  const productIds = items.map((i) => new Types.ObjectId(i.productId));
  const products = await ProductModel.find({
    _id: { $in: productIds },
    isActive: true,
  }).lean();

  const productsMap = new Map<string, typeof products[0]>();
  products.forEach((p) => productsMap.set(p._id.toString(), p));

  let amount = 0;

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (!product) {
      throw createHttpError(400, `Product not found: undefined`);
    }
    if (product.stock < item.quantity) {
      throw createHttpError(400, `Insufficient stock for product: undefined`);
    }
    amount += product.price * item.quantity;
  }

  return amount;
};

const calculateOrderAmountFromCart = async (cartId: string): Promise<{
  amount: number;
  items: Array<{ productId: string; quantity: number }>;
}> => {
  const cart = await CartModel.findById(cartId)
    .populate('items.product', 'price stock isActive name')
    .lean();

  if (!cart) {
    throw createHttpError(404, 'Cart not found');
  }

  let amount = 0;
  const items: Array<{ productId: string; quantity: number }> = [];

  for (const item of cart.items) {
    const product: any = item.product;
    if (!product || !product.isActive) {
      throw createHttpError(400, 'Cart contains inactive or missing products');
    }
    if (product.stock < item.quantity) {
      throw createHttpError(400, `Insufficient stock for product: undefined`);
    }
    amount += product.price * item.quantity;
    items.push({
      productId: product._id.toString(),
      quantity: item.quantity,
    });
  }

  return { amount, items };
};

export const createPaymentIntent = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw createHttpError(401, 'Unauthorized');
    }

    const { cartId, items, currency = 'usd', metadata = {} } = req.body as CreatePaymentIntentBody;

    let amount: number;
    let normalizedItems: Array<{ productId: string; quantity: number }>;
    let orderType: StripeCheckoutMetadata['orderType'];

    if (cartId) {
      const result = await calculateOrderAmountFromCart(cartId);
      amount = result.amount;
      normalizedItems = result.items;
      orderType = 'cart';
    } else if (items && items.length > 0) {
      amount = await calculateOrderAmountFromItems(items);
      normalizedItems = items;
      orderType = 'direct';
    } else {
      throw createHttpError(400, 'Either cartId or items must be provided');
    }

    if (amount <= 0) {
      throw createHttpError(400, 'Invalid order amount');
    }

    const user = await UserModel.findById(userId).lean();
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    const stripeMetadata: Stripe.MetadataParam = {
      userId,
      orderType,
      ...(cartId ? { cartId } : {}),
      ...Object.entries(metadata || {}).reduce<Record<string, string>>((acc, [k, v]) => {
        acc[k] = String(v);
        return acc;
      }, {}),
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: stripeMetadata,
      receipt_email: user.email || undefined,
    });

    res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      items: normalizedItems,
    });
  } catch (error) {
    next(error);
  }
};

const fulfillOrderFromPaymentIntent = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  const metadata = paymentIntent.metadata || {};
  const userId = metadata.userId;
  const orderType = metadata.orderType as 'cart' | 'direct' | undefined;
  const cartId = metadata.cartId;

  if (!userId) {
    throw createHttpError(400, 'PaymentIntent missing userId metadata');
  }

  if (!orderType) {
    throw createHttpError(400, 'PaymentIntent missing orderType metadata');
  }

  await mongoSession.withTransaction(async (session) => {
    let items: Array<{ productId: string; quantity: number }> = [];

    if (orderType === 'cart') {
      if (!cartId) {
        throw createHttpError(400, 'PaymentIntent missing cartId metadata for cart order');
      }
      const cart = await CartModel.findOne({ _id: cartId, user: userId })
        .populate('items.product', 'price stock isActive name')
        .session(session);

      if (!cart) {
        throw createHttpError(404, 'Cart not found');
      }

      for (const item of cart.items) {
        const product: any = item.product;
        if (!product || !product.isActive) {
          throw createHttpError(400, 'Cart contains inactive or missing products');
        }
        if (product.stock < item.quantity) {
          throw createHttpError(400, `Insufficient stock for product: undefined`);
        }
        items.push({
          productId: product._id.toString(),
          quantity: item.quantity,
        });
      }
    } else {
      const rawItems = metadata.items ? JSON.parse(metadata.items) : [];
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw createHttpError(400, 'Missing items metadata for direct order');
      }
      items = rawItems;
    }

    const productIds = items.map((i) => new Types.ObjectId(i.productId));
    const products = await ProductModel.find({
      _id: { $in: productIds },
      isActive: true,
    }).session(session);

    const map = new Map<string, (typeof products)[number]>();
    products.forEach((p) => map.set(p._id.toString(), p));

    let totalAmount = 0;
    const orderItems: {
      product: Types.ObjectId;
      quantity: number;
      price: number;
    }[] = [];

    for (const item of items) {
      const product = map.get(item.productId);
      if (!product) {
        throw createHttpError(400, `Product not found: undefined`);
      }
      if (product.stock < item.quantity) {
        throw createHttpError(400, `Insufficient stock for product: undefined`);
      }
      product.stock -= item.quantity;
      totalAmount += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    for (const product of products) {
      await product.save({ session });
    }

    const order = await OrderModel.create(
      [
        {
          user: new Types.ObjectId(userId),
          items: orderItems,
          totalAmount,
          currency: paymentIntent.currency,
          payment: {
            provider: 'stripe',
            paymentIntentId: paymentIntent.id,
            status: 'succeeded',
            raw: paymentIntent,
          },
          status: 'paid',
        },