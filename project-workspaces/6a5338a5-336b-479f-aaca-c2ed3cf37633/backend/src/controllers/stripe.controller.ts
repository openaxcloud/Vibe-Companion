import { Request, Response } from 'express';
import Stripe from 'stripe';
import { insertOrder, insertOrderItem, updateOrderStatus, findOrderById, updateOrderPaymentIntent } from '../models/order.model';
import { findProductById, updateProductStock } from '../models/product.model';
import { findUserById } from '../models/user.model';
import { sendOrderConfirmationEmail } from '../services/email.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2020-08-27', // Use a compatible API version
});

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const createPaymentIntent = async (req: AuthenticatedRequest, res: Response) => {
  const { amount, currency = 'usd', cartItems } = req.body; // amount in cents

  if (!amount || !cartItems || !cartItems.length) {
    return res.status(400).json({ message: 'Amount and cart items are required' });
  }

  // Calculate actual total amount on the backend to prevent tampering
  let calculatedAmount = 0;
  for (const item of cartItems) {
    const product = await findProductById(item.productId);
    if (!product || product.stock < item.quantity) {
      return res.status(400).json({ message: `Product ${product?.name || item.productId} is out of stock or insufficient quantity` });
    }
    calculatedAmount += product.price * item.quantity;
  }

  // Ensure calculated amount matches or is close to client-provided amount to handle floating point errors slightly
  // A more robust check might involve comparing within a small epsilon.
  if (Math.abs(calculatedAmount * 100 - amount) > 10) { // allow for small discrepancies (e.g., 10 cents)
    return res.status(400).json({ message: 'Calculated amount does not match provided amount' });
  }


  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(calculatedAmount * 100), // Stripe expects amount in cents
      currency,
      metadata: { userId: req.userId || 'guest', cartItems: JSON.stringify(cartItems) },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Error creating payment intent', error: error.message });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);

      // Fulfill the order here
      // Retrieve metadata from paymentIntent
      const userId = paymentIntent.metadata.userId;
      const cartItems = JSON.parse(paymentIntent.metadata.cartItems || '[]');
      const totalAmount = paymentIntent.amount / 100; // Convert cents back to dollars

      if (userId && cartItems.length > 0) {
        try {
          // Check if an order with this payment_intent_id already exists to prevent duplicate fulfillment
          // This is a simplified check. A more robust solution might store a unique idempotency key.
          const existingOrder = await pool.query('SELECT id FROM orders WHERE payment_intent_id = $1', [paymentIntent.id]);
          if (existingOrder.rows.length > 0) {
            console.log(`Order with payment intent ${paymentIntent.id} already exists, skipping fulfillment.`);
            return res.status(200).json({ received: true, message: 'Order already fulfilled' });
          }

          // In a real application, shipping and billing addresses would come from the user's profile or checkout form
          // For webhook context, we might need to store them in paymentIntent metadata or retrieve from user.
          // For simplicity, let's use placeholder addresses or retrieve from user if available.
          const user = await findUserById(userId);
          const shippingAddress = user?.address || 'N/A';
          const billingAddress = user?.address || 'N/A';


          const newOrder = await insertOrder({
            user_id: userId,
            total_amount: totalAmount,
            shipping_address: shippingAddress, // Placeholder
            billing_address: billingAddress,   // Placeholder
            payment_intent_id: paymentIntent.id,
          });

          for (const item of cartItems) {
            await insertOrderItem({
              order_id: newOrder.id,
              product_id: item.productId,
              quantity: item.quantity,
              price: item.price,
            });
            const product = await findProductById(item.productId);
            if (product) {
              await updateProductStock(item.productId, product.stock - item.quantity);
            }
          }

          await updateOrderStatus(newOrder.id, 'paid'); // Mark order as paid
          if (user?.email) {
            sendOrderConfirmationEmail(user.email, newOrder.id, cartItems);
          }

          console.log(`Order ${newOrder.id} successfully created and fulfilled.`);

        } catch (error) {
          console.error('Error fulfilling order from webhook:', error);
          // You might want to log this to a system that retries fulfillment or alerts an admin
          return res.status(500).json({ received: true, message: 'Error processing order fulfillment' });
        }
      }
      break;
    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent for ${paymentIntentFailed.amount} failed.`);
      // Handle failed payments (e.g., notify user, update order status)
      const failedOrderId = paymentIntentFailed.metadata.orderId; // If you stored orderId in metadata
      if (failedOrderId) {
         await updateOrderStatus(failedOrderId, 'cancelled'); // Or 'failed'
      }
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};
