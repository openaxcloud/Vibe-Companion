import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Project, File, InsertFile } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

// UI Components
import FileExplorer from '@/components/FileExplorer';
import CodeEditor from '@/components/CodeEditor';
import Terminal from '@/components/Terminal';
import { ExecutionConsole } from '@/components/ExecutionConsole';
import DeploymentPanel from '@/components/DeploymentPanel';
import Collaboration from '@/components/Collaboration';
import GitPanel from '@/components/GitPanel';
import AIPanel from '@/components/AIPanel';
import EnvironmentPanel from '@/components/EnvironmentPanel';
import { EnvironmentProvider } from '@/hooks/useEnvironment';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from '@/components/ui/resizable';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Settings, 
  Save, 
  ChevronLeft, 
  Download, 
  Upload, 
  Share2, 
  GitBranch,
  Layers,
  Users,
  MessageSquare,
  Sparkles,
  KeyRound
} from 'lucide-react';

const ProjectPage = () => {
  const [, params] = useRoute('/project/:id');
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const projectId = params?.id ? parseInt(params.id) : null;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<number, string>>({});
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [projectRunning, setProjectRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | undefined>();
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'console' | 'deployment' | 'git' | 'env'>('terminal');
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  
  // Get current user for collaboration
  const { user } = useAuth();

  // Query for fetching project details
  const { 
    data: project, 
    isLoading: projectLoading, 
    error: projectError 
  } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      if (!projectId) return Promise.reject(new Error('No project ID provided'));
      
      const res = await apiRequest('GET', `/api/projects/${projectId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch project');
      }
      return res.json();
    },
    enabled: !!projectId
  });

  // Query for fetching project files
  const { 
    data: files, 
    isLoading: filesLoading, 
    error: filesError 
  } = useQuery<File[]>({
    queryKey: ['/api/projects', projectId, 'files'],
    queryFn: async () => {
      if (!projectId) return Promise.reject(new Error('No project ID provided'));
      
      const res = await apiRequest('GET', `/api/projects/${projectId}/files`);
      if (!res.ok) {
        throw new Error('Failed to fetch files');
      }
      return res.json();
    },
    enabled: !!projectId
  });

  // Mutation for saving file changes
  const saveFileMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number, content: string }) => {
      const res = await apiRequest('PATCH', `/api/files/${id}`, { content });
      if (!res.ok) {
        throw new Error('Failed to save file');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      // Remove from unsaved changes
      setUnsavedChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[variables.id];
        return newChanges;
      });
      
      toast({
        title: "File saved",
        description: "Your changes have been saved successfully.",
      });
      
      // Refresh file list to get updated timestamps
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save file",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for creating a new file
  const createFileMutation = useMutation({
    mutationFn: async ({ parentId, name, isFolder }: { parentId: number | null, name: string, isFolder: boolean }) => {
      if (!projectId) return Promise.reject(new Error('No project ID provided'));
      
      const newFile: Partial<InsertFile> = {
        name,
        isFolder,
        parentId,
        projectId,
        content: isFolder ? null : '',
      };
      
      const res = await apiRequest('POST', `/api/projects/${projectId}/files`, newFile);
      if (!res.ok) {
        throw new Error('Failed to create file');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
      toast({
        title: "File created",
        description: "New file has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create file",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for deleting a file
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest('DELETE', `/api/files/${fileId}`);
      if (!res.ok) {
        throw new Error('Failed to delete file');
      }
      return res.json();
    },
    onSuccess: (_, fileId) => {
      // If the deleted file was selected, deselect it
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
      toast({
        title: "File deleted",
        description: "File has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete file",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for renaming a file
  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number, name: string }) => {
      const res = await apiRequest('PATCH', `/api/files/${id}`, { name });
      if (!res.ok) {
        throw new Error('Failed to rename file');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
      toast({
        title: "File renamed",
        description: "File has been renamed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to rename file",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for starting the project
  const startProjectMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) return Promise.reject(new Error('No project ID provided'));
      
      const res = await apiRequest('POST', `/api/projects/${projectId}/start`);
      if (!res.ok) {
        throw new Error('Failed to start project');
      }
      return res.json();
    },
    onSuccess: () => {
      setProjectRunning(true);
      toast({
        title: "Project started",
        description: "Your project is now running.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for stopping the project
  const stopProjectMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) return Promise.reject(new Error('No project ID provided'));
      
      const res = await apiRequest('POST', `/api/projects/${projectId}/stop`);
      if (!res.ok) {
        throw new Error('Failed to stop project');
      }
      return res.json();
    },
    onSuccess: () => {
      setProjectRunning(false);
      toast({
        title: "Project stopped",
        description: "Your project has been stopped.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle file content change
  const handleFileChange = (content: string) => {
    if (!selectedFile) return;
    
    setUnsavedChanges(prev => ({
      ...prev,
      [selectedFile.id]: content
    }));
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    // Don't reselect the same file
    if (selectedFile?.id === file.id) return;
    
    // Check for unsaved changes before switching
    if (selectedFile && unsavedChanges[selectedFile.id]) {
      const confirmSwitch = window.confirm('You have unsaved changes. Do you want to continue without saving?');
      if (!confirmSwitch) return;
    }
    
    setSelectedFile(file);
  };

  // Save current file
  const saveCurrentFile = () => {
    if (!selectedFile) return;
    
    const content = unsavedChanges[selectedFile.id] || selectedFile.content;
    if (!content) return;
    
    saveFileMutation.mutate({ id: selectedFile.id, content });
  };

  // Handle creation of a new file
  const handleCreateFile = async (parentId: number | null, name: string) => {
    await createFileMutation.mutateAsync({ parentId, name, isFolder: false });
  };

  // Handle creation of a new folder
  const handleCreateFolder = async (parentId: number | null, name: string) => {
    await createFileMutation.mutateAsync({ parentId, name, isFolder: true });
  };

  // Handle renaming a file
  const handleRenameFile = async (file: File, newName: string) => {
    await renameFileMutation.mutateAsync({ id: file.id, name: newName });
  };

  // Handle deleting a file
  const handleDeleteFile = async (file: File) => {
    await deleteFileMutation.mutateAsync(file.id);
  };

  // Toggle terminal visibility
  const toggleTerminal = () => {
    setTerminalVisible(prev => !prev);
  };
  
  // Toggle AI panel visibility
  const toggleAiPanel = () => {
    setAiPanelVisible(prev => !prev);
  };

  // Start/stop project
  const toggleProjectRunning = () => {
    if (projectRunning) {
      stopProjectMutation.mutate();
    } else {
      startProjectMutation.mutate();
    }
  };

  // Check project status on load
  useEffect(() => {
    if (!projectId) return;
    
    const checkStatus = async () => {
      try {
        const res = await apiRequest('GET', `/api/projects/${projectId}/status`);
        if (res.ok) {
          const data = await res.json();
          setProjectRunning(data.status === 'running');
        }
      } catch (error) {
        console.error('Failed to check project status:', error);
      }
    };
    
    checkStatus();
  }, [projectId]);

  // Select the first file when files are loaded
  useEffect(() => {
    if (files && files.length > 0 && !selectedFile) {
      // Try to find a non-folder file to select
      const fileToSelect = files.find(file => !file.isFolder);
      if (fileToSelect) {
        setSelectedFile(fileToSelect);
      }
    }
  }, [files, selectedFile]);

  // Show loading state
  if (projectLoading || filesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (projectError || filesError) {
    return (
      <div className="container mx-auto py-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-destructive/10 p-4 rounded-lg text-destructive">
          <p>Error loading project: {(projectError || filesError)?.message}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
              queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
            }}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!project) {
    return (
      <div className="container mx-auto py-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-muted p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Project Not Found</h2>
          <p className="mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate('/projects')}>
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header / Toolbar */}
      <header className="border-b border-border h-12 px-4 flex items-center justify-between bg-background">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm"
            className="mr-4"
            onClick={() => navigate('/projects')}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Projects
          </Button>
          
          <h1 className="text-lg font-medium flex items-center">
            {project.name}
            <Badge className="ml-2" variant={project.visibility === 'public' ? 'default' : 'secondary'}>
              {project.visibility}
            </Badge>
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Run/Stop Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={projectRunning ? "destructive" : "default"}
                  size="sm"
                  className="gap-1"
                  onClick={toggleProjectRunning}
                  disabled={startProjectMutation.isPending || stopProjectMutation.isPending}
                >
                  {startProjectMutation.isPending || stopProjectMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : projectRunning ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {projectRunning ? 'Stop' : 'Run'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{projectRunning ? 'Stop' : 'Run'} the project</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Save Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-8 w-8"
                  disabled={!selectedFile || !unsavedChanges[selectedFile.id] || saveFileMutation.isPending}
                  onClick={saveCurrentFile}
                >
                  {saveFileMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save current file (Ctrl+S)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Git Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-8 w-8"
                >
                  <GitBranch className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Git operations</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Terminal Toggle Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    terminalVisible && "bg-secondary text-secondary-foreground"
                  )}
                  onClick={toggleTerminal}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{terminalVisible ? 'Hide' : 'Show'} terminal</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* AI Assistant Toggle Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    aiPanelVisible && "bg-secondary text-secondary-foreground"
                  )}
                  onClick={toggleAiPanel}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{aiPanelVisible ? 'Hide' : 'Show'} AI assistant</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Project Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export Project
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Upload className="h-4 w-4 mr-2" />
                Import Files
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="h-4 w-4 mr-2" />
                Share Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Project Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-64 overflow-auto border-r">
          {files && (
            <FileExplorer
              files={files}
              selectedFile={selectedFile || undefined}
              onFileSelect={handleFileSelect}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
            />
          )}
        </div>
        
        {/* Middle Section: Editor and Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Code Editor */}
          <div className={`flex-1 ${terminalVisible ? 'overflow-hidden' : 'overflow-auto'}`}>
            {selectedFile ? (
              <CodeEditor
                file={selectedFile}
                onChange={handleFileChange}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>Select a file to edit</p>
              </div>
            )}
          </div>
          
          {/* Bottom Panel (Terminal and Deployment) */}
          {terminalVisible && (
            <div className="border-t border-border h-[300px] flex flex-col">
              <div className="h-8 bg-muted/30 border-b border-border flex items-center px-4 justify-between">
                <div className="flex items-center space-x-4">
                  <Tabs 
                    value={bottomPanelTab} 
                    onValueChange={(value) => setBottomPanelTab(value as 'terminal' | 'console' | 'deployment' | 'git' | 'env')}
                    className="w-[600px]"
                  >
                    <TabsList className="h-7 bg-transparent">
                      <TabsTrigger 
                        value="terminal" 
                        className={`h-7 data-[state=active]:bg-background ${bottomPanelTab === 'terminal' ? 'border-b-2 border-primary rounded-none' : ''}`}
                      >
                        Terminal
                      </TabsTrigger>
                      <TabsTrigger 
                        value="console" 
                        className={`h-7 data-[state=active]:bg-background ${bottomPanelTab === 'console' ? 'border-b-2 border-primary rounded-none' : ''}`}
                      >
                        Console
                      </TabsTrigger>
                      <TabsTrigger 
                        value="deployment" 
                        className={`h-7 data-[state=active]:bg-background ${bottomPanelTab === 'deployment' ? 'border-b-2 border-primary rounded-none' : ''}`}
                      >
                        Deployment
                      </TabsTrigger>
                      <TabsTrigger 
                        value="git" 
                        className={`h-7 data-[state=active]:bg-background ${bottomPanelTab === 'git' ? 'border-b-2 border-primary rounded-none' : ''}`}
                      >
                        <GitBranch className="h-4 w-4 mr-1" />
                        Git
                      </TabsTrigger>
                      <TabsTrigger 
                        value="env" 
                        className={`h-7 data-[state=active]:bg-background ${bottomPanelTab === 'env' ? 'border-b-2 border-primary rounded-none' : ''}`}
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Environment
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6"
                  onClick={toggleTerminal}
                >
                  <ChevronLeft className="h-4 w-4 rotate-90" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                {bottomPanelTab === 'terminal' && projectId && <Terminal projectId={projectId} />}
                {bottomPanelTab === 'console' && projectId && (
                  <ExecutionConsole 
                    projectId={projectId} 
                    executionId={executionId}
                    isRunning={projectRunning}
                  />
                )}
                {bottomPanelTab === 'deployment' && projectId && <DeploymentPanel projectId={projectId} />}
                {bottomPanelTab === 'git' && projectId && <GitPanel projectId={projectId} />}
                {bottomPanelTab === 'env' && projectId && (
                  <EnvironmentProvider projectId={projectId}>
                    <EnvironmentPanel projectId={projectId} />
                  </EnvironmentProvider>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Right Panel: AI Assistant */}
        {aiPanelVisible && projectId && (
          <div className="w-96 border-l border-border overflow-hidden">
            <div className="h-8 bg-muted/30 border-b border-border flex items-center px-4 justify-between">
              <div className="flex items-center">
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
                <h3 className="text-sm font-medium">AI Assistant</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-6 w-6"
                onClick={toggleAiPanel}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-32px)] overflow-hidden">
              <AIPanel 
                projectId={projectId!} 
                currentFileContent={selectedFile?.content || ''}
                currentLanguage={project?.language || 'javascript'}
                onInsertCode={(code) => {
                  if (selectedFile) {
                    handleFileChange(code);
                  }
                }}
              />
            </div>
          </div>
        )}
        
        {/* Right Panel: Collaboration */}
        {rightPanelVisible && user && projectId && !aiPanelVisible && (
          <div className="w-80 flex flex-col">
            <Collaboration 
              projectId={projectId} 
              fileId={selectedFile?.id || null} 
              currentUser={user}
              onToggle={() => setRightPanelVisible(false)}
            />
          </div>
        )}
        
        {/* Collapsed Collaboration Panel Toggle */}
        {!rightPanelVisible && user && projectId && !aiPanelVisible && (
          <Button
            variant="ghost" 
            className="fixed bottom-4 right-4 p-2 rounded-full shadow-md"
            onClick={() => setRightPanelVisible(true)}
          >
            <Users className="h-5 w-5" />
          </Button>
        )}
        
        {/* Collapsed AI Panel Toggle */}
        {!aiPanelVisible && (
          <Button
            variant="ghost" 
            className="fixed bottom-4 right-20 p-2 rounded-full shadow-md"
            onClick={toggleAiPanel}
          >
            <Sparkles className="h-5 w-5 text-primary" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProjectPage;