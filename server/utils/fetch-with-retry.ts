/**
 * fetch-with-retry — production wrapper around the global `fetch`.
 *
 * Adds three things every external HTTP call needs:
 *   1. Hard timeout via AbortController (so a hung remote can't park the
 *      Node event loop forever).
 *   2. Exponential backoff retry on transient failures: network errors,
 *      5xx responses, and 429 (rate limit). Honors `Retry-After` if the
 *      server sent one.
 *   3. Configurable retry count, base delay, jitter, and per-attempt
 *      timeout — the defaults are tuned for AI/search APIs (3 attempts,
 *      400ms base, 15s per-attempt timeout).
 *
 * Non-goals:
 *   - Provider SDKs (Anthropic, OpenAI, Stripe) bring their own retry
 *     logic that's already aware of provider-specific error codes; do
 *     NOT wrap them with this. Use this only for bare `fetch()` calls
 *     to APIs without an SDK (Tavily, Brave, custom internal services).
 *   - We don't retry GET/HEAD/POST/PUT/PATCH/DELETE differently. Callers
 *     that aren't idempotent should pass `retries: 0` or use
 *     `Idempotency-Key` headers per the upstream API.
 */

export interface FetchWithRetryOptions extends RequestInit {
  /** Total number of attempts (including the first). Default 3. */
  retries?: number;
  /** Base delay in ms; doubles each retry, plus jitter. Default 400. */
  baseDelayMs?: number;
  /** Per-attempt timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Status codes that should trigger a retry. Default 429 + 5xx. */
  retryOn?: number[];
  /** Optional caller-supplied AbortSignal — if it fires, no further retries. */
  signal?: AbortSignal;
  /** Hook for instrumentation (each retry call is one event). */
  onRetry?: (info: { attempt: number; error?: unknown; status?: number; delayMs: number; url: string }) => void;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_STATUS = [408, 429, 500, 502, 503, 504];

function isRetryable(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("network") || msg.includes("fetch failed")) return true;
  if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("enotfound")) return true;
  return false;
}

function computeDelay(attempt: number, baseDelayMs: number): number {
  const exp = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * baseDelayMs);
  return Math.min(exp + jitter, 10_000);
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  const date = Date.parse(headerValue);
  if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), 30_000));
  return null;
}

export async function fetchWithRetry(
  input: string | URL,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryOn = DEFAULT_RETRY_STATUS,
    signal: callerSignal,
    onRetry,
    ...init
  } = options;

  const url = typeof input === "string" ? input : input.toString();
  const totalAttempts = Math.max(1, retries);
  let lastError: unknown;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (callerSignal?.aborted) {
      throw new Error(`fetchWithRetry: aborted by caller before attempt ${attempt + 1}`);
    }

    const attemptController = new AbortController();
    const timeoutId = setTimeout(() => attemptController.abort(), timeoutMs);
    const onCallerAbort = () => attemptController.abort();
    callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

    try {
      const response = await fetch(input, { ...init, signal: attemptController.signal });
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", onCallerAbort);

      if (response.ok || !retryOn.includes(response.status) || attempt === totalAttempts - 1) {
        return response;
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = parseRetryAfter(retryAfterHeader);
      const delayMs = retryAfter ?? computeDelay(attempt, baseDelayMs);
      onRetry?.({ attempt: attempt + 1, status: response.status, delayMs, url });
      try {
        await response.body?.cancel();
      } catch {}
      await new Promise((r) => setTimeout(r, delayMs));
      lastError = new Error(`HTTP ${response.status} from ${url} (attempt ${attempt + 1}/${totalAttempts})`);
      continue;
    } catch (err) {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", onCallerAbort);
      lastError = err;
      if (callerSignal?.aborted) throw err;
      if (attempt === totalAttempts - 1 || !isRetryable(err)) throw err;
      const delayMs = computeDelay(attempt, baseDelayMs);
      onRetry?.({ attempt: attempt + 1, error: err, delayMs, url });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError ?? new Error(`fetchWithRetry: exhausted ${totalAttempts} attempts on ${url}`);
}
