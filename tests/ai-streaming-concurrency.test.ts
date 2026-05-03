/**
 * Concurrency cap tests for the AI streaming endpoint.
 *
 * Guards Task #181: "Concurrency cap: 3 simultaneous requests pass, 4th
 * returns 429" — protects shared `/api/agent/chat/stream` endpoint used by
 * the desktop IDE, mobile workspace, and assistant page.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import {
  MAX_CONCURRENT_STREAMS_PER_USER,
  acquireStreamSlot,
  releaseStreamSlot,
  getActiveStreamCount,
  __resetStreamSlotsForTests,
} from "../server/api/ai-streaming-concurrency";

beforeEach(() => __resetStreamSlotsForTests());
afterEach(() => __resetStreamSlotsForTests());

describe("ai-streaming concurrency cap (unit)", () => {
  it("allows up to MAX_CONCURRENT_STREAMS_PER_USER acquisitions", () => {
    for (let i = 0; i < MAX_CONCURRENT_STREAMS_PER_USER; i++) {
      expect(acquireStreamSlot("user-1")).toBe(true);
    }
    expect(getActiveStreamCount("user-1")).toBe(MAX_CONCURRENT_STREAMS_PER_USER);
  });

  it("rejects the (cap+1)-th acquisition", () => {
    for (let i = 0; i < MAX_CONCURRENT_STREAMS_PER_USER; i++) {
      acquireStreamSlot("user-1");
    }
    expect(acquireStreamSlot("user-1")).toBe(false);
  });

  it("releases a slot so a new request can succeed", () => {
    for (let i = 0; i < MAX_CONCURRENT_STREAMS_PER_USER; i++) {
      acquireStreamSlot("user-1");
    }
    expect(acquireStreamSlot("user-1")).toBe(false);
    releaseStreamSlot("user-1");
    expect(acquireStreamSlot("user-1")).toBe(true);
  });

  it("tracks slots independently per user", () => {
    for (let i = 0; i < MAX_CONCURRENT_STREAMS_PER_USER; i++) {
      acquireStreamSlot("user-1");
    }
    expect(acquireStreamSlot("user-1")).toBe(false);
    expect(acquireStreamSlot("user-2")).toBe(true);
  });

  it("clamps releases at zero (no negative counters)", () => {
    releaseStreamSlot("user-x");
    releaseStreamSlot("user-x");
    expect(getActiveStreamCount("user-x")).toBe(0);
    expect(acquireStreamSlot("user-x")).toBe(true);
  });
});

describe("ai-streaming concurrency cap (HTTP integration)", () => {
  // Build a minimal Express app that mirrors the cap behavior of
  // `/api/agent/chat/stream`: acquire slot → 429 if full, otherwise stream.
  // This validates the contract that all three IDE surfaces depend on
  // without booting the full ai-streaming router (which pulls in DB, RAG,
  // and live AI providers).
  function buildTestApp() {
    const app = express();
    app.use(express.json());

    const fakeAuth = (req: Request, _res: Response, next: NextFunction) => {
      (req as any).user = { id: req.header("x-test-user-id") || "user-1" };
      next();
    };

    app.post("/api/agent/chat/stream", fakeAuth, async (req, res) => {
      const userId = (req as any).user.id;
      if (!acquireStreamSlot(userId)) {
        return res.status(429).json({
          error: "Too many concurrent AI streams",
          retryAfter: 30,
        });
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.write('event: connected\ndata: {"status":"connected"}\n\n');
      res.write('event: token\ndata: {"text":"hello"}\n\n');
      res.write('event: token\ndata: {"text":" world"}\n\n');
      // Hold the stream open until aborted, so concurrent slots stay taken.
      const hold = req.header("x-hold-ms");
      const holdMs = hold ? parseInt(hold, 10) : 50;
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      res.write('event: done\ndata: {"totalTokens":2}\n\n');
      releaseStreamSlot(userId);
      res.end();
    });

    return app;
  }

  function startApp(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
    return new Promise((resolve) => {
      const srv = app.listen(0, () => {
        const port = (srv.address() as any).port;
        resolve({
          url: `http://127.0.0.1:${port}`,
          close: () =>
            new Promise<void>((r) => {
              srv.close(() => r());
            }),
        });
      });
    });
  }

  it("3 simultaneous requests succeed, 4th returns 429", async () => {
    const app = buildTestApp();
    const { url, close } = await startApp(app);
    try {
      // Fire 4 concurrent requests with a long hold so they actually overlap.
      const requests = [0, 1, 2, 3].map(() =>
        fetch(`${url}/api/agent/chat/stream`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-user-id": "user-cap",
            "x-hold-ms": "300",
          },
          body: JSON.stringify({ message: "hi" }),
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status).sort();
      // Three should be 200 (streaming), one should be 429 (rejected).
      expect(statuses.filter((s) => s === 200)).toHaveLength(3);
      expect(statuses.filter((s) => s === 429)).toHaveLength(1);

      const rejected = responses.find((r) => r.status === 429)!;
      const body = await rejected.json();
      expect(body.error).toMatch(/concurrent/i);

      // Drain the streaming responses so the server releases the slots.
      await Promise.all(
        responses
          .filter((r) => r.status === 200)
          .map((r) => r.text())
      );
    } finally {
      await close();
    }
  }, 15000);

  it("after slots are released, a new request succeeds", async () => {
    const app = buildTestApp();
    const { url, close } = await startApp(app);
    try {
      // Saturate the cap, then drain.
      const first = await Promise.all(
        [0, 1, 2].map(() =>
          fetch(`${url}/api/agent/chat/stream`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user-id": "user-recover",
              "x-hold-ms": "20",
            },
            body: JSON.stringify({ message: "hi" }),
          }).then((r) => r.text())
        )
      );
      expect(first).toHaveLength(3);

      // Now slots are free. A fourth request should succeed.
      const next = await fetch(`${url}/api/agent/chat/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-user-id": "user-recover",
          "x-hold-ms": "10",
        },
        body: JSON.stringify({ message: "hi again" }),
      });
      expect(next.status).toBe(200);
      await next.text();
    } finally {
      await close();
    }
  }, 15000);
});
