import { useState, useEffect, useCallback, useRef, useMemo, TouchEvent as ReactTouchEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Loader2, MoreHorizontal, CheckCircle2, Circle, Sparkles, Play,
  X, ChevronRight, Clock, Zap, ArrowRight, LayoutGrid, List,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { key: "ready", label: "Ready", color: "#0CCE6B" },
  { key: "done", label: "Done", color: "#6B7280" },
] as const;

function ActiveDots() {
  return (
    <span className="inline-flex items-center gap-[2px]" data-testid="icon-active-dots">
      <span className="w-[5px] h-[5px] rounded-full bg-[#0079F2] animate-[task-dot_1.4s_ease-in-out_infinite]" />
      <span className="w-[5px] h-[5px] rounded-full bg-[#0079F2] animate-[task-dot_1.4s_ease-in-out_0.2s_infinite]" style={{ animationDelay: "0.2s" }} />
      <span className="w-[5px] h-[5px] rounded-full bg-[#0079F2] animate-[task-dot_1.4s_ease-in-out_0.4s_infinite]" style={{ animationDelay: "0.4s" }} />
      <span className="w-[5px] h-[5px] rounded-full bg-[#0079F2] animate-[task-dot_1.4s_ease-in-out_0.6s_infinite]" style={{ animationDelay: "0.6s" }} />
    </span>
  );
}

function SparkleDropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" data-testid="icon-sparkle-drop">
      <path fill="#0CCE6B" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
      <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
    </svg>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "active":
    case "queued":
      return <ActiveDots />;
    case "ready":
      return <SparkleDropIcon />;
    case "done":
      return <CheckCircle2 className="w-3.5 h-3.5 text-[#6B7280]" />;
    case "applying":
      return <Loader2 className="w-3.5 h-3.5 text-[#0079F2] animate-spin" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-[#8E8F97]" />;
  }
}

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
  return (
    <div
      className="group bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg p-3 hover:border-[var(--ide-border-focus)] transition-all cursor-pointer"
      onClick={() => onSelect(task)}
      data-testid={`card-task-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          <TaskStatusIcon status={task.status} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[12px] font-medium text-[var(--ide-text)] truncate" data-testid={`text-task-title-${task.id}`}>
            {task.title}
          </h4>
          {task.description && (
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5 line-clamp-2">
              {task.description}
            </p>
          )}
          {task.status === "active" && task.progress > 0 && (
            <div className="mt-1.5">
              <div className="h-1 bg-[var(--ide-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0079F2] rounded-full transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                  data-testid={`progress-task-${task.id}`}
                />
              </div>
              <span className="text-[9px] text-[var(--ide-text-muted)] mt-0.5">{task.progress}%</span>
            </div>
          )}
          {task.status === "queued" && (
            <span className="inline-flex items-center gap-1 text-[9px] text-[#F5A623] mt-1">
              <Clock className="w-2.5 h-2.5" /> Queued
            </span>
          )}
        </div>
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-hover)]" data-testid={`button-task-menu-${task.id}`}>
                <MoreHorizontal className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {task.status === "draft" && (
                <DropdownMenuItem onClick={() => onAccept(task.id)} data-testid={`menu-accept-${task.id}`}>
                  <Play className="w-3 h-3 mr-2" /> Start Task
                </DropdownMenuItem>
              )}
              {task.status === "ready" && (
                <>
                  <DropdownMenuItem onClick={() => onApply(task.id)} data-testid={`menu-apply-${task.id}`}>
                    <ArrowRight className="w-3 h-3 mr-2" /> Apply changes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDismiss(task.id)} data-testid={`menu-dismiss-${task.id}`}>
                    <X className="w-3 h-3 mr-2" /> Dismiss
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-400" data-testid={`menu-delete-${task.id}`}>
                <X className="w-3 h-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
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
    <div className="flex-1 overflow-y-auto p-2 space-y-3" data-testid="task-thread-view">
      {grouped.map((group) => (
        <div key={group.key}>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
            <span className="text-[10px] font-semibold text-[var(--ide-text)] uppercase tracking-wider">{group.label}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">
              {group.tasks.length}
            </span>
          </div>
          <div className="space-y-1">
            {group.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] hover:border-[var(--ide-border-focus)] transition-all cursor-pointer group"
                onClick={() => onSelect(task)}
                data-testid={`thread-task-${task.id}`}
              >
                <div className="shrink-0">
                  <TaskStatusIcon status={task.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-[var(--ide-text)] truncate block" data-testid={`text-thread-title-${task.id}`}>
                    {task.title}
                  </span>
                  {(task.status === "active" || task.status === "applying") && task.progress > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="h-1 flex-1 bg-[var(--ide-border)] rounded-full overflow-hidden">
                        <div className="h-full bg-[#0079F2] rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                      <span className="text-[9px] text-[var(--ide-text-muted)] shrink-0">{task.progress}%</span>
                    </div>
                  )}
                  {task.status === "queued" && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-[#F5A623] mt-0.5">
                      <Clock className="w-2.5 h-2.5" /> Queued
                    </span>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {task.status === "draft" && (
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-hover)] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onAccept(task.id); }}
                      data-testid={`button-thread-accept-${task.id}`}
                    >
                      <Play className="w-3 h-3 text-[#0CCE6B]" />
                    </button>
                  )}
                  {task.status === "ready" && (
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ide-hover)] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onApply(task.id); }}
                      data-testid={`button-thread-apply-${task.id}`}
                    >
                      <ArrowRight className="w-3 h-3 text-[#0CCE6B]" />
                    </button>
                  )}
                  <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
    <div className="flex items-center border-b border-[var(--ide-border)] px-1 shrink-0" data-testid="mobile-column-nav">
      {columns.map((col, i) => (
        <button
          key={col.key}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            i === activeIndex
              ? "text-[var(--ide-text)] border-b-2"
              : "text-[var(--ide-text-muted)]"
          }`}
          style={i === activeIndex ? { borderColor: col.color } : {}}
          onClick={() => onSelect(i)}
          data-testid={`mobile-tab-${col.key}`}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
          {col.label}
          {col.tasks.length > 0 && (
            <span className="text-[8px] px-1 py-0 rounded-full bg-[var(--ide-surface)]">{col.tasks.length}</span>
          )}
        </button>
      ))}
    </div>
  );
}

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
    const taskMessages = wsMessages.filter(m =>
      m.type?.startsWith("task_")
    );
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
    <div className="flex flex-col h-full" data-testid="task-board">
      <style>{`
        @keyframes task-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#0079F2]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Tasks</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {tasks.length > 0 && (
            <div className="flex items-center bg-[var(--ide-surface)] rounded-md p-0.5" data-testid="view-mode-toggle">
              <button
                className={`w-5 h-5 flex items-center justify-center rounded ${viewMode === "board" ? "bg-[var(--ide-bg)] shadow-sm" : ""}`}
                onClick={() => setViewMode("board")}
                data-testid="button-view-board"
              >
                <LayoutGrid className="w-3 h-3 text-[var(--ide-text-muted)]" />
              </button>
              <button
                className={`w-5 h-5 flex items-center justify-center rounded ${viewMode === "thread" ? "bg-[var(--ide-bg)] shadow-sm" : ""}`}
                onClick={() => setViewMode("thread")}
                data-testid="button-view-thread"
              >
                <List className="w-3 h-3 text-[var(--ide-text-muted)]" />
              </button>
            </div>
          )}
          {draftTasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-[#0CCE6B] hover:text-[#0CCE6B]"
              onClick={() => bulkAcceptMutation.mutate(draftTasks.map(t => t.id))}
              disabled={bulkAcceptMutation.isPending}
              data-testid="button-accept-all"
            >
              {bulkAcceptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              Accept All
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onClose} data-testid="button-close-tasks">
            <X className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
          </Button>
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#0079F2]/10 flex items-center justify-center mb-3">
            <Zap className="w-6 h-6 text-[#0079F2]" />
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--ide-text)] mb-1" data-testid="text-no-tasks">No tasks yet</h3>
          <p className="text-[11px] text-[var(--ide-text-muted)] max-w-[240px]">
            Use Plan mode in the AI panel to break your work into parallel tasks
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
              className="flex-1 overflow-y-auto p-2"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              data-testid="mobile-column-content"
            >
              <div className="space-y-1.5">
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
                  <p className="text-center text-[11px] text-[var(--ide-text-muted)] py-6">No tasks in this column</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
              <div className="flex gap-2 p-2 h-full min-w-max">
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="flex flex-col w-[220px] shrink-0 bg-[var(--ide-bg)] rounded-lg border border-[var(--ide-border)]"
                    data-testid={`column-${col.key}`}
                  >
                    <div className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--ide-border)]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                        <span className="text-[10px] font-semibold text-[var(--ide-text)] uppercase tracking-wider">{col.label}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">
                        {col.tasks.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
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
