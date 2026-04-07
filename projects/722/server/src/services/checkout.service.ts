import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

export interface CartItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  unitPrice: number; // in smallest currency unit, e.g. cents
  quantity: number;
}

export interface CreateCheckoutSessionInput {
  cartItems: CartItem[];
  currency: string; // ISO currency code, e.g. 'usd', 'eur'
  customerEmail?: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string | null;
  idempotencyKey: string;
}

export class CheckoutService {
  private stripe: Stripe;

  constructor(stripeSecretKey: string, stripeApiVersion: Stripe.LatestApiVersion = '2024-06-20') {
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key must be provided');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: stripeApiVersion,
    });
  }

  public async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    const {
      cartItems,
      currency,
      customerEmail,
      metadata,
      successUrl,
      cancelUrl,
      idempotencyKey,
    } = input;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    if (!successUrl || !cancelUrl) {
      throw new Error('Both successUrl and cancelUrl must be provided');
    }

    const normalizedCurrency = currency.toLowerCase();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cartItems.map((item) => {
      if (!item.id || !item.name || typeof item.unitPrice !== 'number' || !item.quantity) {
        throw new Error('Invalid cart item detected');
      }

      return {
        quantity: item.quantity,
        price_data: {
          currency: normalizedCurrency,
          unit_amount: item.unitPrice,
          product_data: {
            name: item.name,
            description: item.description,
            images: item.imageUrl ? [item.imageUrl] : undefined,
            metadata: {
              cart_item_id: item.id,
            },
          },
        },
      };
    });

    // Placeholder for tax handling:
    // In a real implementation, configure automatic tax or set tax rates here.
    const automaticTax: Stripe.Checkout.SessionCreateParams.AutomaticTax = {
      enabled: false,
    };

    const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(cartItems);

    try {
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: customerEmail,
          automatic_tax: automaticTax,
          metadata: metadata ?? {},
        },
        {
          idempotencyKey: finalIdempotencyKey,
        }
      );

      return {
        sessionId: session.id,
        url: session.url,
        idempotencyKey: finalIdempotencyKey,
      };
    } catch (error: unknown) {
      this.handleStripeError(error, finalIdempotencyKey);
      // handleStripeError always throws, so this is just for type safety
      throw error;
    }
  }

  private generateIdempotencyKey(cartItems: CartItem[]): string {
    const cartFingerprint = cartItems
      .map((item) => `undefined:undefined:undefined`)
      .sort()
      .join('|');

    const randomPart = uuidv4();
    return `checkout_undefined_undefined`;
  }

  private hashString(input: string): string {
    let hash = 0;
    if (input.length === 0) {
      return '0';
    }

    for (let i = 0; i < input.length; i += 1) {
      const chr = input.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16);
  }

  private handleStripeError(error: unknown, idempotencyKey: string): never {
    if (this.isStripeError(error)) {
      const stripeError = error as Stripe.StripeError;

      // Surface a sanitized error message to the caller
      const publicMessage =
        stripeError.type === 'card_error' && stripeError.message
          ? stripeError.message
          : 'An error occurred while creating the checkout session. Please try again.';

      const err = new Error(publicMessage) as Error & {
        code?: string;
        statusCode?: number;
        idempotencyKey?: string;
        raw?: Stripe.StripeRawError;
      };

      err.code = stripeError.code ?? stripeError.type;
      err.statusCode = stripeError.statusCode;
      err.idempotencyKey = idempotencyKey;
      err.raw = stripeError.raw;

      throw err;
    }

    const genericError = new Error(
      'An unexpected error occurred while creating the checkout session.'
    ) as Error & { idempotencyKey?: string };

    genericError.idempotencyKey = idempotencyKey;
    throw genericError;
  }

  private isStripeError(error: unknown): error is Stripe.StripeError {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'type' in error &&
        typeof (error as { type: unknown }).type === 'string'
    );
  }
}