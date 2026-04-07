/**
 * AG Grid Custom Cell Renderers
 * Phase 2 - Agent Activity Dashboard
 */

import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2,
  FileEdit, FilePlus, Trash2, Terminal, Package, Globe, Search, Database,
  User, Bot, Settings, Wrench, Brain, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ICellRendererParams } from 'ag-grid-community';

export function StatusCellRenderer(params: ICellRendererParams) {
  const status = params.value as string;
  
  const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string }> = {
    active: { icon: Loader2, className: 'ag-cell-status active' },
    completed: { icon: CheckCircle2, className: 'ag-cell-status completed' },
    failed: { icon: XCircle, className: 'ag-cell-status failed' },
    pending: { icon: Clock, className: 'ag-cell-status pending' },
    in_progress: { icon: Loader2, className: 'ag-cell-status in_progress' },
    cancelled: { icon: XCircle, className: 'ag-cell-status failed' },
    rolled_back: { icon: RotateCcw, className: 'ag-cell-status pending' },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={config.className} data-testid={`grid-status-${status}`}>
      <Icon className={cn("h-3 w-3", status === 'active' || status === 'in_progress' ? 'animate-spin' : '')} />
      {status?.replace('_', ' ')}
    </span>
  );
}

export function RiskCellRenderer(params: ICellRendererParams) {
  const risk = params.value as string;
  
  return (
    <span className={`ag-cell-risk ${risk}`} data-testid={`grid-risk-${risk}`}>
      {risk === 'critical' && <AlertTriangle className="h-3 w-3" />}
      {risk}
    </span>
  );
}

export function RoleCellRenderer(params: ICellRendererParams) {
  const role = params.value as string;
  
  const roleIcons: Record<string, typeof User> = {
    user: User,
    assistant: Bot,
    system: Settings,
    tool: Wrench,
  };

  const Icon = roleIcons[role] || User;

  return (
    <span className={`ag-cell-role ${role}`} data-testid={`grid-role-${role}`}>
      <Icon className="h-3 w-3" />
      {role}
    </span>
  );
}

export function ActionTypeCellRenderer(params: ICellRendererParams) {
  const actionLabel = params.value as string;
  const actionType = params.data?.actionType as string;
  
  const actionIcons: Record<string, typeof FileEdit> = {
    file_create: FilePlus,
    file_edit: FileEdit,
    file_delete: Trash2,
    file_read: FileEdit,
    command_execute: Terminal,
    package_install: Package,
    web_search: Globe,
    code_search: Search,
    diagnostics: AlertTriangle,
    project_analysis: Database,
    tool_call: Wrench,
  };

  const Icon = actionIcons[actionType] || Wrench;

  return (
    <span className="ag-cell-action-type" data-testid={`grid-action-${actionType}`}>
      <Icon className="icon" />
      {actionLabel}
    </span>
  );
}

export function OperationTypeCellRenderer(params: ICellRendererParams) {
  const opType = params.value as string;
  
  const opIcons: Record<string, typeof FileEdit> = {
    create: FilePlus,
    edit: FileEdit,
    delete: Trash2,
    rename: FileEdit,
    move: FileEdit,
  };

  const Icon = opIcons[opType] || FileEdit;
  const colors: Record<string, string> = {
    create: 'text-green-600',
    edit: 'text-blue-600',
    delete: 'text-red-600',
    rename: 'text-yellow-600',
    move: 'text-purple-600',
  };

  return (
    <span className={cn("ag-cell-action-type", colors[opType])} data-testid={`grid-op-${opType}`}>
      <Icon className="icon" />
      {opType}
    </span>
  );
}

export function TargetCellRenderer(params: ICellRendererParams) {
  const target = params.value as string;
  
  if (!target) return <span className="text-muted-foreground">-</span>;
  
  return (
    <span className="ag-cell-path" title={target} data-testid="grid-target">
      {target.length > 50 ? `...${target.slice(-47)}` : target}
    </span>
  );
}

export function PathCellRenderer(params: ICellRendererParams) {
  const path = params.value as string;
  
  if (!path) return <span className="text-muted-foreground">-</span>;
  
  return (
    <span className="ag-cell-path" title={path} data-testid="grid-path">
      {path}
    </span>
  );
}

export function ContentCellRenderer(params: ICellRendererParams) {
  const content = params.value as string;
  
  if (!content) return <span className="text-muted-foreground">-</span>;
  
  return (
    <span className="ag-cell-content-preview" title={content} data-testid="grid-content">
      {content}
    </span>
  );
}

export function ErrorCellRenderer(params: ICellRendererParams) {
  const count = params.value as number;
  
  if (!count || count === 0) {
    return <span className="text-muted-foreground">0</span>;
  }
  
  return (
    <span className="ag-cell-badge error" data-testid="grid-errors">
      {count}
    </span>
  );
}

export function ToolCallsCellRenderer(params: ICellRendererParams) {
  const count = params.value as number;
  
  if (!count || count === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  return (
    <span className="ag-cell-badge info" data-testid="grid-tool-calls">
      {count}
    </span>
  );
}

export function ThinkingCellRenderer(params: ICellRendererParams) {
  const hasThinking = params.value as boolean;
  
  if (!hasThinking) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  return (
    <span className="ag-cell-badge success" data-testid="grid-thinking">
      <Brain className="h-3 w-3" />
    </span>
  );
}

export function RollbackCellRenderer(params: ICellRendererParams) {
  const available = params.value as boolean;
  const data = params.data;
  
  if (!available) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  if (data?.rolledBack) {
    return (
      <Badge variant="outline" className="text-[11px]" data-testid="grid-rolled-back">
        Rolled Back
      </Badge>
    );
  }
  
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-6 px-2 text-[11px]"
      onClick={(e) => {
        e.stopPropagation();
      }}
      data-testid="button-rollback"
    >
      <RotateCcw className="h-3 w-3 mr-1" />
      Rollback
    </Button>
  );
}

export function IdCellRenderer(params: ICellRendererParams) {
  const id = params.value as string;
  
  if (!id) return <span className="text-muted-foreground">-</span>;
  
  const shortId = id.length > 8 ? `${id.slice(0, 8)}...` : id;
  
  return (
    <span 
      className="font-mono text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
      title={id}
      onClick={() => navigator.clipboard.writeText(id)}
      data-testid="grid-id"
    >
      {shortId}
    </span>
  );
}

export const gridCellRenderers = {
  statusCellRenderer: StatusCellRenderer,
  riskCellRenderer: RiskCellRenderer,
  roleCellRenderer: RoleCellRenderer,
  actionTypeCellRenderer: ActionTypeCellRenderer,
  operationTypeCellRenderer: OperationTypeCellRenderer,
  targetCellRenderer: TargetCellRenderer,
  pathCellRenderer: PathCellRenderer,
  contentCellRenderer: ContentCellRenderer,
  errorCellRenderer: ErrorCellRenderer,
  toolCallsCellRenderer: ToolCallsCellRenderer,
  thinkingCellRenderer: ThinkingCellRenderer,
  rollbackCellRenderer: RollbackCellRenderer,
  idCellRenderer: IdCellRenderer,
};
