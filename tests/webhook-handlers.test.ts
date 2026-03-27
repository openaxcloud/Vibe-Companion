import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    mockProcessWebhook: vi.fn().mockResolvedValue(undefined),
    mockGetUser: vi.fn(),
    mockUpdateUserPlan: vi.fn(),
    mockDbExecute: vi.fn(),
    mockLog: vi.fn(),
  };
});

vi.mock("../server/stripeClient", () => ({
  getStripeSync: vi.fn().mockResolvedValue({
    processWebhook: mocks.mockProcessWebhook,
  }),
}));

vi.mock("../server/storage", () => ({
  storage: {
    getUser: mocks.mockGetUser,
    updateUserPlan: mocks.mockUpdateUserPlan,
  },
}));

vi.mock("../server/db", () => ({
  db: {
    execute: mocks.mockDbExecute,
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock("../server/index", () => ({
  log: mocks.mockLog,
}));

import { WebhookHandlers } from "../server/webhookHandlers";

describe("WebhookHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processWebhook", () => {
    it("rejects non-Buffer payloads with descriptive error", async () => {
      const stringPayload = '{"type":"test"}' as unknown as Buffer;
      await expect(
        WebhookHandlers.processWebhook(stringPayload, "sig_test")
      ).rejects.toThrow("STRIPE WEBHOOK ERROR: Payload must be a Buffer");
    });

    it("delegates to stripeSync.processWebhook for DB sync", async () => {
      const payload = Buffer.from(JSON.stringify({
        type: "product.created",
        data: { object: { id: "prod_123" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockProcessWebhook).toHaveBeenCalledWith(payload, "sig_test");
    });

    it("does not reconcile for non-billing events", async () => {
      const payload = Buffer.from(JSON.stringify({
        type: "product.created",
        data: { object: { id: "prod_123" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockDbExecute).not.toHaveBeenCalled();
    });

    it("reconciles user plan on checkout.session.completed (subscription mode)", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-abc-123" } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_xyz", status: "active", product_metadata: { plan: "pro" } }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-abc-123", email: "test@test.com" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_123", id: "cs_test", mode: "subscription" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-abc-123", "pro", "cus_123", "sub_xyz");
    });

    it("upgrades user on checkout.session.completed for one-time payment (derives plan from DB)", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-onetime" } }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ plan: "pro" }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-onetime" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_onetime", id: "cs_onetime", mode: "payment", metadata: { priceId: "price_abc" } } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-onetime", "pro", "cus_onetime", null);
    });

    it("does NOT downgrade to free on checkout.session.completed for one-time payment", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-nodegrade" } }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ plan: "team" }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-nodegrade" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_otpay", id: "cs_otpay", mode: "payment", metadata: { priceId: "price_team" } } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      const callArgs = mocks.mockUpdateUserPlan.mock.calls[0];
      expect(callArgs[1]).not.toBe("free");
      expect(callArgs[1]).toBe("team");
    });

    it("derives plan from product metadata via priceId, not checkout metadata", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-verify" } }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ plan: "team" }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-verify" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: {
          customer: "cus_verify",
          id: "cs_verify",
          mode: "payment",
          metadata: { plan: "enterprise", priceId: "price_team_123" },
        } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-verify", "team", "cus_verify", null);
    });

    it("reconciles user plan on customer.subscription.created", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-456" } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_new", status: "active", product_metadata: { plan: "team" } }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-456" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "customer.subscription.created",
        data: { object: { customer: "cus_456", id: "sub_new" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-456", "team", "cus_456", "sub_new");
    });

    it("downgrades to free when subscription is deleted", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-789" } }] })
        .mockResolvedValueOnce({ rows: [] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-789" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "customer.subscription.deleted",
        data: { object: { customer: "cus_789", id: "sub_del" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-789", "free", "cus_789", null);
    });

    it("reconciles on invoice.paid", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-inv" } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_inv", status: "active", product_metadata: { plan: "pro" } }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-inv" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "invoice.paid",
        data: { object: { customer: "cus_inv", id: "inv_123" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-inv", "pro", "cus_inv", "sub_inv");
    });

    it("downgrades to free on invoice.payment_failed with no active sub", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-fail" } }] })
        .mockResolvedValueOnce({ rows: [] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-fail" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "invoice.payment_failed",
        data: { object: { customer: "cus_fail", id: "inv_fail" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-fail", "free", "cus_fail", null);
    });

    it("handles UUID user IDs correctly (no parseInt)", async () => {
      const uuidUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: uuidUserId } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_uuid", status: "active", product_metadata: { plan: "pro" } }] });
      mocks.mockGetUser.mockResolvedValue({ id: uuidUserId });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "customer.subscription.updated",
        data: { object: { customer: "cus_uuid", id: "sub_uuid" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockGetUser).toHaveBeenCalledWith(uuidUserId);
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith(uuidUserId, "pro", "cus_uuid", "sub_uuid");
    });

    it("skips reconciliation when customer has no userId metadata", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce({ rows: [{ metadata: {} }] });

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_no_meta", id: "cs_test", mode: "subscription" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockGetUser).not.toHaveBeenCalled();
      expect(mocks.mockUpdateUserPlan).not.toHaveBeenCalled();
    });

    it("skips reconciliation when customer is not found in stripe schema", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce({ rows: [] });

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_missing", id: "cs_test", mode: "subscription" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockGetUser).not.toHaveBeenCalled();
    });

    it("skips reconciliation when user is not found in app DB", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-gone" } }] });
      mocks.mockGetUser.mockResolvedValue(null);

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_gone", id: "cs_test", mode: "subscription" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).not.toHaveBeenCalled();
    });

    it("skips reconciliation when event has no customer field", async () => {
      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { id: "cs_no_customer" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockDbExecute).not.toHaveBeenCalled();
    });

    it("handles customer as expanded object with id property", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-expanded" } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_exp", status: "active", product_metadata: { plan: "pro" } }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-expanded" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: { id: "cus_expanded" }, id: "cs_test", mode: "subscription" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-expanded", "pro", "cus_expanded", "sub_exp");
    });

    it("propagates error when stripeSync.processWebhook rejects", async () => {
      const { getStripeSync } = await import("../server/stripeClient");
      const sync = await getStripeSync();
      (sync.processWebhook as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Invalid signature"));

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_sig", id: "cs_sig" } },
      }));

      await expect(
        WebhookHandlers.processWebhook(payload, "bad_sig")
      ).rejects.toThrow("Invalid signature");
    });

    it("defaults to 'pro' plan when product has no plan metadata", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-noplan" } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_noplan", status: "active", product_metadata: null }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-noplan" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "customer.subscription.created",
        data: { object: { customer: "cus_noplan", id: "sub_noplan" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-noplan", "pro", "cus_noplan", "sub_noplan");
    });

    it("logs error but does not throw when reconciliation fails", async () => {
      mocks.mockDbExecute.mockRejectedValueOnce(new Error("DB connection lost"));

      const payload = Buffer.from(JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { customer: "cus_err", id: "cs_err", mode: "subscription" } },
      }));

      await expect(
        WebhookHandlers.processWebhook(payload, "sig_test")
      ).resolves.not.toThrow();

      expect(mocks.mockLog).toHaveBeenCalledWith(
        expect.stringContaining("Failed to reconcile plan"),
        "stripe"
      );
    });

    it("does not downgrade on subscription.updated when subscription is still active", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-updated" } }] })
        .mockResolvedValueOnce({ rows: [{ id: "sub_upd", status: "active", product_metadata: { plan: "team" } }] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-updated" });
      mocks.mockUpdateUserPlan.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify({
        type: "customer.subscription.updated",
        data: { object: { customer: "cus_upd", id: "sub_upd" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).toHaveBeenCalledWith("uuid-updated", "team", "cus_upd", "sub_upd");
    });

    it("does not change plan on subscription.updated with no active sub (no false downgrade)", async () => {
      mocks.mockDbExecute
        .mockResolvedValueOnce({ rows: [{ metadata: { userId: "uuid-nosub" } }] })
        .mockResolvedValueOnce({ rows: [] });
      mocks.mockGetUser.mockResolvedValue({ id: "uuid-nosub" });

      const payload = Buffer.from(JSON.stringify({
        type: "customer.subscription.updated",
        data: { object: { customer: "cus_nosub", id: "sub_nosub" } },
      }));

      await WebhookHandlers.processWebhook(payload, "sig_test");
      expect(mocks.mockUpdateUserPlan).not.toHaveBeenCalled();
    });
  });
});
