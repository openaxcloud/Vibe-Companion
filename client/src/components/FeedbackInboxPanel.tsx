import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox, Loader2, Trash2, CheckCircle2, Circle, ExternalLink,
  Sparkles, Filter, Mail, User, Paperclip, Clock,
} from "lucide-react";

interface FeedbackEntry {
  id: string;
  projectId: string;
  deploymentId: string | null;
  visitorName: string | null;
  visitorEmail: string | null;
  content: string;
  attachments: string[];
  pageUrl: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface FeedbackInboxPanelProps {
  projectId: string;
  onClose?: () => void;
  onSendToAI?: (text: string) => void;
}

export default function FeedbackInboxPanel({ projectId, onClose, onSendToAI }: FeedbackInboxPanelProps) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feedback = [], isLoading } = useQuery<FeedbackEntry[]>({
    queryKey: ["/api/projects", projectId, "feedback", filter],
    queryFn: async () => {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await apiRequest("GET", `/api/projects/${projectId}/feedback${params}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/feedback/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "feedback"] });
      toast({ title: "Feedback updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/feedback/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "feedback"] });
      toast({ title: "Feedback deleted" });
    },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const openCount = feedback.filter(f => f.status === "open").length;
  const resolvedCount = feedback.filter(f => f.status === "resolved").length;

  return (
    <div className="flex flex-col h-full bg-[var(--ide-bg)]" data-testid="feedback-inbox-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-[var(--ide-accent)]" />
          <span className="text-sm font-medium text-[var(--ide-text)]">Feedback Inbox</span>
          {openCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#0079F2] text-white" data-testid="feedback-unread-count">
              {openCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--ide-border)]">
        <Filter className="w-3.5 h-3.5 text-[var(--ide-text-muted)] mr-1" />
        {(["all", "open", "resolved"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              filter === f
                ? "bg-[var(--ide-accent)] text-white"
                : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-sidebar-hover)]"
            }`}
            data-testid={`filter-${f}`}
          >
            {f === "all" ? `All (${feedback.length})` : f === "open" ? `Open (${openCount})` : `Resolved (${resolvedCount})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        ) : feedback.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--ide-text-muted)]">
            <Inbox className="w-8 h-8 opacity-50" />
            <span className="text-sm">No feedback yet</span>
            <span className="text-xs">Feedback from visitors will appear here</span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ide-border)]">
            {feedback.map(entry => (
              <div
                key={entry.id}
                className="p-3 hover:bg-[var(--ide-sidebar-hover)] transition-colors"
                data-testid={`feedback-entry-${entry.id}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {entry.status === "open" ? (
                      <Circle className="w-3.5 h-3.5 text-[#0079F2]" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0CCE6B]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--ide-text)] whitespace-pre-wrap break-words leading-relaxed">
                      {entry.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-[var(--ide-text-muted)]">
                      {entry.visitorName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.visitorName}
                        </span>
                      )}
                      {entry.visitorEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {entry.visitorEmail}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(entry.createdAt)}
                      </span>
                      {entry.pageUrl && (
                        <span className="flex items-center gap-1 truncate max-w-[120px]" title={entry.pageUrl}>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {(() => { try { return new URL(entry.pageUrl).pathname; } catch { return entry.pageUrl; } })()}
                        </span>
                      )}
                    </div>

                    {entry.attachments && entry.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entry.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[var(--ide-sidebar-hover)] rounded text-[var(--ide-accent)] hover:underline"
                            data-testid={`attachment-${entry.id}-${i}`}
                          >
                            <Paperclip className="w-3 h-3" />
                            {att.split("/").pop()}
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-2">
                      {onSendToAI && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[#7C65CB]"
                          onClick={() => onSendToAI(`Visitor feedback: "${entry.content}"${entry.visitorName ? ` from ${entry.visitorName}` : ""}${entry.pageUrl ? ` on page ${entry.pageUrl}` : ""}`)}
                          data-testid={`send-to-ai-${entry.id}`}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Send to AI
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[#0CCE6B]"
                        onClick={() => resolveMutation.mutate({
                          id: entry.id,
                          status: entry.status === "open" ? "resolved" : "open",
                        })}
                        disabled={resolveMutation.isPending}
                        data-testid={`toggle-resolve-${entry.id}`}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {entry.status === "open" ? "Resolve" : "Reopen"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-[var(--ide-text-muted)] hover:text-[#E54D4D]"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`delete-feedback-${entry.id}`}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
