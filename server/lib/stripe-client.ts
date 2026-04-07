import Stripe from 'stripe';

let _instance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_instance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('[Stripe] STRIPE_SECRET_KEY environment variable is required');
    }
    _instance = new Stripe(key, {
      apiVersion: '2025-08-27.basil',
    });
  }
  return _instance;
}

export default getStripe;
