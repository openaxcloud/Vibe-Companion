import { Request, Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import pool from '../db';
import { sendOrderConfirmationEmail } from '../utils/email';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2022-11-15', // Use a recent API version
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { amount } = req.body; // amount in cents

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Error creating payment intent' });
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      // You can implement your order fulfillment logic here
      // For example, update order status in your DB, send confirmation emails etc.
      break;
    case 'payment_method.attached':
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      console.log('PaymentMethod was attached to a Customer!');
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
};