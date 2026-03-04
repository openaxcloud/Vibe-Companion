import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, Play, Square, Terminal, FileCode2, Plus, Save, Loader2,
  X, Trash2, Pencil, FolderOpen, Settings, MoreHorizontal,
  File as FileIcon, RefreshCw, Sparkles, Globe, Rocket, Copy, Check, ExternalLink,
  Server, AlertTriangle, Power, CircleStop, Wifi, WifiOff
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useProjectWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import AIPanel from "@/components/AIPanel";
import CodeEditor, { detectLanguage } from "@/components/CodeEditor";
import type { Project as ProjectType, File } from "@shared/schema";

interface LogEntry {
  id: number;
  text: string;
  type: "info" | "error" | "success";
}

export default function Project() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview">("terminal");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectLang, setProjectLang] = useState("");
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [wsStatus, setWsStatus] = useState<"offline" | "starting" | "running" | "stopped" | "error" | "none">("none");
  const [wsLoading, setWsLoading] = useState(false);
  const [runnerOnline, setRunnerOnline] = useState<boolean | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(220);

  const { messages, connected } = useProjectWebSocket(projectId);

  const projectQuery = useQuery<ProjectType>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Project not found");
      return res.json();
    },
  });

  const filesQuery = useQuery<File[]>({
    queryKey: ["/api/projects", projectId, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/files`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
  });

  useEffect(() => {
    if (filesQuery.data && filesQuery.data.length > 0 && openTabs.length === 0) {
      const f = filesQuery.data[0];
      setOpenTabs([f.id]);
      setActiveFileId(f.id);
      setFileContents((prev) => ({ ...prev, [f.id]: f.content }));
    }
  }, [filesQuery.data]);

  useEffect(() => {
    if (projectQuery.data) {
      setProjectName(projectQuery.data.name);
      setProjectLang(projectQuery.data.language);
    }
  }, [projectQuery.data]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.type === "run_log" && msg.message) {
        setLogs((prev) => [...prev, { id: Date.now() + Math.random(), text: msg.message!, type: msg.logType || "info" }]);
      }
      if (msg.type === "run_status" && (msg.status === "completed" || msg.status === "failed")) {
        setIsRunning(false);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches) setSidebarOpen(false);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      await apiRequest("PATCH", `/api/files/${fileId}`, { content });
    },
    onSuccess: (_, vars) => {
      setDirtyFiles((prev) => { const n = new Set(prev); n.delete(vars.fileId); return n; });
    },
  });

  const autoSave = useCallback((fileId: string, newCode: string) => {
    setDirtyFiles((prev) => new Set(prev).add(fileId));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ fileId, content: newCode });
    }, 2000);
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    if (!activeFileId) return;
    setFileContents((prev) => ({ ...prev, [activeFileId]: value }));
    autoSave(activeFileId, value);
  }, [activeFileId, autoSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeFileId && fileContents[activeFileId] !== undefined) {
          saveMutation.mutate({ fileId: activeFileId, content: fileContents[activeFileId] });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFileId, fileContents]);

  const openFile = (file: File) => {
    if (!openTabs.includes(file.id)) setOpenTabs((prev) => [...prev, file.id]);
    if (fileContents[file.id] === undefined) setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
    setActiveFileId(file.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const closeTab = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (dirtyFiles.has(fileId) && fileContents[fileId] !== undefined) {
      saveMutation.mutate({ fileId, content: fileContents[fileId] });
    }
    const newTabs = openTabs.filter((id) => id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) setActiveFileId(newTabs[newTabs.length - 1] || null);
  };

  const runMutation = useMutation({
    mutationFn: async () => {
      if (activeFileId && dirtyFiles.has(activeFileId)) {
        await apiRequest("PATCH", `/api/files/${activeFileId}`, { content: fileContents[activeFileId] });
        setDirtyFiles((prev) => { const n = new Set(prev); n.delete(activeFileId); return n; });
      }
      const code = activeFileId ? fileContents[activeFileId] || "" : "";
      const res = await apiRequest("POST", `/api/projects/${projectId}/run`, {
        code,
        language: projectQuery.data?.language || "javascript",
      });
      return res.json();
    },
    onSuccess: () => {
      setIsRunning(true);
      setTerminalVisible(true);
      setBottomTab("terminal");
    },
    onError: (err: any) => {
      toast({ title: "Run failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRun = () => {
    if (isRunning) { setIsRunning(false); return; }
    setLogs([]);
    runMutation.mutate();
  };

  const createFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/files`, { filename, content: "" });
      return res.json();
    },
    onSuccess: (file: File) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      openFile(file);
      setNewFileDialogOpen(false);
      setNewFileName("");
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => { await apiRequest("DELETE", `/api/files/${fileId}`); },
    onSuccess: (_, fileId) => {
      closeTab(fileId);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ fileId, filename }: { fileId: string; filename: string }) => {
      await apiRequest("PATCH", `/api/files/${fileId}`, { filename });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setRenamingFileId(null);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; language?: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setProjectSettingsOpen(false);
      toast({ title: "Project updated" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/publish`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: project?.isPublished ? "Project unpublished" : "Project published" });
    },
  });

  const workspaceStatusQuery = useQuery({
    queryKey: ["/api/workspaces", projectId, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${projectId}/status`, { credentials: "include" });
      if (res.status === 404) return { status: "none" };
      if (!res.ok) return { status: "error" };
      return res.json();
    },
    refetchInterval: wsStatus === "starting" || wsStatus === "running" ? 5000 : false,
  });

  useEffect(() => {
    if (workspaceStatusQuery.data?.status) {
      setWsStatus(workspaceStatusQuery.data.status);
    }
  }, [workspaceStatusQuery.data]);

  useEffect(() => {
    fetch("/api/runner/status", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Runner status check failed");
        return r.json();
      })
      .then((d) => setRunnerOnline(d.online))
      .catch(() => setRunnerOnline(false));
  }, []);

  const initWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/workspaces/${projectId}`);
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.online) {
        setRunnerOnline(false);
        setWsStatus("offline");
        toast({ title: "Runner offline", description: "Le VPS runner n'est pas encore déployé", variant: "destructive" });
      } else if (data.error) {
        setRunnerOnline(true);
        setWsStatus("error");
        toast({ title: "Workspace error", description: data.error, variant: "destructive" });
      } else {
        setRunnerOnline(true);
        setWsStatus("stopped");
        queryClient.invalidateQueries({ queryKey: ["/api/workspaces", projectId, "status"] });
      }
    },
    onError: () => {
      setWsStatus("error");
    },
  });

  const startWorkspaceMutation = useMutation({
    mutationFn: async () => {
      setWsLoading(true);
      const res = await apiRequest("POST", `/api/workspaces/${projectId}/start`);
      return res.json();
    },
    onSuccess: () => {
      setWsStatus("running");
      setWsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", projectId, "status"] });
      toast({ title: "Workspace started" });
    },
    onError: () => {
      setWsStatus("error");
      setWsLoading(false);
      toast({ title: "Failed to start workspace", variant: "destructive" });
    },
  });

  const stopWorkspaceMutation = useMutation({
    mutationFn: async () => {
      setWsLoading(true);
      const res = await apiRequest("POST", `/api/workspaces/${projectId}/stop`);
      return res.json();
    },
    onSuccess: () => {
      setWsStatus("stopped");
      setWsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", projectId, "status"] });
      toast({ title: "Workspace stopped" });
    },
    onError: () => {
      setWsStatus("error");
      setWsLoading(false);
    },
  });

  const handleStartWorkspace = () => {
    if (wsStatus === "none" || wsStatus === "offline") {
      initWorkspaceMutation.mutate();
    } else if (wsStatus === "stopped" || wsStatus === "error") {
      setWsStatus("starting");
      startWorkspaceMutation.mutate();
    }
  };

  const handleStopWorkspace = () => {
    if (wsStatus === "running") {
      stopWorkspaceMutation.mutate();
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
    dragStartH.current = terminalHeight;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (dragStartY.current === null) return;
      const cy = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      setTerminalHeight(Math.max(80, Math.min(500, dragStartH.current + (dragStartY.current - cy))));
    };
    const onUp = () => {
      dragStartY.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onUp);
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${projectId}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const project = projectQuery.data;
  const activeFile = filesQuery.data?.find((f) => f.id === activeFileId);
  const currentCode = activeFileId ? fileContents[activeFileId] ?? "" : "";
  const editorLanguage = activeFile ? detectLanguage(activeFile.filename) : "javascript";

  const getFileColor = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const c: Record<string, string> = { js: "text-yellow-400", jsx: "text-yellow-400", ts: "text-blue-400", tsx: "text-blue-400", py: "text-green-400", json: "text-orange-400", css: "text-pink-400", html: "text-red-400", md: "text-gray-400" };
    return c[ext || ""] || "text-[#8b949e]";
  };

  if (projectQuery.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 animate-spin text-[#58a6ff]" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-sm select-none">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-2 h-10 bg-[#161b22] border-b border-[#30363d] shrink-0 z-40">
        <div className="flex items-center gap-1 min-w-0">
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/dashboard")} data-testid="button-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="button-toggle-sidebar">
            <FolderOpen className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1.5 ml-1 min-w-0">
            <span className="text-xs font-semibold text-[#c9d1d9] truncate max-w-[140px]">{project?.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#30363d] text-[#8b949e] shrink-0">{project?.language}</span>
            {project?.isPublished && <span className="text-[9px] px-1 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-600/30 shrink-0">LIVE</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {dirtyFiles.size > 0 && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-orange-400 hover:text-orange-300 hover:bg-[#30363d]" onClick={() => {
              if (activeFileId && fileContents[activeFileId] !== undefined) saveMutation.mutate({ fileId: activeFileId, content: fileContents[activeFileId] });
            }} data-testid="button-save">
              <Save className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            className={`h-7 px-3 text-xs font-medium rounded-md gap-1.5 ${isRunning ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
            onClick={handleRun}
            disabled={runMutation.isPending}
            data-testid="button-run"
          >
            {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isRunning ? <><Square className="w-3 h-3 fill-current" /><span className="hidden sm:inline">Stop</span></> : <><Play className="w-3 h-3 fill-current" /><span className="hidden sm:inline">Run</span></>}
          </Button>
          <Button variant="ghost" size="icon" className={`w-7 h-7 hover:bg-[#30363d] ${aiPanelOpen ? "text-purple-400" : "text-[#8b949e] hover:text-white"}`} onClick={() => setAiPanelOpen(!aiPanelOpen)} data-testid="button-toggle-ai">
            <Sparkles className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#1c2128] border-[#30363d]">
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setProjectSettingsOpen(true)}>
                <Settings className="w-3.5 h-3.5" /> Project Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setTerminalVisible(!terminalVisible)}>
                <Terminal className="w-3.5 h-3.5" /> Toggle Terminal
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#30363d]" />
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setPublishDialogOpen(true)} data-testid="button-publish-menu">
                <Rocket className="w-3.5 h-3.5" /> Publish / Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* WORKSPACE BAR */}
      <div className="flex items-center justify-between px-3 h-8 bg-[#161b22]/70 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-[#8b949e]" />
          <span className="text-[11px] font-medium text-[#8b949e]">Workspace</span>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            wsStatus === "running" ? "bg-green-600/20 text-green-400 border border-green-600/30" :
            wsStatus === "starting" ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30" :
            wsStatus === "stopped" ? "bg-[#30363d] text-[#8b949e] border border-[#484f58]/30" :
            wsStatus === "error" ? "bg-red-600/20 text-red-400 border border-red-600/30" :
            wsStatus === "offline" ? "bg-orange-600/20 text-orange-400 border border-orange-600/30" :
            "bg-[#30363d] text-[#484f58] border border-[#30363d]"
          }`} data-testid="text-workspace-status">
            <span className={`w-1.5 h-1.5 rounded-full ${
              wsStatus === "running" ? "bg-green-400 animate-pulse" :
              wsStatus === "starting" ? "bg-yellow-400 animate-pulse" :
              wsStatus === "stopped" ? "bg-[#8b949e]" :
              wsStatus === "error" ? "bg-red-400" :
              wsStatus === "offline" ? "bg-orange-400" :
              "bg-[#484f58]"
            }`} />
            {wsStatus === "running" ? "Running" :
             wsStatus === "starting" ? "Starting..." :
             wsStatus === "stopped" ? "Stopped" :
             wsStatus === "error" ? "Error" :
             wsStatus === "offline" ? "Offline" :
             "Not initialized"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {runnerOnline === false && (
            <span className="flex items-center gap-1 text-[10px] text-orange-400 mr-1">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">VPS offline</span>
            </span>
          )}
          {wsStatus === "running" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-600/10 gap-1"
              onClick={handleStopWorkspace}
              disabled={wsLoading || stopWorkspaceMutation.isPending}
              data-testid="button-stop-workspace"
            >
              {wsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CircleStop className="w-3 h-3" />}
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-600/10 gap-1"
              onClick={handleStartWorkspace}
              disabled={wsLoading || initWorkspaceMutation.isPending || startWorkspaceMutation.isPending}
              data-testid="button-start-workspace"
            >
              {(wsLoading || initWorkspaceMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
              {wsStatus === "none" || wsStatus === "offline" ? "Init Workspace" : "Start"}
            </Button>
          )}
        </div>
      </div>

      {/* RUNNER OFFLINE BANNER */}
      {runnerOnline === false && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-600/10 border-b border-orange-600/20 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-[11px] text-orange-400">Runner offline — le VPS n'est pas encore déployé. Terminal et Preview live sont désactivés.</span>
        </div>
      )}

      {/* MAIN AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        {sidebarOpen && (
          <div className={`${window.innerWidth < 768 ? "absolute left-0 top-10 bottom-0 z-30" : "relative"} w-[220px] lg:w-[260px] bg-[#0d1117] border-r border-[#30363d] flex flex-col shrink-0`}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
              <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Explorer</span>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d] md:hidden" onClick={() => setSidebarOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filesQuery.data?.map((file) => (
                <div
                  key={file.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${file.id === activeFileId ? "bg-[#1f2937] text-white" : "text-[#c9d1d9] hover:bg-[#161b22]"}`}
                  onClick={() => openFile(file)}
                  data-testid={`file-item-${file.id}`}
                >
                  <FileIcon className={`w-3.5 h-3.5 shrink-0 ${getFileColor(file.filename)}`} />
                  {renamingFileId === file.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim() && renameValue !== file.filename) renameFileMutation.mutate({ fileId: file.id, filename: renameValue.trim() });
                        else setRenamingFileId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { if (renameValue.trim() && renameValue !== file.filename) renameFileMutation.mutate({ fileId: file.id, filename: renameValue.trim() }); else setRenamingFileId(null); }
                        if (e.key === "Escape") setRenamingFileId(null);
                      }}
                      className="flex-1 bg-[#0d1117] border border-[#58a6ff] rounded px-1 py-0.5 text-xs text-white outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-xs truncate">{file.filename}</span>
                  )}
                  {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white" onClick={(e) => { e.stopPropagation(); setRenamingFileId(file.id); setRenameValue(file.filename); }}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-red-400" onClick={(e) => { e.stopPropagation(); deleteFileMutation.mutate(file.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {filesQuery.data?.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-[#484f58] mb-2">No files yet</p>
                  <Button size="sm" variant="ghost" className="text-xs text-[#58a6ff]" onClick={() => setNewFileDialogOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Create File
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {sidebarOpen && window.innerWidth < 768 && (
          <div className="absolute inset-0 top-10 bg-black/40 z-20" onClick={() => setSidebarOpen(false)} />
        )}

        {/* CENTER: EDITOR + BOTTOM PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {openTabs.length > 0 && (
            <div className="flex items-center bg-[#0d1117] border-b border-[#30363d] overflow-x-auto shrink-0 scrollbar-hide">
              {openTabs.map((tabId) => {
                const file = filesQuery.data?.find((f) => f.id === tabId);
                if (!file) return null;
                const isActive = tabId === activeFileId;
                return (
                  <div
                    key={tabId}
                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#30363d] shrink-0 transition-colors ${isActive ? "bg-[#161b22] text-white border-t-2 border-t-[#58a6ff]" : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]/50 border-t-2 border-t-transparent"}`}
                    onClick={() => {
                      setActiveFileId(tabId);
                      if (fileContents[tabId] === undefined) setFileContents((prev) => ({ ...prev, [tabId]: file.content }));
                    }}
                    data-testid={`tab-${tabId}`}
                  >
                    <FileIcon className={`w-3 h-3 ${getFileColor(file.filename)}`} />
                    <span className="text-[11px] max-w-[100px] truncate">{file.filename}</span>
                    {dirtyFiles.has(tabId) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                    <button className="ml-0.5 p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white" onClick={(e) => closeTab(tabId, e)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden relative">
            {activeFileId ? (
              <CodeEditor
                value={currentCode}
                onChange={handleCodeChange}
                language={editorLanguage}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#484f58] gap-3">
                <FileCode2 className="w-12 h-12" />
                <p className="text-sm">Open a file to start editing</p>
                <Button variant="ghost" size="sm" className="text-[#58a6ff] hover:bg-[#161b22] text-xs" onClick={() => setSidebarOpen(true)}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Open Explorer
                </Button>
              </div>
            )}
          </div>

          {/* Bottom Panel */}
          {terminalVisible && (
            <div className="shrink-0 flex flex-col border-t border-[#30363d] bg-[#0d1117]" style={{ height: terminalHeight }}>
              <div
                className="h-1 cursor-ns-resize hover:bg-[#58a6ff]/30 transition-colors flex items-center justify-center shrink-0"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <div className="w-8 h-0.5 rounded-full bg-[#30363d]" />
              </div>
              <div className="flex items-center justify-between px-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
                <div className="flex items-center">
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "terminal" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent hover:text-[#c9d1d9]"}`} onClick={() => setBottomTab("terminal")}>
                    <Terminal className="w-3 h-3" /> Console
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  </button>
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "preview" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent hover:text-[#c9d1d9]"}`} onClick={() => setBottomTab("preview")}>
                    <Globe className="w-3 h-3" /> Preview
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="WebSocket connected" />}
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLogs([])}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setTerminalVisible(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {bottomTab === "terminal" ? (
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                  {logs.length === 0 && !isRunning && (
                    <p className="text-[#484f58] text-center py-4 text-xs">Press Run to execute your code</p>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#8b949e]"}`}>
                      <span className="whitespace-pre-wrap break-all">{log.text}</span>
                    </div>
                  ))}
                  {isRunning && <span className="animate-pulse text-[#58a6ff]">_</span>}
                </div>
              ) : (
                <div className="flex-1 overflow-hidden bg-white">
                  {previewHtml ? (
                    <iframe srcDoc={previewHtml} className="w-full h-full border-0" sandbox="allow-scripts" title="Preview" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-[#0d1117] text-[#484f58] gap-2">
                      <Globe className="w-8 h-8" />
                      <p className="text-xs">No preview available</p>
                      <p className="text-[10px] text-[#30363d]">Run HTML code to see preview here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI PANEL */}
        {aiPanelOpen && (
          <div className={`${window.innerWidth < 768 ? "absolute right-0 top-10 bottom-0 z-30" : "relative"} w-[300px] lg:w-[340px] shrink-0`}>
            <AIPanel
              context={activeFile ? { language: project?.language || "javascript", filename: activeFile.filename, code: currentCode } : undefined}
              onClose={() => setAiPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      {!terminalVisible && (
        <div className="flex items-center justify-between px-3 h-6 bg-[#161b22] border-t border-[#30363d] shrink-0">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-white" onClick={() => setTerminalVisible(true)}>
              <Terminal className="w-3 h-3" /> Console
            </button>
            {logs.length > 0 && <span className="text-[10px] text-[#484f58]">{logs.length} lines</span>}
          </div>
          <div className="flex items-center gap-2">
            {connected && <span className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Live</span>}
            {activeFile && <span className="text-[10px] text-[#484f58]">{editorLanguage}</span>}
          </div>
        </div>
      )}

      {/* DIALOGS */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">New File</DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">Create a new file in your project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newFileName.trim()) createFileMutation.mutate(newFileName.trim()); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Filename</Label>
              <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder={project?.language === "python" ? "script.py" : "index.ts"} className="bg-[#0d1117] border-[#30363d] h-9 text-sm text-[#c9d1d9] rounded-lg" autoFocus data-testid="input-new-filename" />
            </div>
            <Button type="submit" className="w-full h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs" disabled={createFileMutation.isPending}>
              {createFileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create File"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">Project Settings</DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">Configure your project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation.mutate({ name: projectName, language: projectLang }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Name</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-[#0d1117] border-[#30363d] h-9 text-sm text-[#c9d1d9] rounded-lg" data-testid="input-project-name-settings" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Language</Label>
              <div className="flex gap-2">
                {["javascript", "typescript", "python"].map((lang) => (
                  <button key={lang} type="button" onClick={() => setProjectLang(lang)} className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${projectLang === lang ? "bg-[#58a6ff] text-white" : "bg-[#30363d] text-[#8b949e] hover:text-white"}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full h-9 bg-[#58a6ff] hover:bg-[#4c96eb] text-white rounded-lg text-xs" disabled={updateProjectMutation.isPending}>
              {updateProjectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#58a6ff]" /> Publish Project
            </DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">Make your project publicly accessible via a shareable link</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
              <div>
                <p className="text-sm font-medium text-[#c9d1d9]">{project?.name}</p>
                <p className="text-[11px] text-[#8b949e] mt-0.5">{project?.language} · {filesQuery.data?.length || 0} files</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8b949e]">{project?.isPublished ? "Published" : "Draft"}</span>
                <Switch
                  checked={project?.isPublished || false}
                  onCheckedChange={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  data-testid="switch-publish"
                />
              </div>
            </div>

            {project?.isPublished && (
              <div className="space-y-2">
                <Label className="text-[11px] text-[#8b949e]">Shareable URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/shared/${projectId}`}
                    className="bg-[#0d1117] border-[#30363d] h-9 text-xs text-[#c9d1d9] rounded-lg flex-1"
                    data-testid="input-share-url"
                  />
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[#8b949e] hover:text-white hover:bg-[#30363d] shrink-0" onClick={copyShareUrl}>
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[#8b949e] hover:text-white hover:bg-[#30363d] shrink-0" onClick={() => window.open(`/shared/${projectId}`, "_blank")}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
