import React, { ReactNode, useMemo } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { StripeElementsOptionsClientSecret, StripeElementsOptionsMode, loadStripe, Stripe } from "@stripe/stripe-js";

type StripeMode = StripeElementsOptionsMode;

export interface StripeElementsProviderProps {
  children: ReactNode;
  publishableKey?: string;
  /**
   * If using Payment Intents or Setup Intents, pass clientSecret.
   * When provided, Elements will be initialized in "payment" or "setup" mode accordingly.
   */
  clientSecret?: string;
  /**
   * Explicit mode can be provided if not using clientSecret-based flows
   */
  mode?: StripeMode;
  /**
   * Additional Stripe Elements options (e.g. locale, appearance)
   */
  options?: Omit<StripeElementsOptionsClientSecret, "clientSecret" | "mode"> & {
    locale?: StripeElementsOptionsClientSecret["locale"];
  };
}

/**
 * Singleton Stripe Promise to avoid re-initializing Stripe.
 * It is created lazily based on the given publishable key.
 */
let stripePromiseCache: { [publishableKey: string]: Promise<Stripe | null> } = {};

const getStripe = (publishableKey: string): Promise<Stripe | null> => {
  if (!stripePromiseCache[publishableKey]) {
    stripePromiseCache[publishableKey] = loadStripe(publishableKey);
  }
  return stripePromiseCache[publishableKey];
};

export const StripeElementsProvider: React.FC<StripeElementsProviderProps> = ({
  children,
  publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "",
  clientSecret,
  mode,
  options = {},
}) => {
  if (!publishableKey) {
    // In production, you may want to throw or log to an error monitoring service
    console.error(
      "[StripeElementsProvider] Missing Stripe publishable key. " +
        "Ensure REACT_APP_STRIPE_PUBLISHABLE_KEY or publishableKey prop is set."
    );
  }

  const stripePromise = useMemo(() => {
    return publishableKey ? getStripe(publishableKey) : Promise.resolve(null);
  }, [publishableKey]);

  const elementsOptions = useMemo(() => {
    const base: StripeElementsOptionsClientSecret | undefined =
      clientSecret && mode
        ? {
            clientSecret,
            mode,
            ...options,
          }
        : clientSecret
        ? {
            clientSecret,
            mode: "payment",
            ...options,
          }
        : undefined;

    return base;
  }, [clientSecret, mode, options]);

  if (!publishableKey) {
    return <>{children}</>;
  }

  if (clientSecret && !elementsOptions) {
    console.error(
      "[StripeElementsProvider] clientSecret was provided but Elements options could not be constructed."
    );
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      {children}
    </Elements>
  );
};

export default StripeElementsProvider;