import React, { useState } from "react";
import {
  Figma, LogIn, LogOut, ExternalLink, ChevronDown, ChevronRight,
  Layers, Eye, Code2, Image, AlertTriangle, CheckCircle2, Loader2, X,
  Palette, Variable, Grid3X3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FigmaConnection {
  connected: boolean;
  username?: string;
  plan?: string;
  callsUsed?: number;
  callsLimit?: number;
  callsRemaining?: number;
}

interface FigmaMcpEvent {
  id: string;
  tool: string;
  timestamp: number;
  input?: Record<string, any>;
  output?: string;
  error?: string;
  duration?: number;
  expanded?: boolean;
}

interface FigmaDesignCardProps {
  url: string;
  connection: FigmaConnection;
  onConnect: () => void;
  onDisconnect: () => void;
  events?: FigmaMcpEvent[];
  onDismiss?: () => void;
}

const FIGMA_URL_REGEX = /https?:\/\/(www\.)?figma\.com\/(file|proto|design|board|slides|deck)\/([a-zA-Z0-9]+)(\/[^\s?]*)?(\?[^\s]*)?/;

export function detectFigmaUrl(text: string): string | null {
  const match = text.match(FIGMA_URL_REGEX);
  return match ? match[0] : null;
}

export function extractFigmaFileKey(url: string): string | null {
  const match = url.match(FIGMA_URL_REGEX);
  return match ? match[3] : null;
}

const FIGMA_TOOLS = [
  { name: "getDesignContext", label: "Get Design Context", icon: Layers, description: "Explore layers, styles, and layout" },
  { name: "getScreenshot", label: "Capture Screenshot", icon: Image, description: "Take a screenshot of a frame" },
  { name: "getMetadata", label: "Get Metadata", icon: Eye, description: "File info, pages, and components" },
  { name: "getVariableDefs", label: "Get Variables", icon: Variable, description: "Design tokens and variables" },
  { name: "generateDiagram", label: "Generate Diagram", icon: Grid3X3, description: "Create a FigJam diagram" },
  { name: "getCodeConnectMap", label: "Code Connect", icon: Code2, description: "Map components to code" },
  { name: "getCodeConnectSuggestions", label: "Code Suggestions", icon: Palette, description: "Suggest code mappings" },
];

const RATE_LIMITS: Record<string, { calls: number; period: string }> = {
  free: { calls: 6, period: "month" },
  starter: { calls: 200, period: "day" },
  pro: { calls: 200, period: "day" },
  dev: { calls: 200, period: "day" },
  enterprise: { calls: 600, period: "day" },
};

function RateLimitBar({ used, limit, plan }: { used: number; limit: number; plan: string }) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isWarning = percentage >= 75;
  const isExceeded = percentage >= 100;
  const rateInfo = RATE_LIMITS[plan] || RATE_LIMITS.free;

  return (
    <div className="mt-2" data-testid="figma-rate-limit">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-[var(--ide-text-muted)]">
          API calls ({rateInfo.calls}/{rateInfo.period})
        </span>
        <span className={`text-[9px] font-medium ${isExceeded ? "text-red-400" : isWarning ? "text-amber-400" : "text-[var(--ide-text-muted)]"}`}>
          {used}/{limit}
        </span>
      </div>
      <div className="w-full h-1 rounded-full bg-[var(--ide-surface)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isExceeded ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-[#A259FF]"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isExceeded && (
        <div className="flex items-center gap-1 mt-1">
          <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
          <span className="text-[9px] text-red-400">Rate limit reached. Resets next {rateInfo.period}.</span>
        </div>
      )}
      {isWarning && !isExceeded && (
        <div className="flex items-center gap-1 mt-1">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-[9px] text-amber-400">Approaching rate limit ({limit - used} calls remaining)</span>
        </div>
      )}
    </div>
  );
}

function FigmaMcpEventItem({ event, onToggle }: { event: FigmaMcpEvent; onToggle: () => void }) {
  const toolInfo = FIGMA_TOOLS.find(t => t.name === event.tool) || { label: event.tool, icon: Layers };
  const ToolIcon = toolInfo.icon;

  return (
    <div className="border border-[var(--ide-border)] rounded-md overflow-hidden" data-testid={`figma-event-${event.id}`}>
      <button
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--ide-surface)]/50 transition-colors text-left"
        onClick={onToggle}
        data-testid={`button-toggle-figma-event-${event.id}`}
      >
        <div className="w-5 h-5 rounded flex items-center justify-center bg-[#A259FF]/10 shrink-0">
          <ToolIcon className="w-3 h-3 text-[#A259FF]" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-medium text-[var(--ide-text)] truncate block">
            Used Figma MCP: {toolInfo.label}
          </span>
          {event.duration && (
            <span className="text-[8px] text-[var(--ide-text-muted)]">{event.duration}ms</span>
          )}
        </div>
        {event.error ? (
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-[#0CCE6B] shrink-0" />
        )}
        {event.expanded ? (
          <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />
        )}
      </button>
      {event.expanded && (
        <div className="border-t border-[var(--ide-border)] bg-[var(--ide-bg)]/50 px-2.5 py-2">
          {event.input && (
            <div className="mb-2">
              <span className="text-[8px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider">Request</span>
              <pre className="mt-0.5 text-[9px] text-[var(--ide-text-secondary)] font-mono whitespace-pre-wrap break-all bg-[var(--ide-surface)] rounded p-1.5 max-h-24 overflow-y-auto">
                {JSON.stringify(event.input, null, 2)}
              </pre>
            </div>
          )}
          {event.output && (
            <div>
              <span className="text-[8px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider">Response</span>
              <pre className="mt-0.5 text-[9px] text-[var(--ide-text-secondary)] font-mono whitespace-pre-wrap break-all bg-[var(--ide-surface)] rounded p-1.5 max-h-32 overflow-y-auto">
                {event.output.slice(0, 2000)}
                {event.output.length > 2000 && "\n... (truncated)"}
              </pre>
            </div>
          )}
          {event.error && (
            <div>
              <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">Error</span>
              <pre className="mt-0.5 text-[9px] text-red-300 font-mono whitespace-pre-wrap break-all bg-red-500/5 rounded p-1.5">
                {event.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FigmaDesignCard({
  url,
  connection,
  onConnect,
  onDisconnect,
  events = [],
  onDismiss,
}: FigmaDesignCardProps) {
  const [showTools, setShowTools] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const fileKey = extractFigmaFileKey(url);

  const toggleEventExpand = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-[#A259FF]/20 bg-[#A259FF]/5 overflow-hidden" data-testid="figma-design-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#A259FF]/15">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#A259FF]/15 shrink-0">
          <Figma className="w-4 h-4 text-[#A259FF]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--ide-text)]" data-testid="text-figma-card-title">
              Figma Design
            </span>
            {connection.connected && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] font-medium">
                Connected
              </span>
            )}
          </div>
          {fileKey && (
            <span className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate block">
              {fileKey}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-[var(--ide-text-muted)] hover:text-[#A259FF] transition-colors"
            data-testid="link-figma-open"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          {onDismiss && (
            <button
              className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
              onClick={onDismiss}
              data-testid="button-figma-dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5">
        {!connection.connected ? (
          <div className="text-center py-2">
            <p className="text-[10px] text-[var(--ide-text-secondary)] mb-2.5">
              Connect your Figma account to explore layers, extract design data, and generate code from this design.
            </p>
            <Button
              className="h-7 px-4 text-[10px] bg-[#A259FF] hover:bg-[#A259FF]/80 text-white rounded-md font-medium gap-1.5"
              onClick={onConnect}
              data-testid="button-figma-connect"
            >
              <LogIn className="w-3 h-3" />
              Log in with Figma
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0CCE6B]" />
                <span className="text-[10px] text-[var(--ide-text)]">
                  Connected as <span className="font-medium">{connection.username || "User"}</span>
                </span>
              </div>
              <button
                className="text-[9px] text-[var(--ide-text-muted)] hover:text-red-400 transition-colors flex items-center gap-1"
                onClick={onDisconnect}
                data-testid="button-figma-disconnect"
              >
                <LogOut className="w-2.5 h-2.5" />
                Disconnect
              </button>
            </div>

            {connection.callsLimit != null && connection.callsUsed != null && (
              <RateLimitBar
                used={connection.callsUsed}
                limit={connection.callsLimit}
                plan={connection.plan || "free"}
              />
            )}

            <button
              className="w-full flex items-center gap-1.5 mt-2 py-1.5 text-[9px] text-[#A259FF] hover:text-[#A259FF]/80 transition-colors"
              onClick={() => setShowTools(!showTools)}
              data-testid="button-figma-show-tools"
            >
              {showTools ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="font-medium uppercase tracking-wider">Available Tools ({FIGMA_TOOLS.length})</span>
            </button>

            {showTools && (
              <div className="space-y-1 mt-1">
                {FIGMA_TOOLS.map(tool => (
                  <div
                    key={tool.name}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--ide-surface)]/30"
                    data-testid={`figma-tool-${tool.name}`}
                  >
                    <tool.icon className="w-3 h-3 text-[#A259FF]/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-medium text-[var(--ide-text)] block truncate">{tool.label}</span>
                      <span className="text-[8px] text-[var(--ide-text-muted)] block truncate">{tool.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {events.length > 0 && (
        <div className="border-t border-[#A259FF]/15 px-3 py-2">
          <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-wider mb-1.5 block">
            Figma MCP Activity
          </span>
          <div className="space-y-1">
            {events.map(event => (
              <FigmaMcpEventItem
                key={event.id}
                event={{ ...event, expanded: expandedEvents.has(event.id) }}
                onToggle={() => toggleEventExpand(event.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FigmaLinkIndicator({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-[#A259FF]/5 border border-[#A259FF]/20" data-testid="figma-link-indicator">
      <Figma className="w-3.5 h-3.5 text-[#A259FF]" />
      <span className="text-[10px] text-[#A259FF] font-medium truncate flex-1">Figma design detected</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] text-[var(--ide-text-muted)] hover:text-[#A259FF]"
        data-testid="link-figma-preview"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
