import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, Clock, Cpu, RefreshCw, Shield, Zap } from 'lucide-react';

interface ProviderBreakdown {
  provider: string;
  total: number;
  errors: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  tokensInput: number;
  tokensOutput: number;
}

interface ModelBreakdown {
  model: string;
  total: number;
  tokensInput: number;
  tokensOutput: number;
}

interface RecentError {
  timestamp: string;
  request_id: string;
  user_id: string | number | null;
  provider: string | null;
  model: string | null;
  error_code: string | null;
  is_retryable: boolean | null;
  latency_ms?: number;
}

interface AiMetricsSnapshot {
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
  recentErrors: RecentError[];
  bufferSize: number;
  bufferCapacity: number;
}

const WINDOW_OPTIONS = [
  { label: 'Last 5 min', value: 5 },
  { label: 'Last 15 min', value: 15 },
  { label: 'Last 1 hour', value: 60 },
  { label: 'Last 6 hours', value: 360 },
  { label: 'Last 24 hours', value: 1440 },
];

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: any;
  tone?: 'default' | 'warning' | 'critical' | 'success';
  testId: string;
}) {
  const toneClass =
    tone === 'critical'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-foreground';

  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-semibold ${toneClass}`} data-testid={`${testId}-value`}>
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function AIMetricsDashboard() {
  const [windowMinutes, setWindowMinutes] = useState<number>(15);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = !!(user as any)?.isAdmin;

  const { data, isLoading, error, refetch, isFetching } = useQuery<AiMetricsSnapshot>({
    queryKey: ['/api/admin/ai-metrics', windowMinutes],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/admin/ai-metrics?windowMinutes=${windowMinutes}`);
      return r.json();
    },
    refetchInterval: autoRefresh ? 10_000 : false,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center" data-testid="text-admin-denied">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <Button onClick={() => setLocation('/dashboard')} data-testid="button-go-dashboard">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const errorRate = data?.totals.errorRate ?? 0;
  const errorTone = errorRate > 0.1 ? 'critical' : errorRate > 0.02 ? 'warning' : 'success';
  const capHits = data?.totals.concurrencyCapHits ?? 0;
  const capTone = capHits > 50 ? 'critical' : capHits > 10 ? 'warning' : 'default';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-ai-metrics-dashboard">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-ai-metrics-title">
            AI Stream Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time aggregation of per-turn observability events from the AI streaming endpoint.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {WINDOW_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={windowMinutes === opt.value ? 'default' : 'outline'}
              onClick={() => setWindowMinutes(opt.value)}
              data-testid={`button-window-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(v => !v)}
            data-testid="button-toggle-autorefresh"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh-ai-metrics">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/40">
          <CardContent className="pt-6 text-sm text-red-600 dark:text-red-400" data-testid="text-ai-metrics-error">
            Failed to load AI metrics: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading && !data && (
        <div className="text-sm text-muted-foreground" data-testid="text-ai-metrics-loading">
          Loading metrics…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              testId="metric-total-turns"
              label="Turns"
              value={formatNumber(data.totals.turns)}
              hint={`${formatNumber(data.totals.successful)} ok · ${formatNumber(data.totals.failed)} failed`}
              icon={Activity}
            />
            <MetricCard
              testId="metric-error-rate"
              label="Error rate"
              value={formatPercent(data.totals.errorRate)}
              hint={`${formatNumber(data.totals.failed)} failed turns`}
              icon={AlertTriangle}
              tone={errorTone}
            />
            <MetricCard
              testId="metric-p95-latency"
              label="p95 latency"
              value={`${formatNumber(data.latency.p95Ms)} ms`}
              hint={`p50 ${formatNumber(data.latency.p50Ms)} · p99 ${formatNumber(data.latency.p99Ms)} ms`}
              icon={Clock}
              tone={data.latency.p95Ms > 30_000 ? 'critical' : data.latency.p95Ms > 10_000 ? 'warning' : 'default'}
            />
            <MetricCard
              testId="metric-concurrency-cap"
              label="Concurrency cap hits"
              value={formatNumber(capHits)}
              hint="Requests rejected with HTTP 429"
              icon={Zap}
              tone={capTone}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              testId="metric-tokens-input"
              label="Tokens in"
              value={formatNumber(data.totals.tokensInput)}
              icon={Cpu}
            />
            <MetricCard
              testId="metric-tokens-output"
              label="Tokens out"
              value={formatNumber(data.totals.tokensOutput)}
              icon={Cpu}
            />
            <MetricCard
              testId="metric-tokens-total"
              label="Tokens total"
              value={formatNumber(data.totals.tokensTotal)}
              icon={Cpu}
            />
          </div>

          <Card data-testid="card-provider-breakdown">
            <CardHeader>
              <CardTitle>Per-provider breakdown</CardTitle>
              <CardDescription>
                Last {data.windowMinutes} min · generated {new Date(data.generatedAt).toLocaleTimeString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.providers.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="text-no-providers">
                  No turns recorded in this window.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b text-muted-foreground">
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4 text-right">Turns</th>
                        <th className="py-2 pr-4 text-right">Errors</th>
                        <th className="py-2 pr-4 text-right">Error rate</th>
                        <th className="py-2 pr-4 text-right">p50 ms</th>
                        <th className="py-2 pr-4 text-right">p95 ms</th>
                        <th className="py-2 pr-4 text-right">Tokens in</th>
                        <th className="py-2 pr-4 text-right">Tokens out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.providers.map(p => (
                        <tr key={p.provider} className="border-b last:border-0" data-testid={`row-provider-${p.provider}`}>
                          <td className="py-2 pr-4 font-medium">{p.provider}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(p.total)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(p.errors)}</td>
                          <td className="py-2 pr-4 text-right">
                            <span className={p.errorRate > 0.1 ? 'text-red-600 dark:text-red-400' : p.errorRate > 0.02 ? 'text-amber-600 dark:text-amber-400' : ''}>
                              {formatPercent(p.errorRate)}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right">{formatNumber(p.p50LatencyMs)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(p.p95LatencyMs)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(p.tokensInput)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(p.tokensOutput)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-top-models">
            <CardHeader>
              <CardTitle>Top models by turn count</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topModels.length === 0 ? (
                <div className="text-sm text-muted-foreground">No model usage recorded.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b text-muted-foreground">
                        <th className="py-2 pr-4">Model</th>
                        <th className="py-2 pr-4 text-right">Turns</th>
                        <th className="py-2 pr-4 text-right">Tokens in</th>
                        <th className="py-2 pr-4 text-right">Tokens out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topModels.map(m => (
                        <tr key={m.model} className="border-b last:border-0" data-testid={`row-model-${m.model}`}>
                          <td className="py-2 pr-4 font-medium">{m.model}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(m.total)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(m.tokensInput)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(m.tokensOutput)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-errors">
            <CardHeader>
              <CardTitle>Recent errors</CardTitle>
              <CardDescription>Most recent 10 failed turns in this window.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentErrors.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="text-no-errors">
                  No errors in this window.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.recentErrors.map(err => (
                    <div
                      key={err.request_id}
                      className="flex items-start justify-between gap-3 text-sm border rounded-md px-3 py-2"
                      data-testid={`row-error-${err.request_id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{err.provider ?? 'unknown'}</Badge>
                          <span className="text-muted-foreground">{err.model ?? '—'}</span>
                          {err.error_code && <Badge variant="destructive">{err.error_code}</Badge>}
                          {err.is_retryable && <Badge variant="secondary">retryable</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(err.timestamp).toLocaleString()} · user {String(err.user_id ?? '—')} ·{' '}
                          req {err.request_id}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {err.latency_ms ? `${formatNumber(err.latency_ms)} ms` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground" data-testid="text-buffer-status">
            Buffer: {formatNumber(data.bufferSize)} / {formatNumber(data.bufferCapacity)} events retained in memory.
          </div>
        </>
      )}
    </div>
  );
}
