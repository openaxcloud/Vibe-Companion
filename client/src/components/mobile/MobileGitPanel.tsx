import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
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
  Loader2,
  User,
  Plus,
  Minus,
  FileText,
  FilePlus,
  FileEdit,
  ChevronRight,
  LogOut,
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

interface MobileGitPanelProps {
  projectId: string;
  className?: string;
}

type ViewMode = 'main' | 'settings' | 'branches';

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted rounded", className)}>
      <LazyMotionDiv
        className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

function CommitListSkeleton() {
  return (
    <div className="space-y-1" data-testid="commits-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-2 py-1.5">
          <div className="flex flex-col items-center">
            <ShimmerBar className="w-1.5 h-1.5 rounded-full mt-1.5" />
            <ShimmerBar className="w-0.5 h-6 mt-0.5" />
          </div>
          <div className="flex-1 space-y-1">
            <ShimmerBar className="h-3 w-3/4" />
            <div className="flex items-center gap-1.5">
              <ShimmerBar className="w-4 h-4 rounded-full" />
              <ShimmerBar className="h-2.5 w-16" />
              <ShimmerBar className="h-2.5 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4" data-testid="empty-state">
      <GitBranch className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-[14px] font-medium text-foreground mb-0.5">
        No uncommitted changes
      </p>
      <p className="text-[12px] text-muted-foreground text-center">
        Your working directory is clean
      </p>
    </div>
  );
}

export function MobileGitPanel({ projectId, className }: MobileGitPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [showConnections, setShowConnections] = useState(true);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [showChanges, setShowChanges] = useState(true);

  const { data: status, refetch: refetchStatus, isLoading, isError, error } = useQuery<GitStatus>({
    queryKey: [`/api/projects/${projectId}/git/diff`],
    queryFn: () => apiRequest(`/api/projects/${projectId}/git/diff`, 'GET'),
    retry: 1, // Only retry once to avoid long loading states
    staleTime: 30000, // 30 seconds
  });

  // Remotes endpoint is not available in backend - use empty data
  const remotesData = { remotes: [] };

  const { data: commitsData, isLoading: isLoadingCommits } = useQuery<{ commits: GitCommitInfo[] }>({
    queryKey: [`/api/projects/${projectId}/git/commits`],
    queryFn: () => apiRequest(`/api/projects/${projectId}/git/commits`, 'GET'),
    enabled: !!status,
  });
  const commits = commitsData?.commits;

  const { data: branchesData } = useQuery<{ branches: GitBranchInfo[] }>({
    queryKey: [`/api/projects/${projectId}/git/branches`],
    queryFn: () => apiRequest(`/api/projects/${projectId}/git/branches`, 'GET'),
    enabled: !!status,
  });
  const branches = branchesData?.branches || [];

  const { data: githubStatus, isLoading: isLoadingGitHub, refetch: refetchGitHubStatus } = useQuery<GitHubStatus>({
    queryKey: [`/api/github/user`],
    queryFn: () => apiRequest(`/api/github/user`, 'GET').then(user => ({
      connected: !!user?.id,
      username: user?.username,
      avatarUrl: user?.avatarUrl,
    })).catch(() => ({ connected: false })),
  });

  const originRemote = remotesData?.remotes?.find(r => r.name === 'origin' && r.type === 'fetch');
  const repoName = originRemote?.url?.split('/').slice(-2).join('/').replace('.git', '') || '';

  const pullMutation = useMutation({
    mutationFn: async () => apiRequest(`/api/projects/${projectId}/git/pull`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/commits`] });
      toast({ description: 'Changes pulled successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to pull changes', variant: 'destructive' });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async () => apiRequest(`/api/projects/${projectId}/git/push`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/commits`] });
      toast({ description: 'Changes pushed successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to push changes', variant: 'destructive' });
    },
  });

  // Fetch endpoint is not available in backend - commented out
  // const fetchMutation = useMutation({
  //   mutationFn: async () => apiRequest(`/api/projects/${projectId}/git/fetch`, 'POST', {}),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
  //     toast({ description: 'Fetched latest from remote' });
  //   },
  //   onError: (error: any) => {
  //     toast({ description: error.message || 'Failed to fetch', variant: 'destructive' });
  //   },
  // });

  const commitMutation = useMutation({
    mutationFn: async (message: string) => apiRequest(`/api/projects/${projectId}/git/commits`, 'POST', { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/commits`] });
      setCommitMessage('');
      toast({ description: 'Changes committed successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to commit', variant: 'destructive' });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (branch: string) => apiRequest(`/api/projects/${projectId}/git/checkout`, 'POST', { branch }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/branches`] });
      setShowBranchDropdown(false);
      toast({ description: 'Switched branch successfully' });
    },
    onError: (error: any) => {
      toast({ description: error.message || 'Failed to switch branch', variant: 'destructive' });
    },
  });

  // Remote management endpoint is not available in backend - this mutation is disabled
  // const connectRemoteMutation = useMutation({
  //   mutationFn: async (url: string) => apiRequest(`/api/projects/${projectId}/git/remotes`, 'POST', { url, name: 'origin' }),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/remotes`] });
  //     setRemoteUrl('');
  //     toast({ description: 'Remote connected successfully' });
  //   },
  //   onError: (error: any) => {
  //     toast({ description: error.message || 'Failed to connect remote', variant: 'destructive' });
  //   },
  // });
  const connectRemoteMutation = { mutate: () => toast({ description: 'Remote management not available', variant: 'destructive' }), isPending: false };

  // GitHub disconnect/connect endpoints are not available in backend - these are disabled
  // const disconnectGitHubMutation = useMutation({
  //   mutationFn: async () => apiRequest(`/api/github/user`, 'DELETE'),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: [`/api/github/user`] });
  //     toast({ description: 'GitHub disconnected successfully' });
  //   },
  //   onError: (error: any) => {
  //     toast({ description: error.message || 'Failed to disconnect GitHub', variant: 'destructive' });
  //   },
  // });
  const disconnectGitHubMutation = { mutate: () => toast({ description: 'GitHub disconnect not available', variant: 'destructive' }), isPending: false };

  const handleConnectGitHub = async () => {
    try {
      toast({ description: 'GitHub connect functionality not available in backend', variant: 'destructive' });
    } catch (error: any) {
      toast({ description: error.message || 'Failed to connect to GitHub', variant: 'destructive' });
    }
  };

  // Stage/unstage endpoints are not available in backend - these are disabled
  // const stageMutation = useMutation({
  //   mutationFn: async (files: string[]) => apiRequest(`/api/projects/${projectId}/git/stage`, 'POST', { files }),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
  //     toast({ description: 'Files staged successfully' });
  //   },
  //   onError: (error: any) => {
  //     toast({ description: error.message || 'Failed to stage files', variant: 'destructive' });
  //   },
  // });

  // const unstageMutation = useMutation({
  //   mutationFn: async (files: string[]) => apiRequest(`/api/projects/${projectId}/git/unstage`, 'POST', { files }),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git/diff`] });
  //     toast({ description: 'Files unstaged successfully' });
  //   },
  //   onError: (error: any) => {
  //     toast({ description: error.message || 'Failed to unstage files', variant: 'destructive' });
  //   },
  // });

  const stageMutation = { mutate: () => toast({ description: 'Stage functionality not available in backend', variant: 'destructive' }), isPending: false };
  const unstageMutation = { mutate: () => toast({ description: 'Unstage functionality not available in backend', variant: 'destructive' }), isPending: false };

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
      <div className={cn("flex items-center justify-center h-full bg-card", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    const errorMessage = (error instanceof Error ? error.message : null) || 'Failed to load Git status';
    const isAuthError = errorMessage.includes('Authentication') || errorMessage.includes('401');
    
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-card p-4", className)} data-testid="mobile-git-error-state">
        <GitBranch className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <h3 className="text-[14px] font-medium text-foreground mb-0.5">
          {isAuthError ? 'Sign in required' : 'Unable to load Git'}
        </h3>
        <p className="text-[12px] text-muted-foreground text-center mb-4">
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
      <div className={cn("flex flex-col h-full bg-card", className)} data-testid="mobile-git-settings">
        <div className="flex items-center gap-3 px-4 min-h-[56px] border-b border-border">
          <button
            onClick={() => setViewMode('main')}
            className="w-11 h-11 flex items-center justify-center hover:bg-muted rounded-lg"
            data-testid="back-from-settings"
          >
            <ChevronLeft className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
          <span className="text-[15px] font-medium leading-tight text-foreground">Settings</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <h3 className="text-[15px] font-medium leading-tight text-foreground">Remote</h3>
              <div className="flex gap-2">
                <Input
                  value={remoteUrl || originRemote?.url || ''}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  className="flex-1 h-11 rounded-lg bg-card border-border text-[15px] text-foreground"
                  data-testid="input-remote-url"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!remoteUrl) return;
                    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/).+\.(git)?$/i;
                    const simpleHttpsPattern = /^https?:\/\/.+\/.+$/i;
                    if (!gitUrlPattern.test(remoteUrl) && !simpleHttpsPattern.test(remoteUrl)) {
                      toast({
                        title: 'Invalid Git URL',
                        description: 'Please enter a valid git repository URL (e.g., https://github.com/user/repo.git)',
                        variant: 'destructive',
                      });
                      return;
                    }
                    connectRemoteMutation.mutate(remoteUrl);
                  }}
                  disabled={!remoteUrl || connectRemoteMutation.isPending}
                  className="h-11 px-4 rounded-lg border-border text-[15px] text-foreground"
                  data-testid="button-create-remote"
                >
                  Create Remote
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowConnections(!showConnections)}
                className="flex items-center justify-between w-full min-h-[44px] p-3 bg-card border border-border rounded-lg"
                data-testid="toggle-connections"
              >
                <span className="text-[15px] font-medium leading-tight text-foreground">Connections</span>
                {showConnections ? (
                  <ChevronUp className="w-[18px] h-[18px] text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-[18px] h-[18px] text-muted-foreground" />
                )}
              </button>

              <div className={cn("collapsible-content", showConnections && "expanded")}>
                <div>
                  <div className="space-y-2">
                      {/* GitHub - Dynamic */}
                      <div 
                        className="flex items-center justify-between min-h-[44px] p-3 bg-card border border-border rounded-lg"
                        data-testid="github-connection-section"
                      >
                        {isLoadingGitHub ? (
                          <div className="flex items-center gap-3">
                            <SiGithub className="w-[18px] h-[18px] text-foreground" />
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
                              className="h-10 rounded-lg text-red-500 hover:text-red-600 hover:bg-destructive/10"
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
                              <SiGithub className="w-[18px] h-[18px] text-foreground" />
                              <span className="text-[15px] text-foreground">GitHub</span>
                              <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                                <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                                Disconnected
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 rounded-lg border-border"
                              onClick={handleConnectGitHub}
                              data-testid="button-connect-github"
                            >
                              <ExternalLink className="w-[18px] h-[18px] mr-1" />
                              Connect
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-between min-h-[44px] p-3 bg-card border border-border rounded-lg">
                        <div className="flex items-center gap-3">
                          <SiBitbucket className="w-[18px] h-[18px] text-blue-500" />
                          <span className="text-[15px] text-foreground">Bitbucket</span>
                          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                            <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                            Disconnected
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 rounded-lg border-border"
                          data-testid="button-signin-bitbucket"
                        >
                          <ExternalLink className="w-[18px] h-[18px] mr-1" />
                          Sign in
                        </Button>
                      </div>

                      <div className="flex items-center justify-between min-h-[44px] p-3 bg-card border border-border rounded-lg">
                        <div className="flex items-center gap-3">
                          <SiGitlab className="w-[18px] h-[18px] text-orange-500" />
                          <span className="text-[15px] text-foreground">GitLab</span>
                          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                            <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                            Disconnected
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 rounded-lg border-border"
                          data-testid="button-signin-gitlab"
                        >
                          <ExternalLink className="w-[18px] h-[18px] mr-1" />
                          Sign in
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            <div className="space-y-3">
              <h3 className="text-[15px] font-medium leading-tight text-foreground">Commit author</h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between min-h-[44px] p-3 bg-card border-2 border-blue-500 rounded-lg">
                  <div className="flex items-center gap-3">
                    {user?.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.username || 'User'} 
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="w-[18px] h-[18px] text-white" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium leading-tight text-foreground">{user?.username || 'User'}</span>
                        <span className="text-[13px] text-muted-foreground">Default Profile</span>
                      </div>
                      <span className="text-[13px] text-muted-foreground">{user?.username || 'User'} &lt;{user?.email || 'user@example.com'}&gt;</span>
                    </div>
                  </div>
                  <div className="w-[18px] h-[18px] bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
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
    <div className={cn("flex flex-col h-full bg-card", className)} data-testid="mobile-git-panel">
      <div className="flex items-center justify-between px-3 h-12 border-b border-border">
        <button
          onClick={() => setShowBranchDropdown(!showBranchDropdown)}
          className="flex items-center gap-1.5 hover:bg-muted rounded-md px-2 py-1.5"
          data-testid="branch-selector"
        >
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="text-[14px] font-medium text-foreground">{status?.branch || 'main'}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <div className="flex items-center">
          <button
            onClick={() => setViewMode('settings')}
            className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-md"
            data-testid="git-settings-button"
          >
            <Settings className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
          <button
            onClick={() => refetchStatus()}
            className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-md"
            data-testid="git-refresh-button"
          >
            <RefreshCw className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className={cn("collapsible-content absolute top-12 left-3 right-3 z-50 bg-card border border-border rounded-md shadow-lg", showBranchDropdown && "expanded")}>
        <div>
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 px-2.5 h-8 bg-muted rounded-md border border-border">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  placeholder="Find or create a branch..."
                  className="flex-1 bg-inherit text-[13px] outline-none text-foreground placeholder:text-muted-foreground"
                  data-testid="input-branch-search"
                />
              </div>
            </div>

            <ScrollArea className="max-h-52">
              <div className="p-1.5">
                {importantBranches.length > 0 && (
                  <div className="mb-1.5">
                    <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Important</div>
                    {importantBranches.map(branch => (
                      <button
                        key={branch.name}
                        onClick={() => checkoutMutation.mutate(branch.name)}
                        className="w-full flex items-center gap-2 px-2 h-8 hover:bg-muted rounded-md"
                        data-testid={`branch-${branch.name}`}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", branch.current ? "bg-blue-500" : "bg-green-500")} />
                        <span className="text-[13px] text-foreground flex-1 text-left">{branch.name}</span>
                        {branch.current && <Check className="w-4 h-4 text-blue-500" />}
                      </button>
                    ))}
                  </div>
                )}

                {activeBranches.length > 0 && (
                  <div className="mb-1.5">
                    <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Active</div>
                    {activeBranches.map(branch => (
                      <button
                        key={branch.name}
                        onClick={() => checkoutMutation.mutate(branch.name)}
                        className="w-full flex items-center gap-2 px-2 h-8 hover:bg-muted rounded-md"
                        data-testid={`branch-${branch.name}`}
                      >
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <div className="flex-1 text-left">
                          <span className="text-[13px] text-foreground">{branch.name}</span>
                          {branch.lastCommit?.author && (
                            <span className="text-[11px] text-muted-foreground ml-1.5">{branch.lastCommit.author}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {staleBranches.length > 0 && (
                  <div>
                    <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Stale</div>
                    {staleBranches.slice(0, 5).map(branch => (
                      <button
                        key={branch.name}
                        onClick={() => checkoutMutation.mutate(branch.name)}
                        className="w-full flex items-center gap-2 px-2 h-8 hover:bg-muted rounded-md"
                        data-testid={`branch-${branch.name}`}
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-[13px] text-foreground flex-1 text-left truncate">{branch.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
        </div>
      </div>

      <ScrollArea className="flex-1 pb-20">
        <div className="p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">Remote Updates</span>
              {repoName && (
                <a
                  href={`https://github.com/${repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[13px] text-foreground hover:text-blue-500"
                  data-testid="link-github-repo"
                >
                  <SiGithub className="w-4 h-4" />
                  {repoName.split('/')[1] || repoName}
                </a>
              )}
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-medium text-foreground">origin/{status?.branch}</span>
                <span>•</span>
                <span>upstream</span>
              </div>
              <span className="text-[12px] text-muted-foreground">last fetched 1 h</span>
            </div>

            {(status?.ahead || 0) > 0 && (
              <p className="text-[13px] text-muted-foreground">{status?.ahead} commits to push</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  pullMutation.mutate(undefined);
                  pushMutation.mutate(undefined);
                }}
                className="flex-1 h-9 rounded-md border-border text-[13px] text-foreground"
                data-testid="button-sync"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Sync with Remote
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pullMutation.mutate(undefined)}
                disabled={pullMutation.isPending}
                className="h-9 px-3 rounded-md border-border text-[13px] text-foreground"
                data-testid="button-pull"
              >
                <ArrowDown className="w-4 h-4 mr-1" />
                Pull
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-border">
            <h3 className="text-[13px] font-medium text-foreground">Commit</h3>

            {hasChanges && (
              <div className="space-y-2" data-testid="changes-section">
                <button
                  onClick={() => setShowChanges(!showChanges)}
                  className="flex items-center justify-between w-full min-h-[36px] px-2.5 py-1.5 bg-card border border-border rounded-md hover:bg-muted"
                  data-testid="toggle-changes-section"
                >
                  <div className="flex items-center gap-2">
                    {showChanges ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-[13px] font-medium text-foreground">Changes</span>
                    <span className="text-[12px] text-muted-foreground">
                      ({(status?.staged?.length || 0) + (status?.unstaged?.length || 0) + (status?.untracked?.length || 0)} files)
                    </span>
                  </div>
                </button>

                <div className={cn("collapsible-content", showChanges && "expanded")}>
                  <div>
                    <div className="space-y-3 pt-1">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const allFiles = [...(status?.unstaged || []), ...(status?.untracked || [])];
                              if (allFiles.length > 0) stageMutation.mutate(allFiles);
                            }}
                            disabled={stageMutation.isPending || ((status?.unstaged?.length || 0) + (status?.untracked?.length || 0)) === 0}
                            className="flex-1 h-8 rounded-md border-border text-[12px] text-foreground"
                            data-testid="button-stage-all"
                          >
                            {stageMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 mr-1" />
                            )}
                            Stage All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if ((status?.staged?.length || 0) > 0) unstageMutation.mutate(status?.staged || []);
                            }}
                            disabled={unstageMutation.isPending || (status?.staged?.length || 0) === 0}
                            className="flex-1 h-8 rounded-md border-border text-[12px] text-foreground"
                            data-testid="button-unstage-all"
                          >
                            {unstageMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Minus className="w-3.5 h-3.5 mr-1" />
                            )}
                            Unstage All
                          </Button>
                        </div>

                        {(status?.staged?.length || 0) > 0 && (
                          <div className="space-y-1" data-testid="staged-files-section">
                            <div className="flex items-center gap-1.5 px-1">
                              <span className="text-[11px] uppercase tracking-wider font-medium text-green-600 dark:text-green-400">Staged</span>
                              <span className="text-[11px] text-muted-foreground">({status?.staged?.length})</span>
                            </div>
                            <div className="space-y-0.5">
                              {status?.staged?.map((file) => (
                                <div
                                  key={file}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md"
                                  data-testid={`staged-file-${file}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileText className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                    <span className="text-[12px] text-foreground truncate">{file}</span>
                                  </div>
                                  <button
                                    onClick={() => unstageMutation.mutate([file])}
                                    disabled={unstageMutation.isPending}
                                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-destructive/10 text-red-500 dark:text-red-400 flex-shrink-0"
                                    data-testid={`button-unstage-${file}`}
                                  >
                                    {unstageMutation.isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Minus className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(status?.unstaged?.length || 0) > 0 && (
                          <div className="space-y-1" data-testid="unstaged-files-section">
                            <div className="flex items-center gap-1.5 px-1">
                              <span className="text-[11px] uppercase tracking-wider font-medium text-amber-600 dark:text-amber-400">Modified</span>
                              <span className="text-[11px] text-muted-foreground">({status?.unstaged?.length})</span>
                            </div>
                            <div className="space-y-0.5">
                              {status?.unstaged?.map((file) => (
                                <div
                                  key={file}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md"
                                  data-testid={`unstaged-file-${file}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                    <span className="text-[12px] text-foreground truncate">{file}</span>
                                  </div>
                                  <button
                                    onClick={() => stageMutation.mutate([file])}
                                    disabled={stageMutation.isPending}
                                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-green-100 dark:hover:bg-green-950/50 text-green-600 dark:text-green-400 flex-shrink-0"
                                    data-testid={`button-stage-${file}`}
                                  >
                                    {stageMutation.isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Plus className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(status?.untracked?.length || 0) > 0 && (
                          <div className="space-y-1" data-testid="untracked-files-section">
                            <div className="flex items-center gap-1.5 px-1">
                              <span className="text-[11px] uppercase tracking-wider font-medium text-blue-500">Untracked</span>
                              <span className="text-[11px] text-muted-foreground">({status?.untracked?.length})</span>
                            </div>
                            <div className="space-y-0.5">
                              {status?.untracked?.map((file) => (
                                <div
                                  key={file}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md"
                                  data-testid={`untracked-file-${file}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FilePlus className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                    <span className="text-[12px] text-foreground truncate">{file}</span>
                                  </div>
                                  <button
                                    onClick={() => stageMutation.mutate([file])}
                                    disabled={stageMutation.isPending}
                                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-green-100 dark:hover:bg-green-950/50 text-green-600 dark:text-green-400 flex-shrink-0"
                                    data-testid={`button-stage-${file}`}
                                  >
                                    {stageMutation.isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Plus className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {hasChanges ? (
              <div className="space-y-2">
                <Input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="h-9 rounded-md bg-card border-border text-[13px]"
                  data-testid="input-commit-message"
                />
                <Button
                  onClick={() => commitMutation.mutate(commitMessage)}
                  disabled={!commitMessage.trim() || commitMutation.isPending}
                  className="w-full h-9 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-[13px]"
                  data-testid="button-commit"
                >
                  {commitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <GitCommit className="w-4 h-4 mr-1.5" />
                  )}
                  Commit {status?.staged.length || 0} staged changes
                </Button>
              </div>
            ) : (
              <EmptyState onRefresh={() => refetchStatus()} />
            )}
          </div>

          {isLoadingCommits ? (
            <div className="space-y-2 pt-3 border-t border-border">
              <CommitListSkeleton />
            </div>
          ) : commits && commits.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border">
              {unpushedCommits.length > 0 && (
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Not pushed to remote</span>
                </div>
              )}

              <div className="space-y-0.5">
                {commits.slice(0, 10).map((commit, idx) => (
                  <div
                    key={commit.hash}
                    className="flex items-start gap-2 py-1.5"
                    data-testid={`commit-${commit.hash}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full mt-1.5",
                        idx >= unpushedCount ? "bg-muted-foreground" : "bg-green-500"
                      )} />
                      {idx < commits.length - 1 && (
                        <div className="w-0.5 h-8 bg-border mt-0.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {commit.message}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[7px] text-white font-medium">
                          {commit.author?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span>{commit.author}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(commit.date)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-3 py-2 pb-[calc(8px+env(safe-area-inset-bottom))]" data-testid="bottom-action-bar">
        {hasChanges ? (
          <Button
            onClick={() => commitMessage.trim() && commitMutation.mutate(commitMessage)}
            disabled={!commitMessage.trim() || commitMutation.isPending}
            className="w-full h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[14px] font-medium"
            data-testid="bottom-button-commit"
          >
            {commitMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <GitCommit className="w-4 h-4 mr-1.5" />
            )}
            Commit Changes
          </Button>
        ) : unpushedCommits.length > 0 ? (
          <Button
            onClick={() => pushMutation.mutate(undefined)}
            disabled={pushMutation.isPending}
            className="w-full h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[14px] font-medium"
            data-testid="bottom-button-push"
          >
            {pushMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4 mr-1.5" />
            )}
            Push {unpushedCommits.length} Commit{unpushedCommits.length > 1 ? 's' : ''}
          </Button>
        ) : (
          <Button
            onClick={() => pullMutation.mutate(undefined)}
            disabled={pullMutation.isPending}
            className="w-full h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[14px] font-medium"
            data-testid="bottom-button-pull"
          >
            {pullMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowDown className="w-4 h-4 mr-1.5" />
            )}
            Pull Latest
          </Button>
        )}
      </div>
    </div>
  );
}
