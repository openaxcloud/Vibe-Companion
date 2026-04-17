import { loadStripe } from '@stripe/stripe-js';

// Ensure this matches your Vite config for environment variables
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const getStripe = async () => {
  const stripe = await stripePromise;
  if (!stripe) {
    throw new Error('Stripe.js failed to load.');
  }
  return stripe;
};
