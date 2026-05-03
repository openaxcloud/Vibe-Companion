/**
 * AI Stream Metrics — In-memory circular buffer of per-turn observability
 * events emitted by the AI streaming endpoint.
 *
 * Lets the ops dashboard aggregate the last N minutes of activity (latency
 * percentiles, error rate, token consumption, per-provider breakdown,
 * concurrency cap hits) without parsing raw server logs.
 *
 * Process-scoped only. For multi-process deployments, replace with a shared
 * store (Redis, ClickHouse, Datadog) — but this protects the common
 * single-process case and is good enough for an internal ops surface.
 */

export type StreamEndReason = 'done' | 'error' | 'concurrency_cap';

export interface AiStreamEvent {
  timestamp: number;
  request_id: string;
  user_id?: string | number | null;
  project_id?: string | number | null;
  model?: string | null;
  provider?: string | null;
  tokens_input?: number;
  tokens_output?: number;
  latency_ms?: number;
  agent_mode?: string | null;
  tool_count?: number;
  stream_end_reason: StreamEndReason;
  error_code?: string | null;
  is_retryable?: boolean | null;
}

const MAX_BUFFER_SIZE = 5000;
const buffer: AiStreamEvent[] = [];

export function recordAiStreamEvent(event: Omit<AiStreamEvent, 'timestamp'> & { timestamp?: number }): void {
  const entry: AiStreamEvent = {
    timestamp: event.timestamp ?? Date.now(),
    request_id: event.request_id,
    user_id: event.user_id ?? null,
    project_id: event.project_id ?? null,
    model: event.model ?? null,
    provider: event.provider ?? null,
    tokens_input: event.tokens_input,
    tokens_output: event.tokens_output,
    latency_ms: event.latency_ms,
    agent_mode: event.agent_mode ?? null,
    tool_count: event.tool_count,
    stream_end_reason: event.stream_end_reason,
    error_code: event.error_code ?? null,
    is_retryable: event.is_retryable ?? null,
  };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
  }
}

export function getRawEvents(sinceMs: number): AiStreamEvent[] {
  const cutoff = Date.now() - sinceMs;
  // Buffer is append-only and roughly time-sorted; linear scan is fine at 5k cap.
  return buffer.filter(e => e.timestamp >= cutoff);
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

export interface ProviderBreakdown {
  provider: string;
  total: number;
  errors: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  tokensInput: number;
  tokensOutput: number;
}

export interface ModelBreakdown {
  model: string;
  total: number;
  tokensInput: number;
  tokensOutput: number;
}

export interface AiStreamMetricsSnapshot {
  windowMinutes: number;
  generatedAt: string;
  totals: {
    turns: number;
    successful: number;
    failed: number;
    concurrencyCapHits: number;
    errorRate: number;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    avgMs: number;
  };
  providers: ProviderBreakdown[];
  topModels: ModelBreakdown[];
  recentErrors: Array<{
    timestamp: string;
    request_id: string;
    user_id: string | number | null;
    provider: string | null;
    model: string | null;
    error_code: string | null;
    is_retryable: boolean | null;
    latency_ms: number | undefined;
  }>;
  bufferSize: number;
  bufferCapacity: number;
}

export function aggregateAiStreamMetrics(windowMinutes: number): AiStreamMetricsSnapshot {
  const windowMs = Math.max(1, windowMinutes) * 60 * 1000;
  const events = getRawEvents(windowMs);

  const succeeded = events.filter(e => e.stream_end_reason === 'done');
  const failed = events.filter(e => e.stream_end_reason === 'error');
  const capHits = events.filter(e => e.stream_end_reason === 'concurrency_cap');

  const turnEvents = events.filter(e => e.stream_end_reason !== 'concurrency_cap');
  const latencies = turnEvents
    .map(e => e.latency_ms)
    .filter((l): l is number => typeof l === 'number' && Number.isFinite(l))
    .sort((a, b) => a - b);

  const tokensInput = events.reduce((sum, e) => sum + (e.tokens_input ?? 0), 0);
  const tokensOutput = events.reduce((sum, e) => sum + (e.tokens_output ?? 0), 0);

  const byProvider = new Map<string, AiStreamEvent[]>();
  for (const e of events) {
    const key = e.provider || 'unknown';
    const arr = byProvider.get(key) ?? [];
    arr.push(e);
    byProvider.set(key, arr);
  }

  const providers: ProviderBreakdown[] = Array.from(byProvider.entries())
    .map(([provider, evs]) => {
      const errs = evs.filter(e => e.stream_end_reason === 'error').length;
      const turns = evs.filter(e => e.stream_end_reason !== 'concurrency_cap').length;
      const lats = evs
        .filter(e => e.stream_end_reason !== 'concurrency_cap')
        .map(e => e.latency_ms)
        .filter((l): l is number => typeof l === 'number')
        .sort((a, b) => a - b);
      return {
        provider,
        total: turns,
        errors: errs,
        errorRate: turns > 0 ? errs / turns : 0,
        p50LatencyMs: Math.round(percentile(lats, 50)),
        p95LatencyMs: Math.round(percentile(lats, 95)),
        tokensInput: evs.reduce((s, e) => s + (e.tokens_input ?? 0), 0),
        tokensOutput: evs.reduce((s, e) => s + (e.tokens_output ?? 0), 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  const byModel = new Map<string, ModelBreakdown>();
  for (const e of events) {
    if (!e.model) continue;
    const cur = byModel.get(e.model) ?? {
      model: e.model,
      total: 0,
      tokensInput: 0,
      tokensOutput: 0,
    };
    cur.total += 1;
    cur.tokensInput += e.tokens_input ?? 0;
    cur.tokensOutput += e.tokens_output ?? 0;
    byModel.set(e.model, cur);
  }
  const topModels = Array.from(byModel.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const recentErrors = failed
    .slice(-10)
    .reverse()
    .map(e => ({
      timestamp: new Date(e.timestamp).toISOString(),
      request_id: e.request_id,
      user_id: e.user_id ?? null,
      provider: e.provider ?? null,
      model: e.model ?? null,
      error_code: e.error_code ?? null,
      is_retryable: e.is_retryable ?? null,
      latency_ms: e.latency_ms,
    }));

  const totalTurns = succeeded.length + failed.length;
  const avgLatency = latencies.length > 0
    ? latencies.reduce((s, l) => s + l, 0) / latencies.length
    : 0;

  return {
    windowMinutes,
    generatedAt: new Date().toISOString(),
    totals: {
      turns: totalTurns,
      successful: succeeded.length,
      failed: failed.length,
      concurrencyCapHits: capHits.length,
      errorRate: totalTurns > 0 ? failed.length / totalTurns : 0,
      tokensInput,
      tokensOutput,
      tokensTotal: tokensInput + tokensOutput,
    },
    latency: {
      p50Ms: Math.round(percentile(latencies, 50)),
      p95Ms: Math.round(percentile(latencies, 95)),
      p99Ms: Math.round(percentile(latencies, 99)),
      maxMs: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      avgMs: Math.round(avgLatency),
    },
    providers,
    topModels,
    recentErrors,
    bufferSize: buffer.length,
    bufferCapacity: MAX_BUFFER_SIZE,
  };
}

/** Test/maintenance helper — wipe the buffer. */
export function _resetAiStreamMetrics(): void {
  buffer.length = 0;
}
