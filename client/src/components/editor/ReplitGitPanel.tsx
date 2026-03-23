import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GitBranch, GitCommit, Plus, Minus, FileEdit, FilePlus, FileMinus, FileX,
  ChevronDown, ChevronRight, Loader2, Check, X, RefreshCw, Clock,
  Upload, Download, ExternalLink, Trash2, RotateCcw,
} from "lucide-react";

interface ReplitGitPanelProps {
  projectId: string;
  projectName?: string;
  onImported?: (newProjectId?: string) => void;
  onCloned?: () => void;
}

interface GitChange {
  filename: string;
  status: "added" | "modified" | "deleted" | "untracked";
  additions?: number;
  deletions?: number;
}

interface GitDiffResponse {
  branch: string;
  changes: GitChange[];
  hasCommits: boolean;
}

interface GitCommitData {
  id: string;
  message: string;
  authorId: string;
  branchName: string;
  createdAt: string;
  parentCommitId?: string;
}

interface GitBranchData {
  id: string;
  name: string;
  current: boolean;
  isDefault: boolean;
  headCommitId: string | null;
}

type GitTab = "changes" | "branches" | "history" | "github";

export function ReplitGitPanel({ projectId, projectName }: ReplitGitPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<GitTab>("changes");
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  const [ghConnected, setGhConnected] = useState<boolean | null>(null);
  const [ghUser, setGhUser] = useState<any>(null);
  const [ghPushing, setGhPushing] = useState(false);
  const [ghPulling, setGhPulling] = useState(false);

  const diffQuery = useQuery<GitDiffResponse>({
    queryKey: ["git-diff", projectId],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/git/diff`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const branchesQuery = useQuery<GitBranchData[]>({
    queryKey: ["git-branches", projectId],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/git/branches`).then(r => r.json()),
    enabled: activeTab === "branches" || activeTab === "changes",
  });

  const commitsQuery = useQuery<GitCommitData[]>({
    queryKey: ["git-commits", projectId],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/git/commits`).then(r => r.json()),
    enabled: activeTab === "history",
  });

  const commitMutation = useMutation({
    mutationFn: async ({ message, files }: { message: string; files?: string[] }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/commits`, {
        message,
        files: files && files.length > 0 ? files : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCommitMessage("");
      setSelectedFiles(new Set());
      setSelectAll(true);
      queryClient.invalidateQueries({ queryKey: ["git-diff", projectId] });
      queryClient.invalidateQueries({ queryKey: ["git-commits", projectId] });
      queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
      toast({ title: "Committed", description: `${data.sha?.slice(0, 7) || "OK"} — ${data.message}` });
    },
    onError: (err: any) => {
      toast({ title: "Commit failed", description: err.message, variant: "destructive" });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/branches`, { name });
      return res.json();
    },
    onSuccess: (data) => {
      setShowNewBranch(false);
      setNewBranchName("");
      queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
      toast({ title: "Branch created", description: data.name });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (target: { branchName?: string; commitId?: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/checkout`, target);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-diff", projectId] });
      queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
      queryClient.invalidateQueries({ queryKey: ["git-commits", projectId] });
      toast({ title: "Switched branch" });
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/git/branches/${branchId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
      toast({ title: "Branch deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const loadGhStatus = useCallback(() => {
    fetch("/api/github/user", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setGhConnected(d.connected); if (d.user) setGhUser(d.user); })
      .catch(() => setGhConnected(false));
  }, []);

  useEffect(() => { loadGhStatus(); }, [loadGhStatus]);

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    const files = selectAll ? undefined : Array.from(selectedFiles);
    commitMutation.mutate({ message: commitMessage.trim(), files });
  };

  const handlePush = async () => {
    setGhPushing(true);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/push`);
      const data = await res.json();
      toast({ title: "Pushed to GitHub", description: data.message || "Success" });
    } catch (err: any) {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    } finally {
      setGhPushing(false);
    }
  };

  const handlePull = async () => {
    setGhPulling(true);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/pull`);
      const data = await res.json();
      if (data.conflicts && data.conflicts.length > 0) {
        toast({ title: "Merge conflicts detected", description: `${data.conflicts.length} file(s) have conflicts`, variant: "destructive" });
      } else {
        toast({ title: "Pulled from GitHub", description: data.message || `${data.filesUpdated || 0} files updated` });
      }
      queryClient.invalidateQueries({ queryKey: ["git-diff", projectId] });
      queryClient.invalidateQueries({ queryKey: ["git-commits", projectId] });
    } catch (err: any) {
      toast({ title: "Pull failed", description: err.message, variant: "destructive" });
    } finally {
      setGhPulling(false);
    }
  };

  const toggleFile = (filename: string) => {
    setSelectAll(false);
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedFiles(new Set());
    } else {
      setSelectAll(true);
      setSelectedFiles(new Set());
    }
  };

  const changes = diffQuery.data?.changes || [];
  const currentBranch = branchesQuery.data?.find(b => b.current)?.name || "main";
  const branches = branchesQuery.data || [];
  const commits = commitsQuery.data || [];

  const statusIcon = (status: string) => {
    switch (status) {
      case "added":
      case "untracked":
        return <FilePlus className="w-3.5 h-3.5 text-[#0CCE6B]" />;
      case "modified":
        return <FileEdit className="w-3.5 h-3.5 text-[#F5A623]" />;
      case "deleted":
        return <FileX className="w-3.5 h-3.5 text-[#E54D4D]" />;
      default:
        return <FileEdit className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "added": return "A";
      case "untracked": return "U";
      case "modified": return "M";
      case "deleted": return "D";
      default: return "?";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "added":
      case "untracked": return "#0CCE6B";
      case "modified": return "#F5A623";
      case "deleted": return "#E54D4D";
      default: return "#676D7E";
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="git-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Version Control</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--ide-text)] bg-[var(--ide-surface)] border border-[var(--ide-border)] hover:border-[#0079F2] transition-colors"
            onClick={() => setActiveTab("branches")}
            data-testid="button-current-branch"
          >
            <GitBranch className="w-3 h-3" />
            {currentBranch}
          </button>
          <Button
            variant="ghost" size="icon"
            className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["git-diff", projectId] });
              queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
              queryClient.invalidateQueries({ queryKey: ["git-commits", projectId] });
            }}
            data-testid="button-refresh-git"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        {([
          { id: "changes" as GitTab, label: "Changes", count: changes.length },
          { id: "branches" as GitTab, label: "Branches" },
          { id: "history" as GitTab, label: "History" },
          { id: "github" as GitTab, label: "GitHub" },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`flex-1 py-1.5 text-[10px] font-medium transition-colors relative ${activeTab === tab.id ? "text-[var(--ide-text)] border-b-2 border-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-git-${tab.id}`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1 py-0 rounded-full text-[8px] bg-[#0079F2] text-white font-bold">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "changes" && (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="w-full h-[56px] text-[11px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1.5 text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#0079F2] resize-none"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleCommit(); } }}
                data-testid="textarea-commit-message"
              />
              <Button
                size="sm"
                className="w-full h-7 mt-1.5 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white gap-1"
                disabled={!commitMessage.trim() || commitMutation.isPending}
                onClick={handleCommit}
                data-testid="button-commit"
              >
                {commitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {selectAll ? `Commit All (${changes.length})` : `Commit Selected (${selectedFiles.size})`}
              </Button>
            </div>

            <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--ide-border)]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Changed Files</span>
                {diffQuery.isLoading && <Loader2 className="w-3 h-3 text-[var(--ide-text-muted)] animate-spin" />}
              </div>
              <button
                className="text-[9px] text-[#0079F2] hover:underline"
                onClick={toggleSelectAll}
                data-testid="button-select-all"
              >
                {selectAll ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {changes.length === 0 && !diffQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Check className="w-6 h-6 text-[#0CCE6B] mb-2 opacity-60" />
                  <p className="text-[11px] text-[var(--ide-text-muted)]">Working tree clean</p>
                  <p className="text-[9px] text-[var(--ide-text-muted)] mt-0.5 opacity-60">No uncommitted changes</p>
                </div>
              ) : (
                changes.map((change) => {
                  const isSelected = selectAll || selectedFiles.has(change.filename);
                  return (
                    <div
                      key={change.filename}
                      className="flex items-center gap-1.5 px-3 py-1 hover:bg-[var(--ide-surface)]/40 group cursor-pointer"
                      onClick={() => toggleFile(change.filename)}
                      data-testid={`git-change-${change.filename}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-[#0079F2] border-[#0079F2]" : "border-[var(--ide-border)]"}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {statusIcon(change.status)}
                      <span className="text-[11px] text-[var(--ide-text)] font-mono truncate flex-1">{change.filename}</span>
                      <span
                        className="text-[9px] font-bold font-mono px-1 rounded"
                        style={{ color: statusColor(change.status), background: `${statusColor(change.status)}15` }}
                      >
                        {statusLabel(change.status)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "branches" && (
          <div>
            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              {!showNewBranch ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px] gap-1 border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                  onClick={() => setShowNewBranch(true)}
                  data-testid="button-new-branch"
                >
                  <Plus className="w-3 h-3" /> New Branch
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value.replace(/\s+/g, "-"))}
                    placeholder="feature/my-branch"
                    className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[11px] font-mono text-[var(--ide-text)]"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter" && newBranchName.trim()) createBranchMutation.mutate(newBranchName.trim()); if (e.key === "Escape") setShowNewBranch(false); }}
                    data-testid="input-new-branch-name"
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1 h-6 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white"
                      disabled={!newBranchName.trim() || createBranchMutation.isPending}
                      onClick={() => createBranchMutation.mutate(newBranchName.trim())}
                      data-testid="button-create-branch"
                    >
                      {createBranchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 text-[10px] text-[var(--ide-text-muted)]"
                      onClick={() => { setShowNewBranch(false); setNewBranchName(""); }}
                    >Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {branchesQuery.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" /></div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-[var(--ide-text-muted)]">No branches found</div>
            ) : (
              branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ide-surface)]/40 group ${branch.current ? "bg-[#0079F2]/5" : ""}`}
                  data-testid={`branch-${branch.name}`}
                >
                  <GitBranch className={`w-3.5 h-3.5 shrink-0 ${branch.current ? "text-[#0079F2]" : "text-[var(--ide-text-muted)]"}`} />
                  <span className={`text-[11px] font-mono flex-1 truncate ${branch.current ? "text-[#0079F2] font-semibold" : "text-[var(--ide-text)]"}`}>
                    {branch.name}
                  </span>
                  {branch.current && (
                    <span className="text-[8px] text-[#0079F2] bg-[#0079F2]/10 px-1.5 rounded font-semibold">CURRENT</span>
                  )}
                  {branch.isDefault && (
                    <span className="text-[8px] text-[var(--ide-text-muted)] bg-[var(--ide-surface)] px-1.5 rounded">default</span>
                  )}
                  {!branch.current && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon"
                        className="w-5 h-5 text-[#0079F2] hover:bg-[#0079F2]/10"
                        onClick={() => checkoutMutation.mutate({ branchName: branch.name })}
                        disabled={checkoutMutation.isPending}
                        title="Switch to this branch"
                        data-testid={`button-checkout-${branch.name}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                      {!branch.isDefault && (
                        <Button
                          variant="ghost" size="icon"
                          className="w-5 h-5 text-[#E54D4D] hover:bg-[#E54D4D]/10"
                          onClick={() => { if (confirm(`Delete branch "${branch.name}"?`)) deleteBranchMutation.mutate(branch.id); }}
                          disabled={deleteBranchMutation.isPending}
                          title="Delete branch"
                          data-testid={`button-delete-branch-${branch.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
            {commitsQuery.isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" /></div>
            ) : commits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="w-6 h-6 text-[var(--ide-text-muted)] mb-2 opacity-40" />
                <p className="text-[11px] text-[var(--ide-text-muted)]">No commits yet</p>
                <p className="text-[9px] text-[var(--ide-text-muted)] mt-0.5 opacity-60">Make your first commit to start tracking history</p>
              </div>
            ) : (
              commits.map((commit, i) => (
                <div key={commit.id} className="border-b border-[var(--ide-border)]/50" data-testid={`commit-${commit.id?.slice(0, 7)}`}>
                  <div
                    className="flex items-start gap-2 px-3 py-2 hover:bg-[var(--ide-surface)]/30 cursor-pointer"
                    onClick={() => setExpandedCommit(expandedCommit === commit.id ? null : commit.id)}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#0079F2]" : "bg-[var(--ide-text-muted)]"}`} />
                      {i < commits.length - 1 && <div className="w-px h-full bg-[var(--ide-border)] mx-auto mt-0.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[var(--ide-text)] leading-tight">{commit.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-[#0079F2] font-mono">{commit.id?.slice(0, 7)}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)]">
                          {new Date(commit.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          {" "}
                          {new Date(commit.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    {expandedCommit === commit.id ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0 mt-1" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0 mt-1" />}
                  </div>
                  {expandedCommit === commit.id && (
                    <div className="px-3 pb-2 ml-5">
                      <div className="bg-[var(--ide-bg)] rounded p-2 border border-[var(--ide-border)]">
                        <div className="text-[9px] text-[var(--ide-text-muted)] space-y-0.5">
                          <div>SHA: <span className="font-mono text-[var(--ide-text-secondary)]">{commit.id}</span></div>
                          <div>Branch: <span className="text-[var(--ide-text-secondary)]">{commit.branchName}</span></div>
                          <div>Author: <span className="text-[var(--ide-text-secondary)]">{commit.authorId}</span></div>
                          {commit.parentCommitId && <div>Parent: <span className="font-mono text-[var(--ide-text-secondary)]">{commit.parentCommitId.slice(0, 7)}</span></div>}
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="h-5 px-2 text-[9px] text-[#F5A623] hover:text-[#F5A623] hover:bg-[#F5A623]/10 mt-1.5"
                          onClick={() => {
                            if (confirm(`Checkout commit ${commit.id?.slice(0, 7)}? This will change your working files.`)) {
                              checkoutMutation.mutate({ commitId: commit.id });
                            }
                          }}
                          data-testid={`button-checkout-commit-${commit.id?.slice(0, 7)}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Restore
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "github" && (
          <div>
            {ghConnected === null ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" /></div>
            ) : !ghConnected ? (
              <div className="p-4 text-center">
                <GitBranch className="w-8 h-8 text-[var(--ide-text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-[11px] text-[var(--ide-text-secondary)] mb-1">GitHub not connected</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mb-3">Connect your GitHub account to push and pull</p>
                <Button
                  size="sm"
                  className="bg-[#24292e] hover:bg-[#2f363d] text-white gap-2 text-[11px]"
                  onClick={() => { window.location.href = "/api/auth/github/redirect"; }}
                  data-testid="button-connect-github"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  Connect GitHub
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {ghUser && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ide-border)]">
                    <img src={ghUser.avatar_url} className="w-5 h-5 rounded-full" alt="" />
                    <span className="text-[11px] text-[var(--ide-text-secondary)] truncate">{ghUser.login}</span>
                    <a href={`https://github.com/${ghUser.login}`} target="_blank" rel="noopener noreferrer" className="ml-auto">
                      <ExternalLink className="w-3 h-3 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" />
                    </a>
                  </div>
                )}

                <div className="px-3 py-3 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white gap-1"
                      onClick={handlePush}
                      disabled={ghPushing}
                      data-testid="button-git-push"
                    >
                      {ghPushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Push
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-[10px] border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] gap-1"
                      onClick={handlePull}
                      disabled={ghPulling}
                      data-testid="button-git-pull"
                    >
                      {ghPulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      Pull
                    </Button>
                  </div>

                  <p className="text-[9px] text-[var(--ide-text-muted)]">
                    Push commits to your connected GitHub repository, or pull the latest changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
