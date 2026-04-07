import { Types } from "mongoose";
import { CartModel, ICartDocument } from "../models/Cart";
import { OrderModel, IOrderDocument, IOrderItem } from "../models/Order";
import { ProductModel } from "../models/Product";
import { InventoryModel } from "../models/Inventory";
import { PaymentModel, PaymentStatus } from "../models/Payment";
import { DiscountModel, IDiscountDocument } from "../models/Discount";
import { UserModel } from "../models/User";
import { BadRequestError, NotFoundError, ConflictError } from "../utils/errors";
import { logger } from "../utils/logger";
import { startSession } from "../db/connection";

export interface IOrderTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  currency: string;
}

export interface ICreateOrderFromCartParams {
  userId: string;
  cartId: string;
  paymentMethodId?: string;
  shippingAddressId?: string;
  billingAddressId?: string;
  discountCode?: string;
  metadata?: Record<string, unknown>;
}

export interface IUpdateOrderStatusParams {
  orderId: string;
  status:
    | "pending"
    | "processing"
    | "paid"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface IHandlePaymentWebhookParams {
  paymentProvider: "stripe" | "paypal" | "manual" | string;
  externalPaymentId: string;
  status: PaymentStatus;
  rawPayload: unknown;
}

export interface IOrderService {
  createOrderFromCart(params: ICreateOrderFromCartParams): Promise<IOrderDocument>;
  computeOrderTotalsFromCart(cart: ICartDocument, discount?: IDiscountDocument | null): IOrderTotals;
  updateOrderStatus(params: IUpdateOrderStatusParams): Promise<IOrderDocument>;
  handlePaymentWebhook(params: IHandlePaymentWebhookParams): Promise<IOrderDocument | null>;
  getOrderById(orderId: string, userId?: string): Promise<IOrderDocument>;
  listUserOrders(userId: string, options?: { limit?: number; offset?: number }): Promise<IOrderDocument[]>;
}

const DEFAULT_TAX_RATE = 0.0;
const DEFAULT_SHIPPING_FEE = 0.0;

async function validateCart(cartId: string, userId: string): Promise<ICartDocument> {
  if (!Types.ObjectId.isValid(cartId)) {
    throw new BadRequestError("Invalid cart ID");
  }

  const cart = await CartModel.findOne({ _id: cartId, user: userId }).populate("items.product");
  if (!cart) {
    throw new NotFoundError("Cart not found");
  }

  if (!cart.items || cart.items.length === 0) {
    throw new BadRequestError("Cart is empty");
  }

  return cart;
}

async function validateDiscount(discountCode?: string | null): Promise<IDiscountDocument | null> {
  if (!discountCode) return null;

  const discount = await DiscountModel.findOne({ code: discountCode.toUpperCase(), active: true });
  if (!discount) {
    throw new BadRequestError("Invalid or inactive discount code");
  }

  const now = new Date();
  if (discount.validFrom && discount.validFrom > now) {
    throw new BadRequestError("Discount not yet valid");
  }
  if (discount.validUntil && discount.validUntil < now) {
    throw new BadRequestError("Discount has expired");
  }

  return discount;
}

function computeDiscountAmount(
  subtotal: number,
  discount: IDiscountDocument | null | undefined
): number {
  if (!discount) return 0;

  let discountAmount = 0;

  if (discount.type === "percentage") {
    discountAmount = (subtotal * discount.value) / 100;
  } else if (discount.type === "fixed") {
    discountAmount = discount.value;
  }

  if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
    discountAmount = discount.maxDiscount;
  }

  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > subtotal) discountAmount = subtotal;

  return discountAmount;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

async function reserveInventory(
  items: IOrderItem[],
  session: any
): Promise<void> {
  for (const item of items) {
    const inventory = await InventoryModel.findOne(
      { product: item.product },
      null,
      { session }
    );

    if (!inventory || inventory.available < item.quantity) {
      throw new ConflictError("Insufficient inventory for one or more items");
    }

    inventory.available -= item.quantity;
    inventory.reserved += item.quantity;
    await inventory.save({ session });
  }
}

async function releaseInventory(
  items: IOrderItem[],
  session: any
): Promise<void> {
  for (const item of items) {
    const inventory = await InventoryModel.findOne(
      { product: item.product },
      null,
      { session }
    );

    if (!inventory) {
      logger.warn("Inventory record missing during release", {
        productId: item.product.toString(),
      });
      continue;
    }

    inventory.available += item.quantity;
    if (inventory.reserved >= item.quantity) {
      inventory.reserved -= item.quantity;
    } else {
      inventory.reserved = 0;
    }

    await inventory.save({ session });
  }
}

async function commitInventory(
  items: IOrderItem[],
  session: any
): Promise<void> {
  for (const item of items) {
    const inventory = await InventoryModel.findOne(
      { product: item.product },
      null,
      { session }
    );

    if (!inventory) {
      logger.warn("Inventory record missing during commit", {
        productId: item.product.toString(),
      });
      continue;
    }

    if (inventory.reserved >= item.quantity) {
      inventory.reserved -= item.quantity;
    } else {
      inventory.reserved = 0;
    }

    await inventory.save({ session });
  }
}

export const orderService: IOrderService = {
  async createOrderFromCart(params: ICreateOrderFromCartParams): Promise<IOrderDocument> {
    const { userId, cartId, paymentMethodId, shippingAddressId, billingAddressId, discountCode, metadata } = params;

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const cart = await validateCart(cartId, userId);
    const discount = await validateDiscount(discountCode);

    const totals = this.computeOrderTotalsFromCart(cart, discount);
    const session = await startSession();

    try {
      session.startTransaction();

      const orderItems: IOrderItem[] = cart.items.map((cartItem) => {
        const product: any = cartItem.product;
        return {
          product: product._id,
          name: product.name,
          sku: product.sku,
          quantity: cartItem.quantity,
          unitPrice: product.price,
          currency: product.currency || totals.currency,
          imageUrl: product.images && product.images.length > 0 ? product.images[0] : undefined,
        };
      });

      await reserveInventory(orderItems, session);

      const order = await OrderModel.create(
        [
          {
            user: user._id,
            items: orderItems,
            status: "pending",
            currency: totals.currency,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            shippingTotal: totals.shippingTotal,
            grandTotal: totals.grandTotal,
            paymentMethodId,
            shippingAddressId,
            billingAddressId,
            discountCode: discount ? discount.code : undefined,
            metadata: metadata || {},
            cartSnapshot: {
              cartId: cart._id,
              items: cart.items.map((ci) => ({
                product: ci.product,
                quantity: ci.quantity,
              })),
            },
          },
        ],
        { session }
      );

      cart.status = "converted";
      await cart.save({ session });

      await session.commitTransaction();
      return order[0];
    } catch (err) {
      await session.abortTransaction();
      logger.error("Failed to create order from cart", {
        error: err,
        cartId,
        userId,
      });
      throw err;
    } finally {
      session.endSession();
    }
  },

  computeOrderTotalsFromCart(cart: ICartDocument, discount?: IDiscountDocument | null): IOrderTotals {
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestError("Cannot compute totals for empty cart");
    }

    const currency =
      cart.currency ||
      (typeof cart.items[0].product === "object" && (cart.items[0].product as any).currency) ||
      "USD";

    let subtotal = 0;
    for (const item of cart.items) {
      const product: any = item.product;
      if (!product || typeof product.price !== "number") {
        throw new BadRequestError("Cart contains item with invalid product pricing");
      }
      subtotal += product.price * item.quantity;
    }

    subtotal = roundCurrency(subtotal);