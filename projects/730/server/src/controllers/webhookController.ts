import { Request, Response } from "express";
import Stripe from "stripe";
import { getRepository } from "typeorm";
import { Order } from "../entities/Order";
import { Cart } from "../entities/Cart";
import { InventoryService } from "../services/InventoryService";
import { NotificationService } from "../services/NotificationService";
import { logger } from "../utils/logger";
import { stripeConfig } from "../config/stripeConfig";

const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: "2024-06-20",
});

export const stripeWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string | undefined;

  if (!sig) {
    logger.warn("Stripe webhook invoked without signature header");
    res.status(400).send("Missing Stripe signature");
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || (req as any).body;
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      stripeConfig.webhookSecret
    );
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", {
      error: err instanceof Error ? err.message : err,
    });
    res.status(400).send(`Webhook Error: undefined`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event);
        break;
      case "charge.dispute.created":
        await handleChargeDisputeCreated(event);
        break;
      default:
        logger.info("Unhandled Stripe event type received", { type: event.type });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Error processing Stripe webhook", {
      type: event.type,
      error: err instanceof Error ? err.message : err,
    });
    res.status(500).send("Webhook handler error");
  }
};

const handleCheckoutSessionCompleted = async (event: Stripe.Event): Promise<void> => {
  const session = event.data.object as Stripe.Checkout.Session;

  const metadata = session.metadata || {};
  const orderId = metadata.orderId || null;
  const cartId = metadata.cartId || null;

  if (!orderId && !cartId) {
    logger.warn("Checkout session completed without orderId or cartId metadata", {
      sessionId: session.id,
    });
    return;
  }

  const orderRepo = getRepository(Order);
  const cartRepo = getRepository(Cart);

  let order: Order | null = null;

  if (orderId) {
    order = await orderRepo.findOne({
      where: { id: orderId },
      relations: ["items", "items.product"],
    });
  } else if (cartId) {
    const cart = await cartRepo.findOne({
      where: { id: cartId },
      relations: ["items", "items.product"],
    });

    if (!cart) {
      logger.error("Cart not found for checkout session", { cartId, sessionId: session.id });
      return;
    }

    order = await createOrderFromCart(cart, session);
  }

  if (!order) {
    logger.error("Order could not be resolved for checkout session", {
      orderId,
      cartId,
      sessionId: session.id,
    });
    return;
  }

  if (order.status === "PAID" || order.status === "COMPLETED") {
    logger.info("Order already processed for checkout session", {
      orderId: order.id,
      status: order.status,
    });
    return;
  }

  await markOrderPaid(order, session);
};

const handlePaymentIntentSucceeded = async (event: Stripe.Event): Promise<void> => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const metadata = paymentIntent.metadata || {};
  const orderId = metadata.orderId || null;

  if (!orderId) {
    logger.info("PaymentIntent succeeded without orderId metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const orderRepo = getRepository(Order);
  const order = await orderRepo.findOne({
    where: { id: orderId },
    relations: ["items", "items.product"],
  });

  if (!order) {
    logger.error("Order not found for payment intent", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  if (order.status === "PAID" || order.status === "COMPLETED") {
    logger.info("Order already processed for payment intent", {
      orderId: order.id,
      status: order.status,
    });
    return;
  }

  await markOrderPaid(order, paymentIntent);
};

const handlePaymentIntentFailed = async (event: Stripe.Event): Promise<void> => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const metadata = paymentIntent.metadata || {};
  const orderId = metadata.orderId || null;

  if (!orderId) {
    logger.info("PaymentIntent failed without orderId metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const orderRepo = getRepository(Order);
  const order = await orderRepo.findOne({ where: { id: orderId } });

  if (!order) {
    logger.error("Order not found for failed payment intent", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  if (order.status === "CANCELLED" || order.status === "FAILED") {
    logger.info("Order already marked failed/cancelled", {
      orderId: order.id,
      status: order.status,
    });
    return;
  }

  order.status = "FAILED";
  order.paymentFailureReason =
    paymentIntent.last_payment_error?.message || "Payment failed";

  await getRepository(Order).save(order);

  await NotificationService.notifyOrderPaymentFailed(order);

  logger.info("Order marked as failed due to payment failure", {
    orderId: order.id,
    paymentIntentId: paymentIntent.id,
  });
};

const handleChargeRefunded = async (event: Stripe.Event): Promise<void> => {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;

  if (!paymentIntentId) {
    logger.info("Refunded charge without associated payment_intent", {
      chargeId: charge.id,
    });
    return;
  }

  const orderRepo = getRepository(Order);
  const order = await orderRepo.findOne({
    where: { paymentIntentId },
    relations: ["items", "items.product"],
  });

  if (!order) {
    logger.info("No order mapped to refunded charge payment_intent", {
      paymentIntentId,
      chargeId: charge.id,
    });
    return;
  }

  order.status = "REFUNDED";
  order.refundAmount = charge.amount_refunded / 100;

  await orderRepo.save(order);

  await InventoryService.restockOrderItems(order);
  await NotificationService.notifyOrderRefunded(order);

  logger.info("Order marked as refunded", {
    orderId: order.id,
    paymentIntentId,
    chargeId: charge.id,
  });
};

const handleChargeDisputeCreated = async (event: Stripe.Event): Promise<void> => {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  if (!chargeId) {
    logger.info("Dispute created without charge id", {
      disputeId: dispute.id,
    });
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;

  if (!paymentIntentId) {
    logger.info("Disputed charge without associated payment_intent", {
      chargeId,
      disputeId: dispute.id,
    });
    return;
  }

  const orderRepo = getRepository(Order);
  const order = await orderRepo.findOne({
    where: { paymentIntentId },
    relations: ["items", "items.product"],
  });

  if (!order) {
    logger.info("No order mapped to disputed payment_intent", {
      paymentIntentId,
      chargeId,
      disputeId: dispute.id,
    });
    return;
  }

  order.status = "DISPUTED";
  await orderRepo.save(order);

  await NotificationService.notifyOrderDisputed(order, dispute);

  logger.info("Order marked as disputed", {
    orderId: order.id,
    paymentIntentId,
    chargeId,
    disputeId: dispute.id,
  });
};

const createOrderFromCart = async (cart: Cart, session: Stripe.Checkout.Session): Promise<Order> => {
  const orderRepo = getRepository(Order);
  const order = new Order();

  order.user = cart.user;
  order.items = cart.items.map((cartItem) => {
    const orderItem = cartItem.toOrderItem();
    return orderItem;