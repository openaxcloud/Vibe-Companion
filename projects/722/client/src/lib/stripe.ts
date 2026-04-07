import { loadStripe, Stripe } from '@stripe/stripe-js';
import React, { ReactNode, useMemo } from 'react';
import { Elements, ElementsConsumer, ElementsProps } from '@stripe/react-stripe-js';

const publishableKey: string | undefined = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

if (!publishableKey) {
  // In production you might want to handle this differently (e.g. show error UI)
  // but throwing here ensures misconfiguration is caught early.
  throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is not defined in environment variables');
}

let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export const getStripeInstance = getStripe;

export interface StripeElementsWrapperProps extends Omit<ElementsProps, 'stripe'> {
  children: ReactNode;
}

export const StripeElementsWrapper: React.FC<StripeElementsWrapperProps> = ({
  children,
  options,
  ...rest
}) => {
  const stripe = useMemo(() => getStripe(), []);

  const memoizedOptions = useMemo(() => options, [options]);

  return (
    <Elements stripe={stripe} options={memoizedOptions} {...rest}>
      {children}
    </Elements>
  );
};

export { Elements, ElementsConsumer };