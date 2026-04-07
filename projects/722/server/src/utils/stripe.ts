import Stripe from "stripe";

export interface StripeConfig {
  apiKey: string;
  apiVersion?: Stripe.LatestApiVersion;
}

export interface ProductDefinition {
  id: string;
  name: string;
  description?: string;
  metadata?: Stripe.MetadataParam;
}

export interface PriceDefinition {
  id: string;
  productId: string;
  unitAmount: number;
  currency: string;
  recurringInterval?: "day" | "week" | "month" | "year";
  metadata?: Stripe.MetadataParam;
}

export interface StripeMappingDefinition {
  products: ProductDefinition[];
  prices: PriceDefinition[];
}

export interface StripeProductWithPrices {
  product: Stripe.Product;
  prices: Stripe.Price[];
}

let stripeInstance: Stripe | null = null;

export const initStripe = (config: StripeConfig): Stripe => {
  if (stripeInstance) return stripeInstance;

  const { apiKey, apiVersion } = config;

  if (!apiKey) {
    throw new Error("Stripe API key is required to initialize Stripe client.");
  }

  stripeInstance = new Stripe(apiKey, {
    apiVersion: apiVersion ?? "2024-04-10",
  });

  return stripeInstance;
};

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    throw new Error(
      "Stripe client not initialized. Call initStripe() before using getStripe()."
    );
  }
  return stripeInstance;
};

export const ensureStripeInitialized = (apiKey?: string, apiVersion?: Stripe.LatestApiVersion): Stripe => {
  if (stripeInstance) return stripeInstance;
  if (!apiKey) {
    throw new Error(
      "Stripe not initialized and no API key provided to ensureStripeInitialized()."
    );
  }
  return initStripe({ apiKey, apiVersion });
};

export const upsertStripeProduct = async (
  productDef: ProductDefinition
): Promise<Stripe.Product> => {
  const stripe = getStripe();

  const existingProducts = await stripe.products.list({
    limit: 1,
    active: true,
    expand: [],
    ids: productDef.id ? [productDef.id] : undefined,
  });

  const existing = existingProducts.data.find(
    (p) => p.metadata && p.metadata.internal_id === productDef.id
  );

  if (existing) {
    if (
      existing.name === productDef.name &&
      existing.description === (productDef.description ?? null)
    ) {
      return existing;
    }

    return stripe.products.update(existing.id, {
      name: productDef.name,
      description: productDef.description,
      metadata: {
        ...(productDef.metadata || {}),
        internal_id: productDef.id,
      },
    });
  }

  return stripe.products.create({
    name: productDef.name,
    description: productDef.description,
    metadata: {
      ...(productDef.metadata || {}),
      internal_id: productDef.id,
    },
  });
};

export const upsertStripePrice = async (
  priceDef: PriceDefinition,
  stripeProductId: string
): Promise<Stripe.Price> => {
  const stripe = getStripe();

  const searchQueryParts: string[] = [
    `active:'true'`,
    `metadata['internal_id']:'undefined'`,
    `product:'undefined'`,
  ];

  const searchQuery = searchQueryParts.join(" AND ");

  const existingPrices = await stripe.prices.search({
    query: searchQuery,
    limit: 1,
  });

  const existing = existingPrices.data[0];

  if (existing) {
    const isRecurringMatch =
      (existing.recurring?.interval ?? null) ===
      (priceDef.recurringInterval ?? null);

    const isAmountMatch = existing.unit_amount === priceDef.unitAmount;
    const isCurrencyMatch = existing.currency === priceDef.currency.toLowerCase();

    if (isRecurringMatch && isAmountMatch && isCurrencyMatch && existing.active) {
      return existing;
    }

    await stripe.prices.update(existing.id, {
      active: false,
    });
  }

  return stripe.prices.create({
    unit_amount: priceDef.unitAmount,
    currency: priceDef.currency.toLowerCase(),
    product: stripeProductId,
    recurring: priceDef.recurringInterval
      ? { interval: priceDef.recurringInterval }
      : undefined,
    metadata: {
      ...(priceDef.metadata || {}),
      internal_id: priceDef.id,
      product_internal_id: priceDef.productId,
    },
  });
};

export const syncStripeCatalog = async (
  mapping: StripeMappingDefinition
): Promise<StripeProductWithPrices[]> => {
  const productIdToStripeProductId = new Map<string, string>();
  const productResults: StripeProductWithPrices[] = [];

  for (const productDef of mapping.products) {
    const stripeProduct = await upsertStripeProduct(productDef);
    productIdToStripeProductId.set(productDef.id, stripeProduct.id);
    productResults.push({ product: stripeProduct, prices: [] });
  }

  const stripeProductMap = new Map<string, StripeProductWithPrices>();
  for (const pr of productResults) {
    const internalId =
      (pr.product.metadata && pr.product.metadata.internal_id) || "";
    if (internalId) {
      stripeProductMap.set(internalId, pr);
    }
  }

  for (const priceDef of mapping.prices) {
    const stripeProductId = productIdToStripeProductId.get(priceDef.productId);
    if (!stripeProductId) {
      throw new Error(
        `No Stripe product found for internal productId "undefined". Ensure products are defined before prices.`
      );
    }

    const stripePrice = await upsertStripePrice(priceDef, stripeProductId);
    const productWithPrices = stripeProductMap.get(priceDef.productId);
    if (productWithPrices) {
      productWithPrices.prices.push(stripePrice);
    }
  }

  return productResults;
};

export const createStripeHelpers = (
  mapping: StripeMappingDefinition
): {
  getProductByInternalId: (internalId: string) => ProductDefinition | undefined;
  getPriceByInternalId: (internalId: string) => PriceDefinition | undefined;
  getPricesForProduct: (productInternalId: string) => PriceDefinition[];
} => {
  const productMap = new Map<string, ProductDefinition>();
  const priceMap = new Map<string, PriceDefinition>();
  const priceByProductMap = new Map<string, PriceDefinition[]>();

  for (const p of mapping.products) {
    productMap.set(p.id, p);
  }

  for (const price of mapping.prices) {
    priceMap.set(price.id, price);
    const arr = priceByProductMap.get(price.productId) ?? [];
    arr.push(price);
    priceByProductMap.set(price.productId, arr);
  }

  const getProductByInternalId = (internalId: string): ProductDefinition | undefined =>
    productMap.get(internalId);

  const getPriceByInternalId = (internalId: string): PriceDefinition | undefined =>
    priceMap.get(internalId);

  const getPricesForProduct = (productInternalId: string): PriceDefinition[] =>
    priceByProductMap.get(productInternalId) ?? [];

  return {
    getProductByInternalId,
    getPriceByInternalId,
    getPricesForProduct,
  };
};

export const parseStripeWebhookEvent = (
  payload: Buffer | string,
  signature: string | string[] | undefined,
  webhookSecret: string
): Stripe.Event => {
  const stripe = getStripe();

  if (!signature) {
    throw new Error("Missing Stripe-Signature header for webhook event.");
  }

  const sig =
    Array.isArray(signature) && signature.length ? signature[0] : signature;

  return stripe.webhooks.constructEvent(
    payload,
    sig,
    webhookSecret
  );
};

export const isCheckoutSessionCompleted = (
  event: Stripe.Event
): event is Stripe.Event & { type: "checkout.session.completed" } =>
  event.type === "checkout.session.completed";

export const isInvoicePaid = (
  event: Stripe.Event
): event is Stripe.Event & { type: "invoice.paid" } =>
  event.type === "invoice.paid";

export const isCustomerSubscriptionUpdated = (
  event: Stripe.Event
): event is Stripe.Event & { type: "customer.subscription.updated" } =>
  event.type === "customer.subscription.updated";

export const isCustomerSubscriptionDeleted = (
  event: Stripe.Event
): event is Stripe.Event & { type: "customer.subscription.deleted" } =>
  event.type === "customer.subscription.deleted";