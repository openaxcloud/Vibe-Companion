import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, Activity, Users, TrendingUp,
  Search, Download, BarChart3, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from './admin/AdminLayout';

interface PlatformStats {
  period: string;
  startDate: Date;
  endDate: Date;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  byTier: Record<string, { requests: number; tokens: number; cost: number }>;
  byStatus: {
    success: number;
    error: number;
    timeout: number;
  };
  uniqueUsers: number;
}

interface UsageRecord {
  id: number;
  userId: string;
  username: string | null;
  userEmail: string | null;
  model: string;
  provider: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: string;
  endpoint: string;
  status: string;
  userTier: string;
  createdAt: Date;
}

interface UsageResponse {
  usage: UsageRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminAIUsage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');
  const [page, setPage] = useState(1);
  const [searchUserId, setSearchUserId] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Check if user is admin
  if (!user || !user.email?.includes('admin')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Admin privileges required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['/api/admin/ai-usage/admin/stats', period],
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<UsageResponse>({
    queryKey: [
      '/api/admin/ai-usage/admin/all', 
      page, 
      searchUserId, 
      filterModel,
      startDate,
      endDate
    ],
  });

  const exportData = () => {
    if (!usageData?.usage || usageData.usage.length === 0) {
      alert('No data to export');
      return;
    }
    
    const headers = ['ID', 'User ID', 'Model', 'Provider', 'Tokens Input', 'Tokens Output', 'Total Tokens', 'Cost (USD)', 'Status', 'Created At'];
    const rows = usageData.usage.map((record: UsageRecord) => [
      record.id,
      record.userId,
      record.model,
      record.provider,
      record.tokensInput,
      record.tokensOutput,
      record.tokensTotal,
      record.costUsd,
      record.status,
      new Date(record.createdAt).toISOString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | number)[]) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ai-usage-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="heading-ai-usage-analytics">AI Usage Analytics</h1>
          <p className="text-zinc-400" data-testid="text-ai-usage-description">Platform-wide AI usage monitoring and billing</p>
        </div>
        <Button onClick={exportData} data-testid="button-export">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Platform Stats */}
      {statsLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card data-testid="card-total-revenue">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[13px] font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-revenue">
                  ${(stats?.totalCost || 0).toFixed(2)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {period === 'month' ? 'This month' : period === 'week' ? 'This week' : 'Today'}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-platform-requests">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[13px] font-medium">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-platform-requests">
                  {(stats?.totalRequests ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Success: {stats?.byStatus?.success ?? 0} | Error: {stats?.byStatus?.error ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-unique-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[13px] font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-unique-users">
                  {stats?.uniqueUsers ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Unique users with AI usage
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-platform-tokens">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[13px] font-medium">Total Tokens</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-platform-tokens">
                  {(stats?.totalTokens ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Across all models
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Usage by Tier */}
          <Card data-testid="card-usage-by-tier">
            <CardHeader>
              <CardTitle>Usage by Subscription Tier</CardTitle>
              <CardDescription>Revenue and usage breakdown by user tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.byTier && typeof stats.byTier === 'object' && Object.entries(stats.byTier).map(([tier, data]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        tier === 'enterprise' ? 'default' : 
                        tier === 'pro' ? 'secondary' : 
                        'outline'
                      }>
                        {(tier ?? 'free').toUpperCase()}
                      </Badge>
                      <span className="text-[13px] text-muted-foreground">
                        {data?.requests ?? 0} requests
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(data?.cost ?? 0).toFixed(2)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(data?.tokens ?? 0).toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-[13px] font-medium">Period</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[13px] font-medium">User ID</label>
              <Input
                placeholder="Search by user ID..."
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                data-testid="input-user-id"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium">Model</label>
              <Input
                placeholder="Filter by model..."
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                data-testid="input-model"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium">Actions</label>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSearchUserId('');
                  setFilterModel('');
                  setStartDate('');
                  setEndDate('');
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Records Table */}
      <Card data-testid="card-usage-records">
        <CardHeader>
          <CardTitle>All AI Usage Records</CardTitle>
          <CardDescription>
            {usageData ? `Showing ${usageData.usage.length} of ${usageData.pagination.total} records` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageData?.usage && Array.isArray(usageData.usage) && usageData.usage.length > 0 ? (
                      usageData.usage.map((record) => (
                        <TableRow key={record?.id} data-testid={`row-record-${record?.id}`}>
                          <TableCell className="font-mono text-[11px]">
                            <div>
                              <div className="font-medium">{record?.username || 'Unknown'}</div>
                              <div className="text-muted-foreground">{(record?.userId ?? 'unknown').toString().slice(0, 8)}...</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{record?.userTier || 'free'}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px]">{record?.model || 'unknown'}</TableCell>
                          <TableCell><Badge variant="secondary">{record?.provider || 'unknown'}</Badge></TableCell>
                          <TableCell className="text-right font-medium">
                            {(record?.tokensTotal || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            ${parseFloat(String(record?.costUsd || '0')).toFixed(4)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={record?.status === 'success' ? 'default' : 'destructive'}>
                              {record?.status || 'unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {record?.createdAt ? format(new Date(record.createdAt), 'MMM d, HH:mm:ss') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No usage records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {usageData?.usage && Array.isArray(usageData.usage) && usageData.usage.length > 0 ? (
                  usageData.usage.map((record) => (
                    <Card key={record?.id} data-testid={`card-record-${record?.id}`}>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{record?.username || 'Unknown'}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{(record?.userId ?? 'unknown').toString().slice(0, 12)}...</div>
                          </div>
                          <Badge variant="outline">{record?.userTier || 'free'}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[13px]">
                          <div>
                            <span className="text-muted-foreground">Model:</span>
                            <div className="font-mono text-[11px] mt-1">{record?.model || 'unknown'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Provider:</span>
                            <div className="mt-1"><Badge variant="secondary">{record?.provider || 'unknown'}</Badge></div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tokens:</span>
                            <div className="font-medium mt-1">{(record?.tokensTotal || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost:</span>
                            <div className="font-medium text-green-600 mt-1">${parseFloat(String(record?.costUsd || '0')).toFixed(4)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <div className="mt-1">
                              <Badge variant={record?.status === 'success' ? 'default' : 'destructive'}>
                                {record?.status || 'unknown'}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Time:</span>
                            <div className="text-[11px] mt-1">{record?.createdAt ? format(new Date(record.createdAt), 'MMM d, HH:mm') : 'N/A'}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No usage records found
                  </div>
                )}
              </div>

              {/* Pagination */}
              {usageData && usageData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-[13px] text-muted-foreground">
                    Page {usageData.pagination.page} of {usageData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === usageData.pagination.totalPages}
                      onClick={() => setPage(page + 1)}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
