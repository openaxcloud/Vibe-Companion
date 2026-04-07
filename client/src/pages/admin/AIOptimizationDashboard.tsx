import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Activity,
  Cpu,
  DollarSign,
  Send,
  Settings
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { useState } from 'react';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  avgProcessingTime: number;
}

interface CircuitBreakerStatus {
  provider: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure: string | null;
  successCount: number;
  failureRate: number;
}

interface TokenUsageStats {
  totalTokens: number;
  totalCost: number;
  mcpExecutions: number;
  aiExecutions: number;
  tokensSaved: number;
  costSaved: number;
  savingsPercentage: number;
}

interface TaskClassificationStats {
  category: string;
  count: number;
  mcpExecutions: number;
  aiExecutions: number;
  avgTokensUsed: number;
  successRate: number;
}

interface DashboardData {
  queueStats: QueueStats;
  circuitBreakers: CircuitBreakerStatus[];
  tokenUsage: TokenUsageStats;
  taskClassifications: TaskClassificationStats[];
}

interface SlackConfig {
  configured: boolean;
  enabled: boolean;
  webhookUrl: string | null;
}

interface ProviderLatencyStats {
  provider: string;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
  tokensGenerated: number;
}

interface LatencyData {
  success: boolean;
  providers: ProviderLatencyStats[];
  fallbackRecommendation: string | null;
  timestamp: string;
}

interface PromptCacheMetrics {
  success: boolean;
  systemPromptCacheSize: number;
  responseCacheSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  estimatedTokensSaved: number;
  estimatedCostSaved: number;
  timestamp: string;
}

export default function AIOptimizationDashboard() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['/api/ai-optimization/dashboard'],
    refetchInterval: 30000
  });

  const { data: slackConfig, isLoading: isSlackLoading } = useQuery<SlackConfig>({
    queryKey: ['/api/slack-config'],
    refetchInterval: 60000
  });

  const { data: latencyData, isLoading: isLatencyLoading } = useQuery<LatencyData>({
    queryKey: ['/api/ai-optimization/latency/providers'],
    refetchInterval: 15000
  });

  const { data: cacheMetrics, isLoading: isCacheLoading } = useQuery<PromptCacheMetrics>({
    queryKey: ['/api/ai-optimization/prompt-cache/metrics'],
    refetchInterval: 30000
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async (url: string | null) => {
      return apiRequest('PUT', '/api/slack-config', { webhookUrl: url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/slack-config'] });
      toast({
        title: 'Success',
        description: 'Slack webhook URL updated successfully',
      });
      setWebhookUrl('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update webhook URL',
        variant: 'destructive',
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/slack-config/test');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Test alert sent to Slack successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test alert',
        variant: 'destructive',
      });
    },
  });

  const handleUpdateWebhook = () => {
    if (!webhookUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a webhook URL',
        variant: 'destructive',
      });
      return;
    }
    updateWebhookMutation.mutate(webhookUrl);
  };

  const handleRemoveWebhook = () => {
    updateWebhookMutation.mutate(null);
  };

  const handleTestWebhook = () => {
    testWebhookMutation.mutate(undefined);
  };

  const queueStatCards = [
    {
      title: 'Pending',
      value: data?.queueStats.pending || 0,
      icon: Clock,
      color: 'text-yellow-500',
      description: 'Awaiting processing'
    },
    {
      title: 'Processing',
      value: data?.queueStats.processing || 0,
      icon: Activity,
      color: 'text-blue-500',
      description: 'Currently running'
    },
    {
      title: 'Completed',
      value: data?.queueStats.completed || 0,
      icon: CheckCircle,
      color: 'text-green-500',
      description: 'Successfully processed'
    },
    {
      title: 'Failed',
      value: data?.queueStats.failed || 0,
      icon: XCircle,
      color: 'text-red-500',
      description: 'Processing errors'
    }
  ];

  const tokenStatCards = [
    {
      title: 'Total Tokens Used',
      value: data?.tokenUsage.totalTokens?.toLocaleString() || '0',
      icon: Cpu,
      color: 'text-purple-500',
      description: `$${data?.tokenUsage.totalCost?.toFixed(2) || '0.00'} cost`
    },
    {
      title: 'MCP Executions',
      value: data?.tokenUsage.mcpExecutions || 0,
      icon: Zap,
      color: 'text-cyan-500',
      description: 'Deterministic tasks'
    },
    {
      title: 'AI Executions',
      value: data?.tokenUsage.aiExecutions || 0,
      icon: Activity,
      color: 'text-orange-500',
      description: 'Creative tasks'
    },
    {
      title: 'Tokens Saved',
      value: data?.tokenUsage.tokensSaved?.toLocaleString() || '0',
      icon: TrendingDown,
      color: 'text-green-500',
      description: `$${data?.tokenUsage.costSaved?.toFixed(2) || '0.00'} (${data?.tokenUsage.savingsPercentage?.toFixed(1) || '0'}%)`
    }
  ];

  const getCircuitBreakerStateColor = (state: string) => {
    switch (state) {
      case 'closed': return 'text-green-500';
      case 'open': return 'text-red-500';
      case 'half-open': return 'text-yellow-500';
      default: return 'text-zinc-500';
    }
  };

  const getCircuitBreakerIcon = (state: string) => {
    switch (state) {
      case 'closed': return CheckCircle;
      case 'open': return XCircle;
      case 'half-open': return AlertTriangle;
      default: return Activity;
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2" data-testid="heading-page-title">AI Optimization</h1>
          <p className="text-[11px] sm:text-[13px] text-zinc-400" data-testid="text-page-description">Monitor queue, circuit breakers, and token usage</p>
        </div>

        {/* Queue Stats Section */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2" data-testid="heading-queue-stats">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            Queue Statistics
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-zinc-800 border-zinc-700">
                  <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2">
                    <div className="h-3 sm:h-4 bg-zinc-700 rounded w-16 sm:w-20 animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="h-6 sm:h-8 bg-zinc-700 rounded w-10 sm:w-12 mb-1 animate-pulse" />
                    <div className="h-2 sm:h-3 bg-zinc-700 rounded w-20 sm:w-24 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {queueStatCards.map((stat) => {
                const Icon = stat.icon;
                const testId = `card-queue-${stat.title.toLowerCase()}`;
                return (
                  <Card key={stat.title} className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid={testId}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                      <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">
                        {stat.title}
                      </CardTitle>
                      <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${stat.color}`} />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4 pt-0">
                      <div className="text-[15px] sm:text-2xl font-bold text-white" data-testid={`text-queue-${stat.title.toLowerCase()}`}>{stat.value}</div>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">{stat.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Token Usage Section */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2" data-testid="heading-token-usage">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            Token Usage & Savings
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-zinc-800 border-zinc-700">
                  <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2">
                    <div className="h-3 sm:h-4 bg-zinc-700 rounded w-20 sm:w-24 animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="h-6 sm:h-8 bg-zinc-700 rounded w-12 sm:w-16 mb-1 animate-pulse" />
                    <div className="h-2 sm:h-3 bg-zinc-700 rounded w-24 sm:w-32 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {tokenStatCards.map((stat) => {
                const Icon = stat.icon;
                const testIdKey = stat.title === 'Total Tokens Used' ? 'total' : 
                                  stat.title === 'MCP Executions' ? 'mcp' :
                                  stat.title === 'AI Executions' ? 'ai' : 'saved';
                const testId = `card-token-${testIdKey}`;
                return (
                  <Card key={stat.title} className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid={testId}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                      <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300 truncate pr-2">
                        {stat.title}
                      </CardTitle>
                      <Icon className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${stat.color}`} />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4 pt-0">
                      <div className="text-[15px] sm:text-2xl font-bold text-white" data-testid={`text-token-${testIdKey}`}>{stat.value}</div>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">{stat.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Circuit Breaker Status Section */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2" data-testid="heading-circuit-breaker">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
            Circuit Breaker Status
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="bg-zinc-800 border-zinc-700">
                  <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2">
                    <div className="h-3 sm:h-4 bg-zinc-700 rounded w-16 sm:w-20 animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="h-5 sm:h-6 bg-zinc-700 rounded w-12 sm:w-16 mb-2 animate-pulse" />
                    <div className="space-y-1 sm:space-y-2">
                      <div className="h-2 sm:h-3 bg-zinc-700 rounded w-full animate-pulse" />
                      <div className="h-2 sm:h-3 bg-zinc-700 rounded w-full animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {data?.circuitBreakers.map((breaker) => {
                const Icon = getCircuitBreakerIcon(breaker.state);
                const stateColor = getCircuitBreakerStateColor(breaker.state);
                const providerKey = breaker.provider.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return (
                  <Card key={breaker.provider} className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid={`card-circuit-${providerKey}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                      <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">
                        {breaker.provider.toUpperCase()}
                      </CardTitle>
                      <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${stateColor}`} />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4 pt-0">
                      <div className={`text-[13px] sm:text-[15px] font-bold ${stateColor} mb-1 sm:mb-2 uppercase`} data-testid={`text-circuit-${providerKey}-state`}>
                        {breaker.state}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1 text-[10px] sm:text-[11px] text-zinc-400">
                        <div className="flex justify-between">
                          <span>Failures:</span>
                          <span className="text-white" data-testid={`text-circuit-${providerKey}-failures`}>{breaker.failureCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Successes:</span>
                          <span className="text-white" data-testid={`text-circuit-${providerKey}-successes`}>{breaker.successCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fail Rate:</span>
                          <span className="text-white" data-testid={`text-circuit-${providerKey}-failure-rate`}>{(breaker.failureRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Task Classification Stats */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2" data-testid="heading-task-classification">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Task Classification Stats
          </h2>
          {isLoading ? (
            <Card className="bg-zinc-800 border-zinc-700">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-4 bg-zinc-700 rounded w-32 animate-pulse" />
                      <div className="h-4 bg-zinc-700 rounded w-24 animate-pulse" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-800 border-zinc-700">
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-task-classification">
                    <thead>
                      <tr className="border-b border-zinc-700">
                        <th className="text-left py-3 px-4 text-[13px] font-medium text-zinc-300">Category</th>
                        <th className="text-right py-3 px-4 text-[13px] font-medium text-zinc-300">Total</th>
                        <th className="text-right py-3 px-4 text-[13px] font-medium text-zinc-300">MCP</th>
                        <th className="text-right py-3 px-4 text-[13px] font-medium text-zinc-300">AI</th>
                        <th className="text-right py-3 px-4 text-[13px] font-medium text-zinc-300">Avg Tokens</th>
                        <th className="text-right py-3 px-4 text-[13px] font-medium text-zinc-300">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.taskClassifications.map((task, index) => {
                        const categoryKey = task.category.toLowerCase().replace(/\s+/g, '-');
                        return (
                          <tr key={index} className="border-b border-zinc-700/50 hover:bg-zinc-700/20 transition-colors" data-testid={`row-task-${categoryKey}`}>
                            <td className="py-3 px-4 text-[13px] text-white font-medium">{task.category}</td>
                            <td className="text-right py-3 px-4 text-[13px] text-zinc-300" data-testid={`text-task-${categoryKey}-count`}>{task.count}</td>
                            <td className="text-right py-3 px-4 text-[13px] text-cyan-400" data-testid={`text-task-${categoryKey}-mcp`}>{task.mcpExecutions}</td>
                            <td className="text-right py-3 px-4 text-[13px] text-orange-400" data-testid={`text-task-${categoryKey}-ai`}>{task.aiExecutions}</td>
                            <td className="text-right py-3 px-4 text-[13px] text-zinc-300" data-testid={`text-task-${categoryKey}-tokens`}>{task.avgTokensUsed.toFixed(0)}</td>
                            <td className="text-right py-3 px-4 text-[13px] text-green-400" data-testid={`text-task-${categoryKey}-success`}>{(task.successRate * 100).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Provider Latency Monitoring */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2" data-testid="heading-provider-latency">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            Provider Latency Monitoring
            <span className="text-[11px] text-zinc-400 font-normal ml-2">(50-90% Cost Savings)</span>
          </h2>
          {isLatencyLoading ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="bg-zinc-800 border-zinc-700">
                  <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2">
                    <div className="h-3 sm:h-4 bg-zinc-700 rounded w-16 sm:w-20 animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="h-6 sm:h-8 bg-zinc-700 rounded w-16 sm:w-20 mb-1 animate-pulse" />
                    <div className="h-2 sm:h-3 bg-zinc-700 rounded w-20 sm:w-24 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
              {latencyData?.providers?.map((provider) => {
                const healthColor = provider.health === 'healthy' ? 'text-green-500' : 
                                   provider.health === 'degraded' ? 'text-yellow-500' : 'text-red-500';
                const providerKey = provider.provider.toLowerCase();
                return (
                  <Card key={provider.provider} className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid={`card-latency-${providerKey}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                      <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300 uppercase">
                        {provider.provider}
                      </CardTitle>
                      <div className={`h-2 w-2 rounded-full ${provider.health === 'healthy' ? 'bg-green-500' : provider.health === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4 pt-0">
                      <div className={`text-[13px] sm:text-[15px] font-bold ${healthColor} mb-1`} data-testid={`text-latency-${providerKey}-health`}>
                        {provider.health.toUpperCase()}
                      </div>
                      <div className="space-y-0.5 text-[10px] sm:text-[11px] text-zinc-400">
                        <div className="flex justify-between">
                          <span>P50:</span>
                          <span className="text-white" data-testid={`text-latency-${providerKey}-p50`}>{provider.p50?.toFixed(0) || 0}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>P95:</span>
                          <span className="text-white" data-testid={`text-latency-${providerKey}-p95`}>{provider.p95?.toFixed(0) || 0}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="text-green-400" data-testid={`text-latency-${providerKey}-success`}>{provider.successRate?.toFixed(1) || 0}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }) || <p className="text-zinc-400 text-[13px]">No latency data available yet</p>}
            </div>
          )}
          {latencyData?.fallbackRecommendation && (
            <div className="mt-3 p-3 bg-card border border-yellow-700 rounded-lg text-[13px] text-yellow-300" data-testid="text-fallback-recommendation">
              <AlertTriangle className="inline h-4 w-4 mr-2" />
              Fallback Recommendation: {latencyData.fallbackRecommendation}
            </div>
          )}
        </div>

        {/* Prompt Cache Metrics */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-[15px] lg:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2" data-testid="heading-prompt-cache">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
            Prompt Cache Metrics
          </h2>
          {isCacheLoading ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-zinc-800 border-zinc-700">
                  <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2">
                    <div className="h-3 sm:h-4 bg-zinc-700 rounded w-20 sm:w-24 animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="h-6 sm:h-8 bg-zinc-700 rounded w-12 sm:w-16 mb-1 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid="card-cache-hit-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">Cache Hit Rate</CardTitle>
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold text-green-400" data-testid="text-cache-hit-rate">
                    {((cacheMetrics?.hitRate || 0) * 100).toFixed(1)}%
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1">
                    {cacheMetrics?.totalHits || 0} hits / {cacheMetrics?.totalMisses || 0} misses
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid="card-cache-tokens-saved">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">Tokens Saved</CardTitle>
                  <Cpu className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold text-purple-400" data-testid="text-cache-tokens-saved">
                    {(cacheMetrics?.estimatedTokensSaved || 0).toLocaleString()}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1">Via prompt caching</p>
                </CardContent>
              </Card>
              <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid="card-cache-cost-saved">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">Cost Saved</CardTitle>
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold text-green-400" data-testid="text-cache-cost-saved">
                    ${(cacheMetrics?.estimatedCostSaved || 0).toFixed(2)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1">Estimated savings</p>
                </CardContent>
              </Card>
              <Card className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors" data-testid="card-cache-size">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-[11px] sm:text-[13px] font-medium text-zinc-300">Cache Size</CardTitle>
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-[15px] sm:text-2xl font-bold text-blue-400" data-testid="text-cache-size">
                    {(cacheMetrics?.systemPromptCacheSize || 0) + (cacheMetrics?.responseCacheSize || 0)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1">
                    {cacheMetrics?.systemPromptCacheSize || 0} prompts, {cacheMetrics?.responseCacheSize || 0} responses
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Slack Alert Configuration */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2" data-testid="heading-slack-config">
            <Settings className="h-5 w-5" />
            Slack Alert Configuration
          </h2>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-zinc-300 text-base">Real-time External Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSlackLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-zinc-700 rounded w-48 animate-pulse" />
                  <div className="h-10 bg-zinc-700 rounded animate-pulse" />
                  <div className="h-10 bg-zinc-700 rounded w-32 animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Status Indicator */}
                  <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg" data-testid="container-slack-status">
                    {slackConfig?.enabled ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-[13px] font-medium text-white" data-testid="text-slack-status">Slack alerts enabled</p>
                          <p className="text-[11px] text-zinc-400">Webhook URL: {slackConfig.webhookUrl || 'Not set'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-zinc-500" />
                        <div>
                          <p className="text-[13px] font-medium text-white" data-testid="text-slack-status">Slack alerts disabled</p>
                          <p className="text-[11px] text-zinc-400">Configure a webhook URL to enable alerts</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Webhook URL Input */}
                  <div className="space-y-2">
                    <label className="text-[13px] text-zinc-300 font-medium">
                      Webhook URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://hooks.slack.com/services/..."
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="flex-1 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                        data-testid="input-slack-webhook"
                      />
                      <Button
                        onClick={handleUpdateWebhook}
                        disabled={updateWebhookMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-update-webhook"
                      >
                        {updateWebhookMutation.isPending ? 'Updating...' : 'Update'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Get your webhook URL from{' '}
                      <a
                        href="https://api.slack.com/messaging/webhooks"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        Slack Incoming Webhooks
                      </a>
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleTestWebhook}
                      disabled={!slackConfig?.enabled || testWebhookMutation.isPending}
                      variant="outline"
                      className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                      data-testid="button-test-webhook"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {testWebhookMutation.isPending ? 'Testing...' : 'Send Test Alert'}
                    </Button>
                    {slackConfig?.configured && (
                      <Button
                        onClick={handleRemoveWebhook}
                        disabled={updateWebhookMutation.isPending}
                        variant="outline"
                        className="bg-zinc-900 border-zinc-700 text-red-400 hover:bg-zinc-800 hover:text-red-300"
                        data-testid="button-remove-webhook"
                      >
                        {updateWebhookMutation.isPending ? 'Removing...' : 'Remove Webhook'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
