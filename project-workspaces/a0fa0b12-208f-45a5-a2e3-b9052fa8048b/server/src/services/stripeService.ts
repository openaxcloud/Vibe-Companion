import Stripe from 'stripe';
import { Order, OrderItem } from '../models/Order';
import { Product } from '../models/Product';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const createCheckoutSession = async (orderId: string, userId: string, cartItems: { product: Product; quantity: number }[], totalAmount: number) => {
  const line_items = cartItems.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product.name,
        images: [item.product.imageUrl || ''],
      },
      unit_amount: Math.round(item.product.price * 100), // Convert to cents
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items,
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/checkout?cancelled=true`,
    customer_email: (await stripe.customers.list({ email: (await stripe.customers.list({ limit: 1 })).data[0].email })).data[0]?.email || undefined, // Pre-fill email if user is known
    client_reference_id: orderId,
    metadata: { userId, orderId },
  });

  return session;
};

export const retrieveCheckoutSession = async (sessionId: string) => {
  return stripe.checkout.sessions.retrieve(sessionId);
};

export const constructWebhookEvent = (body: Buffer, signature: string | string[], secret: string) => {
  return stripe.webhooks.constructEvent(body, signature, secret);
};

export default stripe;
