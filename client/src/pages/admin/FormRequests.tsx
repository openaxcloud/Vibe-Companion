import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AdminLayout } from './AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Phone,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  Archive,
  Inbox,
  Search as SearchIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const FORM_TABS = [
  { value: 'all', label: 'All Requests' },
  { value: 'contact_sales', label: 'Sales Inquiries' },
  { value: 'support_ticket', label: 'Support Tickets' },
  { value: 'report_abuse', label: 'Abuse Reports' },
];

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_ACTIONS = [
  { value: 'in_progress', label: 'Mark in progress', icon: Clock },
  { value: 'resolved', label: 'Mark resolved', icon: CheckCircle2 },
  { value: 'archived', label: 'Archive', icon: Archive },
];

export default function AdminFormRequests() {
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  if (!user || !user.email?.includes('admin')) {
    return (
      <div className="container mx-auto py-16">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Access denied. Admin privileges required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, statusFilter, debouncedSearch]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin.formRequests', activeTab, statusFilter, debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        params.set('formType', activeTab);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const response = await fetch(`/api/admin/form-requests?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to load customer requests');
      }

      return await response.json();
    },
  });

  const requests = data?.requests || [];
  const pagination = data?.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };
  const summary = data?.summary || { currentTab: { total: 0, byStatus: {} }, byFormType: {}, matchedTotal: 0 };
  const statusCounts = summary.currentTab?.byStatus || {};

  const tabCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {
      contact_sales: summary.byFormType?.contact_sales || 0,
      support_ticket: summary.byFormType?.support_ticket || 0,
      report_abuse: summary.byFormType?.report_abuse || 0,
    };
    const aggregatedTotal = summary.matchedTotal
      || Object.values(counts).reduce((total, value) => total + value, 0);

    return {
      all: aggregatedTotal,
      ...counts,
    };
  }, [summary]);

  const activeTabLabel = FORM_TABS.find((tab) => tab.value === activeTab)?.label || 'All Requests';

  const statusHighlights = useMemo(() => [
    {
      key: 'total',
      label: 'Total volume',
      value: summary.currentTab?.total || 0,
      description: activeTabLabel,
      icon: Inbox,
    },
    {
      key: 'new',
      label: 'New',
      value: statusCounts.new || 0,
      description: 'Awaiting triage',
      icon: Mail,
    },
    {
      key: 'in_progress',
      label: 'In progress',
      value: statusCounts.in_progress || 0,
      description: 'Actively being handled',
      icon: Clock,
    },
    {
      key: 'resolved',
      label: 'Resolved',
      value: statusCounts.resolved || 0,
      description: 'Completed and closed',
      icon: CheckCircle2,
    },
    {
      key: 'archived',
      label: 'Archived',
      value: statusCounts.archived || 0,
      description: 'Filed for reference',
      icon: Archive,
    },
  ], [activeTabLabel, statusCounts, summary.currentTab?.total]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest('PATCH', `/api/admin/form-requests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin.formRequests'] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/form-requests?formType=${activeTab}&status=${statusFilter}`] });
      toast({
        title: 'Request updated',
        description: 'The request status has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Unable to update request status.',
        variant: 'destructive',
      });
    },
  });

  const groupedRequests = requests;
  const startIndex = groupedRequests.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endIndex = groupedRequests.length > 0
    ? Math.min(pagination.page * pagination.pageSize, pagination.total)
    : 0;
  const canGoNext = pagination.page < (pagination.totalPages || 1);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white" data-testid="heading-customer-requests">Customer Requests</h1>
            <p className="text-[11px] sm:text-[13px] text-zinc-400" data-testid="text-requests-description">
              Track every form submission from marketing pages, trust &amp; safety, and support.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="text-white border-zinc-700 w-full sm:w-auto" data-testid="button-refresh-requests">
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="sm:inline">Refreshing</span>
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                <span className="sm:inline">Refresh</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-2 sm:gap-3 grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {statusHighlights.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.key} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] sm:text-[13px] text-zinc-400 truncate">{item.label}</p>
                      <p className="mt-1 sm:mt-2 text-[15px] sm:text-2xl font-semibold text-white">
                        {item.value.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1 hidden sm:block">{item.description}</p>
                    </div>
                    <div className="p-1.5 sm:p-2 rounded-full bg-zinc-800/60 flex-shrink-0">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-white">Request Filters</CardTitle>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-72">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by sender, company, or message"
                      className="w-full bg-zinc-800 border-zinc-700 text-white pl-9"
                      data-testid="input-search-requests"
                    />
                  </div>
                  {searchTerm ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:text-white"
                      onClick={() => setSearchTerm('')}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full">
                {/* Scrollable tabs on mobile */}
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 w-full sm:w-auto">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto min-w-full sm:w-auto">
                    <TabsList className="inline-flex w-auto bg-zinc-800/60 border border-zinc-700 gap-0.5 p-1">
                      {FORM_TABS.map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="flex-shrink-0 whitespace-nowrap px-2 sm:px-3 text-[11px] sm:text-[13px] data-[state=active]:bg-zinc-700 data-[state=active]:text-white"
                        >
                          <span className="flex items-center gap-1 sm:gap-2">
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                            <Badge
                              variant="outline"
                              className="border-zinc-700 bg-transparent text-[10px] sm:text-[11px] text-zinc-300 px-1.5"
                            >
                              {Number(tabCounts[tab.value] || 0).toLocaleString()}
                          </Badge>
                        </span>
                      </TabsTrigger>
                    ))}
                    </TabsList>
                  </Tabs>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 bg-zinc-800 border-zinc-700 text-white" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                Loading requests...
              </div>
            ) : groupedRequests.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-zinc-500">
                <CheckCircle2 className="h-10 w-10 mb-3" />
                <p className="font-medium">No requests to show</p>
                <p className="text-[13px] text-zinc-500 mt-1 text-center max-w-md">
                  {debouncedSearch || statusFilter !== 'all' || activeTab !== 'all'
                    ? 'No submissions match your current filters. Try adjusting the search or status filters.'
                    : 'Once customers reach out through sales, support, or trust & safety forms, their submissions will appear here.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[70vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-zinc-400">Received</TableHead>
                      <TableHead className="text-zinc-400">Source</TableHead>
                      <TableHead className="text-zinc-400">Sender</TableHead>
                      <TableHead className="text-zinc-400">Request</TableHead>
                      <TableHead className="text-zinc-400">Status</TableHead>
                      <TableHead className="text-right text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedRequests.map((request: any) => {
                      const statusClass = STATUS_STYLES[request.status] || STATUS_STYLES.new;
                      const createdAt = request.createdAt ? new Date(request.createdAt) : null;
                      return (
                        <TableRow key={request.id} className="border-zinc-900 hover:bg-zinc-800/50" data-testid={`row-request-${request.id}`}>
                          <TableCell className="text-[13px] text-zinc-300">
                            {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : '—'}
                          </TableCell>
                          <TableCell className="text-[13px] text-zinc-300">
                            <div className="flex flex-col">
                              <span className="font-medium capitalize">
                                {request.formType?.replace('_', ' ') || 'Request'}
                              </span>
                              <span className="text-[11px] text-zinc-500">{request.pagePath || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[13px] text-zinc-300">
                            <div className="space-y-1">
                              <p className="font-medium text-white">{request.name || request.senderName || 'Unknown contact'}</p>
                              {request.senderCompany ? (
                                <p className="text-[11px] text-zinc-500">{request.senderCompany}</p>
                              ) : null}
                              {request.email || request.senderEmail ? (
                                <p className="flex items-center gap-2 text-[11px] text-blue-400">
                                  <Mail className="h-3 w-3" />
                                  {request.email || request.senderEmail}
                                </p>
                              ) : null}
                              {request.phone || request.senderPhone ? (
                                <p className="flex items-center gap-2 text-[11px] text-zinc-500">
                                  <Phone className="h-3 w-3" />
                                  {request.phone || request.senderPhone}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-[13px] text-zinc-300">
                            <div className="space-y-1">
                              {request.subject ? (
                                <p className="font-medium text-white">{request.subject}</p>
                              ) : null}
                              {request.metadata?.issueType ? (
                                <Badge variant="outline" className="border-zinc-700 text-zinc-300 bg-transparent">
                                  {request.metadata.issueType.replace('_', ' ')}
                                </Badge>
                              ) : null}
                              <p className="text-[11px] text-zinc-400 whitespace-pre-wrap">
                                {request.message?.slice(0, 200) || '—'}
                                {request.message && request.message.length > 200 ? '…' : ''}
                              </p>
                              {request.metadata?.targetUrl ? (
                                <a
                                  href={request.metadata.targetUrl}
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {request.metadata.targetUrl}
                                </a>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusClass} border`}>{request.status?.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              {STATUS_ACTIONS.map((action) => {
                                const Icon = action.icon;
                                const disabled = updateStatus.isPending || request.status === action.value;
                                return (
                                  <Button
                                    key={action.value}
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                                    onClick={() => updateStatus.mutate({ id: request.id, status: action.value })}
                                  >
                                    {updateStatus.isPending && updateStatus.variables?.id === request.id &&
                                    updateStatus.variables?.status === action.value ? (
                                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Icon className="mr-2 h-3 w-3" />
                                    )}
                                    <span className="text-[11px]">{action.label}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[11px] text-zinc-500">
          <div>
            {pagination.total > 0 ? (
              <span>
                Showing {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of {pagination.total.toLocaleString()} matched requests
              </span>
            ) : (
              <span>No matching requests</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isFetching}
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-zinc-500">
              Page {pagination.page} of {(pagination.totalPages || 1).toLocaleString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoNext || isFetching}
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              onClick={() => setPage((current) => (canGoNext ? current + 1 : current))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
