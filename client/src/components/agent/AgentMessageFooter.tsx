import { memo } from "react";
import {
  Clock, FileCode, FilePlus, FileEdit, Terminal, Cpu,
  Coins, ChevronDown, ChevronUp, Layers, Zap, BarChart3, CheckCircle2, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStep } from "./AgentStepTracker";

export interface AgentUsageStats {
  duration?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: string;
  model?: string;
  provider?: string;
  filesCreated?: number;
  filesEdited?: number;
  commandsRun?: number;
  filesModified?: number;
}

interface AgentMessageFooterProps {
  steps: AgentStep[];
  usageStats?: AgentUsageStats;
  isStreaming: boolean;
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(2)}M`;
}

export const AgentMessageFooter = memo(function AgentMessageFooter({
  steps,
  usageStats,
  isStreaming,
  className,
}: AgentMessageFooterProps) {
  if (isStreaming && !usageStats) return null;

  const filesCreated = usageStats?.filesCreated ?? steps.filter(s => s.type === "create_file" && s.status === "done").length;
  const filesEdited = usageStats?.filesEdited ?? steps.filter(s => s.type === "edit_file" && s.status === "done").length;
  const commandsRun = usageStats?.commandsRun ?? steps.filter(s => s.type === "execute_command" && s.status === "done").length;
  const totalSteps = steps.filter(s => s.status === "done").length;
  const totalDuration = usageStats?.duration ?? steps.reduce((sum, s) => sum + (s.duration || 0), 0);

  const hasWorkDone = filesCreated > 0 || filesEdited > 0 || commandsRun > 0 || totalSteps > 0;
  if (!hasWorkDone && !usageStats) return null;

  return (
    <div className={cn(
      "mt-3 pt-2 border-t border-[var(--ide-border)]/30",
      className
    )} data-testid="agent-message-footer">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-[var(--ide-text-muted)]">
        {totalDuration > 0 && (
          <span className="flex items-center gap-1" data-testid="footer-duration">
            <Clock className="w-3 h-3" />
            {formatDuration(totalDuration)}
          </span>
        )}

        {totalSteps > 0 && (
          <span className="flex items-center gap-1" data-testid="footer-steps">
            <Layers className="w-3 h-3" />
            {totalSteps} action{totalSteps !== 1 ? "s" : ""}
          </span>
        )}

        {filesCreated > 0 && (
          <span className="flex items-center gap-1 text-[#0CCE6B]" data-testid="footer-files-created">
            <FilePlus className="w-3 h-3" />
            {filesCreated} created
          </span>
        )}

        {filesEdited > 0 && (
          <span className="flex items-center gap-1 text-[#F5A623]" data-testid="footer-files-edited">
            <FileEdit className="w-3 h-3" />
            {filesEdited} edited
          </span>
        )}

        {commandsRun > 0 && (
          <span className="flex items-center gap-1 text-[#E44D26]" data-testid="footer-commands">
            <Terminal className="w-3 h-3" />
            {commandsRun} command{commandsRun !== 1 ? "s" : ""}
          </span>
        )}

        {usageStats?.model && (
          <span className="flex items-center gap-1" data-testid="footer-model">
            <Cpu className="w-3 h-3" />
            {usageStats.model}
          </span>
        )}

        {usageStats?.totalTokens && usageStats.totalTokens > 0 && (
          <span className="flex items-center gap-1" data-testid="footer-tokens">
            <BarChart3 className="w-3 h-3" />
            {formatTokens(usageStats.totalTokens)} tokens
          </span>
        )}

        {usageStats?.cost && (
          <span className="flex items-center gap-1" data-testid="footer-cost">
            <Coins className="w-3 h-3" />
            {usageStats.cost}
          </span>
        )}

        <span className="flex items-center gap-1 text-[#0CCE6B]" data-testid="footer-checkpoint">
          <CheckCircle2 className="w-3 h-3" />
          Checkpoint saved
        </span>
      </div>
    </div>
  );
});
