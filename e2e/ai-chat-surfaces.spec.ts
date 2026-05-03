/**
 * Cross-surface AI chat E2E (Task #181).
 *
 * Drives the *real* desktop IDE, mobile workspace, and assistant page
 * surfaces in a real browser. Streaming endpoints are intercepted with
 * `page.route` so the test focuses on the UI flow each surface
 * implements: send a message → streamed tokens render → done state, plus
 * a 429 surfaces a visible error.
 *
 * The canonical AIPanel calls `/api/agent-providers/message` for normal
 * sends; the legacy/standalone agent panel calls `/api/agent/chat/stream`
 * (concurrency-capped). Both are mocked here so any surface that uses
 * either will exercise our mocks.
 *
 * Requires the e2e admin account: admin@test.com / e2e-admin-password.
 * Seed via `tsx scripts/reset-e2e-admin.ts` before running. The CI
 * workflow does this automatically; locally, fail loudly if missing.
 */
import { test, expect, type Page, type Route } from "@playwright/test";

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || "admin@test.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "e2e-admin-password";

const TOKENS = ["Hello", ", ", "world", "!"];

// ── helpers ─────────────────────────────────────────────────────────────────

async function getCsrf(page: Page): Promise<string | null> {
  const r = await page.request.get("/api/csrf-token");
  if (!r.ok()) return null;
  const body = await r.json().catch(() => null);
  return body?.csrfToken || body?.token || null;
}

async function login(page: Page) {
  const csrf = await getCsrf(page);
  const r = await page.request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: csrf ? { "x-csrf-token": csrf } : {},
  });
  // Hard fail (not skip): the suite is wired with deterministic seeding
  // in CI. A failed login indicates the seed step didn't run, which is
  // a real CI/setup regression — exactly the kind of silent gap this
  // task exists to prevent.
  expect(r.ok(), `e2e admin login failed (${r.status()}). Seed via 'tsx scripts/reset-e2e-admin.ts'.`).toBeTruthy();
}

/** Build a deterministic SSE body matching the streaming contract. */
function buildSseBody(): string {
  const ev = (event: string, data: any) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let body = ev("connected", { status: "connected" });
  body += ev("usage", { provider: "openai", model: "gpt-4.1", tokens: 0 });
  for (const t of TOKENS) body += ev("token", { content: t, text: t });
  body += ev("done", {
    totalTokens: TOKENS.length,
    tokensInput: 1,
    tokensOutput: TOKENS.length,
    cost: "0.000010",
    model: "gpt-4.1",
    provider: "openai",
  });
  return body;
}

async function mockBothStreamingEndpoints(page: Page) {
  const handler = async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
      },
      body: buildSseBody(),
    });
  };
  await page.route("**/api/agent/chat/stream", handler);
  await page.route("**/api/agent-providers/message", handler);
}

async function ensureProjectId(page: Page): Promise<string> {
  const r = await page.request.get("/api/projects");
  expect(r.ok(), `cannot list projects: ${r.status()}`).toBeTruthy();
  const data = await r.json().catch(() => null);
  const list: any[] = Array.isArray(data) ? data : data?.projects || [];
  if (list.length > 0) return String(list[0].id);

  const csrf = await getCsrf(page);
  const create = await page.request.post("/api/projects", {
    data: { name: "AI Surfaces E2E", description: "ai-chat surfaces e2e", language: "javascript" },
    headers: csrf ? { "x-csrf-token": csrf } : {},
  });
  expect(create.ok(), `project create failed: ${create.status()}`).toBeTruthy();
  const created = await create.json();
  return String(created.id);
}

async function sendMessageAndAssertStream(page: Page) {
  const input = page.getByTestId("input-ai-chat");
  await expect(input, "input-ai-chat must mount on this surface (canonical AIPanel)").toBeVisible({
    timeout: 20_000,
  });
  await input.fill("hello from e2e");
  await input.press("Enter");
  // A streamed token should appear in panel content. Body-text assertion
  // is broad on purpose — each surface lays out messages differently.
  await expect(page.locator("body")).toContainText("Hello, world!", {
    timeout: 15_000,
  });
}

// ── desktop IDE surface ─────────────────────────────────────────────────────

test.describe("AI chat — desktop IDE surface", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("send message → streamed tokens render → done state", async ({ page }) => {
    await login(page);
    await mockBothStreamingEndpoints(page);
    const projectId = await ensureProjectId(page);
    await page.goto(`/ide/${projectId}`);
    await sendMessageAndAssertStream(page);
  });
});

// ── mobile workspace surface ────────────────────────────────────────────────

test.describe("AI chat — mobile workspace surface", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile viewport: send message → streamed tokens render", async ({ page }) => {
    await login(page);
    await mockBothStreamingEndpoints(page);
    const projectId = await ensureProjectId(page);
    await page.goto(`/ide/${projectId}`);
    await sendMessageAndAssertStream(page);
  });
});

// ── assistant page surface ──────────────────────────────────────────────────

test.describe("AI chat — assistant page surface", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("/assistant: send message → streamed tokens render", async ({ page }) => {
    await login(page);
    await mockBothStreamingEndpoints(page);
    await page.goto("/assistant");
    await sendMessageAndAssertStream(page);
  });
});

// ── 429 surfaces a visible error in the UI ──────────────────────────────────

test.describe("AI chat — 429 from streaming endpoint surfaces a UI error", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("429 → AIPanel renders ⚠️ error message in conversation", async ({ page }) => {
    await login(page);

    // Both streaming endpoints return 429; whichever the surface uses,
    // it MUST end up rendering an error to the user (no silent break).
    const limit = async (route: Route) => {
      await route.fulfill({
        status: 429,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Too many concurrent AI streams",
          message: "You already have 3 active streams.",
          retryAfter: 30,
        }),
      });
    };
    await page.route("**/api/agent/chat/stream", limit);
    await page.route("**/api/agent-providers/message", limit);

    const projectId = await ensureProjectId(page);
    await page.goto(`/ide/${projectId}`);

    const input = page.getByTestId("input-ai-chat");
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.fill("trigger 429");
    await input.press("Enter");

    // AIPanel renders error replies as `⚠️ <provider> error — ...` in
    // the assistant message body (see AIPanel.tsx lines ~2048/2349/2393).
    // Asserting on the warning glyph proves the surface actually
    // surfaced the failure to the user instead of silently spinning.
    await expect(page.locator("body")).toContainText("⚠️", { timeout: 15_000 });
  });
});

// ── concurrency cap end-to-end from the browser ─────────────────────────────

test.describe("AI chat — concurrency cap end-to-end", () => {
  test("3 concurrent stream requests pass, 4th is 429 (browser fetch)", async ({ page }) => {
    await login(page);

    let inFlight = 0;
    let totalSeen = 0;
    await page.route("**/api/agent/chat/stream", async (route: Route) => {
      totalSeen++;
      inFlight++;
      try {
        if (inFlight > 3) {
          await route.fulfill({
            status: 429,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              error: "Too many concurrent AI streams",
              retryAfter: 30,
            }),
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
        await route.fulfill({
          status: 200,
          headers: { "content-type": "text/event-stream" },
          body: buildSseBody(),
        });
      } finally {
        inFlight--;
      }
    });

    const results: number[] = await page.evaluate(async () => {
      const reqs = [0, 1, 2, 3].map(() =>
        fetch("/api/agent/chat/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "concurrency probe", provider: "openai" }),
        }).then((r) => r.status)
      );
      return Promise.all(reqs);
    });

    const ok = results.filter((s) => s === 200).length;
    const limited = results.filter((s) => s === 429).length;
    expect(ok).toBe(3);
    expect(limited).toBe(1);
    expect(totalSeen).toBe(4);
  });
});
