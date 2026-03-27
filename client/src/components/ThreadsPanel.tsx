import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Loader2, Plus, X, Check, Send, ChevronDown, ChevronRight,
  FileCode, Hash, CheckCircle2, Circle,
} from "lucide-react";

interface CodeThread {
  id: string;
  projectId: string;
  userId: string;
  filename: string;
  lineNumber: number | null;
  title: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  authorName?: string;
  commentCount?: number;
}

interface ThreadComment {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName?: string;
}

export default function ThreadsPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createMode, setCreateMode] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFilename, setNewFilename] = useState("");
  const [newLine, setNewLine] = useState("");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const threadsQuery = useQuery<CodeThread[]>({
    queryKey: ["/api/projects", projectId, "threads"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/threads`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load threads");
      return res.json();
    },
  });

  const commentsQuery = useQuery<ThreadComment[]>({
    queryKey: ["/api/projects", projectId, "threads", selectedThread, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/threads/${selectedThread}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    enabled: !!selectedThread,
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { title: string; filename: string; lineNumber?: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/threads`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "threads"] });
      setCreateMode(false);
      setNewTitle("");
      setNewFilename("");
      setNewLine("");
      toast({ title: "Thread created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create thread", description: err.message, variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      await apiRequest("POST", `/api/projects/${projectId}/threads/${threadId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "threads", selectedThread, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "threads"] });
      setCommentInput("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to add comment", description: err.message, variant: "destructive" });
    },
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      await apiRequest("PATCH", `/api/projects/${projectId}/threads/${threadId}`, { status: "resolved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "threads"] });
      toast({ title: "Thread resolved" });
    },
  });

  const reopenThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      await apiRequest("PATCH", `/api/projects/${projectId}/threads/${threadId}`, { status: "open" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "threads"] });
    },
  });

  const threads = threadsQuery.data || [];
  const filteredThreads = threads.filter(t => filter === "all" || t.status === filter);
  const comments = commentsQuery.data || [];
  const activeThread = threads.find(t => t.id === selectedThread);

  if (selectedThread && activeThread) {
    return (
      <div className="flex flex-col h-full" data-testid="thread-detail">
        <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
          <button className="flex items-center gap-1.5 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setSelectedThread(null)} data-testid="button-back-threads">
            <ChevronRight className="w-3 h-3 rotate-180" />
            <span>Back</span>
          </button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-thread-detail">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h3 className="text-[12px] font-semibold text-[var(--ide-text)]">{activeThread.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-[9px] text-[var(--ide-text-muted)]">
                  <FileCode className="w-3 h-3" />
                  {activeThread.filename}
                  {activeThread.lineNumber && <span>:{activeThread.lineNumber}</span>}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeThread.status === "open" ? "bg-green-500/10 text-green-400" : "bg-[var(--ide-border)] text-[var(--ide-text-muted)]"}`}>
                  {activeThread.status}
                </span>
              </div>
            </div>
            {activeThread.status === "open" ? (
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => resolveThreadMutation.mutate(activeThread.id)} data-testid="button-resolve-thread">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => reopenThreadMutation.mutate(activeThread.id)} data-testid="button-reopen-thread">
                <Circle className="w-3 h-3 mr-1" /> Reopen
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {commentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>
          ) : comments.length === 0 ? (
            <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-4">No comments yet</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid={`comment-${c.id}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-[var(--ide-text)]">{c.authorName || "User"}</span>
                  <span className="text-[9px] text-[var(--ide-text-muted)]">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-[var(--ide-text-secondary)] whitespace-pre-wrap">{c.content}</p>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t border-[var(--ide-border)] shrink-0">
          <div className="flex gap-1.5">
            <Input
              placeholder="Write a comment..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && commentInput.trim()) addCommentMutation.mutate({ threadId: selectedThread, content: commentInput.trim() }); }}
              className="h-7 text-xs bg-[var(--ide-bg)] flex-1"
              data-testid="input-comment"
            />
            <Button size="icon" className="w-7 h-7" onClick={() => { if (commentInput.trim()) addCommentMutation.mutate({ threadId: selectedThread, content: commentInput.trim() }); }} disabled={!commentInput.trim() || addCommentMutation.isPending} data-testid="button-send-comment">
              {addCommentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="threads-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Threads</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setCreateMode(true)} data-testid="button-new-thread">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-threads">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--ide-border)]">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button key={f} className={`text-[10px] px-2 py-1 rounded ${filter === f ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`} onClick={() => setFilter(f)} data-testid={`filter-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {createMode && (
          <div className="p-3 border-b border-[var(--ide-border)] bg-[var(--ide-surface)] space-y-2">
            <Input placeholder="Thread title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-thread-title" />
            <Input placeholder="Filename (e.g. src/App.tsx)" value={newFilename} onChange={(e) => setNewFilename(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-thread-filename" />
            <Input placeholder="Line number (optional)" type="number" value={newLine} onChange={(e) => setNewLine(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-thread-line" />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => createThreadMutation.mutate({ title: newTitle, filename: newFilename, lineNumber: newLine ? parseInt(newLine) : undefined })} disabled={!newTitle.trim() || !newFilename.trim() || createThreadMutation.isPending} data-testid="button-create-thread">
                {createThreadMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create Thread"}
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setCreateMode(false)} data-testid="button-cancel-thread">Cancel</Button>
            </div>
          </div>
        )}

        {threadsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-50" />
            <p className="text-[11px] text-[var(--ide-text-muted)]">No threads yet</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Create a thread to discuss code with your team</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-1.5">
            {filteredThreads.map((thread) => (
              <button key={thread.id} className="w-full text-left px-2.5 py-2 rounded hover:bg-[var(--ide-surface)] transition-colors group" onClick={() => setSelectedThread(thread.id)} data-testid={`thread-${thread.id}`}>
                <div className="flex items-start gap-2">
                  {thread.status === "open" ? (
                    <Circle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-[var(--ide-text-muted)] mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-[var(--ide-text)] block truncate">{thread.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-0.5 truncate">
                        <FileCode className="w-2.5 h-2.5" />
                        {thread.filename}
                        {thread.lineNumber && <span>:{thread.lineNumber}</span>}
                      </span>
                      {thread.commentCount !== undefined && thread.commentCount > 0 && (
                        <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-0.5">
                          <MessageSquare className="w-2.5 h-2.5" /> {thread.commentCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--ide-text-muted)] mt-0.5 block">{new Date(thread.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
