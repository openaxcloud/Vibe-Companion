import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Plus, X, Play, Clock, Webhook, Zap, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Copy, Check, RotateCcw, Trash2, ExternalLink,
  MessageSquare, Send, Wifi, WifiOff, AlertCircle
} from "lucide-react";

interface AutomationsPanelProps {
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
  slackBotToken: string | null;
  slackSigningSecret: string | null;
  telegramBotToken: string | null;
  botStatus: string | null;
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

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday at 9 AM", value: "0 9 * * 1" },
  { label: "Every weekday at 9 AM", value: "0 9 * * 1-5" },
];

type TriggerType = "cron" | "webhook" | "on-deploy" | "slack" | "telegram";

function BotStatusIndicator({ status }: { status: string | null }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] text-[#0CCE6B]" data-testid="status-bot-connected">
        <Wifi className="w-2.5 h-2.5" /> Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] text-red-400" data-testid="status-bot-error">
        <AlertCircle className="w-2.5 h-2.5" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-[var(--ide-text-muted)]" data-testid="status-bot-disconnected">
      <WifiOff className="w-2.5 h-2.5" /> Disconnected
    </span>
  );
}

function TriggerIcon({ type }: { type: string }) {
  switch (type) {
    case "cron": return <Clock className="w-3.5 h-3.5 text-[#F5A623] shrink-0" />;
    case "webhook": return <Webhook className="w-3.5 h-3.5 text-[#0079F2] shrink-0" />;
    case "slack": return <MessageSquare className="w-3.5 h-3.5 text-[#E01E5A] shrink-0" />;
    case "telegram": return <Send className="w-3.5 h-3.5 text-[#0088cc] shrink-0" />;
    default: return <Zap className="w-3.5 h-3.5 text-[#0CCE6B] shrink-0" />;
  }
}

export default function AutomationsPanel({ projectId, onClose }: AutomationsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TriggerType>("cron");
  const [newCron, setNewCron] = useState("*/5 * * * *");
  const [newScript, setNewScript] = useState('console.log("Hello from automation!");');
  const [newLanguage, setNewLanguage] = useState("javascript");
  const [newSlackBotToken, setNewSlackBotToken] = useState("");
  const [newSlackSigningSecret, setNewSlackSigningSecret] = useState("");
  const [newTelegramBotToken, setNewTelegramBotToken] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScript, setEditScript] = useState("");
  const [showRuns, setShowRuns] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");

  const automationsQuery = useQuery<Automation[]>({
    queryKey: ["/api/projects", projectId, "automations"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/automations`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const runsQuery = useQuery<AutomationRun[]>({
    queryKey: ["/api/automations", showRuns, "runs"],
    queryFn: async () => {
      if (!showRuns) return [];
      const res = await fetch(`/api/automations/${showRuns}/runs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!showRuns,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        name: newName, type: newType, script: newScript, language: newLanguage,
      };
      if (newType === "cron") body.cronExpression = newCron;
      if (newType === "slack") {
        body.slackBotToken = newSlackBotToken;
        body.slackSigningSecret = newSlackSigningSecret;
      }
      if (newType === "telegram") {
        body.telegramBotToken = newTelegramBotToken;
      }
      const res = await apiRequest("POST", `/api/projects/${projectId}/automations`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] });
      setCreating(false);
      setNewName("");
      setNewScript('console.log("Hello from automation!");');
      setNewSlackBotToken("");
      setNewSlackSigningSecret("");
      setNewTelegramBotToken("");
      toast({ title: "Automation created" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/automations/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] }),
  });

  const updateScriptMutation = useMutation({
    mutationFn: async ({ id, script }: { id: string; script: string }) => {
      const res = await apiRequest("PATCH", `/api/automations/${id}`, { script });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] });
      setEditingId(null);
      toast({ title: "Script updated" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/automations/${id}/trigger`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.success ? "Automation completed" : "Automation failed", variant: data.success ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] });
      if (showRuns) queryClient.invalidateQueries({ queryKey: ["/api/automations", showRuns, "runs"] });
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

  const testBotMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest("POST", `/api/automations/${id}/trigger`, { testMessage: message });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.success ? "Test completed" : "Test failed", variant: data.success ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "automations"] });
      if (showRuns) queryClient.invalidateQueries({ queryKey: ["/api/automations", showRuns, "runs"] });
    },
    onError: (err: Error) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const testSlackMutation = useMutation({
    mutationFn: async (data: { botToken: string; signingSecret: string }) => {
      const res = await apiRequest("POST", "/api/automations/test-slack", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Slack connected", description: `Team: ${data.teamName}` });
      } else {
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const testTelegramMutation = useMutation({
    mutationFn: async (data: { botToken: string }) => {
      const res = await apiRequest("POST", "/api/automations/test-telegram", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Telegram connected", description: `Bot: @${data.botName}` });
      } else {
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const copyWebhookUrl = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/automation/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getDefaultScript = (type: TriggerType) => {
    if (type === "slack") return '// EVENT contains: { type, text, user, channel }\nconsole.log("Received Slack message:", EVENT.text);';
    if (type === "telegram") return '// EVENT contains: { type, text, from, chat }\nconsole.log("Received Telegram message:", EVENT.text);';
    return 'console.log("Hello from automation!");';
  };

  const isCreateDisabled = () => {
    if (!newName.trim()) return true;
    if (createMutation.isPending) return true;
    if (newType === "slack" && (!newSlackBotToken.trim() || !newSlackSigningSecret.trim())) return true;
    if (newType === "telegram" && !newTelegramBotToken.trim()) return true;
    return false;
  };

  return (
    <div className="flex flex-col h-full" data-testid="automations-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#F5A623]" /> Automations
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setCreating(!creating)} data-testid="button-new-automation">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-automations">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] space-y-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Automation name..." className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]" data-testid="input-automation-name" />
          <div className="flex gap-1 flex-wrap">
            {(["cron", "webhook", "on-deploy", "slack", "telegram"] as const).map((t) => (
              <button key={t} onClick={() => { setNewType(t); setNewScript(getDefaultScript(t)); }}
                className={`flex-1 min-w-[60px] text-[10px] py-1.5 rounded-md border transition-colors flex items-center justify-center gap-1 ${newType === t ? "bg-[#F5A623]/10 border-[#F5A623]/30 text-[#F5A623]" : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                data-testid={`button-type-${t}`}>
                {t === "cron" ? "Cron" : t === "webhook" ? "Webhook" : t === "on-deploy" ? "On Deploy" : t === "slack" ? "Slack" : "Telegram"}
              </button>
            ))}
          </div>

          {newType === "cron" && (
            <div>
              <Input value={newCron} onChange={(e) => setNewCron(e.target.value)} placeholder="Cron expression..." className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] font-mono" data-testid="input-cron-expression" />
              <div className="mt-1 flex flex-wrap gap-1">
                {CRON_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => setNewCron(p.value)} className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors" data-testid={`cron-preset-${p.value}`}>{p.label}</button>
                ))}
              </div>
            </div>
          )}

          {newType === "slack" && (
            <div className="space-y-1.5">
              <div className="text-[9px] text-[var(--ide-text-muted)] px-1">Configure your Slack Bot credentials</div>
              <Input
                value={newSlackBotToken}
                onChange={(e) => setNewSlackBotToken(e.target.value)}
                placeholder="Bot Token (xoxb-...)"
                type="password"
                className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] font-mono"
                data-testid="input-slack-bot-token"
              />
              <Input
                value={newSlackSigningSecret}
                onChange={(e) => setNewSlackSigningSecret(e.target.value)}
                placeholder="Signing Secret"
                type="password"
                className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] font-mono"
                data-testid="input-slack-signing-secret"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[9px] gap-1 text-[#E01E5A] hover:text-[#E01E5A]/80"
                onClick={() => testSlackMutation.mutate({ botToken: newSlackBotToken, signingSecret: newSlackSigningSecret })}
                disabled={!newSlackBotToken.trim() || !newSlackSigningSecret.trim() || testSlackMutation.isPending}
                data-testid="button-test-slack"
              >
                {testSlackMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wifi className="w-2.5 h-2.5" />}
                Test Token
              </Button>
            </div>
          )}

          {newType === "telegram" && (
            <div className="space-y-1.5">
              <div className="text-[9px] text-[var(--ide-text-muted)] px-1">Get a bot token from @BotFather on Telegram</div>
              <Input
                value={newTelegramBotToken}
                onChange={(e) => setNewTelegramBotToken(e.target.value)}
                placeholder="Bot Token (123456:ABC-DEF...)"
                type="password"
                className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] font-mono"
                data-testid="input-telegram-bot-token"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[9px] gap-1 text-[#0088cc] hover:text-[#0088cc]/80"
                onClick={() => testTelegramMutation.mutate({ botToken: newTelegramBotToken })}
                disabled={!newTelegramBotToken.trim() || testTelegramMutation.isPending}
                data-testid="button-test-telegram"
              >
                {testTelegramMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wifi className="w-2.5 h-2.5" />}
                Test Connection
              </Button>
            </div>
          )}

          <div className="flex gap-1.5">
            <select value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} className="h-7 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md px-2" data-testid="select-automation-language">
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="bash">Bash</option>
            </select>
          </div>
          <textarea value={newScript} onChange={(e) => setNewScript(e.target.value)} rows={4} className="w-full text-[10px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md p-2 resize-none" placeholder="Script to run..." data-testid="textarea-automation-script" />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 px-3 text-[10px] bg-[#F5A623] hover:bg-[#F5A623]/80 text-black rounded-md font-semibold" onClick={() => createMutation.mutate(undefined)} disabled={isCreateDisabled()} data-testid="button-create-automation">
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px]" onClick={() => setCreating(false)} data-testid="button-cancel-automation">Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {automationsQuery.isLoading && (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
        )}

        {automationsQuery.data && automationsQuery.data.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Zap className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--ide-text-muted)]">No automations yet</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">Create cron jobs, webhooks, Slack bots, or Telegram bots</p>
          </div>
        )}

        {automationsQuery.data?.map((automation) => (
          <div key={automation.id} className="border-b border-[var(--ide-border)]/50" data-testid={`automation-item-${automation.id}`}>
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--ide-surface)]/30 cursor-pointer" onClick={() => setExpandedId(expandedId === automation.id ? null : automation.id)}>
              {expandedId === automation.id ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
              <TriggerIcon type={automation.type} />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-[var(--ide-text)] font-medium truncate block">{automation.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    {automation.type === "cron" ? automation.cronExpression : automation.type}
                    {automation.lastRunAt && ` · Last: ${new Date(automation.lastRunAt).toLocaleString()}`}
                  </span>
                  {(automation.type === "slack" || automation.type === "telegram") && (
                    <BotStatusIndicator status={automation.botStatus} />
                  )}
                </div>
              </div>
              <Switch checked={automation.enabled} onCheckedChange={(checked) => { toggleMutation.mutate({ id: automation.id, enabled: checked }); }}
                className="scale-75" onClick={(e) => e.stopPropagation()} data-testid={`switch-automation-${automation.id}`} />
            </div>

            {expandedId === automation.id && (
              <div className="px-3 pb-2 space-y-2">
                {automation.type === "webhook" && automation.webhookToken && (
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)]">
                    <ExternalLink className="w-3 h-3 text-[#0079F2] shrink-0" />
                    <span className="text-[9px] text-[var(--ide-text-secondary)] font-mono truncate flex-1">/api/webhooks/automation/{automation.webhookToken.slice(0, 12)}...</span>
                    <button onClick={() => copyWebhookUrl(automation.webhookToken!)} className="p-0.5" data-testid={`button-copy-webhook-${automation.id}`}>
                      {copiedToken === automation.webhookToken ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                    </button>
                  </div>
                )}

                {automation.type === "slack" && (
                  <div className="px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-[#E01E5A]" />
                      <span className="text-[9px] font-medium text-[var(--ide-text)]">Slack Bot</span>
                      <BotStatusIndicator status={automation.botStatus} />
                    </div>
                    <div className="text-[8px] text-[var(--ide-text-muted)]">
                      Token: {automation.slackBotToken ? "****" + automation.slackBotToken.slice(-4) : "Not set"}
                    </div>
                  </div>
                )}

                {automation.type === "telegram" && (
                  <div className="px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3 h-3 text-[#0088cc]" />
                      <span className="text-[9px] font-medium text-[var(--ide-text)]">Telegram Bot</span>
                      <BotStatusIndicator status={automation.botStatus} />
                    </div>
                    <div className="text-[8px] text-[var(--ide-text-muted)]">
                      Token: {automation.telegramBotToken ? "****" + automation.telegramBotToken.slice(-4) : "Not set"}
                    </div>
                  </div>
                )}

                {editingId === automation.id ? (
                  <div className="space-y-1.5">
                    <textarea value={editScript} onChange={(e) => setEditScript(e.target.value)} rows={4} className="w-full text-[10px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md p-2 resize-none" data-testid={`textarea-edit-script-${automation.id}`} />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 px-2 text-[9px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black rounded" onClick={() => updateScriptMutation.mutate({ id: automation.id, script: editScript })} data-testid={`button-save-script-${automation.id}`}>Save</Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px]" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] cursor-pointer" onClick={() => { setEditingId(automation.id); setEditScript(automation.script); }}>
                    <pre className="text-[9px] font-mono text-[var(--ide-text-secondary)] whitespace-pre-wrap max-h-20 overflow-hidden">{automation.script || "(empty)"}</pre>
                  </div>
                )}

                {(automation.type === "slack" || automation.type === "telegram") && (
                  <div className="flex items-center gap-1">
                    <Input
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Test message..."
                      className="h-6 text-[9px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] flex-1"
                      data-testid={`input-test-message-${automation.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[9px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded gap-1"
                      onClick={() => testBotMutation.mutate({ id: automation.id, message: testMessage || "Hello from test!" })}
                      disabled={testBotMutation.isPending}
                      data-testid={`button-test-bot-${automation.id}`}
                    >
                      {testBotMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                      Test
                    </Button>
                  </div>
                )}

                <div className="flex gap-1">
                  <Button size="sm" className="h-6 px-2 text-[9px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded gap-1" onClick={() => triggerMutation.mutate(automation.id)} disabled={triggerMutation.isPending} data-testid={`button-trigger-${automation.id}`}>
                    {triggerMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                    Run Now
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1" onClick={() => setShowRuns(showRuns === automation.id ? null : automation.id)} data-testid={`button-show-runs-${automation.id}`}>
                    <RotateCcw className="w-2.5 h-2.5" /> History
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteMutation.mutate(automation.id)} data-testid={`button-delete-automation-${automation.id}`}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>

                {showRuns === automation.id && (
                  <div className="border-t border-[var(--ide-border)] pt-2">
                    <span className="text-[9px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Run History</span>
                    {runsQuery.isLoading && <Loader2 className="w-3 h-3 text-[var(--ide-text-muted)] animate-spin mt-1" />}
                    {runsQuery.data && runsQuery.data.length === 0 && (
                      <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">No runs yet</p>
                    )}
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {runsQuery.data?.map((run) => (
                        <div key={run.id} className="flex items-start gap-1.5 p-1.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)]" data-testid={`automation-run-${run.id}`}>
                          {run.status === "success" ? <CheckCircle className="w-3 h-3 text-[#0CCE6B] shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] font-medium ${run.status === "success" ? "text-[#0CCE6B]" : "text-red-400"}`}>{run.status}</span>
                              <span className={`text-[8px] px-1 py-0.5 rounded ${
                                run.triggeredBy === "slack" ? "bg-[#E01E5A]/10 text-[#E01E5A]" :
                                run.triggeredBy === "telegram" ? "bg-[#0088cc]/10 text-[#0088cc]" :
                                "text-[var(--ide-text-muted)]"
                              }`}>via {run.triggeredBy}</span>
                              {run.durationMs && <span className="text-[8px] text-[var(--ide-text-muted)]">{run.durationMs}ms</span>}
                            </div>
                            <span className="text-[8px] text-[var(--ide-text-muted)]">{new Date(run.startedAt).toLocaleString()}</span>
                            {run.stdout && <pre className="text-[8px] font-mono text-[var(--ide-text-secondary)] mt-0.5 whitespace-pre-wrap max-h-12 overflow-hidden">{run.stdout}</pre>}
                            {run.stderr && <pre className="text-[8px] font-mono text-red-400/70 mt-0.5 whitespace-pre-wrap max-h-12 overflow-hidden">{run.stderr}</pre>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
export { AutomationsPanel };
