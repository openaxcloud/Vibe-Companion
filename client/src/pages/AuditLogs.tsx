import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Shield, User, Activity, AlertCircle, CheckCircle2, XCircle, Search, Filter, Download, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AuditLog {
  id: number;
  organizationId: number | null;
  userId: number | null;
  username?: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: any;
  status: 'success' | 'failure';
  timestamp: string;
}

export function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });

  // Fetch audit logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ['/api/admin/audit-logs', searchTerm, filterAction, filterStatus, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (dateRange.from) params.append('from', dateRange.from.toISOString());
      if (dateRange.to) params.append('to', dateRange.to.toISOString());
      
      const response = await apiRequest('GET', `/api/admin/audit-logs?${params.toString()}`);
      return response.json();
    }
  });

  const exportLogs = () => {
    // In real implementation, would trigger CSV/JSON export
  };

  const getActionIcon = (action: string) => {
    if (action.includes('login')) return <User className="h-4 w-4" />;
    if (action.includes('sso')) return <Shield className="h-4 w-4" />;
    if (action.includes('project')) return <Activity className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-500/10 text-green-600';
    if (action.includes('delete')) return 'bg-red-500/10 text-red-600';
    if (action.includes('update')) return 'bg-blue-500/10 text-blue-600';
    if (action.includes('login')) return 'bg-purple-500/10 text-purple-600';
    return 'bg-gray-500/10 text-gray-600';
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor and track all activities in your organization
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-[15px]">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, resource, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-logs"
              />
            </div>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger data-testid="select-filter-action">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="sso_login">SSO Login</SelectItem>
                <SelectItem value="project_create">Project Create</SelectItem>
                <SelectItem value="project_delete">Project Delete</SelectItem>
                <SelectItem value="user_update">User Update</SelectItem>
                <SelectItem value="permission_change">Permission Change</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-between mt-4">
            <Button variant="outline" size="sm" data-testid="button-clear-filters" onClick={() => {
              setSearchTerm('');
              setFilterAction('all');
              setFilterStatus('all');
              setDateRange({ from: undefined, to: undefined });
            }}>
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
            <Button variant="outline" size="sm" data-testid="button-export-logs" onClick={exportLogs}>
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {(logs as AuditLog[])?.length || 0} audit log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : logs && (logs as AuditLog[]).length > 0 ? (
            <div className="space-y-2">
              {(logs as AuditLog[]).map((log: AuditLog) => (
                <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{log.username || 'System'}</span>
                          <span className="text-muted-foreground">performed</span>
                          <code className="text-[13px] bg-muted px-1.5 py-0.5 rounded">
                            {log.action}
                          </code>
                        </div>
                        
                        {log.resourceType && (
                          <p className="text-[13px] text-muted-foreground">
                            on {log.resourceType} {log.resourceId && `#${log.resourceId}`}
                          </p>
                        )}
                        
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-[13px] text-muted-foreground cursor-pointer hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 text-[11px] bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                          {log.status === 'success' ? (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                      {log.ipAddress && (
                        <span>IP: {log.ipAddress}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No audit logs found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuditLogs;