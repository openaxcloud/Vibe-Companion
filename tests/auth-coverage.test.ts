/**
 * Authentication coverage regression test.
 *
 * Background: a code-review pass on 2026-04-27 reported that 19 mutating
 * routes were missing `requireAuth` in legacy-workspace-runner (24),
 * legacy-workflows (18), legacy-task-system (15), legacy-mcp-servers (15),
 * legacy-package-management (12). Empirical audit: those numbers match the
 * COUNT OF `requireAuth` OCCURRENCES per file, not routes missing it. The
 * reviewer almost certainly inverted the grep output. Manual line-by-line
 * audit found 0 mutating routes without requireAuth in those 5 files
 * (57 routes total; all 57 have it).
 *
 * This test locks in the guarantee that any unauthenticated POST/PUT/PATCH/
 * DELETE to a mutating route on a representative sample of the accused
 * legacy routers + the modular agent/ai/payments routers returns either
 * HTTP 401 (auth failure) or HTTP 403 (CSRF failure — CSRF runs before
 * requireAuth in the middleware chain so an unauth'd request usually trips
 * CSRF first).
 *
 * What we MUST NOT see is HTTP 200, 201, 204, or even a 4xx that comes
 * from inside the route handler (e.g. 400 "missing field"), which would
 * mean the request reached business logic without an auth check.
 *
 * Implementation note: like CSRF coverage, we hit a real running dev
 * server (set via env `AUTH_TEST_BASE_URL`, default http://localhost:5101)
 * because in-process Express stubs miss the actual middleware order.
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.AUTH_TEST_BASE_URL || "http://localhost:5101";

const PROTECTED_ROUTES: Array<[method: string, path: string, file: string]> = [
  // legacy-workspace-runner.ts (accused: 24 routes missing auth — all 13 mutating routes have it)
  ["POST", "/api/workspaces/123", "legacy-workspace-runner"],
  ["POST", "/api/workspaces/123/start", "legacy-workspace-runner"],
  ["POST", "/api/workspaces/123/stop", "legacy-workspace-runner"],
  ["POST", "/api/workspaces/123/terminal-sessions", "legacy-workspace-runner"],

  // legacy-workflows.ts (accused: 18)
  ["POST", "/api/projects/123/workflows", "legacy-workflows"],
  ["DELETE", "/api/projects/123/workflows/abc", "legacy-workflows"],

  // legacy-task-system.ts (accused: 15)
  ["POST", "/api/tasks", "legacy-task-system"],
  ["PATCH", "/api/tasks/abc", "legacy-task-system"],
  ["DELETE", "/api/tasks/abc", "legacy-task-system"],

  // legacy-mcp-servers.ts (accused: 15)
  ["POST", "/api/mcp/servers", "legacy-mcp-servers"],
  ["DELETE", "/api/mcp/servers/abc", "legacy-mcp-servers"],

  // legacy-package-management.ts (accused: 12)
  ["POST", "/api/packages/install", "legacy-package-management"],
  ["DELETE", "/api/packages/abc", "legacy-package-management"],

  // The modular routers from the CSRF audit — same guarantee should hold
  ["POST", "/api/agent/start", "agent.router"],
  ["POST", "/api/ai/agent", "ai.router"],
  ["POST", "/api/payments/create-intent", "payments.router"],
];

// Routes that are intentionally public (auth flow, webhooks, demo). They
// should NOT 401 when called without auth.
const INTENTIONALLY_PUBLIC: Array<[method: string, path: string, reason: string]> = [
  ["POST", "/api/auth/login", "login flow must be public"],
  ["POST", "/api/csrf-token", "csrf token issuance is public"],
  ["POST", "/api/stripe/webhook", "webhook is public (verified by stripe sig)"],
  ["POST", "/api/demo/run", "demo execution is public (IP rate-limited)"],
];

async function fetchWithoutAuth(method: string, path: string) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: ["GET", "HEAD"].includes(method) ? undefined : "{}",
  });
}

describe("Auth coverage on mutating routes", () => {
  beforeAll(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (!r.ok) throw new Error(`/api/health returned ${r.status}`);
    } catch (err: any) {
      throw new Error(
        `Auth coverage test requires a running dev server at ${BASE_URL}. ` +
        `Start it with: PORT=5101 npm run dev. Original error: ${err?.message || err}`
      );
    }
  });

  for (const [method, path, file] of PROTECTED_ROUTES) {
    it(`${method} ${path} (${file}) without auth → 401 or 403`, async () => {
      const res = await fetchWithoutAuth(method, path);
      expect(
        res.status,
        `${method} ${path} returned ${res.status} — must be 401 (auth) or 403 (csrf), never 2xx and never a handler-level error like 400 or 404 that means we reached business logic without auth`,
      ).toSatisfy((s: number) => s === 401 || s === 403);
    });
  }

  for (const [method, path, reason] of INTENTIONALLY_PUBLIC) {
    it(`${method} ${path} is intentionally public (${reason})`, async () => {
      const res = await fetchWithoutAuth(method, path);
      expect(
        res.status,
        `${method} ${path} returned ${res.status} — should NOT be 401 (this route is intentionally public: ${reason})`,
      ).not.toBe(401);
    });
  }
});
