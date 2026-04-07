import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  GitCommit,
  RotateCcw,
  Eye,
  Download,
  Clock,
  Save,
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FileDiff,
  X,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LazyMotionDiv } from '@/lib/motion';
import { useToast } from '@/hooks/use-toast';

interface APICheckpoint {
  id: number;
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'before_action' | 'error_recovery';
  createdAt: string;
  userId: number;
  projectId: number;
  filesSnapshot?: Record<string, any>;
  changedFiles?: string[];
  parentCheckpointId?: number;
}

interface Checkpoint {
  id: string;
  title: string;
  description?: string;
  timestamp: Date;
  author: string;
  type: 'auto' | 'manual' | 'deploy';
  changes: {
    additions: number;
    deletions: number;
    files: number;
  };
  files?: Array<{
    name: string;
    status: 'added' | 'modified' | 'deleted';
    additions: number;
    deletions: number;
  }>;
}

interface FileVersion {
  id: number;
  fileId: number;
  projectId: number;
  content: string;
  version: number;
  changeType: string;
  changeSummary?: string;
  userId?: number;
  checkpointId?: number;
  additions?: number;
  deletions?: number;
  createdAt: string;
  fileName?: string;
  filePath?: string;
}

interface FileWithHistory {
  id: number;
  name: string;
  path: string;
  updatedAt: string;
  versionCount: number;
  latestChange?: string;
}

interface CheckpointsAPIResponse {
  success: boolean;
  checkpoints: APICheckpoint[];
  count: number;
}

interface FileHistoryAPIResponse {
  success: boolean;
  history: FileVersion[];
  groupedByFile: Record<string, FileVersion[]>;
  count: number;
}

interface FilesWithHistoryAPIResponse {
  success: boolean;
  files: FileWithHistory[];
  count: number;
}

interface FileVersionsAPIResponse {
  success: boolean;
  versions: FileVersion[];
  count: number;
}

function mapAPICheckpointToUI(checkpoint: APICheckpoint): Checkpoint {
  const changedFilesCount = checkpoint.changedFiles?.length || 0;
  const filesSnapshot = checkpoint.filesSnapshot as Record<string, any> | undefined;
  
  return {
    id: String(checkpoint.id),
    title: checkpoint.name,
    description: checkpoint.description,
    timestamp: new Date(checkpoint.createdAt),
    author: 'User',
    type: checkpoint.type === 'automatic' ? 'auto' : checkpoint.type === 'manual' ? 'manual' : 'manual',
    changes: {
      additions: 0,
      deletions: 0,
      files: changedFilesCount || (filesSnapshot ? Object.keys(filesSnapshot).length : 0),
    },
    files: checkpoint.changedFiles?.map((fileName) => ({
      name: fileName,
      status: 'modified' as const,
      additions: 0,
      deletions: 0,
    })),
  };
}

function SkeletonShimmer({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("rounded-lg bg-gray-200 dark:bg-[#242b3d]", className)}
      animate={{
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-2 sm:p-3 space-y-2 sm:space-y-3" data-testid="history-loading-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="ml-6 sm:ml-10 p-2 sm:p-3 rounded-lg bg-gray-100 dark:bg-[#242b3d]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              <SkeletonShimmer className="w-4 sm:w-[18px] h-4 sm:h-[18px] rounded flex-shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <SkeletonShimmer className="h-4 w-24 sm:w-32" />
                <SkeletonShimmer className="h-3 w-32 sm:w-48" />
                <SkeletonShimmer className="h-3 w-20 sm:w-24" />
              </div>
            </div>
            <div className="space-y-2 hidden sm:block">
              <SkeletonShimmer className="h-3 w-16" />
              <SkeletonShimmer className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message = "No History Yet", description = "Your project checkpoints and version history will appear here as you work." }: { message?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 text-center" data-testid="history-empty-state">
      <History 
        className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-gray-400 dark:text-[#5c6670] opacity-40"
      />
      <h3 
        className="text-[15px] sm:text-[17px] font-medium leading-tight mb-2 text-gray-900 dark:text-white"
      >
        {message}
      </h3>
      <p 
        className="text-[13px] sm:text-[15px] leading-[18px] sm:leading-[20px] max-w-[200px] sm:max-w-[240px] text-gray-600 dark:text-[#9da2a6]"
      >
        {description}
      </p>
    </div>
  );
}

function DiffViewer({ oldContent, newContent, fileName }: { oldContent: string; newContent: string; fileName: string }) {
  const diffLines = useMemo(() => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const result: Array<{ type: 'unchanged' | 'added' | 'removed'; line: string; lineNumber: number }> = [];
    
    const maxLen = Math.max(oldLines.length, newLines.length);
    let oldIdx = 0;
    let newIdx = 0;
    
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      const oldLine = oldLines[oldIdx];
      const newLine = newLines[newIdx];
      
      if (oldLine === newLine) {
        result.push({ type: 'unchanged', line: oldLine || '', lineNumber: newIdx + 1 });
        oldIdx++;
        newIdx++;
      } else if (oldLine !== undefined && (newLine === undefined || !newLines.slice(newIdx).includes(oldLine))) {
        result.push({ type: 'removed', line: oldLine, lineNumber: oldIdx + 1 });
        oldIdx++;
      } else {
        result.push({ type: 'added', line: newLine || '', lineNumber: newIdx + 1 });
        newIdx++;
      }
    }
    
    return result;
  }, [oldContent, newContent]);

  const additions = diffLines.filter(l => l.type === 'added').length;
  const deletions = diffLines.filter(l => l.type === 'removed').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 sm:p-3 border-b border-gray-200 dark:border-[#3d4452]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileDiff className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-[11px] sm:text-[13px] font-medium text-gray-900 dark:text-white truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] flex-shrink-0">
          <span className="text-green-600">+{additions}</span>
          <span className="text-red-500">-{deletions}</span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-[10px] sm:text-[11px] overflow-x-auto">
          {diffLines.map((line, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex px-1 sm:px-2 py-0.5 min-w-max",
                line.type === 'added' && "bg-green-50 dark:bg-green-900/20",
                line.type === 'removed' && "bg-red-50 dark:bg-red-900/20"
              )}
            >
              <span className="w-6 sm:w-10 text-right pr-1 sm:pr-3 select-none text-gray-400 dark:text-gray-600 flex-shrink-0">
                {line.lineNumber}
              </span>
              <span className={cn(
                "w-3 sm:w-4 select-none flex-shrink-0",
                line.type === 'added' && "text-green-600",
                line.type === 'removed' && "text-red-500"
              )}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <pre className={cn(
                "flex-1 whitespace-pre-wrap break-all",
                line.type === 'added' && "text-green-700 dark:text-green-400",
                line.type === 'removed' && "text-red-600 dark:text-red-400",
                line.type === 'unchanged' && "text-gray-700 dark:text-gray-300"
              )}>
                {line.line}
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ReplitHistoryPanel({ projectId }: { projectId?: string }) {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Set<string>>(new Set());
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Checkpoint | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'checkpoints' | 'files'>('files');
  const [selectedFile, setSelectedFile] = useState<FileWithHistory | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<FileVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<FileVersion | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [restoreVersionTarget, setRestoreVersionTarget] = useState<FileVersion | null>(null);
  const [showVersionRestoreDialog, setShowVersionRestoreDialog] = useState(false);
  const { toast } = useToast();

  const numericProjectId = projectId ? parseInt(projectId, 10) : null;

  const { data: checkpointsData, isLoading: checkpointsLoading } = useQuery<CheckpointsAPIResponse>({
    queryKey: ['/api/projects', numericProjectId, 'checkpoints'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${numericProjectId}/checkpoints`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch checkpoints');
      }
      return response.json();
    },
    enabled: !!numericProjectId,
  });

  const { data: filesWithHistoryData, isLoading: filesLoading } = useQuery<FilesWithHistoryAPIResponse>({
    queryKey: ['/api/projects', numericProjectId, 'files-with-history'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${numericProjectId}/files-with-history`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch files with history');
      }
      return response.json();
    },
    enabled: !!numericProjectId && activeTab === 'files',
  });

  const { data: fileVersionsData, isLoading: versionsLoading } = useQuery<FileVersionsAPIResponse>({
    queryKey: ['/api/projects', numericProjectId, 'files', selectedFile?.id, 'history'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${numericProjectId}/files/${selectedFile!.id}/history`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch file versions');
      }
      return response.json();
    },
    enabled: !!numericProjectId && !!selectedFile?.id,
  });

  const checkpoints: Checkpoint[] = checkpointsData?.checkpoints?.map(mapAPICheckpointToUI) || [];
  const filesWithHistory: FileWithHistory[] = filesWithHistoryData?.files || [];
  const fileVersions: FileVersion[] = fileVersionsData?.versions || [];

  const createCheckpointMutation = useMutation({
    mutationFn: async (checkpointData: { name: string; description?: string }) => {
      return apiRequest<{ success: boolean; checkpoint: APICheckpoint }>('POST', '/api/checkpoints', {
        projectId: numericProjectId,
        name: checkpointData.name,
        description: checkpointData.description,
        type: 'manual',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', numericProjectId, 'checkpoints'] });
      toast({
        title: 'Checkpoint saved',
        description: 'Your manual checkpoint has been created successfully.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Failed to save checkpoint',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const restoreCheckpointMutation = useMutation({
    mutationFn: async (checkpointId: number) => {
      return apiRequest<{ success: boolean; message: string }>('POST', `/api/checkpoints/${checkpointId}/restore`, {
        restoreFiles: true,
        restoreDatabase: true,
        restoreEnvironment: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', numericProjectId, 'checkpoints'] });
      toast({
        title: 'Checkpoint restored',
        description: 'Your workspace has been restored to the selected checkpoint.',
      });
      setShowRestoreDialog(false);
      setRestoreTarget(null);
    },
    onError: (err) => {
      toast({
        title: 'Failed to restore checkpoint',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async ({ fileId, versionId }: { fileId: number; versionId: number }) => {
      return apiRequest<{ success: boolean }>('POST', `/api/projects/${numericProjectId}/files/${fileId}/versions/${versionId}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', numericProjectId, 'files', selectedFile?.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', numericProjectId, 'files-with-history'] });
      toast({
        title: 'Version restored',
        description: 'The file has been restored to the selected version.',
      });
      setShowVersionRestoreDialog(false);
      setRestoreVersionTarget(null);
    },
    onError: (err) => {
      toast({
        title: 'Failed to restore version',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleSaveCheckpoint = () => {
    createCheckpointMutation.mutate({
      name: `Manual checkpoint - ${new Date().toLocaleString()}`,
      description: 'Saved manually by user',
    });
  };

  const toggleCheckpointExpansion = (checkpointId: string) => {
    const newExpanded = new Set(expandedCheckpoints);
    if (newExpanded.has(checkpointId)) {
      newExpanded.delete(checkpointId);
    } else {
      newExpanded.add(checkpointId);
    }
    setExpandedCheckpoints(newExpanded);
  };

  const handleRestore = (checkpoint: Checkpoint) => {
    setRestoreTarget(checkpoint);
    setShowRestoreDialog(true);
  };

  const confirmRestore = () => {
    if (restoreTarget) {
      restoreCheckpointMutation.mutate(parseInt(restoreTarget.id, 10));
    }
  };

  const handleVersionRestore = (version: FileVersion) => {
    setRestoreVersionTarget(version);
    setShowVersionRestoreDialog(true);
  };

  const confirmVersionRestore = () => {
    if (restoreVersionTarget && selectedFile) {
      restoreVersionMutation.mutate({ 
        fileId: selectedFile.id, 
        versionId: restoreVersionTarget.id 
      });
    }
  };

  const handleViewDiff = useCallback((version: FileVersion) => {
    setSelectedVersion(version);
    const versionIndex = fileVersions.findIndex(v => v.id === version.id);
    const previousVersion = fileVersions[versionIndex + 1];
    setCompareVersion(previousVersion || null);
    setShowDiffDialog(true);
  }, [fileVersions]);

  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const diff = now.getTime() - dateObj.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getCheckpointIcon = (type: string) => {
    const iconClass = "w-[18px] h-[18px]";
    switch (type) {
      case 'auto':
        return <Clock className={cn(iconClass, "text-gray-500 dark:text-[#9da2a6]")} />;
      case 'manual':
        return <Save className={cn(iconClass, "text-blue-600 dark:text-[#0079f2]")} />;
      case 'deploy':
        return <GitCommit className={cn(iconClass, "text-green-500")} />;
      default:
        return <History className={cn(iconClass, "text-gray-500 dark:text-[#9da2a6]")} />;
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return <span className="text-green-500 font-bold">+</span>;
      case 'deleted':
        return <span className="text-red-500 font-bold">−</span>;
      case 'restored':
        return <RotateCcw className="w-3 h-3 text-blue-500" />;
      default:
        return <span className="text-blue-500 font-bold">~</span>;
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    const styles: Record<string, string> = {
      created: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      modified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      deleted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      restored: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return styles[changeType] || styles.modified;
  };

  const isLoading = activeTab === 'checkpoints' ? checkpointsLoading : filesLoading;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0e1525]" data-testid="history-panel">
        <div className="p-2 sm:p-3 min-h-[44px] sm:min-h-[48px] flex items-center border-b border-gray-200 dark:border-[#3d4452]">
          <div className="flex items-center gap-2">
            <History className="w-4 sm:w-[18px] h-4 sm:h-[18px] text-gray-500 dark:text-[#9da2a6]" />
            <h3 className="text-[15px] sm:text-[17px] font-medium leading-tight text-gray-900 dark:text-white">
              History
            </h3>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="history-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">History</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 rounded text-[10px] text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-sidebar-hover)]"
          data-testid="button-save-checkpoint"
          onClick={handleSaveCheckpoint}
          disabled={createCheckpointMutation.isPending || !numericProjectId}
        >
          {createCheckpointMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-0.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-0.5" />
          )}
          <span className="hidden sm:inline">{createCheckpointMutation.isPending ? 'Saving' : 'Save'}</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'checkpoints' | 'files')} className="flex-1 flex flex-col">
        <TabsList className="h-9 w-full flex justify-start px-2.5 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] rounded-none overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsTrigger value="files" className="text-[10px] px-2 gap-1 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none">
            <FileText className="w-3 h-3" />
            Files
          </TabsTrigger>
          <TabsTrigger value="checkpoints" className="text-[10px] px-2 gap-1 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none">
            <GitCommit className="w-3 h-3" />
            Checkpoints
          </TabsTrigger>
        </TabsList>

      {activeTab === 'files' && (
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Mobile: File selector dropdown */}
          <div className="sm:hidden p-2 border-b border-gray-200 dark:border-[#3d4452]">
            {filesWithHistory.length === 0 ? (
              <p className="text-[11px] text-gray-500 dark:text-[#9da2a6] text-center py-2">No files with history</p>
            ) : (
              <Select
                value={selectedFile?.id?.toString() || ''}
                onValueChange={(value) => {
                  const file = filesWithHistory.find(f => f.id.toString() === value);
                  setSelectedFile(file || null);
                }}
              >
                <SelectTrigger className="w-full h-11 text-[13px] touch-manipulation">
                  <SelectValue placeholder="Select a file to view history" />
                </SelectTrigger>
                <SelectContent>
                  {filesWithHistory.map((file) => (
                    <SelectItem key={file.id} value={file.id.toString()} className="min-h-[44px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 ml-auto">
                          {file.versionCount}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Desktop/Tablet: Sidebar file list */}
          <div className={cn(
            "hidden sm:block border-r border-gray-200 dark:border-[#3d4452] transition-all overflow-hidden",
            selectedFile ? "w-48 md:w-56 lg:w-64" : "w-full"
          )}>
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {filesWithHistory.length === 0 ? (
                  <EmptyState 
                    message="No File History" 
                    description="File versions will appear here as you make changes."
                  />
                ) : (
                  filesWithHistory.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 lg:p-2.5 rounded-lg text-left transition-colors min-h-[44px] touch-manipulation",
                        selectedFile?.id === file.id
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                          : "hover:bg-gray-100 dark:hover:bg-[#242b3d]"
                      )}
                    >
                      <FileText className="w-4 h-4 text-gray-500 dark:text-[#9da2a6] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] sm:text-[13px] font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-[#9da2a6] truncate">
                          {file.path}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="text-[10px] sm:text-[11px] px-1 sm:px-1.5">
                          {file.versionCount}
                        </Badge>
                        <ChevronRight className={cn(
                          "w-3 h-3 sm:w-4 sm:h-4 text-gray-400 transition-transform",
                          selectedFile?.id === file.id && "rotate-90"
                        )} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Version details panel - full width on mobile when file is selected */}
          {selectedFile ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-2 border-b border-gray-200 dark:border-[#3d4452] flex items-center justify-between min-h-[44px]">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-[11px] sm:text-[13px] font-medium text-gray-900 dark:text-white truncate">
                    {selectedFile.name}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 sm:h-6 sm:w-6 p-0 touch-manipulation"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                {versionsLoading ? (
                  <LoadingSkeleton />
                ) : fileVersions.length === 0 ? (
                  <EmptyState 
                    message="No Versions" 
                    description="No version history for this file yet."
                  />
                ) : (
                  <div className="p-2 space-y-2 sm:space-y-1">
                    {fileVersions.map((version, idx) => (
                      <div
                        key={version.id}
                        className="p-2 sm:p-2 rounded-lg bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-[#3d4452]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {getChangeTypeIcon(version.changeType)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <span className="text-[11px] sm:text-[13px] font-medium text-gray-900 dark:text-white">
                                  v{version.version}
                                </span>
                                <Badge className={cn("text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0", getChangeTypeBadge(version.changeType))}>
                                  {version.changeType}
                                </Badge>
                              </div>
                              {version.changeSummary && (
                                <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-[#9da2a6] mt-0.5 line-clamp-2">
                                  {version.changeSummary}
                                </p>
                              )}
                              <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-[#5c6670] mt-1">
                                {getTimeAgo(version.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-1 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 sm:h-7 text-[11px] px-2 sm:px-2 min-w-[44px] touch-manipulation"
                            onClick={() => handleViewDiff(version)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Diff
                          </Button>
                          {idx < fileVersions.length - 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 sm:h-7 text-[11px] px-2 sm:px-2 min-w-[44px] touch-manipulation"
                              onClick={() => handleVersionRestore(version)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            /* Mobile: Show message to select file when none selected */
            <div className="sm:hidden flex-1 flex items-center justify-center p-4">
              <EmptyState 
                message="Select a File" 
                description="Choose a file from the dropdown above to view its version history."
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'checkpoints' && (
        <ScrollArea className="flex-1">
          {checkpoints.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
              <div className="relative">
                <div className="absolute left-3 sm:left-5 top-0 bottom-0 w-px bg-gray-300 dark:bg-[#3d4452]" />

                {checkpoints.map((checkpoint, index) => (
                  <div key={checkpoint.id} className="relative mb-2 sm:mb-3" data-testid={`checkpoint-item-${checkpoint.id}`}>
                    <div className="absolute left-1.5 sm:left-3.5 w-3 h-3 rounded-full bg-gray-50 dark:bg-[#0e1525] border-2 border-gray-300 dark:border-[#3d4452]" />

                    <div className="ml-6 sm:ml-10">
                      <div
                        className={cn(
                          "p-2 sm:p-3 rounded-lg cursor-pointer transition-all touch-manipulation",
                          selectedCheckpoint === checkpoint.id 
                            ? "bg-gray-100 dark:bg-[#242b3d] border border-blue-500 dark:border-[#0079f2]"
                            : "bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-[#3d4452]"
                        )}
                        onClick={() => {
                          setSelectedCheckpoint(checkpoint.id);
                          if (checkpoint.files) {
                            toggleCheckpointExpansion(checkpoint.id);
                          }
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
                          <div className="flex items-start gap-2">
                            {getCheckpointIcon(checkpoint.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <h4 className="text-[13px] sm:text-[15px] font-medium leading-[18px] sm:leading-[20px] text-gray-900 dark:text-white">
                                  {checkpoint.title}
                                </h4>
                                {checkpoint.type === 'auto' && (
                                  <Badge variant="outline" className="text-[9px] sm:text-[11px] uppercase tracking-wider px-1 sm:px-1.5 py-0 rounded">
                                    Auto
                                  </Badge>
                                )}
                                {index === 0 && (
                                  <Badge className="text-[9px] sm:text-[11px] uppercase tracking-wider px-1 sm:px-1.5 py-0 rounded bg-amber-100 dark:bg-[#2B3245] text-amber-600 dark:text-[#f59e0b]">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              {checkpoint.description && (
                                <p className="text-[11px] sm:text-[13px] mt-0.5 text-gray-600 dark:text-[#9da2a6] line-clamp-2">
                                  {checkpoint.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] sm:text-[13px] text-gray-500 dark:text-[#5c6670]">
                                <span>{checkpoint.author}</span>
                                <span>•</span>
                                <span>{getTimeAgo(checkpoint.timestamp)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-[11px] sm:text-[13px] sm:text-right ml-6 sm:ml-2 flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className="text-green-500">+{checkpoint.changes.additions}</span>
                              <span className="text-red-500">-{checkpoint.changes.deletions}</span>
                            </div>
                            <div className="sm:mt-0.5 text-gray-500 dark:text-[#5c6670]">
                              {checkpoint.changes.files} file{checkpoint.changes.files !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        {checkpoint.files && expandedCheckpoints.has(checkpoint.id) && (
                          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 space-y-1 border-t border-gray-200 dark:border-[#3d4452]">
                            {checkpoint.files.map((file, fileIndex) => (
                              <div
                                key={fileIndex}
                                className="flex items-center justify-between py-1.5 sm:py-1 px-2 rounded-lg text-[11px] sm:text-[13px] bg-gray-100 dark:bg-[#242b3d] min-h-[36px] sm:min-h-0"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FileText className="w-4 sm:w-[18px] h-4 sm:h-[18px] text-gray-500 dark:text-[#9da2a6] flex-shrink-0" />
                                  <span className={cn(
                                    "truncate",
                                    file.status === 'added' && 'text-green-500',
                                    file.status === 'modified' && 'text-blue-600 dark:text-[#0079f2]',
                                    file.status === 'deleted' && 'text-red-500'
                                  )}>
                                    {file.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-[13px] flex-shrink-0">
                                  <span className="text-green-500">+{file.additions}</span>
                                  <span className="text-red-500">-{file.deletions}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {index > 0 && (
                          <div className="flex flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-[#3d4452]">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 sm:h-8 rounded-lg text-[11px] sm:text-[13px] min-w-[44px] touch-manipulation"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(checkpoint);
                              }}
                            >
                              <RotateCcw className="w-4 sm:w-[18px] h-4 sm:h-[18px] mr-1 sm:mr-1.5" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 sm:h-8 rounded-lg text-[11px] sm:text-[13px] min-w-[44px] touch-manipulation"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Eye className="w-4 sm:w-[18px] h-4 sm:h-[18px] mr-1 sm:mr-1.5" />
                              View Diff
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      )}
      </Tabs>

      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-[#3d4452] w-[calc(100vw-32px)] sm:w-full max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px] sm:text-[17px] font-medium leading-tight text-gray-900 dark:text-white">
              Restore Checkpoint
            </DialogTitle>
            <DialogDescription className="text-[13px] sm:text-[15px] leading-[18px] sm:leading-[20px] text-gray-600 dark:text-[#9da2a6]">
              Are you sure you want to restore to "{restoreTarget?.title}"? This will replace your current workspace with the selected checkpoint.
            </DialogDescription>
          </DialogHeader>
          
          {restoreTarget && (
            <div className="py-2 sm:py-3">
              <div className="p-2 sm:p-3 rounded-lg bg-amber-50 dark:bg-[#2B3245] border border-amber-500">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 sm:w-[18px] h-4 sm:h-[18px] mt-0.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] sm:text-[15px] font-medium leading-[18px] sm:leading-[20px] text-amber-600 dark:text-[#f59e0b]">
                      Warning
                    </p>
                    <p className="text-[11px] sm:text-[13px] mt-1 text-amber-600 dark:text-[#f59e0b]">
                      Your current unsaved changes will be lost. Consider saving a checkpoint first.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowRestoreDialog(false)}
              className="w-full sm:w-auto h-10 sm:h-9 touch-manipulation"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmRestore}
              disabled={restoreCheckpointMutation.isPending}
              className="w-full sm:w-auto h-10 sm:h-9 touch-manipulation"
            >
              {restoreCheckpointMutation.isPending ? (
                <>
                  <Loader2 className="w-4 sm:w-[18px] h-4 sm:h-[18px] mr-1.5 animate-spin" />
                  Restoring...
                </>
              ) : (
                'Restore Checkpoint'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionRestoreDialog} onOpenChange={setShowVersionRestoreDialog}>
        <DialogContent className="bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-[#3d4452] w-[calc(100vw-32px)] sm:w-full max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px] sm:text-[17px] font-medium leading-tight text-gray-900 dark:text-white">
              Restore Version
            </DialogTitle>
            <DialogDescription className="text-[13px] sm:text-[15px] leading-[18px] sm:leading-[20px] text-gray-600 dark:text-[#9da2a6]">
              Restore {selectedFile?.name} to version {restoreVersionTarget?.version}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2 sm:py-3">
            <div className="p-2 sm:p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-[11px] sm:text-[13px] text-blue-700 dark:text-blue-300">
                This will replace the current file content with the selected version. A new version entry will be created to track this restore.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowVersionRestoreDialog(false)}
              className="w-full sm:w-auto h-10 sm:h-9 touch-manipulation"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmVersionRestore}
              disabled={restoreVersionMutation.isPending}
              className="w-full sm:w-auto h-10 sm:h-9 touch-manipulation"
            >
              {restoreVersionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 sm:w-[18px] h-4 sm:h-[18px] mr-1.5 animate-spin" />
                  Restoring...
                </>
              ) : (
                'Restore Version'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-4xl h-[85vh] sm:h-[80vh] p-0 bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-[#3d4452]">
          <DialogHeader className="p-2 sm:p-4 border-b border-gray-200 dark:border-[#3d4452]">
            <DialogTitle className="flex items-center gap-2 text-[13px] sm:text-[17px] font-medium text-gray-900 dark:text-white">
              <FileDiff className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
              <span className="truncate">
                {selectedFile?.name} - v{selectedVersion?.version}
                {compareVersion && ` vs v${compareVersion.version}`}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {selectedVersion && (
              <DiffViewer
                oldContent={compareVersion?.content || ''}
                newContent={selectedVersion.content}
                fileName={selectedFile?.name || 'file'}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
