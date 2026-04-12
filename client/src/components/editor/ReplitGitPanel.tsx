import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GitBranch, GitCommit, Plus, Minus, FileEdit, FilePlus, FileMinus, FileX,
  ChevronDown, ChevronRight, Loader2, Check, X, RefreshCw, Clock,
  Upload, Download, ExternalLink, Trash2, RotateCcw, Settings, Link, AlertTriangle,
} from "lucide-react";

interface ReplitGitPanelProps {
  projectId: string;
  projectName?: string;
  onImported?: (newProjectId?: string) => void;
  onCloned?: () => void;
}

interface GitChange {
  path: string;
  status: "staged" | "modified" | "untracked" | "deleted" | "added";
}

interface GitStatusResponse {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  changes: GitChange[];
}

interface GitCommitData {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface GitBranchData {
  name: string;
  current: boolean;
  remote: string | null;
}

interface GitRemote {
  name: string;
  url: string;
  type: string;
}

type GitTab = "changes" | "branches" | "history" | "settings";

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
  const [showAddRemote, setShowAddRemote] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState("origin");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const statusQuery = useQuery<GitStatusResponse>({
    queryKey: ["git-status", projectId],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/status`).then(r => r.json()),
    refetchInterval: 10000,
    retry: 1,
  });

  const branchesQuery = useQuery<GitBranchData[]>({
    queryKey: ["git-branches", projectId],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/branches`).then(r => r.json()),
    enabled: activeTab === "branches" || activeTab === "changes",
  });

  const commitsQuery = useQuery<GitCommitData[]>({
    queryKey: ["git-commits", projectId],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/commits`).then(r => r.json()),
    enabled: activeTab === "history",
  });

  const remotesQuery = useQuery<{ remotes: GitRemote[] }>({
    queryKey: ["git-remotes", projectId],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/remotes`).then(r => r.json()),
    enabled: activeTab === "settings" || activeTab === "changes",
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["git-status", projectId] });
    queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
    queryClient.invalidateQueries({ queryKey: ["git-commits", projectId] });
    queryClient.invalidateQueries({ queryKey: ["git-remotes", projectId] });
  };

  const commitMutation = useMutation({
    mutationFn: async ({ message, files }: { message: string; files?: string[] }) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/commit`, { message, files });
      return res.json();
    },
    onSuccess: (data) => {
      setCommitMessage("");
      setSelectedFiles(new Set());
      setSelectAll(true);
      invalidateAll();
      toast({ title: "Committed", description: `${data.hash?.slice(0, 7) || "OK"} — ${data.message || commitMessage}` });
    },
    onError: (err: any) => {
      toast({ title: "Commit failed", description: err.message, variant: "destructive" });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/branch`, { name });
      return res.json();
    },
    onSuccess: (data) => {
      setShowNewBranch(false);
      setNewBranchName("");
      invalidateAll();
      toast({ title: "Branch created", description: data.message || data.name || newBranchName });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (target: { branch?: string; branchName?: string; commitId?: string }) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/checkout`, target);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Switched branch" });
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const addRemoteMutation = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/remotes`, { name, url });
      return res.json();
    },
    onSuccess: (data) => {
      setShowAddRemote(false);
      setNewRemoteName("origin");
      setNewRemoteUrl("");
      queryClient.invalidateQueries({ queryKey: ["git-remotes", projectId] });
      toast({ title: "Remote added", description: data.message || `Remote '${newRemoteName}' configured` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add remote", description: err.message, variant: "destructive" });
    },
  });

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    const files = selectAll ? undefined : Array.from(selectedFiles);
    commitMutation.mutate({ message: commitMessage.trim(), files });
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const res = await apiRequest("POST", `/api/git/${projectId}/push`);
      const data = await res.json();
      toast({ title: "Pushed successfully", description: data.output || data.message || "Changes pushed to remote" });
      invalidateAll();
    } catch (err: any) {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const res = await apiRequest("POST", `/api/git/${projectId}/pull`);
      const data = await res.json();
      toast({ title: "Pulled successfully", description: data.output || data.message || "Up to date" });
      invalidateAll();
    } catch (err: any) {
      toast({ title: "Pull failed", description: err.message, variant: "destructive" });
    } finally {
      setPulling(false);
    }
  };

  const toggleFile = (path: string) => {
    setSelectAll(false);
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
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

  const changes = statusQuery.data?.changes || [];
  const currentBranch = statusQuery.data?.branch || branchesQuery.data?.find(b => b.current)?.name || "main";
  const branches = branchesQuery.data || [];
  const commits = commitsQuery.data || [];
  const remotes = remotesQuery.data?.remotes || [];
  const hasRemotes = remotes.length > 0;
  const uniqueRemotes = remotes.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

  const statusIcon = (status: string) => {
    switch (status) {
      case "added":
      case "untracked":
        return <FilePlus className="w-3.5 h-3.5 text-[#0CCE6B]" />;
      case "modified":
      case "staged":
        return <FileEdit className="w-3.5 h-3.5 text-[#F5A623]" />;
      case "deleted":
        return <FileX className="w-3.5 h-3.5 text-[#E54D4D]" />;
      default:
        return <FileEdit className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "added": return "Added";
      case "untracked": return "Added";
      case "modified": return "Modified";
      case "staged": return "Modified";
      case "deleted": return "Deleted";
      default: return "?";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "added":
      case "untracked": return "#0CCE6B";
      case "modified":
      case "staged": return "#F5A623";
      case "deleted": return "#E54D4D";
      default: return "#676D7E";
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="git-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Git</span>
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
            onClick={() => setActiveTab("settings")}
            title="Settings"
            data-testid="button-git-settings"
          >
            <Settings className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            onClick={invalidateAll}
            data-testid="button-refresh-git"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {!hasRemotes && activeTab !== "settings" && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/30" data-testid="no-remote-banner">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F5A623] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-[#F5A623] leading-tight">
                No remote repositories configured. To push your changes, add a remote repository in the{" "}
                <button className="underline font-semibold" onClick={() => setActiveTab("settings")} data-testid="link-settings-view">Settings view</button>.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasRemotes && activeTab === "changes" && (
        <div className="mx-3 mt-2">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white gap-1"
              onClick={handlePush}
              disabled={pushing}
              data-testid="button-git-push"
            >
              {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Push to {uniqueRemotes[0]?.name || "remote"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-[10px] border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] gap-1"
              onClick={handlePull}
              disabled={pulling}
              data-testid="button-git-pull"
            >
              {pulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Pull
            </Button>
          </div>
        </div>
      )}

      {!hasRemotes && activeTab === "changes" && (
        <div className="mx-3 mt-1.5">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[10px] gap-1 border-[var(--ide-border)] text-[var(--ide-text-muted)]"
            disabled
            data-testid="button-no-remotes"
          >
            <Upload className="w-3 h-3" />
            No remotes to push to
          </Button>
        </div>
      )}

      <div className="flex border-b border-[var(--ide-border)] shrink-0 mt-2">
        {([
          { id: "changes" as GitTab, label: "Changes", count: changes.length },
          { id: "branches" as GitTab, label: "Branches" },
          { id: "history" as GitTab, label: "History" },
          { id: "settings" as GitTab, label: "Settings" },
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
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Commit</span>
              </div>
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
                className="w-full h-7 mt-1.5 text-[10px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/90 text-white gap-1"
                disabled={!commitMessage.trim() || commitMutation.isPending}
                onClick={handleCommit}
                data-testid="button-commit"
              >
                {commitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {selectAll ? "Stage and commit all changes" : `Commit Selected (${selectedFiles.size})`}
              </Button>
              <p className="text-[9px] text-[var(--ide-text-muted)] mt-1 text-center">Committing will automatically stage your changes.</p>
            </div>

            {changes.length === 0 && !statusQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Check className="w-6 h-6 text-[#0CCE6B] mb-2 opacity-60" />
                <p className="text-[11px] text-[var(--ide-text-muted)]">There are no changes to commit.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--ide-border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--ide-text-muted)]">
                      Review Changes
                    </span>
                    {statusQuery.isLoading && <Loader2 className="w-3 h-3 text-[var(--ide-text-muted)] animate-spin" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" data-testid="button-discard-all">
                      Discard All
                    </button>
                    <button
                      className="text-[9px] text-[#0079F2] hover:underline"
                      onClick={toggleSelectAll}
                      data-testid="button-select-all"
                    >
                      {selectAll ? "- Stage All" : "+ Stage All"}
                    </button>
                  </div>
                </div>

                <div className="px-3 py-1 text-[10px] text-[var(--ide-text-muted)]">
                  {changes.length} changed file{changes.length !== 1 ? "s" : ""}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {changes.map((change) => {
                    const isSelected = selectAll || selectedFiles.has(change.path);
                    return (
                      <div
                        key={change.path}
                        className="flex items-center gap-1.5 px-3 py-1 hover:bg-[var(--ide-surface)]/40 group cursor-pointer"
                        onClick={() => toggleFile(change.path)}
                        data-testid={`git-change-${change.path}`}
                      >
                        {statusIcon(change.status)}
                        <span className="text-[11px] text-[var(--ide-text)] font-mono truncate flex-1">{change.path}</span>
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ color: statusColor(change.status), background: `${statusColor(change.status)}15` }}
                        >
                          {statusLabel(change.status)}
                        </span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-4 h-4 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#0079F2]" title="Stage" data-testid={`button-stage-${change.path}`}>
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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
                  key={branch.name}
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
                  {!branch.current && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon"
                        className="w-5 h-5 text-[#0079F2] hover:bg-[#0079F2]/10"
                        onClick={() => checkoutMutation.mutate({ branch: branch.name })}
                        disabled={checkoutMutation.isPending}
                        title="Switch to this branch"
                        data-testid={`button-checkout-${branch.name}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
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
                <div key={commit.hash || i} className="border-b border-[var(--ide-border)]/50" data-testid={`commit-${commit.shortHash}`}>
                  <div
                    className="flex items-start gap-2 px-3 py-2 hover:bg-[var(--ide-surface)]/30 cursor-pointer"
                    onClick={() => setExpandedCommit(expandedCommit === commit.hash ? null : commit.hash)}
                  >
                    <div className="mt-1.5 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#0079F2]" : "bg-[var(--ide-text-muted)]/40"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[var(--ide-text)] leading-tight font-medium">{commit.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-[#F5A623]">{commit.author}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)]">
                          {commit.date ? new Date(commit.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                        </span>
                      </div>
                    </div>
                    {expandedCommit === commit.hash ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0 mt-1" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0 mt-1" />}
                  </div>
                  {expandedCommit === commit.hash && (
                    <div className="px-3 pb-2 ml-5">
                      <div className="bg-[var(--ide-bg)] rounded p-2 border border-[var(--ide-border)]">
                        <div className="text-[9px] text-[var(--ide-text-muted)] space-y-0.5">
                          <div>SHA: <span className="font-mono text-[var(--ide-text-secondary)]">{commit.hash}</span></div>
                          <div>Author: <span className="text-[var(--ide-text-secondary)]">{commit.author} &lt;{commit.email}&gt;</span></div>
                          <div>Date: <span className="text-[var(--ide-text-secondary)]">{commit.date ? new Date(commit.date).toLocaleString() : ""}</span></div>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="h-5 px-2 text-[9px] text-[#F5A623] hover:text-[#F5A623] hover:bg-[#F5A623]/10 mt-1.5"
                          onClick={() => {
                            if (confirm(`Checkout commit ${commit.shortHash}? This will change your working files.`)) {
                              checkoutMutation.mutate({ commitId: commit.hash });
                            }
                          }}
                          data-testid={`button-checkout-commit-${commit.shortHash}`}
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

        {activeTab === "settings" && (
          <div className="flex flex-col gap-0">
            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">Remote Repositories</span>
                {remotesQuery.isLoading && <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />}
              </div>

              {uniqueRemotes.length > 0 ? (
                <div className="space-y-1.5 mb-2">
                  {uniqueRemotes.map((remote) => (
                    <div key={remote.name} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`remote-${remote.name}`}>
                      <Link className="w-3.5 h-3.5 text-[#0079F2] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[var(--ide-text)] font-semibold">{remote.name}</div>
                        <div className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate">{remote.url}</div>
                      </div>
                      {remote.url.includes("github.com") && (
                        <a href={remote.url.replace(/\.git$/, "")} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <ExternalLink className="w-3 h-3 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] mb-2 text-center">
                  <Link className="w-5 h-5 text-[var(--ide-text-muted)] mx-auto mb-1.5 opacity-40" />
                  <p className="text-[10px] text-[var(--ide-text-muted)]">No remote repositories configured</p>
                  <p className="text-[9px] text-[var(--ide-text-muted)] opacity-60 mt-0.5">Add a remote to push and pull your code</p>
                </div>
              )}

              {!showAddRemote ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px] gap-1 border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                  onClick={() => setShowAddRemote(true)}
                  data-testid="button-add-remote"
                >
                  <Plus className="w-3 h-3" /> Add Remote
                </Button>
              ) : (
                <div className="space-y-1.5 p-2 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                  <div>
                    <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">Name</label>
                    <Input
                      value={newRemoteName}
                      onChange={(e) => setNewRemoteName(e.target.value.replace(/\s+/g, ""))}
                      placeholder="origin"
                      className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[11px] font-mono text-[var(--ide-text)]"
                      data-testid="input-remote-name"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[var(--ide-text-muted)] block mb-0.5">URL</label>
                    <Input
                      value={newRemoteUrl}
                      onChange={(e) => setNewRemoteUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[11px] font-mono text-[var(--ide-text)]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newRemoteUrl.trim()) addRemoteMutation.mutate({ name: newRemoteName || "origin", url: newRemoteUrl.trim() });
                        if (e.key === "Escape") setShowAddRemote(false);
                      }}
                      data-testid="input-remote-url"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1 h-6 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white"
                      disabled={!newRemoteUrl.trim() || addRemoteMutation.isPending}
                      onClick={() => addRemoteMutation.mutate({ name: newRemoteName || "origin", url: newRemoteUrl.trim() })}
                      data-testid="button-save-remote"
                    >
                      {addRemoteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Remote"}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 text-[10px] text-[var(--ide-text-muted)]"
                      onClick={() => { setShowAddRemote(false); setNewRemoteUrl(""); }}
                    >Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">Git Info</span>
              <div className="mt-1.5 space-y-1 text-[10px] text-[var(--ide-text-muted)]">
                <div className="flex justify-between">
                  <span>Current Branch:</span>
                  <span className="text-[var(--ide-text)] font-mono">{currentBranch}</span>
                </div>
                {statusQuery.data && (
                  <>
                    <div className="flex justify-between">
                      <span>Ahead:</span>
                      <span className="text-[var(--ide-text)] font-mono">{statusQuery.data.ahead || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Behind:</span>
                      <span className="text-[var(--ide-text)] font-mono">{statusQuery.data.behind || 0}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span>Uncommitted:</span>
                  <span className="text-[var(--ide-text)] font-mono">{changes.length}</span>
                </div>
              </div>
            </div>

            {hasRemotes && (
              <div className="px-3 py-2">
                <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">Sync</span>
                <div className="flex gap-1.5 mt-1.5">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white gap-1"
                    onClick={handlePush}
                    disabled={pushing}
                    data-testid="button-settings-push"
                  >
                    {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Push
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[10px] border-[var(--ide-border)] text-[var(--ide-text-secondary)] gap-1"
                    onClick={handlePull}
                    disabled={pulling}
                    data-testid="button-settings-pull"
                  >
                    {pulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    Pull
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
