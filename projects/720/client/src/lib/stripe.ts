import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

const getPublishableKey = (): string => {
  const key =
    (typeof window !== 'undefined' && (window as any).__STRIPE_PUBLISHABLE_KEY__) ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ||
    '';

  if (!key) {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error(
        '[Stripe] Publishable key is not set. Please configure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or VITE_STRIPE_PUBLISHABLE_KEY.'
      );
    }
  }

  return key;
};

export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const publishableKey = getPublishableKey();
    if (!publishableKey) {
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(publishableKey);
    }
  }
  return stripePromise;
};

export default getStripe;