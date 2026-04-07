import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, TrendingUp, Clock, Code, Server, AlertCircle, DollarSign, X, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface EffortPricingDisplayProps {
  projectId: number;
  onClose?: () => void;
}

interface EffortMetrics {
  tokensUsed: number;
  apiCalls: number;
  computeTime: number;
  filesProcessed: number;
  codeGenerated: number;
  testsRun: number;
  deploymentsCreated: number;
  errorsRecovered: number;
  checkpointsCreated: number;
  totalEffortScore: number;
}

interface EffortUsageReport {
  userId: number;
  projectId: number;
  period: {
    start: Date;
    end: Date;
  };
  totalEffort: EffortMetrics;
  totalCost: number;
  dailyBreakdown: Array<{
    date: string;
    effort: EffortMetrics;
    cost: number;
  }>;
}

export function EffortPricingDisplay({ projectId, onClose }: EffortPricingDisplayProps) {
  const { data: usageReport, isLoading } = useQuery({
    queryKey: ['/api/effort/usage', projectId],
    queryFn: () => apiRequest('GET', `/api/effort/usage/${projectId}`).then(res => res.json()),
    refetchInterval: 30000
  });

  const formatCost = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (isLoading) {
    return (
      <Card className="border bg-card" data-testid="pricing-loading">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Session Pricing
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} data-testid="pricing-close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-[13px]">Loading usage data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const report = usageReport?.report as EffortUsageReport | undefined;

  if (!report) {
    return (
      <Card className="border bg-card" data-testid="pricing-empty">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Session Pricing
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} data-testid="pricing-close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Activity className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-[13px] text-muted-foreground">No usage data yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">Start a conversation to see pricing details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const todaysCost = report.dailyBreakdown[report.dailyBreakdown.length - 1]?.cost || 0;
  const averageDailyCost = report.totalCost / Math.max(1, report.dailyBreakdown.length);

  return (
    <Card className="border bg-card" data-testid="pricing-display">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-[13px] font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Session Pricing
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} data-testid="pricing-close">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">Total Cost</span>
              <DollarSign className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-[15px] font-bold">{formatCost(report.totalCost)}</div>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(report.period.start), 'MMM d')} - {format(new Date(report.period.end), 'MMM d')}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">Today</span>
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-[15px] font-bold">{formatCost(todaysCost)}</div>
            <Progress 
              value={(todaysCost / Math.max(averageDailyCost, 1)) * 100} 
              className="h-1.5 mt-1"
            />
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">Tokens</span>
              <Coins className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-[15px] font-bold">{formatNumber(report.totalEffort.tokensUsed)}</div>
            <p className="text-[10px] text-muted-foreground">
              {formatCost(Math.round(report.totalEffort.tokensUsed / 1000 * 50))} cost
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">Compute</span>
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-[15px] font-bold">{Math.round(report.totalEffort.computeTime / 60)}m</div>
            <p className="text-[10px] text-muted-foreground">
              {formatCost(Math.round(report.totalEffort.computeTime / 60 * 200))} cost
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-3 text-center">
          <div className="p-2 rounded-md bg-muted/30">
            <Code className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-[13px] font-medium">{formatNumber(report.totalEffort.codeGenerated)}</div>
            <div className="text-[10px] text-muted-foreground">lines</div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <Server className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-[13px] font-medium">{formatNumber(report.totalEffort.apiCalls)}</div>
            <div className="text-[10px] text-muted-foreground">API calls</div>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-[13px] font-medium">{report.totalEffort.errorsRecovered}</div>
            <div className="text-[10px] text-muted-foreground">recovered</div>
          </div>
        </div>

        {report.dailyBreakdown.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-muted-foreground mb-2">Last 7 days</div>
            {report.dailyBreakdown.slice(-7).map((day) => (
              <div key={day.date} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-16 shrink-0">
                  {format(new Date(day.date), 'MMM d')}
                </span>
                <div className="flex-1">
                  <Progress 
                    value={(day.cost / Math.max(...report.dailyBreakdown.map(d => d.cost), 1)) * 100}
                    className="h-1.5"
                  />
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {formatCost(day.cost)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
