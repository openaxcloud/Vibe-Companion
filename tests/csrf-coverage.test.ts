/**
 * CSRF coverage regression test.
 *
 * Background: a code-review pass on 2026-04-27 reported that CSRF was missing
 * on `agent.router.ts`, `ai.router.ts`, and `payments.router.ts`. Empirical
 * testing showed this was false — `app.use("/api", csrfProtection)` at
 * `server/routes.ts:1341` covers them globally — but the claim was reasonable
 * given that the wiring is buried in a 21k-line file.
 *
 * This test locks the security guarantee in place: any POST to a mutating
 * route must return HTTP 403 without a valid CSRF token, regardless of which
 * router file declares it. If someone refactors the middleware order in
 * routes.ts and silently breaks CSRF, this test fails immediately.
 *
 * Implementation note: we hit a dev server already booted on PORT=5101 (set
 * via env `CSRF_TEST_BASE_URL`) instead of constructing an Express app
 * in-process — the latter would miss the actual middleware wiring order from
 * the real routes.ts and give false confidence.
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.CSRF_TEST_BASE_URL || "http://localhost:5101";

const ROUTES_REQUIRING_CSRF = [
  "/api/agent/start",
  "/api/agent/plan",
  "/api/agent/build",
  "/api/ai/agent",
  "/api/ai/generate",
  "/api/payments/create-intent",
  "/api/payments/checkout",
  "/api/projects",
  "/api/files",
];

const EXEMPT_ROUTES = [
  "/api/auth/login",
  "/api/csrf-token",
  "/api/stripe/webhook",
];

async function ping(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    ...init,
  });
  return res;
}

describe("CSRF coverage", () => {
  beforeAll(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (!r.ok) throw new Error(`/api/health returned ${r.status}`);
    } catch (err: any) {
      throw new Error(
        `CSRF coverage test requires a running dev server at ${BASE_URL}. ` +
        `Start it with: PORT=5101 npm run dev. Original error: ${err?.message || err}`
      );
    }
  });

  for (const path of ROUTES_REQUIRING_CSRF) {
    it(`POST ${path} without token → 403`, async () => {
      const res = await ping(path);
      expect(res.status, `${path} should require CSRF`).toBe(403);
      const body = await res.json().catch(() => null);
      const message = body?.message || body?.error || "";
      expect(String(message).toLowerCase()).toContain("csrf");
    });
  }

  for (const path of EXEMPT_ROUTES) {
    it(`POST ${path} without token → not 403 (CSRF-exempt)`, async () => {
      const res = await ping(path);
      expect(res.status, `${path} should be CSRF-exempt`).not.toBe(403);
    });
  }
});
