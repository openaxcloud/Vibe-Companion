// @ts-nocheck
import { ReactNode, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ReplitHeader } from '@/components/layout/ReplitHeader';
import { ReplitSidebar } from '@/components/layout/ReplitSidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import FileExplorer from '@/components/FileExplorer';
import CodeEditor from '@/components/CodeEditor';
import { ReplitAgentPanelV3 } from '@/components/ai/ReplitAgentPanelV3';
import { ConsolePanel } from '@/components/ide/ConsolePanel';
import { RunButton } from '@/components/RunButton';
import { WebPreview } from '@/components/WebPreview';
import { File } from '@shared/schema';
import { 
  FileCode,
  Terminal as TerminalIcon,
  Bot,
  X,
  PanelLeft,
  PanelLeftClose,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ECodeLoading } from '@/components/ECodeLoading';

interface ApplicationIDEWrapperProps {
  projectName: string;
  projectDescription: string;
  appComponent: ReactNode;
  projectId?: number;
}

export function ApplicationIDEWrapper({
  projectName,
  projectDescription,
  appComponent,
  projectId = 1
}: ApplicationIDEWrapperProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAIChat, setShowAIChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [isRunning, setIsRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | undefined>();

  // Fetch project files from backend - REAL DATA
  const { 
    data: files = [], 
    isLoading: isLoadingFiles,
    error: filesError,
  } = useQuery<File[]>({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId,
  });

  // Update file content mutation - REAL BACKEND
  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: number, content: string }) => {
      const res = await apiRequest('PATCH', `/api/files/${fileId}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({
        title: 'File saved',
        description: 'Your changes have been saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create file mutation - REAL BACKEND
  const createFileMutation = useMutation({
    mutationFn: async ({ name, isFolder, parentId }: { name: string, isFolder: boolean, parentId?: number | null }) => {
      const res = await apiRequest('POST', `/api/files/${projectId}`, {
        name,
        isFolder,
        parentId: parentId || null,
        content: isFolder ? null : '',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({
        title: 'File created',
        description: 'New file created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Set default selected file when files load (using useEffect to avoid render-time state mutation)
  useEffect(() => {
    if (!selectedFile && files.length > 0) {
      const defaultFile = files.find(f => !f.isDirectory);
      if (defaultFile) {
        setSelectedFile(defaultFile);
      }
    }
  }, [files, selectedFile]);

  // Handle runtime state changes
  const handleRunStateChange = (running: boolean, execId?: string) => {
    setIsRunning(running);
    setExecutionId(execId);
    if (running) {
      setShowTerminal(true);
    }
  };

  // Show loading state while files are fetching
  if (isLoadingFiles) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <ReplitHeader
          projectName={projectName}
          language="TypeScript"
          projectId={projectId}
          showMenu={true}
        />
        <div className="flex-1 flex items-center justify-center">
          <ECodeLoading message="Loading project files..." />
        </div>
      </div>
    );
  }

  // Show error state if files failed to load
  if (filesError) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <ReplitHeader
          projectName={projectName}
          language="TypeScript"
          projectId={projectId}
          showMenu={true}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[15px] font-semibold text-destructive mb-2">Failed to load project files</p>
            <p className="text-[13px] text-muted-foreground">{(filesError as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Replit Header */}
      <ReplitHeader
        projectName={projectName}
        language="TypeScript"
        projectId={projectId}
        showMenu={true}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <ReplitSidebar 
            onNavigate={() => {}} 
            currentPath={`/projects/${projectId}`}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* File Explorer Panel */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <div className="h-full flex flex-col border-r border-[var(--ecode-border)]">
                <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[var(--ecode-text)]">Files</span>
                    {files.length > 0 && (
                      <span className="text-[10px] text-[var(--ecode-text-muted)]">
                        ({files.length})
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-sidebar-hover)]"
                    onClick={() => setShowSidebar(!showSidebar)}
                  >
                    {showSidebar ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {files.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-[13px] text-muted-foreground">
                      No files in this project
                    </div>
                  ) : (
                    <FileExplorer
                      files={files}
                      projectId={projectId}
                      onFileSelect={(file) => {
                        setSelectedFile(file);
                        setActiveTab('code');
                      }}
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Editor/Preview Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex">
                      <button
                        className={cn(
                          "px-4 py-2 text-[13px] font-medium border-b-2 transition-colors",
                          activeTab === 'preview' 
                            ? "border-primary text-primary" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab('preview')}
                        data-testid="tab-preview"
                      >
                        Preview
                      </button>
                      <button
                        className={cn(
                          "px-4 py-2 text-[13px] font-medium border-b-2 transition-colors",
                          activeTab === 'code' 
                            ? "border-primary text-primary" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab('code')}
                        data-testid="tab-code"
                      >
                        Code
                      </button>
                    </div>
                    <div className="flex items-center gap-2 px-3">
                      <RunButton 
                        projectId={projectId}
                        onRunning={handleRunStateChange}
                        size="sm"
                      />
                      {isRunning && (
                        <div className="flex items-center gap-1 text-[11px] text-green-600">
                          <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                          Running
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'preview' ? (
                    <div className="h-full w-full">
                      {appComponent || (
                        <WebPreview 
                          projectId={projectId}
                          isRunning={isRunning}
                        />
                      )}
                    </div>
                  ) : selectedFile ? (
                    <CodeEditor
                      file={selectedFile}
                      onSave={(fileId, content) => {
                        updateFileMutation.mutate({ fileId, content });
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-[13px] text-muted-foreground">
                      Select a file to edit
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* AI Chat Panel */}
            {showAIChat && (
              <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                <div className="h-full flex flex-col border-l border-[var(--ecode-border)]">
                  <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
                      <span className="text-xs font-medium text-[var(--ecode-text)]">AI Assistant</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-sidebar-hover)]"
                      onClick={() => setShowAIChat(false)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ReplitAgentPanelV3
                      projectId={projectId}
                      selectedCode=""
                      className="h-full"
                    />
                  </div>
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>

          {/* Console/Terminal */}
          {showTerminal && (
            <div className="h-64 border-t">
              <div className="h-full flex flex-col">
                <div className="p-2 border-b flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="h-4 w-4" />
                    <span className="text-[13px] font-medium">Console</span>
                    {isRunning && (
                      <span className="text-[11px] text-green-600 flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowTerminal(false)}
                    data-testid="button-close-terminal"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ConsolePanel 
                    projectId={projectId}
                    isRunning={isRunning}
                    executionId={executionId}
                    className="h-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          {!showAIChat && (
            <Button
              size="icon"
              onClick={() => setShowAIChat(true)}
              className="shadow-lg"
            >
              <Bot className="h-4 w-4" />
            </Button>
          )}
          {!showTerminal && (
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowTerminal(true)}
              className="shadow-lg"
            >
              <TerminalIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}