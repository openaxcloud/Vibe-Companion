/**
 * Agent Metrics Dashboard Component
 * Aggregated metrics with charts and KPIs
 * Phase 2 - Agent Activity Dashboard
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, Clock, Cpu, DollarSign, FileCode, 
  AlertTriangle, CheckCircle2, TrendingUp, BarChart3, Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { MetricsDashboardResponse } from '@shared/types/agent-grid.types';

interface AgentMetricsDashboardProps {
  projectId?: number;
  className?: string;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'default'
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: typeof Activity;
  trend?: { value: number; positive: boolean };
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const colorClasses = {
    default: 'text-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[13px] font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", colorClasses[color])} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", colorClasses[color])}>
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
        {trend && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-[11px]",
            trend.positive ? "text-emerald-600" : "text-red-600"
          )}>
            <TrendingUp className={cn("h-3 w-3", !trend.positive && "rotate-180")} />
            {trend.value}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function AgentMetricsDashboard({ projectId, className }: AgentMetricsDashboardProps) {
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) {
      params.set('projectId', String(projectId));
    }
    params.set('granularity', 'day');
    return params.toString();
  }, [projectId]);

  const { data, isLoading, error } = useQuery<MetricsDashboardResponse>({
    queryKey: ['/api/agent-grid/metrics', projectId ?? 'all', queryParams],
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-muted-foreground", className)}>
        Failed to load metrics
      </div>
    );
  }

  const { sessions, actions, files, conversations } = data.metrics;

  const successRate = actions.totalActions > 0 
    ? ((actions.actionsByStatus.completed || 0) / actions.totalActions * 100).toFixed(1)
    : '0';

  return (
    <div className={cn("space-y-6", className)} data-testid="agent-metrics-dashboard">
      {/* Session Metrics */}
      <div>
        <h3 className="text-[13px] font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Session Overview
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Sessions"
            value={sessions.totalSessions}
            subtitle={`${sessions.activeSessions} active`}
            icon={Activity}
            color="info"
          />
          <MetricCard
            title="Avg Duration"
            value={formatDuration(sessions.avgSessionDuration)}
            subtitle="per session"
            icon={Clock}
          />
          <MetricCard
            title="Avg Tokens"
            value={formatNumber(sessions.avgTokensPerSession)}
            subtitle="per session"
            icon={Cpu}
          />
          <MetricCard
            title="Total Cost"
            value={`$${sessions.totalCost.toFixed(2)}`}
            subtitle="all sessions"
            icon={DollarSign}
            color={sessions.totalCost > 100 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* Action Metrics */}
      <div>
        <h3 className="text-[13px] font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Action Statistics
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Actions"
            value={actions.totalActions}
            icon={Activity}
          />
          <MetricCard
            title="Success Rate"
            value={`${successRate}%`}
            subtitle={`${actions.actionsByStatus.completed || 0} completed`}
            icon={CheckCircle2}
            color={parseFloat(successRate) > 90 ? 'success' : parseFloat(successRate) > 70 ? 'warning' : 'error'}
          />
          <MetricCard
            title="Auto-Approval"
            value={`${actions.autoApprovalRate.toFixed(1)}%`}
            subtitle="of all actions"
            icon={CheckCircle2}
            color="info"
          />
          <MetricCard
            title="Avg Risk Score"
            value={actions.avgRiskScore.toFixed(0)}
            subtitle="out of 100"
            icon={AlertTriangle}
            color={actions.avgRiskScore > 50 ? 'warning' : 'success'}
          />
        </div>

        {/* Action Types Breakdown */}
        <Card className="mt-4">
          <CardHeader className="py-3">
            <CardTitle className="text-[13px]">Actions by Type</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-2">
              {Object.entries(actions.actionsByType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-24 truncate">
                      {type.replace('_', ' ')}
                    </span>
                    <Progress 
                      value={(count / actions.totalActions) * 100} 
                      className="flex-1 h-2"
                    />
                    <span className="text-[11px] font-medium w-12 text-right">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* File Metrics */}
      <div>
        <h3 className="text-[13px] font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          File Operations
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Operations"
            value={files.totalFileOperations}
            icon={FileCode}
          />
          <MetricCard
            title="Files Created"
            value={files.filesCreated}
            icon={FileCode}
            color="success"
          />
          <MetricCard
            title="Files Modified"
            value={files.filesModified}
            icon={FileCode}
            color="info"
          />
          <MetricCard
            title="Lines Changed"
            value={formatNumber(files.totalLinesAdded + files.totalLinesRemoved)}
            subtitle={`+${formatNumber(files.totalLinesAdded)} / -${formatNumber(files.totalLinesRemoved)}`}
            icon={FileCode}
          />
        </div>

        {/* Top Languages */}
        {files.topLanguages.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="py-3">
              <CardTitle className="text-[13px]">Top Languages</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-2">
                {files.topLanguages.map(({ language, count }) => (
                  <Badge key={language} variant="secondary" className="text-[11px]">
                    {language}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Conversation Metrics */}
      <div>
        <h3 className="text-[13px] font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          Conversation Stats
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Conversations"
            value={conversations.totalConversations}
            icon={Activity}
          />
          <MetricCard
            title="Total Messages"
            value={conversations.totalMessages}
            subtitle={`${conversations.avgMessagesPerConversation.toFixed(1)} avg/conv`}
            icon={Activity}
          />
          <MetricCard
            title="Tokens Used"
            value={formatNumber(conversations.totalTokensUsed)}
            icon={Cpu}
          />
          <MetricCard
            title="AI Cost"
            value={`$${conversations.totalCost.toFixed(2)}`}
            icon={DollarSign}
          />
        </div>

        {/* Top Models */}
        {conversations.topModels.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="py-3">
              <CardTitle className="text-[13px]">Top Models</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-2">
                {conversations.topModels.map(({ model, count, tokens }) => (
                  <div key={model} className="flex items-center justify-between text-[13px]">
                    <span className="font-mono text-[11px]">{model}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{count} msgs</span>
                      <span className="font-medium">{formatNumber(tokens)} tokens</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AgentMetricsDashboard;
