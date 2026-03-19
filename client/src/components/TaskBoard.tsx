import { useState, useEffect, useCallback, useRef, useMemo, TouchEvent as ReactTouchEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Loader2, MoreVertical, CheckCircle2, Circle, Play,
  X, ChevronRight, Clock, Zap, ArrowRight, LayoutGrid, List,
  Plus, Send,
} from "lucide-react";
import TaskReviewDrawer from "./TaskReviewDrawer";

interface Task {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  plan: string[] | null;
  status: string;
  dependsOn: string[] | null;
  priority: number;
  progress: number;
  result: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_COLUMNS = [
  { key: "draft", label: "Drafts", color: "#8E8F97" },
  { key: "active", label: "Active", color: "#0079F2" },
  { key: "ready", label: "Ready", color: "#009118" },
  { key: "done", label: "Done", color: "#6B7280" },
] as const;

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  queued: "Queued",
  ready: "Ready",
  applying: "Applying",
  done: "Done",
};

/* ── Replit-style 4-quad animated icon ── */
function ReplitSparkleIcon({ status }: { status: string }) {
  const colorMap: Record<string, { dark: string; light: string }> = {
    active: { dark: "#57ABFF", light: "#A8D4FF" },
    queued: { dark: "#6BB5FF", light: "#6BB5FF" },
    draft: { dark: "#A6A6A6", light: "#D4D4D4" },
    ready: { dark: "#009118", light: "#6CD97E" },
    applying: { dark: "#7C3AED", light: "#C4B5FD" },
    done: { dark: "#6B7280", light: "#9CA3AF" },
  };
  const colors = colorMap[status] || colorMap.draft;

  if (status === "done") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--tb-text-dimmest)" className="shrink-0">
        <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
        <path fillRule="evenodd" d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1Zm0 2a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" clipRule="evenodd" />
      </svg>
    );
  }

  if (status === "ready") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="5.332" cy="5.338" r="5.332" fill={colors.light} />
        <circle cx="18.663" cy="18.668" r="5.332" fill={colors.light} />
        <path fill={colors.dark} d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
      </svg>
    );
  }

  if (status === "draft") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="5.332" cy="5.338" r="5.332" fill={colors.dark} />
        <circle cx="18.663" cy="5.338" r="5.332" fill={colors.dark} />
        <circle cx="5.332" cy="18.668" r="5.332" fill={colors.dark} />
        <circle cx="18.663" cy="18.668" r="5.332" fill={colors.dark} />
      </svg>
    );
  }

  if (status === "applying") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 animate-spin" style={{ animationDuration: "2s" }}>
        <circle cx="5.332" cy="5.338" r="5.332" fill={colors.light} />
        <circle cx="18.663" cy="5.338" r="5.332" fill={colors.dark} />
        <circle cx="5.332" cy="18.668" r="5.332" fill={colors.light} />
        <circle cx="18.663" cy="18.668" r="5.332" fill={colors.light} />
        <path fill={colors.dark} d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
      </svg>
    );
  }

  // Active / queued — animated pulsing
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="5.332" cy="5.338" r="5.332" fill={colors.light} className="animate-pulse" />
      <circle cx="18.663" cy="5.338" r="5.332" fill={colors.dark} className="animate-pulse" style={{ animationDelay: "0.15s" }} />
      <circle cx="5.332" cy="18.668" r="5.332" fill={colors.dark} className="animate-pulse" style={{ animationDelay: "0.3s" }} />
      <circle cx="18.663" cy="18.668" r="5.332" fill={colors.light} className="animate-pulse" style={{ animationDelay: "0.45s" }} />
      <path className="animate-pulse" style={{ animationDelay: "0.6s" }} fill={colors.dark} d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
    </svg>
  );
}

/* ── Replit sparkle icon for ready banner ── */
function ReadySparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path fill="#009118" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
      <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
    </svg>
  );
}

/* ── Task Card (Replit style) ── */
function TaskCard({
  task,
  onAccept,
  onApply,
  onDismiss,
  onDelete,
  onSelect,
}: {
  task: Task;
  onAccept: (id: string) => void;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (task: Task) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const timestamp = task.completedAt || task.startedAt || task.createdAt;

  return (
    <div
      className="tb-card group"
      onClick={() => onSelect(task)}
      data-testid={`card-task-${task.id}`}
      style={{ animationDelay: "0ms" }}
    >
      <div className="flex items-center gap-2">
        <ReplitSparkleIcon status={task.status} />
        <span className="flex-1 text-[14px] leading-[1.4] text-[var(--tb-text)] truncate" data-testid={`text-task-title-${task.id}`}>
          {task.title}
        </span>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            className="tb-menu-btn w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            data-testid={`button-task-menu-${task.id}`}
          >
            <MoreVertical className="w-4 h-4 text-[var(--tb-text-dimmest)]" />
          </button>
          {menuOpen && (
            <div className="absolute top-0 left-7 z-50 min-w-[160px] rounded-lg border border-[var(--tb-border)] bg-[var(--tb-card-bg)] shadow-lg py-1" onClick={(e) => e.stopPropagation()}>
              {task.status === "draft" && (
                <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[14px] text-[var(--tb-text)] hover:bg-[var(--tb-border)]/50 transition-colors" onClick={() => { setMenuOpen(false); onAccept(task.id); }}>
                  <Play className="w-4 h-4" /> Start task
                </button>
              )}
              {task.status === "ready" && (
                <>
                  <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[14px] text-[var(--tb-text)] hover:bg-[var(--tb-border)]/50 transition-colors" onClick={() => { setMenuOpen(false); onApply(task.id); }}>
                    <ArrowRight className="w-4 h-4" /> Apply changes
                  </button>
                  <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[14px] text-[var(--tb-text)] hover:bg-[var(--tb-border)]/50 transition-colors" onClick={() => { setMenuOpen(false); onDismiss(task.id); }}>
                    <X className="w-4 h-4" /> Dismiss
                  </button>
                </>
              )}
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[14px] text-red-400 hover:bg-[var(--tb-border)]/50 transition-colors" onClick={() => { setMenuOpen(false); onDelete(task.id); }}>
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <div className="text-[12px] text-[var(--tb-text-dim)] leading-[1.5] line-clamp-3 mt-1">
          {task.description}
        </div>
      )}

      {task.status === "active" && task.progress > 0 && task.progress < 100 && (
        <div className="mt-1.5">
          <div className="h-1 bg-[var(--tb-border)] rounded-full overflow-hidden">
            <div className="h-full bg-[#0079F2] rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}

      <div className="text-[12px] text-[var(--tb-text-dimmest)] mt-0.5">
        {STATUS_LABELS[task.status] || task.status} {timestamp ? `\u2022 ${formatTimeAgo(timestamp)}` : ""}
      </div>
    </div>
  );
}

/* ── Thread View ── */
function ThreadView({
  tasks,
  onAccept,
  onApply,
  onSelect,
}: {
  tasks: Task[];
  onAccept: (id: string) => void;
  onApply: (id: string) => void;
  onSelect: (task: Task) => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = { draft: [], active: [], ready: [], done: [] };
    for (const t of tasks) {
      const key = (t.status === "queued" || t.status === "applying") ? "active" : t.status;
      if (groups[key]) groups[key].push(t);
      else groups.draft.push(t);
    }
    return STATUS_COLUMNS.map(col => ({ ...col, tasks: groups[col.key] || [] })).filter(g => g.tasks.length > 0);
  }, [tasks]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4" data-testid="task-thread-view">
      {grouped.map((group) => (
        <div key={group.key}>
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[14px] font-medium text-[var(--tb-text)]">{group.label}</span>
            <span className="text-[12px] text-[var(--tb-text-dim)] bg-[var(--tb-col-bg)] px-1.5 rounded leading-5">
              {group.tasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {group.tasks.map((task) => {
              const timestamp = task.completedAt || task.startedAt || task.createdAt;
              return (
                <div
                  key={task.id}
                  className="tb-card group"
                  onClick={() => onSelect(task)}
                  data-testid={`thread-task-${task.id}`}
                >
                  <div className="flex items-center gap-2">
                    <ReplitSparkleIcon status={task.status} />
                    <span className="flex-1 text-[14px] text-[var(--tb-text)] truncate">{task.title}</span>
                    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {task.status === "draft" && (
                        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--tb-border)]" onClick={(e) => { e.stopPropagation(); onAccept(task.id); }}>
                          <Play className="w-3.5 h-3.5 text-[#009118]" />
                        </button>
                      )}
                      {task.status === "ready" && (
                        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--tb-border)]" onClick={(e) => { e.stopPropagation(); onApply(task.id); }}>
                          <ArrowRight className="w-3.5 h-3.5 text-[#009118]" />
                        </button>
                      )}
                      <ChevronRight className="w-3 h-3 text-[var(--tb-text-dimmest)]" />
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-[12px] text-[var(--tb-text-dim)] mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                  <div className="text-[12px] text-[var(--tb-text-dimmest)] mt-0.5">
                    {STATUS_LABELS[task.status] || task.status} {timestamp ? `\u2022 ${formatTimeAgo(timestamp)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mobile Column Nav ── */
function MobileColumnNav({
  columns,
  activeIndex,
  onSelect,
}: {
  columns: { key: string; label: string; color: string; tasks: Task[] }[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center border-b border-[var(--tb-border)] px-1 shrink-0" data-testid="mobile-column-nav">
      {columns.map((col, i) => (
        <button
          key={col.key}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
            i === activeIndex
              ? "text-[var(--tb-text)] border-b-2"
              : "text-[var(--tb-text-dimmest)]"
          }`}
          style={i === activeIndex ? { borderColor: col.color } : {}}
          onClick={() => onSelect(i)}
          data-testid={`mobile-tab-${col.key}`}
        >
          {col.label}
          {col.tasks.length > 0 && (
            <span className="text-[10px] px-1 rounded bg-[var(--tb-col-bg)]">{col.tasks.length}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

/* ── Main TaskBoard ── */
export default function TaskBoard({
  projectId,
  onClose,
  wsMessages,
}: {
  projectId: string;
  onClose: () => void;
  wsMessages?: any[];
}) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "thread">("board");
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isMobile = useIsMobile();

  const tasksQuery = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!wsMessages) return;
    const taskMessages = wsMessages.filter(m => m.type?.startsWith("task_"));
    if (taskMessages.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
    }
  }, [wsMessages, projectId, queryClient]);

  const acceptMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks/${taskId}/accept`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] }),
  });

  const applyMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks/${taskId}/apply`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] }),
  });

  const dismissMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks/${taskId}/dismiss`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/tasks/${taskId}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] }),
  });

  const bulkAcceptMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks/bulk-accept`, { taskIds });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] }),
  });

  const tasks = tasksQuery.data || [];
  const columns = STATUS_COLUMNS.map(col => ({
    ...col,
    tasks: tasks.filter(t => {
      if (col.key === "active") return t.status === "active" || t.status === "queued" || t.status === "applying";
      return t.status === col.key;
    }),
  }));

  const draftTasks = tasks.filter(t => t.status === "draft");

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0 && mobileColumnIndex < columns.length - 1) {
      setMobileColumnIndex(i => i + 1);
    } else if (dx > 0 && mobileColumnIndex > 0) {
      setMobileColumnIndex(i => i - 1);
    }
  }, [mobileColumnIndex, columns.length]);

  if (selectedTask) {
    return (
      <TaskReviewDrawer
        task={selectedTask}
        projectId={projectId}
        onClose={() => setSelectedTask(null)}
        onApply={(id) => { applyMutation.mutate(id); setSelectedTask(null); }}
        onDismiss={(id) => { dismissMutation.mutate(id); setSelectedTask(null); }}
      />
    );
  }

  return (
    <div className="tb-board flex flex-col h-full" data-testid="task-board">
      <style>{`
        .tb-board {
          --tb-bg: var(--ide-bg, #F6F6F4);
          --tb-col-bg: var(--ide-surface, #F1F1EE);
          --tb-card-bg: var(--ide-bg, #EDECE8);
          --tb-border: var(--ide-border, #DEDAD5);
          --tb-text: var(--ide-text, #1D1D1D);
          --tb-text-dim: var(--ide-text-muted, #5C5C5C);
          --tb-text-dimmest: var(--ide-text-muted, #858585);
          --tb-positive-bg: hsla(140, 50%, 33%, 1);
          --tb-positive-hover: hsla(140, 50%, 28%, 1);
          font-family: 'IBM Plex Sans', -apple-system, sans-serif;
        }
        @keyframes tb-card-fade {
          from { transform: translateY(6px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .tb-card {
          background: var(--tb-card-bg);
          border: 1px solid var(--tb-border);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          animation: tb-card-fade 300ms ease-out forwards;
          transition: border-color 120ms ease-out;
        }
        .tb-card:hover {
          border-color: var(--tb-text-dimmest);
        }
        .tb-menu-btn:hover {
          background: var(--tb-border);
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-[var(--tb-border)] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#009118]" />
          <span className="text-[13px] font-medium text-[var(--tb-text)]">Tasks</span>
          <span className="text-[12px] px-1.5 rounded bg-[var(--tb-col-bg)] text-[var(--tb-text-dim)] leading-5">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {tasks.length > 0 && (
            <div className="flex items-center bg-[var(--tb-col-bg)] rounded-md p-0.5" data-testid="view-mode-toggle">
              <button
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${viewMode === "board" ? "bg-[var(--tb-bg)] shadow-sm" : ""}`}
                onClick={() => setViewMode("board")}
                data-testid="button-view-board"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[var(--tb-text-dim)]" />
              </button>
              <button
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${viewMode === "thread" ? "bg-[var(--tb-bg)] shadow-sm" : ""}`}
                onClick={() => setViewMode("thread")}
                data-testid="button-view-thread"
              >
                <List className="w-3.5 h-3.5 text-[var(--tb-text-dim)]" />
              </button>
            </div>
          )}
          {draftTasks.length > 0 && (
            <button
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium text-white transition-colors"
              style={{ backgroundColor: "var(--tb-positive-bg)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--tb-positive-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--tb-positive-bg)"}
              onClick={() => bulkAcceptMutation.mutate(draftTasks.map(t => t.id))}
              disabled={bulkAcceptMutation.isPending}
              data-testid="button-accept-all"
            >
              {bulkAcceptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Accept tasks
            </button>
          )}
          <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--tb-col-bg)] transition-colors" onClick={onClose} data-testid="button-close-tasks">
            <X className="w-4 h-4 text-[var(--tb-text-dim)]" />
          </button>
        </div>
      </div>

      {/* Content */}
      {tasksQuery.isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--tb-text-dimmest)]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#009118]/10 flex items-center justify-center mb-4">
            <ReadySparkleIcon />
          </div>
          <h3 className="text-[15px] font-medium text-[var(--tb-text)] mb-1" data-testid="text-no-tasks">No tasks yet</h3>
          <p className="text-[13px] text-[var(--tb-text-dimmest)] max-w-[280px] leading-relaxed">
            Describe what you want to build and Agent will break it into parallel tasks
          </p>
        </div>
      ) : viewMode === "thread" ? (
        <ThreadView
          tasks={tasks}
          onAccept={(id) => acceptMutation.mutate(id)}
          onApply={(id) => applyMutation.mutate(id)}
          onSelect={setSelectedTask}
        />
      ) : (
        <>
          {isMobile && (
            <MobileColumnNav columns={columns} activeIndex={mobileColumnIndex} onSelect={setMobileColumnIndex} />
          )}
          {isMobile ? (
            <div
              className="flex-1 overflow-y-auto p-3"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              data-testid="mobile-column-content"
            >
              <div className="space-y-2">
                {columns[mobileColumnIndex]?.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onAccept={(id) => acceptMutation.mutate(id)}
                    onApply={(id) => applyMutation.mutate(id)}
                    onDismiss={(id) => dismissMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onSelect={setSelectedTask}
                  />
                ))}
                {columns[mobileColumnIndex]?.tasks.length === 0 && (
                  <p className="text-center text-[13px] text-[var(--tb-text-dimmest)] py-8">No tasks in this column</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
              <div className="flex gap-3 p-3 h-full min-w-max">
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="flex flex-col w-[240px] shrink-0 bg-[var(--tb-col-bg)] rounded-lg"
                    data-testid={`column-${col.key}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="text-[14px] font-medium text-[var(--tb-text)]">{col.label}</span>
                      <span className="text-[12px] text-[var(--tb-text-dim)] bg-[var(--tb-bg)] px-1.5 rounded leading-5">
                        {col.tasks.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                      {col.tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onAccept={(id) => acceptMutation.mutate(id)}
                          onApply={(id) => applyMutation.mutate(id)}
                          onDismiss={(id) => dismissMutation.mutate(id)}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onSelect={setSelectedTask}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
