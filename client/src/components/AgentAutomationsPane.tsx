import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Play, Square, Clock, Webhook, Zap, ChevronDown, ChevronRight,
  CheckCircle, XCircle, ArrowRight, Send, RefreshCw, Trash2,
  Activity, Terminal, MessageSquare, Eye, Power, RotateCcw,
  Heart, HeartOff, Server, Rocket
} from "lucide-react";

interface AgentAutomationsPaneProps {
  projectId: string;
  onClose: () => void;
}

interface Automation {
  id: string;
  projectId: string;
  name: string;
  type: string;
  cronExpression: string | null;
  webhookToken: string | null;
  script: string;
  language: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

interface AutomationRun {
  id: string;
  automationId: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number | null;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
}

interface DeploymentHealth {
  status: string;
  healthy: boolean;
  lastCheck: string | null;
  port: number | null;
  processStatus: string | null;
  restartCount: number;
}

interface ProcessStatus {
  process: {
    status: string;
    port: number;
    healthStatus: string;
    lastHealthCheck: string | null;
    restartCount: number;
  } | null;
}

function WorkflowVisualizer({ automation }: { automation: Automation }) {
  const triggerLabel = automation.type === "cron" ? `Cron: ${automation.cronExpression}` :
    automation.type === "webhook" ? "Webhook Request" : "On Deploy";
  const triggerColor = automation.type === "cron" ? "#F5A623" :
    automation.type === "webhook" ? "#0079F2" : "#0CCE6B";

  return (
    <div className="flex items-center gap-1.5 px-2 py-2" data-testid={`workflow-viz-${automation.id}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg)] min-w-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: triggerColor }} />
        <span className="text-[9px] text-[var(--ide-text-secondary)] truncate">{triggerLabel}</span>
      </div>

      <ArrowRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />

      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg)] min-w-0">
        <Terminal className="w-3 h-3 text-[#7C65CB] shrink-0" />
        <span className="text-[9px] text-[var(--ide-text-secondary)] truncate">{automation.language}</span>
      </div>

      <ArrowRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />

      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-[var(--ide-border)] bg-[var(--ide-bg)] min-w-0">
        <Activity className="w-3 h-3 text-[#0CCE6B] shrink-0" />
        <span className="text-[9px] text-[var(--ide-text-secondary)] truncate">Output</span>
      </div>
    </div>
  );
}

function AutomationLogStream({ automationId, projectId }: { automationId: string; projectId: string }) {
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const runsQuery = useQuery<AutomationRun[]>({
    queryKey: ["/api/automations", automationId, "runs"],
    queryFn: async () => {
      const res = await fetch(`/api/automations/${automationId}/runs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamLogs, runsQuery.data]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?projectId=${projectId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "automation_log" && data.automationId === automationId) {
          const lines: string[] = [];
          if (data.stdout) lines.push(`[stdout] ${data.stdout}`);
          if (data.stderr) lines.push(`[stderr] ${data.stderr}`);
          if (data.exitCode !== undefined) lines.push(`[exit] code: ${data.exitCode} (${data.durationMs}ms)`);
          setStreamLogs(prev => [...prev.slice(-100), ...lines]);
        }
        if (data.type === "automation_started" && data.automationId === automationId) {
          setStreamLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Automation started (${data.triggeredBy})`]);
        }
        if (data.type === "automation_completed" && data.automationId === automationId) {
          setStreamLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data.success ? "Completed successfully" : "Failed"}`]);
        }
      } catch {}
    };

    return () => ws.close();
  }, [automationId, projectId]);

  const latestRun = runsQuery.data?.[0];

  return (
    <div className="border-t border-[var(--ide-border)] mt-1" data-testid={`automation-logs-${automationId}`}>
      <div className="px-2 py-1 flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-[#0CCE6B]" />
        <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Live Logs</span>
      </div>
      <div className="max-h-32 overflow-y-auto bg-[var(--ide-bg)] mx-2 mb-2 rounded border border-[var(--ide-border)] p-1.5">
        {latestRun && (
          <div className="mb-1">
            <div className="flex items-center gap-1 text-[8px]">
              {latestRun.status === "success" ?
                <CheckCircle className="w-2.5 h-2.5 text-[#0CCE6B]" /> :
                <XCircle className="w-2.5 h-2.5 text-red-400" />
              }
              <span className={latestRun.status === "success" ? "text-[#0CCE6B]" : "text-red-400"}>
                {latestRun.status} ({latestRun.durationMs}ms)
              </span>
              <span className="text-[var(--ide-text-muted)]">
                {new Date(latestRun.startedAt).toLocaleTimeString()}
              </span>
            </div>
            {latestRun.stdout && (
              <pre className="text-[8px] font-mono text-[var(--ide-text-secondary)] whitespace-pre-wrap mt-0.5">{latestRun.stdout}</pre>
            )}
            {latestRun.stderr && (
              <pre className="text-[8px] font-mono text-red-400/70 whitespace-pre-wrap mt-0.5">{latestRun.stderr}</pre>
            )}
          </div>
        )}
        {streamLogs.map((line, i) => (
          <pre key={i} className="text-[8px] font-mono text-[var(--ide-text-secondary)] whitespace-pre-wrap">{line}</pre>
        ))}
        {!latestRun && streamLogs.length === 0 && (
          <span className="text-[8px] text-[var(--ide-text-muted)]">No logs yet. Run the automation to see output.</span>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

function AgentTestChat({ projectId }: { projectId: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "agent"; content: string }[]>([]);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendTestMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setSending(true);

    try {
      const res = await apiRequest("POST", "/api/ai/chat", {
        messages: [{ role: "user", content: userMsg }],
        model: "gpt",
        projectId,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let agentContent = "";

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
              agentContent += data.content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "agent") {
                  return [...prev.slice(0, -1), { role: "agent", content: agentContent }];
                }
                return [...prev, { role: "agent", content: agentContent }];
              });
            }
          } catch {}
        }
      }

      if (!agentContent) {
        setMessages(prev => [...prev, { role: "agent", content: "(No response)" }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "agent", content: "Error: Could not reach agent" }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-[var(--ide-border)]" data-testid="agent-test-chat">
      <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-[var(--ide-border)]">
        <MessageSquare className="w-3 h-3 text-[#7C65CB]" />
        <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Agent Test Chat</span>
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
        {messages.length === 0 && (
          <span className="text-[9px] text-[var(--ide-text-muted)] italic">Send a message to test agent-type automations</span>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-2 py-1 rounded-md text-[10px] ${
              msg.role === "user"
                ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/30"
                : "bg-[var(--ide-surface)] text-[var(--ide-text-secondary)] border border-[var(--ide-border)]"
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-1.5">
            <div className="px-2 py-1 rounded-md bg-[var(--ide-surface)] border border-[var(--ide-border)]">
              <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="flex gap-1 px-2 pb-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendTestMessage()}
          placeholder="Test message..."
          className="h-7 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]"
          data-testid="input-agent-test"
        />
        <Button
          size="icon"
          className="w-7 h-7 bg-[#7C65CB] hover:bg-[#7C65CB]/80 shrink-0"
          onClick={sendTestMessage}
          disabled={sending || !input.trim()}
          data-testid="button-send-test"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function DeploymentHealthPanel({ projectId }: { projectId: string }) {
  const healthQuery = useQuery<DeploymentHealth>({
    queryKey: ["/api/projects", projectId, "deploy/health"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deploy/health`, { credentials: "include" });
      if (!res.ok) return { status: "no_process", healthy: false, lastCheck: null, port: null, processStatus: null, restartCount: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const processQuery = useQuery<ProcessStatus>({
    queryKey: ["/api/projects", projectId, "deploy/process"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deploy/process`, { credentials: "include" });
      if (!res.ok) return { process: null };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const health = healthQuery.data;
  const proc = processQuery.data?.process;

  if (!proc) return null;

  return (
    <div className="border-t border-[var(--ide-border)] px-3 py-2" data-testid="deployment-health-panel">
      <div className="flex items-center gap-1.5 mb-2">
        <Server className="w-3 h-3 text-[#0079F2]" />
        <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Process Health</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] p-2">
          <div className="text-[8px] text-[var(--ide-text-muted)] uppercase">Status</div>
          <div className="flex items-center gap-1 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${
              proc.status === "running" ? "bg-[#0CCE6B]" :
              proc.status === "error" ? "bg-red-400" :
              proc.status === "restarting" ? "bg-[#F5A623] animate-pulse" :
              "bg-gray-400"
            }`} />
            <span className="text-[10px] text-[var(--ide-text)] capitalize">{proc.status}</span>
          </div>
        </div>
        <div className="bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] p-2">
          <div className="text-[8px] text-[var(--ide-text-muted)] uppercase">Health</div>
          <div className="flex items-center gap-1 mt-0.5">
            {proc.healthStatus === "healthy" ?
              <Heart className="w-3 h-3 text-[#0CCE6B]" /> :
              <HeartOff className="w-3 h-3 text-red-400" />
            }
            <span className="text-[10px] text-[var(--ide-text)] capitalize">{proc.healthStatus}</span>
          </div>
        </div>
        <div className="bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] p-2">
          <div className="text-[8px] text-[var(--ide-text-muted)] uppercase">Port</div>
          <span className="text-[10px] text-[var(--ide-text)] font-mono">{proc.port}</span>
        </div>
        <div className="bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] p-2">
          <div className="text-[8px] text-[var(--ide-text-muted)] uppercase">Restarts</div>
          <span className="text-[10px] text-[var(--ide-text)]">{proc.restartCount}</span>
        </div>
      </div>
      {proc.lastHealthCheck && (
        <div className="text-[8px] text-[var(--ide-text-muted)] mt-1.5">
          Last check: {new Date(proc.lastHealthCheck).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function AgentAutomationsPane({ projectId, onClose }: AgentAutomationsPaneProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"automations" | "monitor" | "test">("automations");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLogsFor, setShowLogsFor] = useState<string | null>(null);

  const automationsQuery = useQuery<Automation[]>({
    queryKey: ["/api/projects", projectId, "automations"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/automations`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/automations/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] }),
  });

  const triggerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/automations/${id}/trigger`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.success ? "Automation completed" : "Automation failed", variant: data.success ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] });
      toast({ title: "Automation deleted" });
    },
  });

  const automations = automationsQuery.data || [];
  const runningCount = automations.filter(a => a.enabled).length;
  const errorCount = 0;

  const getStatusColor = (automation: Automation) => {
    if (!automation.enabled) return "bg-gray-400";
    return "bg-[#0CCE6B]";
  };

  const getStatusLabel = (automation: Automation) => {
    if (!automation.enabled) return "Stopped";
    return "Running";
  };

  return (
    <div className="flex flex-col h-full" data-testid="agent-automations-pane">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#F5A623]" /> Agents & Automations
        </span>
        <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-agent-pane">
          <Square className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--ide-border)]">
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0CCE6B]/10 border border-[#0CCE6B]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />
          <span className="text-[9px] text-[#0CCE6B] font-medium">{runningCount} active</span>
        </div>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--ide-surface)] border border-[var(--ide-border)]">
          <span className="text-[9px] text-[var(--ide-text-muted)]">{automations.length} total</span>
        </div>
      </div>

      <div className="flex border-b border-[var(--ide-border)]">
        {(["automations", "monitor", "test"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "text-[#F5A623] border-b-2 border-[#F5A623]"
                : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            }`}
            data-testid={`tab-${tab}`}
          >
            {tab === "automations" ? "Automations" : tab === "monitor" ? "Monitor" : "Test Agent"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "automations" && (
          <>
            {automationsQuery.isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" />
              </div>
            )}

            {automations.length === 0 && !automationsQuery.isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Zap className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
                <p className="text-xs text-[var(--ide-text-muted)]">No automations yet</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">
                  Create automations in the Automations panel
                </p>
              </div>
            )}

            {automations.map((automation) => (
              <div key={automation.id} className="border-b border-[var(--ide-border)]/50" data-testid={`agent-automation-${automation.id}`}>
                <div
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--ide-surface)]/30 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === automation.id ? null : automation.id)}
                >
                  {expandedId === automation.id ?
                    <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" /> :
                    <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                  }
                  {automation.type === "cron" ? <Clock className="w-3.5 h-3.5 text-[#F5A623] shrink-0" /> :
                   automation.type === "webhook" ? <Webhook className="w-3.5 h-3.5 text-[#0079F2] shrink-0" /> :
                   <Zap className="w-3.5 h-3.5 text-[#0CCE6B] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--ide-text)] font-medium truncate">{automation.name}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(automation)}`} />
                      <span className="text-[8px] text-[var(--ide-text-muted)]">{getStatusLabel(automation)}</span>
                    </div>
                    <span className="text-[9px] text-[var(--ide-text-muted)]">
                      {automation.type === "cron" ? automation.cronExpression : automation.type}
                    </span>
                  </div>
                  <Switch
                    checked={automation.enabled}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: automation.id, enabled: checked })}
                    className="scale-75"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`switch-agent-automation-${automation.id}`}
                  />
                </div>

                {expandedId === automation.id && (
                  <div className="px-3 pb-2 space-y-2">
                    <WorkflowVisualizer automation={automation} />

                    <div className="px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)]">
                      <pre className="text-[9px] font-mono text-[var(--ide-text-secondary)] whitespace-pre-wrap max-h-20 overflow-hidden">
                        {automation.script || "(empty)"}
                      </pre>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[9px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded gap-1"
                        onClick={() => triggerMutation.mutate(automation.id)}
                        disabled={triggerMutation.isPending}
                        data-testid={`button-run-agent-${automation.id}`}
                      >
                        {triggerMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                        Run Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[9px] gap-1"
                        onClick={() => setShowLogsFor(showLogsFor === automation.id ? null : automation.id)}
                        data-testid={`button-logs-agent-${automation.id}`}
                      >
                        <Eye className="w-2.5 h-2.5" /> Logs
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[9px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => deleteMutation.mutate(automation.id)}
                        data-testid={`button-delete-agent-${automation.id}`}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>

                    {showLogsFor === automation.id && (
                      <AutomationLogStream automationId={automation.id} projectId={projectId} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === "monitor" && (
          <div className="space-y-0">
            <DeploymentHealthPanel projectId={projectId} />

            <div className="px-3 py-2 border-t border-[var(--ide-border)]">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3 text-[#F5A623]" />
                <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Automation Status</span>
              </div>
              {automations.length === 0 ? (
                <span className="text-[9px] text-[var(--ide-text-muted)]">No automations configured</span>
              ) : (
                <div className="space-y-1">
                  {automations.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 bg-[var(--ide-bg)] rounded border border-[var(--ide-border)]" data-testid={`monitor-automation-${a.id}`}>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(a)}`} />
                      <span className="text-[10px] text-[var(--ide-text)] flex-1 truncate">{a.name}</span>
                      <span className="text-[8px] text-[var(--ide-text-muted)] capitalize">{a.type}</span>
                      <span className={`text-[8px] ${a.enabled ? "text-[#0CCE6B]" : "text-gray-400"}`}>
                        {getStatusLabel(a)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "test" && (
          <AgentTestChat projectId={projectId} />
        )}
      </div>
    </div>
  );
}
