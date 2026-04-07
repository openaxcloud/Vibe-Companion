import { Types } from 'mongoose';
import CartModel, { CartDocument, CartItem } from '../models/cart.model';
import ProductModel, { ProductDocument } from '../models/product.model';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartTotals {
  subtotal: number;
  totalQuantity: number;
  currency: string;
}

export interface CartServiceItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  inStock: boolean;
  availableStock: number;
}

export interface CartSummary {
  id: string;
  userId: string;
  items: CartServiceItem[];
  totals: CartTotals;
  updatedAt: Date;
  createdAt: Date;
}

export class CartService {
  private static readonly DEFAULT_CURRENCY = 'USD';

  public static async getOrCreateCart(userId: string): Promise<CartSummary> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user id');
    }

    let cart = await CartModel.findOne({ userId }).lean<CartDocument | null>();
    if (!cart) {
      cart = await CartModel.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
      cart = cart.toObject();
    }

    return this.buildCartSummary(cart);
  }

  public static async addItem(
    userId: string,
    item: CartItemInput
  ): Promise<CartSummary> {
    this.validateItemInput(item);

    const product = await this.getProductOrThrow(item.productId);
    if (!product.isActive) {
      throw new ValidationError('Product is not available');
    }
    if (product.stock < 1) {
      throw new ValidationError('Product is out of stock');
    }

    const targetQuantity = Math.min(item.quantity, product.stock);
    if (targetQuantity <= 0) {
      throw new ValidationError('Quantity must be greater than zero');
    }

    const cart = await CartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {},
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!cart) {
      throw new Error('Failed to create or retrieve cart');
    }

    const existingItem = cart.items.find((i) =>
      i.productId.equals(product._id)
    );

    if (existingItem) {
      existingItem.quantity = Math.min(
        existingItem.quantity + targetQuantity,
        product.stock
      );
    } else {
      cart.items.push({
        productId: product._id,
        quantity: targetQuantity,
      } as CartItem);
    }

    await cart.save();
    const leanCart = await CartModel.findById(cart._id).lean<CartDocument>();
    if (!leanCart) {
      throw new Error('Cart disappeared after save');
    }

    return this.buildCartSummary(leanCart);
  }

  public static async updateItemQuantity(
    userId: string,
    productId: string,
    quantity: number
  ): Promise<CartSummary> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user id');
    }
    if (!Types.ObjectId.isValid(productId)) {
      throw new ValidationError('Invalid product id');
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new ValidationError('Quantity must be a non-negative integer');
    }

    const cart = await CartModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const existingItem = cart.items.find((i) =>
      i.productId.equals(productId)
    );
    if (!existingItem) {
      throw new NotFoundError('Item not found in cart');
    }

    if (quantity === 0) {
      cart.items = cart.items.filter(
        (i) => !i.productId.equals(productId)
      );
    } else {
      const product = await this.getProductOrThrow(productId);
      if (!product.isActive) {
        throw new ValidationError('Product is not available');
      }
      if (product.stock < 1) {
        throw new ValidationError('Product is out of stock');
      }
      existingItem.quantity = Math.min(quantity, product.stock);
    }

    await cart.save();
    const leanCart = await CartModel.findById(cart._id).lean<CartDocument>();
    if (!leanCart) {
      throw new Error('Cart disappeared after save');
    }

    return this.buildCartSummary(leanCart);
  }

  public static async removeItem(
    userId: string,
    productId: string
  ): Promise<CartSummary> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user id');
    }
    if (!Types.ObjectId.isValid(productId)) {
      throw new ValidationError('Invalid product id');
    }

    const cart = await CartModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const beforeCount = cart.items.length;
    cart.items = cart.items.filter(
      (i) => !i.productId.equals(productId)
    );

    if (cart.items.length === beforeCount) {
      throw new NotFoundError('Item not found in cart');
    }

    await cart.save();
    const leanCart = await CartModel.findById(cart._id).lean<CartDocument>();
    if (!leanCart) {
      throw new Error('Cart disappeared after save');
    }

    return this.buildCartSummary(leanCart);
  }

  public static async clearCart(userId: string): Promise<CartSummary> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user id');
    }

    const cart = await CartModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    cart.items = [];
    await cart.save();

    const leanCart = await CartModel.findById(cart._id).lean<CartDocument>();
    if (!leanCart) {
      throw new Error('Cart disappeared after save');
    }

    return this.buildCartSummary(leanCart);
  }

  public static async getCartSummary(userId: string): Promise<CartSummary> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user id');
    }

    const cart = await CartModel.findOne({
      userId: new Types.ObjectId(userId),
    }).lean<CartDocument | null>();

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    return this.buildCartSummary(cart);
  }

  private static async getProductOrThrow(
    productId: string
  ): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new ValidationError('Invalid product id');
    }

    const product = await ProductModel.findById(productId).lean<ProductDocument | null>();
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  private static validateItemInput(item: CartItemInput): void {
    if (!item || typeof item !== 'object') {
      throw new ValidationError('Item is required');
    }
    if (!Types.ObjectId.isValid(item.productId)) {
      throw new ValidationError('Invalid product id');
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }
  }

  private static async buildCartSummary(
    cart: CartDocument
  ): Promise<CartSummary> {
    const productIds = cart.items.map((i) => i.productId);
    const products = await ProductModel.find({
      _id: { $in: productIds },
    }).lean<ProductDocument[]>();

    const productMap = new Map<string, ProductDocument>();
    products.forEach((p) => {
      productMap.set(p._id.toString(), p);
    });

    const items: CartServiceItem[] = [];
    let subtotal = 0;
    let totalQuantity = 0;
    const currency = this.DEFAULT_CURRENCY;

    for (const cartItem of cart.items) {
      const product = productMap.get(cartItem.productId.toString());
      if (!product) {
        logger.warn(
          { productId: cartItem.productId.toString(), cartId: cart._id.toString() },
          'Product in cart no longer exists'
        );
        continue;
      }

      const availableStock = product.stock;
      const quantity = Math.min(cartItem.quantity, availableStock);
      const inStock = availableStock > 0;

      if (quantity <= 0) {
        continue;
      }

      const lineTotal = product.price * quantity;
      subtotal += lineTotal;
      totalQuantity += quantity;

      items.push({
        productId: product._id.toString(),
        name: product.name,
        price: product.price,
        quantity,
        lineTotal,
        inStock,
        availableStock,
      });
    }

    return