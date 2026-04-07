import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, HardDrive, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceMetric } from '@shared/schema';

interface ReplitResourcesPanelProps {
  projectId: string;
  className?: string;
}

interface WebSocketMessage {
  type: 'initial' | 'metric_update' | 'error';
  metrics?: ResourceMetric[];
  latest?: ResourceMetric;
  metric?: ResourceMetric;
  message?: string;
}

export function ReplitResourcesPanel({ projectId, className }: ReplitResourcesPanelProps) {
  const [realtimeMetrics, setRealtimeMetrics] = useState<ResourceMetric[]>([]);
  const [latestMetric, setLatestMetric] = useState<ResourceMetric | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // Fetch initial metrics from REST API
  const { data: initialMetrics } = useQuery<ResourceMetric[]>({
    queryKey: ['/api/workspace/projects', projectId, 'resource-metrics'],
    enabled: !!projectId,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 10s to 30s
    refetchIntervalInBackground: false
  });

  // Fetch latest metrics
  const { data: initialLatest } = useQuery<ResourceMetric>({
    queryKey: ['/api/workspace/projects', projectId, 'resource-metrics', 'latest'],
    enabled: !!projectId,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  // Use realtime data if available, fallback to initial data
  const metrics = realtimeMetrics.length > 0 ? realtimeMetrics : (initialMetrics || []);
  const latest = latestMetric || initialLatest;

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!projectId) return;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/resources/ws?projectId=${projectId}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            switch (message.type) {
              case 'initial':
                if (message.metrics) setRealtimeMetrics(message.metrics);
                if (message.latest) setLatestMetric(message.latest);
                break;
              case 'metric_update':
                if (message.metric) {
                  setLatestMetric(message.metric);
                  setRealtimeMetrics(prev => [message.metric!, ...prev.slice(0, 49)]);
                }
                break;
              case 'error':
                console.error('[ResourcesPanel] Error:', message.message);
                break;
            }
          } catch (error) {
            console.error('[ResourcesPanel] Error parsing message:', error);
          }
        };

        ws.onerror = (error) => console.error('[ResourcesPanel] WebSocket error:', error);

        ws.onclose = () => {
          wsRef.current = null;
          
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
          const baseDelay = 1000;
          const maxDelay = 30000;
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay);
          const jitter = Math.random() * 1000; // Add 0-1s jitter
          
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => connectWebSocket(), delay + jitter);
        };
      } catch (error) {
        console.error('[ResourcesPanel] Error creating WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectId]);

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-status-critical';
    if (percent >= 70) return 'bg-status-warning/100';
    return 'bg-status-success';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className={cn('flex flex-col h-full bg-[var(--ecode-surface)]', className)} data-testid="resources-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[hsl(142,72%,42%)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Resources</span>
        </div>
        <span className={cn('text-[9px]', wsRef.current?.readyState === WebSocket.OPEN ? 'text-[hsl(142,72%,42%)]' : 'text-[var(--ecode-text-muted)]')}>
          {wsRef.current?.readyState === WebSocket.OPEN ? '● Live' : '○ Connecting'}
        </span>
      </div>

      {/* Current Metrics */}
      {latest && (
        <div className="p-4 space-y-4">
          {/* CPU */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <Cpu className="w-3 h-3" />
                <span>CPU</span>
              </div>
              <span>{latest.cpuUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-border rounded overflow-hidden">
              <div 
                className={cn('h-full transition-all', getUsageColor(latest.cpuUsage))}
                style={{ width: `${Math.min(latest.cpuUsage, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3" />
                <span>Memory</span>
              </div>
              <span>{latest.memoryUsage.toFixed(0)} / {latest.memoryLimit.toFixed(0)} MB</span>
            </div>
            <div className="w-full h-2 bg-border rounded overflow-hidden">
              <div 
                className={cn('h-full transition-all', getUsageColor((latest.memoryUsage / latest.memoryLimit) * 100))}
                style={{ width: `${Math.min((latest.memoryUsage / latest.memoryLimit) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Disk */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3 h-3" />
                <span>Disk</span>
              </div>
              <span>{latest.diskUsage.toFixed(0)} / {latest.diskLimit.toFixed(0)} MB</span>
            </div>
            <div className="w-full h-2 bg-border rounded overflow-hidden">
              <div 
                className={cn('h-full transition-all', getUsageColor((latest.diskUsage / latest.diskLimit) * 100))}
                style={{ width: `${Math.min((latest.diskUsage / latest.diskLimit) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Network */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <Network className="w-3 h-3" />
                <span>Network</span>
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>↓ {formatBytes(latest.networkRxBytes || 0)}</span>
              <span>↑ {formatBytes(latest.networkTxBytes || 0)}</span>
            </div>
          </div>

          {/* Active Connections */}
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border">
            <span className="text-muted-foreground">Active Connections</span>
            <span className="font-mono">{latest.activeConnections || 0}</span>
          </div>
        </div>
      )}

      {!latest && (
        <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
          No resource metrics available
        </div>
      )}
    </div>
  );
}
