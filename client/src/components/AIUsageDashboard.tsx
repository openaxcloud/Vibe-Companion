import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Activity, Calendar, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface AIUsageData {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    modelBreakdown: Record<string, {
      totalTokens: number;
      totalCost: number;
      requestCount: number;
    }>;
  };
  recentUsage: Array<{
    id: number;
    model: string;
    provider: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    costUsd: string;
    endpoint: string;
    status: string;
    createdAt: Date;
  }>;
}

export function AIUsageDashboard() {
  const { data: usage, isLoading } = useQuery<AIUsageData>({
    queryKey: ['/api/ai/usage/monthly'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  // Prepare chart data
  const chartData = usage?.summary.modelBreakdown 
    ? Object.entries(usage.summary.modelBreakdown).map(([model, data]) => ({
        model: model.replace('claude-', '').replace('gpt-', '').replace('gemini-', ''),
        tokens: Math.round(data.totalTokens / 1000), // Show in thousands
        cost: data.totalCost,
        requests: data.requestCount,
      }))
    : [];

  const totalCost = usage?.summary.totalCost || 0;
  const totalTokens = usage?.summary.totalTokens || 0;
  const requestCount = usage?.summary.requestCount || 0;

  return (
    <div className="space-y-6">
      {/* Period Info */}
      <Card data-testid="card-billing-period">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Current Billing Period
          </CardTitle>
          <CardDescription data-testid="text-billing-period">
            {usage ? `${format(new Date(usage.period.start), 'MMM d, yyyy')} - ${format(new Date(usage.period.end), 'MMM d, yyyy')}` : 'Loading...'}
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* Usage Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-cost">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cost">${totalCost.toFixed(4)}</div>
            <p className="text-[11px] text-muted-foreground">
              {requestCount} AI requests
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-tokens">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tokens">{totalTokens.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground">
              Across all models
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-requests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">API Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-requests">{requestCount.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Model Chart */}
      {chartData.length > 0 && (
        <Card data-testid="card-usage-chart">
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
            <CardDescription>Token usage and costs breakdown by AI model</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="tokens" fill="hsl(var(--primary))" name="Tokens (K)" />
                <Bar yAxisId="right" dataKey="cost" fill="hsl(var(--secondary))" name="Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Usage Table */}
      <Card data-testid="card-recent-usage">
        <CardHeader>
          <CardTitle>Recent AI Usage</CardTitle>
          <CardDescription>Last 20 AI requests with detailed token and cost breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage?.recentUsage && usage.recentUsage.length > 0 ? (
                  usage.recentUsage.map((record) => (
                    <TableRow key={record.id} data-testid={`row-usage-${record.id}`}>
                      <TableCell className="font-mono text-[11px]">
                        {record.model}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {record.tokensInput.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {record.tokensOutput.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {record.tokensTotal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ${parseFloat(record.costUsd).toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={record.status === 'success' ? 'default' : 'destructive'}
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {format(new Date(record.createdAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No AI usage records yet. Start using AI models to see your usage here!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
