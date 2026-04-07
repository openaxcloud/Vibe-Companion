import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { CartModel, CartDocument } from '../models/cart.model';
import { ProductModel, ProductDocument } from '../models/product.model';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

interface AuthedRequest extends Request {
  user?: {
    id: string;
  };
}

interface CartItemInput {
  productId: string;
  quantity: number;
}

interface CartItemPopulated {
  product: ProductDocument;
  quantity: number;
}

interface CartResponseItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  stock: number;
  subtotal: number;
}

interface CartResponse {
  id: string;
  userId: string;
  items: CartResponseItem[];
  totalQuantity: number;
  totalPrice: number;
  currency: string;
  updatedAt: string;
}

const buildCartResponse = (cart: CartDocument & { items: CartItemPopulated[] }): CartResponse => {
  const items: CartResponseItem[] = cart.items.map((item) => {
    const product = item.product as ProductDocument;
    const price = product.price ?? 0;
    return {
      id: (item as any)._id?.toString?.() ?? '',
      productId: product._id.toString(),
      name: product.name,
      price,
      quantity: item.quantity,
      imageUrl: (product as any).imageUrl,
      stock: product.stock,
      subtotal: price * item.quantity,
    };
  });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: cart._id.toString(),
    userId: cart.user.toString(),
    items,
    totalQuantity,
    totalPrice,
    currency: 'USD',
    updatedAt: cart.updatedAt.toISOString(),
  };
};

const validateCartItemInput = (payload: any): payload is CartItemInput | CartItemInput[] => {
  if (!payload) return false;

  const validateOne = (item: any): boolean => {
    if (
      !item ||
      typeof item.productId !== 'string' ||
      !Types.ObjectId.isValid(item.productId) ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 0
    ) {
      return false;
    }
    return true;
  };

  if (Array.isArray(payload)) {
    if (payload.length === 0) return false;
    return payload.every(validateOne);
  }

  return validateOne(payload);
};

// GET /cart - get current user's cart
router.get(
  '/cart',
  authMiddleware,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      let cart = await CartModel.findOne({ user: userId })
        .populate<{ items: CartItemPopulated[] }>({
          path: 'items.product',
          model: ProductModel,
        })
        .exec();

      if (!cart) {
        cart = await CartModel.create({
          user: userId,
          items: [],
        });

        cart = (await cart.populate<{ items: CartItemPopulated[] }>({
          path: 'items.product',
          model: ProductModel,
        })) as typeof cart;
      }

      const response = buildCartResponse(cart as any);
      return res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

// POST /cart/items - add or update items in cart (merge behavior)
router.post(
  '/cart/items',
  authMiddleware,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const payload = req.body;

      if (!validateCartItemInput(payload)) {
        return res.status(400).json({
          message:
            'Invalid payload. Must be an object or array of objects with valid productId and non-negative integer quantity.',
        });
      }

      const itemsInput: CartItemInput[] = Array.isArray(payload) ? payload : [payload];

      const productIds = itemsInput.map((i) => i.productId);
      const products = await ProductModel.find({
        _id: { $in: productIds },
        isActive: true,
      }).exec();

      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((p) => p._id.toString()));
        const missing = productIds.filter((id) => !foundIds.has(id));
        return res.status(404).json({
          message: 'Some products were not found or are inactive',
          missingProductIds: missing,
        });
      }

      const productMap = new Map<string, ProductDocument>();
      products.forEach((p) => productMap.set(p._id.toString(), p));

      // Stock validation
      for (const item of itemsInput) {
        const product = productMap.get(item.productId)!;
        if (item.quantity > product.stock) {
          return res.status(400).json({
            message: 'Insufficient stock for one or more items',
            details: [
              {
                productId: product._id.toString(),
                requested: item.quantity,
                available: product.stock,
              },
            ],
          });
        }
      }

      let cart = await CartModel.findOne({ user: userId }).exec();
      if (!cart) {
        cart = new CartModel({
          user: userId,
          items: [],
        });
      }

      const existingItemsMap = new Map<string, { index: number; quantity: number }>();
      cart.items.forEach((item, index) => {
        const key = (item.product as Types.ObjectId).toString();
        existingItemsMap.set(key, { index, quantity: item.quantity });
      });

      for (const inputItem of itemsInput) {
        const key = inputItem.productId;
        const existing = existingItemsMap.get(key);
        const product = productMap.get(key)!;

        if (!existing && inputItem.quantity === 0) {
          continue;
        }

        if (!existing) {
          cart.items.push({
            product: new Types.ObjectId(key),
            quantity: inputItem.quantity,
          } as any);
          existingItemsMap.set(key, {
            index: cart.items.length - 1,
            quantity: inputItem.quantity,
          });
        } else {
          const newQuantity = inputItem.quantity;
          if (newQuantity <= 0) {
            cart.items.splice(existing.index, 1);
            existingItemsMap.delete(key);
          } else {
            if (newQuantity > product.stock) {
              return res.status(400).json({
                message: 'Insufficient stock for one or more items',
                details: [
                  {
                    productId: product._id.toString(),
                    requested: newQuantity,
                    available: product.stock,
                  },
                ],
              });
            }
            cart.items[existing.index].quantity = newQuantity;
            existingItemsMap.set(key, { index: existing.index, quantity: newQuantity });
          }
        }
      }

      cart.markModified('items');
      await cart.save();

      const populatedCart = await cart
        .populate<{ items: CartItemPopulated[] }>({
          path: 'items.product',
          model: ProductModel,
        })
        .execPopulate?.();

      const hydratedCart = (populatedCart || cart) as CartDocument & {
        items: CartItemPopulated[];
      };

      const response = buildCartResponse(hydratedCart);
      return res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /cart/items/:id - remove a specific item from cart
router.delete(
  '/cart/items/:id',
  authMiddleware,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid cart item id' });
      }

      const cart = await CartModel.findOne({ user: userId }).exec();
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      const index = cart.items.findIndex(
        (item) => (item as any)._id?.toString?.() === id
      );

      if (index === -1) {
        return res.status(404).json({ message: 'Cart item not found' });
      }

      cart.items.splice(index, 1);
      cart.markModified('items');
      await cart.save();

      const populatedCart = await cart
        .populate<{ items: CartItemPopulated[] }>({