import { Request, Response } from "express";
import Stripe from "stripe";
import { logger } from "../utils/logger";
import { OrderService } from "../services/order.service";
import { InventoryService } from "../services/inventory.service";
import { EmailService } from "../services/email.service";
import { Config } from "../config";

const stripe = new Stripe(Config.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const orderService = new OrderService();
const inventoryService = new InventoryService();
const emailService = new EmailService();

enum StripeEventType {
  PaymentIntentSucceeded = "payment_intent.succeeded",
  PaymentIntentPaymentFailed = "payment_intent.payment_failed",
  CheckoutSessionCompleted = "checkout.session.completed",
  CheckoutSessionExpired = "checkout.session.expired",
  ChargeRefunded = "charge.refunded",
  ChargeDisputeCreated = "charge.dispute.created",
  CustomerSubscriptionDeleted = "customer.subscription.deleted",
}

interface StripeRequest extends Request {
  rawBody?: Buffer;
}

const getSignature = (req: Request): string => {
  const sig = req.headers["stripe-signature"];
  if (!sig || Array.isArray(sig)) {
    throw new Error("Missing Stripe signature header");
  }
  return sig;
};

const constructEvent = (req: StripeRequest): Stripe.Event => {
  if (!req.rawBody) {
    throw new Error("Missing rawBody on request for Stripe webhook");
  }
  const signature = getSignature(req);
  return stripe.webhooks.constructEvent(
    req.rawBody,
    signature,
    Config.STRIPE_WEBHOOK_SECRET
  );
};

const handleCheckoutSessionCompleted = async (event: Stripe.Event): Promise<void> => {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = (session.metadata && session.metadata.orderId) || null;
  const customerEmail = session.customer_details?.email || (session.customer_email as string | null);

  if (!orderId) {
    logger.warn("checkout.session.completed webhook missing orderId in metadata", {
      sessionId: session.id,
    });
    return;
  }

  try {
    const order = await orderService.markOrderAsPaid(orderId, {
      stripePaymentIntentId: session.payment_intent as string | undefined,
      stripeSessionId: session.id,
    });

    await inventoryService.decrementInventoryForOrder(orderId);

    if (customerEmail) {
      await emailService.sendOrderConfirmation({
        orderId: order.id,
        to: customerEmail,
      });
    }

    await emailService.notifyAdminNewOrder(order);

    logger.info("Handled checkout.session.completed", { orderId, sessionId: session.id });
  } catch (error) {
    logger.error("Failed to process checkout.session.completed", {
      error,
      orderId,
      sessionId: session.id,
    });
    throw error;
  }
};

const handleCheckoutSessionExpired = async (event: Stripe.Event): Promise<void> => {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = (session.metadata && session.metadata.orderId) || null;

  if (!orderId) {
    logger.warn("checkout.session.expired webhook missing orderId in metadata", {
      sessionId: session.id,
    });
    return;
  }

  try {
    await orderService.markOrderAsExpired(orderId);
    await inventoryService.restoreInventoryForOrder(orderId);

    logger.info("Handled checkout.session.expired", { orderId, sessionId: session.id });
  } catch (error) {
    logger.error("Failed to process checkout.session.expired", {
      error,
      orderId,
      sessionId: session.id,
    });
    throw error;
  }
};

const handlePaymentIntentSucceeded = async (event: Stripe.Event): Promise<void> => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const orderId = (paymentIntent.metadata && paymentIntent.metadata.orderId) || null;

  if (!orderId) {
    logger.info("payment_intent.succeeded without orderId metadata; ignoring", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  try {
    const order = await orderService.markOrderAsPaid(orderId, {
      stripePaymentIntentId: paymentIntent.id,
    });

    await inventoryService.decrementInventoryForOrder(orderId);

    const receiptEmail =
      paymentIntent.receipt_email ||
      (paymentIntent.charges.data[0]?.billing_details?.email ?? null);

    if (receiptEmail) {
      await emailService.sendOrderConfirmation({
        orderId: order.id,
        to: receiptEmail,
      });
    }

    await emailService.notifyAdminNewOrder(order);

    logger.info("Handled payment_intent.succeeded", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error("Failed to process payment_intent.succeeded", {
      error,
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    throw error;
  }
};

const handlePaymentIntentFailed = async (event: Stripe.Event): Promise<void> => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const orderId = (paymentIntent.metadata && paymentIntent.metadata.orderId) || null;

  if (!orderId) {
    logger.info("payment_intent.payment_failed without orderId metadata; ignoring", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  try {
    await orderService.markOrderAsPaymentFailed(orderId, {
      stripePaymentIntentId: paymentIntent.id,
      failureCode: paymentIntent.last_payment_error?.code,
      failureMessage: paymentIntent.last_payment_error?.message,
    });

    await inventoryService.restoreInventoryForOrder(orderId);

    const customerEmail =
      paymentIntent.receipt_email ||
      paymentIntent.charges.data[0]?.billing_details?.email;

    if (customerEmail) {
      await emailService.sendPaymentFailedNotification({
        orderId,
        to: customerEmail,
      });
    }

    logger.info("Handled payment_intent.payment_failed", {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error("Failed to process payment_intent.payment_failed", {
      error,
      orderId,
      paymentIntentId: paymentIntent.id,
    });
    throw error;
  }
};

const handleChargeRefunded = async (event: Stripe.Event): Promise<void> => {
  const charge = event.data.object as Stripe.Charge;
  const orderId = (charge.metadata && charge.metadata.orderId) || null;

  if (!orderId) {
    logger.info("charge.refunded without orderId metadata; ignoring", {
      chargeId: charge.id,
    });
    return;
  }

  try {
    await orderService.markOrderAsRefunded(orderId, {
      stripeChargeId: charge.id,
      amountRefunded: charge.amount_refunded,
      currency: charge.currency,
    });

    await inventoryService.restoreInventoryForOrder(orderId);

    const customerEmail = charge.billing_details?.email;

    if (customerEmail) {
      await emailService.sendRefundNotification({
        orderId,
        to: customerEmail,
        amount: charge.amount_refunded,
        currency: charge.currency,
      });
    }

    logger.info("Handled charge.refunded", { orderId, chargeId: charge.id });
  } catch (error) {
    logger.error("Failed to process charge.refunded", {
      error,
      orderId,
      chargeId: charge.id,
    });
    throw error;
  }
};

const handleChargeDisputeCreated = async (event: Stripe.Event): Promise<void> => {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  try {
    let orderId: string | null = null;

    if (chargeId) {
      const charge = (await stripe.charges.retrieve(chargeId)) as Stripe.Charge;
      orderId = (charge.metadata && charge.metadata.orderId) || null;
    }

    if (orderId) {
      await orderService.markOrderAsDisputed(orderId, {
        stripeDisputeId: dispute.id,
        reason: dispute.reason,
        amount: dispute.amount,
        currency: dispute.currency,
      });
    }

    await emailService.notifyAdminDisputeCreated({
      stripeDisputeId: dispute.id,
      chargeId,
      orderId: orderId || undefined,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
    });

    logger.info("Handled charge.dispute.created", {
      orderId,
      chargeId,
      disputeId: dispute.id,
    });
  } catch (error) {
    logger.error("Failed to process charge.dispute.created", {
      error,
      disputeId: dispute.id,
    });
    throw error;
  }
};

const handleSubscriptionDeleted = async (event: Stripe.Event): Promise<void> => {
  const subscription = event.data.object as Stripe.Subscription;
  const orderId = (subscription.metadata && subscription.metadata.orderId) || null;

  if (!orderId) {
    logger.info("customer.subscription.deleted without orderId metadata; ignoring", {
      subscriptionId: subscription.id,
    });
    return;
  }

  try {
    await orderService.markSubscriptionOrderAsCanceled(orderId, {
      stripeSubscriptionId: subscription.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at