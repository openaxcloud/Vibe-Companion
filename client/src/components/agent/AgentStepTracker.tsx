import { useState } from "react";
import {
  FileCode, FilePlus, FileEdit, Terminal, Search, Globe, Image,
  CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronRight,
  Braces, Wrench, Database, Package, Eye, Sparkles, Clock, Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentStepStatus = "running" | "done" | "error";
export type AgentStepType =
  | "thinking" | "status" | "create_file" | "edit_file" | "execute_command"
  | "web_search" | "fetch_url" | "image_search" | "generate_image"
  | "generate_file" | "mcp_tool" | "skill" | "task_progress"
  | "install_package" | "preview_update" | "code_review" | "generate_speech";

export interface AgentStep {
  id: string;
  type: AgentStepType;
  label: string;
  detail?: string;
  status: AgentStepStatus;
  timestamp: number;
  duration?: number;
}

const STEP_CONFIG: Record<AgentStepType, { icon: typeof FileCode; color: string; bg: string }> = {
  thinking:         { icon: Cpu,           color: "text-[#7C65CB]", bg: "bg-[#7C65CB]/10" },
  status:           { icon: Sparkles,      color: "text-[#0079F2]", bg: "bg-[#0079F2]/10" },
  create_file:      { icon: FilePlus,      color: "text-[#0CCE6B]", bg: "bg-[#0CCE6B]/10" },
  edit_file:        { icon: FileEdit,      color: "text-[#F5A623]", bg: "bg-[#F5A623]/10" },
  execute_command:  { icon: Terminal,      color: "text-[#E44D26]", bg: "bg-[#E44D26]/10" },
  web_search:       { icon: Search,        color: "text-[#4285F4]", bg: "bg-[#4285F4]/10" },
  fetch_url:        { icon: Globe,         color: "text-[#20808D]", bg: "bg-[#20808D]/10" },
  image_search:     { icon: Image,         color: "text-[#E91E63]", bg: "bg-[#E91E63]/10" },
  generate_image:   { icon: Image,         color: "text-[#9C27B0]", bg: "bg-[#9C27B0]/10" },
  generate_file:    { icon: Braces,        color: "text-[#FF7043]", bg: "bg-[#FF7043]/10" },
  mcp_tool:         { icon: Wrench,        color: "text-[#607D8B]", bg: "bg-[#607D8B]/10" },
  skill:            { icon: Sparkles,      color: "text-[#7C65CB]", bg: "bg-[#7C65CB]/10" },
  task_progress:    { icon: CheckCircle2,  color: "text-[#0CCE6B]", bg: "bg-[#0CCE6B]/10" },
  install_package:  { icon: Package,       color: "text-[#795548]", bg: "bg-[#795548]/10" },
  preview_update:   { icon: Eye,           color: "text-[#00BCD4]", bg: "bg-[#00BCD4]/10" },
  code_review:      { icon: FileCode,      color: "text-[#FF9800]", bg: "bg-[#FF9800]/10" },
  generate_speech:  { icon: Sparkles,      color: "text-[#673AB7]", bg: "bg-[#673AB7]/10" },
};

const StatusIcon = ({ status }: { status: AgentStepStatus }) => {
  if (status === "running") return <Loader2 className="w-3 h-3 animate-spin text-[#7C65CB]" />;
  if (status === "done") return <CheckCircle2 className="w-3 h-3 text-[#0CCE6B]" />;
  return <AlertCircle className="w-3 h-3 text-red-400" />;
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface AgentStepTrackerProps {
  steps: AgentStep[];
  isStreaming: boolean;
  compact?: boolean;
}

export function AgentStepTracker({ steps, isStreaming, compact = false }: AgentStepTrackerProps) {
  const [expanded, setExpanded] = useState(true);

  if (steps.length === 0) return null;

  const doneCount = steps.filter(s => s.status === "done").length;
  const runningSteps = steps.filter(s => s.status === "running");
  const currentStep = runningSteps[runningSteps.length - 1];

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ide-surface)]/50 border border-[var(--ide-border)]/50 rounded-lg text-[11px]">
        {isStreaming && <Loader2 className="w-3 h-3 animate-spin text-[#7C65CB] shrink-0" />}
        <span className="text-[var(--ide-text-muted)] truncate">
          {currentStep ? currentStep.label : `${doneCount} step${doneCount !== 1 ? "s" : ""} completed`}
        </span>
        {doneCount > 0 && (
          <span className="text-[var(--ide-text-muted)] shrink-0">{doneCount}/{steps.length}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--ide-border)]/60 bg-[var(--ide-surface)]/30 overflow-hidden" data-testid="agent-step-tracker">
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--ide-surface)]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-steps"
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C65CB]" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0CCE6B]" />
          )}
          <span className="text-[11px] font-medium text-[var(--ide-text)]">
            {isStreaming
              ? currentStep ? currentStep.label : "Working..."
              : `${doneCount} action${doneCount !== 1 ? "s" : ""} completed`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--ide-text-muted)]">
            {doneCount}/{steps.length}
          </span>
          {expanded ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--ide-border)]/40 px-2 py-1.5 space-y-0.5 max-h-[280px] overflow-y-auto">
          {steps.map((step) => {
            const config = STEP_CONFIG[step.type] || STEP_CONFIG.status;
            const Icon = config.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors",
                  step.status === "running" && "bg-[#7C65CB]/5"
                )}
                data-testid={`step-${step.id}`}
              >
                <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", config.bg)}>
                  <Icon className={cn("w-3 h-3", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[var(--ide-text)] truncate">{step.label}</span>
                  </div>
                  {step.detail && (
                    <span className="text-[10px] text-[var(--ide-text-muted)] truncate block">{step.detail}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {step.duration != null && step.status === "done" && (
                    <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDuration(step.duration)}
                    </span>
                  )}
                  <StatusIcon status={step.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function createStepFromSSE(data: Record<string, unknown>, existingSteps: AgentStep[]): AgentStep | null {
  const type = data.type as string;
  const now = Date.now();
  const id = `step-${now}-${Math.random().toString(36).slice(2, 6)}`;

  switch (type) {
    case "status":
      return {
        id, type: "status", label: (data.message as string) || "Processing...",
        status: "done", timestamp: now,
      };

    case "tool_use": {
      const toolName = data.name as string;
      const input = data.input as Record<string, unknown> | undefined;
      const filename = input?.filename as string | undefined;
      const command = input?.command as string | undefined;

      if (toolName === "create_file") {
        return { id, type: "create_file", label: `Creating ${filename || "file"}`, detail: filename, status: "running", timestamp: now };
      } else if (toolName === "edit_file") {
        return { id, type: "edit_file", label: `Editing ${filename || "file"}`, detail: filename, status: "running", timestamp: now };
      } else if (toolName === "execute_command") {
        return { id, type: "execute_command", label: "Running command", detail: command?.slice(0, 80), status: "running", timestamp: now };
      } else if (toolName === "web_search" || toolName === "tavily_search") {
        return { id, type: "web_search", label: "Searching the web", detail: (input?.query as string)?.slice(0, 60), status: "running", timestamp: now };
      } else if (toolName === "fetch_url") {
        return { id, type: "fetch_url", label: "Fetching content", detail: (input?.url as string)?.slice(0, 60), status: "running", timestamp: now };
      } else if (toolName === "brave_image_search") {
        return { id, type: "image_search", label: "Searching for images", status: "running", timestamp: now };
      } else if (toolName === "generate_ai_image" || toolName === "generate_image") {
        return { id, type: "generate_image", label: `Generating image ${filename || ""}`, detail: filename, status: "running", timestamp: now };
      } else if (toolName === "generate_file") {
        return { id, type: "generate_file", label: `Generating ${filename || "file"}`, detail: filename, status: "running", timestamp: now };
      } else if (toolName === "text_to_speech") {
        return { id, type: "generate_speech", label: "Generating speech", status: "running", timestamp: now };
      } else if (toolName === "create_skill") {
        return { id, type: "skill", label: "Creating skill", status: "running", timestamp: now };
      } else if (toolName?.startsWith("mcp__")) {
        return { id, type: "mcp_tool", label: `Using ${toolName.replace(/^mcp__/, "")}`, status: "running", timestamp: now };
      }
      return { id, type: "status", label: `Using tool: ${toolName}`, status: "running", timestamp: now };
    }

    case "file_created":
      return {
        id, type: "create_file",
        label: `Created ${(data.file as Record<string, unknown>)?.filename || "file"}`,
        detail: (data.file as Record<string, unknown>)?.filename as string,
        status: "done", timestamp: now,
      };

    case "file_updated":
      return {
        id, type: "edit_file",
        label: `Updated ${(data.file as Record<string, unknown>)?.filename || "file"}`,
        detail: (data.file as Record<string, unknown>)?.filename as string,
        status: "done", timestamp: now,
      };

    case "task_progress":
      return {
        id, type: "task_progress",
        label: `Task: ${data.taskTitle || data.taskId || "unknown"} → ${data.status}`,
        status: "done", timestamp: now,
      };

    default:
      return null;
  }
}

export function completeRunningSteps(steps: AgentStep[]): AgentStep[] {
  const now = Date.now();
  return steps.map(s => {
    if (s.status === "running") {
      return { ...s, status: "done" as const, duration: now - s.timestamp };
    }
    return s;
  });
}

export function markLatestToolDone(steps: AgentStep[], toolType: AgentStepType, filename?: string): AgentStep[] {
  const now = Date.now();
  let found = false;
  return [...steps].reverse().map(s => {
    if (!found && s.status === "running" && s.type === toolType && (!filename || s.detail === filename)) {
      found = true;
      return { ...s, status: "done" as const, duration: now - s.timestamp };
    }
    return s;
  }).reverse();
}
