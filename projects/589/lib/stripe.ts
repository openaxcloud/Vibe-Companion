import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
}

const apiVersion: Stripe.LatestApiVersion = '2024-06-20';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion,
  typescript: true,
  appInfo: {
    name: 'Your App Name',
    version: process.env.npm_package_version || '1.0.0',
  },
});

export type StripeClient = Stripe;

export default stripe;