/**
 * Per-user concurrency cap for AI streaming endpoints.
 *
 * Prevents a single user from holding unlimited SSE connections open, which
 * would exhaust provider rate limits and drive up costs. Cap = 3 concurrent
 * streams per user. The Map is process-scoped; for multi-process deployments
 * use Redis instead, but this protects the common single-process case.
 *
 * Extracted from `ai-streaming.ts` so it can be unit-tested without spinning
 * up the full Express app, AI providers, RAG engine, etc.
 */

export const MAX_CONCURRENT_STREAMS_PER_USER = 3;

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
