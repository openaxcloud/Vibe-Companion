import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Brain,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  FolderOpen,
  Clock,
  Sparkles,
  Eye
} from 'lucide-react';

interface MemoryBankFile {
  name: string;
  content: string;
  lastUpdated: string;
  size: number;
}

interface MemoryBank {
  projectId: number;
  files: MemoryBankFile[];
  totalSize: number;
  initialized: boolean;
  lastUpdated: string;
}

interface MemoryBankStatus {
  initialized: boolean;
}

interface MemoryBankPanelProps {
  projectId: number | string;
  className?: string;
  compact?: boolean;
}

export function useMemoryBankStatus(projectId: number | string) {
  return useQuery<MemoryBankStatus>({
    queryKey: ['/api/memory-bank', projectId, 'status'],
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useMemoryBank(projectId: number | string) {
  return useQuery<MemoryBank>({
    queryKey: ['/api/memory-bank', projectId],
    enabled: !!projectId,
    staleTime: 10000,
    retry: 1,
  });
}

export function MemoryBankStatusBadge({ 
  initialized, 
  autoUpdated = false,
  className 
}: { 
  initialized: boolean; 
  autoUpdated?: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={initialized ? "default" : "outline"}
            className={cn(
              "gap-1",
              initialized 
                ? autoUpdated 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-green-600 hover:bg-green-700" 
                : "text-muted-foreground border-muted",
              className
            )}
            data-testid="badge-memory-bank-status"
          >
            {autoUpdated ? (
              <Sparkles className="h-3 w-3" />
            ) : (
              <Brain className="h-3 w-3" />
            )}
            {initialized 
              ? autoUpdated 
                ? "Auto-Updated" 
                : "Memory Active" 
              : "Memory N/A"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {initialized 
            ? autoUpdated
              ? "Memory Bank auto-updates as you work with AI"
              : "Memory Bank is active - project context persists across AI sessions"
            : "Memory Bank is initializing - AI context will be available shortly"
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MemoryBankPanel({ projectId, className, compact = false }: MemoryBankPanelProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  
  const { data: memoryBank, isLoading, error, refetch } = useMemoryBank(projectId);
  const { data: status } = useMemoryBankStatus(projectId);

  const handleRefetch = async () => {
    await refetch();
  };

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className={cn("w-full justify-between p-2", className)}
            data-testid="button-memory-bank-toggle"
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span>Memory Bank</span>
            </div>
            <div className="flex items-center gap-2">
              {status?.initialized && (
                <Badge variant="secondary" className="text-[11px] gap-1">
                  <Sparkles className="h-3 w-3" />
                  Auto
                </Badge>
              )}
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <MemoryBankContent 
            memoryBank={memoryBank}
            isLoading={isLoading}
            error={error}
          />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-[15px]">Memory Bank</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {status?.initialized && (
              <MemoryBankStatusBadge initialized={true} autoUpdated={true} />
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleRefetch}
                    data-testid="button-memory-bank-refresh"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh memory bank</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <CardDescription className="flex items-center gap-2">
          <Eye className="h-3 w-3" />
          Read-only view - automatically updated by AI actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MemoryBankContent 
          memoryBank={memoryBank}
          isLoading={isLoading}
          error={error}
        />
      </CardContent>
    </Card>
  );
}

interface MemoryBankContentProps {
  memoryBank: MemoryBank | undefined;
  isLoading: boolean;
  error: Error | null;
}

function MemoryBankContent({
  memoryBank,
  isLoading,
  error,
}: MemoryBankContentProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (filename: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || !memoryBank?.initialized) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-muted">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        </div>
        <div>
          <h4 className="font-medium">Initializing Memory Bank...</h4>
          <p className="text-[13px] text-muted-foreground mt-1">
            Setting up persistent AI context for your project
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[250px] sm:max-h-[300px] md:max-h-[400px]">
      <div className="space-y-2">
        {memoryBank.files.map((file) => (
          <Collapsible
            key={file.name}
            open={expandedFiles.has(file.name)}
            onOpenChange={() => toggleFile(file.name)}
          >
            <div className="border rounded-lg">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto"
                  data-testid={`button-memory-file-${file.name}`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-[13px]">{file.name}</span>
                    {file.name === 'activeContext.md' && (
                      <Badge variant="secondary" className="text-[11px] gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        <Sparkles className="h-2.5 w-2.5" />
                        Auto
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-[11px] text-muted-foreground">
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(file.lastUpdated).toLocaleDateString()}</span>
                      <span className="text-muted-foreground/50">•</span>
                    </span>
                    <span>{formatBytes(file.size)}</span>
                    {expandedFiles.has(file.name) ? (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3">
                  <div className="space-y-2">
                    <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {file.content.substring(0, 1500)}
                      {file.content.length > 1500 && (
                        <span className="text-muted-foreground italic">
                          {'\n\n'}... ({file.content.length - 1500} more characters)
                        </span>
                      )}
                    </pre>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Read-only
                      </span>
                      <span>
                        Last updated: {new Date(file.lastUpdated).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
        
        {memoryBank.files.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-[13px]">No memory bank files yet</p>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex justify-between items-center">
        <span>Total: {memoryBank.files.length} files</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            Auto-updating
          </Badge>
          <span>{formatBytes(memoryBank.totalSize)}</span>
        </div>
      </div>
    </ScrollArea>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default MemoryBankPanel;
