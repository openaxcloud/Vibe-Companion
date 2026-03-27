import Stripe from "stripe";
import { getUncachableStripeClient } from "../server/stripeClient";

async function ensureProduct(
  stripe: Stripe,
  name: string,
  description: string,
  planKey: string,
  features: string[],
  prices: { amount: number; interval: "month" | "year"; label: string }[]
) {
  const existing = await stripe.products.search({
    query: `name:'${name}' AND active:'true'`,
  });

  let product = existing.data[0];
  if (product) {
    console.log(`${name} already exists (${product.id})`);
  } else {
    product = await stripe.products.create({
      name,
      description,
      metadata: {
        plan: planKey,
        features: JSON.stringify(features),
      },
    });
    console.log(`Created product: ${name} (${product.id})`);
  }

  for (const p of prices) {
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });

    const found = existingPrices.data.find(
      (ep) =>
        ep.unit_amount === p.amount &&
        ep.recurring?.interval === p.interval
    );

    if (found) {
      console.log(`  Price $${(p.amount / 100).toFixed(2)}/${p.interval} already exists (${found.id})`);
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: p.amount,
        currency: "usd",
        recurring: { interval: p.interval },
        metadata: { plan: planKey, interval: p.interval },
      });
      console.log(`  Created price: ${p.label} (${price.id})`);
    }
  }
}

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log("Ensuring products and prices in Stripe...\n");

    await ensureProduct(
      stripe,
      "Pro Plan",
      "For developers who need more power and flexibility",
      "pro",
      [
        "Unlimited projects",
        "500 code executions / day",
        "200 AI calls / day",
        "5 GB storage",
        "All languages (Go, Java, C++, Ruby, Bash)",
        "Priority AI (GPT-4o, Claude, Gemini)",
        "Custom domains",
        "Priority support",
      ],
      [
        { amount: 1200, interval: "month", label: "$12.00/month" },
        { amount: 11500, interval: "year", label: "$115.00/year" },
      ]
    );

    console.log("");

    await ensureProduct(
      stripe,
      "Team Plan",
      "For teams building together with shared workspaces",
      "team",
      [
        "Everything in Pro",
        "Unlimited team members",
        "Shared projects & workspaces",
        "Team admin dashboard",
        "SSO & SAML",
        "Audit logs",
        "99.9% uptime SLA",
        "Dedicated support",
      ],
      [
        { amount: 2500, interval: "month", label: "$25.00/user/month" },
        { amount: 24000, interval: "year", label: "$240.00/user/year" },
      ]
    );

    console.log("\nAll products and prices verified successfully!");
    console.log("Webhooks will sync this data to your database automatically.");
  } catch (error) {
    console.error("Error creating products:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

createProducts();
