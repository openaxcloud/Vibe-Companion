import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GitBranch, GitCommit, GitMerge, Plus, Minus, FileEdit, FilePlus, FileMinus, FileX,
  ChevronDown, ChevronRight, Loader2, Check, X, RefreshCw, Clock,
  Upload, Download, ExternalLink, Trash2, RotateCcw, Settings, Link, AlertTriangle,
  Archive, ArchiveRestore, History, Eye, MoreVertical, Zap,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReplitGitPanelProps {
  projectId: string;
  projectName?: string;
  onImported?: (newProjectId?: string) => void;
  onCloned?: () => void;
  mode?: "desktop" | "tablet" | "mobile";
  className?: string;
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
  mergeInProgress?: boolean;
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

interface GitBackup {
  id: string;
  version: number;
  sizeBytes: number;
  trigger: string;
  createdAt: string;
}

type GitTab = "changes" | "branches" | "history" | "settings";

export function ReplitGitPanel({ projectId, projectName, mode = "desktop", className }: ReplitGitPanelProps) {
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
  const [fetching, setFetching] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [showBackups, setShowBackups] = useState(false);

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

  const backupsQuery = useQuery<GitBackup[]>({
    queryKey: ["git-backups", projectId],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/backups`).then(r => r.json()),
    enabled: activeTab === "settings" && showBackups,
  });

  const fileHistoryQuery = useQuery<GitCommitData[]>({
    queryKey: ["git-file-history", projectId, fileHistoryPath],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/file-history/${encodeURIComponent(fileHistoryPath!)}`).then(r => r.json()),
    enabled: !!fileHistoryPath,
  });

  const githubStatusQuery = useQuery<{ connected: boolean; username?: string }>({
    queryKey: ["git-github-status", projectId],
    queryFn: () => apiRequest("GET", `/api/git/${projectId}/github/status`).then(r => r.json()).catch(() => ({ connected: false })),
    enabled: activeTab === "settings",
    retry: false,
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["git-status", projectId] });
    queryClient.invalidateQueries({ queryKey: ["git-branches", projectId] });
    queryClient.invalidateQueries({ queryKey: ["git-commits", projectId] });
    queryClient.invalidateQueries({ queryKey: ["git-remotes", projectId] });
  }, [queryClient, projectId]);

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

  const stageMutation = useMutation({
    mutationFn: async (files: string[]) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/stage`, { paths: files });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Files staged" });
    },
    onError: (err: any) => {
      toast({ title: "Stage failed", description: err.message, variant: "destructive" });
    },
  });

  const unstageMutation = useMutation({
    mutationFn: async (files: string[]) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/unstage`, { files });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Files unstaged" });
    },
    onError: (err: any) => {
      toast({ title: "Unstage failed", description: err.message, variant: "destructive" });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (files?: string[]) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/discard`, { files: files || [] });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Changes discarded" });
    },
    onError: (err: any) => {
      toast({ title: "Discard failed", description: err.message, variant: "destructive" });
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

  const deleteBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("DELETE", `/api/git/${projectId}/branch/${encodeURIComponent(name)}?force=true`);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: "Branch deleted", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const mergeBranchMutation = useMutation({
    mutationFn: async (branch: string) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/merge`, { branch });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: "Merge successful", description: data.message });
    },
    onError: (err: any) => {
      const msg = err.message || "";
      if (msg.includes("conflict") || msg.includes("409")) {
        toast({ title: "Merge conflict", description: "Conflicts detected. Resolve them manually.", variant: "destructive" });
      } else {
        toast({ title: "Merge failed", description: msg, variant: "destructive" });
      }
    },
  });

  const abortMergeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/git/${projectId}/abort-merge`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Merge aborted" });
    },
    onError: (err: any) => {
      toast({ title: "Abort failed", description: err.message, variant: "destructive" });
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

  const backupNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/git/${projectId}/backup`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-backups", projectId] });
      toast({ title: "Backup created" });
    },
    onError: (err: any) => {
      toast({ title: "Backup failed", description: err.message, variant: "destructive" });
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (id?: string) => {
      const res = await apiRequest("POST", `/api/git/${projectId}/backup/restore`, { id });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: "Restored", description: `Restored to ${data.restoredTo || "backup"}` });
    },
    onError: (err: any) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
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

  const handleFetch = async () => {
    setFetching(true);
    try {
      const res = await apiRequest("POST", `/api/git/${projectId}/fetch`);
      const data = await res.json();
      toast({ title: "Fetched", description: data.output || data.message || "Remote refs updated" });
      invalidateAll();
    } catch (err: any) {
      toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
    } finally {
      setFetching(false);
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
      case "staged": return "Staged";
      case "deleted": return "Deleted";
      default: return "?";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "added":
      case "untracked": return "#0CCE6B";
      case "modified": return "#F5A623";
      case "staged": return "#0079F2";
      case "deleted": return "#E54D4D";
      default: return "#676D7E";
    }
  };

  if (fileHistoryPath) {
    return (
      <div className="flex flex-col h-full" data-testid="git-file-history-panel">
        <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
          <button
            className="text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] flex items-center gap-1"
            onClick={() => setFileHistoryPath(null)}
            data-testid="button-back-from-file-history"
          >
            <ChevronRight className="w-3 h-3 rotate-180" />
            Back
          </button>
          <span className="text-[10px] text-[var(--ide-text)] font-mono truncate flex-1">{fileHistoryPath}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {fileHistoryQuery.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
          ) : (fileHistoryQuery.data || []).length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-[var(--ide-text-muted)]">No history for this file</div>
          ) : (
            (fileHistoryQuery.data || []).map((commit, i) => (
              <div key={commit.hash || i} className="flex items-start gap-2 px-3 py-2 border-b border-[var(--ide-border)]/50 hover:bg-[var(--ide-surface)]/30" data-testid={`file-history-commit-${commit.shortHash}`}>
                <div className="mt-1.5 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#0079F2]" : "bg-[var(--ide-text-muted)]/40"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[var(--ide-text)] leading-tight font-medium">{commit.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-[#F5A623]">{commit.author}</span>
                    <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{commit.shortHash}</span>
                    <span className="text-[9px] text-[var(--ide-text-muted)]">
                      {commit.date ? new Date(commit.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const isCompact = mode === "mobile" || mode === "tablet";

  return (
    <div
      className={`flex flex-col h-full${isCompact ? " text-[10px]" : ""}${className ? ` ${className}` : ""}`}
      data-testid="git-panel"
      data-mode={mode}
    >
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
            title="Refresh"
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
                No remote repositories configured. To push your changes, add a remote in the{" "}
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] gap-1 px-2"
              onClick={handleFetch}
              disabled={fetching}
              title="Fetch"
              data-testid="button-git-fetch"
            >
              {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
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
                    <button
                      className="text-[9px] text-[var(--ide-text-muted)] hover:text-[#E54D4D]"
                      onClick={() => {
                        if (confirm("Discard all changes? This cannot be undone.")) {
                          discardMutation.mutate(undefined);
                        }
                      }}
                      disabled={discardMutation.isPending}
                      data-testid="button-discard-all"
                    >
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
                    const isStaged = change.status === "staged";
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
                          {!isStaged ? (
                            <button
                              className="w-4 h-4 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#0079F2]"
                              title="Stage file"
                              data-testid={`button-stage-${change.path}`}
                              onClick={(e) => { e.stopPropagation(); stageMutation.mutate([change.path]); }}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              className="w-4 h-4 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#F5A623]"
                              title="Unstage file"
                              data-testid={`button-unstage-${change.path}`}
                              onClick={(e) => { e.stopPropagation(); unstageMutation.mutate([change.path]); }}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            className="w-4 h-4 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#E54D4D]"
                            title="Discard changes"
                            data-testid={`button-discard-${change.path}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Discard changes to ${change.path}?`)) {
                                discardMutation.mutate([change.path]);
                              }
                            }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            className="w-4 h-4 flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                            title="View file history"
                            data-testid={`button-file-history-${change.path}`}
                            onClick={(e) => { e.stopPropagation(); setFileHistoryPath(change.path); }}
                          >
                            <History className="w-3 h-3" />
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
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!branch.current && (
                      <>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                              data-testid={`button-branch-menu-${branch.name}`}
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[140px]">
                            <DropdownMenuItem
                              onClick={() => checkoutMutation.mutate({ branch: branch.name })}
                              data-testid={`menu-checkout-${branch.name}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-2" />
                              Checkout
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm(`Merge '${branch.name}' into '${currentBranch}'?`)) {
                                  mergeBranchMutation.mutate(branch.name);
                                }
                              }}
                              data-testid={`menu-merge-${branch.name}`}
                            >
                              <GitMerge className="w-3.5 h-3.5 mr-2" />
                              Merge into {currentBranch}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[#E54D4D]"
                              onClick={() => {
                                if (confirm(`Delete branch '${branch.name}'? This cannot be undone.`)) {
                                  deleteBranchMutation.mutate(branch.name);
                                }
                              }}
                              data-testid={`menu-delete-branch-${branch.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Delete Branch
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {statusQuery.data?.mergeInProgress && (
              <div className="px-3 py-2 border-t border-[var(--ide-border)] mt-1">
                <div className="p-2 rounded bg-[#F5A623]/10 border border-[#F5A623]/30 mb-1.5 text-[9px] text-[#F5A623]">
                  A merge is in progress. Resolve conflicts or abort.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px] gap-1 border-[#F5A623]/50 text-[#F5A623] hover:bg-[#F5A623]/10"
                  onClick={() => abortMergeMutation.mutate()}
                  disabled={abortMergeMutation.isPending}
                  data-testid="button-abort-merge"
                >
                  {abortMergeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Abort Merge
                </Button>
              </div>
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

            {hasRemotes && (
              <div className="px-3 py-2 border-b border-[var(--ide-border)]">
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] border-[var(--ide-border)] text-[var(--ide-text-muted)] gap-1 px-2"
                    onClick={handleFetch}
                    disabled={fetching}
                    title="Fetch"
                    data-testid="button-settings-fetch"
                  >
                    {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="px-3 py-2 border-b border-[var(--ide-border)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">Disaster Recovery</span>
                {backupNowMutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />}
              </div>
              <div className="flex gap-1.5 mb-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[10px] gap-1 border-[var(--ide-border)] text-[var(--ide-text-secondary)]"
                  onClick={() => backupNowMutation.mutate()}
                  disabled={backupNowMutation.isPending}
                  data-testid="button-backup-now"
                >
                  <Archive className="w-3 h-3" />
                  Backup Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-[10px] gap-1 border-[var(--ide-border)] text-[var(--ide-text-secondary)]"
                  onClick={() => {
                    setShowBackups(true);
                    queryClient.invalidateQueries({ queryKey: ["git-backups", projectId] });
                  }}
                  data-testid="button-list-backups"
                >
                  <ArchiveRestore className="w-3 h-3" />
                  Restore Backup
                </Button>
              </div>

              {showBackups && (
                <div className="space-y-1">
                  {backupsQuery.isLoading ? (
                    <div className="flex justify-center py-2"><Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" /></div>
                  ) : (backupsQuery.data || []).length === 0 ? (
                    <p className="text-[9px] text-[var(--ide-text-muted)] text-center py-1">No backups found. Click "Backup Now" to create one.</p>
                  ) : (
                    (backupsQuery.data || []).map((backup) => (
                      <div key={backup.id} className="flex items-center gap-2 p-1.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`backup-${backup.id}`}>
                        <Archive className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-mono text-[var(--ide-text)] truncate">{backup.id}</div>
                          <div className="text-[8px] text-[var(--ide-text-muted)]">{new Date(backup.createdAt).toLocaleString()}</div>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          className="h-5 px-1.5 text-[8px] text-[#F5A623]"
                          onClick={() => {
                            if (confirm(`Restore to backup ${backup.id}?`)) {
                              restoreBackupMutation.mutate(backup.id);
                            }
                          }}
                          disabled={restoreBackupMutation.isPending}
                          data-testid={`button-restore-backup-${backup.id}`}
                        >
                          Restore
                        </Button>
                      </div>
                    ))
                  )}
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

            <div className="px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">GitHub</span>
              <div className="mt-1.5">
                {githubStatusQuery.data?.connected ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#0CCE6B]/10 border border-[#0CCE6B]/30">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-[#0CCE6B]" />
                      <span className="text-[10px] text-[var(--ide-text)]">
                        Connected as <strong>{githubStatusQuery.data.username}</strong>
                      </span>
                    </div>
                    <button
                      className="text-[9px] text-[#E54D4D] hover:underline"
                      onClick={async () => {
                        try {
                          await apiRequest("POST", `/api/git/${projectId}/github/disconnect`);
                          queryClient.invalidateQueries({ queryKey: ["git-github-status", projectId] });
                          toast({ title: "GitHub disconnected" });
                        } catch (e: any) {
                          toast({ title: "Failed to disconnect", description: e.message, variant: "destructive" });
                        }
                      }}
                      data-testid="button-disconnect-github"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-[10px] gap-1 border-[var(--ide-border)] text-[var(--ide-text-secondary)]"
                    onClick={async () => {
                      try {
                        const res = await apiRequest("GET", `/api/git/${projectId}/github/connect`);
                        const data = await res.json();
                        if (data.authUrl) window.open(data.authUrl, "_blank");
                        else toast({ title: "GitHub connect not available", description: data.error, variant: "destructive" });
                      } catch (e: any) {
                        toast({ title: "Failed to connect GitHub", description: e.message, variant: "destructive" });
                      }
                    }}
                    data-testid="button-connect-github"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Connect GitHub Account
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
