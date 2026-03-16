import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, ChevronLeft, Send, Sparkles, CheckCircle2, Circle,
  ArrowRight, X, FileCode, Clock, GitMerge,
} from "lucide-react";

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  plan: string[] | null;
  status: string;
  progress: number;
  result: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  steps?: TaskStep[];
  diff?: FileDiff[];
}

interface TaskStep {
  id: string;
  title: string;
  status: string;
  output: string | null;
}

interface TaskMessage {
  id: string;
  taskId: string;
  role: string;
  content: string;
  createdAt: string;
}

interface FileDiff {
  filename: string;
  added: number;
  removed: number;
  modified: boolean;
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path fill="#009118" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
      <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
    </svg>
  );
}

export default function TaskReviewDrawer({
  task,
  projectId,
  onClose,
  onApply,
  onDismiss,
}: {
  task: Task;
  projectId: string;
  onClose: () => void;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [messageInput, setMessageInput] = useState("");

  const taskDetailQuery = useQuery<Task>({
    queryKey: ["/api/projects", projectId, "tasks", task.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load task");
      return res.json();
    },
  });

  const messagesQuery = useQuery<TaskMessage[]>({
    queryKey: ["/api/projects", projectId, "tasks", task.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks/${task.id}/messages`, { content });
      return res.json();
    },
  });

  const taskDetail = taskDetailQuery.data || task;
  const messages = messagesQuery.data || [];
  const steps = taskDetail.steps || [];
  const diffs = taskDetail.diff || [];

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput.trim());
    setMessageInput("");
  };

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }} data-testid="task-review-drawer">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <button
          className="flex items-center gap-1.5 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
          onClick={onClose}
          data-testid="button-back-tasks"
        >
          <ChevronLeft className="w-3 h-3" />
          <span>Back to tasks</span>
        </button>
        <X className="w-3.5 h-3.5 text-[var(--ide-text-muted)] cursor-pointer hover:text-[var(--ide-text)]" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {task.status === "ready" && (
            <div className="mb-4 p-3 bg-[var(--ide-surface)] rounded-lg border border-[var(--ide-border)]" data-testid="task-ready-banner">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center">
                  <SparkleIcon />
                </div>
                <span className="text-[14px] text-[var(--ide-text)]">Ready for review</span>
              </div>

              <div className="mb-2">
                <span className="text-[13px] text-[var(--ide-text-muted)]">
                  Task #{task.priority + 1}: {task.title}
                </span>
              </div>

              {task.description && (
                <p className="text-[12px] text-[var(--ide-text-muted)] mb-3 line-clamp-3">
                  {task.description}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  className="h-8 px-4 rounded-lg bg-[var(--ide-bg)] text-[var(--ide-text)] text-[14px] hover:bg-[var(--ide-hover)] transition-colors shrink-0"
                  onClick={() => onDismiss(task.id)}
                  data-testid="button-dismiss-task"
                >
                  Dismiss
                </button>
                <button
                  className="flex-1 h-8 rounded-lg bg-[hsla(140,50%,33%,1)] text-white text-[14px] flex items-center justify-center gap-2 hover:bg-[hsla(140,50%,28%,1)] transition-colors"
                  onClick={() => onApply(task.id)}
                  data-testid="button-apply-task"
                >
                  <GitMerge className="w-4 h-4" />
                  Apply changes to main version
                </button>
              </div>
            </div>
          )}

          <div className="mb-3">
            <h3 className="text-[14px] font-semibold text-[var(--ide-text)]" data-testid="text-task-detail-title">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-[12px] text-[var(--ide-text-muted)] mt-1">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                task.status === "active" ? "bg-[#0079F2]/10 text-[#0079F2]" :
                task.status === "ready" ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" :
                task.status === "done" ? "bg-[#6B7280]/10 text-[#6B7280]" :
                "bg-[#8E8F97]/10 text-[#8E8F97]"
              }`} data-testid="text-task-status">
                {task.status}
              </span>
              {task.progress > 0 && task.progress < 100 && (
                <span className="text-[10px] text-[var(--ide-text-muted)]">{task.progress}%</span>
              )}
            </div>
          </div>

          {steps.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-1.5">Steps</h4>
              <div className="space-y-1">
                {steps.map((step, i) => (
                  <div key={step.id || i} className="flex items-center gap-2 py-1 px-2 rounded bg-[var(--ide-surface)]" data-testid={`step-${step.id || i}`}>
                    {step.status === "completed" ? (
                      <CheckCircle2 className="w-3 h-3 text-[#0CCE6B] shrink-0" />
                    ) : step.status === "running" ? (
                      <Loader2 className="w-3 h-3 text-[#0079F2] animate-spin shrink-0" />
                    ) : (
                      <Circle className="w-3 h-3 text-[#8E8F97] shrink-0" />
                    )}
                    <span className="text-[11px] text-[var(--ide-text)]">{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diffs.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-1.5">Changes</h4>
              <div className="space-y-1">
                {diffs.map((diff, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-[var(--ide-surface)]">
                    <FileCode className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                    <span className="text-[11px] text-[var(--ide-text)] flex-1 truncate">{diff.filename}</span>
                    {diff.added > 0 && <span className="text-[9px] text-[#0CCE6B]">+{diff.added}</span>}
                    {diff.removed > 0 && <span className="text-[9px] text-[#E54D4D]">-{diff.removed}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="mb-3">
              <h4 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-1.5">Activity</h4>
              <div className="space-y-1.5">
                {messages.map((msg) => (
                  <div key={msg.id} className={`px-2.5 py-1.5 rounded-lg text-[11px] ${
                    msg.role === "system"
                      ? "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] italic"
                      : msg.role === "user"
                      ? "bg-[#0079F2]/10 text-[var(--ide-text)]"
                      : "bg-[var(--ide-surface)] text-[var(--ide-text)]"
                  }`} data-testid={`task-message-${msg.id}`}>
                    {msg.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-[var(--ide-border)] shrink-0">
        <div className="flex gap-1.5">
          <Input
            placeholder="Message agent..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
            className="h-7 text-xs bg-[var(--ide-bg)] flex-1"
            data-testid="input-task-message"
          />
          <Button
            size="icon"
            className="w-7 h-7"
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || sendMessageMutation.isPending}
            data-testid="button-send-task-message"
          >
            {sendMessageMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
