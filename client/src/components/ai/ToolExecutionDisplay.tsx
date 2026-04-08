import { useState, useMemo } from 'react';
import { 
  CheckCircle2, XCircle, Loader2, FileEdit, Terminal, Search, Database, Globe,
  ChevronDown, ChevronRight, Filter, FileText, FolderOpen, Package, AlertTriangle,
  Clock, Trash2, Eye, FilePlus, FileCode, Command, Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ToolExecutionProps {
  id: string;
  tool: string;
  parameters: any;
  result?: any;
  success?: boolean;
  status: 'pending' | 'running' | 'complete' | 'error';
  metadata?: {
    executionTime?: number;
    filesChanged?: string[];
    commandOutput?: string;
  };
  error?: string;
  timestamp?: Date;
}

type FilterType = 'all' | 'files' | 'commands' | 'errors' | 'search';

const toolIcons: Record<string, React.ElementType> = {
  create_file: FilePlus,
  edit_file: FileEdit,
  read_file: Eye,
  delete_file: Trash2,
  list_directory: FolderOpen,
  run_command: Terminal,
  install_package: Package,
  web_search: Globe,
  search_code: Search,
  get_project_structure: Database,
  get_diagnostics: AlertTriangle,
};

const toolLabels: Record<string, string> = {
  create_file: 'Created File',
  edit_file: 'Edited File',
  read_file: 'Read File',
  delete_file: 'Deleted File',
  list_directory: 'Listed Directory',
  run_command: 'Executed Command',
  install_package: 'Installed Package',
  web_search: 'Web Search',
  search_code: 'Code Search',
  get_project_structure: 'Analyzed Project',
  get_diagnostics: 'Ran Diagnostics',
};

const toolCategories: Record<string, FilterType> = {
  create_file: 'files',
  edit_file: 'files',
  read_file: 'files',
  delete_file: 'files',
  list_directory: 'files',
  run_command: 'commands',
  install_package: 'commands',
  web_search: 'search',
  search_code: 'search',
  get_project_structure: 'files',
  get_diagnostics: 'commands',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function CompactToolExecution({ 
  tool, 
  parameters, 
  result, 
  success, 
  status, 
  metadata,
  error,
  timestamp
}: ToolExecutionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = toolIcons[tool] || Terminal;
  const label = toolLabels[tool] || tool;

  const getStatusIcon = () => {
    if (status === 'complete' && success) {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (status === 'error' || (status === 'complete' && !success)) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (status === 'running') {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (status === 'pending') {
      return <Clock className="h-4 w-4 text-slate-400" />;
    }
    return null;
  };

  const getCardStyle = () => {
    if (status === 'complete' && success) return 'border-emerald-800/60 bg-emerald-950/30';
    if (status === 'error' || (status === 'complete' && !success)) return 'border-red-800/60 bg-red-950/30';
    if (status === 'running') return 'border-blue-800/60 bg-blue-950/30';
    return 'border-border bg-card';
  };

  const getTarget = () => {
    if (tool === 'create_file' || tool === 'edit_file' || tool === 'read_file' || tool === 'delete_file') {
      return parameters.path;
    }
    if (tool === 'run_command') {
      return parameters.command?.slice(0, 80) + (parameters.command?.length > 80 ? '...' : '');
    }
    if (tool === 'install_package') {
      return parameters.package_name;
    }
    if (tool === 'web_search' || tool === 'search_code') {
      return parameters.query || parameters.pattern;
    }
    if (tool === 'list_directory') {
      return parameters.path || '.';
    }
    return null;
  };

  const target = getTarget();
  const hasDetails = result || error || metadata?.commandOutput || (metadata?.filesChanged && metadata.filesChanged.length > 0);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn("border transition-all", getCardStyle())}>
        <CollapsibleTrigger asChild>
          <div 
            className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg"
            data-testid={`tool-execution-${tool}`}
          >
            <div className={cn(
              "flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg",
              status === 'complete' && success ? "bg-emerald-900/50" : "",
              status === 'error' || (status === 'complete' && !success) ? "bg-red-900/50" : "",
              status === 'running' ? "bg-blue-900/50" : "",
              status === 'pending' ? "bg-muted" : ""
            )}>
              <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] sm:text-[13px] font-medium text-foreground">{label}</span>
                {getStatusIcon()}
              </div>
              {target && (
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                  {target}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {metadata?.executionTime != null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  <span className="text-[10px] sm:text-[11px] tabular-nums font-mono">
                    {formatDuration(metadata.executionTime)}
                  </span>
                </div>
              )}
              {hasDetails && (
                isExpanded ? 
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : 
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {hasDetails && (
          <CollapsibleContent>
            <div className="px-3 sm:px-4 pb-3 pt-0 border-t border-border/50 mt-0">
              <div className="pl-11 sm:pl-[52px] pt-2.5 space-y-2 text-[11px] sm:text-[12px]">
                {metadata?.filesChanged && metadata.filesChanged.length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-medium">Files changed:</span>
                    <ul className="mt-1 space-y-0.5">
                      {metadata.filesChanged.map((file, i) => (
                        <li key={i}>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] break-all font-mono">{file}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result?.stdout && (
                  <div>
                    <span className="text-muted-foreground font-medium">Output:</span>
                    <pre className="bg-muted p-2 sm:p-2.5 rounded-md mt-1 overflow-x-auto max-h-28 sm:max-h-36 overflow-y-auto text-[10px] sm:text-[11px] font-mono">
                      {result.stdout}
                    </pre>
                  </div>
                )}

                {result?.description && (
                  <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    {result.description}
                  </p>
                )}

                {(result?.size || result?.linesChanged) && (
                  <p className="text-muted-foreground">
                    {result.size ? `Size: ${result.size} bytes` : `Lines changed: ${result.linesChanged}`}
                  </p>
                )}

                {(status === 'error' || error) && (
                  <div className="text-red-600 dark:text-red-400">
                    <p className="flex items-center gap-1.5">
                      <XCircle className="h-3 w-3" />
                      {error || 'Execution failed'}
                    </p>
                    {result?.stderr && (
                      <pre className="bg-red-950/50 p-2 rounded-md mt-1 overflow-x-auto max-h-28 overflow-y-auto text-[10px] sm:text-[11px] font-mono">
                        {result.stderr}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </Card>
    </Collapsible>
  );
}

interface ToolExecutionListProps {
  toolExecutions: ToolExecutionProps[];
  showFilters?: boolean;
  compact?: boolean;
  maxVisible?: number;
}

export function ToolExecutionList({ 
  toolExecutions, 
  showFilters = true, 
  compact = true,
  maxVisible = 50
}: ToolExecutionListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => {
    const counts = { files: 0, commands: 0, search: 0, errors: 0, success: 0, running: 0 };
    (toolExecutions || []).forEach(exec => {
      const category = toolCategories[exec.tool] || 'commands';
      if (category === 'files') counts.files++;
      else if (category === 'commands') counts.commands++;
      else if (category === 'search') counts.search++;
      
      if (exec.status === 'error' || (exec.status === 'complete' && !exec.success)) {
        counts.errors++;
      } else if (exec.status === 'complete' && exec.success) {
        counts.success++;
      } else if (exec.status === 'running') {
        counts.running++;
      }
    });
    return counts;
  }, [toolExecutions]);

  const filteredExecutions = useMemo(() => {
    const safeExecutions = toolExecutions || [];
    if (filter === 'all') return safeExecutions;
    if (filter === 'errors') {
      return safeExecutions.filter(exec => 
        exec.status === 'error' || (exec.status === 'complete' && !exec.success)
      );
    }
    return safeExecutions.filter(exec => toolCategories[exec.tool] === filter);
  }, [toolExecutions, filter]);

  const visibleExecutions = showAll ? filteredExecutions : filteredExecutions.slice(0, maxVisible);
  const hasMore = (filteredExecutions || []).length > maxVisible && !showAll;

  if (!toolExecutions || toolExecutions.length === 0) {
    return null;
  }

  const filterButtons: { id: FilterType; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'all', label: 'All', icon: Filter, count: toolExecutions.length },
    { id: 'files', label: 'Files', icon: FileText, count: stats.files },
    { id: 'commands', label: 'Commands', icon: Command, count: stats.commands },
    { id: 'errors', label: 'Errors', icon: XCircle, count: stats.errors },
  ];

  return (
    <div className="space-y-2 sm:space-y-2.5" data-testid="tool-execution-list">
      {(toolExecutions.length > 1 || stats.errors > 0) && (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            {stats.success > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-950/50 text-emerald-500 border-emerald-800/50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {stats.success} done
              </Badge>
            )}
            {stats.running > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-blue-950/50 text-blue-400 border-blue-800/50 animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {stats.running} running
              </Badge>
            )}
            {stats.errors > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 bg-red-950/50 text-red-400 border-red-800/50">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.errors} failed
              </Badge>
            )}
          </div>
        </div>
      )}

      {showFilters && toolExecutions.length > 5 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">
            Agent Actions ({toolExecutions.length})
          </span>
        </div>
      )}

      {showFilters && toolExecutions.length > 5 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1">
          {filterButtons.map(({ id, label, icon: FIcon, count }) => (
            <Button
              key={id}
              variant={filter === id ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-7 px-2.5 text-[11px] shrink-0",
                filter === id && "bg-surface-tertiary-solid"
              )}
              onClick={() => setFilter(id)}
              disabled={count === 0 && id !== 'all'}
              data-testid={`filter-${id}`}
            >
              <FIcon className="h-3 w-3 mr-1" />
              {label}
              {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {visibleExecutions.map((execution) => (
          compact ? (
            <CompactToolExecution key={execution.id} {...execution} />
          ) : (
            <ToolExecutionDisplay key={execution.id} {...execution} />
          )
        ))}
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-[12px] text-muted-foreground"
          onClick={() => setShowAll(true)}
          data-testid="button-show-more"
        >
          Show {filteredExecutions.length - maxVisible} more actions
        </Button>
      )}
    </div>
  );
}

export function ToolExecutionDisplay({ 
  tool, 
  parameters, 
  result, 
  success, 
  status, 
  metadata,
  error 
}: ToolExecutionProps) {
  const Icon = toolIcons[tool] || Terminal;
  const label = toolLabels[tool] || tool;

  const getStatusIcon = () => {
    if (status === 'complete' && success) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (status === 'error' || !success) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (status === 'running') {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    return null;
  };

  const getStatusColor = () => {
    if (status === 'complete' && success) return 'border-green-800/60 bg-green-950/30';
    if (status === 'error' || !success) return 'border-red-800/60 bg-red-950/30';
    if (status === 'running') return 'border-blue-800/60 bg-blue-950/30';
    return 'border-border';
  };

  return (
    <Card className={cn('border-l-2', getStatusColor())}>
      <CardHeader className="p-3 sm:p-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg",
            status === 'complete' && success ? "bg-green-900/50" : "",
            status === 'error' || !success ? "bg-red-900/50" : "",
            status === 'running' ? "bg-blue-900/50" : "",
            "bg-muted"
          )}>
            <Icon className="h-[18px] w-[18px] text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {metadata?.executionTime != null && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" />
                <span className="text-[11px] tabular-nums font-mono">
                  {formatDuration(metadata.executionTime)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="space-y-2">
          {(tool === 'create_file' || tool === 'edit_file') && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">Path: </span>
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{parameters.path}</code>
              {parameters.description && (
                <p className="text-muted-foreground mt-1">{parameters.description}</p>
              )}
            </div>
          )}

          {(tool === 'run_command' || tool === 'install_package') && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">Command: </span>
              <code className="bg-muted px-2 py-1.5 rounded text-[11px] block mt-1 overflow-x-auto font-mono">
                {parameters.command || `npm install ${parameters.package_name}${parameters.dev ? ' --save-dev' : ''}`}
              </code>
              {parameters.description && (
                <p className="text-muted-foreground mt-1">{parameters.description}</p>
              )}
            </div>
          )}

          {(tool === 'web_search' || tool === 'search_code') && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">Query: </span>
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{parameters.query || parameters.pattern}</code>
            </div>
          )}

          {status === 'complete' && result && (
            <div className="mt-2 pt-2 border-t text-[12px]">
              {metadata?.filesChanged && metadata.filesChanged.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Files changed:</span>
                  <ul className="mt-1 space-y-1">
                    {metadata.filesChanged.map((file, i) => (
                      <li key={i} className="ml-2">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{file}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.stdout && (
                <div className="mt-2">
                  <span className="text-muted-foreground">Output:</span>
                  <pre className="bg-muted p-2.5 rounded-md text-[11px] mt-1 overflow-x-auto max-h-36 overflow-y-auto font-mono">
                    {result.stdout}
                  </pre>
                </div>
              )}

              {result.description && (
                <p className="text-green-600 dark:text-green-400 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  {result.description}
                </p>
              )}

              {(result.size || result.linesChanged) && (
                <p className="text-muted-foreground mt-1">
                  {result.size ? `Size: ${result.size} bytes` : `Lines changed: ${result.linesChanged}`}
                </p>
              )}

              {result.message && (
                <p className="text-muted-foreground mt-1">{result.message}</p>
              )}
            </div>
          )}

          {(status === 'error' || error) && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-red-600 dark:text-red-400 text-[12px] flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />
                {error || 'Tool execution failed'}
              </p>
              {result?.stderr && (
                <pre className="bg-red-950/50 p-2.5 rounded-md text-[11px] mt-1 overflow-x-auto max-h-36 overflow-y-auto font-mono">
                  {result.stderr}
                </pre>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
