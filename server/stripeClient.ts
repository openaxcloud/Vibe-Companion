import { StripeSync } from "stripe-replit-sync";

let stripeSyncInstance: StripeSync | null = null;

export async function isStripeConfigured(): Promise<boolean> {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function getStripeSync(): Promise<StripeSync> {
  if (stripeSyncInstance) return stripeSyncInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  stripeSyncInstance = new StripeSync({
    stripeSecretKey: secretKey,
    databaseUrl: process.env.DATABASE_URL!,
  });

  console.log(stripeSyncInstance, "StripeSync initialized");
  return stripeSyncInstance;
}
