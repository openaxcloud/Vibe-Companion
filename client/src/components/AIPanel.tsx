import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react";
import type { ExternalInputHandlers } from "./ai/ReplitAgentPanelV3";
import { Button } from "@/components/ui/button";

// CRITICAL: TaskBoard must be lazy-loaded at MODULE level (static), NOT inline.
// An inline React.lazy(() => import("./TaskBoard")) creates a NEW lazy component
// on every render. The module might not be loaded, so it ALWAYS suspends on first
// encounter. If that first encounter happens during a synchronous re-render
// (triggered by react-query's useSyncExternalStore), React 19 throws Error #310.
// A static lazy() call caches the component after the first load.
const LazyTaskBoard = lazy(() => import("./TaskBoard"));
import {
  Send, Bot, User, Copy, Check, X, Sparkles, Trash2,
  FileCode, FilePlus, FileEdit, ChevronDown, ChevronRight, Zap, MessageSquare,
  FileDown, Code2, Bug, Lightbulb, Gauge, Wrench, Layout, Database, Shield,
  Mic, MicOff, Paperclip, Image, FileText, XCircle, ImagePlus, Loader2, ToggleLeft, ToggleRight,
  Settings2, Search, FlaskConical, Brain, Globe,
  Pause, GripVertical, Pencil, ListOrdered, ChevronUp, SlidersHorizontal,
  Map, Hammer, Play, CheckCircle2, Circle, Clock, ArrowRight, Layers,
  Volume2, VolumeX, Download, Square, RefreshCw
} from "lucide-react";
import ArtifactTypeCarousel, { ArtifactTypePill } from "./ArtifactTypeCarousel";
import FigmaDesignCard, { FigmaLinkIndicator, detectFigmaUrl } from "./FigmaDesignCard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { getCsrfToken } from "@/lib/queryClient";

type FileInfo = { id: string; filename: string; content: string };

interface Attachment {
  id: string;
  name: string;
  type: "image" | "text" | "file";
  content: string;
  mimeType: string;
  size: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface GeneratedFile {
  filename: string;
  format: string;
  downloadUrl: string;
  mimeType: string;
  size: number;
}

interface McpToolCall {
  callId: string;
  name: string;
  serverId?: number;
  args?: Record<string, unknown>;
  status: "running" | "complete" | "error";
  result?: string;
}

interface ImageSearchResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  width: number;
  height: number;
}

interface GeneratedAudio {
  audioDataUri: string;
  voiceName: string;
  durationEstimate: number;
  textLength: number;
  mimeType: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: AIModel;
  fileOps?: { type: "created" | "updated"; filename: string }[];
  attachments?: Attachment[];
  inlineImages?: { filename: string; dataUri: string }[];
  webSearchResults?: WebSearchResult[];
  generatedFiles?: GeneratedFile[];
  mcpToolCalls?: McpToolCall[];
  audioChunks?: string[];
  audioTranscript?: string;
  imageSearchResults?: ImageSearchResult[];
  generatedAudio?: GeneratedAudio[];
}

interface QueuedMsg {
  id: string;
  content: string;
  attachments?: Attachment[];
  position: number;
  status: string;
}

interface PlanTask {
  id?: string;
  title: string;
  description: string;
  complexity?: "simple" | "medium" | "complex";
  dependsOn: number[];
  status: "pending" | "in-progress" | "done";
  sortOrder: number;
}

interface Plan {
  id: string;
  title: string;
  status: string;
  model: string;
  tasks: PlanTask[];
}

interface AIPanelProps {
  context?: { language: string; filename: string; code: string };
  onClose: () => void;
  projectId?: string;
  files?: FileInfo[];
  onFileCreated?: (file: FileInfo) => void;
  onFileUpdated?: (file: FileInfo) => void;
  onApplyCode?: (filename: string, code: string) => void;
  pendingMessage?: string | null;
  onPendingMessageConsumed?: () => void;
  onAgentComplete?: () => void;
  onCanvasFrameCreate?: (htmlContent: string, name?: string) => void;
  onConvertFrame?: (frameId: string, frameName: string, targetType: string) => void;
  canvasFrames?: { id: string; name: string }[];
  hideInput?: boolean;
  onExternalInput?: (handlers: {
    handleSubmit?: (value: string) => void;
    handleSubmitWithAttachments?: (value: string, attachments: Attachment[]) => void;
    isWorking?: boolean;
    agentMode?: string;
    onModeChange?: (mode: string) => void;
    addFiles?: (files: File[]) => void;
    pendingAttachmentsCount?: number;
    removeAttachment?: (id: string) => void;
    attachments?: { id: string; name: string; type: string; size: number }[];
    onVoice?: () => void;
    isRecording?: boolean;
    isTranscribing?: boolean;
    onAIModeChange?: (mode: 'chat' | 'agent' | 'plan') => void;
    aiMode?: 'chat' | 'agent' | 'plan';
    onAgentToolsConfigChange?: (updates: Record<string, boolean>) => void;
    agentToolsConfig?: { liteMode: boolean; webSearch: boolean; appTesting: boolean; codeOptimizations: boolean; architect: boolean; turbo: boolean };
  } | null) => void;
}

type AIModel = "claude" | "gpt" | "gemini" | "openrouter" | "perplexity" | "mistral";
type AIMode = "chat" | "agent" | "plan";
type TopMode = "plan" | "build";
type AgentMode = "economy" | "power" | "turbo";
type TopAgentMode = "lite" | "autonomous" | "max";
type AutonomousTier = "economy" | "power";

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  top_provider: number | null;
  architecture: string | null;
}

interface AgentToolsConfig {
  liteMode: boolean;
  webSearch: boolean;
  appTesting: boolean;
  codeOptimizations: boolean;
  architect: boolean;
  turbo: boolean;
}

const MODEL_LABELS: Record<AIModel, { name: string; badge: string; color: string; icon: typeof Sparkles }> = {
  claude: { name: "Claude Sonnet", badge: "Anthropic", color: "text-[#7C65CB] bg-[#7C65CB]/10", icon: Sparkles },
  gpt: { name: "GPT-4o", badge: "OpenAI", color: "text-[#0CCE6B] bg-[#0CCE6B]/10", icon: Zap },
  gemini: { name: "Gemini Flash", badge: "Google", color: "text-[#4285F4] bg-[#4285F4]/10", icon: Zap },
  openrouter: { name: "OpenRouter", badge: "200+ Models", color: "text-[#E44D26] bg-[#E44D26]/10", icon: Globe },
  perplexity: { name: "Perplexity", badge: "Search AI", color: "text-[#20808D] bg-[#20808D]/10", icon: Search },
  mistral: { name: "Mistral", badge: "Mistral AI", color: "text-[#FF7000] bg-[#FF7000]/10", icon: Zap },
};

const TOP_AGENT_MODE_LABELS: Record<TopAgentMode, { name: string; icon: typeof Zap; color: string; bg: string; description: string }> = {
  lite: { name: "Lite", icon: Zap, color: "#F5A623", bg: "bg-[#F5A623]", description: "Fast, focused single-file edits" },
  autonomous: { name: "Autonomous", icon: Bot, color: "#7C65CB", bg: "bg-[#7C65CB]", description: "Full agent capabilities" },
  max: { name: "Max", icon: Brain, color: "#0079F2", bg: "bg-[#0079F2]", description: "Extended context, multi-step planning" },
};

const AUTONOMOUS_TIER_LABELS: Record<AutonomousTier, { name: string; color: string; description: string }> = {
  economy: { name: "Economy", color: "#0CCE6B", description: "Standard models, 1 credit/call" },
  power: { name: "Power", color: "#0079F2", description: "Best models, 3 credits/call" },
};

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  typescript: { bg: "bg-blue-500/20", text: "text-blue-400" },
  ts: { bg: "bg-blue-500/20", text: "text-blue-400" },
  tsx: { bg: "bg-blue-500/20", text: "text-blue-400" },
  javascript: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  js: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  jsx: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  python: { bg: "bg-green-500/20", text: "text-green-400" },
  py: { bg: "bg-green-500/20", text: "text-green-400" },
  css: { bg: "bg-pink-500/20", text: "text-pink-400" },
  html: { bg: "bg-orange-500/20", text: "text-orange-400" },
  json: { bg: "bg-amber-500/20", text: "text-amber-400" },
  sql: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  bash: { bg: "bg-gray-500/20", text: "text-gray-400" },
  sh: { bg: "bg-gray-500/20", text: "text-gray-400" },
  rust: { bg: "bg-orange-600/20", text: "text-orange-500" },
  go: { bg: "bg-cyan-600/20", text: "text-cyan-400" },
  java: { bg: "bg-red-500/20", text: "text-red-400" },
};

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  simple: { bg: "bg-green-500/15", text: "text-green-400", label: "Simple" },
  medium: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Medium" },
  complex: { bg: "bg-red-500/15", text: "text-red-400", label: "Complex" },
};

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-[var(--ide-text-secondary)] py-1">
      <span className="flex items-center gap-[3px]">
        <span className="w-[5px] h-[5px] rounded-full bg-[#7C65CB] animate-[bounce-dot_1.4s_ease-in-out_infinite]" />
        <span className="w-[5px] h-[5px] rounded-full bg-[#7C65CB] animate-[bounce-dot_1.4s_ease-in-out_0.2s_infinite]" style={{ animationDelay: "0.2s" }} />
        <span className="w-[5px] h-[5px] rounded-full bg-[#7C65CB] animate-[bounce-dot_1.4s_ease-in-out_0.4s_infinite]" style={{ animationDelay: "0.4s" }} />
      </span>
      <span className="text-[11px] ml-1"> Thinking...</span>
    </span>
  );
}

function FileOpProgress({ ops }: { ops: { type: "created" | "updated"; filename: string }[] }) {
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-[#0CCE6B]/20">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0CCE6B]/5 border-b border-[#0CCE6B]/20">
        <div className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />
        <span className="text-[10px] font-semibold text-[#0CCE6B] uppercase tracking-wider">Files Modified</span>
        <span className="text-[10px] text-[#0CCE6B]/60 ml-auto">{ops.length} file{ops.length > 1 ? "s" : ""}</span>
      </div>
      <div className="bg-[#0CCE6B]/5 p-2">
        {ops.map((op, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-[var(--ide-text)] py-1 px-1">
            <div className={`w-5 h-5 rounded flex items-center justify-center ${op.type === "created" ? "bg-[#0CCE6B]/15" : "bg-[#0079F2]/15"}`}>
              {op.type === "created" ? <FilePlus className="w-3 h-3 text-[#0CCE6B]" /> : <FileEdit className="w-3 h-3 text-[#0079F2]" />}
            </div>
            <span className="font-mono text-[11px]">{op.filename}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${op.type === "created" ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" : "bg-[#0079F2]/10 text-[#0079F2]"}`}>
              {op.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function McpToolCallTimeline({ calls }: { calls: McpToolCall[] }) {
  const [expandedCallId, setExpandedCallId] = React.useState<string | null>(null);

  if (!calls || calls.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-[#7C65CB]/20" data-testid="mcp-tool-timeline">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#7C65CB]/5 border-b border-[#7C65CB]/20">
        <Zap className="w-3 h-3 text-[#7C65CB]" />
        <span className="text-[10px] font-semibold text-[#7C65CB] uppercase tracking-wider">MCP Tool Calls</span>
        <span className="text-[10px] text-[#7C65CB]/60 ml-auto">{calls.length} call{calls.length > 1 ? "s" : ""}</span>
      </div>
      <div className="bg-[#7C65CB]/5 p-2 space-y-1">
        {calls.map((call) => {
          const isExpanded = expandedCallId === call.callId;
          return (
            <div key={call.callId} data-testid={`mcp-call-${call.callId}`}>
              <button
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-[#7C65CB]/10 transition-colors text-left"
                onClick={() => setExpandedCallId(isExpanded ? null : call.callId)}
                data-testid={`button-expand-mcp-call-${call.callId}`}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5" style={{
                  backgroundColor: call.status === "running" ? "rgba(124,101,203,0.15)" : call.status === "error" ? "rgba(239,68,68,0.15)" : "rgba(12,206,107,0.15)",
                }}>
                  {call.status === "running" ? (
                    <Loader2 className="w-3 h-3 text-[#7C65CB] animate-spin" />
                  ) : call.status === "error" ? (
                    <XCircle className="w-3 h-3 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-[#0CCE6B]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-[var(--ide-text)] font-mono truncate">
                    {call.name}
                  </div>
                  <div className="text-[9px] text-[var(--ide-text-muted)]">
                    {call.status === "running" ? "Executing..." : call.status === "error" ? "Failed" : "Completed"}
                  </div>
                </div>
                <ChevronDown className={`w-3 h-3 text-[var(--ide-text-muted)] shrink-0 mt-1 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              </button>
              {isExpanded && (
                <div className="mx-2.5 mb-2 space-y-1.5" data-testid={`mcp-call-details-${call.callId}`}>
                  {call.args && Object.keys(call.args).length > 0 && (
                    <div>
                      <div className="text-[8px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-0.5 font-semibold">Request</div>
                      <pre className="text-[9px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded p-2 overflow-x-auto max-h-[100px] text-[var(--ide-text-secondary)]">
                        {JSON.stringify(call.args, null, 2)}
                      </pre>
                    </div>
                  )}
                  {call.result && (
                    <div>
                      <div className="text-[8px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-0.5 font-semibold">Response</div>
                      <pre className="text-[9px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded p-2 overflow-x-auto max-h-[150px] text-[var(--ide-text-secondary)]">
                        {call.result}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WebSearchCitations({ results }: { results: WebSearchResult[] }) {
  if (!results || results.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-[#0079F2]/20" data-testid="web-search-citations">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0079F2]/5 border-b border-[#0079F2]/20">
        <Globe className="w-3 h-3 text-[#0079F2]" />
        <span className="text-[10px] font-semibold text-[#0079F2] uppercase tracking-wider">Sources</span>
        <span className="text-[10px] text-[#0079F2]/60 ml-auto">{results.length} result{results.length > 1 ? "s" : ""}</span>
      </div>
      <div className="bg-[#0079F2]/5 p-2 space-y-1">
        {results.map((r, i) => {
          let hostname = "";
          try { hostname = new URL(r.url).hostname.replace("www.", ""); } catch { hostname = r.url; }
          return (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-[#0079F2]/10 transition-colors group"
              data-testid={`link-citation-${i}`}
            >
              <div className="w-5 h-5 rounded flex items-center justify-center bg-[#0079F2]/10 shrink-0 mt-0.5">
                <Globe className="w-3 h-3 text-[#0079F2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[var(--ide-text)] group-hover:text-[#0079F2] transition-colors truncate">
                  {r.title}
                </div>
                <div className="text-[9px] text-[var(--ide-text-muted)] truncate">{hostname}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function PlanTaskCard({ task, index, expanded, onToggle, onStatusChange }: {
  task: PlanTask;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange?: (status: "pending" | "in-progress" | "done") => void;
}) {
  const complexity = COMPLEXITY_COLORS[task.complexity || "medium"] || COMPLEXITY_COLORS.medium;
  const statusIcon = task.status === "done"
    ? <CheckCircle2 className="w-4 h-4 text-[#0CCE6B]" />
    : task.status === "in-progress"
    ? <Clock className="w-4 h-4 text-[#F59E0B] animate-pulse" />
    : <Circle className="w-4 h-4 text-[var(--ide-text-muted)]" />;

  return (
    <div
      className={`rounded-lg border transition-all ${
        task.status === "done"
          ? "border-[#0CCE6B]/20 bg-[#0CCE6B]/5"
          : task.status === "in-progress"
          ? "border-[#F59E0B]/20 bg-[#F59E0B]/5"
          : "border-[var(--ide-border)] bg-[var(--ide-surface)]/50"
      }`}
      data-testid={`card-plan-task-${index}`}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={onToggle}
        data-testid={`button-toggle-task-${index}`}
      >
        {statusIcon}
        <span className="flex-1 text-[12px] font-medium text-[var(--ide-text)] truncate">
          {index + 1}. {task.title}
        </span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${complexity.bg} ${complexity.text}`}>
          {complexity.label}
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-[var(--ide-text-muted)] transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--ide-border)]/50">
          <p className="text-[11px] text-[var(--ide-text-secondary)] leading-relaxed mt-2">
            {task.description}
          </p>
          {task.dependsOn.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[9px] text-[var(--ide-text-muted)]">Depends on:</span>
              {task.dependsOn.map((dep) => (
                <span key={dep} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text-secondary)] font-mono">
                  Task {dep + 1}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanTaskChecklist({ tasks, onTaskStatusChange }: {
  tasks: PlanTask[];
  onTaskStatusChange: (index: number, status: "pending" | "in-progress" | "done") => void;
}) {
  const completed = tasks.filter(t => t.status === "done").length;
  const inProgress = tasks.filter(t => t.status === "in-progress").length;
  const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

  return (
    <div className="border-b border-[var(--ide-border)] bg-[var(--ide-bg)]/80 shrink-0">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#7C65CB]" />
            <span className="text-[10px] font-semibold text-[var(--ide-text)] uppercase tracking-wider">Build Progress</span>
          </div>
          <span className="text-[10px] text-[var(--ide-text-muted)]">
            {completed}/{tasks.length} done
            {inProgress > 0 && ` · ${inProgress} active`}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7C65CB] to-[#0CCE6B] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="px-3 pb-2 max-h-[120px] overflow-y-auto space-y-0.5">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5 text-[10px] group">
            <button
              className="shrink-0 hover:opacity-70 transition-opacity"
              onClick={() => {
                const nextStatus = task.status === "pending" ? "in-progress" : task.status === "in-progress" ? "done" : "pending";
                onTaskStatusChange(i, nextStatus);
              }}
              title={`Click to change status (${task.status})`}
              data-testid={`button-task-status-${i}`}
            >
              {task.status === "done" ? (
                <CheckCircle2 className="w-3 h-3 text-[#0CCE6B]" />
              ) : task.status === "in-progress" ? (
                <Clock className="w-3 h-3 text-[#F59E0B] animate-pulse" />
              ) : (
                <Circle className="w-3 h-3 text-[var(--ide-text-muted)]" />
              )}
            </button>
            <span className={`truncate ${task.status === "done" ? "text-[var(--ide-text-muted)] line-through" : "text-[var(--ide-text-secondary)]"}`}>
              {task.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposedTaskCard({ task, index }: { task: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] overflow-hidden transition-all hover:border-[var(--ide-text-muted)]/30" data-testid={`proposed-task-${index}`}>
      <div className="flex items-center gap-2.5 p-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <circle cx="5.332" cy="5.338" r="5.332" fill="#A6A6A6" />
          <circle cx="18.663" cy="5.338" r="5.332" fill="#A6A6A6" />
          <circle cx="5.332" cy="18.668" r="5.332" fill="#A6A6A6" />
          <circle cx="18.663" cy="18.668" r="5.332" fill="#A6A6A6" />
        </svg>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-medium text-[var(--ide-text)] truncate">{task.title}</h4>
          {task.description && <p className="text-[12px] text-[var(--ide-text-muted)] mt-0.5 line-clamp-2">{task.description}</p>}
        </div>
        {task.plan && task.plan.length > 0 && (
          <button
            className="text-[11px] text-[#009118] hover:text-[#006B12] shrink-0 px-2 py-1 rounded hover:bg-[#009118]/10 transition-colors"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? "Hide plan" : "View plan"}
          </button>
        )}
      </div>
      {expanded && task.plan && task.plan.length > 0 && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--ide-border)]">
          <div className="pt-2 space-y-1">
            {(task.plan as string[]).map((step: string, j: number) => (
              <div key={j} className="flex items-start gap-2 text-[12px] text-[var(--ide-text-secondary)] py-0.5">
                <span className="w-4 h-4 rounded-full bg-[var(--ide-bg)] text-[var(--ide-text-muted)] text-[9px] font-medium flex items-center justify-center shrink-0 mt-0.5">{j + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="px-3 pb-2 text-[11px] text-[var(--ide-text-muted)]">
        Draft {task.dependsOn && task.dependsOn.length > 0 ? `\u2022 Depends on task ${task.dependsOn.map((d: any) => Number(d) + 1).join(", ")}` : ""}
      </div>
    </div>
  );
}

function WebSearchIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-1" data-testid="web-search-indicator">
      <div className="w-5 h-5 rounded-full bg-[#0079F2]/15 flex items-center justify-center">
        <Globe className="w-3 h-3 text-[#0079F2] animate-pulse" />
      </div>
      <span className="text-[11px] text-[#0079F2] font-medium">{label}</span>
      <span className="flex items-center gap-[3px]">
        <span className="w-[4px] h-[4px] rounded-full bg-[#0079F2] animate-[bounce-dot_1.4s_ease-in-out_infinite]" />
        <span className="w-[4px] h-[4px] rounded-full bg-[#0079F2] animate-[bounce-dot_1.4s_ease-in-out_0.2s_infinite]" style={{ animationDelay: "0.2s" }} />
        <span className="w-[4px] h-[4px] rounded-full bg-[#0079F2] animate-[bounce-dot_1.4s_ease-in-out_0.4s_infinite]" style={{ animationDelay: "0.4s" }} />
      </span>
    </div>
  );
}

type VoiceOption = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
const VOICE_OPTIONS: { value: VoiceOption; label: string; desc: string }[] = [
  { value: "alloy", label: "Alloy", desc: "Neutral & balanced" },
  { value: "echo", label: "Echo", desc: "Warm & clear" },
  { value: "fable", label: "Fable", desc: "Expressive & British" },
  { value: "onyx", label: "Onyx", desc: "Deep & authoritative" },
  { value: "nova", label: "Nova", desc: "Friendly & upbeat" },
  { value: "shimmer", label: "Shimmer", desc: "Soft & gentle" },
];

function decodePCM16ToFloat32(base64Audio: string): Float32Array {
  const raw = atob(base64Audio);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}

function pcmChunksToWavBlob(chunks: string[]): Blob {
  let totalSamples = 0;
  const decodedChunks: Int16Array[] = [];
  for (const chunk of chunks) {
    const raw = atob(chunk);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    decodedChunks.push(pcm);
    totalSamples += pcm.length;
  }
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = totalSamples * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (const pcm of decodedChunks) {
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(offset, pcm[i], true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function InlineAudioPlayer({ audioChunks, messageId }: { audioChunks: string[]; messageId: string }) {
  const [playState, setPlayState] = useState<"idle" | "playing" | "ended">("idle");
  const ctxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const readyRef = useRef(false);
  const playIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progress, setProgress] = useState(0);

  const initAudio = useCallback(async () => {
    if (readyRef.current && ctxRef.current) {
      if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
      return;
    }
    const ctx = new AudioContext({ sampleRate: 24000 });
    if (ctx.state === "suspended") await ctx.resume();
    await ctx.audioWorklet.addModule("/audio-playback-worklet.js");
    const worklet = new AudioWorkletNode(ctx, "audio-playback-processor");
    worklet.connect(ctx.destination);
    worklet.port.onmessage = (e) => {
      if (e.data.type === "ended") {
        setPlayState("ended");
        setProgress(100);
      }
    };
    ctxRef.current = ctx;
    workletRef.current = worklet;
    readyRef.current = true;
  }, []);

  const play = useCallback(async () => {
    await initAudio();
    if (!workletRef.current) return;
    workletRef.current.port.postMessage({ type: "clear" });
    playIndexRef.current = 0;
    setProgress(0);
    setPlayState("playing");
    for (let i = 0; i < audioChunks.length; i++) {
      const samples = decodePCM16ToFloat32(audioChunks[i]);
      workletRef.current.port.postMessage({ type: "audio", samples });
    }
    workletRef.current.port.postMessage({ type: "streamComplete" });
    if (intervalRef.current) clearInterval(intervalRef.current);
    const totalDuration = audioChunks.length * 50;
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / totalDuration) * 100, 99);
      setProgress(pct);
    }, 100);
  }, [audioChunks, initAudio]);

  const stop = useCallback(() => {
    workletRef.current?.port.postMessage({ type: "clear" });
    setPlayState("idle");
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const download = useCallback(() => {
    const blob = pcmChunksToWavBlob(audioChunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audio-response-${messageId.slice(0, 8)}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audioChunks, messageId]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      workletRef.current?.port.postMessage({ type: "clear" });
    };
  }, []);

  if (!audioChunks || audioChunks.length === 0) return null;

  return (
    <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#7C65CB]/8 border border-[#7C65CB]/20" data-testid={`audio-player-${messageId}`}>
      <button
        onClick={playState === "playing" ? stop : play}
        className="w-7 h-7 rounded-full flex items-center justify-center bg-[#7C65CB] hover:bg-[#6B56B8] text-white transition-colors shrink-0"
        data-testid={`button-audio-play-${messageId}`}
      >
        {playState === "playing" ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#7C65CB] transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Volume2 className="w-3 h-3 text-[#7C65CB]" />
        <span className="text-[9px] text-[var(--ide-text-muted)]">Audio</span>
      </div>
      <button
        onClick={download}
        className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10 transition-all"
        title="Download audio"
        data-testid={`button-audio-download-${messageId}`}
      >
        <Download className="w-3 h-3" />
      </button>
    </div>
  );
}

class AIPanelErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[var(--ide-panel)] p-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
            <Bug className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-1" data-testid="text-ai-error-title">AI Panel Error</h3>
          <p className="text-xs text-[var(--ide-text-muted)] mb-4 text-center max-w-[260px]">
            {this.state.error?.message || "Something went wrong in the AI panel."}
          </p>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-xs font-medium transition-colors"
              onClick={() => this.setState({ hasError: false, error: null })}
              data-testid="button-ai-retry"
            >
              Try Again
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-[var(--ide-surface)] hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)] text-xs font-medium transition-colors"
              onClick={this.props.onClose}
              data-testid="button-ai-close-error"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function parsePlanFromResponse(content: string): { title: string; tasks: PlanTask[] } | null {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[1].trim());
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) return null;
    return {
      title: parsed.title || "Untitled Plan",
      tasks: parsed.tasks.map((t: any, i: number) => ({
        title: t.title || `Task ${i + 1}`,
        description: t.description || "",
        complexity: ["simple", "medium", "complex"].includes(t.complexity) ? t.complexity : "medium",
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
        status: "pending" as const,
        sortOrder: i,
      })),
    };
  } catch {
    return null;
  }
}

function AIPanelInner({ context, onClose, projectId, files, onFileCreated, onFileUpdated, onApplyCode, pendingMessage, onPendingMessageConsumed, onAgentComplete, onCanvasFrameCreate, onConvertFrame, canvasFrames, hideInput, onExternalInput }: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [model, setModel] = useState<AIModel>("gpt");
  const [openrouterModel, setOpenrouterModel] = useState<string>("meta-llama/llama-3.3-70b-instruct");
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModel[]>([]);
  const [openrouterSearch, setOpenrouterSearch] = useState("");
  const [openrouterLoading, setOpenrouterLoading] = useState(false);
  const [showOpenrouterPicker, setShowOpenrouterPicker] = useState(false);
  const [mode, setMode] = useState<AIMode>(projectId ? "agent" : "chat");
  const [agentMode, setAgentMode] = useState<AgentMode>(() => {
    try { return (localStorage.getItem("ai-agent-mode") as AgentMode) || "economy"; } catch { return "economy"; }
  });
  const [topAgentMode, setTopAgentMode] = useState<TopAgentMode>(() => {
    try {
      const stored = localStorage.getItem("ai-top-agent-mode");
      if (stored && ["lite", "autonomous", "max"].includes(stored)) return stored as TopAgentMode;
    } catch {}
    return "autonomous";
  });
  const [autonomousTier, setAutonomousTier] = useState<AutonomousTier>(() => {
    try {
      const stored = localStorage.getItem("ai-autonomous-tier");
      if (stored && ["economy", "power"].includes(stored)) return stored as AutonomousTier;
    } catch {}
    return "economy";
  });
  const [topMode, setTopMode] = useState<TopMode>("build");
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [codeOptimizations, setCodeOptimizations] = useState(() => {
    try { return localStorage.getItem("ai-code-optimizations") === "true"; } catch { return false; }
  });
  const [liteMode, setLiteMode] = useState(false);
  const [agentToolsConfig, setAgentToolsConfig] = useState<AgentToolsConfig>({
    liteMode: false, webSearch: true, appTesting: false, codeOptimizations: false, architect: false, turbo: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [credentialModes, setCredentialModes] = useState<Record<string, { mode: string; hasApiKey: boolean; configured: boolean }>>({});
  const [showManagedApproval, setShowManagedApproval] = useState<{ provider: string; providerLabel: string } | null>(null);
  const [audioOutputEnabled, setAudioOutputEnabled] = useState(() => {
    try { return localStorage.getItem("ai-audio-output") === "true"; } catch { return false; }
  });
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(() => {
    try { return (localStorage.getItem("ai-voice") as VoiceOption) || "alloy"; } catch { return "alloy"; }
  });
  const [isAudioStreaming, setIsAudioStreaming] = useState(false);
  const [readAloudMsgId, setReadAloudMsgId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const audioReadyRef = useRef(false);
  const audioAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/user/usage", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUserPlan(data.plan || "free");
          if (data.agentMode) {
            setAgentMode(data.agentMode as AgentMode);
            try { localStorage.setItem("ai-agent-mode", data.agentMode); } catch {}
          }
          if (typeof data.codeOptimizationsEnabled === "boolean") {
            setCodeOptimizations(data.codeOptimizationsEnabled);
            try { localStorage.setItem("ai-code-optimizations", String(data.codeOptimizationsEnabled)); } catch {}
          }
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/ai-credentials`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: { provider: string; mode: string; hasApiKey: boolean; configured: boolean }[]) => {
        const map: Record<string, { mode: string; hasApiKey: boolean; configured: boolean }> = {};
        data.forEach(d => { map[d.provider] = { mode: d.mode, hasApiKey: d.hasApiKey, configured: d.configured }; });
        setCredentialModes(map);
      })
      .catch(() => {});
  }, [projectId]);

  const getCredLabel = (aiModel: AIModel): { text: string; isManaged: boolean } => {
    const providerMap: Record<AIModel, string> = { claude: "anthropic", gpt: "openai", gemini: "google", openrouter: "openrouter", perplexity: "perplexity", mistral: "mistral" };
    const provider = providerMap[aiModel];
    const cfg = credentialModes[provider];
    if (!cfg || cfg.mode === "managed") return { text: "Vibe Companion managed", isManaged: true };
    return { text: cfg.hasApiKey ? "Your key" : "BYOK (no key set)", isManaged: false };
  };

  const handleApproveManaged = async (provider: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-credentials/${provider}/approve-managed`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(getCsrfToken() ? { "x-csrf-token": getCsrfToken()! } : {}) } as HeadersInit,
      });
      if (res.ok) {
        setCredentialModes(prev => ({ ...prev, [provider]: { mode: "managed", hasApiKey: false, configured: true } }));
      }
    } catch {}
    setShowManagedApproval(null);
  };

  const [byokKeyInput, setByokKeyInput] = useState("");
  const BYOK_SECRET_NAMES: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  const handleDismissManaged = async (provider: string) => {
    if (!projectId) { setShowManagedApproval(null); return; }
    try {
      if (byokKeyInput.trim()) {
        const secretKey = BYOK_SECRET_NAMES[provider];
        if (secretKey) {
          await fetch(`/api/projects/${projectId}/env-vars`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...(getCsrfToken() ? { "x-csrf-token": getCsrfToken()! } : {}) } as HeadersInit,
            body: JSON.stringify({ key: secretKey, value: byokKeyInput.trim() }),
          });
        }
      }
      const res = await fetch(`/api/projects/${projectId}/ai-credentials/${provider}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(getCsrfToken() ? { "x-csrf-token": getCsrfToken()! } : {}) } as HeadersInit,
        body: JSON.stringify({ mode: "byok" }),
      });
      if (res.ok) {
        const hasKey = !!byokKeyInput.trim();
        setCredentialModes(prev => ({ ...prev, [provider]: { mode: "byok", hasApiKey: hasKey || prev[provider]?.hasApiKey || false, configured: true } }));
      }
    } catch {}
    setByokKeyInput("");
    setShowManagedApproval(null);
  };

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [planLoading, setPlanLoading] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<any[]>([]);
  const [showTaskBoard, setShowTaskBoard] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMsg[]>([]);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueContent, setEditingQueueContent] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const processingQueueRef = useRef(false);
  const pausedRef = useRef(false);
  const [selectedArtifactType, setSelectedArtifactType] = useState<string | null>(null);
  const [ecodeStatus, setEcodeStatus] = useState<{ exists: boolean; fileId: string | null }>({ exists: false, fileId: null });
  const [ecodeGenerating, setEcodeGenerating] = useState(false);
  const [ecodeLastUpdated, setEcodeLastUpdated] = useState<string | null>(null);
  const [ecodeRefreshing, setEcodeRefreshing] = useState(false);
  const [planMessages, setPlanMessages] = useState<ChatMessage[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [approvedPlanTasks, setApprovedPlanTasks] = useState<PlanTask[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItemRef = useRef<number | null>(null);
  const [figmaConnection, setFigmaConnection] = useState<{ connected: boolean; username?: string; plan?: string; callsUsed?: number; callsLimit?: number; callsRemaining?: number }>({ connected: false });
  const [detectedFigmaUrl, setDetectedFigmaUrl] = useState<string | null>(null);
  const [figmaMcpEvents, setFigmaMcpEvents] = useState<{ id: string; tool: string; timestamp: number; input?: Record<string, any>; output?: string; error?: string; duration?: number }[]>([]);
  const [showFigmaCard, setShowFigmaCard] = useState(false);

  useEffect(() => {
    fetch("/api/figma/connection", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.connected) {
          setFigmaConnection(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const url = detectFigmaUrl(input);
    setDetectedFigmaUrl(url);
    if (url && !showFigmaCard) {
      setShowFigmaCard(true);
    }
  }, [input]);

  const handleFigmaConnect = useCallback(() => {
    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      "/api/figma/oauth/authorize",
      "figma-oauth",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        fetch("/api/figma/connection", { credentials: "include" })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setFigmaConnection(data); })
          .catch(() => {});
      }
    }, 500);
  }, []);

  const handleFigmaDisconnect = useCallback(async () => {
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      await fetch("/api/figma/disconnect", { method: "POST", headers, credentials: "include" });
      setFigmaConnection({ connected: false });
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/user/preferences", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs?.agentToolsConfig) {
          const cfg = prefs.agentToolsConfig;
          setAgentToolsConfig(prev => ({ ...prev, ...cfg }));
          setLiteMode(!!cfg.liteMode);
          setCodeOptimizations(!!cfg.codeOptimizations);
          try { localStorage.setItem("ai-code-optimizations", String(!!cfg.codeOptimizations)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const updateAgentToolsConfig = useCallback((updates: Partial<AgentToolsConfig>) => {
    setAgentToolsConfig(prev => {
      const next = { ...prev, ...updates };
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      fetch("/api/user/preferences", {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ agentToolsConfig: next }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const [openrouterError, setOpenrouterError] = useState<string | null>(null);

  useEffect(() => {
    if (model !== "openrouter" || openrouterModels.length > 0) return;
    setOpenrouterLoading(true);
    setOpenrouterError(null);
    fetch("/api/ai/openrouter/models", { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Failed to load models");
        return r.json();
      })
      .then(data => {
        if (data?.models) setOpenrouterModels(data.models);
        else setOpenrouterError("No models returned");
      })
      .catch((err) => {
        setOpenrouterError(err.message || "Failed to load OpenRouter models");
      })
      .finally(() => setOpenrouterLoading(false));
  }, [model]);

  useEffect(() => {
    if (!projectId) { setConversationLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ai/conversations/${projectId}`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.conversation) {
          if (data.conversation.model) setModel(data.conversation.model as AIModel);
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages.map((m: { id: string; role: string; content: string; model?: string; fileOps?: { type: "created" | "updated"; filename: string }[] }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              model: (m.model || undefined) as AIModel | undefined,
              fileOps: m.fileOps || undefined,
            })));
          }
        }
      } catch {}
      setConversationLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const queueRes = await fetch(`/api/ai/queue/${projectId}`, { credentials: "include" });
        if (queueRes.ok) {
          const queueData = await queueRes.json();
          if (Array.isArray(queueData) && queueData.length > 0) {
            setQueuedMessages(queueData.map((m: any) => ({ id: m.id, content: m.content, attachments: m.attachments, position: m.position, status: m.status })));
            setIsQueueDrawerOpen(true);
          }
        }
        const res = await fetch(`/api/ai/plans/${projectId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.plan && data.tasks) {
            const mappedTasks: PlanTask[] = data.tasks.map((t: { id: string; title: string; description: string; complexity?: string; dependsOn: string[] | null; status: string; sortOrder: number }) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              complexity: (t.complexity as "simple" | "medium" | "complex") || "medium",
              dependsOn: (t.dependsOn || []).map(Number),
              status: t.status as "pending" | "in-progress" | "done",
              sortOrder: t.sortOrder,
            }));
            setCurrentPlan({
              id: data.plan.id,
              title: data.plan.title,
              status: data.plan.status,
              model: data.plan.model,
              tasks: mappedTasks,
            });
            if (data.plan.status === "approved") {
              setApprovedPlanTasks(mappedTasks);
            }
          }
          if (data.messages && data.messages.length > 0) {
            setPlanMessages(data.messages.map((m: { id: string; role: string; content: string; model: string | null }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              model: (m.model || undefined) as AIModel | undefined,
            })));
          }
        }
      } catch {}
    })();
  }, [projectId]);

  const addToQueue = useCallback(async (content: string, msgAttachments?: Attachment[]) => {
    if (!projectId || !content.trim()) return;
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch(`/api/ai/queue/${projectId}`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ content, attachments: msgAttachments || null }),
      });
      if (res.ok) {
        const msg = await res.json();
        setQueuedMessages(prev => [...prev, { id: msg.id, content: msg.content, attachments: msg.attachments, position: msg.position, status: msg.status }]);
        setIsQueueDrawerOpen(true);
      }
    } catch {}
  }, [projectId]);

  const removeFromQueue = useCallback(async (id: string) => {
    if (!projectId) return;
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      await fetch(`/api/ai/queue/${projectId}/${id}`, { method: "DELETE", headers, credentials: "include" });
      setQueuedMessages(prev => {
        const next = prev.filter(m => m.id !== id);
        if (next.length === 0) setIsQueueDrawerOpen(false);
        return next;
      });
    } catch {}
  }, [projectId]);

  const updateQueueItem = useCallback(async (id: string, content: string) => {
    if (!projectId) return;
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch(`/api/ai/queue/${projectId}/${id}`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQueuedMessages(prev => prev.map(m => m.id === id ? { ...m, content: updated.content } : m));
      }
    } catch {}
    setEditingQueueId(null);
  }, [projectId]);

  const reorderQueue = useCallback(async (fromIdx: number, toIdx: number) => {
    if (!projectId || fromIdx === toIdx) return;
    setQueuedMessages(prev => {
      const items = [...prev];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      const updated = items.map((m, i) => ({ ...m, position: i }));
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      fetch(`/api/ai/queue/${projectId}/reorder`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ updates: updated.map(m => ({ id: m.id, position: m.position })) }),
      }).catch(() => {});
      return updated;
    });
  }, [projectId]);

  const clearQueue = useCallback(async () => {
    if (!projectId) return;
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      await fetch(`/api/ai/queue/${projectId}`, { method: "DELETE", headers, credentials: "include" });
      setQueuedMessages([]);
      setIsQueueDrawerOpen(false);
    } catch {}
  }, [projectId]);

  const persistMessage = useCallback(async (role: string, content: string, msgModel?: string, fileOps?: { type: "created" | "updated"; filename: string }[] | null) => {
    if (!projectId || !content) return;
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      await fetch(`/api/ai/conversations/${projectId}/messages`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ role, content, model: msgModel || null, fileOps: fileOps || null }),
      });
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, planMessages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationLoaded, topMode]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  useEffect(() => {
    if (pendingMessage && conversationLoaded && !isStreaming) {
      setInput(pendingMessage);
      onPendingMessageConsumed?.();
    }
  }, [pendingMessage, conversationLoaded, isStreaming]);

  const processSSEStream = useCallback(async (
    response: Response,
    assistantId: string,
    isAgent: boolean,
    setMsgs: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    currentModel?: AIModel
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No stream");

    const decoder = new TextDecoder();
    let buffer = "";
    const fileOps: { type: "created" | "updated"; filename: string }[] = [];
    const inlineImages: { filename: string; dataUri: string }[] = [];
    const generatedFiles: GeneratedFile[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (isAgent) {
            if (data.type === "text") {
              setMsgs((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.content } : m)
              );
            } else if (data.type === "file_generated") {
              generatedFiles.push({
                filename: data.filename,
                format: data.format,
                downloadUrl: data.downloadUrl,
                mimeType: data.mimeType,
                size: data.size,
              });
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  content: m.content + `\n\n> Generated \`${data.filename}\`\n`,
                  generatedFiles: [...(m.generatedFiles || []), {
                    filename: data.filename,
                    format: data.format,
                    downloadUrl: data.downloadUrl,
                    mimeType: data.mimeType,
                    size: data.size,
                  }],
                } : m)
              );
            } else if (data.type === "tool_use") {
              let toolMsg: string;
              if (data.name === "create_skill") {
                toolMsg = `\n\n> Creating skill...\n`;
              } else if (data.name === "generate_image") {
                toolMsg = `\n\n> Generating image \`${data.input.filename}\`...\n`;
              } else if (data.name === "edit_image") {
                toolMsg = `\n\n> Editing image \`${data.input.filename}\`...\n`;
              } else if (data.name === "generate_file") {
                toolMsg = `\n\n> Generating file \`${data.input.filename}\`...\n`;
              } else if (data.name === "web_search") {
                toolMsg = `\n\n> 🔍 Searching the web...\n`;
              } else if (data.name === "fetch_url") {
                toolMsg = `\n\n> 🌐 Fetching content...\n`;
              } else if (data.name === "brave_image_search") {
                toolMsg = `\n\n> 🖼️ Searching for images...\n`;
              } else if (data.name === "text_to_speech") {
                toolMsg = `\n\n> 🔊 Generating speech...\n`;
              } else if (data.name === "generate_ai_image") {
                toolMsg = `\n\n> 🎨 Generating AI image...\n`;
              } else if (data.name?.startsWith("mcp__")) {
                toolMsg = `\n\n> 🔧 Calling MCP tool \`${data.name}\`...\n`;
              } else {
                const opLabel = data.name === "create_file" ? "Creating" : "Editing";
                toolMsg = `\n\n> ${opLabel} \`${data.input.filename}\`...\n`;
              }
              setMsgs((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  content: m.content + toolMsg
                } : m)
              );
            } else if (data.type === "web_search_results") {
              if (data.results && data.results.length > 0) {
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? {
                    ...m,
                    webSearchResults: [...(m.webSearchResults || []), ...data.results],
                  } : m)
                );
              }
            } else if (data.type === "image_search_results") {
              if (data.results && data.results.length > 0) {
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? {
                    ...m,
                    imageSearchResults: [...(m.imageSearchResults || []), ...data.results],
                  } : m)
                );
              }
            } else if (data.type === "tavily_search_results") {
              const mappedResults = (data.results || []).map((r: { title: string; url: string; content: string }) => ({
                title: r.title,
                url: r.url,
                snippet: r.content,
              }));
              if (mappedResults.length > 0 || data.answer) {
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? {
                    ...m,
                    ...(mappedResults.length > 0 ? { webSearchResults: [...(m.webSearchResults || []), ...mappedResults] } : {}),
                    ...(data.answer ? { tavilyAnswer: data.answer } : {}),
                  } : m)
                );
              }
            } else if (data.type === "tts_audio_generated") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  generatedAudio: [...(m.generatedAudio || []), {
                    audioDataUri: data.audio,
                    voiceName: data.voiceName,
                    durationEstimate: data.durationEstimate,
                    textLength: data.textLength,
                    mimeType: data.mimeType,
                  }],
                } : m)
              );
            } else if (data.type === "ai_image_generated") {
              if (data.imageDataUri) {
                inlineImages.push({ filename: data.filename || "ai-generated.png", dataUri: data.imageDataUri });
              }
            } else if (data.type === "web_fetch_result") {
            } else if (data.type === "mcp_tool_use" || data.type === "mcp_tool_call") {
              const isFigmaTool = data.name?.startsWith("mcp__figma__");
              if (isFigmaTool) {
                const toolName = data.name?.replace(/^mcp__figma__/, "") || data.name;
                const eventId = data.callId || `figma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                setFigmaMcpEvents(prev => [...prev, {
                  id: eventId,
                  tool: toolName,
                  timestamp: Date.now(),
                  input: data.input || {},
                }]);
              }
              const toolDisplayName = data.originalName || data.name || "unknown";
              const callId = data.callId || `mcp_${Date.now()}`;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  mcpToolCalls: [...(m.mcpToolCalls || []), { callId, name: toolDisplayName, serverId: data.serverId, args: data.args, status: "running" as const }],
                } : m)
              );
            } else if (data.type === "mcp_tool_result") {
              const isFigmaResult = data.name?.startsWith("mcp__figma__") || data.serverName === "figma";
              if (isFigmaResult) {
                setFigmaMcpEvents(prev => {
                  const updated = [...prev];
                  const targetEvent = data.callId
                    ? updated.find(e => e.id === data.callId)
                    : [...updated].reverse().find(e => !e.output && !e.error);
                  if (targetEvent) {
                    targetEvent.output = data.result || "";
                    targetEvent.error = data.error || undefined;
                    targetEvent.duration = Date.now() - targetEvent.timestamp;
                  }
                  return updated;
                });
                if (figmaConnection.callsUsed != null) {
                  setFigmaConnection(prev => ({
                    ...prev,
                    callsUsed: (prev.callsUsed || 0) + 1,
                    callsRemaining: Math.max((prev.callsRemaining || 0) - 1, 0),
                  }));
                }
              }
              const resultPreview = data.result ? data.result.slice(0, 500) : data.error || "";
              const resultCallId = data.callId;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  mcpToolCalls: (m.mcpToolCalls || []).map((tc: McpToolCall) =>
                    (resultCallId && tc.callId === resultCallId) || (!resultCallId && tc.status === "running")
                      ? { ...tc, status: (data.error ? "error" : "complete") as McpToolCall["status"], result: resultPreview }
                      : tc
                  ),
                } : m)
              );
            } else if (data.type === "file_created") {
              fileOps.push({ type: "created", filename: data.file.filename });
              if (data.imageData) {
                inlineImages.push({ filename: data.file.filename, dataUri: data.imageData });
              }
              if (data.file.filename === "ecode.md") {
                setEcodeStatus({ exists: true, fileId: data.file.id || null });
              }
              onFileCreated?.(data.file);
            } else if (data.type === "ecode_updated") {
              setEcodeStatus({ exists: true, fileId: data.file?.id || null });
              setEcodeLastUpdated(new Date().toISOString());
              onFileUpdated?.(data.file);
            } else if (data.type === "file_updated") {
              fileOps.push({ type: "updated", filename: data.file.filename });
              if (data.imageData) {
                inlineImages.push({ filename: data.file.filename, dataUri: data.imageData });
              }
              onFileUpdated?.(data.file);
            } else if (data.type === "skill_created") {
              setMsgs((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  content: m.content + `\n\n> Created skill: **${data.skill.name}**\n`
                } : m)
              );
            } else if (data.type === "task_progress" && data.taskId && data.status) {
              const taskStatus = data.status as "pending" | "in-progress" | "done";
              setCurrentPlan((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  tasks: prev.tasks.map((t) => t.id === data.taskId ? { ...t, status: taskStatus } : t),
                };
              });
              setApprovedPlanTasks((prev) =>
                (prev || []).map((t) => t.id === data.taskId ? { ...t, status: taskStatus } : t)
              );
            } else if (data.type === "error") {
              setMsgs((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + `\n\nError: ${data.message}` } : m)
              );
            }
            if (data.byokNoKey && currentModel) {
              const providerLabels: Record<string, string> = { anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT-4o)", google: "Google (Gemini)", openrouter: "OpenRouter" };
              const providerMap: Record<AIModel, string> = { claude: "anthropic", gpt: "openai", gemini: "google", openrouter: "openrouter", perplexity: "perplexity", mistral: "mistral" };
              const cp = providerMap[currentModel];
              setShowManagedApproval({ provider: cp, providerLabel: providerLabels[cp] || cp });
            }
          } else {
            if (data.content) {
              setMsgs((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.content } : m)
              );
            }
            if (data.byokNoKey && currentModel) {
              const providerLabels: Record<string, string> = { anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT-4o)", google: "Google (Gemini)", openrouter: "OpenRouter" };
              const providerMap: Record<AIModel, string> = { claude: "anthropic", gpt: "openai", gemini: "google", openrouter: "openrouter", perplexity: "perplexity", mistral: "mistral" };
              const cp = providerMap[currentModel];
              setShowManagedApproval({ provider: cp, providerLabel: providerLabels[cp] || cp });
            }
          }
        } catch {}
      }
    }

    if (fileOps.length > 0 || inlineImages.length > 0) {
      setMsgs((prev) =>
        prev.map((m) => m.id === assistantId ? {
          ...m,
          ...(fileOps.length > 0 ? { fileOps } : {}),
          ...(inlineImages.length > 0 ? { inlineImages } : {}),
        } : m)
      );
    }
  }, [onFileCreated, onFileUpdated]);

  const submitPlanMode = async () => {
    if (!input.trim() || planLoading || !projectId) return;
    setPlanLoading(true);
    setProposedTasks([]);
    try {
      const ct = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ct) headers["X-CSRF-Token"] = ct;
      const res = await fetch(`/api/projects/${projectId}/tasks/propose`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ prompt: input.trim(), model }),
      });
      if (!res.ok) throw new Error("Failed to propose tasks");
      const data = await res.json();
      setProposedTasks(data.tasks || []);
      setInput("");
    } catch (err) {
      const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input.trim() };
      const errMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: "Failed to generate task plan. Please try again." };
      setMessages(prev => [...prev, userMsg, errMsg]);
    } finally {
      setPlanLoading(false);
    }
  };

  const acceptProposedTasks = async () => {
    if (!projectId || proposedTasks.length === 0) return;
    try {
      const ct = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ct) headers["X-CSRF-Token"] = ct;
      const taskIds = proposedTasks.map(t => t.id);
      await fetch(`/api/projects/${projectId}/tasks/bulk-accept`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ taskIds }),
      });
      setProposedTasks([]);
      setShowTaskBoard(true);
    } catch {}
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const processPlanSSEStream = useCallback(async (
    response: Response,
    assistantId: string,
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            setPlanMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: m.content + data.content } : m)
            );
          } else if (data.type === "plan_created" && data.plan && data.tasks) {
            const mappedTasks: PlanTask[] = data.tasks.map((t: { id: string; title: string; description: string; complexity?: string; dependsOn: string[] | null; status: string; sortOrder: number }) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              complexity: (t.complexity as "simple" | "medium" | "complex") || "medium",
              dependsOn: (t.dependsOn || []).map(Number),
              status: t.status as "pending" | "in-progress" | "done",
              sortOrder: t.sortOrder,
            }));
            setCurrentPlan({
              id: data.plan.id,
              title: data.plan.title,
              status: data.plan.status,
              model: data.plan.model,
              tasks: mappedTasks,
            });
          }
        } catch {}
      }
    }
  }, []);

  const sendPlanMessage = async () => {
    if (!input.trim() || isStreaming || !projectId) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input.trim() };
    const allPlanMessages = [...planMessages, userMsg];
    setPlanMessages(allPlanMessages);
    setInput("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setPlanMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", model }]);

    abortRef.current = new AbortController();

    try {
      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const csrfToken = getCsrfToken();
      if (csrfToken) fetchHeaders["X-CSRF-Token"] = csrfToken;

      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: fetchHeaders,
        credentials: "include",
        body: JSON.stringify({
          messages: allPlanMessages.map((m) => ({ role: m.role, content: m.content })),
          model,
          projectId,
          ...(model === "openrouter" ? { openrouterModel } : {}),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.message || errBody?.error || `HTTP ${res.status}`;
        throw new Error(`AI plan request failed: ${detail}`);
      }

      await processPlanSSEStream(res, assistantId);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[AIPanel] Plan request error:", err.message);
        setPlanMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ ${err.message}` } : m)
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const initAudioPlayback = useCallback(async () => {
    if (audioReadyRef.current && audioCtxRef.current) {
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      return;
    }
    const ctx = new AudioContext({ sampleRate: 24000 });
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    await ctx.audioWorklet.addModule("/audio-playback-worklet.js");
    const worklet = new AudioWorkletNode(ctx, "audio-playback-processor");
    worklet.connect(ctx.destination);
    worklet.port.onmessage = (e) => {
      if (e.data.type === "ended") {
        setIsAudioStreaming(false);
        setReadAloudMsgId(null);
      }
    };
    audioCtxRef.current = ctx;
    audioWorkletRef.current = worklet;
    audioReadyRef.current = true;
  }, []);

  const stopAudioPlayback = useCallback(() => {
    audioWorkletRef.current?.port.postMessage({ type: "clear" });
    audioAbortRef.current?.abort();
    setIsAudioStreaming(false);
    setReadAloudMsgId(null);
  }, []);

  const readAloud = useCallback(async (text: string, msgId: string) => {
    if (isAudioStreaming) {
      stopAudioPlayback();
      if (readAloudMsgId === msgId) return;
    }

    await initAudioPlayback();
    if (!audioWorkletRef.current) return;

    audioWorkletRef.current.port.postMessage({ type: "clear" });
    setIsAudioStreaming(true);
    setReadAloudMsgId(msgId);

    audioAbortRef.current = new AbortController();
    const collectedChunks: string[] = [];

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const response = await fetch("/api/ai/tts", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ text, voice: selectedVoice }),
        signal: audioAbortRef.current.signal,
      });

      if (!response.ok) throw new Error("TTS request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "audio" && audioWorkletRef.current) {
              collectedChunks.push(event.data);
              const samples = decodePCM16ToFloat32(event.data);
              audioWorkletRef.current.port.postMessage({ type: "audio", samples });
            } else if (event.type === "done") {
              audioWorkletRef.current?.port.postMessage({ type: "streamComplete" });
              setMessages((prev) =>
                prev.map((m) => m.id === msgId ? { ...m, audioChunks: collectedChunks } : m)
              );
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("TTS error:", err);
      }
      setIsAudioStreaming(false);
      setReadAloudMsgId(null);
    }
  }, [isAudioStreaming, readAloudMsgId, selectedVoice, initAudioPlayback, stopAudioPlayback]);

  const sendMessageDirect = useCallback(async (content: string, currentAttachments: Attachment[] = []) => {
    let fullContent = content;

    if (currentAttachments.length > 0) {
      const attachmentDescriptions = currentAttachments.map((a) => {
        if (a.type === "image") {
          return `[Attached image: ${a.name} (${formatFileSize(a.size)})]`;
        } else if (a.type === "text") {
          return `[Attached file: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``;
        }
        return `[Attached file: ${a.name} (${formatFileSize(a.size)})]`;
      });
      fullContent = (fullContent ? fullContent + "\n\n" : "") + attachmentDescriptions.join("\n\n");
    }

    if (onConvertFrame && canvasFrames && canvasFrames.length > 0) {
      const convertMatch = content.match(/convert\s+(?:this\s+)?(?:frame\s+)?(?:["']?(.+?)["']?\s+)?(?:to|into)\s+(?:a\s+|an\s+)?(\w[\w\s]*)/i);
      if (convertMatch) {
        const targetType = convertMatch[2]?.trim().toLowerCase().replace(/\s+app$/, "") || "react";
        const frameName = convertMatch[1]?.trim();
        const frame = frameName
          ? canvasFrames.find(f => f.name.toLowerCase().includes(frameName.toLowerCase()))
          : canvasFrames[canvasFrames.length - 1];
        if (frame) {
          onConvertFrame(frame.id, frame.name, targetType);
          const confirmMsg: ChatMessage = { id: Date.now().toString(), role: "assistant", content: `Starting conversion of frame "${frame.name}" to a ${targetType} app. The conversion dialog should now be open.` };
          setMessages((prev) => [...prev, { id: (Date.now() - 1).toString(), role: "user", content }, confirmMsg]);
          return;
        }
      }
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: fullContent, attachments: currentAttachments.length > 0 ? currentAttachments : undefined };
    let agentContext = "";
    if (approvedPlanTasks && mode === "agent") {
      const taskList = approvedPlanTasks.map((t, i) => `${i + 1}. [${t.status.toUpperCase()}] ${t.title}: ${t.description}`).join("\n");
      agentContext = `\n\n[APPROVED PLAN TASKS]\n${taskList}\n[END PLAN TASKS]`;
    }

    let allMessages: ChatMessage[] = [];
    setMessages((prev) => {
      allMessages = [...prev, userMsg];
      return allMessages;
    });
    setIsStreaming(true);

    persistMessage("user", userMsg.content);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", model }]);

    abortRef.current = new AbortController();

    try {
      const isAgent = mode === "agent" && !!projectId;
      const isLite = isAgent && liteMode;
      const endpoint = isLite ? "/api/ai/lite" : isAgent ? "/api/ai/agent" : "/api/ai/chat";

      const body: Record<string, unknown> = {
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.role === "user" && m === userMsg && agentContext
            ? m.content + agentContext
            : m.content
        })),
        model,
        agentMode,
        topAgentMode,
        autonomousTier,
        turbo: agentToolsConfig.turbo,
        ...(model === "openrouter" ? { openrouterModel } : {}),
      };

      if (selectedArtifactType) {
        body.artifactType = selectedArtifactType;
      }

      if (isAgent || isLite) {
        body.projectId = projectId;
        if (codeOptimizations && !isLite) body.optimize = true;
        if (agentToolsConfig.webSearch && !isLite) body.webSearchEnabled = true;
      } else {
        body.context = context;
        if (projectId) body.projectId = projectId;
      }

      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const csrfToken = getCsrfToken();
      if (csrfToken) fetchHeaders["X-CSRF-Token"] = csrfToken;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: fetchHeaders,
        credentials: "include",
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.message || errBody?.error || `HTTP ${res.status}`;
        throw new Error(`AI request failed: ${detail}`);
      }

      await processSSEStream(res, assistantId, isAgent, setMessages, model);

      const extractedContent = await new Promise<string>((resolve) => {
        setMessages((prev) => {
          const assistantMsg = prev.find((m) => m.id === assistantId);
          if (assistantMsg && assistantMsg.content) {
            persistMessage("assistant", assistantMsg.content, model, assistantMsg.fileOps);
            resolve(assistantMsg.content);
          } else {
            resolve("");
          }
          return prev;
        });
      });

      if (audioOutputEnabled && extractedContent && !extractedContent.includes("⚠️")) {
        const plainText = extractedContent.replace(/```[\s\S]*?```/g, "").replace(/[#*_`>\[\]()!]/g, "").trim();
        if (plainText.length > 0 && plainText.length <= 4096) {
          readAloud(plainText, assistantId);
        }
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[AIPanel] AI request error:", err.message);
        setLastFailedInput(userMsg.content);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ ${err.message}` } : m)
        );
      }
      return false;
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      onAgentComplete?.();
    }
  }, [messages, model, openrouterModel, mode, projectId, context, codeOptimizations, liteMode, agentMode, topAgentMode, autonomousTier, agentToolsConfig.webSearch, agentToolsConfig.turbo, persistMessage, processSSEStream, onAgentComplete, audioOutputEnabled, readAloud]);

  const processQueue = useCallback(async () => {
    if (processingQueueRef.current || pausedRef.current) return;
    processingQueueRef.current = true;

    while (!pausedRef.current) {
      let nextMsg: QueuedMsg | null = null;
      setQueuedMessages((prev) => {
        if (prev.length === 0) return prev;
        nextMsg = prev[0];
        return prev;
      });

      if (!nextMsg) break;
      const msgToProcess = nextMsg as QueuedMsg;

      if (pausedRef.current) break;

      const success = await sendMessageDirect(msgToProcess.content, msgToProcess.attachments);

      if (success) {
        if (projectId) {
          try {
            const csrfToken = getCsrfToken();
            const headers: Record<string, string> = {};
            if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
            await fetch(`/api/ai/queue/${projectId}/${msgToProcess.id}`, { method: "DELETE", headers, credentials: "include" });
          } catch {}
        }

        setQueuedMessages((prev) => {
          const next = prev.filter(m => m.id !== msgToProcess.id);
          if (next.length === 0) setIsQueueDrawerOpen(false);
          return next;
        });
      } else {
        break;
      }

      if (pausedRef.current) break;

      await new Promise(r => setTimeout(r, 500));
    }

    processingQueueRef.current = false;
  }, [projectId, sendMessageDirect]);

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    if (topMode === "plan" && !isStreaming) {
      return submitPlanMode();
    }

    if (projectId) {
      const providerMap: Record<AIModel, string> = { claude: "anthropic", gpt: "openai", gemini: "google", openrouter: "openrouter", perplexity: "perplexity", mistral: "mistral" };
      const currentProvider = providerMap[model];
      const cfg = credentialModes[currentProvider];
      const providerLabels: Record<string, string> = { anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT-4o)", google: "Google (Gemini)", openrouter: "OpenRouter" };
      if (!cfg || !cfg.configured) {
        setShowManagedApproval({ provider: currentProvider, providerLabel: providerLabels[currentProvider] || currentProvider });
        return;
      }
    }

    const content = input.trim();
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);

    if (isStreaming) {
      await addToQueue(content, currentAttachments);
      return;
    }

    const imageMatch = content.match(/^\/image\s+(.+)$/i);
    if (imageMatch) {
      const imgText = imageMatch[1];
      const sizeMatch = imgText.match(/^(1024x1024|1024x1536|1536x1024|auto)\s+(.+)$/i);
      if (sizeMatch) {
        await generateImage(sizeMatch[2], sizeMatch[1]);
      } else {
        await generateImage(imgText);
      }
      return;
    }

    const searchMatch = content.match(/^\/search\s+(.+)$/i);
    if (searchMatch && agentToolsConfig.webSearch) {
      await performWebSearch(searchMatch[1]);
      return;
    }

    if (agentToolsConfig.webSearch && mode !== "chat") {
      const q = content.toLowerCase();
      const searchPatterns = [
        /^(what|who|when|where|how|why|which|is|are|was|were|do|does|did|can|could|should|will|would)\s.+\?$/i,
        /\b(latest|recent|current|new|update|news|release|version|price|cost)\b/i,
        /\b(search|look up|find out|google|find me)\b/i,
      ];
      const hasSearchIntent = searchPatterns.some(p => p.test(q));
      if (hasSearchIntent && !q.includes("create") && !q.includes("build") && !q.includes("add") && !q.includes("edit") && !q.includes("fix") && !q.includes("implement")) {
        await performWebSearch(content);
        return;
      }
    }

    await sendMessageDirect(content, currentAttachments);
    processQueue();
  };

  useEffect(() => {
    if (!isStreaming && queuedMessages.length > 0 && !processingQueueRef.current && !pausedRef.current) {
      processQueue();
    }
  }, [isStreaming, queuedMessages.length, processQueue]);

  const addFilesExternal = useCallback((files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      const isImage = file.type.startsWith("image/");
      reader.onload = () => {
        const content = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: file.name,
            type: isImage ? "image" : file.type.startsWith("text/") || file.name.match(/\.(js|ts|tsx|jsx|py|json|css|html|md|yaml|yml|xml|csv|sql|sh|go|rs|java|c|cpp|h|rb|php)$/) ? "text" : "file",
            content,
            mimeType: file.type,
            size: file.size,
          },
        ]);
      };
      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, []);

  const sendMessageDirectRef = useRef(sendMessageDirect);
  sendMessageDirectRef.current = sendMessageDirect;

  const addFilesExternalRef = useRef(addFilesExternal);
  addFilesExternalRef.current = addFilesExternal;

  useEffect(() => {
    if (!onExternalInput) return;
    const handlers: ExternalInputHandlers = {
      handleSubmit: (value: string) => {
        console.log('[MobileSubmit] handleSubmit called with:', value?.slice(0, 50));
        setInput(value);
        setTimeout(() => {
          sendMessageDirectRef.current(value);
        }, 0);
      },
      handleSubmitWithAttachments: (value: string, atts: Attachment[]) => {
        console.log('[MobileSubmit] handleSubmitWithAttachments called');
        setInput(value);
        setTimeout(() => {
          sendMessageDirectRef.current(value, atts);
          setAttachments([]);
        }, 0);
      },
      isWorking: isStreaming,
      agentMode,
      onModeChange: (m: string) => {
        if (["economy", "power", "turbo"].includes(m)) {
          handleAgentModeChange(m as AgentMode);
        }
      },
      addFiles: (...args: Parameters<typeof addFilesExternal>) => addFilesExternalRef.current(...args),
      pendingAttachmentsCount: attachments.length,
      removeAttachment: (id: string) => setAttachments(prev => prev.filter(a => a.id !== id)),
      attachments: attachments.map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
      onVoice: () => {
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      },
      isRecording,
      isTranscribing,
      onAIModeChange: (newMode: 'chat' | 'agent' | 'plan') => {
        if (newMode === 'plan') {
          setTopMode('plan');
          setMode('agent');
        } else {
          setTopMode('build');
          setMode(newMode);
        }
      },
      aiMode: topMode === 'plan' ? 'plan' : mode === 'chat' ? 'chat' : 'agent',
      onAgentToolsConfigChange: (updates: Record<string, boolean>) => {
        updateAgentToolsConfig(updates as Partial<AgentToolsConfig>);
      },
      agentToolsConfig,
    };
    onExternalInput(handlers);
  }, [onExternalInput, isStreaming, agentMode, attachments, isRecording, isTranscribing, mode, topMode, agentToolsConfig]);

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const pauseQueue = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
    abortRef.current?.abort();
    processingQueueRef.current = false;
  }, []);

  const resumeQueue = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
    if (queuedMessages.length > 0) {
      processQueue();
    }
  }, [queuedMessages.length, processQueue]);

  const retryLastMessage = () => {
    if (!lastFailedInput) return;
    const retryInput = lastFailedInput;
    setLastFailedInput(null);
    setMessages((prev) => {
      const cleaned = prev.slice(0, -2);
      const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: retryInput };
      const assistantId = (Date.now() + 1).toString();
      const updatedMessages = [...cleaned, userMsg, { id: assistantId, role: "assistant" as const, content: "", model }];
      setIsStreaming(true);
      abortRef.current = new AbortController();
      const isAgent = mode === "agent" && !!projectId;
      const isLite = isAgent && liteMode;
      const endpoint = isLite ? "/api/ai/lite" : isAgent ? "/api/ai/agent" : "/api/ai/chat";
      const body: any = { messages: [...cleaned, userMsg].map((m) => ({ role: m.role, content: m.content })), model, agentMode, topAgentMode, autonomousTier, turbo: agentToolsConfig.turbo, ...(model === "openrouter" ? { openrouterModel } : {}) };
      if (isAgent || isLite) { body.projectId = projectId; if (codeOptimizations && !isLite) body.optimize = true; if (agentToolsConfig.webSearch && !isLite) body.webSearchEnabled = true; } else { body.context = context; if (projectId) body.projectId = projectId; }
      const retryHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const retryToken = getCsrfToken();
      if (retryToken) retryHeaders["X-CSRF-Token"] = retryToken;
      persistMessage("user", retryInput);
      fetch(endpoint, { method: "POST", headers: retryHeaders, credentials: "include", body: JSON.stringify(body), signal: abortRef.current.signal })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => null);
            const detail = errBody?.message || errBody?.error || `HTTP ${res.status}`;
            throw new Error(`AI request failed: ${detail}`);
          }
          await processSSEStream(res, assistantId, isAgent, setMessages, model);
          setMessages((prev) => {
            const assistantMsg = prev.find((m) => m.id === assistantId);
            if (assistantMsg && assistantMsg.content) {
              persistMessage("assistant", assistantMsg.content, model, assistantMsg.fileOps);
            }
            return prev;
          });
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("[AIPanel] Retry request error:", err.message);
            setLastFailedInput(retryInput);
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ ${err.message}` } : m));
          }
        })
        .finally(() => { setIsStreaming(false); abortRef.current = null; onAgentComplete?.(); });
      return updatedMessages;
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) return;
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          const csrfToken = getCsrfToken();
          const headers: Record<string, string> = {};
          if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            headers,
            credentials: "include",
            body: formData,
          });
          const data = await res.json();
          if (data.text) {
            setInput((prev) => prev ? prev + " " + data.text : data.text);
            inputRef.current?.focus();
          }
        } catch {}
        setIsTranscribing(false);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach((file) => {
      const reader = new FileReader();
      const isImage = file.type.startsWith("image/");

      reader.onload = () => {
        const content = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: file.name,
            type: isImage ? "image" : file.type.startsWith("text/") || file.name.match(/\.(js|ts|tsx|jsx|py|json|css|html|md|yaml|yml|xml|csv|sql|sh|go|rs|java|c|cpp|h|rb|php)$/) ? "text" : "file",
            content,
            mimeType: file.type,
            size: file.size,
          },
        ]);
      };

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleCodeOptimizations = () => {
    setCodeOptimizations((prev) => {
      const next = !prev;
      try { localStorage.setItem("ai-code-optimizations", String(next)); } catch {}
      updateAgentToolsConfig({ codeOptimizations: next });
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      fetch("/api/user/agent-preferences", {
        method: "PUT", headers, credentials: "include",
        body: JSON.stringify({ codeOptimizationsEnabled: next }),
      }).catch(() => {});
      return next;
    });
  };

  const toggleLiteMode = () => {
    setLiteMode((prev) => {
      const next = !prev;
      updateAgentToolsConfig({ liteMode: next });
      return next;
    });
  };

  const handleAgentModeChange = (newMode: AgentMode) => {
    setAgentMode(newMode);
    try { localStorage.setItem("ai-agent-mode", newMode); } catch {}
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    fetch("/api/user/agent-preferences", {
      method: "PUT", headers, credentials: "include",
      body: JSON.stringify({ agentMode: newMode }),
    }).catch(() => {});
  };

  const handleTopAgentModeChange = (newMode: TopAgentMode) => {
    setTopAgentMode(newMode);
    try { localStorage.setItem("ai-top-agent-mode", newMode); } catch {}
    if (newMode === "lite") {
      setLiteMode(true);
      updateAgentToolsConfig({ liteMode: true });
      handleAgentModeChange("economy");
    } else if (newMode === "autonomous") {
      setLiteMode(false);
      updateAgentToolsConfig({ liteMode: false });
      handleAgentModeChange(autonomousTier);
    } else if (newMode === "max") {
      setLiteMode(false);
      updateAgentToolsConfig({ liteMode: false });
      handleAgentModeChange("power");
    }
  };

  const handleAutonomousTierChange = (tier: AutonomousTier) => {
    setAutonomousTier(tier);
    try { localStorage.setItem("ai-autonomous-tier", tier); } catch {}
    handleAgentModeChange(tier);
  };

  const handleTurboToggle = () => {
    const newTurbo = !agentToolsConfig.turbo;
    updateAgentToolsConfig({ turbo: newTurbo });
    if (newTurbo) {
      handleAgentModeChange("turbo");
    } else {
      if (topAgentMode === "max") {
        handleAgentModeChange("power");
      } else if (topAgentMode === "autonomous") {
        handleAgentModeChange(autonomousTier);
      } else {
        handleAgentModeChange("economy");
      }
    }
  };

  const toggleAudioOutput = useCallback(() => {
    setAudioOutputEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("ai-audio-output", String(next)); } catch {}
      return next;
    });
  }, []);

  const handleVoiceChange = useCallback((voice: VoiceOption) => {
    setSelectedVoice(voice);
    try { localStorage.setItem("ai-voice", voice); } catch {}
  }, []);

  // initAudioPlayback, stopAudioPlayback, readAloud moved before sendMessageDirect

  const streamAudioResponse = useCallback(async (chatMessages: { role: string; content: string }[], assistantMsgId: string) => {
    await initAudioPlayback();
    if (!audioWorkletRef.current) return;

    audioWorkletRef.current.port.postMessage({ type: "clear" });
    setIsAudioStreaming(true);
    setReadAloudMsgId(assistantMsgId);

    audioAbortRef.current = new AbortController();
    const collectedChunks: string[] = [];

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const response = await fetch("/api/ai/chat-audio", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ messages: chatMessages, voice: selectedVoice }),
        signal: audioAbortRef.current.signal,
      });

      if (!response.ok) throw new Error("Audio chat request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "audio" && audioWorkletRef.current) {
              collectedChunks.push(event.data);
              const samples = decodePCM16ToFloat32(event.data);
              audioWorkletRef.current.port.postMessage({ type: "audio", samples });
            } else if (event.type === "done") {
              audioWorkletRef.current?.port.postMessage({ type: "streamComplete" });
              setMessages((prev) =>
                prev.map((m) => m.id === assistantMsgId ? { ...m, audioChunks: collectedChunks, audioTranscript: event.transcript } : m)
              );
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("Audio stream error:", err);
      setIsAudioStreaming(false);
      setReadAloudMsgId(null);
    }
  }, [selectedVoice, initAudioPlayback]);

  const generateImage = async (prompt: string, size: string = "1024x1024", filename?: string) => {
    if (!prompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    const sizeLabel = size === "1024x1536" ? " (portrait)" : size === "1536x1024" ? " (landscape)" : size === "auto" ? " (auto)" : "";
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: `Generate image${sizeLabel}: ${prompt}` };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage("user", userMsg.content);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "Generating image...", model }]);

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ prompt: prompt.trim(), size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");
      const imgDataUri = data.image;
      const safeFilename = filename || `generated-${Date.now()}.png`;
      const content = `Here's the generated image:`;
      const inlineImgs: { filename: string; dataUri: string }[] = [{ filename: safeFilename, dataUri: imgDataUri }];
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content, inlineImages: inlineImgs } : m)
      );
      persistMessage("assistant", `Generated image saved as ${safeFilename}`, model);

      if (projectId) {
        try {
          const fileHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (csrfToken) fileHeaders["X-CSRF-Token"] = csrfToken;
          const fileRes = await fetch(`/api/projects/${projectId}/files`, {
            method: "POST",
            headers: fileHeaders,
            credentials: "include",
            body: JSON.stringify({ filename: safeFilename, content: imgDataUri }),
          });
          if (fileRes.ok) {
            const file = await fileRes.json();
            onFileCreated?.(file);
          }
        } catch {}
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: `Image generation failed: ${err.message}` } : m)
      );
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const performWebSearch = async (query: string) => {
    if (!query.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: `🔍 Search: ${query}` };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage("user", userMsg.content);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", model }]);

    abortRef.current = new AbortController();

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch("/api/ai/web-search", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ query: query.trim(), model }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Search failed");
      await processSSEStream(res, assistantId, true, setMessages, model);
      setMessages((prev) => {
        const assistantMsg = prev.find((m) => m.id === assistantId);
        if (assistantMsg?.content) persistMessage("assistant", assistantMsg.content, model);
        return prev;
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: "⚠️ Web search failed." } : m)
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      onAgentComplete?.();
    }
  };

  const [appliedBlocks, setAppliedBlocks] = useState<Set<string>>(new Set());

  const applyCodeToFile = async (code: string, targetFilename: string, blockKey: string) => {
    if (onApplyCode) {
      onApplyCode(targetFilename, code);
      setAppliedBlocks((prev) => new Set(prev).add(blockKey));
      setTimeout(() => setAppliedBlocks((prev) => { const next = new Set(prev); next.delete(blockKey); return next; }), 2000);
    }
  };

  const guessTargetFile = (lang: string, code: string): string | null => {
    const commentMatch = code.match(/^\/\/\s*(\S+\.\w+)/m) || code.match(/^#\s*(\S+\.\w+)/m);
    if (commentMatch) return commentMatch[1];
    if (context?.filename) return context.filename;
    if (files && files.length === 1) return files[0].filename;
    return null;
  };

  const renderInlineMarkdown = (text: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    const inlineRegex = /(!\[([^\]]*)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;
    let tokenKey = 0;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(<span key={tokenKey++}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match[2] !== undefined && match[3]) {
        tokens.push(
          <img key={tokenKey++} src={match[3]} alt={match[2] || "Generated image"} className="max-w-full rounded-lg border border-[var(--ide-border)] my-2" data-testid="img-generated" />
        );
      } else if (match[4]) {
        tokens.push(<strong key={tokenKey++} className="font-semibold text-[var(--ide-text)]">{match[4]}</strong>);
      } else if (match[5]) {
        tokens.push(<em key={tokenKey++} className="italic text-[var(--ide-text)]">{match[5]}</em>);
      } else if (match[6]) {
        tokens.push(
          <code key={tokenKey++} className="bg-[var(--ide-bg)] px-1.5 py-0.5 rounded text-[#FF9940] font-mono text-[12px]">
            {match[6]}
          </code>
        );
      } else if (match[7] && match[8]) {
        tokens.push(
          <a key={tokenKey++} href={match[8]} target="_blank" rel="noopener noreferrer" className="text-[#0079F2] underline hover:text-[#3399FF] transition-colors">
            {match[7]}
          </a>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      tokens.push(<span key={tokenKey++}>{text.slice(lastIndex)}</span>);
    }

    return tokens.length > 0 ? tokens : [<span key={0}>{text}</span>];
  };

  const renderMarkdownText = (text: string): React.ReactNode[] => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;
    let lineKey = 0;

    const flushList = () => {
      if (listItems) {
        if (listItems.type === "ul") {
          elements.push(
            <ul key={`list-${lineKey++}`} className="my-1.5 ml-4 space-y-0.5">
              {listItems.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[var(--ide-text)]">
                  <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[var(--ide-text-muted)] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        } else {
          elements.push(
            <ol key={`list-${lineKey++}`} className="my-1.5 ml-4 space-y-0.5">
              {listItems.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[var(--ide-text)]">
                  <span className="text-[var(--ide-text-muted)] font-mono text-[11px] mt-[1px] shrink-0 min-w-[16px]">{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        listItems = null;
      }
    };

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = headerMatch[1].length;
        const headerText = headerMatch[2];
        const sizes = { 1: "text-[16px] font-bold", 2: "text-[14px] font-semibold", 3: "text-[13px] font-semibold" };
        elements.push(
          <div key={`h-${lineKey++}`} className={`${sizes[level as 1 | 2 | 3] || sizes[3]} text-[var(--ide-text)] mt-3 mb-1.5`}>
            {renderInlineMarkdown(headerText)}
          </div>
        );
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        if (!listItems || listItems.type !== "ul") {
          flushList();
          listItems = { type: "ul", items: [] };
        }
        listItems.items.push(renderInlineMarkdown(bulletMatch[1]));
        continue;
      }

      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (numberedMatch) {
        if (!listItems || listItems.type !== "ol") {
          flushList();
          listItems = { type: "ol", items: [] };
        }
        listItems.items.push(renderInlineMarkdown(numberedMatch[1]));
        continue;
      }

      flushList();

      if (line.trim() === "") {
        elements.push(<span key={`br-${lineKey++}`}>{"\n"}</span>);
      } else {
        elements.push(<span key={`ln-${lineKey++}`} className="whitespace-pre-wrap">{renderInlineMarkdown(line)}{"\n"}</span>);
      }
    }

    flushList();
    return elements;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const FILE_FORMAT_ICONS: Record<string, { color: string; bg: string; label: string }> = {
    pdf: { color: "text-red-400", bg: "bg-red-500/15", label: "PDF" },
    docx: { color: "text-blue-400", bg: "bg-blue-500/15", label: "DOCX" },
    xlsx: { color: "text-green-400", bg: "bg-green-500/15", label: "XLSX" },
    pptx: { color: "text-orange-400", bg: "bg-orange-500/15", label: "PPTX" },
    csv: { color: "text-amber-400", bg: "bg-amber-500/15", label: "CSV" },
  };

  const renderContent = (content: string, fileOps?: { type: "created" | "updated"; filename: string }[], inlineImages?: { filename: string; dataUri: string }[], generatedFiles?: GeneratedFile[], imageSearchResults?: ImageSearchResult[], generatedAudio?: GeneratedAudio[]) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    const rendered = parts.map((part, i) => {
      if (part.includes("data:image/")) {
        const imgParts = part.split(/(!\[[^\]]*\]\(data:image\/[^)]+\))/);
        if (imgParts.length > 1) {
        return imgParts.map((imgPart, j) => {
          const imgMatch = imgPart.match(/^!\[([^\]]*)\]\((data:image\/[^)]+)\)$/);
          if (imgMatch) {
            return (
              <div key={`${i}-img-${j}`} className="my-3">
                <img
                  src={imgMatch[2]}
                  alt={imgMatch[1] || "Generated image"}
                  className="max-w-full rounded-lg border border-[var(--ide-border)] shadow-md"
                  data-testid="img-generated"
                />
              </div>
            );
          }
          if (imgPart.trim()) {
            return <span key={`${i}-txt-${j}`}>{renderMarkdownText(imgPart)}</span>;
          }
          return null;
        });
        }
      }
      if (part.startsWith("```")) {
        const firstNewline = part.indexOf("\n");
        const lang = part.slice(3, firstNewline).trim();

        if (lang === "json" && topMode === "plan") {
          try {
            const jsonContent = part.slice(firstNewline + 1, part.length - 3);
            const parsed = JSON.parse(jsonContent);
            if (parsed.tasks && Array.isArray(parsed.tasks)) {
              const displayTasks = currentPlan?.tasks && currentPlan.tasks.length > 0 ? currentPlan.tasks : parsed.tasks.map((t: Record<string, unknown>, idx: number) => ({
                title: typeof t.title === "string" ? t.title : `Task ${idx + 1}`,
                description: typeof t.description === "string" ? t.description : "",
                complexity: typeof t.complexity === "string" && ["simple", "medium", "complex"].includes(t.complexity) ? t.complexity as "simple" | "medium" | "complex" : "medium",
                dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
                status: "pending" as const,
                sortOrder: idx,
              }));

              return (
                <div key={i} className="my-3 space-y-2">
                  {(currentPlan?.title || parsed.title) && (
                    <div className="flex items-center gap-2 mb-2">
                      <Map className="w-4 h-4 text-[#7C65CB]" />
                      <span className="text-[13px] font-semibold text-[var(--ide-text)]">{currentPlan?.title || parsed.title}</span>
                    </div>
                  )}
                  {displayTasks.map((task: PlanTask, idx: number) => (
                    <PlanTaskCard
                      key={task.id || idx}
                      task={task}
                      index={idx}
                      expanded={expandedTasks.has(idx)}
                      onToggle={() => setExpandedTasks((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                        return next;
                      })}
                    />
                  ))}
                  {currentPlan && currentPlan.status !== "approved" && (
                    <button
                      className="w-full flex items-center justify-center gap-2 mt-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#7C65CB] to-[#6B56B8] hover:from-[#6B56B8] hover:to-[#5A47A0] text-white text-[12px] font-semibold transition-all shadow-lg shadow-[#7C65CB]/20"
                      onClick={handleStartBuilding}
                      data-testid="button-start-building"
                    >
                      <Play className="w-4 h-4" />
                      Start building
                    </button>
                  )}
                </div>
              );
            }
          } catch {}
        }

        const lines = part.slice(3, -3).split("\n");
        const codeLang = lines[0]?.trim() || "";
        const code = lines.slice(1).join("\n");
        const blockKey = `${content.slice(0, 20)}-block-${i}`;
        const targetFile = guessTargetFile(codeLang, code);
        const isApplied = appliedBlocks.has(blockKey);
        const langColor = LANG_COLORS[codeLang.toLowerCase()] || { bg: "bg-[var(--ide-surface)]", text: "text-[var(--ide-text-secondary)]" };
        return (
          <div key={i} className="my-2.5 rounded-lg overflow-hidden border border-[var(--ide-border)] shadow-lg">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]">
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                {codeLang && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${langColor.bg} ${langColor.text}`}>
                    {codeLang}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {mode === "chat" && targetFile && onApplyCode && (
                  <button
                    onClick={() => applyCodeToFile(code, targetFile, blockKey)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-all ${isApplied ? "text-[#0CCE6B] bg-[#0CCE6B]/10" : "text-[#0079F2] hover:text-[var(--ide-text)] hover:bg-[#0079F2]/10"}`}
                    data-testid={`button-apply-code-${i}`}
                  >
                    {isApplied ? <><Check className="w-3 h-3" /> Applied</> : <><FileDown className="w-3 h-3" /> Apply</>}
                  </button>
                )}
                {onCanvasFrameCreate && (codeLang.toLowerCase() === "html" || code.includes("<!DOCTYPE") || code.includes("<html")) && (
                  <button
                    onClick={() => onCanvasFrameCreate(code, `AI Frame ${Date.now().toString(36)}`)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded text-[#7C65CB] hover:text-[var(--ide-text)] hover:bg-[#7C65CB]/10 transition-all"
                    data-testid={`button-add-to-canvas-${i}`}
                  >
                    <Layers className="w-3 h-3" /> Canvas
                  </button>
                )}
                <button
                  onClick={() => copyCode(code)}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-all"
                  data-testid="button-copy-code"
                >
                  {copied === code ? <><Check className="w-3 h-3 text-[#0CCE6B]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>
            </div>
            <pre className="p-3 bg-[var(--ide-bg)] text-[12px] overflow-x-auto text-[var(--ide-text)] leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      if (part.match(/^>\s/m)) {
        return part.split("\n").map((line, j) => {
          if (line.startsWith("> ")) {
            const text = line.slice(2);
            const isSearching = text.includes("Searching the web");
            const isFetching = text.includes("Fetching content");
            if (isSearching || isFetching) {
              return <WebSearchIndicator key={`${i}-${j}`} label={text.replace(/^🔍\s*|^🌐\s*/, "")} />;
            }
            const isCreating = text.includes("Creating");
            return (
              <div key={`${i}-${j}`} className="flex items-center gap-2 my-1.5 px-3 py-2 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[11px] animate-[slide-in_0.3s_ease-out]">
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${isCreating ? "bg-[#0CCE6B]/15" : "bg-[#0079F2]/15"}`}>
                  {isCreating ? <FilePlus className="w-3 h-3 text-[#0CCE6B]" /> : <FileEdit className="w-3 h-3 text-[#0079F2]" />}
                </div>
                <span className="text-[var(--ide-text)]">{text}</span>
                <div className="ml-auto w-3 h-3 border-2 border-[#7C65CB]/40 border-t-[#7C65CB] rounded-full animate-spin" />
              </div>
            );
          }
          return <span key={`${i}-${j}`} className="whitespace-pre-wrap">{line}{"\n"}</span>;
        });
      }
      return <span key={i}>{renderMarkdownText(part)}</span>;
    });

    if (inlineImages && inlineImages.length > 0) {
      rendered.push(
        <div key="inline-images" className="mt-3 space-y-3">
          {inlineImages.map((img, i) => (
            <div key={`inline-img-${i}`} className="rounded-lg overflow-hidden border border-[var(--ide-border)] shadow-lg">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]">
                <Image className="w-3.5 h-3.5 text-[#7C65CB]" />
                <span className="text-[10px] font-mono text-[var(--ide-text-secondary)]">{img.filename}</span>
              </div>
              <img
                src={img.dataUri}
                alt={img.filename}
                className="max-w-full bg-[var(--ide-bg)]"
                data-testid={`img-generated-${img.filename}`}
              />
            </div>
          ))}
        </div>
      );
    }

    if (generatedFiles && generatedFiles.length > 0) {
      rendered.push(
        <div key="generated-files" className="mt-3 space-y-2">
          {generatedFiles.map((gf, i) => {
            const formatInfo = FILE_FORMAT_ICONS[gf.format] || { color: "text-gray-400", bg: "bg-gray-500/15", label: gf.format.toUpperCase() };
            return (
              <div key={`gen-file-${i}`} className="rounded-lg overflow-hidden border border-[var(--ide-border)] shadow-md" data-testid={`card-generated-file-${gf.filename}`}>
                <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--ide-bg)]">
                  <div className={`w-8 h-8 rounded-lg ${formatInfo.bg} flex items-center justify-center shrink-0`}>
                    <FileDown className={`w-4 h-4 ${formatInfo.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[var(--ide-text)] truncate">{gf.filename}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${formatInfo.bg} ${formatInfo.color}`}>
                        {formatInfo.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--ide-text-muted)]">{formatBytes(gf.size)}</span>
                  </div>
                  <a
                    href={gf.downloadUrl}
                    download={gf.filename}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] font-medium transition-colors shrink-0"
                    data-testid={`button-download-${gf.filename}`}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (imageSearchResults && imageSearchResults.length > 0) {
      rendered.push(
        <div key="image-search-results" className="mt-3 rounded-lg overflow-hidden border border-[#E44D26]/20" data-testid="image-search-results">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E44D26]/5 border-b border-[#E44D26]/20">
            <Search className="w-3 h-3 text-[#E44D26]" />
            <span className="text-[10px] font-semibold text-[#E44D26] uppercase tracking-wider">Image Results</span>
            <span className="text-[10px] text-[#E44D26]/60 ml-auto">{imageSearchResults.length} image{imageSearchResults.length > 1 ? "s" : ""}</span>
          </div>
          <div className="bg-[#E44D26]/5 p-2 grid grid-cols-2 gap-2">
            {imageSearchResults.slice(0, 8).map((img, i) => (
              <a
                key={`img-search-${i}`}
                href={img.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-md overflow-hidden border border-[var(--ide-border)] hover:border-[#E44D26]/40 transition-colors"
                data-testid={`link-image-result-${i}`}
              >
                <div className="aspect-video bg-[var(--ide-bg)] overflow-hidden">
                  <img
                    src={img.thumbnailUrl}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[10px] font-medium text-[var(--ide-text)] truncate group-hover:text-[#E44D26] transition-colors">{img.title}</div>
                  <div className="text-[8px] text-[var(--ide-text-muted)] truncate">{img.sourceDomain}{img.width > 0 ? ` · ${img.width}×${img.height}` : ""}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      );
    }

    if (generatedAudio && generatedAudio.length > 0) {
      rendered.push(
        <div key="generated-audio" className="mt-3 space-y-2" data-testid="generated-audio">
          {generatedAudio.map((audio, i) => (
            <div key={`audio-${i}`} className="rounded-lg overflow-hidden border border-[#9333EA]/20">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#9333EA]/5 border-b border-[#9333EA]/20">
                <Mic className="w-3 h-3 text-[#9333EA]" />
                <span className="text-[10px] font-semibold text-[#9333EA] uppercase tracking-wider">Generated Speech</span>
                <span className="text-[10px] text-[#9333EA]/60 ml-auto">{audio.voiceName} · ~{audio.durationEstimate}s</span>
              </div>
              <div className="bg-[#9333EA]/5 p-3">
                <audio
                  controls
                  className="w-full h-8"
                  src={audio.audioDataUri}
                  data-testid={`audio-player-${i}`}
                >
                  Your browser does not support the audio element.
                </audio>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] text-[var(--ide-text-muted)]">{audio.textLength} characters · {audio.voiceName}</span>
                  <a
                    href={audio.audioDataUri}
                    download={`speech-${audio.voiceName.toLowerCase()}-${Date.now()}.${audio.mimeType.includes("mpeg") ? "mp3" : "wav"}`}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#9333EA]/10 hover:bg-[#9333EA]/20 text-[#9333EA] text-[9px] font-medium transition-colors"
                    data-testid={`button-download-audio-${i}`}
                  >
                    <FileDown className="w-3 h-3" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (fileOps && fileOps.length > 0) {
      rendered.push(<FileOpProgress key="file-ops-summary" ops={fileOps} />);
    }

    return rendered;
  };

  const handleStartBuilding = async () => {
    if (!currentPlan || !projectId) return;

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const res = await fetch(`/api/ai/plans/${currentPlan.id}/approve`, {
        method: "POST",
        headers,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        const tasks: PlanTask[] = data.tasks.map((t: { id: string; title: string; description: string; complexity?: string; dependsOn: string[] | null; status: string; sortOrder: number }) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          complexity: (t.complexity as "simple" | "medium" | "complex") || "medium",
          dependsOn: (t.dependsOn || []).map(Number),
          status: t.status as "pending" | "in-progress" | "done",
          sortOrder: t.sortOrder,
        }));
        setCurrentPlan({ ...currentPlan, status: "approved", tasks });
        setApprovedPlanTasks(tasks);
        setTopMode("build");
        setMode("agent");

        const taskSummary = tasks.map((t, i) =>
          `${i + 1}. ${t.title}: ${t.description}`
        ).join("\n");
        const buildPrompt = `Please implement the following approved plan tasks:\n\n${taskSummary}\n\nStart with task 1 and work through them sequentially.`;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: buildPrompt };
        const allMessages = [...messages, userMsg];
        setMessages(allMessages);
        setIsStreaming(true);
        persistMessage("user", buildPrompt);

        const assistantId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", model }]);

        abortRef.current = new AbortController();

        const agentHeaders: Record<string, string> = { "Content-Type": "application/json" };
        const agentCsrf = getCsrfToken();
        if (agentCsrf) agentHeaders["X-CSRF-Token"] = agentCsrf;

        const agentRes = await fetch("/api/ai/agent", {
          method: "POST",
          headers: agentHeaders,
          credentials: "include",
          body: JSON.stringify({
            messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
            model,
            projectId,
            ...(model === "openrouter" ? { openrouterModel } : {}),
          }),
          signal: abortRef.current.signal,
        });

        if (!agentRes.ok) {
          const errBody = await agentRes.json().catch(() => null);
          const detail = errBody?.message || errBody?.error || `HTTP ${agentRes.status}`;
          throw new Error(`Agent request failed: ${detail}`);
        }

        await processSSEStream(agentRes, assistantId, true, setMessages, model);

        setMessages((prev) => {
          const assistantMsg = prev.find((m) => m.id === assistantId);
          if (assistantMsg?.content) {
            persistMessage("assistant", assistantMsg.content, model, assistantMsg.fileOps);
          }
          return prev;
        });

        setIsStreaming(false);
        abortRef.current = null;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[AIPanel] Agent request error:", err.message);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) {
            return prev.map((m) => m.id === last.id ? { ...m, content: `⚠️ ${err.message}` } : m);
          }
          return prev;
        });
      }
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handlePlanTaskStatusChange = async (index: number, status: "pending" | "in-progress" | "done") => {
    if (!approvedPlanTasks || !currentPlan) return;
    const task = approvedPlanTasks[index];
    if (!task?.id) return;

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      await fetch(`/api/ai/plans/${currentPlan.id}/tasks/${task.id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      setApprovedPlanTasks((prev) =>
        prev?.map((t, i) => i === index ? { ...t, status } : t) || null
      );
    } catch {}
  };

  const modelInfo = MODEL_LABELS[model];
  const ModelIcon = modelInfo.icon;

  const defaultChatSuggestions = [
    { icon: Code2, label: "Explain this code", category: "Understand" },
    { icon: Bug, label: "Find bugs and fix them", category: "Debug" },
    { icon: Shield, label: "Add error handling", category: "Improve" },
    { icon: Gauge, label: "Optimize performance", category: "Optimize" },
  ];

  const defaultAgentSuggestions = [
    { icon: Layout, label: "Build a login form with validation", category: "UI" },
    { icon: Database, label: "Add a REST API endpoint", category: "Backend" },
    { icon: Wrench, label: "Create a utility functions file", category: "Utils" },
    { icon: Lightbulb, label: "Refactor this code for performance", category: "Refactor" },
  ];

  const defaultPlanSuggestions = [
    { icon: Shield, label: "Plan a user authentication system", category: "Architecture" },
    { icon: Layout, label: "Break down a dashboard feature", category: "Feature" },
    { icon: Database, label: "Design a database schema", category: "Data" },
    { icon: Lightbulb, label: "Evaluate tech stack options", category: "Analysis" },
  ];

  const [personalizedSuggestions, setPersonalizedSuggestions] = useState<{ chat: { label: string; category: string }[]; agent: { label: string; category: string }[] } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/ecode`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setEcodeStatus(data); })
      .catch(() => {});
  }, [projectId]);

  const handleGenerateEcode = useCallback(async () => {
    if (!projectId || ecodeGenerating) return;
    setEcodeGenerating(true);
    try {
      const ct = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ct) headers["X-CSRF-Token"] = ct;
      const res = await fetch(`/api/projects/${projectId}/ecode/generate`, {
        method: "POST", credentials: "include", headers,
      });
      if (res.ok) {
        const data = await res.json();
        setEcodeStatus({ exists: true, fileId: data.file?.id || null });
        setEcodeLastUpdated(new Date().toISOString());
        if (data.file) onFileCreated?.(data.file);
      }
    } catch {}
    setEcodeGenerating(false);
  }, [projectId, ecodeGenerating, onFileCreated]);

  const handleRefreshEcode = useCallback(async () => {
    if (!projectId || ecodeRefreshing) return;
    setEcodeRefreshing(true);
    try {
      const ct = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ct) headers["X-CSRF-Token"] = ct;
      const res = await fetch(`/api/projects/${projectId}/ecode/refresh`, {
        method: "POST", credentials: "include", headers,
      });
      if (res.ok) {
        const data = await res.json();
        setEcodeStatus({ exists: true, fileId: data.file?.id || null });
        setEcodeLastUpdated(new Date().toISOString());
        if (data.file) {
          if (data.created) {
            onFileCreated?.(data.file);
          } else {
            onFileUpdated?.(data.file);
          }
        }
      }
    } catch {}
    setEcodeRefreshing(false);
  }, [projectId, ecodeRefreshing, onFileCreated, onFileUpdated]);

  useEffect(() => {
    fetch("/api/ai-suggestions", { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.personalized && data.chat && data.agent) {
          setPersonalizedSuggestions({ chat: data.chat, agent: data.agent });
        }
      })
      .catch(() => {});
  }, []);

  const suggestionIcons = [Code2, Bug, Shield, Gauge, Layout, Database, Wrench, Lightbulb];
  const chatSuggestions = personalizedSuggestions
    ? personalizedSuggestions.chat.map((s, i) => ({ ...s, icon: suggestionIcons[i % suggestionIcons.length] }))
    : defaultChatSuggestions;
  const agentSuggestions = personalizedSuggestions
    ? personalizedSuggestions.agent.map((s, i) => ({ ...s, icon: suggestionIcons[(i + 4) % suggestionIcons.length] }))
    : defaultAgentSuggestions;

  const activeMessages = topMode === "plan" ? planMessages : messages;
  const activeSuggestions = topMode === "plan"
    ? defaultPlanSuggestions
    : mode === "agent" ? agentSuggestions : chatSuggestions;

  return (
    <div className="flex flex-col h-full bg-[var(--ide-panel)]">
      <div className="flex items-center justify-between px-3 min-h-10 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0 gap-x-1 gap-y-1 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {projectId && (
            ecodeStatus.exists ? (
              <div className="flex items-center gap-0.5" data-testid="ecode-controls">
                <button
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-l bg-[#0CCE6B]/10 text-[#0CCE6B] hover:bg-[#0CCE6B]/20 transition-all whitespace-nowrap"
                  onClick={() => {
                    if (ecodeStatus.fileId && files) {
                      const f = files.find(f => f.filename === "ecode.md");
                      if (f) onApplyCode?.("ecode.md", f.content);
                    }
                  }}
                  title={ecodeLastUpdated ? `ecode.md — auto-synced ${new Date(ecodeLastUpdated).toLocaleTimeString()}` : "ecode.md is active — click to open"}
                  data-testid="badge-ecode-active"
                >
                  <FileText className="w-2.5 h-2.5" />
                  ecode.md
                  {ecodeLastUpdated && <span className="text-[8px] opacity-60 ml-0.5">synced</span>}
                </button>
                <button
                  className="flex items-center text-[10px] px-1 py-0.5 rounded-r bg-[#0CCE6B]/10 text-[#0CCE6B] hover:bg-[#0CCE6B]/20 transition-all border-l border-[#0CCE6B]/20"
                  onClick={handleRefreshEcode}
                  disabled={ecodeRefreshing}
                  title="Refresh project structure & dependencies in ecode.md"
                  data-testid="button-ecode-refresh"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${ecodeRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:opacity-80 transition-opacity"
                onClick={handleGenerateEcode}
                disabled={ecodeGenerating}
                title="Generate ecode.md project guidelines"
                data-testid="button-ecode-generate"
              >
                {ecodeGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FilePlus className="w-2.5 h-2.5" />}
                {ecodeGenerating ? "Generating..." : "Generate ecode.md"}
              </button>
            )
          )}
          {projectId && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
                  style={{ color: TOP_AGENT_MODE_LABELS[topAgentMode].color, backgroundColor: `${TOP_AGENT_MODE_LABELS[topAgentMode].color}15` }}
                  data-testid="button-agent-mode-select"
                >
                  {(() => { const ModeIcon = TOP_AGENT_MODE_LABELS[topAgentMode].icon; return <ModeIcon className="w-2.5 h-2.5" />; })()}
                  {TOP_AGENT_MODE_LABELS[topAgentMode].name}
                  {topAgentMode === "autonomous" && <span className="text-[9px] opacity-60">({AUTONOMOUS_TIER_LABELS[autonomousTier].name})</span>}
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0 bg-[var(--ide-panel)] border-[var(--ide-border)]">
                <div className="px-3 py-2 border-b border-[var(--ide-border)]">
                  <span className="text-[11px] font-semibold text-[var(--ide-text)]">Agent Mode</span>
                </div>
                <div className="p-2 space-y-1">
                  {(["lite", "autonomous", "max"] as TopAgentMode[]).map((m) => {
                    const cfg = TOP_AGENT_MODE_LABELS[m];
                    const MIcon = cfg.icon;
                    const isActive = topAgentMode === m;
                    return (
                      <button
                        key={m}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                          isActive ? "ring-1" : "hover:bg-[var(--ide-surface)]"
                        }`}
                        style={isActive ? { backgroundColor: `${cfg.color}10`, borderColor: `${cfg.color}30`, ringColor: `${cfg.color}30` } as React.CSSProperties : {}}
                        onClick={() => handleTopAgentModeChange(m)}
                        data-testid={`agent-mode-${m}`}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cfg.color}15` }}>
                          <MIcon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-[var(--ide-text)]">{cfg.name}</div>
                          <div className="text-[9px] text-[var(--ide-text-muted)]">{cfg.description}</div>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.color }} />}
                      </button>
                    );
                  })}
                </div>
                {topAgentMode === "autonomous" && (
                  <>
                    <div className="px-3 py-1.5 border-t border-[var(--ide-border)]">
                      <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Tier</span>
                    </div>
                    <div className="px-2 pb-2 flex gap-1">
                      {(["economy", "power"] as AutonomousTier[]).map((tier) => {
                        const tcfg = AUTONOMOUS_TIER_LABELS[tier];
                        const isTierActive = autonomousTier === tier && !agentToolsConfig.turbo;
                        return (
                          <button
                            key={tier}
                            className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all text-center ${
                              isTierActive
                                ? "bg-[var(--ide-surface)] text-[var(--ide-text)] ring-1 ring-[var(--ide-border)] shadow-sm"
                                : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50"
                            }`}
                            onClick={() => handleAutonomousTierChange(tier)}
                            data-testid={`tier-${tier}`}
                          >
                            <span style={isTierActive ? { color: tcfg.color } : {}}>{tcfg.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="px-3 py-1.5 border-t border-[var(--ide-border)]">
                  <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Switches</span>
                </div>
                <div className="px-2 pb-2 space-y-0.5">
                  {[
                    { key: "turbo" as const, label: "Turbo", desc: "Prioritize speed", icon: Zap, color: "#F59E0B", disabled: topAgentMode === "lite" },
                    { key: "appTesting" as const, label: "App Testing", desc: "Validate after changes", icon: FlaskConical, color: "#0CCE6B", disabled: topAgentMode === "lite" },
                    { key: "codeOptimizations" as const, label: "Code Optimizations", desc: "Auto-review code", icon: Gauge, color: "#0CCE6B", disabled: topAgentMode === "lite" },
                  ].map((sw) => {
                    const isOn = sw.key === "turbo" ? agentToolsConfig.turbo
                      : sw.key === "codeOptimizations" ? codeOptimizations
                      : agentToolsConfig[sw.key];
                    return (
                      <button
                        key={sw.key}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                          sw.disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[var(--ide-surface)] cursor-pointer"
                        }`}
                        onClick={() => {
                          if (sw.disabled) return;
                          if (sw.key === "turbo") handleTurboToggle();
                          else if (sw.key === "codeOptimizations") toggleCodeOptimizations();
                          else updateAgentToolsConfig({ [sw.key]: !agentToolsConfig[sw.key] });
                        }}
                        data-testid={`toggle-switch-${sw.key}`}
                      >
                        <sw.icon className="w-3 h-3 shrink-0" style={{ color: sw.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-[var(--ide-text)]">{sw.label}</div>
                        </div>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center ${
                          isOn && !sw.disabled ? "bg-[#0CCE6B] justify-end" : "bg-[var(--ide-border)] justify-start"
                        }`}>
                          <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-900 mx-0.5 shadow-sm" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {projectId && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-all mr-0.5"
                  title="Agent Tools"
                  data-testid="button-agent-tools"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0 bg-[var(--ide-panel)] border-[var(--ide-border)]">
                <div className="px-3 py-2 border-b border-[var(--ide-border)]">
                  <span className="text-[11px] font-semibold text-[var(--ide-text)]">Agent Tools</span>
                </div>
                <div className="p-2 space-y-1">
                  {[
                    { key: "webSearch" as const, label: "Web Search", desc: "Search-informed answers", icon: Globe, color: "#0079F2" },
                    { key: "architect" as const, label: "Architect", desc: "Architecture analysis", icon: Brain, color: "#7C65CB", disabledInLite: true },
                  ].map((tool) => {
                    const isDisabledByLite = topAgentMode === "lite" && tool.disabledInLite;
                    const isActive = agentToolsConfig[tool.key];
                    return (
                      <button
                        key={tool.key}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                          isDisabledByLite
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-[var(--ide-surface)] cursor-pointer"
                        }`}
                        onClick={() => {
                          if (isDisabledByLite) return;
                          updateAgentToolsConfig({ [tool.key]: !agentToolsConfig[tool.key] });
                        }}
                        data-testid={`toggle-agent-tool-${tool.key}`}
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${tool.color}15` }}>
                          <tool.icon className="w-3.5 h-3.5" style={{ color: tool.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-[var(--ide-text)]">{tool.label}</div>
                          <div className="text-[9px] text-[var(--ide-text-muted)]">
                            {isDisabledByLite ? "Disabled in Lite Mode" : tool.desc}
                          </div>
                        </div>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center ${
                          isActive && !isDisabledByLite ? "bg-[#0CCE6B] justify-end" : "bg-[var(--ide-border)] justify-start"
                        }`}>
                          <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-900 mx-0.5 shadow-sm" />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 py-1.5 border-t border-[var(--ide-border)]">
                  <span className="text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Audio Output</span>
                </div>
                <div className="p-2 space-y-1">
                  <button
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all hover:bg-[var(--ide-surface)] cursor-pointer"
                    onClick={toggleAudioOutput}
                    data-testid="toggle-audio-output"
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-[#7C65CB]/15">
                      <Volume2 className="w-3.5 h-3.5 text-[#7C65CB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-[var(--ide-text)]">Audio Responses</div>
                      <div className="text-[9px] text-[var(--ide-text-muted)]">Auto-play voice with responses</div>
                    </div>
                    <div className={`w-7 h-4 rounded-full transition-colors flex items-center ${
                      audioOutputEnabled ? "bg-[#0CCE6B] justify-end" : "bg-[var(--ide-border)] justify-start"
                    }`}>
                      <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-900 mx-0.5 shadow-sm" />
                    </div>
                  </button>
                  <div className="px-2.5 pt-1">
                    <div className="text-[9px] text-[var(--ide-text-muted)] mb-1.5">Voice</div>
                    <div className="grid grid-cols-3 gap-1">
                      {VOICE_OPTIONS.map((v) => (
                        <button
                          key={v.value}
                          className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all text-center ${
                            selectedVoice === v.value
                              ? "bg-[#7C65CB]/20 text-[#7C65CB] ring-1 ring-[#7C65CB]/30"
                              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                          }`}
                          onClick={() => handleVoiceChange(v.value)}
                          title={v.desc}
                          data-testid={`voice-option-${v.value}`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {activeMessages.length > 0 && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => {
              if (topMode === "plan") {
                setPlanMessages([]);
                if (currentPlan) {
                  const csrfToken = getCsrfToken();
                  const h: Record<string, string> = {};
                  if (csrfToken) h["X-CSRF-Token"] = csrfToken;
                  fetch(`/api/ai/plans/${projectId}`, { method: "DELETE", credentials: "include", headers: h }).catch(() => {});
                  setCurrentPlan(null);
                }
              } else {
                setMessages([]);
                if (projectId) {
                  const ct = getCsrfToken();
                  const h: Record<string, string> = {};
                  if (ct) h["X-CSRF-Token"] = ct;
                  fetch(`/api/ai/conversations/${projectId}`, { method: "DELETE", credentials: "include", headers: h }).catch(() => {});
                }
              }
            }} title="Clear chat" data-testid="button-clear-chat">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={onClose} data-testid="button-close-ai">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {context && topMode === "build" && mode === "chat" && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-bg)]/50 text-[10px] text-[var(--ide-text-secondary)] shrink-0">
          <FileCode className="w-3 h-3 text-[var(--ide-text-muted)]" />
          <span className="px-1.5 py-0.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text)] font-mono">{context.filename}</span>
          <span className="text-[var(--ide-text-muted)]">{context.language}</span>
        </div>
      )}

      {topMode === "build" && mode === "agent" && (
        <div className="flex items-center gap-2 px-3 py-2 border-b text-[10px] shrink-0 flex-wrap"
          style={{
            borderColor: `${TOP_AGENT_MODE_LABELS[topAgentMode].color}15`,
            background: `linear-gradient(to right, ${TOP_AGENT_MODE_LABELS[topAgentMode].color}10, ${TOP_AGENT_MODE_LABELS[topAgentMode].color}05)`,
            color: TOP_AGENT_MODE_LABELS[topAgentMode].color,
          }}
        >
          <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: `${TOP_AGENT_MODE_LABELS[topAgentMode].color}20` }}>
            {(() => { const MIcon = TOP_AGENT_MODE_LABELS[topAgentMode].icon; return <MIcon className="w-2.5 h-2.5" />; })()}
          </div>
          <span className="font-medium">{TOP_AGENT_MODE_LABELS[topAgentMode].name} mode</span>
          {topAgentMode === "autonomous" && (
            <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: `${AUTONOMOUS_TIER_LABELS[autonomousTier].color}15` }}>
              {AUTONOMOUS_TIER_LABELS[autonomousTier].name}
            </span>
          )}
          {agentToolsConfig.turbo && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B]">Turbo</span>
          )}
          <span style={{ opacity: 0.6 }}>—</span>
          <span style={{ opacity: 0.7 }}>{TOP_AGENT_MODE_LABELS[topAgentMode].description}</span>
        </div>
      )}

      {topMode === "plan" && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#009118]/15 bg-gradient-to-r from-[#009118]/10 to-[#009118]/5 text-[10px] text-[#009118] shrink-0">
          <div className="w-4 h-4 rounded bg-[#009118]/20 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path fill="#009118" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
              <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
            </svg>
          </div>
          <span className="font-medium">Build in Parallel</span>
          <span className="text-[#009118]/60">—</span>
          <span className="text-[#009118]/70">Agent breaks work into parallel tasks</span>
        </div>
      )}

      {topMode === "build" && approvedPlanTasks && approvedPlanTasks.length > 0 && (
        <PlanTaskChecklist
          tasks={approvedPlanTasks}
          onTaskStatusChange={handlePlanTaskStatusChange}
        />
      )}

      {topMode === "plan" && showTaskBoard && projectId && (
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>}>
            <LazyTaskBoard projectId={projectId} onClose={() => setShowTaskBoard(false)} />
          </Suspense>
        </div>
      )}

      {topMode === "plan" && !showTaskBoard && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
          {proposedTasks.length === 0 && !planLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-[fade-in_0.4s_ease-out]">
              <div className="w-14 h-14 rounded-2xl bg-[#009118]/10 flex items-center justify-center mb-5 ring-1 ring-[#009118]/15">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path fill="#009118" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
                  <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
                </svg>
              </div>
              <p className="text-[17px] font-medium text-[var(--ide-text)] mb-1.5" data-testid="text-plan-title">
                Build in Parallel
              </p>
              <p className="text-[13px] text-[var(--ide-text-secondary)] max-w-[320px] leading-relaxed mb-5">
                Describe what you want to build. Agent will break it into discrete tasks that run simultaneously in isolated copies of your project.
              </p>
              {projectId && (
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[13px] text-[var(--ide-text)] hover:border-[#009118]/30 transition-colors"
                  onClick={() => setShowTaskBoard(true)}
                  data-testid="button-view-tasks"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="5.332" cy="5.338" r="5.332" fill="#A6A6A6" />
                    <circle cx="18.663" cy="5.338" r="5.332" fill="#A6A6A6" />
                    <circle cx="5.332" cy="18.668" r="5.332" fill="#A6A6A6" />
                    <circle cx="18.663" cy="18.668" r="5.332" fill="#A6A6A6" />
                  </svg>
                  View Task Board
                </button>
              )}
            </div>
          )}
          {planLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-3 animate-spin" style={{ animationDuration: "2s" }}>
                <circle cx="5.332" cy="5.338" r="5.332" fill="#A8D4FF" />
                <circle cx="18.663" cy="5.338" r="5.332" fill="#57ABFF" />
                <circle cx="5.332" cy="18.668" r="5.332" fill="#57ABFF" />
                <circle cx="18.663" cy="18.668" r="5.332" fill="#A8D4FF" />
                <path fill="#57ABFF" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
              </svg>
              <p className="text-[13px] text-[var(--ide-text-muted)]">Analyzing and creating tasks...</p>
            </div>
          )}
          {proposedTasks.length > 0 && (
            <div className="space-y-3 animate-[fade-in_0.3s_ease-out]">
              {/* Task plans created header */}
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path fill="#009118" d="M18.662 0a5.332 5.332 0 0 1 .001 10.664l-.412.01a8 8 0 0 0-7.577 7.59l-.01.398-.008.274A5.331 5.331 0 0 1 0 18.662a5.332 5.332 0 0 1 5.332-5.332l.398-.01a8 8 0 0 0 7.59-7.576l.011-.412A5.331 5.331 0 0 1 18.662 0Z" />
                    <path fill="#6CD97E" d="m18.663 13.33.273.007a5.332 5.332 0 1 1-5.598 5.6l-.007-.275.006-.265a5.38 5.38 0 0 1 .137-.963c.006-.026.01-.052.017-.078a5.34 5.34 0 0 1 .485-.074c.011 0 .023-.003.034-.005.09-.009.18-.014.27-.02l.274-.006ZM5.332 0a5.332 5.332 0 0 1 5.332 5.332l-.008.274a5.332 5.332 0 0 1-5.324 5.058l-.274-.007A5.332 5.332 0 0 1 5.332 0Z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[14px] font-medium text-[var(--ide-text)]">Task plans created</span>
                  <span className="text-[12px] text-[var(--ide-text-muted)] ml-2">{proposedTasks.length} tasks</span>
                </div>
              </div>

              {/* Task cards */}
              {proposedTasks.map((task: any, i: number) => (
                <ProposedTaskCard key={task.id || i} task={task} index={i} />
              ))}

              {/* Accept / Revise buttons (Replit-style) */}
              <div className="flex gap-2 pt-1">
                <button
                  className="h-9 px-5 rounded-lg bg-[var(--ide-bg)] text-[var(--ide-text)] text-[13px] border border-[var(--ide-border)] hover:bg-[var(--ide-surface)] transition-colors"
                  onClick={async () => {
                    if (projectId && proposedTasks.length > 0) {
                      try {
                        const ct = getCsrfToken();
                        const headers: Record<string, string> = { "Content-Type": "application/json" };
                        if (ct) headers["X-CSRF-Token"] = ct;
                        await fetch(`/api/projects/${projectId}/tasks/discard-proposed`, {
                          method: "POST", credentials: "include", headers,
                          body: JSON.stringify({ taskIds: proposedTasks.map((t: any) => t.id) }),
                        });
                      } catch {}
                    }
                    setProposedTasks([]);
                  }}
                  data-testid="button-discard-plan"
                >
                  Revise plan
                </button>
                <button
                  className="flex-1 h-9 rounded-lg text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: "hsla(140, 50%, 33%, 1)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "hsla(140, 50%, 28%, 1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsla(140, 50%, 33%, 1)")}
                  onClick={acceptProposedTasks}
                  data-testid="button-accept-plan"
                >
                  Accept tasks
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 space-y-4 ${topMode === "plan" ? "hidden" : ""}`}>
        {activeMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-[fade-in_0.4s_ease-out]">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ring-1 shadow-lg ${
              topMode === "plan"
                ? "bg-gradient-to-br from-[#F59E0B]/25 to-[#F59E0B]/5 ring-[#F59E0B]/20 shadow-[#F59E0B]/10"
                : "bg-gradient-to-br from-[#7C65CB]/25 to-[#7C65CB]/5 ring-[#7C65CB]/20 shadow-[#7C65CB]/10"
            }`}>
              {topMode === "plan"
                ? <Map className="w-8 h-8 text-[#F59E0B]" />
                : mode === "agent" ? <Bot className="w-8 h-8 text-[#7C65CB]" /> : <Sparkles className="w-8 h-8 text-[#7C65CB]" />
              }
            </div>
            <p className="text-[17px] font-bold text-[var(--ide-text)] mb-1.5 tracking-tight" data-testid="text-ai-title">
              {topMode === "plan"
                ? "What do you want to plan?"
                : mode === "agent" ? "What do you want to build?" : "AI Assistant"
              }
            </p>
            <p className="text-[12px] text-[var(--ide-text-secondary)] max-w-[320px] leading-relaxed mb-6">
              {topMode === "plan"
                ? "Describe your idea and I'll create a structured plan with tasks, dependencies, and complexity estimates."
                : mode === "agent"
                ? "Describe your idea and I'll build it — creating files, writing code, and setting up your project automatically."
                : "I can help you write code, debug issues, explain concepts, and suggest improvements."
              }
            </p>
            <div className="w-full max-w-[360px] grid grid-cols-2 gap-2.5">
              {activeSuggestions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="flex items-start gap-2.5 w-full text-left px-3 py-2.5 rounded-lg bg-[var(--ide-bg)]/80 border border-[var(--ide-border)]/60 text-xs text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:border-[#7C65CB]/30 hover:bg-[var(--ide-bg)] hover:-translate-y-0.5 hover:shadow-md transition-all group"
                    onClick={() => { setInput(item.label); inputRef.current?.focus(); }}
                    data-testid={`suggestion-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-[var(--ide-surface)]/40 flex items-center justify-center shrink-0 group-hover:bg-[#7C65CB]/15 transition-colors">
                      <Icon className="w-3.5 h-3.5 group-hover:text-[#7C65CB] transition-colors" />
                    </div>
                    <div className="flex flex-col min-w-0 pt-0.5">
                      <span className="text-[11px] font-medium leading-tight truncate">{item.label}</span>
                      <span className="text-[9px] text-[var(--ide-text-muted)] mt-0.5">{item.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {activeMessages.map((msg, idx) => {
          const msgModel = msg.model ? MODEL_LABELS[msg.model] : null;
          const MsgModelIcon = msgModel?.icon || Sparkles;
          return (
            <div key={msg.id} className={`flex gap-2.5 animate-[fade-in_0.2s_ease-out] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "assistant" ? "bg-[var(--ide-surface)] border border-[var(--ide-border)]" : "bg-[#0079F2]"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-[var(--ide-text-secondary)]" /> : <User className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className={`max-w-[82%] rounded-xl text-[13px] leading-relaxed px-3.5 py-2.5 ${
                msg.role === "user"
                  ? "bg-[#0079F2]/10 border border-[#0079F2]/15 text-[var(--ide-text)]"
                  : "bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text)]"
              }`}>
                {msg.role === "assistant" && msgModel && (
                  <div className="flex items-center gap-1.5 mb-1.5" data-testid={`badge-model-${msg.model}`}>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${msgModel.color}`}>
                      <MsgModelIcon className="w-2.5 h-2.5" />
                      {msgModel.name}
                    </span>
                  </div>
                )}
                {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.attachments.map((a) => (
                      <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--ide-surface)]/50 border border-[var(--ide-border)]/50 text-[10px] text-[var(--ide-text-muted)]">
                        {a.type === "image" ? (
                          <img src={a.content} alt={a.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        <span className="truncate max-w-[100px]">{a.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.content ? renderContent(msg.content, msg.fileOps, msg.inlineImages, msg.generatedFiles, msg.imageSearchResults, msg.generatedAudio) : <TypingIndicator />}
                {msg.role === "assistant" && msg.mcpToolCalls && msg.mcpToolCalls.length > 0 && (
                  <McpToolCallTimeline calls={msg.mcpToolCalls} />
                )}
                {msg.role === "assistant" && msg.webSearchResults && msg.webSearchResults.length > 0 && (
                  <WebSearchCitations results={msg.webSearchResults} />
                )}
                {msg.role === "assistant" && figmaMcpEvents.length > 0 && idx === messages.length - 1 && msg.content.includes("Figma MCP") && (
                  <div className="mt-3">
                    <FigmaDesignCard
                      url={detectedFigmaUrl || ""}
                      connection={figmaConnection}
                      onConnect={handleFigmaConnect}
                      onDisconnect={handleFigmaDisconnect}
                      events={figmaMcpEvents}
                    />
                  </div>
                )}
                {msg.role === "user" && detectFigmaUrl(msg.content) && (
                  <div className="mt-2">
                    <FigmaLinkIndicator url={detectFigmaUrl(msg.content)!} />
                  </div>
                )}
                {msg.role === "assistant" && msg.audioChunks && msg.audioChunks.length > 0 && (
                  <InlineAudioPlayer audioChunks={msg.audioChunks} messageId={msg.id} />
                )}
                {msg.role === "assistant" && msg.content && !msg.content.includes("⚠️") && msg.content.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <button
                      onClick={() => readAloud(msg.content.replace(/```[\s\S]*?```/g, "").replace(/[#*_`>\[\]()!]/g, "").trim(), msg.id)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all ${
                        readAloudMsgId === msg.id && isAudioStreaming
                          ? "bg-[#7C65CB]/20 text-[#7C65CB]"
                          : "text-[var(--ide-text-muted)] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10"
                      }`}
                      disabled={isStreaming}
                      title={readAloudMsgId === msg.id && isAudioStreaming ? "Stop reading" : "Read aloud"}
                      data-testid={`button-read-aloud-${msg.id}`}
                    >
                      {readAloudMsgId === msg.id && isAudioStreaming ? (
                        <><VolumeX className="w-3 h-3" /> Stop</>
                      ) : (
                        <><Volume2 className="w-3 h-3" /> Read aloud</>
                      )}
                    </button>
                  </div>
                )}
                {msg.role === "assistant" && lastFailedInput && idx === messages.length - 1 && msg.content.includes("⚠️") && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] font-medium transition-colors"
                      onClick={retryLastMessage}
                      data-testid="button-ai-retry-message"
                    >
                      <Zap className="w-3 h-3" /> Retry
                    </button>
                    <span className="text-[10px] text-[var(--ide-text-muted)]">or try a different model</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!hideInput && <div className="p-2.5 border-t border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        {queuedMessages.length > 0 && (
          <div className="mb-2 rounded-lg border border-[#7C65CB]/20 bg-[#7C65CB]/5 overflow-hidden" data-testid="queue-drawer">
            <button
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-[#7C65CB] hover:bg-[#7C65CB]/10 transition-colors"
              onClick={() => setIsQueueDrawerOpen(!isQueueDrawerOpen)}
              data-testid="button-toggle-queue"
            >
              <span className="flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5" />
                Queue ({queuedMessages.length} message{queuedMessages.length > 1 ? "s" : ""})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  className="px-2 py-0.5 rounded text-[9px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  onClick={(e) => { e.stopPropagation(); clearQueue(); }}
                  data-testid="button-clear-queue"
                >
                  Clear all
                </button>
                <ChevronUp className={`w-3.5 h-3.5 transition-transform ${isQueueDrawerOpen ? "" : "rotate-180"}`} />
              </div>
            </button>
            {isQueueDrawerOpen && (
              <div className="max-h-[200px] overflow-y-auto border-t border-[#7C65CB]/10">
                {queuedMessages.map((qMsg, idx) => (
                  <div
                    key={qMsg.id}
                    className={`flex items-start gap-1.5 px-2 py-1.5 text-[11px] border-b border-[#7C65CB]/5 last:border-b-0 transition-colors ${dragOverIndex === idx ? "bg-[#7C65CB]/15" : "hover:bg-[#7C65CB]/5"}`}
                    draggable
                    onDragStart={() => { dragItemRef.current = idx; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverIndex(null);
                      if (dragItemRef.current !== null && dragItemRef.current !== idx) {
                        reorderQueue(dragItemRef.current, idx);
                      }
                      dragItemRef.current = null;
                    }}
                    onDragEnd={() => { dragItemRef.current = null; setDragOverIndex(null); }}
                    data-testid={`queue-item-${qMsg.id}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing pt-0.5 text-[var(--ide-text-muted)] hover:text-[#7C65CB] touch-none" data-testid={`drag-handle-${qMsg.id}`}>
                      <GripVertical className="w-3 h-3" />
                    </div>
                    <span className="text-[9px] font-mono text-[#7C65CB]/60 pt-0.5 shrink-0">{idx + 1}</span>
                    {editingQueueId === qMsg.id ? (
                      <div className="flex-1 flex gap-1">
                        <textarea
                          className="flex-1 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-[11px] text-[var(--ide-text)] resize-none min-h-[28px] focus:outline-none focus:border-[#7C65CB]/40"
                          value={editingQueueContent}
                          onChange={(e) => setEditingQueueContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              updateQueueItem(qMsg.id, editingQueueContent);
                            }
                            if (e.key === "Escape") setEditingQueueId(null);
                          }}
                          autoFocus
                          data-testid={`input-edit-queue-${qMsg.id}`}
                        />
                        <button
                          className="px-1.5 py-0.5 rounded bg-[#7C65CB] text-white text-[9px] hover:bg-[#6B56B8] transition-colors shrink-0"
                          onClick={() => updateQueueItem(qMsg.id, editingQueueContent)}
                          data-testid={`button-save-queue-${qMsg.id}`}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span className="flex-1 text-[var(--ide-text-secondary)] truncate pt-0.5">{qMsg.content}</span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {idx > 0 && (
                        <button
                          className="w-5 h-5 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10 transition-colors"
                          onClick={() => reorderQueue(idx, idx - 1)}
                          title="Move up"
                          data-testid={`button-moveup-queue-${qMsg.id}`}
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {idx < queuedMessages.length - 1 && (
                        <button
                          className="w-5 h-5 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10 transition-colors rotate-180"
                          onClick={() => reorderQueue(idx, idx + 1)}
                          title="Move down"
                          data-testid={`button-movedown-queue-${qMsg.id}`}
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10 transition-colors"
                        onClick={() => { setEditingQueueId(qMsg.id); setEditingQueueContent(qMsg.content); }}
                        title="Edit"
                        data-testid={`button-edit-queue-${qMsg.id}`}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={() => removeFromQueue(qMsg.id)}
                        title="Remove"
                        data-testid={`button-delete-queue-${qMsg.id}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {topMode === "build" && selectedArtifactType && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            <ArtifactTypePill
              type={selectedArtifactType}
              onRemove={() => setSelectedArtifactType(null)}
              size="sm"
            />
          </div>
        )}
        {topMode === "build" && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((a) => (
              <div key={a.id} className="relative group flex items-center gap-1.5 pl-2 pr-7 py-1.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[11px] text-[var(--ide-text-secondary)] max-w-[180px]">
                {a.type === "image" ? (
                  <img src={a.content} alt={a.name} className="w-6 h-6 rounded object-cover shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--ide-text-muted)]" />
                )}
                <span className="truncate text-[10px]">{a.name}</span>
                <span className="text-[8px] text-[var(--ide-text-muted)]">({formatFileSize(a.size)})</span>
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--ide-text-muted)] hover:text-red-400"
                  onClick={() => removeAttachment(a.id)}
                  data-testid={`button-remove-attachment-${a.id}`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*,.txt,.js,.ts,.tsx,.jsx,.py,.json,.css,.html,.md,.yaml,.yml,.xml,.csv,.sql,.sh,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.log,.env,.toml,.cfg"
          onChange={handleFileAttachment}
          data-testid="input-file-attachment"
        />
        {detectedFigmaUrl && showFigmaCard && (
          <div className="mb-2">
            <FigmaDesignCard
              url={detectedFigmaUrl}
              connection={figmaConnection}
              onConnect={handleFigmaConnect}
              onDisconnect={handleFigmaDisconnect}
              events={figmaMcpEvents}
              onDismiss={() => setShowFigmaCard(false)}
            />
          </div>
        )}
        {detectedFigmaUrl && !showFigmaCard && (
          <div className="mb-2 cursor-pointer" onClick={() => setShowFigmaCard(true)}>
            <FigmaLinkIndicator url={detectedFigmaUrl} />
          </div>
        )}
        {showImageDialog && (
          <div className="mb-2 rounded-lg border border-[#7C65CB]/30 bg-[var(--ide-bg)] p-3 animate-[slide-in_0.2s_ease-out]">
            <div className="flex items-center gap-2 mb-2">
              <ImagePlus className="w-4 h-4 text-[#7C65CB]" />
              <span className="text-[12px] font-medium text-[var(--ide-text)]">Generate Image</span>
              <button
                className="ml-auto text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                onClick={() => setShowImageDialog(false)}
                data-testid="button-close-image-dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && imagePrompt.trim()) {
                  generateImage(imagePrompt.trim(), imageSize);
                  setImagePrompt("");
                  setShowImageDialog(false);
                }
              }}
              placeholder="Describe the image you want..."
              className="w-full bg-[var(--ide-surface)] text-[12px] text-[var(--ide-text)] rounded-md px-3 py-2 mb-2 placeholder:text-[var(--ide-text-muted)]/70 focus:outline-none focus:ring-1 focus:ring-[#7C65CB]/30 border border-[var(--ide-border)]"
              data-testid="input-image-prompt"
            />
            <div className="flex items-center gap-2">
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                className="bg-[var(--ide-surface)] text-[11px] text-[var(--ide-text-secondary)] rounded-md px-2 py-1.5 border border-[var(--ide-border)] focus:outline-none focus:ring-1 focus:ring-[#7C65CB]/30"
                data-testid="select-image-size"
              >
                <option value="1024x1024">Square (1024x1024)</option>
                <option value="1024x1536">Portrait (1024x1536)</option>
                <option value="1536x1024">Landscape (1536x1024)</option>
                <option value="auto">Auto</option>
              </select>
              <button
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#7C65CB] hover:bg-[#6B56B8] text-white text-[11px] font-medium transition-colors disabled:opacity-40"
                disabled={!imagePrompt.trim() || isGeneratingImage}
                onClick={() => {
                  if (imagePrompt.trim()) {
                    generateImage(imagePrompt.trim(), imageSize);
                    setImagePrompt("");
                    setShowImageDialog(false);
                  }
                }}
                data-testid="button-submit-image"
              >
                {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                Generate
              </button>
            </div>
          </div>
        )}
        <div className="relative rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]/50 focus-within:border-[#7C65CB]/40 focus-within:ring-1 focus-within:ring-[#7C65CB]/15 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              topMode === "plan"
                ? "Describe what to build in parallel..."
                : isGeneratingImage ? "Generating image..." : isTranscribing ? "Transcribing audio..." : isRecording ? "Recording... click mic to stop" : isStreaming ? "Message Agent..." : liteMode && mode === "agent" ? "Quick, lightweight changes" : "Ask AI anything..."
            }
            rows={3}
            className="w-full bg-transparent text-[13px] text-[var(--ide-text)] rounded-xl px-3.5 py-2.5 pr-12 resize-none placeholder:text-[var(--ide-text-muted)]/80 focus:outline-none min-h-[68px] max-h-[160px]"
            disabled={isTranscribing || isGeneratingImage}
            data-testid="input-ai-chat"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {mode === "agent" && projectId && !isStreaming && (
              <button
                onClick={toggleLiteMode}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  liteMode
                    ? "bg-[#F5A623] text-white shadow-sm shadow-[#F5A623]/30"
                    : "text-[var(--ide-text-muted)] hover:text-[#F5A623] hover:bg-[#F5A623]/10"
                }`}
                title={liteMode ? "Lite Mode active — click to switch to full Agent" : "Switch to Lite Mode for quick changes"}
                data-testid="button-lite-mode"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}
            {isStreaming ? (
              <Button
                onClick={queuedMessages.length > 0 ? pauseQueue : stopStreaming}
                size="icon"
                className="w-7 h-7 bg-red-500/90 hover:bg-red-600 rounded-full shadow-sm"
                data-testid="button-ai-pause"
                title={queuedMessages.length > 0 ? "Pause queue & stop" : "Stop"}
              >
                {queuedMessages.length > 0 ? <Pause className="w-3.5 h-3.5 text-white" /> : <X className="w-3.5 h-3.5 text-white" />}
              </Button>
            ) : (
              <Button
                onClick={sendMessage}
                size="icon"
                className={`w-7 h-7 rounded-full shadow-sm disabled:opacity-30 disabled:shadow-none ${
                  topMode === "plan"
                    ? "bg-[#F59E0B] hover:bg-[#D97706] shadow-[#F59E0B]/20"
                    : "bg-[#7C65CB] hover:bg-[#6B56B8] shadow-[#7C65CB]/20"
                }`}
                disabled={!input.trim() && attachments.length === 0}
                data-testid="button-ai-send"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </Button>
            )}
          </div>
        </div>
        {isStreaming && (
          <div className="flex items-center justify-between mt-1 px-0.5">
            <div className="flex items-center gap-1.5">
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
                title="Attach file"
                data-testid="button-queue-attach"
              >
                <Paperclip className="w-3 h-3" />
              </button>
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
                title="Edit settings"
                data-testid="button-queue-settings"
              >
                <Settings2 className="w-3 h-3" />
                Edit
              </button>
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
                title="Adjust parameters"
                data-testid="button-queue-adjust"
              >
                <SlidersHorizontal className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={() => { if (input.trim()) sendMessage(); }}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:border-[#7C65CB]/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="button-add-to-queue"
            >
              Add to Queue
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-1.5 px-1.5">
          <div className="flex items-center gap-1">
            {projectId && (
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                        topMode === "build"
                          ? "bg-[#7C65CB]/15 text-[#7C65CB]"
                          : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                      }`}
                      data-testid="mode-build"
                    >
                      <Hammer className="w-3 h-3" />
                      Build
                      <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)] p-1">
                    <DropdownMenuItem
                      className="gap-2.5 text-xs text-[var(--ide-text)] focus:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                      onClick={() => { setTopMode("build"); setMode("agent"); }}
                      data-testid="mode-build-agent"
                    >
                      <Bot className="w-3.5 h-3.5 text-[#7C65CB]" />
                      <div className="flex flex-col">
                        <span className="font-medium">Agent</span>
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Autonomous coding agent</span>
                      </div>
                      {topMode === "build" && mode === "agent" && <Check className="w-3.5 h-3.5 shrink-0 text-[#0CCE6B] ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2.5 text-xs text-[var(--ide-text)] focus:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                      onClick={() => { setTopMode("build"); setMode("chat"); }}
                      data-testid="mode-build-chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#0CCE6B]" />
                      <div className="flex flex-col">
                        <span className="font-medium">Chat</span>
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Ask questions, get help</span>
                      </div>
                      {topMode === "build" && mode === "chat" && <Check className="w-3.5 h-3.5 shrink-0 text-[#0CCE6B] ml-auto" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${modelInfo.color} hover:opacity-80 transition-opacity`} data-testid="button-model-select">
                      <ModelIcon className="w-2.5 h-2.5" />
                      {model === "openrouter" ? (openrouterModels.find(m => m.id === openrouterModel)?.name || openrouterModel.split("/").pop() || "OpenRouter") : modelInfo.name}
                      <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)] p-1">
                    {([
                      { key: "claude" as AIModel, name: "Claude Sonnet", badge: "Anthropic", color: "#7C65CB", icon: Sparkles, byokOnly: false },
                      { key: "gpt" as AIModel, name: "GPT-4o", badge: "OpenAI", color: "#0CCE6B", icon: Zap, byokOnly: false },
                      { key: "gemini" as AIModel, name: "Gemini Flash", badge: "Google", color: "#4285F4", icon: Zap, byokOnly: false },
                      { key: "openrouter" as AIModel, name: "OpenRouter", badge: "200+ Models", color: "#E44D26", icon: Globe, byokOnly: false },
                      { key: "perplexity" as AIModel, name: "Perplexity", badge: "Search AI (BYOK)", color: "#20808D", icon: Search, byokOnly: true },
                      { key: "mistral" as AIModel, name: "Mistral", badge: "Mistral AI (BYOK)", color: "#FF7000", icon: Zap, byokOnly: true },
                    ]).filter(m => {
                      if (!m.byokOnly) return true;
                      const cred = getCredLabel(m.key);
                      return !cred.isManaged || (credentialModes[m.key]?.hasApiKey);
                    }).map(m => {
                      const cred = getCredLabel(m.key);
                      const MdlIcon = m.icon;
                      return (
                        <DropdownMenuItem key={m.key} className="gap-2.5 text-xs text-[var(--ide-text)] focus:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => { setModel(m.key); if (m.key === "openrouter") setShowOpenrouterPicker(true); }} data-testid={`model-${m.key}`}>
                          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${m.color}15` }}>
                            <MdlIcon className="w-3 h-3" style={{ color: m.color }} />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium">{m.name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-[var(--ide-text-muted)]">{m.badge}</span>
                              {projectId && (
                                <span className={`text-[9px] px-1 rounded ${cred.isManaged ? "bg-[#0079F2]/10 text-[#0079F2]" : "bg-[#0CCE6B]/10 text-[#0CCE6B]"}`} data-testid={`cred-label-${m.key}`}>
                                  {cred.isManaged ? "Vibe Companion managed" : "Your key"}
                                </span>
                              )}
                            </div>
                          </div>
                          {model === m.key && <Check className="w-3.5 h-3.5 shrink-0 text-[#0CCE6B]" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className={`relative rounded-md ${topMode === "plan" ? "p-[1px]" : ""}`}
                  style={topMode === "plan" ? {
                    background: "linear-gradient(135deg, #F59E0B, #EF4444, #8B5CF6, #0079F2, #F59E0B)",
                    backgroundSize: "300% 300%",
                    animation: "gradient-spin 3s ease infinite",
                  } : {}}
                >
                  <button
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                      topMode === "plan"
                        ? "bg-[var(--ide-panel)] text-[#F59E0B]"
                        : "text-[var(--ide-text-muted)] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    }`}
                    onClick={() => setTopMode("plan")}
                    data-testid="mode-plan-button"
                  >
                    <Map className="w-3 h-3" />
                    Plan
                  </button>
                </div>
              </div>
            )}
            {topMode === "build" && (
              <>
                <button
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : isTranscribing
                      ? "bg-[#7C65CB]/20 text-[#7C65CB] animate-pulse"
                      : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                  }`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isStreaming || isTranscribing}
                  title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Voice input"}
                  data-testid="button-ai-mic"
                >
                  {isRecording ? <MicOff className="w-3 h-3" /> : isTranscribing ? <Mic className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                </button>
                <button
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  title="Attach files"
                  data-testid="button-ai-attach"
                >
                  <Paperclip className="w-3 h-3" />
                </button>
                <button
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isGeneratingImage
                      ? "bg-[#7C65CB]/20 text-[#7C65CB] animate-pulse"
                      : showImageDialog
                      ? "bg-[#7C65CB]/20 text-[#7C65CB]"
                      : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                  }`}
                  onClick={() => setShowImageDialog(!showImageDialog)}
                  disabled={isStreaming || isGeneratingImage}
                  title={isGeneratingImage ? "Generating image..." : "Generate image (or type /image <prompt>)"}
                  data-testid="button-ai-generate-image"
                >
                  {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                </button>
                <button
                  onClick={toggleAudioOutput}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    audioOutputEnabled
                      ? "bg-[#7C65CB] text-white shadow-sm shadow-[#7C65CB]/30"
                      : "text-[var(--ide-text-muted)] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10"
                  }`}
                  title={audioOutputEnabled ? `Audio responses ON (${selectedVoice}) — click to disable` : "Enable audio responses"}
                  data-testid="button-audio-toggle"
                >
                  {audioOutputEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                </button>
                {mode === "agent" && projectId && !liteMode && (
                  <button
                    onClick={() => updateAgentToolsConfig({ webSearch: !agentToolsConfig.webSearch })}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      agentToolsConfig.webSearch
                        ? "bg-[#0079F2] text-white shadow-sm shadow-[#0079F2]/30"
                        : "text-[var(--ide-text-muted)] hover:text-[#0079F2] hover:bg-[#0079F2]/10"
                    }`}
                    title={agentToolsConfig.webSearch ? "Web Search enabled — click to disable" : "Enable Web Search for real-time information"}
                    data-testid="button-web-search-toggle"
                  >
                    <Globe className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
            {topMode === "build" && (
              <span className="text-[9px] text-[var(--ide-text-muted)] ml-1">
                {isRecording ? "Recording..." : isTranscribing ? "Transcribing..." : isGeneratingImage ? "Generating image..." : agentToolsConfig.webSearch ? "Shift+Enter · /image · /search" : "Shift+Enter · /image for AI images"}
              </span>
            )}
            {topMode === "plan" && (
              <span className="text-[9px] text-[var(--ide-text-muted)] ml-1">
                Shift+Enter for new line
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPaused && queuedMessages.length > 0 ? (
              <button
                onClick={resumeQueue}
                className="flex items-center gap-1.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                data-testid="button-resume-queue"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Paused — click to resume ({queuedMessages.length} queued)
              </button>
            ) : isStreaming ? (
              <span className={`flex items-center gap-1.5 text-[10px] ${topMode === "plan" ? "text-[#F59E0B]" : "text-[#7C65CB]"}`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${topMode === "plan" ? "bg-[#F59E0B]" : "bg-[#7C65CB]"}`} />
                {topMode === "plan" ? "Planning..." : `Generating${queuedMessages.length > 0 ? ` · ${queuedMessages.length} queued` : ""}...`}
              </span>
            ) : (
              <span className={`text-[9px] ${input.length > 3800 ? "text-red-400" : "text-[var(--ide-text-muted)]"}`} data-testid="text-char-count">
                {attachments.length > 0 && `${attachments.length} file${attachments.length > 1 ? "s" : ""} · `}
                {input.length > 0 ? `${input.length.toLocaleString()} chars` : ""}
              </span>
            )}
          </div>
        </div>
        {topMode === "build" && messages.length === 0 && !isStreaming && (
          <div className="mt-2">
            <ArtifactTypeCarousel
              selectedType={selectedArtifactType}
              onSelectType={setSelectedArtifactType}
              size="sm"
            />
          </div>
        )}
      </div>}

      {showManagedApproval && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-xl" data-testid="dialog-managed-approval">
          <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#0079F2]/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#0079F2]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--ide-text)]">AI Credentials</h3>
                <p className="text-[10px] text-[var(--ide-text-muted)]">{showManagedApproval.providerLabel}</p>
              </div>
            </div>
            <p className="text-[12px] text-[var(--ide-text-secondary)] mb-3 leading-relaxed">
              Choose how to authenticate with <strong>{showManagedApproval.providerLabel}</strong> for this project. Managed credentials are billed to your platform credits at public API prices.
            </p>
            <div className="mb-3">
              <label className="text-[11px] text-[var(--ide-text-muted)] block mb-1">Or enter your own API key (stored in project Secrets):</label>
              <input
                type="password"
                placeholder="sk-..."
                value={byokKeyInput}
                onChange={e => setByokKeyInput(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[12px] text-[var(--ide-text)] placeholder-[var(--ide-text-muted)] outline-none focus:border-[#0079F2]"
                data-testid="input-byok-key"
              />
              <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">
                Key will be saved as {BYOK_SECRET_NAMES[showManagedApproval.provider] || "API_KEY"} in Secrets
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex-1 h-8 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] font-medium transition-colors"
                onClick={() => handleApproveManaged(showManagedApproval.provider)}
                data-testid="button-approve-managed"
              >
                Approve
              </button>
              <button
                className="flex-1 h-8 rounded-lg bg-[var(--ide-surface)] hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)] text-[12px] font-medium transition-colors border border-[var(--ide-border)]"
                onClick={() => handleDismissManaged(showManagedApproval.provider)}
                data-testid="button-dismiss-managed"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIPanel(props: AIPanelProps) {
  return (
    <AIPanelErrorBoundary onClose={props.onClose}>
      <AIPanelInner {...props} />
    </AIPanelErrorBoundary>
  );
}
