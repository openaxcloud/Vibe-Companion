import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { FileText, Download, Search, Filter, AlertCircle, Info, AlertTriangle, Bug, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { LazyMotionDiv } from '@/lib/motion';
import { Badge } from '@/components/ui/badge';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  deploymentId?: string;
  buildId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

interface LogsViewerPanelProps {
  deploymentId?: string;
  buildId?: string;
  projectId?: string;
}

export function LogsViewerPanel({ deploymentId, buildId, projectId }: LogsViewerPanelProps) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/logs', { deploymentId, buildId, projectId, level, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (deploymentId) params.append('deploymentId', deploymentId);
      if (buildId) params.append('buildId', buildId);
      if (projectId) params.append('projectId', projectId);
      if (level !== 'all') params.append('level', level);
      if (search) params.append('search', search);
      
      const response = await fetch(`/api/logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false
  });

  const handleExport = async (format: 'json' | 'csv' | 'txt') => {
    try {
      const response = await fetch('/api/logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId,
          buildId,
          projectId,
          format,
          level: level !== 'all' ? level : undefined
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Logs exported as ${format.toUpperCase()}`
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      error: 'destructive',
      warn: 'default',
      info: 'secondary',
      debug: 'outline'
    };
    return <Badge variant={variants[level] || 'secondary'}>{level.toUpperCase()}</Badge>;
  };

  const logs = data?.logs || [];

  return (
    <div className="flex flex-col h-full bg-[var(--ecode-surface)]" data-testid="logs-viewer-panel">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="text-xs font-medium text-[var(--ecode-text-muted)] flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Logs
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('json')}
            className="h-6 px-2 text-[10px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-export-json"
          >
            <Download className="h-3 w-3 mr-1" />
            JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('csv')}
            className="h-6 px-2 text-[10px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-export-csv"
          >
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </div>
      </div>
      
      {/* Controls */}
      <div className="p-2.5 border-b border-[var(--ecode-border)] space-y-2">

        {/* Search and Filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-logs"
            />
          </div>
          <Select value={level} onValueChange={(v: any) => setLevel(v)}>
            <SelectTrigger className="w-32" data-testid="select-log-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-auto-refresh"
          >
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
        </div>

        {/* Stats */}
        {data && (
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span>Total: {data.pagination.total}</span>
            <span>Showing: {logs.length}</span>
          </div>
        )}
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-[13px]">No logs found</p>
          </div>
        ) : (
          <div className="p-2 space-y-1 font-mono text-[11px]" data-testid="logs-list">
            {logs.map((log: LogEntry, index: number) => (
              <LazyMotionDiv
                key={index}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
              >
                <Card className="p-3 hover:bg-accent transition-colors">
                  <div className="flex items-start gap-3">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getLevelBadge(log.level)}
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="break-words">{log.message}</p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Metadata
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </Card>
              </LazyMotionDiv>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
