import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import CartModel, { ICart, ICartItem } from '../models/cart.model';
import ProductModel, { IProduct } from '../models/product.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { computeCartTotals } from '../utils/cartTotals';
import { UserRequest } from '../types/express';
import { logger } from '../utils/logger';

type ObjectId = Types.ObjectId;

interface AddOrUpdateItemBody {
  productId: string;
  quantity: number;
}

interface UpdateItemQuantityBody {
  quantity: number;
}

const validateObjectId = (id: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid undefined`);
  }
  return new Types.ObjectId(id);
};

const getOrCreateCartForUser = async (userId: ObjectId): Promise<ICart> => {
  let cart = await CartModel.findOne({ user: userId }).populate('items.product');
  if (!cart) {
    cart = await CartModel.create({
      user: userId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      isLocked: false,
    });
  }
  return cart;
};

const ensureCartIsNotLocked = (cart: ICart): void => {
  if (cart.isLocked) {
    throw new ApiError(409, 'Cart is locked and cannot be modified during checkout');
  }
};

const findCartItemIndex = (items: ICartItem[], productId: ObjectId): number =>
  items.findIndex(
    (item) =>
      String(item.product instanceof Types.ObjectId ? item.product : item.product._id) ===
      String(productId),
  );

const validateQuantity = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Quantity must be a positive integer');
  }
};

const checkStockAvailability = (product: IProduct, quantity: number): void => {
  if (!product.isActive || product.isDeleted) {
    throw new ApiError(400, 'Product is not available for purchase');
  }
  if (product.stock < quantity) {
    throw new ApiError(409, `Only undefined units of undefined available`);
  }
};

export const getCart = asyncHandler(async (req: UserRequest, res: Response): Promise<void> => {
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id as ObjectId;
  const cart = await getOrCreateCartForUser(userId);
  const totals = computeCartTotals(cart);

  cart.subtotal = totals.subtotal;
  cart.total = totals.total;
  cart.currency = totals.currency;

  await cart.save();

  res.status(200).json({
    success: true,
    data: {
      cart,
      totals,
    },
  });
});

export const addItemToCart = asyncHandler(
  async (req: UserRequest<unknown, unknown, AddOrUpdateItemBody>, res: Response): Promise<void> => {
    if (!req.user || !req.user._id) {
      throw new ApiError(401, 'Authentication required');
    }

    const { productId, quantity } = req.body;

    if (!productId) {
      throw new ApiError(400, 'productId is required');
    }
    validateQuantity(quantity);

    const userId = req.user._id as ObjectId;
    const productObjectId = validateObjectId(productId, 'productId');

    const product = await ProductModel.findById(productObjectId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    const cart = await getOrCreateCartForUser(userId);
    ensureCartIsNotLocked(cart);

    const existingItemIndex = findCartItemIndex(cart.items, productObjectId);
    const newQuantity =
      existingItemIndex >= 0 ? cart.items[existingItemIndex].quantity + quantity : quantity;

    checkStockAvailability(product, newQuantity);

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      cart.items.push({
        product: productObjectId,
        quantity,
        priceAtAddition: product.price,
      } as ICartItem);
    }

    const totals = computeCartTotals(cart);
    cart.subtotal = totals.subtotal;
    cart.total = totals.total;
    cart.currency = totals.currency;

    await cart.save();
    await cart.populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: {
        cart,
        totals,
      },
    });
  },
);

export const updateCartItemQuantity = asyncHandler(
  async (
    req: UserRequest<{ productId: string }, unknown, UpdateItemQuantityBody>,
    res: Response,
  ): Promise<void> => {
    if (!req.user || !req.user._id) {
      throw new ApiError(401, 'Authentication required');
    }

    const { productId } = req.params;
    const { quantity } = req.body;

    if (!productId) {
      throw new ApiError(400, 'productId is required in params');
    }
    validateQuantity(quantity);

    const userId = req.user._id as ObjectId;
    const productObjectId = validateObjectId(productId, 'productId');

    const cart = await getOrCreateCartForUser(userId);
    ensureCartIsNotLocked(cart);

    const itemIndex = findCartItemIndex(cart.items, productObjectId);
    if (itemIndex === -1) {
      throw new ApiError(404, 'Item not found in cart');
    }

    const product = await ProductModel.findById(productObjectId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    checkStockAvailability(product, quantity);
    cart.items[itemIndex].quantity = quantity;

    const totals = computeCartTotals(cart);
    cart.subtotal = totals.subtotal;
    cart.total = totals.total;
    cart.currency = totals.currency;

    await cart.save();
    await cart.populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: {
        cart,
        totals,
      },
    });
  },
);

export const removeItemFromCart = asyncHandler(
  async (req: UserRequest<{ productId: string }>, res: Response): Promise<void> => {
    if (!req.user || !req.user._id) {
      throw new ApiError(401, 'Authentication required');
    }

    const { productId } = req.params;
    if (!productId) {
      throw new ApiError(400, 'productId is required in params');
    }

    const userId = req.user._id as ObjectId;
    const productObjectId = validateObjectId(productId, 'productId');

    const cart = await getOrCreateCartForUser(userId);
    ensureCartIsNotLocked(cart);

    const itemIndex = findCartItemIndex(cart.items, productObjectId);
    if (itemIndex === -1) {
      throw new ApiError(404, 'Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);

    const totals = computeCartTotals(cart);
    cart.subtotal = totals.subtotal;
    cart.total = totals.total;
    cart.currency = totals.currency;

    await cart.save();
    await cart.populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: {
        cart,
        totals,
      },
    });
  },
);

export const clearCart = asyncHandler(async (req: UserRequest, res: Response): Promise<void> => {
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id as ObjectId;
  const cart = await getOrCreateCartForUser(userId);
  ensureCartIsNotLocked(cart);

  cart.items = [];
  cart.subtotal = 0;
  cart.total = 0;

  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Cart cleared',
    data: {
      cart,
      totals: {
        subtotal: 0,
        total: 0,
        currency: cart.currency,
        itemCount: 0,
      },
    },
  });
});

export const getCartTotals = asyncHandler(async (req: UserRequest, res: Response): Promise<void> => {
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id as ObjectId;
  const cart = await getOrCreateCartForUser(userId);

  const totals = computeCartTotals(cart);

  cart.subtotal = totals.subtotal;
  cart.total = totals.total;
  cart.currency = totals.currency;

  await cart.save();

  res.status(200).json({