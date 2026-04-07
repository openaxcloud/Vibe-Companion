/**
 * Branch Manager - Git branch management interface
 * Create, delete, merge, and switch branches with Apple-grade UX
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  GitBranch,
  Plus,
  Trash2,
  GitMerge,
  Check,
  Search,
  MoreVertical,
  RefreshCw,
  GitPullRequest,
  Calendar,
  User,
  ArrowRight,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient as globalQueryClient } from '@/lib/queryClient';

interface GitBranchInfo {
  name: string;
  current: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
  ahead: number;
  behind: number;
  isRemote: boolean;
  trackingBranch?: string;
}

interface ApiBranchInfo {
  name: string;
  current: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  ahead: number;
  behind: number;
  isRemote: boolean;
  trackingBranch?: string;
}

interface BranchesResponse {
  branches: ApiBranchInfo[];
}

interface BranchManagerProps {
  projectId: string | number;
  onBranchChange?: (branchName: string) => void;
  className?: string;
}

export function BranchManager({
  projectId,
  onBranchChange,
  className
}: BranchManagerProps) {
  const [filteredBranches, setFilteredBranches] = useState<GitBranchInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branchesData, isLoading, error, refetch } = useQuery<BranchesResponse>({
    queryKey: [`/api/git/projects/${projectId}/branches`],
    queryFn: () => apiRequest('GET', `/api/git/projects/${projectId}/branches`),
  });

  const branches: GitBranchInfo[] = (branchesData?.branches || []).map(branch => ({
    ...branch,
    lastCommit: {
      ...branch.lastCommit,
      date: new Date(branch.lastCommit.date)
    }
  }));

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBranches(branches);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = branches.filter(branch =>
      branch.name.toLowerCase().includes(query) ||
      branch.lastCommit.message.toLowerCase().includes(query) ||
      branch.lastCommit.author.toLowerCase().includes(query)
    );

    setFilteredBranches(filtered);
  }, [searchQuery, branches]);

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest<{ success: boolean; branch: string }>('POST', '/api/git/branches', { name });
    },
    onSuccess: (data) => {
      toast({
        title: "Branch created",
        description: `Created branch "${data.branch}" successfully`,
      });
      setShowCreateDialog(false);
      setNewBranchName('');
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/branches`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create branch",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async (branch: string) => {
      return apiRequest<{ success: boolean; branch: string }>('POST', '/api/git/checkout', { branch });
    },
    onSuccess: (data) => {
      toast({
        title: "Branch switched",
        description: `Switched to branch "${data.branch}"`,
      });
      if (onBranchChange) {
        onBranchChange(data.branch);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/branches`] });
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to switch branch",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchName: string) => {
      return apiRequest<{ success: boolean; deleted: string }>('DELETE', `/api/git/branches/${encodeURIComponent(branchName)}?force=true`);
    },
    onSuccess: (data) => {
      toast({
        title: "Branch deleted",
        description: `Deleted branch "${data.deleted}"`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/branches`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete branch",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const mergeBranchMutation = useMutation({
    mutationFn: async (branch: string) => {
      return apiRequest<{ success: boolean; output: string }>('POST', '/api/git/merge', { branch });
    },
    onSuccess: () => {
      const currentBranch = branches.find(b => b.current);
      toast({
        title: "Branch merged",
        description: `Merge completed successfully into "${currentBranch?.name || 'current branch'}"`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/branches`] });
      queryClient.invalidateQueries({ queryKey: [`/api/git/projects/${projectId}/log`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Merge failed",
        description: error.message?.includes('conflict') ? "Please resolve conflicts manually" : error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast({
        title: "Invalid branch name",
        description: "Please enter a valid branch name",
        variant: "destructive",
      });
      return;
    }
    createBranchMutation.mutate(newBranchName.trim());
  };

  const handleCheckoutBranch = async (branchName: string) => {
    checkoutMutation.mutate(branchName);
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (branches.find(b => b.name === branchName)?.current) {
      toast({
        title: "Cannot delete current branch",
        description: "Please switch to another branch first",
        variant: "destructive",
      });
      return;
    }
    deleteBranchMutation.mutate(branchName);
  };

  const handleMergeBranch = async (branchName: string) => {
    mergeBranchMutation.mutate(branchName);
  };

  const currentBranch = branches.find(b => b.current);
  const isMutating = createBranchMutation.isPending || checkoutMutation.isPending || 
                     deleteBranchMutation.isPending || mergeBranchMutation.isPending;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Branches
          </CardTitle>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </Button>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" data-testid="button-new-branch">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Branch
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Branch</DialogTitle>
                  <DialogDescription>
                    Branch will be created from{' '}
                    <code className="px-1 py-0.5 rounded bg-muted text-[11px]">
                      {currentBranch?.name || 'current branch'}
                    </code>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium">Branch name</label>
                    <Input
                      placeholder="feature/new-feature"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateBranch();
                        }
                      }}
                      data-testid="input-branch-name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateBranch}
                    disabled={createBranchMutation.isPending || !newBranchName.trim()}
                    data-testid="button-create-branch"
                  >
                    {createBranchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Branch
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {currentBranch && (
          <div className="mt-3 p-2 rounded-lg bg-[var(--ecode-orange)]/10 border border-[var(--ecode-orange)]/20">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <Check className="h-3.5 w-3.5 text-[var(--ecode-orange)]" />
                <span className="text-[13px] font-medium">{currentBranch.name}</span>
                {currentBranch.trackingBranch && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {currentBranch.trackingBranch}
                    </span>
                  </>
                )}
              </div>

              {(currentBranch.ahead > 0 || currentBranch.behind > 0) && (
                <div className="flex items-center gap-1 text-[11px]">
                  {currentBranch.ahead > 0 && (
                    <Badge variant="outline" className="h-5 px-1 text-[10px] bg-green-500/10 text-green-600">
                      ↑{currentBranch.ahead}
                    </Badge>
                  )}
                  {currentBranch.behind > 0 && (
                    <Badge variant="outline" className="h-5 px-1 text-[10px] bg-yellow-500/10 text-yellow-600">
                      ↓{currentBranch.behind}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-[11px]"
            data-testid="input-search-branches"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading branches...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-[13px] text-muted-foreground">
            <GitBranch className="h-8 w-8 mb-2 opacity-50" />
            <p>Failed to load branches</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[13px] text-muted-foreground">
            <GitBranch className="h-8 w-8 mb-2 opacity-50" />
            <p>No branches found</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="px-3 py-2 space-y-1">
              {filteredBranches.map((branch) => (
                <div
                  key={branch.name}
                  className={cn(
                    "group p-2 rounded-lg cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    branch.current && "bg-muted",
                    isMutating && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => !branch.current && handleCheckoutBranch(branch.name)}
                  data-testid={`branch-item-${branch.name}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {branch.current ? (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ecode-orange)]" />
                        ) : (
                          <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        )}
                        <span className={cn(
                          "text-[13px] truncate",
                          branch.current && "font-medium"
                        )}>
                          {branch.name}
                        </span>
                      </div>

                      <div className="ml-5 space-y-1">
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {branch.lastCommit.message}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-2.5 w-2.5" />
                            <span className="truncate max-w-[100px]">
                              {branch.lastCommit.author}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>
                              {formatDistanceToNow(branch.lastCommit.date, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          data-testid={`button-branch-menu-${branch.name}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!branch.current && (
                          <>
                            <DropdownMenuItem onClick={() => handleCheckoutBranch(branch.name)}>
                              <Check className="h-3.5 w-3.5 mr-2" />
                              Checkout
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMergeBranch(branch.name)}>
                              <GitMerge className="h-3.5 w-3.5 mr-2" />
                              Merge into current
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteBranch(branch.name)}
                          disabled={branch.current}
                          className="text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete branch
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
