import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Loader2, Plus, X, Play, Square, RefreshCw,
  ChevronDown, ChevronRight, Wrench, CheckCircle2, XCircle, AlertCircle, Plug2,
  Search, Globe, Database, Terminal, Pencil, FileText, Figma, ExternalLink, BookOpen,
} from "lucide-react";

interface McpServer {
  id: string;
  projectId: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: string;
  isBuiltIn: boolean;
  createdAt: string;
}

interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  serverName?: string;
}

const serverIconMap: Record<string, typeof Server> = {
  "file-search": Search,
  "web-fetch": Globe,
  "database-query": Database,
  "figma": Figma,
};

function ServerIcon({ name, className }: { name: string; className?: string }) {
  const Icon = serverIconMap[name] || Server;
  return <Icon className={className} />;
}

const statusColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  running: { bg: "bg-[#0CCE6B]/15", text: "text-[#0CCE6B]", icon: CheckCircle2 },
  stopped: { bg: "bg-[var(--ide-surface)]", text: "text-[var(--ide-text-muted)]", icon: Square },
  error: { bg: "bg-red-500/15", text: "text-red-400", icon: XCircle },
  starting: { bg: "bg-amber-500/15", text: "text-amber-400", icon: AlertCircle },
};

function ServerLogsPanel({ projectId, serverId }: { projectId: string; serverId: string }) {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    const es = new EventSource(`/api/projects/${projectId}/mcp/servers/${serverId}/logs`);
    es.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data) as string;
        setLogs((prev) => {
          const next = [...prev, line];
          return next.length > 200 ? next.slice(-200) : next;
        });
      } catch {}
    };
    es.onerror = () => { es.close(); };
    return () => { es.close(); };
  }, [projectId, serverId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="px-3 pb-2" data-testid={`mcp-logs-${serverId}`}>
      <div ref={scrollRef} className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2 max-h-40 overflow-y-auto font-mono">
        {logs.length === 0 ? (
          <p className="text-[9px] text-[var(--ide-text-muted)] text-center py-1">No logs yet</p>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="text-[9px] text-[var(--ide-text-muted)] leading-relaxed whitespace-pre-wrap break-all">{line}</div>
          ))
        )}
      </div>
    </div>
  );
}

export default function MCPPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [showLogsServer, setShowLogsServer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCommand, setEditCommand] = useState("");
  const [editArgs, setEditArgs] = useState("");
  const [editEnv, setEditEnv] = useState("");
  const [newEnv, setNewEnv] = useState("");

  const serversQuery = useQuery<McpServer[]>({
    queryKey: ["/api/projects", projectId, "mcp", "servers"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp/servers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load MCP servers");
      return res.json();
    },
  });

  const toolsQuery = useQuery<McpTool[]>({
    queryKey: ["/api/projects", projectId, "mcp", "tools"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/mcp/tools`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load MCP tools");
      return res.json();
    },
  });

  const initBuiltInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/init-builtin`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "tools"] });
      toast({ title: "Built-in servers initialized" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to initialize", description: err.message, variant: "destructive" });
    },
  });

  const addServerMutation = useMutation({
    mutationFn: async (data: { name: string; command: string; args: string[]; env?: Record<string, string> }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      setShowAddForm(false);
      setNewName("");
      setNewCommand("");
      setNewArgs("");
      toast({ title: "MCP server added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add server", description: err.message, variant: "destructive" });
    },
  });

  const deleteServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/mcp/servers/${serverId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "tools"] });
      toast({ title: "MCP server removed" });
    },
  });

  const editServerMutation = useMutation({
    mutationFn: async ({ serverId, data }: { serverId: string; data: { name?: string; command?: string; args?: string[]; env?: Record<string, string> } }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/mcp/servers/${serverId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      setEditingServer(null);
      toast({ title: "Server updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update server", description: err.message, variant: "destructive" });
    },
  });

  const startServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/${serverId}/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "tools"] });
      toast({ title: "Server started" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to start server", description: err.message, variant: "destructive" });
    },
  });

  const stopServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/${serverId}/stop`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      toast({ title: "Server stopped" });
    },
  });

  const restartServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/mcp/servers/${serverId}/restart`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "mcp", "tools"] });
      toast({ title: "Server restarted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to restart", description: err.message, variant: "destructive" });
    },
  });

  const servers = serversQuery.data || [];
  const tools = toolsQuery.data || [];
  const toolsByServer = tools.reduce<Record<string, McpTool[]>>((acc, tool) => {
    if (!acc[tool.serverId]) acc[tool.serverId] = [];
    acc[tool.serverId].push(tool);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full" data-testid="mcp-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Plug2 className="w-3.5 h-3.5 text-[#7C65CB]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest" data-testid="text-mcp-title">MCP Servers</span>
          <span className="text-[9px] text-[var(--ide-text-muted)] ml-1">({servers.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[var(--ide-surface)]"
            onClick={() => setShowAddForm(!showAddForm)}
            data-testid="button-add-mcp-server"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={onClose}
            data-testid="button-close-mcp"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showAddForm && (
          <div className="px-3 py-2 border-b border-[var(--ide-border)]">
            <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2.5 space-y-2">
              <div>
                <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Server Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-mcp-server"
                  className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                  data-testid="input-mcp-name"
                />
              </div>
              <div>
                <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Command</label>
                <Input
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="node server.js"
                  className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                  data-testid="input-mcp-command"
                />
              </div>
              <div>
                <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Arguments (comma-separated)</label>
                <Input
                  value={newArgs}
                  onChange={(e) => setNewArgs(e.target.value)}
                  placeholder="--port, 3000"
                  className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                  data-testid="input-mcp-args"
                />
              </div>
              <div>
                <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Environment Variables (KEY=VALUE, one per line)</label>
                <textarea
                  value={newEnv}
                  onChange={(e) => setNewEnv(e.target.value)}
                  placeholder={"API_KEY=xxx\nDEBUG=true"}
                  rows={2}
                  className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 py-1 text-[10px] text-[var(--ide-text)] font-mono resize-none"
                  data-testid="input-mcp-env"
                />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded font-medium gap-1"
                  onClick={() => {
                    if (!newName || !newCommand) return;
                    const envObj: Record<string, string> = {};
                    if (newEnv) {
                      newEnv.split("\n").forEach(line => {
                        const eqIdx = line.indexOf("=");
                        if (eqIdx > 0) envObj[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
                      });
                    }
                    addServerMutation.mutate({
                      name: newName,
                      command: newCommand,
                      args: newArgs ? newArgs.split(",").map(a => a.trim()) : [],
                      env: envObj,
                    });
                  }}
                  disabled={addServerMutation.isPending || !newName || !newCommand}
                  data-testid="button-create-mcp-server"
                >
                  {addServerMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add Server
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)]"
                  onClick={() => setShowAddForm(false)}
                  data-testid="button-cancel-add-mcp"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {servers.length > 0 && (
          <div>
            <div className="px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Configured Servers</span>
            </div>
            <div className="space-y-0.5 pb-2">
              {servers.map((server) => {
                const status = statusColors[server.status] || statusColors.stopped;
                const StatusIcon = status.icon;
                const serverTools = toolsByServer[server.id] || [];
                const isExpanded = expandedServer === server.id;
                const isToolsExpanded = expandedTools === server.id;

                return (
                  <div key={server.id} data-testid={`mcp-server-${server.id}`}>
                    <div className="px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors group">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#7C65CB]/15">
                          <ServerIcon name={server.name} className="w-3.5 h-3.5 text-[#7C65CB]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--ide-text)] font-medium truncate" data-testid={`text-server-name-${server.id}`}>{server.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`} data-testid={`status-mcp-${server.id}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {server.status}
                            </span>
                            {server.isBuiltIn && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#0079F2]/10 text-[#0079F2]">built-in</span>
                            )}
                            {serverTools.length > 0 && (
                              <span className="text-[8px] text-[var(--ide-text-muted)]">{serverTools.length} tool{serverTools.length !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {server.status === "running" ? (
                            <>
                              <button
                                className="p-1 text-[var(--ide-text-muted)] hover:text-[#0079F2]"
                                onClick={() => restartServerMutation.mutate(server.id)}
                                title="Restart"
                                data-testid={`button-restart-mcp-${server.id}`}
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                              <button
                                className="p-1 text-[var(--ide-text-muted)] hover:text-red-400"
                                onClick={() => stopServerMutation.mutate(server.id)}
                                title="Stop"
                                data-testid={`button-stop-mcp-${server.id}`}
                              >
                                <Square className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              className="p-1 text-[var(--ide-text-muted)] hover:text-[#0CCE6B]"
                              onClick={() => startServerMutation.mutate(server.id)}
                              title="Start"
                              data-testid={`button-start-mcp-${server.id}`}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                            onClick={() => setExpandedTools(isToolsExpanded ? null : server.id)}
                            title="View tools"
                            data-testid={`button-tools-mcp-${server.id}`}
                          >
                            {isToolsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                          {!server.isBuiltIn && (
                            <>
                              <button
                                className="p-1 text-[var(--ide-text-muted)] hover:text-[#0079F2]"
                                onClick={() => {
                                  setEditingServer(server.id);
                                  setEditName(server.name);
                                  setEditCommand(server.command);
                                  setEditArgs((server.args || []).join(", "));
                                  const env = server.env || {};
                                  setEditEnv(Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n"));
                                }}
                                title="Edit"
                                data-testid={`button-edit-mcp-${server.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-accent)]"
                                onClick={() => setShowLogsServer(showLogsServer === server.id ? null : server.id)}
                                title="View Logs"
                                data-testid={`button-logs-mcp-${server.id}`}
                              >
                                <FileText className="w-3 h-3" />
                              </button>
                              <button
                                className="p-1 text-[var(--ide-text-muted)] hover:text-red-400"
                                onClick={() => deleteServerMutation.mutate(server.id)}
                                title="Remove"
                                data-testid={`button-delete-mcp-${server.id}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 pl-9">
                        <span className="text-[9px] font-mono text-[var(--ide-text-muted)] truncate block">
                          <Terminal className="w-2.5 h-2.5 inline mr-1" />{server.command} {(server.args || []).join(" ")}
                        </span>
                      </div>
                    </div>
                    {editingServer === server.id && (
                      <div className="px-3 pb-2">
                        <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2.5 space-y-2">
                          <div>
                            <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Server Name</label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                              data-testid={`input-edit-name-${server.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Command</label>
                            <Input
                              value={editCommand}
                              onChange={(e) => setEditCommand(e.target.value)}
                              className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                              data-testid={`input-edit-command-${server.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Arguments (comma-separated)</label>
                            <Input
                              value={editArgs}
                              onChange={(e) => setEditArgs(e.target.value)}
                              className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                              data-testid={`input-edit-args-${server.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Environment Variables (KEY=VALUE, one per line)</label>
                            <textarea
                              value={editEnv}
                              onChange={(e) => setEditEnv(e.target.value)}
                              placeholder={"API_KEY=xxx\nDEBUG=true"}
                              rows={2}
                              className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 py-1 text-[10px] text-[var(--ide-text)] font-mono resize-none"
                              data-testid={`input-edit-env-${server.id}`}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <Button
                              className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded font-medium"
                              onClick={() => {
                                const envObj: Record<string, string> = {};
                                if (editEnv) {
                                  editEnv.split("\n").forEach(line => {
                                    const eqIdx = line.indexOf("=");
                                    if (eqIdx > 0) envObj[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
                                  });
                                }
                                editServerMutation.mutate({
                                  serverId: server.id,
                                  data: {
                                    name: editName,
                                    command: editCommand,
                                    args: editArgs ? editArgs.split(",").map(a => a.trim()) : [],
                                    env: envObj,
                                  },
                                });
                              }}
                              disabled={editServerMutation.isPending}
                              data-testid={`button-save-edit-${server.id}`}
                            >
                              {editServerMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)]"
                              onClick={() => setEditingServer(null)}
                              data-testid={`button-cancel-edit-${server.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {showLogsServer === server.id && (
                      <ServerLogsPanel projectId={projectId} serverId={server.id} />
                    )}
                    {isToolsExpanded && (
                      <div className="px-3 pb-2">
                        <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2">
                          {serverTools.length === 0 ? (
                            <p className="text-[9px] text-[var(--ide-text-muted)] text-center py-1">
                              {server.status === "running" ? "No tools discovered" : "Start the server to discover tools"}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {serverTools.map(tool => (
                                <div key={tool.id} className="flex items-start gap-2" data-testid={`mcp-tool-${tool.id}`}>
                                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-[#7C65CB]/10 mt-0.5">
                                    <Wrench className="w-2.5 h-2.5 text-[#7C65CB]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-[var(--ide-text)] font-mono font-medium" data-testid={`text-tool-name-${tool.id}`}>{tool.name}</p>
                                    <p className="text-[9px] text-[var(--ide-text-muted)] leading-tight">{tool.description}</p>
                                    {tool.inputSchema?.properties && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {Object.keys(tool.inputSchema.properties).map(param => (
                                          <span key={param} className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] font-mono">
                                            {param}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {servers.length === 0 && !serversQuery.isLoading && (
          <div className="px-3 py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-3">
              <Plug2 className="w-6 h-6 text-[var(--ide-text-muted)] opacity-40" />
            </div>
            <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium" data-testid="text-no-mcp-servers">No MCP Servers Configured</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 mb-3">Add built-in servers or configure custom ones</p>
            <Button
              className="h-7 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white rounded font-medium gap-1 px-3"
              onClick={() => initBuiltInMutation.mutate()}
              disabled={initBuiltInMutation.isPending}
              data-testid="button-init-builtin-mcp"
            >
              {initBuiltInMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
              Add Built-in Servers
            </Button>
          </div>
        )}

        {serversQuery.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        )}

        {servers.length > 0 && (
          <div className="px-3 py-2 border-t border-[var(--ide-border)]">
            <Button
              variant="ghost"
              className="w-full h-7 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] rounded font-medium gap-1"
              onClick={() => initBuiltInMutation.mutate()}
              disabled={initBuiltInMutation.isPending}
              data-testid="button-sync-builtin-mcp"
            >
              {initBuiltInMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sync Built-in Servers
            </Button>
          </div>
        )}

        <div className="border-t border-[var(--ide-border)]">
          <div className="px-3 py-2">
            <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">MCP Directory</span>
          </div>
          <div className="px-3 pb-3 space-y-1.5">
            <div className="rounded-lg border border-[#A259FF]/20 bg-[#A259FF]/5 p-2.5" data-testid="mcp-directory-figma">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#A259FF]/15 shrink-0">
                  <Figma className="w-4 h-4 text-[#A259FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--ide-text)]">Figma</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#A259FF]/10 text-[#A259FF]">OAuth</span>
                  </div>
                  <span className="text-[9px] text-[var(--ide-text-muted)] block">Design extraction & code generation</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {["getDesignContext", "getScreenshot", "getMetadata", "getVariableDefs", "generateDiagram"].map(tool => (
                  <span key={tool} className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text-muted)] font-mono">
                    {tool}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <a
                  href="https://modelcontextprotocol.io/integrations/figma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] text-[#A259FF] hover:underline"
                  data-testid="link-figma-guide"
                >
                  <BookOpen className="w-2.5 h-2.5" />
                  Setup Guide
                </a>
                <a
                  href="https://www.figma.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  data-testid="link-figma-external"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  figma.com
                </a>
              </div>
              <div className="mt-2 text-[8px] text-[var(--ide-text-muted)]">
                <span className="font-medium">Rate limits:</span> Free: 6/mo | Dev/Pro: 200/day | Enterprise: 600/day
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ide-border)] bg-[var(--ide-surface)]/20 p-2.5" data-testid="mcp-directory-builtins">
              <div className="flex items-center gap-2 mb-1.5">
                <Server className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                <span className="text-[10px] font-medium text-[var(--ide-text-secondary)]">Built-in Servers</span>
              </div>
              <div className="space-y-1">
                {[
                  { name: "file-search", label: "File Search", desc: "grep & find files" },
                  { name: "web-fetch", label: "Web Fetch", desc: "Fetch URL content" },
                  { name: "database-query", label: "Database Query", desc: "Read-only SQL queries" },
                ].map(s => (
                  <div key={s.name} className="flex items-center gap-2 px-1.5 py-1">
                    <ServerIcon name={s.name} className="w-3 h-3 text-[var(--ide-text-muted)]" />
                    <span className="text-[9px] text-[var(--ide-text-secondary)] font-medium">{s.label}</span>
                    <span className="text-[8px] text-[var(--ide-text-muted)]">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
