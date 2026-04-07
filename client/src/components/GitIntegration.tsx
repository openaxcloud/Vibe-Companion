import React, { useState, useEffect } from 'react';
import { 
  GitBranch, GitCommit, GitMerge, GitPullRequest, 
  Plus, Check, X, RefreshCw, Upload, Download,
  Clock, User, FileText, MoreVertical, Search,
  ChevronDown, AlertCircle, CheckCircle, Terminal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';

interface GitIntegrationProps {
  projectId: number;
  className?: string;
}

interface GitStatus {
  branch: string;
  remote?: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
}

interface FileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  oldPath?: string;
}

interface Commit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  files: number;
  additions: number;
  deletions: number;
}

interface Branch {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: string;
  ahead?: number;
  behind?: number;
}

export function GitIntegration({ projectId, className }: GitIntegrationProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkGitStatus();
    loadBranches();
    loadCommits();
  }, [projectId]);

  const checkGitStatus = async () => {
    try {
      const response = await fetch(`/api/git/${projectId}/status`);
      if (response.ok) {
        const data = await response.json();
        // Transform data to match GitStatus interface
        setGitStatus({
          branch: data.branch || 'main',
          remote: data.remote,
          ahead: data.ahead || 0,
          behind: data.behind || 0,
          staged: data.added?.map((file: string) => ({ path: file, status: 'added' as const })) || [],
          unstaged: data.modified?.map((file: string) => ({ path: file, status: 'modified' as const })) || [],
          untracked: data.untracked || []
        });
        setIsInitialized(true);
      } else if (response.status === 404) {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('Failed to check git status:', error);
      setIsInitialized(false);
    }
  };

  const loadBranches = async () => {
    try {
      const response = await fetch(`/api/git/${projectId}/branches`);
      if (response.ok) {
        const data = await response.json();
        const currentBranch = gitStatus?.branch || 'main';
        setBranches(data.map((name: string) => ({
          name,
          current: name === currentBranch,
          remote: `origin/${name}`
        })));
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

  const loadCommits = async () => {
    try {
      const response = await fetch(`/api/git/${projectId}/commits`);
      if (response.ok) {
        const data = await response.json();
        setCommits(data.map((commit: any) => ({
          ...commit,
          date: commit.date instanceof Date ? commit.date.toISOString() : commit.date
        })));
      }
    } catch (error) {
      console.error('Failed to load commits:', error);
    }
  };

  const handleInit = async () => {
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/init`, {});
      if (response.ok) {
        setIsInitialized(true);
        await checkGitStatus();
        toast({
          title: "Git Initialized",
          description: "Git repository initialized successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Initialization Failed",
        description: "Failed to initialize git repository",
        variant: "destructive"
      });
    }
  };

  const handleClone = async () => {
    if (!cloneUrl) return;
    
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/clone`, { url: cloneUrl });
      
      if (response.ok) {
        setShowCloneDialog(false);
        setCloneUrl('');
        await checkGitStatus();
        toast({
          title: "Repository Cloned",
          description: "Successfully cloned the repository",
        });
      }
    } catch (error) {
      toast({
        title: "Clone Failed",
        description: "Failed to clone repository",
        variant: "destructive"
      });
    }
  };

  const handleStageFile = async (path: string) => {
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/stage`, { paths: [path] });
      
      if (response.ok) {
        await checkGitStatus();
      }
    } catch (error) {
      console.error('Failed to stage file:', error);
      // For demo, update local state
      if (gitStatus) {
        const file = gitStatus.unstaged.find(f => f.path === path);
        if (file) {
          setGitStatus({
            ...gitStatus,
            staged: [...gitStatus.staged, file],
            unstaged: gitStatus.unstaged.filter(f => f.path !== path)
          });
        }
      }
    }
  };

  const handleUnstageFile = async (path: string) => {
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/unstage`, { paths: [path] });
      
      if (response.ok) {
        await checkGitStatus();
      }
    } catch (error) {
      console.error('Failed to unstage file:', error);
      // For demo, update local state
      if (gitStatus) {
        const file = gitStatus.staged.find(f => f.path === path);
        if (file) {
          setGitStatus({
            ...gitStatus,
            staged: gitStatus.staged.filter(f => f.path !== path),
            unstaged: [...gitStatus.unstaged, file]
          });
        }
      }
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || gitStatus?.staged.length === 0) return;
    
    setIsCommitting(true);
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/commit`, { message: commitMessage });
      
      if (response.ok) {
        setCommitMessage('');
        await checkGitStatus();
        await loadCommits();
        toast({
          title: "Changes Committed",
          description: "Your changes have been committed successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Commit Failed",
        description: "Failed to commit changes",
        variant: "destructive"
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/push`, {});
      
      if (response.ok) {
        await checkGitStatus();
        toast({
          title: "Changes Pushed",
          description: "Successfully pushed to remote repository",
        });
      }
    } catch (error) {
      toast({
        title: "Push Failed",
        description: "Failed to push changes",
        variant: "destructive"
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/pull`, {});
      
      if (response.ok) {
        await checkGitStatus();
        await loadCommits();
        toast({
          title: "Changes Pulled",
          description: "Successfully pulled from remote repository",
        });
      }
    } catch (error) {
      toast({
        title: "Pull Failed",
        description: "Failed to pull changes",
        variant: "destructive"
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/branch`, { name: newBranchName });
      
      if (response.ok) {
        setShowBranchDialog(false);
        setNewBranchName('');
        await loadBranches();
        toast({
          title: "Branch Created",
          description: `Branch "${newBranchName}" created successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Branch Creation Failed",
        description: "Failed to create branch",
        variant: "destructive"
      });
    }
  };

  const handleCheckout = async (branchName: string) => {
    try {
      const response = await apiRequest('POST', `/api/git/${projectId}/checkout`, { branch: branchName });
      
      if (response.ok) {
        await checkGitStatus();
        await loadBranches();
        toast({
          title: "Branch Changed",
          description: `Switched to branch "${branchName}"`,
        });
      }
    } catch (error) {
      toast({
        title: "Checkout Failed",
        description: "Failed to switch branch",
        variant: "destructive"
      });
    }
  };

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case 'modified': return <FileText className="h-4 w-4 text-yellow-500" />;
      case 'added': return <Plus className="h-4 w-4 text-green-500" />;
      case 'deleted': return <X className="h-4 w-4 text-red-500" />;
      case 'renamed': return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (!isInitialized) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitBranch className="h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-[15px] font-semibold mb-2">No Git Repository</h3>
          <p className="text-[13px] text-muted-foreground text-center mb-6">
            Initialize a Git repository to start tracking changes
          </p>
          <div className="space-x-2">
            <Button onClick={handleInit}>
              <GitBranch className="h-4 w-4 mr-2" />
              Initialize Git
            </Button>
            <Button variant="outline" onClick={() => setShowCloneDialog(true)}>
              <Download className="h-4 w-4 mr-2" />
              Clone Repository
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center">
              <GitBranch className="h-4 w-4 mr-2" />
              Git
            </CardTitle>
            <div className="flex items-center space-x-2">
              {gitStatus && (
                <>
                  {gitStatus.behind > 0 && (
                    <Badge variant="secondary" className="text-[11px]">
                      <Download className="h-3 w-3 mr-1" />
                      {gitStatus.behind}
                    </Badge>
                  )}
                  {gitStatus.ahead > 0 && (
                    <Badge variant="secondary" className="text-[11px]">
                      <Upload className="h-3 w-3 mr-1" />
                      {gitStatus.ahead}
                    </Badge>
                  )}
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePull}
                disabled={isPulling}
                className="h-7 w-7"
              >
                <Download className={`h-3.5 w-3.5 ${isPulling ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePush}
                disabled={isPushing || !gitStatus?.ahead}
                className="h-7 w-7"
              >
                <Upload className={`h-3.5 w-3.5 ${isPushing ? 'animate-spin' : ''}`} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => checkGitStatus()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBranchDialog(true)}>
                    <GitBranch className="h-4 w-4 mr-2" />
                    New Branch
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Terminal className="h-4 w-4 mr-2" />
                    Open Terminal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Current Branch */}
          <div className="px-4 pb-3">
            <Select value={gitStatus?.branch} onValueChange={handleCheckout}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.name} value={branch.name}>
                    <div className="flex items-center">
                      {branch.current && <Check className="h-3 w-3 mr-2" />}
                      {branch.name}
                      {branch.remote && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          ({branch.remote})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="changes" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="changes" className="text-[11px]">Changes</TabsTrigger>
              <TabsTrigger value="history" className="text-[11px]">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="changes" className="mt-0">
              <ScrollArea className="h-96">
                {/* Staged Changes */}
                {gitStatus?.staged && gitStatus.staged.length > 0 && (
                  <div className="px-2.5 py-2 border-b border-[var(--ecode-border)]">
                    <h4 className="text-[10px] font-medium mb-1.5 text-[var(--ecode-text-muted)]">
                      Staged Changes ({gitStatus.staged.length})
                    </h4>
                    <div className="space-y-0.5">
                      {gitStatus.staged.map(file => (
                        <div
                          key={file.path}
                          className="flex items-center justify-between py-1 px-1.5 hover:bg-[var(--ecode-sidebar-hover)] rounded-sm cursor-pointer"
                          onClick={() => handleUnstageFile(file.path)}
                        >
                          <div className="flex items-center space-x-1.5">
                            {getFileStatusIcon(file.status)}
                            <span className="text-xs">{file.path}</span>
                          </div>
                          <X className="w-3 h-3 text-[var(--ecode-text-muted)]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unstaged Changes */}
                {gitStatus?.unstaged && gitStatus.unstaged.length > 0 && (
                  <div className="px-2.5 py-2 border-b border-[var(--ecode-border)]">
                    <h4 className="text-[10px] font-medium mb-1.5 text-[var(--ecode-text-muted)]">
                      Unstaged Changes ({gitStatus.unstaged.length})
                    </h4>
                    <div className="space-y-0.5">
                      {gitStatus.unstaged.map(file => (
                        <div
                          key={file.path}
                          className="flex items-center justify-between py-1 px-1.5 hover:bg-[var(--ecode-sidebar-hover)] rounded-sm cursor-pointer"
                          onClick={() => handleStageFile(file.path)}
                        >
                          <div className="flex items-center space-x-1.5">
                            {getFileStatusIcon(file.status)}
                            <span className="text-xs">{file.path}</span>
                          </div>
                          <Plus className="w-3 h-3 text-[var(--ecode-text-muted)]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Untracked Files */}
                {gitStatus?.untracked && gitStatus.untracked.length > 0 && (
                  <div className="p-4">
                    <h4 className="text-[11px] font-medium mb-2 text-muted-foreground">
                      Untracked Files ({gitStatus.untracked.length})
                    </h4>
                    <div className="space-y-1">
                      {gitStatus.untracked.map(path => (
                        <div
                          key={path}
                          className="flex items-center justify-between py-1 px-2 hover:bg-surface-hover-solid rounded-sm cursor-pointer"
                          onClick={() => handleStageFile(path)}
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="text-[13px]">{path}</span>
                          </div>
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No changes */}
                {gitStatus && 
                 gitStatus.staged.length === 0 && 
                 gitStatus.unstaged.length === 0 && 
                 gitStatus.untracked.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-[13px]">No changes to commit</p>
                  </div>
                )}
              </ScrollArea>

              {/* Commit Section */}
              {gitStatus?.staged && gitStatus.staged.length > 0 && (
                <div className="p-4 border-t">
                  <Textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    className="min-h-[80px] mb-3"
                  />
                  <Button
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || isCommitting}
                    className="w-full"
                    size="sm"
                  >
                    {isCommitting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <GitCommit className="h-4 w-4 mr-2" />
                    )}
                    Commit Changes
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-0">
              <ScrollArea className="h-[480px]">
                <div className="p-4 space-y-3">
                  {commits.map((commit) => (
                    <div key={commit.hash} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-[13px] font-medium line-clamp-2">
                            {commit.message}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[11px]">
                                {commit.author.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">
                              {commit.author}
                            </span>
                            <span className="text-[11px] text-muted-foreground">•</span>
                            <span className="text-[11px] text-muted-foreground">
                              {commit.date}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {commit.hash}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-[11px] text-muted-foreground">
                        <span>{commit.files} files</span>
                        <span className="text-green-600">+{commit.additions}</span>
                        <span className="text-red-600">-{commit.deletions}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Repository</DialogTitle>
            <DialogDescription>
              Clone an existing Git repository to start working with version control.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clone-url">Repository URL</Label>
              <Input
                id="clone-url"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                placeholder="https://github.com/username/repo.git"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleClone} disabled={!cloneUrl.trim()}>
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Branch Dialog */}
      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Create a new branch to work on features or fixes separately from your main branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/new-feature"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBranchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={!newBranchName.trim()}>
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}