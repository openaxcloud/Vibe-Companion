/**
 * fetchWithRetry — unit tests with vi.fn() instead of a live server, since
 * we want deterministic control over status codes, network errors, and
 * timing without flake.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "../server/utils/fetch-with-retry";

const realFetch = global.fetch;

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.useRealTimers();
  });

  it("returns the response on a 2xx with no retries", async () => {
    const stub = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    global.fetch = stub as any;

    const res = await fetchWithRetry("https://example.test/ok", { retries: 3 });
    expect(res.status).toBe(200);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on 2nd attempt", async () => {
    const stub = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    global.fetch = stub as any;

    const res = await fetchWithRetry("https://example.test/flaky", {
      retries: 3,
      baseDelayMs: 1,
    });
    expect(res.status).toBe(200);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 honoring Retry-After header", async () => {
    const stub = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("too many", {
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    global.fetch = stub as any;

    const onRetry = vi.fn();
    const res = await fetchWithRetry("https://example.test/rl", {
      retries: 3,
      baseDelayMs: 1,
      onRetry,
    });
    expect(res.status).toBe(200);
    expect(stub).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429, delayMs: 1000 }),
    );
  });

  it("does NOT retry on 400 (client error)", async () => {
    const stub = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    global.fetch = stub as any;

    const res = await fetchWithRetry("https://example.test/400", { retries: 3 });
    expect(res.status).toBe(400);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("retries on network error (TypeError 'fetch failed')", async () => {
    const stub = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    global.fetch = stub as any;

    const res = await fetchWithRetry("https://example.test/net", {
      retries: 3,
      baseDelayMs: 1,
    });
    expect(res.status).toBe(200);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("gives up after `retries` attempts and throws the last error", async () => {
    const stub = vi.fn().mockResolvedValue(new Response("nope", { status: 502 }));
    global.fetch = stub as any;

    const res = await fetchWithRetry("https://example.test/dead", {
      retries: 2,
      baseDelayMs: 1,
    });
    // After exhausting retries on a retryable status, fetchWithRetry returns
    // the last response (callers can inspect res.status).
    expect(res.status).toBe(502);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("aborts the attempt after timeoutMs (real timers)", async () => {
    vi.useRealTimers();
    const stub = vi.fn().mockImplementation(
      (_input: any, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted by timeout")),
            { once: true },
          );
        }),
    );
    global.fetch = stub as any;

    await expect(
      fetchWithRetry("https://example.test/hang", {
        retries: 1,
        timeoutMs: 30,
        baseDelayMs: 1,
      }),
    ).rejects.toThrow(/abort/i);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("respects caller-supplied AbortSignal even mid-retry (real timers)", async () => {
    vi.useRealTimers();
    const ac = new AbortController();
    const stub = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockImplementation(
        (_input: any, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
            // Trigger the caller abort during the second attempt's wait
            setTimeout(() => ac.abort(), 5);
          }),
      );
    global.fetch = stub as any;

    await expect(
      fetchWithRetry("https://example.test/abort", {
        retries: 3,
        baseDelayMs: 1,
        signal: ac.signal,
      }),
    ).rejects.toThrow();
  });
});
