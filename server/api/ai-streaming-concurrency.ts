/**
 * Per-user concurrency cap for AI streaming endpoints.
 *
 * Prevents a single user from holding unlimited SSE connections open, which
 * would exhaust provider rate limits and drive up costs. The Map is
 * process-scoped; for multi-process deployments use Redis instead, but this
 * protects the common single-process case.
 *
 * The cap is configurable via the `AI_MAX_CONCURRENT_STREAMS` env var
 * (default 3). Non-numeric or non-positive values fall back to the default so
 * a misconfiguration cannot silently disable the cap.
 *
 * Extracted from `ai-streaming.ts` so it can be unit-tested without spinning
 * up the full Express app, AI providers, RAG engine, etc.
 */

const DEFAULT_MAX_CONCURRENT_STREAMS_PER_USER = 3;

export const MAX_CONCURRENT_STREAMS_PER_USER: number = (() => {
  const raw = process.env.AI_MAX_CONCURRENT_STREAMS?.trim();
  if (!raw) return DEFAULT_MAX_CONCURRENT_STREAMS_PER_USER;
  // Strict numeric-only — reject things like "3abc" that parseInt would accept.
  if (!/^\d+$/.test(raw)) return DEFAULT_MAX_CONCURRENT_STREAMS_PER_USER;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_CONCURRENT_STREAMS_PER_USER;
  }
  return parsed;
})();

const activeStreamsByUser = new Map<string | number, number>();

export function acquireStreamSlot(userId: string | number): boolean {
  const current = activeStreamsByUser.get(userId) ?? 0;
  if (current >= MAX_CONCURRENT_STREAMS_PER_USER) return false;
  activeStreamsByUser.set(userId, current + 1);
  return true;
}

export function releaseStreamSlot(userId: string | number): void {
  const current = activeStreamsByUser.get(userId) ?? 0;
  const next = Math.max(0, current - 1);
  if (next === 0) activeStreamsByUser.delete(userId);
  else activeStreamsByUser.set(userId, next);
}

export function getActiveStreamCount(userId: string | number): number {
  return activeStreamsByUser.get(userId) ?? 0;
}

/** Test-only helper. Resets all counters. */
export function __resetStreamSlotsForTests(): void {
  activeStreamsByUser.clear();
}
