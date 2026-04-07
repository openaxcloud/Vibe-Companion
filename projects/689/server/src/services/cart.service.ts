import { Types } from "mongoose";
import { CartModel, CartDocument } from "../models/cart.model";
import { ProductModel, ProductDocument } from "../models/product.model";
import { InventoryModel, InventoryDocument } from "../models/inventory.model";
import { AppError } from "../utils/appError";
import httpStatus from "http-status";

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartItemOutput {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartOutput {
  id: string;
  userId: string;
  items: CartItemOutput[];
  subtotal: number;
  currency: string;
  updatedAt: Date;
  createdAt: Date;
}

export class CartService {
  public async getCartByUserId(userId: string): Promise<CartOutput> {
    const cart = await CartModel.findOne({ userId: new Types.ObjectId(userId) }).lean<CartDocument>().exec();

    if (!cart) {
      const emptyCart: CartOutput = {
        id: "",
        userId,
        items: [],
        subtotal: 0,
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return emptyCart;
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    return {
      id: cart._id.toString(),
      userId: cart.userId.toString(),
      items: cart.items.map((item) => ({
        productId: item.productId.toString(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity
      })),
      subtotal,
      currency: cart.currency,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };
  }

  public async addItemToCart(userId: string, payload: CartItemInput): Promise<CartOutput> {
    if (payload.quantity <= 0) {
      throw new AppError("Quantity must be greater than zero", httpStatus.BAD_REQUEST);
    }

    const product = await this.validateProductAndInventory(payload.productId, payload.quantity);

    let cart = await CartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      cart = new CartModel({
        userId: new Types.ObjectId(userId),
        items: [],
        currency: product.currency || "USD"
      });
    }

    const existingItemIndex = cart.items.findIndex((item) => item.productId.toString() === payload.productId);

    if (existingItemIndex >= 0) {
      const newQuantity = cart.items[existingItemIndex].quantity + payload.quantity;
      await this.ensureInventoryAvailability(product, newQuantity);
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].unitPrice = product.price;
    } else {
      await this.ensureInventoryAvailability(product, payload.quantity);
      cart.items.push({
        productId: new Types.ObjectId(payload.productId),
        quantity: payload.quantity,
        unitPrice: product.price
      });
    }

    this.recalculateSubtotal(cart);
    await cart.save();

    return this.toCartOutput(cart);
  }

  public async updateCartItem(userId: string, payload: CartItemInput): Promise<CartOutput> {
    if (payload.quantity < 0) {
      throw new AppError("Quantity cannot be negative", httpStatus.BAD_REQUEST);
    }

    const cart = await CartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      throw new AppError("Cart not found", httpStatus.NOT_FOUND);
    }

    const existingItemIndex = cart.items.findIndex((item) => item.productId.toString() === payload.productId);

    if (existingItemIndex < 0) {
      throw new AppError("Item not found in cart", httpStatus.NOT_FOUND);
    }

    if (payload.quantity === 0) {
      cart.items.splice(existingItemIndex, 1);
    } else {
      const product = await this.validateProductAndInventory(payload.productId, payload.quantity);
      await this.ensureInventoryAvailability(product, payload.quantity);
      cart.items[existingItemIndex].quantity = payload.quantity;
      cart.items[existingItemIndex].unitPrice = product.price;
    }

    this.recalculateSubtotal(cart);
    await cart.save();

    return this.toCartOutput(cart);
  }

  public async removeCartItem(userId: string, productId: string): Promise<CartOutput> {
    const cart = await CartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      throw new AppError("Cart not found", httpStatus.NOT_FOUND);
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);

    if (cart.items.length === initialLength) {
      throw new AppError("Item not found in cart", httpStatus.NOT_FOUND);
    }

    this.recalculateSubtotal(cart);
    await cart.save();

    return this.toCartOutput(cart);
  }

  public async clearCart(userId: string): Promise<CartOutput> {
    const cart = await CartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      const emptyCart: CartOutput = {
        id: "",
        userId,
        items: [],
        subtotal: 0,
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return emptyCart;
    }

    cart.items = [];
    this.recalculateSubtotal(cart);
    await cart.save();

    return this.toCartOutput(cart);
  }

  private async validateProductAndInventory(productId: string, quantity: number): Promise<ProductDocument> {
    const product = await ProductModel.findById(productId).exec();

    if (!product || product.isDeleted) {
      throw new AppError("Product not found", httpStatus.NOT_FOUND);
    }

    await this.ensureInventoryAvailability(product, quantity);

    return product;
  }

  private async ensureInventoryAvailability(product: ProductDocument, requiredQuantity: number): Promise<void> {
    if (!product.inventoryId) {
      throw new AppError("Inventory not associated with product", httpStatus.CONFLICT);
    }

    const inventory: InventoryDocument | null = await InventoryModel.findById(product.inventoryId).exec();

    if (!inventory) {
      throw new AppError("Inventory record not found", httpStatus.NOT_FOUND);
    }

    if (inventory.available < requiredQuantity) {
      throw new AppError(
        `Insufficient inventory for product undefined. Available: undefined, Required: undefined`,
        httpStatus.CONFLICT
      );
    }
  }

  private recalculateSubtotal(cart: CartDocument): void {
    const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    cart.subtotal = subtotal;
  }

  private toCartOutput(cart: CartDocument): CartOutput {
    const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    return {
      id: cart._id.toString(),
      userId: cart.userId.toString(),
      items: cart.items.map((item) => ({
        productId: item.productId.toString(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity
      })),
      subtotal,
      currency: cart.currency,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };
  }
}

export const cartService = new CartService();