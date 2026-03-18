import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let stripeSyncInstance: StripeSync | null = null;

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string } | null> {
  try {
    const connectorsHostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const replIdentity = process.env.REPL_IDENTITY;

    if (connectorsHostname && replIdentity) {
      const res = await fetch(
        `https://${connectorsHostname}/proxy/stripe/config`,
        {
          headers: {
            "X-Ecode-Identity": replIdentity,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.secretKey || data?.stripe_secret_key) {
          return {
            secretKey: data.secretKey || data.stripe_secret_key,
            webhookSecret: data.webhookSecret || data.stripe_webhook_secret,
          };
        }
      }
    }
  } catch {}

  if (process.env.STRIPE_SECRET_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    };
  }

  return null;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const creds = await getStripeCredentials();
  if (!creds) {
    throw new Error("Stripe is not configured. Connect the Stripe integration or set STRIPE_SECRET_KEY.");
  }
  return new Stripe(creds.secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  if (stripeSyncInstance) return stripeSyncInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe sync");
  }

  const creds = await getStripeCredentials();
  if (!creds) {
    throw new Error("Stripe credentials not available");
  }

  stripeSyncInstance = new StripeSync({
    poolConfig: {
      connectionString: databaseUrl,
      max: 5,
    },
    stripeSecretKey: creds.secretKey,
    stripeWebhookSecret: creds.webhookSecret,
  });

  return stripeSyncInstance;
}

export async function isStripeConfigured(): Promise<boolean> {
  try {
    const creds = await getStripeCredentials();
    return creds !== null;
  } catch {
    return false;
  }
}
