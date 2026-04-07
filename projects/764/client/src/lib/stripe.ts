import { Stripe, StripeElements } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';

export interface StripeConfig {
  publishableKey: string;
  stripeAccount?: string;
  apiVersion?: string;
  locale?: Stripe.StripeConfig['locale'];
}

let stripePromise: Promise<Stripe | null> | null = null;
let cachedConfigKey: string | null = null;

const createConfigKey = (config: StripeConfig): string => {
  const { publishableKey, stripeAccount, apiVersion, locale } = config;
  return JSON.stringify({ publishableKey, stripeAccount, apiVersion, locale });
};

export const initializeStripe = (config: StripeConfig): Promise<Stripe | null> => {
  if (!config?.publishableKey) {
    console.error('Stripe publishable key is required to initialize Stripe.');
    stripePromise = Promise.resolve(null);
    cachedConfigKey = null;
    return stripePromise;
  }

  const newConfigKey = createConfigKey(config);

  if (!stripePromise || cachedConfigKey !== newConfigKey) {
    cachedConfigKey = newConfigKey;
    stripePromise = loadStripe(config.publishableKey, {
      stripeAccount: config.stripeAccount,
      apiVersion: config.apiVersion,
      locale: config.locale,
    });
  }

  return stripePromise;
};

export const getStripe = async (config?: StripeConfig): Promise<Stripe | null> => {
  if (!stripePromise) {
    if (!config) {
      console.error(
        'Stripe has not been initialized. Call initializeStripe(config) with a publishable key before using getStripe.'
      );
      return null;
    }
    await initializeStripe(config);
  }

  return stripePromise || Promise.resolve(null);
};

export interface CreateElementsOptions {
  stripeConfig?: StripeConfig;
  elementsOptions?: Parameters<Stripe['elements']>[0];
}

/**
 * Helper to create a Stripe Elements instance for use in a Checkout-like flow.
 * This does not mount any UI, but returns a configured `elements` and `stripe` pair.
 */
export const createCheckoutElements = async (
  options: CreateElementsOptions = {}
): Promise<{
  stripe: Stripe | null;
  elements: StripeElements | null;
}> => {
  const { stripeConfig, elementsOptions } = options;

  const stripe = await getStripe(stripeConfig);
  if (!stripe) {
    console.error(
      'Unable to create Stripe Elements instance because Stripe failed to initialize.'
    );
    return { stripe: null, elements: null };
  }

  const elements = stripe.elements(elementsOptions);
  return { stripe, elements };
};