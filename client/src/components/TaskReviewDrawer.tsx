import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, ChevronLeft, CheckCircle2, Circle,
  X, FileCode, Plus, ArrowUp, AlertTriangle, GitMerge,
} from "lucide-react";

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  plan: string[] | null;
  status: string;
  priority: number;
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

interface MergeConflict {
  filename: string;
  type: string;
  mainContent?: string;
  taskContent?: string;
  originalContent?: string;
  mergedWithMarkers?: string;
}

function ConflictResolutionPanel({
  conflicts,
  projectId,
  taskId,
  onResolved,
}: {
  conflicts: MergeConflict[];
  projectId: string;
  taskId: string;
  onResolved: () => void;
}) {
  const [resolutions, setResolutions] = useState<Record<string, "accept_main" | "accept_task">>({});
  const [resolving, setResolving] = useState(false);

  const allResolved = conflicts.every(c => resolutions[c.filename]);

  const handleResolveAll = async () => {
    setResolving(true);
    try {
      const body = {
        resolutions: conflicts.map(c => ({
          filename: c.filename,
          resolution: resolutions[c.filename] || "accept_main",
        })),
      };
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/resolve-all-conflicts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onResolved();
      }
    } catch {}
    setResolving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[14px] text-amber-500">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">{conflicts.length} file{conflicts.length !== 1 ? "s" : ""} with conflicts</span>
      </div>
      {conflicts.map((conflict) => (
        <div key={conflict.filename} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <GitMerge className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[13px] font-mono text-[var(--trd-text)]">{conflict.filename}</span>
          </div>
          <p className="text-[12px] text-[var(--trd-text-dim)] mb-2">
            Both the main version and this task modified this file.
          </p>
          <div className="flex gap-2">
            <button
              className={`flex-1 h-7 rounded-lg text-[12px] font-medium transition-colors border ${
                resolutions[conflict.filename] === "accept_main"
                  ? "bg-[#0079F2]/15 border-[#0079F2]/30 text-[#0079F2]"
                  : "bg-[var(--trd-surface)] border-[var(--trd-border)] text-[var(--trd-text-dim)] hover:bg-[var(--trd-border)]"
              }`}
              onClick={() => setResolutions(r => ({ ...r, [conflict.filename]: "accept_main" }))}
            >
              Keep main
            </button>
            <button
              className={`flex-1 h-7 rounded-lg text-[12px] font-medium transition-colors border ${
                resolutions[conflict.filename] === "accept_task"
                  ? "bg-[#009118]/15 border-[#009118]/30 text-[#009118]"
                  : "bg-[var(--trd-surface)] border-[var(--trd-border)] text-[var(--trd-text-dim)] hover:bg-[var(--trd-border)]"
              }`}
              onClick={() => setResolutions(r => ({ ...r, [conflict.filename]: "accept_task" }))}
            >
              Accept task
            </button>
          </div>
        </div>
      ))}
      <button
        className="w-full h-8 rounded-lg text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        style={{ backgroundColor: allResolved ? "var(--trd-positive-bg)" : "var(--trd-text-dimmest)" }}
        disabled={!allResolved || resolving}
        onClick={handleResolveAll}
      >
        {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply resolved files"}
      </button>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path fill="#009118" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
      <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
    </svg>
  );
}

function ApplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M6 3.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM2.25 6a3.75 3.75 0 1 1 4.527 3.67 8.25 8.25 0 0 0 7.554 7.553A3.751 3.751 0 0 1 21.75 18a3.75 3.75 0 0 1-7.43.726 9.75 9.75 0 0 1-7.57-4.53V21a.75.75 0 0 1-1.5 0V9.675A3.751 3.751 0 0 1 2.25 6ZM18 15.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" clipRule="evenodd" />
    </svg>
  );
}

function ActiveSparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="5.332" cy="5.338" r="5.332" fill="#A8D4FF" className="animate-pulse" />
      <circle cx="18.663" cy="5.338" r="5.332" fill="#57ABFF" className="animate-pulse" style={{ animationDelay: "0.15s" }} />
      <circle cx="5.332" cy="18.668" r="5.332" fill="#57ABFF" className="animate-pulse" style={{ animationDelay: "0.3s" }} />
      <circle cx="18.663" cy="18.668" r="5.332" fill="#A8D4FF" className="animate-pulse" style={{ animationDelay: "0.45s" }} />
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
  const [applyLoading, setApplyLoading] = useState(false);
  const [dismissLoading, setDismissLoading] = useState(false);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);

  const handleApply = async () => {
    setApplyLoading(true);
    setConflicts([]);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks/${task.id}/apply`);
      const data = await res.json();
      if (data.success) {
        onApply(task.id);
      } else if (data.conflicts && data.conflicts.length > 0) {
        setConflicts(data.conflicts);
        setApplyLoading(false);
      } else {
        setApplyLoading(false);
      }
    } catch {
      setApplyLoading(false);
    }
  };

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
    <div className="trd-wrap flex flex-col h-full" data-testid="task-review-drawer">
      <style>{`
        .trd-wrap {
          --trd-bg: var(--ide-bg, #F6F6F4);
          --trd-surface: var(--ide-surface, #F1F1EE);
          --trd-border: var(--ide-border, #DEDAD5);
          --trd-border-strong: var(--ide-border, #CAC4BE);
          --trd-text: var(--ide-text, #1D1D1D);
          --trd-text-dim: var(--ide-text-muted, #5C5C5C);
          --trd-text-dimmest: var(--ide-text-muted, #858585);
          --trd-positive-bg: hsla(140, 50%, 33%, 1);
          --trd-positive-hover: hsla(140, 50%, 28%, 1);
          font-family: 'IBM Plex Sans', -apple-system, sans-serif;
        }
        @keyframes trd-fade {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .trd-animate { animation: trd-fade 300ms ease-out forwards; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--trd-border)] shrink-0">
        <button
          className="flex items-center gap-1.5 text-[13px] text-[var(--trd-text-dim)] hover:text-[var(--trd-text)] transition-colors"
          onClick={onClose}
          data-testid="button-back-tasks"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to tasks</span>
        </button>
        <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--trd-surface)] transition-colors" onClick={onClose}>
          <X className="w-4 h-4 text-[var(--trd-text-dim)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Ready for review banner (Replit-style) */}
          {task.status === "ready" && (
            <div className="trd-animate rounded-lg border border-[var(--trd-border-strong)] bg-[var(--trd-bg)] p-3 shadow-sm" data-testid="task-ready-banner">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[var(--trd-surface)] border border-[var(--trd-border)] flex items-center justify-center">
                  <SparkleIcon />
                </div>
                <span className="text-[14px] text-[var(--trd-text)]">Ready for review</span>
              </div>

              <div className="mb-1">
                <span className="text-[13px] text-[var(--trd-text-dim)]">
                  Task #{task.priority + 1}: {task.title}
                </span>
              </div>

              {task.description && (
                <p className="text-[12px] text-[var(--trd-text-dimmest)] line-clamp-3 mb-3 leading-relaxed">
                  {task.description}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  className="h-8 px-5 rounded-lg bg-[var(--trd-surface)] text-[var(--trd-text)] text-[14px] hover:bg-[var(--trd-border)] transition-colors shrink-0 disabled:opacity-50"
                  onClick={() => { setDismissLoading(true); onDismiss(task.id); }}
                  disabled={dismissLoading || applyLoading}
                  data-testid="button-dismiss-task"
                >
                  {dismissLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Dismiss"}
                </button>
                <button
                  className="flex-1 h-8 rounded-lg text-white text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "var(--trd-positive-bg)" }}
                  onMouseEnter={(e) => !applyLoading && (e.currentTarget.style.backgroundColor = "var(--trd-positive-hover)")}
                  onMouseLeave={(e) => !applyLoading && (e.currentTarget.style.backgroundColor = "var(--trd-positive-bg)")}
                  onClick={handleApply}
                  disabled={applyLoading || dismissLoading}
                  data-testid="button-apply-task"
                >
                  {applyLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Apply changes to main version</span>
                      <ApplyIcon />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Active task banner */}
          {(task.status === "active" || task.status === "applying") && (
            <div className="trd-animate rounded-lg border border-[#0079F2]/20 bg-[#0079F2]/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <ActiveSparkleIcon />
                <span className="text-[14px] text-[var(--trd-text)]">
                  {task.status === "applying" ? "Applying changes..." : "Working on task..."}
                </span>
              </div>
              {task.progress > 0 && (
                <div className="h-1.5 bg-[var(--trd-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0079F2] rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Task info */}
          <div>
            <h3 className="text-[15px] font-medium text-[var(--trd-text)]" data-testid="text-task-detail-title">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-[13px] text-[var(--trd-text-dim)] mt-1 leading-relaxed">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                task.status === "active" ? "bg-[#0079F2]/10 text-[#0079F2]" :
                task.status === "ready" ? "bg-[#009118]/10 text-[#009118]" :
                task.status === "done" ? "bg-[#6B7280]/10 text-[#6B7280]" :
                task.status === "applying" ? "bg-[#7C3AED]/10 text-[#7C3AED]" :
                "bg-[#8E8F97]/10 text-[#8E8F97]"
              }`} data-testid="text-task-status">
                {task.status === "active" ? "Active" :
                 task.status === "ready" ? "Ready" :
                 task.status === "done" ? "Done" :
                 task.status === "applying" ? "Applying" :
                 task.status === "queued" ? "Queued" : "Draft"}
              </span>
              {task.progress > 0 && task.progress < 100 && (
                <span className="text-[11px] text-[var(--trd-text-dimmest)]">{task.progress}%</span>
              )}
            </div>
          </div>

          {/* Steps */}
          {steps.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-[var(--trd-text-dim)] uppercase tracking-wider mb-2">Steps</h4>
              <div className="space-y-1">
                {steps.map((step, i) => (
                  <div key={step.id || i} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-[var(--trd-surface)]" data-testid={`step-${step.id || i}`}>
                    {step.status === "completed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#009118] shrink-0" />
                    ) : step.status === "running" ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#0079F2] animate-spin shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-[#8E8F97] shrink-0" />
                    )}
                    <span className="text-[13px] text-[var(--trd-text)]">{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File changes */}
          {diffs.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-[var(--trd-text-dim)] uppercase tracking-wider mb-2">Changes</h4>
              <div className="space-y-1">
                {diffs.map((diff, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-[var(--trd-surface)]">
                    <FileCode className="w-3.5 h-3.5 text-[var(--trd-text-dimmest)] shrink-0" />
                    <span className="text-[13px] text-[var(--trd-text)] flex-1 truncate font-mono">{diff.filename}</span>
                    {diff.added > 0 && <span className="text-[11px] text-[#009118] font-mono">+{diff.added}</span>}
                    {diff.removed > 0 && <span className="text-[11px] text-[#E54D4D] font-mono">-{diff.removed}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflict Resolution */}
          {conflicts.length > 0 && (
            <ConflictResolutionPanel
              conflicts={conflicts}
              projectId={projectId}
              taskId={task.id}
              onResolved={() => { setConflicts([]); onApply(task.id); }}
            />
          )}

          {/* Error message */}
          {task.errorMessage && conflicts.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{task.errorMessage}</span>
            </div>
          )}

          {/* Activity / Messages */}
          {messages.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-[var(--trd-text-dim)] uppercase tracking-wider mb-2">Activity</h4>
              <div className="space-y-1.5">
                {messages.map((msg) => (
                  <div key={msg.id} className={`px-3 py-2 rounded-lg text-[13px] leading-relaxed ${
                    msg.role === "system"
                      ? "bg-[var(--trd-bg)] text-[var(--trd-text-dimmest)] italic border border-[var(--trd-border)]"
                      : msg.role === "user"
                      ? "bg-[#0079F2]/8 text-[var(--trd-text)] border border-[#0079F2]/15"
                      : "bg-[var(--trd-surface)] text-[var(--trd-text)] border border-[var(--trd-border)]"
                  }`} data-testid={`task-message-${msg.id}`}>
                    {msg.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message agent input (Replit-style) */}
      <div className="border-t border-[var(--trd-border)] bg-[var(--trd-bg)] shrink-0">
        <div className="p-2">
          <div className="rounded-lg border border-[var(--trd-border-strong)] bg-[var(--trd-bg)] overflow-hidden">
            <div className="px-3 py-2">
              <input
                type="text"
                placeholder="Message agent..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                className="w-full bg-transparent text-[14px] text-[var(--trd-text)] placeholder:text-[var(--trd-text-dimmest)] outline-none"
                data-testid="input-task-message"
              />
            </div>
            <div className="flex items-center justify-between px-2 pb-2">
              <button className="w-6 h-6 flex items-center justify-center rounded text-[var(--trd-text-dimmest)] hover:text-[var(--trd-text-dim)] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white transition-colors"
                  style={{ backgroundColor: messageInput.trim() ? "hsla(210, 100%, 74%, 1)" : "hsla(210, 100%, 74%, 0.4)" }}
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-task-message"
                >
                  {sendMessageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
