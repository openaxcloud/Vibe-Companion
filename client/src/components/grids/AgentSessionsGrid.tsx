/**
 * Agent Sessions Grid Component
 * AG Grid-based sessions table with filtering, sorting, and export
 * Phase 2 - Agent Activity Dashboard
 */

import { useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useQuery } from '@tanstack/react-query';
import { 
  Download, RefreshCw, Filter, Search, Calendar, 
  ChevronDown, Loader2, Table2, SlidersHorizontal,
  Clock, Cpu, DollarSign, User, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { defaultGridOptions, sessionGridColDefs } from './ag-grid-config';
import { gridCellRenderers } from './GridCellRenderers';
import type { AgentSessionRow, SessionsGridResponse } from '@shared/types/agent-grid.types';
import type { GridReadyEvent, GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import './ag-grid-theme.css';

interface AgentSessionsGridProps {
  projectId?: number;
  onSessionSelect?: (session: AgentSessionRow) => void;
  height?: string | number;
}

function SessionCard({ 
  session, 
  onSelect 
}: { 
  session: AgentSessionRow; 
  onSelect?: (session: AgentSessionRow) => void 
}) {
  const statusColors: Record<string, string> = {
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
      onClick={() => onSelect?.(session)}
      data-testid={`session-card-${session.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("text-[11px]", statusColors[session.status] || 'bg-gray-100')}>
                {session.status}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                {session.id.slice(0, 8)}...
              </span>
            </div>
            <div className="text-[13px] font-medium truncate mb-1">
              {session.projectName || 'Unknown Project'}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
              <User className="h-3 w-3" />
              {session.userName || 'Unknown User'}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{session.duration ? `${Math.round(session.duration / 1000)}s` : '-'}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Cpu className="h-3 w-3" />
                <span>{session.totalTokensUsed?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                <span>${session.totalCost?.toFixed(3) || '0.00'}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
        </div>
        <div className="mt-2 pt-2 border-t">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{session.model}</span>
            <span className="text-muted-foreground">
              {session.startedAt ? format(new Date(session.startedAt), 'MMM d, HH:mm') : '-'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentSessionsGrid({ 
  projectId, 
  onSessionSelect,
  height = 500 
}: AgentSessionsGridProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [showFilters, setShowFilters] = useState(false);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortDirection', 'desc');
    params.set('projectId', String(projectId));
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (modelFilter !== 'all') params.set('model', modelFilter);
    if (dateRange.start) params.set('startDate', dateRange.start.toISOString());
    if (dateRange.end) params.set('endDate', dateRange.end.toISOString());
    
    return params.toString();
  }, [page, pageSize, projectId, statusFilter, modelFilter, dateRange]);

  const { data, isLoading, error, refetch } = useQuery<SessionsGridResponse>({
    queryKey: ['/api/agent-grid/sessions', projectId, buildQueryParams()],
    enabled: !!projectId,
  });

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onRowClicked = useCallback((event: any) => {
    if (onSessionSelect && event.data) {
      onSessionSelect(event.data);
    }
  }, [onSessionSelect]);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/agent-grid/export/sessions?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-sessions-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  const handleQuickFilter = useCallback((text: string) => {
    setSearchQuery(text);
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', text);
    }
  }, [gridApi]);

  const filteredData = useMemo(() => {
    if (!data?.rows) return [];
    if (!searchQuery) return data.rows;
    
    const query = searchQuery.toLowerCase();
    return data.rows.filter(row => 
      row.id.toLowerCase().includes(query) ||
      row.userName?.toLowerCase().includes(query) ||
      row.projectName?.toLowerCase().includes(query) ||
      row.model.toLowerCase().includes(query)
    );
  }, [data?.rows, searchQuery]);

  const gridOptions = useMemo(() => ({
    ...defaultGridOptions,
    onRowClicked,
    components: gridCellRenderers,
  }), [onRowClicked]);

  return (
    <div className="flex flex-col gap-4" data-testid="agent-sessions-grid">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Agent Sessions</h3>
          {data && (
            <Badge variant="secondary" className="ml-2">
              {data.totalCount.toLocaleString()} sessions
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => handleQuickFilter(e.target.value)}
              className="pl-8 w-[200px] sm:w-[250px] h-9"
              data-testid="input-search-sessions"
            />
          </div>

          {/* Filters Toggle */}
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="h-4 w-4 mr-1" />
            Filters
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-sessions"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          {/* Export */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-1" />
                Export
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleExport('csv')}
                data-testid="button-export-csv"
              >
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleExport('json')}
                data-testid="button-export-json"
              >
                Export JSON
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg" data-testid="filters-panel">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-[160px] h-8" data-testid="select-model-filter">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
              <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
              <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
              <SelectItem value="o4-mini">o4-mini</SelectItem>
              <SelectItem value="o3">o3</SelectItem>
              <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4</SelectItem>
              <SelectItem value="claude-opus-4-7">Claude Opus 4</SelectItem>
              <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" data-testid="button-date-range">
                <Calendar className="h-4 w-4 mr-1" />
                {dateRange.start ? (
                  dateRange.end ? (
                    `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d')}`
                  ) : (
                    format(dateRange.start, 'MMM d, yyyy')
                  )
                ) : (
                  'Date Range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={{ from: dateRange.start, to: dateRange.end }}
                onSelect={(range) => setDateRange({ 
                  start: range?.from, 
                  end: range?.to 
                })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {(statusFilter !== 'all' || modelFilter !== 'all' || dateRange.start) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setStatusFilter('all');
                setModelFilter('all');
                setDateRange({});
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Grid / Mobile Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <p>Failed to load sessions</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isMobile ? (
        <div className="space-y-3" data-testid="sessions-mobile-view">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sessions found
            </div>
          ) : (
            filteredData.map((session) => (
              <SessionCard 
                key={session.id} 
                session={session} 
                onSelect={onSessionSelect}
              />
            ))
          )}
        </div>
      ) : (
        <div 
          className="ag-theme-custom rounded-lg border overflow-hidden"
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
        >
          <AgGridReact
            rowData={filteredData}
            columnDefs={sessionGridColDefs}
            gridOptions={gridOptions}
            onGridReady={onGridReady}
          />
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.totalCount)} of {data.totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="px-2">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentSessionsGrid;
