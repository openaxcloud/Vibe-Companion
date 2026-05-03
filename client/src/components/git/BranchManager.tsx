/**
 * Branch Manager - Git branch management interface
 * Uses canonical per-project routes: /api/git/:projectId/...
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GitBranch,
  Plus,
  Trash2,
  GitMerge,
  Check,
  Search,
  MoreVertical,
  RefreshCw,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface GitBranchInfo {
  name: string;
  current: boolean;
  remote: string | null;
}

interface BranchManagerProps {
  projectId: string | number;
  onBranchChange?: (branchName: string) => void;
  className?: string;
}

export function BranchManager({ projectId, onBranchChange, className }: BranchManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches = [], isLoading, error, refetch } = useQuery<GitBranchInfo[]>({
    queryKey: [`/api/git/${projectId}/branches`],
    queryFn: () => apiRequest('GET', `/api/git/${projectId}/branches`).then(r => r.json()),
  });

  const filteredBranches = searchQuery.trim()
    ? branches.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : branches;

  const currentBranch = branches.find((b) => b.current);

  const invalidateBranches = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/git/${projectId}/branches`] });
    queryClient.invalidateQueries({ queryKey: ['git-branches', String(projectId)] });
    queryClient.invalidateQueries({ queryKey: ['git-status', String(projectId)] });
  };

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', `/api/git/${projectId}/branch`, { name });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Branch created', description: data.message || data.branch || newBranchName });
      setShowCreateDialog(false);
      setNewBranchName('');
      invalidateBranches();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create branch', description: error.message, variant: 'destructive' });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (branch: string) => {
      const res = await apiRequest('POST', `/api/git/${projectId}/checkout`, { branch });
      return res.json();
    },
    onSuccess: (_data, branch) => {
      toast({ title: 'Switched branch', description: `Now on '${branch}'` });
      if (onBranchChange) onBranchChange(branch);
      invalidateBranches();
      if ('vibrate' in navigator) navigator.vibrate(10);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to switch branch', description: error.message, variant: 'destructive' });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchName: string) => {
      const res = await apiRequest('DELETE', `/api/git/${projectId}/branch/${encodeURIComponent(branchName)}?force=true`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Branch deleted', description: data.message || data.deleted });
      invalidateBranches();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete branch', description: error.message, variant: 'destructive' });
    },
  });

  const mergeBranchMutation = useMutation({
    mutationFn: async (branch: string) => {
      const res = await apiRequest('POST', `/api/git/${projectId}/merge`, { branch });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Branch merged', description: data.message || 'Merge completed successfully' });
      invalidateBranches();
    },
    onError: (error: Error) => {
      const msg = error.message || '';
      toast({
        title: 'Merge failed',
        description: msg.includes('conflict') ? 'Resolve conflicts manually' : msg,
        variant: 'destructive',
      });
    },
  });

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) {
      toast({ title: 'Invalid branch name', description: 'Please enter a valid name', variant: 'destructive' });
      return;
    }
    createBranchMutation.mutate(newBranchName.trim());
  };

  const handleDeleteBranch = (branchName: string) => {
    if (branches.find((b) => b.name === branchName)?.current) {
      toast({ title: 'Cannot delete current branch', description: 'Switch to another branch first', variant: 'destructive' });
      return;
    }
    deleteBranchMutation.mutate(branchName);
  };

  const isMutating =
    createBranchMutation.isPending ||
    checkoutMutation.isPending ||
    deleteBranchMutation.isPending ||
    mergeBranchMutation.isPending;

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Branches
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm" variant="ghost" className="h-7 px-2"
              onClick={() => refetch()} disabled={isLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
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
                    Branch from{' '}
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
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); }}
                      data-testid="input-branch-name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
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
              <Check className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ecode-orange)]" />
              <span className="text-[13px] font-medium">{currentBranch.name}</span>
              {currentBranch.remote && (
                <span className="text-[11px] text-muted-foreground ml-1">→ {currentBranch.remote}</span>
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
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>Retry</Button>
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
                    'group p-2 rounded-lg cursor-pointer transition-colors',
                    'hover:bg-muted/50',
                    branch.current && 'bg-muted',
                    isMutating && 'opacity-50 pointer-events-none'
                  )}
                  onClick={() => !branch.current && checkoutMutation.mutate(branch.name)}
                  data-testid={`branch-item-${branch.name}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {branch.current ? (
                        <Check className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ecode-orange)]" />
                      ) : (
                        <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn('text-[13px] truncate', branch.current && 'font-medium')}>
                        {branch.name}
                      </span>
                      {branch.remote && (
                        <span className="text-[10px] text-muted-foreground truncate">{branch.remote}</span>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          data-testid={`button-branch-menu-${branch.name}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!branch.current && (
                          <>
                            <DropdownMenuItem onClick={() => checkoutMutation.mutate(branch.name)} data-testid={`menu-checkout-${branch.name}`}>
                              <RotateCcw className="h-3.5 w-3.5 mr-2" />
                              Checkout
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm(`Merge '${branch.name}' into '${currentBranch?.name}'?`)) {
                                  mergeBranchMutation.mutate(branch.name);
                                }
                              }}
                              data-testid={`menu-merge-${branch.name}`}
                            >
                              <GitMerge className="h-3.5 w-3.5 mr-2" />
                              Merge into current
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            if (!branch.current && confirm(`Delete branch '${branch.name}'?`)) {
                              handleDeleteBranch(branch.name);
                            }
                          }}
                          disabled={branch.current}
                          className="text-red-600"
                          data-testid={`menu-delete-${branch.name}`}
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
