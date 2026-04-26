// @ts-nocheck
/**
 * Conversation History Grid Component
 * AG Grid-based conversation table with full-text search
 * Phase 2 - Agent Activity Dashboard
 */

import { useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useQuery } from '@tanstack/react-query';
import { 
  RefreshCw, Search, Loader2, MessageSquare, User, Bot,
  Wrench, Settings, ChevronRight, Clock, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMediaQuery } from '@/hooks/use-media-query';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { defaultGridOptions, conversationGridColDefs } from './ag-grid-config';
import { gridCellRenderers } from './GridCellRenderers';
import type { ConversationMessageRow, ConversationsGridResponse } from '@shared/types/agent-grid.types';
import type { GridReadyEvent, GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import './ag-grid-theme.css';

interface ConversationHistoryGridProps {
  sessionId?: string;
  onMessageSelect?: (message: ConversationMessageRow) => void;
  height?: string | number;
}

function MessageCard({ message, onSelect }: { message: ConversationMessageRow; onSelect?: (m: ConversationMessageRow) => void }) {
  const roleConfig: Record<string, { icon: typeof User; color: string; label: string }> = {
    user: { icon: User, color: 'text-blue-600', label: 'User' },
    assistant: { icon: Bot, color: 'text-green-600', label: 'Assistant' },
    system: { icon: Settings, color: 'text-gray-600', label: 'System' },
    tool: { icon: Wrench, color: 'text-orange-600', label: 'Tool' },
  };
  const config = roleConfig[message.role] || roleConfig.user;
  const RoleIcon = config.icon;

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
      onClick={() => onSelect?.(message)}
      data-testid={`message-card-${message.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-full bg-muted shrink-0", config.color)}>
            <RoleIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-[13px]">{config.label}</span>
              {message.model && (
                <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                  <Cpu className="h-2.5 w-2.5" />
                  {message.model}
                </Badge>
              )}
            </div>
            <div className="text-[13px] text-muted-foreground line-clamp-2 mb-2">
              {message.content}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {message.createdAt ? format(new Date(message.createdAt), 'MMM d, HH:mm') : '-'}
              </span>
              {message.promptTokens != null && message.completionTokens != null && (
                <span>{message.promptTokens + message.completionTokens} tokens</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ConversationHistoryGrid({ 
  sessionId, 
  onMessageSelect,
  height = 400 
}: ConversationHistoryGridProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    
    if (sessionId) params.set('sessionId', sessionId);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (modelFilter !== 'all') params.set('model', modelFilter);
    if (searchQuery) params.set('searchQuery', searchQuery);
    
    return params.toString();
  }, [page, pageSize, sessionId, roleFilter, modelFilter, searchQuery]);

  const { data, isLoading, error, refetch } = useQuery<ConversationsGridResponse>({
    queryKey: ['/api/agent-grid/conversations', buildQueryParams()],
    enabled: !!sessionId || true,
  });

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onRowClicked = useCallback((event: any) => {
    if (onMessageSelect && event.data) {
      onMessageSelect(event.data);
    }
  }, [onMessageSelect]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const stats = useMemo(() => {
    if (!data?.rows) return { user: 0, assistant: 0, tool: 0, system: 0 };
    return {
      user: data.rows.filter(r => r.role === 'user').length,
      assistant: data.rows.filter(r => r.role === 'assistant').length,
      tool: data.rows.filter(r => r.role === 'tool').length,
      system: data.rows.filter(r => r.role === 'system').length,
    };
  }, [data?.rows]);

  const gridOptions = useMemo(() => ({
    ...defaultGridOptions,
    onRowClicked,
    components: gridCellRenderers,
    rowHeight: 52,
  }), [onRowClicked]);

  return (
    <div className="flex flex-col gap-3" data-testid="conversation-history-grid">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-[13px]">Messages</h4>
          {data && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[11px] bg-blue-500/10 text-blue-600">
                <User className="h-2.5 w-2.5 mr-1" />
                {stats.user}
              </Badge>
              <Badge variant="secondary" className="text-[11px] bg-green-500/10 text-green-600">
                <Bot className="h-2.5 w-2.5 mr-1" />
                {stats.assistant}
              </Badge>
              {stats.tool > 0 && (
                <Badge variant="secondary" className="text-[11px] bg-purple-500/10 text-purple-600">
                  <Wrench className="h-2.5 w-2.5 mr-1" />
                  {stats.tool}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-7 w-[180px] h-8 text-[11px]"
              data-testid="input-search-messages"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[90px] h-8 text-[11px]" data-testid="select-message-role">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="assistant">Assistant</SelectItem>
              <SelectItem value="tool">Tool</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-[120px] h-8 text-[11px]" data-testid="select-message-model">
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            data-testid="button-refresh-messages"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Grid / Mobile Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-[13px]">
          <p>Failed to load messages</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isMobile ? (
        <div className="space-y-3" data-testid="messages-mobile-view">
          {(data?.rows || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-[13px]">
              No messages found
            </div>
          ) : (
            (data?.rows || []).map((message) => (
              <MessageCard key={message.id} message={message} onSelect={onMessageSelect} />
            ))
          )}
        </div>
      ) : (
        <div 
          className="ag-theme-custom rounded-lg border overflow-hidden"
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
        >
          <AgGridReact
            rowData={data?.rows || []}
            columnDefs={conversationGridColDefs}
            gridOptions={gridOptions}
            onGridReady={onGridReady}
          />
        </div>
      )}
    </div>
  );
}

export default ConversationHistoryGrid;
