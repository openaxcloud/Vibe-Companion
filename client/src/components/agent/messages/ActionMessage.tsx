/**
 * Action Message Component
 * Displays file operations and command executions with approval workflow
 */

import { FileText, Edit, Trash2, Terminal, Package, FolderPlus, CheckCircle, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Action, ActionType } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDiffViewer } from './FileDiffViewer';

interface ActionMessageProps {
  actions: Action[];
  onApprove?: (action: Action) => void;
  onReject?: (action: Action) => void;
  className?: string;
}

const ACTION_CONFIG: Record<ActionType, { icon: typeof FileText; label: string; color: string; verb: string }> = {
  create_file: {
    icon: FileText,
    label: 'Create File',
    color: 'text-green-600 dark:text-green-400',
    verb: 'Create'
  },
  edit_file: {
    icon: Edit,
    label: 'Edit File',
    color: 'text-blue-600 dark:text-blue-400',
    verb: 'Edit'
  },
  delete_file: {
    icon: Trash2,
    label: 'Delete File',
    color: 'text-red-600 dark:text-red-400',
    verb: 'Delete'
  },
  run_command: {
    icon: Terminal,
    label: 'Run Command',
    color: 'text-purple-600 dark:text-purple-400',
    verb: 'Run'
  },
  install_package: {
    icon: Package,
    label: 'Install Package',
    color: 'text-orange-600 dark:text-orange-400',
    verb: 'Install'
  },
  create_folder: {
    icon: FolderPlus,
    label: 'Create Folder',
    color: 'text-teal-600 dark:text-teal-400',
    verb: 'Create'
  }
};

export function ActionMessage({ actions, onApprove, onReject, className }: ActionMessageProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeActions = actions || [];
  
  if (safeActions.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)} data-testid="action-message">
      {safeActions.map((action) => {
        const config = ACTION_CONFIG[action.type];
        const Icon = config.icon;
        const isPending = action.status === 'pending';
        const isExecuted = action.status === 'executed';
        const isRejected = action.status === 'rejected';

        return (
          <div
            key={action.id}
            className={cn(
              "p-3 rounded-lg border-l-4 transition-all",
              isPending && "border-l-amber-500 bg-amber-50 dark:bg-amber-950/10",
              isExecuted && "border-l-green-500 bg-green-50 dark:bg-green-950/10",
              isRejected && "border-l-red-500 bg-red-50 dark:bg-red-950/10"
            )}
            data-testid={`action-${action.type}-${action.id}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-md",
                  isPending && "bg-amber-100 dark:bg-amber-900/20",
                  isExecuted && "bg-green-100 dark:bg-green-900/20",
                  isRejected && "bg-red-100 dark:bg-red-900/20"
                )}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <div className="font-medium text-[13px] text-[var(--ecode-text)]">
                    {config.verb}{' '}
                    {action.path && <span className="font-mono">{action.path}</span>}
                    {action.command && <span className="font-mono">{action.command}</span>}
                    {action.package && <span className="font-mono">{action.package}</span>}
                  </div>
                  <div className="text-[11px] text-[var(--ecode-text-secondary)]">
                    {action.description}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              {isPending && (
                <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  Requires Approval
                </Badge>
              )}
              {isExecuted && (
                <Badge variant="outline" className="text-[11px] flex items-center gap-1 bg-green-100 dark:bg-green-950">
                  <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                  Executed
                </Badge>
              )}
              {isRejected && (
                <Badge variant="outline" className="text-[11px] flex items-center gap-1 bg-red-100 dark:bg-red-950">
                  <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                  Rejected
                </Badge>
              )}
            </div>

            {/* File Diff (for edit_file with before/after) */}
            {action.type === 'edit_file' && action.oldContent && action.newContent && action.path && (
              <FileDiffViewer
                diff={{
                  path: action.path,
                  before: action.oldContent,
                  after: action.newContent,
                  language: action.language,
                  linesAdded: action.newContent.split('\n').length - action.oldContent.split('\n').length,
                  linesRemoved: Math.max(0, action.oldContent.split('\n').length - action.newContent.split('\n').length)
                }}
                defaultExpanded={false}
              />
            )}

            {/* Code Preview (for create_file or when no diff available) */}
            {action.content && action.type !== 'delete_file' && !action.oldContent && (
              <div className="mt-2 p-2 rounded-md bg-[#0e1525] border border-[#2a3040]">
                <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto max-h-40">
                  <code>{action.content.substring(0, 300)}{action.content.length > 300 ? '...' : ''}</code>
                </pre>
              </div>
            )}

            {/* Result (if executed) */}
            {action.result && (
              <div className={cn(
                "mt-2 p-2 rounded-md text-[11px]",
                action.result.success 
                  ? "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-950/20 text-red-800 dark:text-red-200"
              )}>
                {action.result.message || (action.result.success ? 'Executed successfully' : 'Execution failed')}
                {action.result.error && (
                  <div className="mt-1 font-mono text-[11px]">{action.result.error}</div>
                )}
              </div>
            )}

            {/* Approval Buttons */}
            {isPending && onApprove && onReject && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-[11px] min-h-[44px] h-auto py-2 touch-manipulation"
                  onClick={() => onApprove(action)}
                  data-testid={`approve-action-${action.id}`}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve & Execute
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-[11px] min-h-[44px] h-auto py-2 touch-manipulation"
                  onClick={() => onReject(action)}
                  data-testid={`reject-action-${action.id}`}
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
