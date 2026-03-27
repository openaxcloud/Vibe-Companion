import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

class MockStripe {
  _key: string;
  balance = { retrieve: vi.fn().mockResolvedValue({ available: [] }) };
  constructor(key: string) {
    this._key = key;
  }
}

class MockStripeSync {
  _opts: Record<string, unknown>;
  processWebhook = vi.fn();
  syncBackfill = vi.fn().mockResolvedValue(undefined);
  findOrCreateManagedWebhook = vi.fn().mockResolvedValue({ url: "https://test/webhook" });
  constructor(opts: Record<string, unknown>) {
    this._opts = opts;
  }
}

vi.mock("stripe", () => ({ default: MockStripe }));
vi.mock("stripe-replit-sync", () => ({ StripeSync: MockStripeSync }));

describe("stripeClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.REPLIT_CONNECTORS_HOSTNAME;
    delete process.env.REPL_IDENTITY;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isStripeConfigured", () => {
    it("returns false when no credentials are set", async () => {
      const { isStripeConfigured } = await import("../server/stripeClient");
      const result = await isStripeConfigured();
      expect(result).toBe(false);
    });

    it("returns true when STRIPE_SECRET_KEY is set", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { isStripeConfigured } = await import("../server/stripeClient");
      const result = await isStripeConfigured();
      expect(result).toBe(true);
    });
  });

  describe("getUncachableStripeClient", () => {
    it("throws when no credentials are available", async () => {
      const { getUncachableStripeClient } = await import("../server/stripeClient");
      await expect(getUncachableStripeClient()).rejects.toThrow(
        "Stripe is not configured"
      );
    });

    it("returns a Stripe client when STRIPE_SECRET_KEY is set", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_abc";
      const { getUncachableStripeClient } = await import("../server/stripeClient");
      const client = await getUncachableStripeClient();
      expect(client).toBeDefined();
      expect((client as unknown as MockStripe)._key).toBe("sk_test_abc");
    });

    it("prefers Replit connector credentials over env vars", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_env_fallback";
      process.env.REPLIT_CONNECTORS_HOSTNAME = "connectors.test";
      process.env.REPL_IDENTITY = "test-identity";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ secretKey: "sk_connector_key" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getUncachableStripeClient } = await import("../server/stripeClient");
      const client = await getUncachableStripeClient();
      expect((client as unknown as MockStripe)._key).toBe("sk_connector_key");

      vi.unstubAllGlobals();
    });

    it("falls back to env vars when connector fetch fails", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_env_fallback";
      process.env.REPLIT_CONNECTORS_HOSTNAME = "connectors.test";
      process.env.REPL_IDENTITY = "test-identity";

      const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
      vi.stubGlobal("fetch", mockFetch);

      const { getUncachableStripeClient } = await import("../server/stripeClient");
      const client = await getUncachableStripeClient();
      expect((client as unknown as MockStripe)._key).toBe("sk_env_fallback");

      vi.unstubAllGlobals();
    });

    it("handles snake_case connector response keys", async () => {
      process.env.REPLIT_CONNECTORS_HOSTNAME = "connectors.test";
      process.env.REPL_IDENTITY = "test-identity";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stripe_secret_key: "sk_snake_key", stripe_webhook_secret: "whsec_snake" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getUncachableStripeClient } = await import("../server/stripeClient");
      const client = await getUncachableStripeClient();
      expect((client as unknown as MockStripe)._key).toBe("sk_snake_key");

      vi.unstubAllGlobals();
    });
  });

  describe("getStripeSync", () => {
    it("throws when DATABASE_URL is missing", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { getStripeSync } = await import("../server/stripeClient");
      await expect(getStripeSync()).rejects.toThrow("DATABASE_URL is required");
    });

    it("throws when Stripe credentials are missing", async () => {
      process.env.DATABASE_URL = "postgres://test";
      const { getStripeSync } = await import("../server/stripeClient");
      await expect(getStripeSync()).rejects.toThrow("Stripe credentials not available");
    });

    it("creates StripeSync instance with correct config", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_sync";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      process.env.DATABASE_URL = "postgres://db:5432/test";

      const { getStripeSync } = await import("../server/stripeClient");
      const sync = await getStripeSync();
      expect(sync).toBeDefined();
      expect((sync as unknown as MockStripeSync)._opts).toMatchObject({
        stripeSecretKey: "sk_test_sync",
        stripeWebhookSecret: "whsec_test",
      });
    });

    it("returns cached instance on second call", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_cache";
      process.env.DATABASE_URL = "postgres://db:5432/test";

      const { getStripeSync } = await import("../server/stripeClient");
      const first = await getStripeSync();
      const second = await getStripeSync();
      expect(first).toBe(second);
    });
  });
});
