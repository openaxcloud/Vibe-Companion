import { Request, Response, NextFunction } from 'express';
import stripe from '../config/stripe';
import * as orderService from '../services/orderService';
import * as emailService from '../services/emailService';
import { CheckoutItem, ShippingAddress, OrderItem } from '../types';
import dotenv from 'dotenv';
import { User } from '../types';
import * as UserModel from '../models/User';

dotenv.config();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user; // From protect middleware
  const { items, shippingAddress } = req.body as { items: CheckoutItem[]; shippingAddress: ShippingAddress };

  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  try {
    const user = await UserModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.imageUrl ? [item.imageUrl] : [],
        },
        unit_amount: Math.round(item.price * 100), // Price in cents
      },
      quantity: item.quantity,
    }));

    // Create a new order in a pending state before redirecting to Stripe
    // Store necessary details to confirm the order in the webhook
    // For this example, we'll create the order in the webhook after successful payment

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: `${CLIENT_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/checkout?canceled=true`,
      customer_email: user.email,
      metadata: {
        userId: userId,
        shippingAddress: JSON.stringify(shippingAddress),
        cartItems: JSON.stringify(items),
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Session Error:', error);
    next(error);
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Checkout session completed!', session.id);

      // Fulfill the purchase...
      try {
        const { userId, shippingAddress, cartItems } = session.metadata || {};
        const userEmail = session.customer_details?.email;

        if (userId && userEmail && shippingAddress && cartItems) {
          const parsedShippingAddress: ShippingAddress = JSON.parse(shippingAddress);
          const parsedCartItems: OrderItem[] = JSON.parse(cartItems);
          const totalAmount = session.amount_total ? session.amount_total / 100 : 0;

          const newOrder = await orderService.createNewOrder(
            userId,
            userEmail,
            parsedShippingAddress,
            parsedCartItems.map(item => ({...item, price: item.price / 100})) // Convert back from cents if needed
          );
          await orderService.updateOrderStatus(newOrder.id, 'Completed');
          await emailService.sendConfirmationEmail(newOrder);
          console.log(`Order ${newOrder.id} created and confirmed.`);
        } else {
          console.error('Missing metadata in Stripe session for order creation.');
        }

      } catch (error) {
        console.error('Error processing checkout.session.completed webhook:', error);
        // You might want to log this error and potentially trigger manual review
      }

      break;
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      // Then define and call a function to handle the event payment_intent.succeeded
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};
