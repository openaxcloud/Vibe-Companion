import Stripe from 'stripe';

export const coerceNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const getSubscriptionPeriodBoundary = (
  subscription: Stripe.Subscription,
  boundary: 'current_period_start' | 'current_period_end'
): Date | null => {
  for (const item of subscription.items.data) {
    const value = (item as Partial<Record<typeof boundary, number>>)[boundary];
    if (typeof value === 'number') {
      return new Date(value * 1000);
    }
  }

  const anchor = coerceNumber(subscription.billing_cycle_anchor);
  return anchor ? new Date(anchor * 1000) : null;
};
