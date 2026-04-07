import { useEffect, useState, useRef, useCallback } from "react";
import { EditorView } from "@codemirror/view";
import { CM6Editor } from "./CM6Editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Square,
  Save,
  Settings,
  Maximize2,
  Minimize2,
  Users,
  ChevronDown,
  FileText,
  Clock,
  Zap,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditorFile {
  id: number;
  path: string;
  name: string;
  content: string;
  language: string;
  lastModified: Date;
  isReadOnly?: boolean;
}

interface EditorUser {
  id: number;
  username: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

interface ReplitMonacoEditorProps {
  projectId: string | number;
  fileId?: number;
  onRunCode?: () => void;
  onStopCode?: () => void;
  isRunning?: boolean;
  showCollaborators?: boolean;
  theme?: "dark" | "light";
  enableCollaboration?: boolean;
  onEditorMount?: (editor: EditorView) => void;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'dockerfile': 'dockerfile',
    'vue': 'vue',
    'svelte': 'svelte',
  };
  return languageMap[ext] || 'plaintext';
}

export function ReplitMonacoEditor({
  projectId,
  fileId,
  onRunCode,
  onStopCode,
  isRunning = false,
  showCollaborators = true,
  theme = "dark",
  enableCollaboration = true,
  onEditorMount
}: ReplitMonacoEditorProps) {
  const editorViewRef = useRef<EditorView | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentFile, setCurrentFile] = useState<EditorFile | null>(null);
  const [collaborators] = useState<EditorUser[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const { toast } = useToast();

  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: file, isLoading: fileLoading, error: fileError, refetch: refetchFile } = useQuery<EditorFile>({
    queryKey: [`/api/projects/${projectId}/files/${fileId}`],
    enabled: !!fileId && !!projectId,
    retry: 2,
    retryDelay: 500,
  });

  useEffect(() => {
    if (!file && fileError && !currentFile && fileId) {
      setCurrentFile({
        id: fileId as number,
        path: 'untitled',
        name: 'untitled',
        content: '',
        language: 'typescript',
        lastModified: new Date(),
      } as EditorFile);
    }
  }, [file, fileError, currentFile, fileId]);

  useEffect(() => {
    if (file) {
      setCurrentFile(file);
      setEditorContent(file.content);
    }
  }, [file]);

  const saveFileMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('PUT', `/api/files/${fileId}`, { content });
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      toast({
        title: "File saved",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditorMount = useCallback((view: EditorView) => {
    editorViewRef.current = view;
    onEditorMount?.(view);
  }, [onEditorMount]);

  const handleChange = useCallback((value: string) => {
    setEditorContent(value);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!fileId) return;
    saveFileMutation.mutate(editorContent);
  }, [fileId, editorContent, saveFileMutation]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onRunCode?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        onStopCode?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onRunCode, onStopCode]);

  useEffect(() => {
    if (fileLoading && fileId) {
      setLoadingTimedOut(false);
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingTimedOut(true);
      }, 10000);
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [fileLoading, fileId]);

  if (!fileId || !projectId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--ecode-editor-bg)]" data-testid="editor-no-file">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-[var(--ecode-text-secondary)] opacity-40" />
          <p className="text-[var(--ecode-text-secondary)] text-[13px]">Select a file to edit</p>
        </div>
      </div>
    );
  }

  if (fileLoading && loadingTimedOut) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--ecode-editor-bg)]" data-testid="editor-load-timeout">
        <div className="text-center">
          <p className="text-[var(--ecode-text-secondary)] mb-3">Could not load editor</p>
          <button
            onClick={() => { setLoadingTimedOut(false); refetchFile(); }}
            className="px-4 py-2 rounded-md bg-[var(--ecode-accent)] text-white text-[13px] hover:opacity-90"
            data-testid="button-retry-editor"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (fileLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--ecode-editor-bg)]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[var(--ecode-accent)] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--ecode-text-secondary)]">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!file && !currentFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--ecode-editor-bg)]">
        <div className="text-center">
          <p className="text-[var(--ecode-text-secondary)]">No file selected</p>
        </div>
      </div>
    );
  }

  const activeFile = file || currentFile;
  
  if (!activeFile) {
    return null;
  }

  const language = activeFile.language || getLanguageFromFilename(activeFile.name);

  return (
    <TooltipProvider>
      <div className={`flex flex-col bg-[var(--ecode-editor-bg)] ${isFullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`} data-testid="monaco-editor-container">
        <div className="h-12 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] flex items-center justify-between px-4" data-testid="editor-toolbar">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
              <span className="text-[13px] font-medium text-[var(--ecode-text)]" data-testid="text-filename">{activeFile.name}</span>
              {hasUnsavedChanges && (
                <div className="h-2 w-2 bg-[var(--ecode-warning)] rounded-full" data-testid="indicator-unsaved"></div>
              )}
              <Badge variant="outline" className="text-[11px]" data-testid="badge-language">
                {language}
              </Badge>
            </div>

            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={saveFileMutation.isPending || !hasUnsavedChanges}
                    className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                    data-testid="button-save-file"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save (Ctrl+S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={isRunning ? onStopCode : onRunCode}
                    className="text-[var(--ecode-green)] hover:bg-[var(--ecode-green)]/10"
                    data-testid="button-run-code"
                  >
                    {isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isRunning ? "Stop (Ctrl+Shift+Enter)" : "Run (Ctrl+Enter)"}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-[11px] text-[var(--ecode-text-secondary)]">
              <Clock className="h-3 w-3" />
              <span>Saved {formatLastSaved(lastSaved)}</span>
            </div>

            {showCollaborators && collaborators.length > 0 && (
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                <div className="flex -space-x-2">
                  {collaborators.slice(0, 3).map((user) => (
                    <Tooltip key={user.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-6 w-6 rounded-full border-2 border-[var(--ecode-surface)] flex items-center justify-center text-[11px] font-medium text-white"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{user.username}</TooltipContent>
                    </Tooltip>
                  ))}
                  {collaborators.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-[var(--ecode-text-secondary)] border-2 border-[var(--ecode-surface)] flex items-center justify-center text-[11px] font-medium text-white">
                      +{collaborators.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  data-testid="button-editor-settings"
                >
                  <Settings className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
                <DropdownMenuItem onClick={toggleFullscreen} className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" data-testid="button-toggle-fullscreen">
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="mr-2 h-4 w-4" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Fullscreen
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden" data-testid="editor-content">
          <CM6Editor
            value={editorContent}
            language={language}
            onChange={handleChange}
            onMount={handleEditorMount}
            readOnly={activeFile.isReadOnly}
            theme={theme}
            height="100%"
            className="h-full"
            lineWrapping={true}
            autoFocus={true}
          />
          
          {isRunning && (
            <div className="absolute top-2 right-2 flex items-center space-x-2 bg-[var(--ecode-green)] text-white px-3 py-1 rounded-md text-[13px]" data-testid="indicator-running">
              <Zap className="h-3 w-3 animate-pulse" />
              <span>Running</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function CollaborativeReplitMonacoEditor(props: ReplitMonacoEditorProps) {
  return <ReplitMonacoEditor {...props} />;
}
