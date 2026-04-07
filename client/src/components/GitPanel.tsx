import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Github,
  RefreshCcw,
  Plus,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Loader2
} from "lucide-react";

interface GitPanelProps {
  projectId: number;
}

type GitStatus = {
  isRepo: boolean;
  branch?: string;
  changes?: {
    staged: Array<{
      path: string;
      status: string;
    }>;
    unstaged: Array<{
      path: string;
      status: string;
    }>;
    untracked: string[];
  };
  remotes?: string[];
};

type CommitHistory = Array<{
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}>;

const GitPanel: React.FC<GitPanelProps> = ({ projectId }) => {
  const { toast } = useToast();
  const [remoteUrl, setRemoteUrl] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('changes');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Query for checking if the project is a Git repository
  const { 
    data: gitStatus,
    isLoading: gitStatusLoading,
    error: gitStatusError,
    refetch: refetchGitStatus
  } = useQuery<GitStatus>({
    queryKey: ['/api/git/status', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/git/projects/${projectId}/status`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to get Git status');
      }
      return res.json();
    },
  });
  
  // Query for getting commit history
  const { 
    data: commitHistory,
    isLoading: commitHistoryLoading,
    refetch: refetchCommitHistory
  } = useQuery<CommitHistory>({
    queryKey: ['/api/git/history', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/git/projects/${projectId}/history`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to get commit history');
      }
      return res.json();
    },
    enabled: !!gitStatus?.isRepo,
  });

  // Initialize repository mutation
  const initRepoMutation = useMutation({
    mutationFn: async () => {
      setIsLoading('initializing');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/init`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to initialize Git repository');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Git repository initialized successfully.',
      });
      refetchGitStatus();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to initialize repository: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });
  
  // Add remote mutation
  const addRemoteMutation = useMutation({
    mutationFn: async () => {
      setIsLoading('adding-remote');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/remote`, { url: remoteUrl });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add remote');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Remote repository added successfully.',
      });
      setRemoteUrl('');
      refetchGitStatus();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to add remote: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });
  
  // Stage files mutation
  const stageFilesMutation = useMutation({
    mutationFn: async (files: string[]) => {
      setIsLoading('staging');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/stage`, { files });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to stage files');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Files staged successfully.',
      });
      setSelectedFiles([]);
      refetchGitStatus();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to stage files: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });
  
  // Commit changes mutation
  const commitChangesMutation = useMutation({
    mutationFn: async () => {
      setIsLoading('committing');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/commit`, { message: commitMessage });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to commit changes');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Changes committed successfully.',
      });
      setCommitMessage('');
      refetchGitStatus();
      refetchCommitHistory();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to commit changes: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });
  
  // Push changes mutation
  const pushChangesMutation = useMutation({
    mutationFn: async () => {
      setIsLoading('pushing');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/push`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to push changes');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Changes pushed to remote successfully.',
      });
      refetchGitStatus();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to push changes: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });
  
  // Pull changes mutation
  const pullChangesMutation = useMutation({
    mutationFn: async () => {
      setIsLoading('pulling');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/pull`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to pull changes');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Changes pulled from remote successfully.',
      });
      refetchGitStatus();
      refetchCommitHistory();
      // Refresh file list to get updated contents
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to pull changes: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });

  // Clone repository mutation
  const cloneRepoMutation = useMutation({
    mutationFn: async (url: string) => {
      setIsLoading('cloning');
      const res = await apiRequest('POST', `/api/git/projects/${projectId}/clone`, { url });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to clone repository');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Repository cloned successfully.',
      });
      refetchGitStatus();
      refetchCommitHistory();
      // Refresh file list to get updated contents
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to clone repository: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });

  // Handle file selection for staging
  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => 
      prev.includes(path)
        ? prev.filter(file => file !== path)
        : [...prev, path]
    );
  };

  // Handle select all files
  const handleSelectAllUnstaged = () => {
    if (!gitStatus?.changes?.unstaged) return;
    
    const unstagedPaths = gitStatus.changes.unstaged.map(file => file.path);
    setSelectedFiles(prev => {
      const remaining = prev.filter(path => !unstagedPaths.includes(path));
      return unstagedPaths.every(path => prev.includes(path))
        ? remaining // If all are selected, unselect all
        : [...remaining, ...unstagedPaths]; // Otherwise, select all
    });
  };

  // Handle select all untracked files
  const handleSelectAllUntracked = () => {
    if (!gitStatus?.changes?.untracked) return;
    
    const untracked = gitStatus.changes.untracked;
    
    setSelectedFiles(prev => {
      const remaining = prev.filter(path => !untracked.includes(path));
      return untracked.every(path => prev.includes(path))
        ? remaining // If all are selected, unselect all
        : [...remaining, ...untracked]; // Otherwise, select all
    });
  };

  // Handle staging selected files
  const handleStageSelectedFiles = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file to stage.',
        variant: 'destructive',
      });
      return;
    }
    
    stageFilesMutation.mutate(selectedFiles);
  };

  // Handle commit staged changes
  const handleCommitChanges = () => {
    if (!commitMessage.trim()) {
      toast({
        title: 'No commit message',
        description: 'Please enter a commit message.',
        variant: 'destructive',
      });
      return;
    }
    
    commitChangesMutation.mutate();
  };

  // Handle add remote
  const handleAddRemote = () => {
    if (!remoteUrl.trim()) {
      toast({
        title: 'No remote URL',
        description: 'Please enter a remote repository URL.',
        variant: 'destructive',
      });
      return;
    }
    
    addRemoteMutation.mutate();
  };

  // Handle pull changes
  const handlePullChanges = () => {
    if (!gitStatus?.remotes || gitStatus.remotes.length === 0) {
      toast({
        title: 'No remote configured',
        description: 'Please configure a remote repository first.',
        variant: 'destructive',
      });
      return;
    }
    
    pullChangesMutation.mutate();
  };

  // Handle push changes
  const handlePushChanges = () => {
    if (!gitStatus?.remotes || gitStatus.remotes.length === 0) {
      toast({
        title: 'No remote configured',
        description: 'Please configure a remote repository first.',
        variant: 'destructive',
      });
      return;
    }
    
    pushChangesMutation.mutate();
  };

  // Handle clone repository
  const handleCloneRepo = () => {
    if (!remoteUrl.trim()) {
      toast({
        title: 'No repository URL',
        description: 'Please enter a repository URL to clone.',
        variant: 'destructive',
      });
      return;
    }
    
    cloneRepoMutation.mutate(remoteUrl);
  };

  // Helper function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'added':
        return 'bg-green-500 hover:bg-green-600';
      case 'deleted':
        return 'bg-red-500 hover:bg-red-600';
      case 'renamed':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Helper function to get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'M':
        return 'Modified';
      case 'A':
        return 'Added';
      case 'D':
        return 'Deleted';
      case 'R':
        return 'Renamed';
      case '??':
        return 'Untracked';
      default:
        return status;
    }
  };

  // If the project is not a Git repository, show initialization screen
  if (!gitStatus?.isRepo) {
    return (
      <Card className="w-full bg-background border-0 shadow-none rounded-none h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center">
            <GitBranch className="mr-2 h-5 w-5 text-primary" />
            Git Integration
          </CardTitle>
          <CardDescription>Initialize a Git repository for your project</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
          <div>
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Git Repository</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This project does not have a Git repository yet. Initialize a repository to start tracking changes.
            </p>
            <div className="flex flex-col space-y-4">
              <Button 
                onClick={() => initRepoMutation.mutate()} 
                className="w-full"
                disabled={isLoading === 'initializing'}
              >
                {isLoading === 'initializing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <GitCommit className="mr-2 h-4 w-4" />
                    Initialize Git Repository
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or Clone Existing
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <Input 
                    placeholder="Enter repository URL" 
                    value={remoteUrl}
                    onChange={e => setRemoteUrl(e.target.value)}
                    disabled={isLoading === 'cloning'}
                  />
                  <Button 
                    onClick={() => handleCloneRepo()} 
                    disabled={!remoteUrl.trim() || isLoading === 'cloning'}
                  >
                    {isLoading === 'cloning' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Example: https://github.com/username/repository.git
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full bg-background border-0 shadow-none rounded-none h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <GitBranch className="mr-2 h-5 w-5 text-primary" />
            Git
            {gitStatus?.branch && (
              <Badge variant="outline" className="ml-2 font-mono">
                {gitStatus.branch}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              refetchGitStatus();
              refetchCommitHistory();
            }}
            disabled={gitStatusLoading}
            title="Refresh Git status"
          >
            <RefreshCcw className={`h-4 w-4 ${gitStatusLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>Manage your Git repository</CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="remotes">Remotes</TabsTrigger>
        </TabsList>
        
        {/* Changes Tab */}
        <TabsContent value="changes" className="flex-1 flex flex-col space-y-4 p-4">
          {((gitStatus?.changes?.staged?.length || 0) === 0 && (gitStatus?.changes?.unstaged?.length || 0) === 0 && (gitStatus?.changes?.untracked?.length || 0) === 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Check className="h-12 w-12 text-green-500 mb-2" />
              <h3 className="text-lg font-medium">No Changes</h3>
              <p className="text-sm text-muted-foreground">
                Your repository is clean. No changes to commit.
              </p>
            </div>
          ) : (
            <>
              {/* Staged Changes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Staged Changes</h3>
                  <Badge variant="outline" className="text-xs">
                    {gitStatus?.changes?.staged.length || 0} files
                  </Badge>
                </div>
                {gitStatus?.changes?.staged.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2">
                    No staged changes
                  </div>
                ) : (
                  <ScrollArea className="h-24 rounded-md border">
                    <div className="p-2 space-y-1">
                      {gitStatus?.changes?.staged.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-xs p-1 hover:bg-muted/50 rounded">
                          <div className="flex items-center">
                            <Badge className={`${getStatusColor(file.status)} mr-2 h-4 w-4 p-0 flex items-center justify-center`}>
                              <span className="sr-only">{getStatusText(file.status)}</span>
                            </Badge>
                            <span className="font-mono">{file.path}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {getStatusText(file.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              
              {/* Unstaged Changes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Unstaged Changes</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {gitStatus?.changes?.unstaged.length || 0} files
                    </Badge>
                    {(gitStatus?.changes?.unstaged?.length || 0) > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={handleSelectAllUnstaged}
                      >
                        {gitStatus?.changes?.unstaged.every(file => 
                          selectedFiles.includes(file.path)
                        ) ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                </div>
                {gitStatus?.changes?.unstaged.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2">
                    No unstaged changes
                  </div>
                ) : (
                  <ScrollArea className="h-36 rounded-md border">
                    <div className="p-2 space-y-1">
                      {gitStatus?.changes?.unstaged.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-xs p-1 hover:bg-muted/50 rounded">
                          <div className="flex items-center">
                            <Checkbox 
                              checked={selectedFiles.includes(file.path)}
                              onCheckedChange={() => toggleFileSelection(file.path)}
                              className="mr-2 h-3 w-3"
                              id={`file-${index}`}
                            />
                            <Badge className={`${getStatusColor(file.status)} mr-2 h-4 w-4 p-0 flex items-center justify-center`}>
                              <span className="sr-only">{getStatusText(file.status)}</span>
                            </Badge>
                            <Label 
                              htmlFor={`file-${index}`}
                              className="font-mono cursor-pointer"
                            >
                              {file.path}
                            </Label>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {getStatusText(file.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              
              {/* Untracked Files */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Untracked Files</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {gitStatus?.changes?.untracked.length || 0} files
                    </Badge>
                    {(gitStatus?.changes?.untracked?.length || 0) > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={handleSelectAllUntracked}
                      >
                        {gitStatus?.changes?.untracked.every(file => 
                          selectedFiles.includes(file)
                        ) ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                </div>
                {(gitStatus?.changes?.untracked?.length || 0) === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2">
                    No untracked files
                  </div>
                ) : (
                  <ScrollArea className="h-24 rounded-md border">
                    <div className="p-2 space-y-1">
                      {gitStatus?.changes?.untracked.map((file, index) => (
                        <div key={index} className="flex items-center text-xs p-1 hover:bg-muted/50 rounded">
                          <Checkbox 
                            checked={selectedFiles.includes(file)}
                            onCheckedChange={() => toggleFileSelection(file)}
                            className="mr-2 h-3 w-3"
                            id={`untracked-${index}`}
                          />
                          <Badge className="bg-gray-500 hover:bg-gray-600 mr-2 h-4 w-4 p-0 flex items-center justify-center">
                            <span className="sr-only">Untracked</span>
                          </Badge>
                          <Label 
                            htmlFor={`untracked-${index}`}
                            className="font-mono cursor-pointer"
                          >
                            {file}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              
              <div className="space-y-4 mt-auto pt-4">
                {/* Stage Button */}
                <Button 
                  onClick={handleStageSelectedFiles}
                  disabled={selectedFiles.length === 0 || isLoading === 'staging'}
                  className="w-full"
                  variant="outline"
                >
                  {isLoading === 'staging' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Staging...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Stage Selected Files ({selectedFiles.length})
                    </>
                  )}
                </Button>
                
                {/* Commit Section */}
                <div className="space-y-2">
                  <Label htmlFor="commit-message">Commit Message</Label>
                  <Input
                    id="commit-message"
                    placeholder="Enter commit message"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    disabled={gitStatus?.changes?.staged.length === 0 || isLoading === 'committing'}
                  />
                  <Button 
                    onClick={handleCommitChanges}
                    disabled={gitStatus?.changes?.staged.length === 0 || !commitMessage.trim() || isLoading === 'committing'}
                    className="w-full"
                  >
                    {isLoading === 'committing' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Committing...
                      </>
                    ) : (
                      <>
                        <GitCommit className="mr-2 h-4 w-4" />
                        Commit Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history" className="flex-1 flex flex-col space-y-4 p-4">
          {commitHistoryLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : commitHistory?.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <GitCommit className="h-12 w-12 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No Commits Yet</h3>
              <p className="text-sm text-muted-foreground">
                Make your first commit to start tracking history.
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                {commitHistory?.map((commit, index) => (
                  <div key={index} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium flex items-center">
                        <GitCommit className="mr-2 h-4 w-4 text-primary" />
                        <span className="truncate max-w-[200px]">{commit.message}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {commit.shortHash}
                      </Badge>
                    </div>
                    <div className="flex text-xs text-muted-foreground">
                      <span>{commit.author}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(commit.date).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {/* Pull/Push Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Button 
              variant="outline"
              onClick={handlePullChanges}
              disabled={!gitStatus?.remotes?.length || isLoading === 'pulling'}
            >
              {isLoading === 'pulling' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pulling...
                </>
              ) : (
                <>
                  <GitPullRequest className="mr-2 h-4 w-4" />
                  Pull Changes
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={handlePushChanges}
              disabled={!gitStatus?.remotes?.length || isLoading === 'pushing'}
            >
              {isLoading === 'pushing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Push Changes
                </>
              )}
            </Button>
          </div>
        </TabsContent>
        
        {/* Remotes Tab */}
        <TabsContent value="remotes" className="flex-1 flex flex-col space-y-4 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Current Remotes</h3>
              {!gitStatus?.remotes || gitStatus.remotes.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2 border rounded-md">
                  No remote repositories configured.
                </div>
              ) : (
                <ul className="space-y-2">
                  {gitStatus.remotes.map((remote, index) => (
                    <li key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center">
                        <Github className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono">{remote}</span>
                      </div>
                      <Badge>origin</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Add Remote Repository</h3>
              <div className="space-y-2">
                <Input 
                  placeholder="Enter remote repository URL"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  disabled={isLoading === 'adding-remote'}
                />
                <Button 
                  onClick={handleAddRemote}
                  disabled={!remoteUrl.trim() || isLoading === 'adding-remote'}
                  className="w-full"
                >
                  {isLoading === 'adding-remote' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Remote...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Remote
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Example: https://github.com/username/repository.git
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default GitPanel;