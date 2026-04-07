import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Database,
  Brain,
  Network,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileCode,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search
} from 'lucide-react';

interface RAGStats {
  embeddingsCount: number;
  nodesCount: number;
  edgesCount: number;
  conversationsCount: number;
  lastUpdated: string | null;
  isAvailable: boolean;
  providers: {
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
  };
}

interface RAGContext {
  id: string;
  type: string;
  content: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
  connections: number;
}

interface RAGSessionConfig {
  enabled: boolean;
  mode: 'auto' | 'manual' | 'hybrid';
  retrievalDepth: number;
  includeConversationHistory: boolean;
  maxContextTokens: number;
}

interface RAGToggleProps {
  sessionId?: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  compact?: boolean;
  className?: string;
}

interface RAGStatusBadgeProps {
  isAvailable: boolean;
  enabled: boolean;
  className?: string;
}

interface RAGStatsDisplayProps {
  variant?: 'inline' | 'card' | 'compact';
  className?: string;
}

interface RetrievedContextPanelProps {
  sessionId: string;
  query?: string;
  className?: string;
  maxHeight?: string;
}

export function useRAGStats() {
  return useQuery<RAGStats>({
    queryKey: ['/api/rag/stats'],
    staleTime: 30000,
    retry: 1,
  });
}

export function useRAGSessionConfig(sessionId?: string) {
  return useQuery<{ sessionId: string; config: RAGSessionConfig }>({
    queryKey: ['/api/rag/session-config', sessionId],
    enabled: !!sessionId,
    staleTime: 10000,
  });
}

export function useRAGContext(sessionId?: string, query?: string) {
  const queryParams = query ? `?query=${encodeURIComponent(query)}` : '';
  return useQuery<{ sessionId: string; contexts: RAGContext[]; totalCount: number; retrievedAt: string }>({
    queryKey: ['/api/rag/context', sessionId, query],
    enabled: !!sessionId,
    staleTime: 5000,
  });
}

export function RAGStatusBadge({ isAvailable, enabled, className }: RAGStatusBadgeProps) {
  if (!isAvailable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn("gap-1 text-muted-foreground border-muted", className)}
              data-testid="badge-rag-unavailable"
            >
              <AlertCircle className="h-3 w-3" />
              RAG N/A
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>RAG requires OpenAI or Anthropic API key</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={enabled ? "default" : "secondary"} 
            className={cn(
              "gap-1 transition-colors",
              enabled ? "bg-orange-500 hover:bg-orange-600 text-white" : "",
              className
            )}
            data-testid={`badge-rag-${enabled ? 'enabled' : 'disabled'}`}
          >
            <Brain className="h-3 w-3" />
            RAG {enabled ? 'On' : 'Off'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{enabled ? 'Knowledge retrieval active' : 'Click to enable RAG'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RAGToggle({ sessionId, enabled = true, onToggle, compact = false, className }: RAGToggleProps) {
  const { data: stats, isLoading: statsLoading } = useRAGStats();
  const { data: configData } = useRAGSessionConfig(sessionId);

  const toggleMutation = useMutation({
    mutationFn: async (newEnabled: boolean) => {
      if (!sessionId) return;
      return apiRequest('POST', '/api/rag/session-config', {
        sessionId,
        config: { enabled: newEnabled }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag/session-config', sessionId] });
    }
  });

  const isEnabled = configData?.config?.enabled ?? enabled;
  const isAvailable = stats?.isAvailable ?? false;

  const handleToggle = (checked: boolean) => {
    onToggle?.(checked);
    if (sessionId) {
      toggleMutation.mutate(checked);
    }
  };

  if (statsLoading) {
    return <Skeleton className={cn("h-8 w-24", className)} />;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)} data-testid="rag-toggle-compact">
        <RAGStatusBadge isAvailable={isAvailable} enabled={isEnabled} />
        {isAvailable && (
          <Switch
            id="rag-toggle"
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={!isAvailable || toggleMutation.isPending}
            data-testid="switch-rag-toggle"
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4 p-3 rounded-lg border bg-card", className)} data-testid="rag-toggle-full">
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center",
          isEnabled && isAvailable ? "bg-orange-950" : "bg-surface-solid"
        )}>
          <Brain className={cn(
            "h-5 w-5",
            isEnabled && isAvailable ? "text-orange-500" : "text-muted-foreground"
          )} />
        </div>
        <div>
          <Label htmlFor="rag-toggle" className="font-medium text-[13px]">
            Knowledge Retrieval (RAG)
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {isAvailable ? 'Enhance responses with project context' : 'Configure API key to enable'}
          </p>
        </div>
      </div>
      <Switch
        id="rag-toggle"
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={!isAvailable || toggleMutation.isPending}
        data-testid="switch-rag-toggle"
      />
    </div>
  );
}

export function RAGStatsDisplay({ variant = 'inline', className }: RAGStatsDisplayProps) {
  const { data: stats, isLoading, refetch, isRefetching } = useRAGStats();

  if (isLoading) {
    return <Skeleton className={cn("h-6 w-32", className)} />;
  }

  if (!stats?.isAvailable) {
    return null;
  }

  const StatItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon className="h-3 w-3" />
            <span className="font-medium">{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-3", className)} data-testid="rag-stats-compact">
        <StatItem icon={Database} label="Embeddings" value={stats.embeddingsCount} />
        <StatItem icon={Network} label="Knowledge Nodes" value={stats.nodesCount} />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn("", className)} data-testid="rag-stats-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-500" />
              Knowledge Graph Stats
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-7 w-7 p-0"
              data-testid="button-refresh-stats"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-[15px] font-semibold">{stats.embeddingsCount}</p>
              <p className="text-[11px] text-muted-foreground">Embeddings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-[15px] font-semibold">{stats.nodesCount}</p>
              <p className="text-[11px] text-muted-foreground">Nodes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-[15px] font-semibold">{stats.edgesCount}</p>
              <p className="text-[11px] text-muted-foreground">Edges</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-[15px] font-semibold">{stats.conversationsCount}</p>
              <p className="text-[11px] text-muted-foreground">Conversations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("flex items-center gap-4", className)} data-testid="rag-stats-inline">
      <StatItem icon={Database} label="Embeddings" value={stats.embeddingsCount} />
      <StatItem icon={Network} label="Knowledge Nodes" value={stats.nodesCount} />
      <StatItem icon={Link2} label="Connections" value={stats.edgesCount} />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => refetch()}
        disabled={isRefetching}
        className="h-6 w-6 p-0"
        data-testid="button-refresh-stats"
      >
        <RefreshCw className={cn("h-3 w-3", isRefetching && "animate-spin")} />
      </Button>
    </div>
  );
}

export function RetrievedContextPanel({ sessionId, query, className, maxHeight = '200px' }: RetrievedContextPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data, isLoading, refetch, isRefetching } = useRAGContext(sessionId, query);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'concept': return <Brain className="h-3.5 w-3.5 text-purple-500" />;
      case 'entity': return <Network className="h-3.5 w-3.5 text-blue-500" />;
      case 'fact': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'idea': return <Sparkles className="h-3.5 w-3.5 text-orange-500" />;
      default: return <FileCode className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'concept': return 'border-purple-500 bg-purple-950';
      case 'entity': return 'border-blue-500 bg-blue-950';
      case 'fact': return 'border-green-500 bg-green-950';
      case 'idea': return 'border-orange-500 bg-orange-950';
      default: return 'border-border bg-surface-solid';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-3 py-2 h-auto"
          data-testid="button-toggle-context-panel"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-[13px]">Retrieved Context</span>
            <Badge variant="secondary" className="text-[11px]">
              {data?.totalCount ?? 0}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isRefetching && <Loader2 className="h-3 w-3 animate-spin" />}
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !data?.contexts?.length ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="text-no-context">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-[13px]">No context retrieved yet</p>
              <p className="text-[11px] mt-1">Start a conversation to build context</p>
            </div>
          ) : (
            <ScrollArea className="w-full" style={{ maxHeight }}>
              <div className="space-y-2">
                {data.contexts.map((ctx, index) => (
                  <div
                    key={ctx.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors hover:bg-surface-hover-solid",
                      getTypeColor(ctx.type)
                    )}
                    data-testid={`context-item-${index}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(ctx.type)}
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {ctx.type}
                        </Badge>
                        {ctx.connections > 0 && (
                          <Badge variant="secondary" className="text-[11px]">
                            <Link2 className="h-2.5 w-2.5 mr-1" />
                            {ctx.connections}
                          </Badge>
                        )}
                      </div>
                      <Badge 
                        variant={ctx.relevanceScore > 0.7 ? "default" : "secondary"}
                        className={cn(
                          "text-[11px]",
                          ctx.relevanceScore > 0.7 && "bg-green-950 text-green-600 border-green-500"
                        )}
                      >
                        {Math.round(ctx.relevanceScore * 100)}%
                      </Badge>
                    </div>
                    <p className="text-[13px] text-foreground/90 line-clamp-3">
                      {ctx.content}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <p className="text-[11px] text-muted-foreground">
              {data?.retrievedAt ? `Retrieved ${new Date(data.retrievedAt).toLocaleTimeString()}` : 'Not retrieved'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-7 text-[11px]"
              data-testid="button-refresh-context"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1.5", isRefetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface RAGControlsPanelProps {
  sessionId?: string;
  variant?: 'full' | 'compact' | 'mobile';
  className?: string;
  onRAGToggle?: (enabled: boolean) => void;
}

export function RAGControlsPanel({ sessionId, variant = 'full', className, onRAGToggle }: RAGControlsPanelProps) {
  const [ragEnabled, setRagEnabled] = useState(true);

  const handleToggle = (enabled: boolean) => {
    setRagEnabled(enabled);
    onRAGToggle?.(enabled);
  };

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-3", className)} data-testid="rag-controls-compact">
        <RAGToggle 
          sessionId={sessionId} 
          enabled={ragEnabled} 
          onToggle={handleToggle} 
          compact 
        />
        <RAGStatsDisplay variant="compact" />
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className={cn("space-y-3 p-3 bg-card rounded-lg border", className)} data-testid="rag-controls-mobile">
        <RAGToggle 
          sessionId={sessionId} 
          enabled={ragEnabled} 
          onToggle={handleToggle} 
        />
        {sessionId && ragEnabled && (
          <RetrievedContextPanel sessionId={sessionId} maxHeight="150px" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="rag-controls-full">
      <RAGToggle 
        sessionId={sessionId} 
        enabled={ragEnabled} 
        onToggle={handleToggle} 
      />
      <RAGStatsDisplay variant="card" />
      {sessionId && ragEnabled && (
        <RetrievedContextPanel sessionId={sessionId} />
      )}
    </div>
  );
}

export { type RAGStats, type RAGContext, type RAGSessionConfig };
