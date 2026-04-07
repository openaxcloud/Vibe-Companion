import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import CartModel, { CartDocument } from "../models/cart.model";
import ProductModel, { ProductDocument } from "../models/product.model";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors";
import { logger } from "../utils/logger";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

interface CartItemInput {
  productId: string;
  quantity: number;
}

const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const validateQuantity = (quantity: number): void => {
  if (
    typeof quantity !== "number" ||
    Number.isNaN(quantity) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new BadRequestError("Quantity must be a positive integer");
  }
};

const computeCartTotals = (cart: CartDocument) => {
  let subtotal = 0;
  let totalQuantity = 0;

  cart.items.forEach((item) => {
    const price = item.price ?? 0;
    const qty = item.quantity ?? 0;
    subtotal += price * qty;
    totalQuantity += qty;
  });

  const discount = cart.discount ?? 0;
  const total = Math.max(subtotal - discount, 0);

  return {
    subtotal,
    discount,
    total,
    totalQuantity,
  };
};

const findOrCreateCart = async (userId: string): Promise<CartDocument> => {
  let cart = await CartModel.findOne({ user: userId }).populate("items.product");
  if (!cart) {
    cart = await CartModel.create({
      user: userId,
      items: [],
      discount: 0,
    });
    cart = await cart.populate("items.product");
  }
  return cart;
};

export const getCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const cart = await findOrCreateCart(req.user.id);
    const totals = computeCartTotals(cart);

    res.status(200).json({
      success: true,
      data: {
        cart,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addItemToCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const { productId, quantity } = req.body as CartItemInput;

    if (!productId || !isValidObjectId(productId)) {
      throw new BadRequestError("Valid productId is required");
    }
    validateQuantity(quantity);

    const product: ProductDocument | null = await ProductModel.findById(
      productId
    );
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.stock < quantity) {
      throw new BadRequestError("Insufficient stock for requested quantity");
    }

    let cart = await findOrCreateCart(req.user.id);

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        throw new BadRequestError(
          "Insufficient stock to increase item quantity"
        );
      }
      existingItem.quantity = newQuantity;
      existingItem.price = product.price;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        price: product.price,
      } as any);
    }

    await cart.save();
    cart = await cart.populate("items.product");
    const totals = computeCartTotals(cart);

    res.status(200).json({
      success: true,
      data: {
        cart,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const { itemId } = req.params;
    const { quantity } = req.body as Partial<CartItemInput>;

    if (!itemId || !isValidObjectId(itemId)) {
      throw new BadRequestError("Valid itemId is required");
    }

    if (quantity === undefined) {
      throw new BadRequestError("Quantity is required");
    }
    validateQuantity(quantity);

    let cart = await CartModel.findOne({ user: req.user.id });
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      throw new NotFoundError("Cart item not found");
    }

    const product: ProductDocument | null = await ProductModel.findById(
      cartItem.product
    );
    if (!product) {
      throw new NotFoundError("Associated product not found");
    }

    if (product.stock < quantity) {
      throw new BadRequestError("Insufficient stock for requested quantity");
    }

    cartItem.quantity = quantity;
    cartItem.price = product.price;

    await cart.save();
    cart = await cart.populate("items.product");
    const totals = computeCartTotals(cart);

    res.status(200).json({
      success: true,
      data: {
        cart,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeCartItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const { itemId } = req.params;
    if (!itemId || !isValidObjectId(itemId)) {
      throw new BadRequestError("Valid itemId is required");
    }

    let cart = await CartModel.findOne({ user: req.user.id });
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      throw new NotFoundError("Cart item not found");
    }

    cartItem.remove();
    await cart.save();
    cart = await cart.populate("items.product");
    const totals = computeCartTotals(cart);

    res.status(200).json({
      success: true,
      data: {
        cart,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    let cart = await CartModel.findOne({ user: req.user.id });
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    cart.items = [];
    cart.discount = 0;

    await cart.save();
    cart = await cart.populate("items.product");
    const totals = computeCartTotals(cart);

    res.status(200).json({
      success: true,
      data: {
        cart,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const applyCartDiscount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const { discount } = req.body as { discount: number };

    if (
      typeof discount !== "number" ||
      Number.isNaN(discount) ||
      discount < 0
    ) {
      throw new BadRequestError("Discount must be a non-negative number");
    }

    let cart = await CartModel.findOne({ user: req.user.id });
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    cart.discount = discount;
    await cart.save();
    cart = await cart.populate("items.product");
    const totals = computeCartTotals(cart);

    res.status(200).json({
      success: true,
      data: {
        cart,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const validateCartStock = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const cart = await CartModel.findOne({ user: req.user.id }).populate(
      "items.product"
    );
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const stockIssues: {
      itemId: string;
      productId