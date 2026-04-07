import Stripe from "stripe";
import { config } from "dotenv";

config();

export interface CheckoutLineItem {
  priceId: string;
  quantity: number;
}

export interface CreateCheckoutSessionParams {
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  orderId?: string;
  userId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  mode?: Stripe.Checkout.SessionCreateParams.Mode;
  locale?: Stripe.Checkout.SessionCreateParams.Locale;
}

export interface CheckoutSessionResult {
  id: string;
  url: string | null;
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY in environment variables");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

const DEFAULT_MODE: Stripe.Checkout.SessionCreateParams.Mode = "payment";

export class CheckoutService {
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<CheckoutSessionResult> {
    const {
      lineItems,
      successUrl,
      cancelUrl,
      customerEmail,
      orderId,
      userId,
      metadata,
      mode = DEFAULT_MODE,
      locale,
    } = params;

    if (!lineItems || lineItems.length === 0) {
      throw new Error("At least one line item is required to create a checkout session");
    }

    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      lineItems.map((item) => {
        if (!item.priceId || !item.quantity || item.quantity <= 0) {
          throw new Error("Each line item must include a valid priceId and quantity > 0");
        }

        return {
          price: item.priceId,
          quantity: item.quantity,
          adjustable_quantity: {
            enabled: false,
          },
        };
      });

    const sessionMetadata: Record<string, string> = {
      ...(orderId ? { orderId } : {}),
      ...(userId ? { userId } : {}),
    };

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (value === undefined) continue;
        sessionMetadata[key] = String(value);
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: stripeLineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: sessionMetadata,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    if (locale) {
      sessionParams.locale = locale;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      id: session.id,
      url: session.url,
    };
  }
}

const checkoutService = new CheckoutService();
export default checkoutService;