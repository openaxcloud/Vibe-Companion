import { Router, Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { CartModel, CartDocument, CartItem } from '../models/Cart';
import { ProductVariantModel } from '../models/ProductVariant';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

const addOrUpdateItemSchema = z.object({
  variantId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid variant ID',
  }),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const removeItemSchema = z.object({
  variantId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid variant ID',
  }),
});

const clearCartSchema = z.object({}).optional();

const calculateCartTotals = (cart: CartDocument) => {
  let totalQuantity = 0;
  let subtotal = 0;

  cart.items.forEach((item) => {
    const price = item.price ?? 0;
    totalQuantity += item.quantity;
    subtotal += price * item.quantity;
  });

  const total = subtotal;

  return {
    totalQuantity,
    subtotal,
    total,
  };
};

const populateItemPrices = async (items: CartItem[]): Promise<CartItem[]> => {
  const variantIds = items
    .map((item) => item.variantId)
    .filter((id) => !!id)
    .map((id) => new Types.ObjectId(id));

  if (!variantIds.length) {
    return items;
  }

  const variants = await ProductVariantModel.find({
    _id: { $in: variantIds },
  }).select('_id price');

  const priceMap = new Map<string, number>();
  variants.forEach((variant) => {
    priceMap.set(variant._id.toString(), variant.price);
  });

  return items.map((item) => {
    const price = priceMap.get(item.variantId.toString()) ?? item.price ?? 0;
    return {
      ...item,
      price,
    };
  });
};

const getOrCreateCart = async (userId: string): Promise<CartDocument> => {
  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    cart = new CartModel({
      userId,
      items: [],
    });
    await cart.save();
  }
  return cart;
};

const sendCartResponse = async (res: Response, cart: CartDocument) => {
  cart.items = await populateItemPrices(cart.items);
  const totals = calculateCartTotals(cart);
  res.json({
    id: cart._id,
    userId: cart.userId,
    items: cart.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
    })),
    totals,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  });
};

const asyncHandler =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

// GET /cart - Get current user's cart
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw createHttpError(401, 'Unauthorized');
    }

    const cart = await getOrCreateCart(req.user.id);
    await sendCartResponse(res, cart);
  })
);

// POST /cart/items - Add item or increase quantity
router.post(
  '/items',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw createHttpError(401, 'Unauthorized');
    }

    const parseResult = addOrUpdateItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw createHttpError(400, parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { variantId, quantity } = parseResult.data;

    const variant = await ProductVariantModel.findById(variantId).select('_id price');
    if (!variant) {
      throw createHttpError(404, 'Product variant not found');
    }

    const cart = await getOrCreateCart(req.user.id);
    const existingItem = cart.items.find(
      (item) => item.variantId.toString() === variant._id.toString()
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.price = variant.price;
    } else {
      cart.items.push({
        variantId: variant._id,
        quantity,
        price: variant.price,
      } as CartItem);
    }

    await cart.save();
    await sendCartResponse(res, cart);
  })
);

// PATCH /cart/items/:variantId - Update quantity for a variant
router.patch(
  '/items/:variantId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw createHttpError(401, 'Unauthorized');
    }

    const variantIdParam = req.params.variantId;
    if (!Types.ObjectId.isValid(variantIdParam)) {
      throw createHttpError(400, 'Invalid variant ID');
    }

    const parseResult = updateItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw createHttpError(400, parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { quantity } = parseResult.data;

    const cart = await getOrCreateCart(req.user.id);
    const item = cart.items.find(
      (it) => it.variantId.toString() === new Types.ObjectId(variantIdParam).toString()
    );

    if (!item) {
      throw createHttpError(404, 'Item not found in cart');
    }

    const variant = await ProductVariantModel.findById(variantIdParam).select('_id price');
    if (!variant) {
      throw createHttpError(404, 'Product variant not found');
    }

    item.quantity = quantity;
    item.price = variant.price;

    await cart.save();
    await sendCartResponse(res, cart);
  })
);

// DELETE /cart/items/:variantId - Remove an item
router.delete(
  '/items/:variantId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw createHttpError(401, 'Unauthorized');
    }

    const variantIdParam = req.params.variantId;
    if (!Types.ObjectId.isValid(variantIdParam)) {
      throw createHttpError(400, 'Invalid variant ID');
    }

    const cart = await getOrCreateCart(req.user.id);
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item.variantId.toString() !== new Types.ObjectId(variantIdParam).toString()
    );

    if (cart.items.length === initialLength) {
      throw createHttpError(404, 'Item not found in cart');
    }

    await cart.save();
    await sendCartResponse(res, cart);
  })
);

// DELETE /cart - Clear cart
router.delete(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw createHttpError(401, 'Unauthorized');
    }

    const parseResult = clearCartSchema.safeParse(req.body ?? {});
    if (!parseResult.success) {
      throw createHttpError(400, 'Invalid request body');
    }

    const cart = await getOrCreateCart(req.user.id);
    cart.items = [];
    await cart.save();
    await sendCartResponse(res, cart);
  })
);

export default router;