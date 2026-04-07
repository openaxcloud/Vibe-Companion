import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Route, Switch } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EditorWorkspace } from '@/components/EditorWorkspace';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Package, Key, FileCode, Terminal as TerminalIcon, GitBranch, Database, Rocket, Bot, Search, Users } from 'lucide-react';
import { ECodeLoading } from '@/components/ECodeLoading';
import { File, Project } from '@shared/schema';
import TopNavbar from '@/components/TopNavbar';
import TerminalPanel from '@/components/TerminalPanel';
import { RunButton } from '@/components/RunButton';
import { ResponsiveTerminal } from '@/components/editor/ResponsiveTerminal';
import { ResponsiveWebPreview } from '@/components/editor/ResponsiveWebPreview';
import { MobileEditorTabs } from '@/components/editor/MobileEditorTabs';
import { EnvironmentVariables } from '@/components/EnvironmentVariables';
import { PackageManager } from '@/components/PackageManager';
import { WebPreview } from '@/components/WebPreview';
import { Shell } from '@/components/Shell';
import { ReplitConsole } from '@/components/editor/ReplitConsole';
import { GlobalSearch } from '@/components/GlobalSearch';
import { GitIntegration } from '@/components/GitIntegration';
import { ReplitDB } from '@/components/ReplitDB';
import { DeploymentManager } from '@/components/DeploymentManager';
import { ImportExport } from '@/components/ImportExport';
import { AIAssistant } from '@/components/AIAssistant';
import { BillingSystem } from '@/components/BillingSystem';
import { ExtensionsMarketplace } from '@/components/ExtensionsMarketplace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ReplitEditorLayout } from '@/components/editor/ReplitEditorLayout';
import { ReplitFileSidebar } from '@/components/editor/ReplitFileSidebar';
import { ReplitCodeEditor } from '@/components/editor/ReplitCodeEditor';
import { Globe, MoreVertical, Beaker, Package as PackageIcon, Bug } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollaborationPresence } from '@/components/editor/CollaborationPresence';
import { DatabaseBrowser } from '@/components/DatabaseBrowser';
import { PackageViewer } from '@/components/PackageViewer';
import { DebuggerPanel } from '@/components/DebuggerPanel';
import { TestRunner } from '@/components/TestRunner';

export default function EditorPage() {
  const { projectId } = useParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Parse project ID
  const projectIdNum = projectId ? parseInt(projectId) : 0;
  
  // Get project details
  const { 
    data: project, 
    isLoading: isLoadingProject,
    error: projectError,
  } = useQuery({
    queryKey: ['/api/projects', projectIdNum],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectIdNum}`);
      return res.json();
    },
    enabled: !!projectIdNum && !!user,
  });
  
  // Get project files
  const { 
    data: files = [], 
    isLoading: isLoadingFiles,
    error: filesError,
  } = useQuery<File[]>({
    queryKey: ['/api/projects', projectIdNum, 'files'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectIdNum}/files`);
      return res.json();
    },
    enabled: !!projectIdNum && !!user,
  });
  
  // Update file content mutation
  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: number, content: string }) => {
      const res = await apiRequest('PATCH', `/api/files/${fileId}`, { content });
      return res.json();
    },
    onSuccess: (data) => {
      if (projectId) {
        const projectIdNum = parseInt(projectId);
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectIdNum, 'files'] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Create file mutation
  const createFileMutation = useMutation({
    mutationFn: async ({ name, isFolder, parentId }: { name: string, isFolder: boolean, parentId?: number | null }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/files`, {
        name,
        isFolder,
        parentId: parentId || null,
        content: '',
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (projectId) {
        const projectIdNum = parseInt(projectId);
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectIdNum, 'files'] });
      }
      toast({
        title: 'File created',
        description: `Created ${data.name} successfully`,
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
  
  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest('DELETE', `/api/files/${fileId}`);
      return res.json();
    },
    onSuccess: () => {
      if (projectId) {
        const projectIdNum = parseInt(projectId);
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectIdNum, 'files'] });
      }
      toast({
        title: 'File deleted',
        description: 'File was deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Handle file update
  const handleFileUpdate = async (fileId: number, content: string) => {
    await updateFileMutation.mutateAsync({ fileId, content });
  };
  
  // Handle file creation
  const handleFileCreate = async (name: string, isFolder: boolean, parentId?: number | null) => {
    await createFileMutation.mutateAsync({ name, isFolder, parentId });
  };
  
  // Handle file deletion
  const handleFileDelete = async (fileId: number) => {
    await deleteFileMutation.mutateAsync(fileId);
  };
  
  // Show loading state
  if (isLoadingProject || isLoadingFiles) {
    return (
      <div className="h-screen flex items-center justify-center">
        <ECodeLoading size="lg" text="Loading editor..." />
      </div>
    );
  }
  
  // Show error state
  if (projectError || filesError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl text-destructive">!</span>
          </div>
          <h2 className="text-xl font-semibold">Error Loading Project</h2>
          <p className="text-muted-foreground">
            {projectError ? (projectError as Error).message : (filesError as Error).message}
          </p>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }
  
  // Track active file for Navbar
  const [activeFile, setActiveFile] = useState<File | undefined>(undefined);
  const [showNixConfig, setShowNixConfig] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showReplitDB, setShowReplitDB] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [isProjectRunning, setIsProjectRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | undefined>();
  const [rightPanelTab, setRightPanelTab] = useState('preview');
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | undefined>(undefined);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState('code');

  // Update active file handler
  const handleActiveFileChange = (file: File | undefined) => {
    setActiveFile(file);
  };
  
  // UI toggle handlers
  const handleNixConfigOpen = () => {
    setShowNixConfig(true);
  };
  
  const handleCommandPaletteOpen = () => {
    setShowCommandPalette(true);
  };
  
  const handleKeyboardShortcutsOpen = () => {
    setShowKeyboardShortcuts(true);
  };
  
  const handleDatabaseOpen = () => {
    setShowReplitDB(true);
  };
  
  const handleCollaborationOpen = () => {
    setShowCollaboration(true);
  };

  // Keyboard shortcut handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global search: Ctrl/Cmd + Shift + F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      // AI Assistant: Ctrl/Cmd + I
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setShowAIAssistant(!showAIAssistant);
        setRightPanelTab('ai');
      }
      // Command Palette: Ctrl/Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAIAssistant]);
  
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const isTablet = useMediaQuery('(max-width: 1280px)');

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--ecode-background)]">
      {/* E-Code-style Header - Responsive */}
      <div className="h-12 flex items-center justify-between border-b border-[var(--ecode-border)] bg-[var(--ecode-background)] px-3 lg:px-4">
        <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
          {/* Project name and controls */}
          <div className="flex items-center gap-1 lg:gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="h-8 w-8 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-sm lg:text-base font-medium truncate max-w-[100px] sm:max-w-[150px] lg:max-w-none">
              {project?.name || ''}
            </h1>
          </div>
          
          {/* Run button - E-Code style */}
          <RunButton 
            projectId={projectIdNum} 
            language={project?.language || 'javascript'}
            onRunning={(running, execId) => {
              setIsProjectRunning(running);
              setExecutionId(execId);
            }}
            className="h-8 flex-shrink-0"
            variant="default"
            size={isMobile ? "sm" : "sm"}
          />
        </div>
        
        {/* Right side controls */}
        <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
          {/* Collaboration Presence - Hidden on mobile */}
          {user && !isMobile && (
            <CollaborationPresence 
              projectId={projectIdNum} 
              currentUserId={user.id}
              compact={true}
              className="mr-2"
            />
          )}
          
          {/* Desktop buttons */}
          {!isMobile && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Users className="h-3 w-3 mr-1" />
                <span className="hidden xl:inline">Invite</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Rocket className="h-3 w-3 mr-1" />
                <span className="hidden xl:inline">Deploy</span>
              </Button>
            </>
          )}
          
          {/* Mobile dropdown menu */}
          {isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Invite to collaborate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy project
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Project settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Main Content Area - Responsive Layout */}
      {isMobile ? (
        <MobileEditorTabs
          fileExplorer={
            <ReplitFileSidebar
              files={files}
              activeFileId={activeFile?.id}
              onFileSelect={handleActiveFileChange}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              projectName={project?.name}
              projectId={projectIdNum}
            />
          }
          codeEditor={
            <ReplitCodeEditor
              files={files}
              activeFile={activeFile}
              onFileUpdate={handleFileUpdate}
            />
          }
          terminal={
            <ResponsiveTerminal 
              projectId={projectIdNum}
            />
          }
          preview={
            <ResponsiveWebPreview 
              projectId={projectIdNum} 
              isRunning={isProjectRunning}
            />
          }
          defaultTab={mobileActiveTab}
          isRunning={isProjectRunning}
          onRun={() => {
            // Handle run action - project runs automatically
            console.log('Running project', projectIdNum);
          }}
        />
      ) : (
        <ReplitEditorLayout
          leftPanel={
            <ReplitFileSidebar
              files={files}
              activeFileId={activeFile?.id}
              onFileSelect={handleActiveFileChange}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              projectName={project?.name}
              projectId={projectIdNum}
            />
          }
          centerPanel={
            <ReplitCodeEditor
              files={files}
              activeFile={activeFile}
              onFileUpdate={handleFileUpdate}
            />
          }
          bottomPanel={
            <ResponsiveTerminal projectId={projectIdNum} />
          }
          rightPanels={[
            {
              id: 'console',
              title: 'Console',
              icon: <TerminalIcon className="h-3 w-3" />,
              content: <ReplitConsole projectId={projectIdNum} isRunning={isProjectRunning} executionId={executionId} />
            },
            {
              id: 'preview',
              title: 'Webview',
              icon: <Globe className="h-3 w-3" />,
              content: <ResponsiveWebPreview projectId={projectIdNum} isRunning={isProjectRunning} />
            },
            {
              id: 'database',
              title: 'Database',
              icon: <Database className="h-3 w-3" />,
              content: <DatabaseBrowser projectId={projectIdNum.toString()} />
            },
            {
              id: 'packages',
              title: 'Packages',
              icon: <PackageIcon className="h-3 w-3" />,
              content: <PackageViewer projectId={projectIdNum.toString()} />
            },
            {
              id: 'debugger',
              title: 'Debugger',
              icon: <Bug className="h-3 w-3" />,
              content: <DebuggerPanel projectId={projectIdNum.toString()} />
            },
            {
              id: 'tests',
              title: 'Tests',
              icon: <Beaker className="h-3 w-3" />,
              content: <TestRunner projectId={projectIdNum.toString()} />
            }
          ]}
          defaultRightPanel="console"
        />
      )}

      {/* Global Search Dialog */}
      {showGlobalSearch && (
        <GlobalSearch
          projectId={projectIdNum}
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onFileSelect={(file) => {
            setActiveFile(file.content !== undefined ? {...file, content: file.content ?? null} : undefined);
            setShowGlobalSearch(false);
          }}
        />
      )}
    </div>
  );
}