import Stripe from "stripe";
import { Order, OrderItem, OrderStatus, PaymentMethod, PaymentProvider, PaymentStatus } from "../models/order";
import { Cart, CartItem } from "../models/cart";
import { InventoryReservationResult } from "../models/inventory";
import { PricingService } from "./pricingService";
import { OrderService } from "./orderService";
import { InventoryService } from "./inventoryService";
import { Logger } from "../utils/logger";
import { AppError } from "../utils/errors";
import { Config } from "../config";

export interface CheckoutRequest {
  cartId: string;
  userId: string;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResponse {
  order: Order;
  clientSecret?: string | null;
  paymentIntentId?: string | null;
}

export interface PaymentUpdatePayload {
  paymentIntentId: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  rawEvent: unknown;
}

export interface CheckoutServiceDependencies {
  pricingService: PricingService;
  orderService: OrderService;
  inventoryService: InventoryService;
  stripe: Stripe;
  logger?: Logger;
  config: Config;
}

export class CheckoutService {
  private readonly pricingService: PricingService;
  private readonly orderService: OrderService;
  private readonly inventoryService: InventoryService;
  private readonly stripe: Stripe;
  private readonly logger: Logger;
  private readonly config: Config;

  constructor(deps: CheckoutServiceDependencies) {
    this.pricingService = deps.pricingService;
    this.orderService = deps.orderService;
    this.inventoryService = deps.inventoryService;
    this.stripe = deps.stripe;
    this.logger = deps.logger ?? new Logger("CheckoutService");
    this.config = deps.config;
  }

  public async initiateCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const {
      cartId,
      userId,
      currency,
      paymentMethod,
      paymentProvider,
      customerEmail,
      successUrl,
      cancelUrl,
      metadata = {},
    } = request;

    this.logger.info("Initiating checkout", { cartId, userId, paymentProvider, paymentMethod });

    // 1. Load and validate cart
    const cart = await this.loadAndValidateCart(cartId, userId);
    if (!cart.items.length) {
      throw new AppError("CART_EMPTY", "Cannot checkout with an empty cart", 400);
    }

    // 2. Calculate pricing totals
    const pricing = await this.pricingService.calculateCartTotals(cart, currency);
    if (pricing.grandTotalMinor <= 0) {
      throw new AppError("INVALID_TOTAL", "Order total must be greater than zero", 400);
    }

    // 3. Reserve inventory
    const inventoryReservation = await this.reserveInventory(cart, pricing.currency);

    // 4. Create order in PENDING_PAYMENT
    const order = await this.createPendingOrder({
      cart,
      userId,
      currency: pricing.currency,
      paymentMethod,
      paymentProvider,
      customerEmail,
      pricingSummaryId: pricing.id,
      inventoryReservation,
      metadata,
    });

    try {
      // 5. Create Stripe Payment Intent
      const paymentIntent = await this.createStripePaymentIntent({
        amountMinor: pricing.grandTotalMinor,
        currency: pricing.currency,
        order,
        customerEmail,
        successUrl,
        cancelUrl,
      });

      // 6. Persist payment info in order
      const updatedOrder = await this.orderService.attachPaymentToOrder(order.id, {
        provider: PaymentProvider.STRIPE,
        providerPaymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret ?? null,
        amountMinor: pricing.grandTotalMinor,
        currency: pricing.currency,
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        rawResponse: paymentIntent,
      });

      this.logger.info("Checkout initiated successfully", {
        orderId: updatedOrder.id,
        paymentIntentId: paymentIntent.id,
      });

      return {
        order: updatedOrder,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (err) {
      this.logger.error("Error during payment intent creation, rolling back", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });

      await this.handleCheckoutFailure(order, inventoryReservation);
      throw new AppError(
        "CHECKOUT_FAILED",
        "Failed to initiate payment. Your card has not been charged.",
        502,
        err instanceof Error ? { cause: err.message } : { cause: String(err) }
      );
    }
  }

  public async handlePaymentUpdate(payload: PaymentUpdatePayload): Promise<Order> {
    const { paymentIntentId, status, provider, rawEvent } = payload;

    if (provider !== PaymentProvider.STRIPE) {
      throw new AppError("UNSUPPORTED_PROVIDER", "Unsupported payment provider", 400);
    }

    this.logger.info("Handling payment update", { paymentIntentId, status });

    const order = await this.orderService.findByPaymentProviderId(provider, paymentIntentId);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND", "Order not found for payment intent", 404);
    }

    const currentPaymentStatus = order.payment?.status ?? PaymentStatus.PENDING;
    if (this.isTerminalStatus(currentPaymentStatus)) {
      this.logger.warn("Ignoring payment update for order with terminal status", {
        orderId: order.id,
        currentPaymentStatus,
        incomingStatus: status,
      });
      return order;
    }

    const updatedPayment = await this.orderService.updatePaymentStatus(order.id, {
      status,
      rawEvent,
    });

    let updatedOrder: Order = { ...order, payment: updatedPayment };

    if (status === PaymentStatus.SUCCEEDED) {
      updatedOrder = await this.orderService.updateOrderStatus(order.id, OrderStatus.PAID);

      // Confirm inventory (convert reservation to final deduction)
      try {
        await this.inventoryService.confirmReservation(order.inventoryReservationId);
      } catch (err) {
        this.logger.error("Failed to confirm inventory after payment success", {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Optionally trigger manual reconciliation here
      }
    } else if (status === PaymentStatus.FAILED || status === PaymentStatus.CANCELED) {
      updatedOrder = await this.orderService.updateOrderStatus(order.id, OrderStatus.PAYMENT_FAILED);

      // Release inventory on payment failure/cancellation
      try {
        if (order.inventoryReservationId) {
          await this.inventoryService.releaseReservation(order.inventoryReservationId);
        }
      } catch (err) {
        this.logger.error("Failed to release inventory after payment failure", {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return updatedOrder;
  }

  public async cancelPayment(orderId: string, reason?: string): Promise<Order> {
    const order = await this.orderService.getById(orderId);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }

    if (!order.payment || !order.payment.providerPaymentId) {
      throw new AppError("PAYMENT_NOT_FOUND", "No payment associated with order", 400);
    }

    if (this.isTerminalStatus(order.payment.status)) {
      throw new AppError("PAYMENT_TERMINAL", "Cannot cancel a finalized payment", 400);
    }

    this.logger.info("Cancelling payment for order", { orderId, reason });

    try {
      await this.stripe.paymentIntents.cancel(order.payment.providerPaymentId, {
        cancellation_reason: reason ? "requested_by_customer" : undefined,
      });
    } catch (err) {
      this.logger.error("Stripe cancellation failed", {
        orderId,
        paymentIntentId: order.payment.providerPaymentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError("CANCEL_FAILED", "Failed to cancel payment", 502);
    }

    const updatedPayment = await this.orderService.updatePaymentStatus(order.id, {
      status: PaymentStatus.CANCELED,
    });

    let updatedOrder = await this.orderService.updateOrderStatus(order.id, OrderStatus.CANCELED);
    updatedOrder = { ...updatedOrder, payment: updatedPayment };

    if (order.inventoryReservationId) {
      try {
        await this.inventoryService.releaseReservation(order.inventoryReservationId);
      } catch (err) {
        this.logger.error("Failed to release inventory on payment cancel", {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return updatedOrder;
  }

  private async loadAndValidateCart(cartId: string, userId: string): Promise<Cart> {
    const cart = await this.pricingService.loadCart(cartId, userId);
    if (!cart) {
      throw new AppError("CART_NOT_FOUND", "Cart not found", 404);
    }

    if (cart.userId !== userId) {
      throw new AppError("FORBIDDEN", "You do not have access to this cart", 403);
    }

    const invalidItems = cart.items.filter((item: