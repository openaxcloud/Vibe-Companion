import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { LazyMotionDiv } from '@/lib/motion';
import {
  GitBranch,
  GitCommit,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Settings,
  RefreshCw,
  ExternalLink,
  Search,
  ArrowDown,
  ArrowUp,
  Check,
  X,
  Loader2,
  User,
  Plus,
  Minus,
  FileCode,
  LogOut,
  Eye,
} from 'lucide-react';
import { SiGithub, SiBitbucket, SiGitlab } from 'react-icons/si';
import { cn } from '@/lib/utils';

interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

interface GitBranchInfo {
  name: string;
  current: boolean;
  isRemote: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  ahead: number;
  behind: number;
  trackingBranch?: string;
}

interface ReplitGitPanelProps {
  projectId?: string;
  className?: string;
  mode?: 'desktop' | 'tablet' | 'mobile';
}

interface GitDiffResponse {
  filePath: string;
  diff: string;
  staged: boolean;
  truncated?: boolean;
}

type ViewMode = 'main' | 'settings';

function DiffViewer({ diff, isLoading }: { diff: string; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="diff-loading">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!diff || diff.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="diff-empty">
        <FileCode className="w-12 h-12 text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">No changes to display</p>
      </div>
    );
  }

  const lines = diff.split('\n');

  return (
    <ScrollArea className="h-[400px]" data-testid="diff-content">
      <pre className="font-mono text-[12px] leading-relaxed p-3">
        {lines.map((line, idx) => {
          let className = 'text-muted-foreground';
          let bgClassName = '';
          
          if (line.startsWith('+') && !line.startsWith('+++')) {
            className = 'text-green-500';
            bgClassName = 'bg-green-500/10';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            className = 'text-destructive';
            bgClassName = 'bg-destructive/10';
          } else if (line.startsWith('@@')) {
            className = 'text-primary';
            bgClassName = 'bg-primary/10';
          } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
            className = 'text-foreground font-medium';
          }

          return (
            <div
              key={idx}
              className={cn('px-2 -mx-2', bgClassName)}
              data-testid={`diff-line-${idx}`}
            >
              <span className={className}>{line}</span>
            </div>
          );
        })}
      </pre>
    </ScrollArea>
  );
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted rounded", className)}>
      <LazyMotionDiv
        className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function CommitSkeleton() {
  return (
    <div className="space-y-3" data-testid="commit-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-2 py-1.5">
          <div className="flex flex-col items-center pt-1">
            <ShimmerBar className="w-2 h-2 rounded-full" />
            <ShimmerBar className="w-0.5 flex-1 mt-1 min-h-[24px]" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <ShimmerBar className="h-3 w-3/4" />
            <div className="flex items-center gap-2">
              <ShimmerBar className="w-4 h-4 rounded-full" />
              <ShimmerBar className="h-2 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NoChangesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center" data-testid="no-changes-empty-state">
      <div className="w-12 h-12 flex items-center justify-center mb-3">
        <GitBranch className="w-12 h-12 text-muted-foreground/40" />
      </div>
      <h3 className="text-[15px] font-medium leading-tight text-foreground mb-1">
        No uncommitted changes
      </h3>
      <p className="text-[13px] text-muted-foreground">
        Your working directory is clean. Make some changes to see them here.
      </p>
    </div>
  );
}

export function ReplitGitPanel({ projectId, className, mode = 'desktop' }: ReplitGitPanelProps & { mode?: 'desktop' | 'tablet' | 'mobile' }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  
  const isTablet = mode === 'tablet';
  const isMobile = mode === 'mobile';
  const touchMode = isTablet || isMobile;
  const [commitMessage, setCommitMessage] = useState('');
  const [showConnections, setShowConnections] = useState(true);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileStaged, setSelectedFileStaged] = useState(false);

  const { data: status, refetch: refetchStatus, isLoading, isError, error } = useQuery<GitStatus>({
    queryKey: [`/api/git/projects/${projectId}/status`],
    queryFn: () => apiRequest('GET', `/api/git/projects/${projectId}/status`),
    retry: 1, // Only retry once to avoid long loading states
    staleTime: 30000, // 30 seconds
  });

  const { data: remotesData } = useQuery<{ remotes: { name: string; url: string; type: 'fetch' | 'push' }[] }>({
    queryKey: [`/api/git/projects/${projectId}/remotes`],
    queryFn: () => apiRequest('GET', `/api/git/projects/${projectId}/remotes`),
    enabled: !!status,
  });

  const { data: commitsData, isLoading: isLoadingCommits } = useQuery<{ commits: GitCommitInfo[] }>({
    queryKey: [`/api/git/projects/${projectId}/log`],
    queryFn: () => apiRequest('GET', `/api/git/projects/${projectId}/log`),
    enabled: !!status,
  });
  const commits = commitsData?.commits;

  const { data: branchesData } = useQuery<{ branches: GitBranchInfo[] }>({
    queryKey: [`/api/git/projects/${projectId}/branches`],
    queryFn: () => apiRequest('GET', `/api/git/projects/${projectId}/branches`),
    enabled: !!status,
  });
  const branches = branchesData?.branches || [];

  const { data: githubStatus, isLoading: isLoadingGitHub, refetch: refetchGitHubStatus } = useQuery<GitHubStatus>({
    queryKey: [`/api/git/github/status`],
    queryFn: () => apiRequest('GET', `/api/git/github/status`),
  });

  const { data: diffData, isLoading: isLoadingDiff } = useQuery<GitDiffResponse>({
    queryKey: [`/api/git/projects/${projectId}/diff`, selectedFile, selectedFileStaged],
    queryFn: () => apiRequest('GET', `/api/git/projects/${projectId}/diff/${encodeURIComponent(selectedFile!)}${selectedFileStaged ? '?staged=true' : ''}`),
    enabled: !!selectedFile,
  });

  const originRemote = remotesData?.remotes?.find(r => r.name === 'origin' && r.type === 'fetch');
  const repoName = originRemote?.url?.split('/').slice(-2).join('/').replace('.git', '') || '';

  const stageMutation = useMutation({
    mutationFn: async (files: string[]) => apiRequest('POST', `/api/git/projects/${projectId}/stage`, { files }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      toast({ description: 'Files staged' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to stage files', variant: 'destructive' });
    },
  });

  const unstageMutation = useMutation({
    mutationFn: async (files: string[]) => apiRequest('POST', `/api/git/projects/${projectId}/unstage`, { files }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      toast({ description: 'Files unstaged' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to unstage files', variant: 'destructive' });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/git/projects/${projectId}/pull`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/log`] });
      toast({ description: 'Changes pulled successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to pull changes', variant: 'destructive' });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/git/projects/${projectId}/push`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/log`] });
      toast({ description: 'Changes pushed successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to push changes', variant: 'destructive' });
    },
  });

  const fetchMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/git/projects/${projectId}/fetch`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      toast({ description: 'Fetched latest from remote' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to fetch from remote', variant: 'destructive' });
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (message: string) => apiRequest('POST', `/api/git/projects/${projectId}/commit`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/log`] });
      setCommitMessage('');
      toast({ description: 'Changes committed successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to commit', variant: 'destructive' });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (branch: string) => apiRequest('POST', `/api/git/projects/${projectId}/checkout`, { branch }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/branches`] });
      setShowBranchDropdown(false);
      toast({ description: 'Switched branch' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to switch branch', variant: 'destructive' });
    },
  });

  const connectRemoteMutation = useMutation({
    mutationFn: async (url: string) => apiRequest('POST', `/api/git/projects/${projectId}/remotes`, { url, name: 'origin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/remotes`] });
      setRemoteUrl('');
      toast({ description: 'Remote connected' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to connect remote', variant: 'destructive' });
    },
  });

  const disconnectGitHubMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/git/github/disconnect`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/github/status`] });
      toast({ description: 'GitHub disconnected successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to disconnect GitHub', variant: 'destructive' });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => apiRequest('POST', `/api/git/projects/${projectId}/branches`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/branches`] });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/status`] });
      toast({ description: 'Branch created successfully' });
      setShowBranchDropdown(false);
      setBranchSearch('');
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to create branch', variant: 'destructive' });
    },
  });

  const handleConnectGitHub = async () => {
    try {
      const response = await apiRequest('GET', `/api/git/github/connect`);
      if (response.authUrl) {
        window.open(response.authUrl, '_blank', 'width=600,height=700');
      }
    } catch (error: any) {
      toast({ description: error.message || 'Failed to connect to GitHub', variant: 'destructive' });
    }
  };

  const handleFileClick = (file: string, staged: boolean = false) => {
    setSelectedFile(file);
    setSelectedFileStaged(staged);
  };

  const closeDiffModal = () => {
    setSelectedFile(null);
    setSelectedFileStaged(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const hasChanges = status && (status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0);
  const unpushedCount = status?.ahead || 0;
  const unpushedCommits = commits?.slice(0, unpushedCount) || [];

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const importantBranches = filteredBranches.filter(b => b.name === 'main' || b.name === 'master');
  const activeBranches = filteredBranches.filter(b => !b.isRemote && b.name !== 'main' && b.name !== 'master');
  const staleBranches = filteredBranches.filter(b => b.isRemote);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-background", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    const errorMessage = (error as any)?.message || 'Failed to load Git status';
    const isAuthError = errorMessage.includes('Authentication') || errorMessage.includes('401');
    
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-background p-4", className)} data-testid="git-error-state">
        <GitBranch className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <h3 className="text-[15px] font-medium text-foreground mb-1">
          {isAuthError ? 'Sign in required' : 'Unable to load Git'}
        </h3>
        <p className="text-[13px] text-muted-foreground text-center mb-4">
          {isAuthError 
            ? 'Please sign in to access Git features' 
            : 'There was an error loading the Git panel'}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchStatus()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (viewMode === 'settings') {
    return (
      <div className={cn("flex flex-col h-full bg-[var(--ecode-surface)]", className)} data-testid="git-settings">
        <div className={cn(
          "flex items-center gap-2 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]",
          touchMode ? "px-4 min-h-[56px]" : "px-2.5 h-9"
        )}>
          <button
            onClick={() => setViewMode('main')}
            className={cn(
              "hover:bg-muted rounded-lg touch-manipulation",
              touchMode ? "p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1.5"
            )}
            data-testid="back-from-settings"
          >
            <ChevronLeft className={cn(touchMode ? "w-5 h-5" : "w-[18px] h-[18px]", "text-muted-foreground")} />
          </button>
          <span className={cn(
            "font-medium leading-tight text-foreground",
            touchMode ? "text-base" : "text-[15px]"
          )}>Settings</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-6">
            <div className="space-y-2">
              <h3 className="text-[15px] font-medium leading-tight text-foreground">Remote</h3>
              <div className="flex gap-2">
                <Input
                  value={remoteUrl || originRemote?.url || ''}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  className="flex-1 h-8 bg-background border-border rounded-lg"
                  data-testid="input-remote-url"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remoteUrl && connectRemoteMutation.mutate(remoteUrl)}
                  disabled={!remoteUrl || connectRemoteMutation.isPending}
                  className="h-8 border-border rounded-lg"
                  data-testid="button-create-remote"
                >
                  Create Remote
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowConnections(!showConnections)}
                className="flex items-center justify-between w-full p-3 bg-card border border-border rounded-lg"
              >
                <span className="text-[15px] font-medium leading-tight text-foreground">Connections</span>
                {showConnections ? <ChevronUp className="w-[18px] h-[18px] text-muted-foreground" /> : <ChevronDown className="w-[18px] h-[18px] text-muted-foreground" />}
              </button>

              <div className={cn("collapsible-content", showConnections && "expanded")}>
                <div className="space-y-2">
                  <div 
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                    data-testid="github-connection-section"
                  >
                      {isLoadingGitHub ? (
                        <div className="flex items-center gap-3">
                          <SiGithub className="w-[18px] h-[18px]" />
                          <span className="text-[15px] text-foreground">GitHub</span>
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" data-testid="github-status-loading" />
                        </div>
                      ) : githubStatus?.connected ? (
                        <>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-6 h-6" data-testid="github-avatar">
                              <AvatarImage src={githubStatus.avatarUrl} alt={githubStatus.username} />
                              <AvatarFallback>
                                <SiGithub className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[15px] text-foreground" data-testid="github-username">
                              {githubStatus.username}
                            </span>
                            <span className="flex items-center gap-1 text-[13px] text-green-600">
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                              Connected
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                            onClick={() => disconnectGitHubMutation.mutate(undefined)}
                            disabled={disconnectGitHubMutation.isPending}
                            data-testid="button-disconnect-github"
                          >
                            {disconnectGitHubMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <LogOut className="w-4 h-4 mr-1" />
                            )}
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <SiGithub className="w-[18px] h-[18px]" />
                            <span className="text-[15px] text-foreground">GitHub</span>
                            <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                              <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                              Disconnected
                            </span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 border-border rounded-lg"
                            onClick={handleConnectGitHub}
                            data-testid="button-connect-github"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Connect
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <SiBitbucket className="w-[18px] h-[18px] text-[#2684FF]" />
                        <span className="text-[15px] text-foreground">Bitbucket</span>
                        <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                          Disconnected
                        </span>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 border-border rounded-lg">
                        <ExternalLink className="w-3 h-3 mr-1" />Sign in
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <SiGitlab className="w-[18px] h-[18px] text-[#FC6D26]" />
                        <span className="text-[15px] text-foreground">GitLab</span>
                        <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                          Disconnected
                        </span>
                      </div>
                    <Button variant="outline" size="sm" className="h-8 border-border rounded-lg">
                      <ExternalLink className="w-3 h-3 mr-1" />Sign in
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-medium leading-tight text-foreground">Commit author</h3>
              <div className="p-3 bg-card border-2 border-primary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-[18px] h-[18px] text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium leading-tight text-foreground">{user?.username || 'User'}</span>
                      <a href="#" className="text-[13px] text-primary flex items-center gap-1">
                        GitHub Settings <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="text-[13px] text-muted-foreground">{user?.email || ''}</span>
                  </div>
                  <div className="w-[18px] h-[18px] bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-surface)] relative", className)} data-testid="git-panel">
      <div className={cn(
        "flex items-center justify-between border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]",
        touchMode ? "px-4 min-h-[56px]" : "px-2.5 h-9"
      )}>
        <button
          onClick={() => setShowBranchDropdown(!showBranchDropdown)}
          className={cn(
            "flex items-center gap-2 hover:bg-muted rounded-lg touch-manipulation",
            touchMode ? "px-3 py-2.5 min-h-[44px]" : "px-2 py-1"
          )}
          data-testid="branch-selector"
        >
          <GitBranch className={cn(touchMode ? "w-5 h-5" : "w-[18px] h-[18px]", "text-muted-foreground")} />
          <span className={cn(
            "font-medium leading-tight text-foreground",
            touchMode ? "text-base" : "text-[15px]"
          )}>{status?.branch || 'main'}</span>
          <ChevronDown className={cn(touchMode ? "w-5 h-5" : "w-[18px] h-[18px]", "text-muted-foreground")} />
        </button>
        
        <div className={cn("flex items-center", touchMode ? "gap-2" : "gap-1")}>
          <button
            onClick={() => setViewMode('settings')}
            className={cn(
              "hover:bg-muted rounded-lg touch-manipulation",
              touchMode ? "p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1.5"
            )}
            data-testid="git-settings-button"
          >
            <Settings className={cn(touchMode ? "w-5 h-5" : "w-[18px] h-[18px]", "text-muted-foreground")} />
          </button>
          <button
            onClick={() => refetchStatus()}
            className={cn(
              "hover:bg-muted rounded-lg touch-manipulation",
              touchMode ? "p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1.5"
            )}
            data-testid="git-refresh-button"
          >
            <RefreshCw className={cn(touchMode ? "w-5 h-5" : "w-[18px] h-[18px]", "text-muted-foreground")} />
          </button>
        </div>
      </div>

      <div className={cn("collapsible-content absolute top-12 left-2 right-2 z-50", showBranchDropdown && "expanded")}>
        <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-lg border border-border">
                <Search className="w-[18px] h-[18px] text-muted-foreground" />
                <input
                  type="text"
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  placeholder="Find or create a branch..."
                  className="flex-1 bg-inherit text-[15px] outline-none text-foreground placeholder:text-muted-foreground"
                  data-testid="input-branch-search"
                />
              </div>
            </div>

            <ScrollArea className="max-h-48">
              <div className="p-1">
                {importantBranches.length > 0 && (
                  <div className="mb-1">
                    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Important</div>
                    {importantBranches.map(branch => (
                      <button
                        key={branch.name}
                        onClick={() => checkoutMutation.mutate(branch.name)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-lg text-left"
                        data-testid={`branch-${branch.name}`}
                      >
                        <span className={cn("w-2 h-2 rounded-full", branch.current ? "bg-primary" : "bg-green-500")} />
                        <span className="text-[15px] text-foreground flex-1">{branch.name}</span>
                        {branch.current && <Check className="w-[18px] h-[18px] text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {activeBranches.length > 0 && (
                  <div className="mb-1">
                    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active</div>
                    {activeBranches.map(branch => (
                      <button
                        key={branch.name}
                        onClick={() => checkoutMutation.mutate(branch.name)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-lg text-left"
                        data-testid={`branch-${branch.name}`}
                      >
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-[15px] text-foreground">{branch.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {staleBranches.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Stale</div>
                    {staleBranches.slice(0, 5).map(branch => (
                      <button
                        key={branch.name}
                        onClick={() => checkoutMutation.mutate(branch.name)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-lg text-left"
                        data-testid={`branch-${branch.name}`}
                      >
                        <User className="w-[18px] h-[18px] text-muted-foreground" />
                        <span className="text-[15px] text-foreground truncate">{branch.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {branchSearch.trim() && !branches.some(b => b.name.toLowerCase() === branchSearch.trim().toLowerCase()) && (
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => createBranchMutation.mutate(branchSearch.trim())}
                      disabled={createBranchMutation.isPending}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-lg text-left"
                      data-testid="button-create-branch"
                    >
                      {createBranchMutation.isPending ? (
                        <Loader2 className="w-[18px] h-[18px] text-primary animate-spin" />
                      ) : (
                        <Plus className="w-[18px] h-[18px] text-primary" />
                      )}
                      <span className="text-[15px] text-primary">
                        Create branch: <span className="font-medium">{branchSearch.trim()}</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

      <ScrollArea className="flex-1">
        <div className={cn("space-y-2", touchMode ? "p-4" : "p-3")}>
          <div className={cn("space-y-2", touchMode && "space-y-3")}>
            <div className="flex items-center justify-between">
              <span className={cn("font-medium text-muted-foreground uppercase", touchMode ? "text-[13px]" : "text-[11px]")}>Remote Updates</span>
              {repoName && (
                <a
                  href={`https://github.com/${repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[13px] text-foreground hover:text-primary"
                  data-testid="link-github-repo"
                >
                  <SiGithub className="w-3 h-3" />
                  {repoName}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="font-medium text-foreground">origin/{status?.branch}</span>
                <span>•</span>
                <span>upstream</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">last fetched 1h ago</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchMutation.mutate(undefined)}
                  disabled={fetchMutation.isPending}
                  className="h-6 px-2 text-[13px] text-muted-foreground rounded-lg"
                  data-testid="button-fetch"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Fetch
                </Button>
              </div>
            </div>

            {(status?.ahead || 0) > 0 && (
              <p className="text-[13px] text-muted-foreground">{status?.ahead} commits to push</p>
            )}

            <div className={cn("flex", touchMode ? "gap-3 flex-wrap" : "gap-2")}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  pullMutation.mutate(undefined);
                  pushMutation.mutate(undefined);
                }}
                className={cn(
                  "flex-1 border-border rounded-lg touch-manipulation",
                  touchMode ? "h-11 text-[13px] min-w-[120px]" : "h-8 text-[13px]"
                )}
                data-testid="button-sync"
              >
                <RefreshCw className={cn(touchMode ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1")} />
                Sync with Remote
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pullMutation.mutate(undefined)}
                disabled={pullMutation.isPending}
                className={cn(
                  "border-border rounded-lg touch-manipulation",
                  touchMode ? "h-11 px-4 text-[13px]" : "h-8 px-3 text-[13px]"
                )}
                data-testid="button-pull"
              >
                <ArrowDown className={cn(touchMode ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1")} />
                Pull
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pushMutation.mutate(undefined)}
                disabled={pushMutation.isPending}
                className={cn(
                  "border-border rounded-lg touch-manipulation",
                  touchMode ? "h-11 px-4 text-[13px]" : "h-8 px-3 text-[13px]"
                )}
                data-testid="button-push"
              >
                <ArrowUp className={cn(touchMode ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1")} />
                Push
              </Button>
            </div>
          </div>

          <div className={cn("border-t border-border", touchMode ? "space-y-3 pt-4" : "space-y-2 pt-3")}>
            <h3 className={cn(
              "font-medium leading-tight text-foreground",
              touchMode ? "text-base" : "text-[15px]"
            )}>Commit</h3>
            
            {hasChanges ? (
              <div className="space-y-2">
                {status?.staged && status.staged.length > 0 && (
                  <div className={cn("space-y-1", touchMode && "space-y-0.5")}>
                    <div className={cn("font-medium text-muted-foreground uppercase", touchMode ? "text-[13px]" : "text-[11px]")}>Staged ({status.staged.length})</div>
                    {status.staged.map(file => (
                      <div key={file} className={cn(
                        "flex items-center justify-between rounded-lg hover:bg-muted group touch-manipulation",
                        touchMode ? "px-3 py-2.5 min-h-[44px]" : "px-2 py-1"
                      )}>
                        <button
                          onClick={() => handleFileClick(file, true)}
                          className={cn(
                            "flex items-center flex-1 min-w-0 text-left touch-manipulation",
                            touchMode ? "gap-3" : "gap-2"
                          )}
                          data-testid={`view-diff-staged-${file}`}
                        >
                          <FileCode className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-green-500 shrink-0")} />
                          <span className={cn(
                            "text-foreground truncate hover:underline",
                            touchMode ? "text-[13px]" : "text-[13px]"
                          )}>{file}</span>
                          <Eye className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground", !touchMode && "opacity-0 group-hover:opacity-100")} />
                        </button>
                        <button
                          onClick={() => unstageMutation.mutate([file])}
                          className={cn(
                            "hover:bg-muted rounded-lg touch-manipulation",
                            touchMode ? "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1 opacity-0 group-hover:opacity-100"
                          )}
                          data-testid={`unstage-${file}`}
                        >
                          <Minus className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground")} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {status?.unstaged && status.unstaged.length > 0 && (
                  <div className={cn("space-y-1", touchMode && "space-y-0.5")}>
                    <div className={cn("font-medium text-muted-foreground uppercase", touchMode ? "text-[13px]" : "text-[11px]")}>Changes ({status.unstaged.length})</div>
                    {status.unstaged.map(file => (
                      <div key={file} className={cn(
                        "flex items-center justify-between rounded-lg hover:bg-muted group touch-manipulation",
                        touchMode ? "px-3 py-2.5 min-h-[44px]" : "px-2 py-1"
                      )}>
                        <button
                          onClick={() => handleFileClick(file, false)}
                          className={cn(
                            "flex items-center flex-1 min-w-0 text-left touch-manipulation",
                            touchMode ? "gap-3" : "gap-2"
                          )}
                          data-testid={`view-diff-unstaged-${file}`}
                        >
                          <FileCode className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-yellow-500 shrink-0")} />
                          <span className={cn(
                            "text-foreground truncate hover:underline",
                            touchMode ? "text-[13px]" : "text-[13px]"
                          )}>{file}</span>
                          <Eye className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground", !touchMode && "opacity-0 group-hover:opacity-100")} />
                        </button>
                        <button
                          onClick={() => stageMutation.mutate([file])}
                          className={cn(
                            "hover:bg-muted rounded-lg touch-manipulation",
                            touchMode ? "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1 opacity-0 group-hover:opacity-100"
                          )}
                          data-testid={`stage-${file}`}
                        >
                          <Plus className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground")} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {status?.untracked && status.untracked.length > 0 && (
                  <div className={cn("space-y-1", touchMode && "space-y-0.5")}>
                    <div className={cn("font-medium text-muted-foreground uppercase", touchMode ? "text-[13px]" : "text-[11px]")}>Untracked ({status.untracked.length})</div>
                    {status.untracked.map(file => (
                      <div key={file} className={cn(
                        "flex items-center justify-between rounded-lg hover:bg-muted group touch-manipulation",
                        touchMode ? "px-3 py-2.5 min-h-[44px]" : "px-2 py-1"
                      )}>
                        <button
                          onClick={() => handleFileClick(file, false)}
                          className={cn(
                            "flex items-center flex-1 min-w-0 text-left touch-manipulation",
                            touchMode ? "gap-3" : "gap-2"
                          )}
                          data-testid={`view-diff-untracked-${file}`}
                        >
                          <FileCode className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground shrink-0")} />
                          <span className={cn(
                            "text-foreground truncate hover:underline",
                            touchMode ? "text-[13px]" : "text-[13px]"
                          )}>{file}</span>
                          <Eye className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground", !touchMode && "opacity-0 group-hover:opacity-100")} />
                        </button>
                        <button
                          onClick={() => stageMutation.mutate([file])}
                          className={cn(
                            "hover:bg-muted rounded-lg touch-manipulation",
                            touchMode ? "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1 opacity-0 group-hover:opacity-100"
                          )}
                          data-testid={`stage-${file}`}
                        >
                          <Plus className={cn(touchMode ? "w-4 h-4" : "w-3 h-3", "text-muted-foreground")} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className={cn(
                    "bg-background border-border rounded-lg",
                    touchMode ? "h-11 text-base" : "h-8 text-[15px]"
                  )}
                  data-testid="input-commit-message"
                />
                <Button
                  onClick={() => commitMutation.mutate(commitMessage)}
                  disabled={!commitMessage.trim() || commitMutation.isPending || !status?.staged?.length}
                  className={cn(
                    "w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg touch-manipulation",
                    touchMode ? "h-11 text-[13px]" : "h-8 text-[13px]"
                  )}
                  data-testid="button-commit"
                >
                  <GitCommit className={cn(touchMode ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1")} />
                  {commitMutation.isPending ? 'Committing...' : 'Commit'}
                </Button>
              </div>
            ) : (
              <NoChangesEmptyState />
            )}
          </div>

          {commits && commits.length > 0 && (
            <div className={cn("border-t border-border", touchMode ? "space-y-3 pt-4" : "space-y-2 pt-3")}>
              <h3 className={cn(
                "font-medium leading-tight text-foreground",
                touchMode ? "text-base" : "text-[15px]"
              )}>History</h3>
              
              {isLoadingCommits ? (
                <CommitSkeleton />
              ) : (
                <div className="space-y-1">
                  {commits.slice(0, 10).map((commit, idx) => (
                    <div key={commit.hash} className="flex items-start gap-2 py-1.5">
                      <div className="flex flex-col items-center pt-1">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          idx < unpushedCount ? "bg-primary" : "bg-muted-foreground"
                        )} />
                        {idx < commits.slice(0, 10).length - 1 && (
                          <span className="w-0.5 flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-foreground truncate",
                          touchMode ? "text-[13px]" : "text-[13px]"
                        )}>{commit.message}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{commit.shortHash}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(commit.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedFile} onOpenChange={() => closeDiffModal()}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              {selectedFile}
              {selectedFileStaged && (
                <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded">Staged</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <DiffViewer diff={diffData?.diff || ''} isLoading={isLoadingDiff} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
