import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X,
  Filter,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Problem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line: number;
  column: number;
  source: string;
}

interface ReplitProblemsPanelProps {
  projectId?: string;
  onFileNavigate?: (file: string, line: number, column: number) => void;
}

export function ReplitProblemsPanel({ projectId, onFileNavigate }: ReplitProblemsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings' | 'info'>('all');
  const [groupByFile, setGroupByFile] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Fetch real problems from LSP/linting backend
  const { data: diagnostics = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/workspace/diagnostics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiRequest('GET', `/api/workspace/projects/${projectId}/diagnostics`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 5s to 30s
    refetchIntervalInBackground: false,
  });

  // Transform diagnostics to Problem format
  const problems: Problem[] = diagnostics.map(d => ({
    id: d.id,
    severity: d.severity as 'error' | 'warning' | 'info',
    message: d.message,
    file: d.filePath,
    line: d.startLine,
    column: d.startColumn,
    source: d.source || 'LSP',
  }));

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-status-critical" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      case 'info':
        return <Info className="h-4 w-4 text-status-info" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredProblems = problems.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'errors') return p.severity === 'error';
    if (filter === 'warnings') return p.severity === 'warning';
    if (filter === 'info') return p.severity === 'info';
    return true;
  });

  const problemCounts = {
    errors: problems.filter(p => p.severity === 'error').length,
    warnings: problems.filter(p => p.severity === 'warning').length,
    info: problems.filter(p => p.severity === 'info').length,
  };

  const groupedProblems = groupByFile
    ? filteredProblems.reduce((acc, problem) => {
        if (!acc[problem.file]) {
          acc[problem.file] = [];
        }
        acc[problem.file].push(problem);
        return acc;
      }, {} as Record<string, Problem[]>)
    : { 'All Problems': filteredProblems };

  const toggleFileExpansion = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedFiles(newExpanded);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      {/* Header */}
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Problems</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setGroupByFile(!groupByFile)}
          className="h-7 px-2 text-[10px]"
        >
          <Filter className="h-3 w-3 mr-1" />
          {groupByFile ? 'Ungroup' : 'Group'}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="h-8 px-2.5 flex items-center gap-1.5 border-b border-[var(--ecode-border)] shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <Badge
          variant={filter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer text-[10px] h-5 px-1.5 whitespace-nowrap"
          onClick={() => setFilter('all')}
        >
          All ({problems.length})
        </Badge>
        <Badge
          variant={filter === 'errors' ? 'destructive' : 'outline'}
          className="cursor-pointer text-[10px] h-5 px-1.5 whitespace-nowrap"
          onClick={() => setFilter('errors')}
        >
          Errors ({problemCounts.errors})
        </Badge>
        <Badge
          variant={filter === 'warnings' ? 'default' : 'outline'}
          className={cn(
            "cursor-pointer text-[10px] h-5 px-1.5 whitespace-nowrap",
            filter === 'warnings' && "bg-status-warning/100 hover:bg-status-warning"
          )}
          onClick={() => setFilter('warnings')}
        >
          Warnings ({problemCounts.warnings})
        </Badge>
        <Badge
          variant={filter === 'info' ? 'default' : 'outline'}
          className={cn(
            "cursor-pointer text-[10px] h-5 px-1.5 whitespace-nowrap",
            filter === 'info' && "bg-status-info hover:bg-status-info"
          )}
          onClick={() => setFilter('info')}
        >
          Info ({problemCounts.info})
        </Badge>
      </div>

      {/* Problems List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="text-center py-8 text-[var(--ecode-text-secondary)] text-[13px]">
              Loading problems...
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="text-center py-8 text-[var(--ecode-text-secondary)] text-[13px]">
              No problems found 🎉
            </div>
          ) : (
            Object.entries(groupedProblems).map(([file, fileProblems]) => (
              <div key={file} className="mb-2">
                {groupByFile && (
                  <button
                    onClick={() => toggleFileExpansion(file)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--ecode-sidebar-hover)] rounded text-[13px] font-[family-name:var(--ecode-font-sans)]"
                    data-testid={`problems-file-${file}`}
                  >
                    {expandedFiles.has(file) ? (
                      <ChevronDown className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                    )}
                    <FileText className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                    <span className="text-[var(--ecode-text)] truncate flex-1 text-left">
                      {file}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                      {fileProblems.length}
                    </Badge>
                  </button>
                )}

                {(!groupByFile || expandedFiles.has(file)) && (
                  <div className="space-y-1 ml-6">
                    {fileProblems.map((problem) => (
                      <button
                        key={problem.id}
                        onClick={() => onFileNavigate?.(problem.file, problem.line, problem.column)}
                        className="w-full flex items-start gap-2 px-2 py-2 hover:bg-[var(--ecode-sidebar-hover)] rounded text-left group"
                        data-testid={`problem-${problem.id}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {getSeverityIcon(problem.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[var(--ecode-text)] font-[family-name:var(--ecode-font-sans)] leading-tight">
                            {problem.message}
                          </p>
                          <p className="text-[11px] text-[var(--ecode-text-secondary)] mt-1 font-[family-name:var(--ecode-font-mono)]">
                            {!groupByFile && `${problem.file} `}
                            [{problem.line}, {problem.column}]
                            <span className="ml-2 opacity-70">{problem.source}</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
