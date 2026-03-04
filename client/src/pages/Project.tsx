import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, Play, Square, Terminal, FileCode2, Plus, Save, Loader2,
  X, Trash2, Pencil, FolderOpen, Settings, MoreHorizontal,
  File as FileIcon, RefreshCw, Sparkles, Globe, Rocket, Copy, Check, ExternalLink,
  Server, AlertTriangle, Power, CircleStop, Wifi, WifiOff,
  Folder, FolderPlus, ChevronRight, ChevronDown, Monitor, Eye, Code2
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
import WorkspaceTerminal from "@/components/WorkspaceTerminal";
import type { Project as ProjectType, File } from "@shared/schema";

interface LogEntry {
  id: number;
  text: string;
  type: "info" | "error" | "success";
}

interface FsEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
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
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview" | "shell">("terminal");
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
  const [terminalWsUrl, setTerminalWsUrl] = useState<string | null>(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "file" | "dir" } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameDialogTarget, setRenameDialogTarget] = useState<{ id: string; oldName: string } | null>(null);
  const [renameDialogValue, setRenameDialogValue] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [currentFsPath, setCurrentFsPath] = useState("/");
  const [activeRunnerPath, setActiveRunnerPath] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "terminal" | "preview" | "ai">("editor");
  const [viewMode, setViewMode] = useState<"mobile" | "tablet" | "desktop">("desktop");

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  const useRunnerFS = wsStatus === "running";

  const runnerFsQuery = useQuery<FsEntry[]>({
    queryKey: ["/api/workspaces", projectId, "fs", currentFsPath],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${projectId}/fs?path=${encodeURIComponent(currentFsPath)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to list runner files");
      const data = await res.json();
      return (data as any[]).map((e: any) => ({
        name: e.name,
        path: (currentFsPath === "/" ? "/" : currentFsPath + "/") + e.name,
        type: e.type === "dir" || e.type === "directory" ? "dir" as const : "file" as const,
        size: e.size,
      })).sort((a: FsEntry, b: FsEntry) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },
    enabled: useRunnerFS,
    refetchInterval: useRunnerFS ? 10000 : false,
  });

  useEffect(() => {
    if (!useRunnerFS && filesQuery.data && filesQuery.data.length > 0 && openTabs.length === 0) {
      const f = filesQuery.data[0];
      setOpenTabs([f.id]);
      setActiveFileId(f.id);
      setFileContents((prev) => ({ ...prev, [f.id]: f.content }));
    }
  }, [filesQuery.data, useRunnerFS]);

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
    const updateViewMode = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setViewMode("mobile");
        setSidebarOpen(false);
      } else if (w < 1024) {
        setViewMode("tablet");
        setSidebarOpen(true);
      } else {
        setViewMode("desktop");
        setSidebarOpen(true);
      }
    };
    updateViewMode();
    window.addEventListener("resize", updateViewMode);
    return () => window.removeEventListener("resize", updateViewMode);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      if (fileId.startsWith("runner:")) {
        const path = fileId.slice(7);
        await apiRequest("POST", `/api/workspaces/${projectId}/fs/write`, { path, content });
      } else {
        await apiRequest("PATCH", `/api/files/${fileId}`, { content });
      }
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
    setActiveRunnerPath(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const openRunnerFile = async (entry: FsEntry) => {
    const tabId = `runner:${entry.path}`;
    if (!openTabs.includes(tabId)) setOpenTabs((prev) => [...prev, tabId]);
    if (fileContents[tabId] === undefined) {
      try {
        const res = await fetch(`/api/workspaces/${projectId}/fs/read?path=${encodeURIComponent(entry.path)}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to read file");
        const data = await res.json();
        setFileContents((prev) => ({ ...prev, [tabId]: data.content }));
      } catch {
        setFileContents((prev) => ({ ...prev, [tabId]: "" }));
        toast({ title: "Failed to read file", variant: "destructive" });
      }
    }
    setActiveFileId(tabId);
    setActiveRunnerPath(entry.path);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const closeTab = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (dirtyFiles.has(fileId) && fileContents[fileId] !== undefined) {
      saveMutation.mutate({ fileId, content: fileContents[fileId] });
    }
    const newTabs = openTabs.filter((id) => id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) {
      const nextTab = newTabs[newTabs.length - 1] || null;
      setActiveFileId(nextTab);
      if (nextTab?.startsWith("runner:")) {
        setActiveRunnerPath(nextTab.slice(7));
      } else {
        setActiveRunnerPath(null);
      }
    }
  };

  const runMutation = useMutation({
    mutationFn: async () => {
      if (activeFileId && dirtyFiles.has(activeFileId)) {
        if (activeFileId.startsWith("runner:")) {
          const path = activeFileId.slice(7);
          await apiRequest("POST", `/api/workspaces/${projectId}/fs/write`, { path, content: fileContents[activeFileId] });
        } else {
          await apiRequest("PATCH", `/api/files/${activeFileId}`, { content: fileContents[activeFileId] });
        }
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

  const invalidateFs = () => {
    if (useRunnerFS) {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", projectId, "fs"] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
  };

  const createFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      if (useRunnerFS) {
        const path = (currentFsPath === "/" ? "/" : currentFsPath + "/") + filename;
        await apiRequest("POST", `/api/workspaces/${projectId}/fs/write`, { path, content: "" });
        return { path, name: filename } as any;
      }
      const res = await apiRequest("POST", `/api/projects/${projectId}/files`, { filename, content: "" });
      return res.json();
    },
    onSuccess: (result: any) => {
      invalidateFs();
      if (useRunnerFS && result.path) {
        const entry: FsEntry = { name: result.name, path: result.path, type: "file" };
        openRunnerFile(entry);
      } else {
        openFile(result as File);
      }
      setNewFileDialogOpen(false);
      setNewFileName("");
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const path = (currentFsPath === "/" ? "/" : currentFsPath + "/") + folderName;
      await apiRequest("POST", `/api/workspaces/${projectId}/fs/mkdir`, { path });
    },
    onSuccess: () => {
      invalidateFs();
      setNewFolderDialogOpen(false);
      setNewFolderName("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to create folder", description: err.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => { await apiRequest("DELETE", `/api/files/${fileId}`); },
    onSuccess: (_, fileId) => {
      closeTab(fileId);
      invalidateFs();
    },
  });

  const deleteRunnerEntryMutation = useMutation({
    mutationFn: async (path: string) => {
      await apiRequest("DELETE", `/api/workspaces/${projectId}/fs/rm`, { path });
    },
    onSuccess: (_, path) => {
      const prefix = `runner:${path}`;
      const affectedTabs = openTabs.filter((t) => t === prefix || t.startsWith(prefix + "/"));
      affectedTabs.forEach((t) => closeTab(t));
      invalidateFs();
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ fileId, filename }: { fileId: string; filename: string }) => {
      await apiRequest("PATCH", `/api/files/${fileId}`, { filename });
    },
    onSuccess: () => {
      invalidateFs();
      setRenameDialogOpen(false);
      setRenameDialogTarget(null);
    },
  });

  const renameRunnerEntryMutation = useMutation({
    mutationFn: async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
      await apiRequest("POST", `/api/workspaces/${projectId}/fs/rename`, { oldPath, newPath });
    },
    onSuccess: (_, { oldPath, newPath }) => {
      const oldPrefix = `runner:${oldPath}`;
      const newPrefix = `runner:${newPath}`;
      setOpenTabs((prev) => prev.map((t) => {
        if (t === oldPrefix) return newPrefix;
        if (t.startsWith(oldPrefix + "/")) return newPrefix + t.slice(oldPrefix.length);
        return t;
      }));
      if (activeFileId === oldPrefix) {
        setActiveFileId(newPrefix);
        setActiveRunnerPath(newPath);
      } else if (activeFileId?.startsWith(oldPrefix + "/")) {
        const newId = newPrefix + activeFileId.slice(oldPrefix.length);
        setActiveFileId(newId);
        setActiveRunnerPath(newId.slice(7));
      }
      setFileContents((prev) => {
        const n: Record<string, string> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (k === oldPrefix) n[newPrefix] = v;
          else if (k.startsWith(oldPrefix + "/")) n[newPrefix + k.slice(oldPrefix.length)] = v;
          else n[k] = v;
        }
        return n;
      });
      invalidateFs();
      setRenameDialogOpen(false);
      setRenameDialogTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to rename", description: err.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string, name: string, type: "file" | "dir") => {
    setDeleteTarget({ id, name, type });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.id.startsWith("runner:") || useRunnerFS) {
      const path = deleteTarget.id.startsWith("runner:") ? deleteTarget.id.slice(7) : deleteTarget.id;
      deleteRunnerEntryMutation.mutate(path);
    } else {
      deleteFileMutation.mutate(deleteTarget.id);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleRename = (id: string, oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      return;
    }
    if (id.startsWith("runner:")) {
      const oldPath = id.slice(7);
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/") + 1);
      renameRunnerEntryMutation.mutate({ oldPath, newPath: parentDir + newName.trim() });
    } else {
      renameFileMutation.mutate({ fileId: id, filename: newName.trim() });
    }
  };

  const openRenameDialog = (id: string, name: string) => {
    setRenameDialogTarget({ id, oldName: name });
    setRenameDialogValue(name);
    setRenameDialogOpen(true);
  };

  const submitRenameDialog = () => {
    if (!renameDialogTarget) return;
    handleRename(renameDialogTarget.id, renameDialogTarget.oldName, renameDialogValue);
    setRenameDialogOpen(false);
    setRenameDialogTarget(null);
  };

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
  };

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

  const prevWsStatus = useRef(wsStatus);
  useEffect(() => {
    if (workspaceStatusQuery.data?.status) {
      const newStatus = workspaceStatusQuery.data.status;
      if (prevWsStatus.current === "running" && (newStatus === "stopped" || newStatus === "none" || newStatus === "offline")) {
        const runnerTabs = openTabs.filter((t) => t.startsWith("runner:"));
        if (runnerTabs.length > 0) {
          runnerTabs.forEach((t) => {
            if (dirtyFiles.has(t)) {
              setDirtyFiles((prev) => { const n = new Set(prev); n.delete(t); return n; });
            }
          });
          setOpenTabs((prev) => prev.filter((t) => !t.startsWith("runner:")));
          setFileContents((prev) => {
            const n: Record<string, string> = {};
            for (const [k, v] of Object.entries(prev)) {
              if (!k.startsWith("runner:")) n[k] = v;
            }
            return n;
          });
          if (activeFileId?.startsWith("runner:")) {
            const remaining = openTabs.filter((t) => !t.startsWith("runner:"));
            setActiveFileId(remaining[remaining.length - 1] || null);
            setActiveRunnerPath(null);
          }
          setCurrentFsPath("/");
          toast({ title: "Workspace stopped", description: "Runner file tabs have been closed" });
        }
      }
      prevWsStatus.current = newStatus;
      setWsStatus(newStatus);
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

  useEffect(() => {
    if (wsStatus === "running" && projectId) {
      fetch(`/api/workspaces/${projectId}/terminal-url`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to get terminal URL");
          return r.json();
        })
        .then((d) => setTerminalWsUrl(d.wsUrl))
        .catch(() => setTerminalWsUrl(null));
      fetch(`/api/workspaces/${projectId}/preview-url`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to get preview URL");
          return r.json();
        })
        .then((d) => setLivePreviewUrl(d.previewUrl))
        .catch(() => setLivePreviewUrl(null));
    } else {
      setTerminalWsUrl(null);
      setLivePreviewUrl(null);
    }
  }, [wsStatus, projectId]);

  const initWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/workspaces/${projectId}`);
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.online) {
        setRunnerOnline(false);
        setWsStatus("offline");
        toast({ title: "Runner offline", description: "The runner VPS is not yet deployed", variant: "destructive" });
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
  const isRunnerTab = activeFileId?.startsWith("runner:");
  const activeFile = isRunnerTab ? null : filesQuery.data?.find((f) => f.id === activeFileId);
  const activeFileName = isRunnerTab ? (activeFileId!.slice(7).split("/").pop() || "") : (activeFile?.filename || "");
  const currentCode = activeFileId ? fileContents[activeFileId] ?? "" : "";
  const editorLanguage = activeFileName ? detectLanguage(activeFileName) : "javascript";

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

  const isMobile = viewMode === "mobile";
  const isTablet = viewMode === "tablet";

  const sidebarContent = (
    <div className={`${isMobile ? "flex-1" : "h-full"} bg-[#0d1117] flex flex-col ${isMobile ? "" : "border-r border-[#30363d]"} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Explorer</span>
          {useRunnerFS && <span className="text-[9px] px-1 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-600/30">LIVE</span>}
        </div>
        <div className="flex items-center gap-0.5">
          {useRunnerFS && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setNewFolderDialogOpen(true)} data-testid="button-new-folder" title="New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file" title="New File">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          {!isMobile && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[#8b949e] hover:text-white hover:bg-[#30363d] lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {useRunnerFS && currentFsPath !== "/" && (
        <button className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-[#58a6ff] hover:bg-[#161b22] border-b border-[#30363d] shrink-0" onClick={() => {
          const parent = currentFsPath.substring(0, currentFsPath.lastIndexOf("/")) || "/";
          setCurrentFsPath(parent);
        }}>
          <ChevronLeft className="w-3 h-3" /> ..
        </button>
      )}
      <div className="flex-1 overflow-y-auto py-1">
        {useRunnerFS ? (
          <>
            {runnerFsQuery.data?.map((entry) => {
              const entryId = `runner:${entry.path}`;
              const isDir = entry.type === "dir";
              return (
                <div
                  key={entry.path}
                  className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${entryId === activeFileId ? "bg-[#1f2937] text-white" : "text-[#c9d1d9] hover:bg-[#161b22]"}`}
                  onClick={() => { isDir ? setCurrentFsPath(entry.path) : openRunnerFile(entry); if (isMobile && !isDir) setMobileTab("editor"); }}
                  data-testid={`fs-entry-${entry.name}`}
                >
                  {isDir ? <Folder className="w-3.5 h-3.5 shrink-0 text-[#8b949e]" /> : <FileIcon className={`w-3.5 h-3.5 shrink-0 ${getFileColor(entry.name)}`} />}
                  <span className="flex-1 text-xs truncate">{entry.name}{isDir ? "/" : ""}</span>
                  {!isDir && dirtyFiles.has(entryId) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white" onClick={(e) => { e.stopPropagation(); openRenameDialog(entryId, entry.name); }} data-testid={`button-rename-${entry.name}`}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDelete(entry.path, entry.name, entry.type); }} data-testid={`button-delete-${entry.name}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {runnerFsQuery.isLoading && <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#58a6ff]" /></div>}
            {runnerFsQuery.data?.length === 0 && !runnerFsQuery.isLoading && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-[#484f58] mb-2">Empty directory</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="ghost" className="text-xs text-[#58a6ff]" onClick={() => setNewFileDialogOpen(true)}><Plus className="w-3 h-3 mr-1" /> File</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-[#58a6ff]" onClick={() => setNewFolderDialogOpen(true)}><FolderPlus className="w-3 h-3 mr-1" /> Folder</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {(wsStatus === "stopped" || wsStatus === "none" || wsStatus === "offline") && (
              <div className="px-3 py-3 border-b border-[#30363d]">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
                  <Server className="w-3.5 h-3.5 text-[#8b949e] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#8b949e]">{wsStatus === "offline" ? "Runner VPS offline" : wsStatus === "none" ? "Workspace not initialized" : "Workspace stopped"}</p>
                    <p className="text-[9px] text-[#484f58] mt-0.5">Start workspace for live file system</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] text-green-400 hover:text-green-300 hover:bg-green-600/10 shrink-0" onClick={handleStartWorkspace} disabled={wsLoading || initWorkspaceMutation.isPending || startWorkspaceMutation.isPending} data-testid="button-sidebar-start-workspace">
                    {(wsLoading || initWorkspaceMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            )}
            {filesQuery.data?.map((file) => (
              <div
                key={file.id}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${file.id === activeFileId ? "bg-[#1f2937] text-white" : "text-[#c9d1d9] hover:bg-[#161b22]"}`}
                onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                data-testid={`file-item-${file.id}`}
              >
                <FileIcon className={`w-3.5 h-3.5 shrink-0 ${getFileColor(file.filename)}`} />
                <span className="flex-1 text-xs truncate">{file.filename}</span>
                {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white" onClick={(e) => { e.stopPropagation(); openRenameDialog(file.id, file.filename); }} data-testid={`button-rename-${file.id}`}><Pencil className="w-3 h-3" /></button>
                  <button className="p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.filename, "file"); }} data-testid={`button-delete-${file.id}`}><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {filesQuery.data?.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-[#484f58] mb-2">No files yet</p>
                <Button size="sm" variant="ghost" className="text-xs text-[#58a6ff]" onClick={() => setNewFileDialogOpen(true)}><Plus className="w-3 h-3 mr-1" /> Create File</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const editorTabBar = openTabs.length > 0 ? (
    <div className="flex items-center bg-[#0d1117] border-b border-[#30363d] overflow-x-auto shrink-0 scrollbar-hide">
      {openTabs.map((tabId) => {
        const isRunner = tabId.startsWith("runner:");
        const file = isRunner ? null : filesQuery.data?.find((f) => f.id === tabId);
        const tabName = isRunner ? tabId.slice(7).split("/").pop() || tabId : file?.filename || tabId;
        if (!isRunner && !file) return null;
        const isActive = tabId === activeFileId;
        return (
          <div key={tabId} className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-[#30363d] shrink-0 transition-colors ${isActive ? "bg-[#161b22] text-white border-t-2 border-t-[#58a6ff]" : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]/50 border-t-2 border-t-transparent"}`}
            onClick={() => { setActiveFileId(tabId); if (isRunner) { setActiveRunnerPath(tabId.slice(7)); } else { setActiveRunnerPath(null); if (file && fileContents[tabId] === undefined) setFileContents((prev) => ({ ...prev, [tabId]: file.content })); } }}
            data-testid={`tab-${tabId}`}
          >
            <FileIcon className={`w-3 h-3 ${getFileColor(tabName)}`} />
            <span className="text-[11px] max-w-[100px] truncate">{tabName}</span>
            {dirtyFiles.has(tabId) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
            <button className="ml-0.5 p-0.5 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-white" onClick={(e) => closeTab(tabId, e)}><X className="w-3 h-3" /></button>
          </div>
        );
      })}
    </div>
  ) : null;

  const editorContent = (
    <div className="flex-1 overflow-hidden relative">
      {activeFileId ? (
        <CodeEditor value={currentCode} onChange={handleCodeChange} language={editorLanguage} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-[#0d1117]">
          <div className="max-w-md text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#58a6ff]/10 to-purple-600/10 border border-[#30363d] flex items-center justify-center mx-auto mb-6">
              <Code2 className="w-10 h-10 text-[#58a6ff]/50" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{project?.name || "Untitled"}</h3>
            <p className="text-sm text-[#8b949e] mb-6">Select a file from the explorer to start editing, or create a new one.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="ghost" size="sm" className="text-[#58a6ff] hover:bg-[#161b22] text-xs gap-1.5 h-8" onClick={() => { if (isMobile) setMobileTab("files"); else { setSidebarOpen(true); setAiPanelOpen(false); } }} data-testid="button-open-explorer">
                <FolderOpen className="w-3.5 h-3.5" /> Open Explorer
              </Button>
              <Button variant="ghost" size="sm" className="text-purple-400 hover:bg-purple-600/10 text-xs gap-1.5 h-8" onClick={() => { if (isMobile) setMobileTab("ai"); else { setAiPanelOpen(true); setSidebarOpen(false); } }} data-testid="button-open-ai-empty">
                <Sparkles className="w-3.5 h-3.5" /> Ask AI Agent
              </Button>
              <Button variant="ghost" size="sm" className="text-green-400 hover:bg-green-600/10 text-xs gap-1.5 h-8" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file-empty">
                <Plus className="w-3.5 h-3.5" /> New File
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const terminalContent = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
      {logs.length === 0 && !isRunning && <p className="text-[#484f58] text-center py-4 text-xs">Press Run to execute your code</p>}
      {logs.map((log) => (
        <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#8b949e]"}`}>
          <span className="whitespace-pre-wrap break-all">{log.text}</span>
        </div>
      ))}
      {isRunning && <span className="animate-pulse text-[#58a6ff]">_</span>}
    </div>
  );

  const previewContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#0d1117]">
      {runnerOnline === false ? (
        <div className="flex flex-col items-center justify-center h-full text-[#484f58] gap-2">
          <WifiOff className="w-8 h-8 text-orange-400/60" />
          <p className="text-xs text-orange-400/80">Preview unavailable (runner offline)</p>
        </div>
      ) : wsStatus === "running" && livePreviewUrl ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[#30363d] bg-[#161b22] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[#8b949e] shrink-0" />
              <span className="text-[11px] text-[#8b949e] truncate">{livePreviewUrl}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]"
                onClick={() => { const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = livePreviewUrl; }}
                title="Refresh" data-testid="button-preview-refresh"><RefreshCw className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] text-[#8b949e] hover:text-white hover:bg-[#30363d] gap-1"
                onClick={() => window.open(livePreviewUrl, "_blank")} data-testid="button-preview-new-tab"><ExternalLink className="w-3 h-3" /> Open</Button>
            </div>
          </div>
          <iframe id="live-preview-iframe" src={livePreviewUrl} className="flex-1 w-full border-0 bg-white" title="Live Preview" data-testid="iframe-live-preview" />
        </>
      ) : previewHtml ? (
        <iframe srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts" title="Preview" />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[#484f58] gap-3">
          <Globe className="w-10 h-10" />
          <p className="text-sm font-medium text-[#c9d1d9]">Live Preview</p>
          {wsStatus === "none" || wsStatus === "stopped" ? (
            <>
              <p className="text-xs text-center max-w-[280px]">Start your server on port <span className="text-[#58a6ff] font-mono">:3000</span> in the workspace to see the preview here.</p>
              <p className="text-[10px] text-[#30363d]">Start the workspace then run your app</p>
            </>
          ) : (
            <p className="text-xs">Workspace starting up...</p>
          )}
        </div>
      )}
    </div>
  );

  const shellContent = (
    <div className="flex-1 overflow-hidden">
      <WorkspaceTerminal wsUrl={terminalWsUrl} runnerOffline={runnerOnline === false} visible={true} />
    </div>
  );

  const bottomPanel = (
    <div className="shrink-0 flex flex-col border-t border-[#30363d] bg-[#0d1117]" style={{ height: terminalHeight }}>
      <div className="h-1 cursor-ns-resize hover:bg-[#58a6ff]/30 transition-colors flex items-center justify-center shrink-0" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
        <div className="w-8 h-0.5 rounded-full bg-[#30363d]" />
      </div>
      <div className="flex items-center justify-between px-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center">
          <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "terminal" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent hover:text-[#c9d1d9]"}`} onClick={() => setBottomTab("terminal")}>
            <Terminal className="w-3 h-3" /> Console {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </button>
          <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "preview" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent hover:text-[#c9d1d9]"}`} onClick={() => setBottomTab("preview")} data-testid="tab-preview">
            <Globe className="w-3 h-3" /> Preview {wsStatus === "running" && livePreviewUrl && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
          </button>
          <button className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "shell" ? "text-[#c9d1d9] border-[#58a6ff]" : "text-[#8b949e] border-transparent hover:text-[#c9d1d9]"}`} onClick={() => setBottomTab("shell")} data-testid="tab-shell">
            <Server className="w-3 h-3" /> Shell {wsStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </button>
        </div>
        <div className="flex items-center gap-1">
          {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="WebSocket connected" />}
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLogs([])}><RefreshCw className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setTerminalVisible(false)}><X className="w-3 h-3" /></Button>
        </div>
      </div>
      {bottomTab === "terminal" ? terminalContent : bottomTab === "shell" ? shellContent : bottomTab === "preview" ? previewContent : null}
    </div>
  );

  const wsStatusBadge = (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      wsStatus === "running" ? "bg-green-600/20 text-green-400 border border-green-600/30" :
      wsStatus === "starting" ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30" :
      wsStatus === "stopped" ? "bg-[#30363d] text-[#8b949e] border border-[#484f58]/30" :
      wsStatus === "error" ? "bg-red-600/20 text-red-400 border border-red-600/30" :
      wsStatus === "offline" ? "bg-orange-600/20 text-orange-400 border border-orange-600/30" :
      "bg-[#30363d] text-[#484f58] border border-[#30363d]"
    }`} data-testid="text-workspace-status">
      <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "running" ? "bg-green-400 animate-pulse" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "stopped" ? "bg-[#8b949e]" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[#484f58]"}`} />
      {wsStatus === "running" ? "Running" : wsStatus === "starting" ? "Starting..." : wsStatus === "stopped" ? "Stopped" : wsStatus === "error" ? "Error" : wsStatus === "offline" ? "Offline" : "Init"}
    </span>
  );

  const workspaceButton = wsStatus === "running" ? (
    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-600/10 gap-1" onClick={handleStopWorkspace} disabled={wsLoading || stopWorkspaceMutation.isPending} data-testid="button-stop-workspace">
      {wsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CircleStop className="w-3 h-3" />} Stop
    </Button>
  ) : (
    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-600/10 gap-1" onClick={handleStartWorkspace} disabled={wsLoading || initWorkspaceMutation.isPending || startWorkspaceMutation.isPending} data-testid="button-start-workspace">
      {(wsLoading || initWorkspaceMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />} {wsStatus === "none" || wsStatus === "offline" ? "Init" : "Start"}
    </Button>
  );

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-sm select-none overflow-hidden">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-2 h-10 bg-[#161b22] border-b border-[#30363d] shrink-0 z-40">
        <div className="flex items-center gap-1 min-w-0">
          <Button variant="ghost" size="icon" className="w-7 h-7 text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/dashboard")} data-testid="button-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1.5 ml-1 min-w-0">
            <span className="text-xs font-semibold text-[#c9d1d9] truncate max-w-[140px]">{project?.name}</span>
            {!isMobile && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#30363d] text-[#8b949e] shrink-0">{project?.language}</span>}
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
              {!isMobile && (
                <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setTerminalVisible(!terminalVisible)}>
                  <Terminal className="w-3.5 h-3.5" /> Toggle Terminal
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-[#30363d]" />
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setPublishDialogOpen(true)} data-testid="button-publish-menu">
                <Rocket className="w-3.5 h-3.5" /> Publish / Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* RUNNER OFFLINE BANNER */}
      {runnerOnline === false && !isMobile && (
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-600/10 border-b border-orange-600/20 shrink-0">
          <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />
          <span className="text-[10px] text-orange-400">Runner offline — Live terminal and preview are disabled.</span>
        </div>
      )}

      {/* === MOBILE LAYOUT === */}
      {isMobile ? (
        <>
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {mobileTab === "files" && sidebarContent}
            {mobileTab === "editor" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {editorTabBar}
                {editorContent}
              </div>
            )}
            {mobileTab === "terminal" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
                <div className="flex items-center justify-between px-2 py-1 border-b border-[#30363d] bg-[#161b22] shrink-0">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-[#8b949e]" />
                    <span className="text-[11px] text-[#8b949e]">Console</span>
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {wsStatusBadge}
                    {workspaceButton}
                  </div>
                </div>
                {terminalContent}
                {wsStatus === "running" && (
                  <div className="border-t border-[#30363d] shrink-0" style={{ height: "40%" }}>
                    {shellContent}
                  </div>
                )}
              </div>
            )}
            {mobileTab === "preview" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
                {previewContent}
              </div>
            )}
            {mobileTab === "ai" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <AIPanel
                  context={(activeFile || isRunnerTab) ? { language: project?.language || "javascript", filename: activeFileName, code: currentCode } : undefined}
                  onClose={() => setMobileTab("editor")}
                  projectId={projectId}
                  files={filesQuery.data}
                  onFileCreated={(file) => {
                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
                    setOpenTabs((prev) => prev.includes(file.id) ? prev : [...prev, file.id]);
                    setActiveFileId(file.id);
                    setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
                    setMobileTab("editor");
                  }}
                  onFileUpdated={(file) => {
                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
                    setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
                  }}
                  onApplyCode={(filename, code) => {
                    const file = filesQuery.data?.find((f) => f.filename === filename);
                    if (file) {
                      setFileContents((prev) => ({ ...prev, [file.id]: code }));
                      setDirtyFiles((prev) => new Set(prev).add(file.id));
                      if (!openTabs.includes(file.id)) setOpenTabs((prev) => [...prev, file.id]);
                      setActiveFileId(file.id);
                      setMobileTab("editor");
                    }
                  }}
                />
              </div>
            )}
          </div>
          {/* MOBILE BOTTOM NAV */}
          <div className="flex items-center justify-around h-12 bg-[#161b22] border-t border-[#30363d] shrink-0 z-40" data-testid="mobile-nav-bar">
            {([
              { id: "files" as const, icon: FolderOpen, label: "Files" },
              { id: "editor" as const, icon: Code2, label: "Editor" },
              { id: "terminal" as const, icon: Terminal, label: "Terminal" },
              { id: "preview" as const, icon: Globe, label: "Preview" },
              { id: "ai" as const, icon: Sparkles, label: "AI" },
            ]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileTab === id ? "text-[#58a6ff]" : "text-[#484f58]"}`}
                onClick={() => setMobileTab(id)}
                data-testid={`mobile-tab-${id}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{label}</span>
                {id === "terminal" && isRunning && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* === TABLET + DESKTOP LAYOUT: VS Code style === */}
          <div className="flex flex-1 overflow-hidden">
            {/* ACTIVITY BAR — VS Code style icon strip */}
            <div className="w-12 bg-[#161b22] border-r border-[#30363d] flex flex-col items-center py-2 gap-1 shrink-0" data-testid="activity-bar">
              <button
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${sidebarOpen && !aiPanelOpen ? "text-white bg-[#0d1117]" : "text-[#8b949e] hover:text-white hover:bg-[#30363d]"}`}
                onClick={() => { setSidebarOpen(!sidebarOpen || aiPanelOpen); setAiPanelOpen(false); }}
                title="Explorer"
                data-testid="activity-explorer"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
              <button
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${aiPanelOpen ? "text-purple-400 bg-purple-600/10" : "text-[#8b949e] hover:text-white hover:bg-[#30363d]"}`}
                onClick={() => { setAiPanelOpen(!aiPanelOpen); if (!aiPanelOpen) setSidebarOpen(false); }}
                title="AI Agent"
                data-testid="activity-ai"
              >
                <Sparkles className="w-5 h-5" />
              </button>

              <div className="flex-1" />

              <div className="flex flex-col items-center gap-1 mb-1">
                <div className="w-8 border-t border-[#30363d] mb-1" />
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-[#8b949e] hover:text-white hover:bg-[#30363d] transition-colors"
                  onClick={handleStartWorkspace}
                  disabled={wsLoading || initWorkspaceMutation.isPending || startWorkspaceMutation.isPending}
                  title={`Workspace: ${wsStatus}`}
                  data-testid="activity-workspace"
                >
                  <Server className="w-5 h-5" />
                  <span className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-[#161b22] ${wsStatus === "running" ? "bg-green-400" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[#484f58]"}`} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-[#8b949e] hover:text-white hover:bg-[#30363d] transition-colors"
                  onClick={() => setProjectSettingsOpen(true)}
                  title="Settings"
                  data-testid="activity-settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* AI AGENT PANEL — Main panel like Replit Agent (when open) */}
            {aiPanelOpen && (
              <div className={`${isTablet ? "w-[320px]" : "w-[45%] max-w-[600px] min-w-[340px]"} shrink-0 border-r border-[#30363d]`} data-testid="ai-agent-panel">
                <AIPanel
                  context={(activeFile || isRunnerTab) ? { language: project?.language || "javascript", filename: activeFileName, code: currentCode } : undefined}
                  onClose={() => setAiPanelOpen(false)}
                  projectId={projectId}
                  files={filesQuery.data}
                  onFileCreated={(file) => {
                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
                    setOpenTabs((prev) => prev.includes(file.id) ? prev : [...prev, file.id]);
                    setActiveFileId(file.id);
                    setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
                  }}
                  onFileUpdated={(file) => {
                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
                    setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
                  }}
                  onApplyCode={(filename, code) => {
                    const file = filesQuery.data?.find((f) => f.filename === filename);
                    if (file) {
                      setFileContents((prev) => ({ ...prev, [file.id]: code }));
                      setDirtyFiles((prev) => new Set(prev).add(file.id));
                      if (!openTabs.includes(file.id)) {
                        setOpenTabs((prev) => [...prev, file.id]);
                      }
                      setActiveFileId(file.id);
                      toast({ title: "Code applied", description: `Updated ${filename}` });
                    }
                  }}
                />
              </div>
            )}

            {/* FILE EXPLORER SIDEBAR */}
            {sidebarOpen && !aiPanelOpen && (
              <div className={`${isTablet ? "w-[200px]" : "w-[240px]"} shrink-0`}>
                {sidebarContent}
              </div>
            )}

            {/* MAIN EDITOR AREA */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {editorTabBar}
              {editorContent}
              {terminalVisible && bottomPanel}
            </div>
          </div>

          {/* STATUS BAR */}
          <div className="flex items-center justify-between px-3 h-6 bg-[#161b22] border-t border-[#30363d] shrink-0">
            <div className="flex items-center gap-3">
              {!terminalVisible ? (
                <button className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-white" onClick={() => setTerminalVisible(true)}>
                  <Terminal className="w-3 h-3" /> Console
                </button>
              ) : (
                <span className="text-[10px] text-[#484f58]">{logs.length} lines</span>
              )}
              {wsStatus !== "none" && (
                <span className="flex items-center gap-1 text-[10px] text-[#484f58]">
                  <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "running" ? "bg-green-400" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : "bg-[#484f58]"}`} />
                  {wsStatus === "running" ? "Workspace running" : wsStatus === "starting" ? "Starting..." : wsStatus}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {connected && <span className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Live</span>}
              {activeFileName && <span className="text-[10px] text-[#484f58]">{editorLanguage}</span>}
            </div>
          </div>
        </>
      )}

      {/* DIALOGS */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">New File</DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">
              {useRunnerFS
                ? <>Create a new file in <span className="text-[#c9d1d9] font-mono">{currentFsPath === "/" ? "/" : currentFsPath}</span> (Runner FS)</>
                : "Create a new file in your project"}
            </DialogDescription>
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
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">New Folder</DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">Create a new folder in {currentFsPath === "/" ? "root" : currentFsPath}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim()); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">Folder name</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="src" className="bg-[#0d1117] border-[#30363d] h-9 text-sm text-[#c9d1d9] rounded-lg" autoFocus data-testid="input-new-foldername" />
            </div>
            <Button type="submit" className="w-full h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs" disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create Folder"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">Delete {deleteTarget?.type === "dir" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">
              Are you sure you want to delete <span className="text-[#c9d1d9] font-medium">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1 h-9 text-xs text-[#8b949e] hover:text-white hover:bg-[#30363d] rounded-lg" onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
              Cancel
            </Button>
            <Button className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs" onClick={confirmDelete} disabled={deleteRunnerEntryMutation.isPending || deleteFileMutation.isPending} data-testid="button-confirm-delete">
              {(deleteRunnerEntryMutation.isPending || deleteFileMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={(open) => { setRenameDialogOpen(open); if (!open) setRenameDialogTarget(null); }}>
        <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#c9d1d9] text-base">Rename</DialogTitle>
            <DialogDescription className="text-[#8b949e] text-xs">
              Rename <span className="text-[#c9d1d9] font-medium">{renameDialogTarget?.oldName}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitRenameDialog(); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#8b949e]">New name</Label>
              <Input
                value={renameDialogValue}
                onChange={(e) => setRenameDialogValue(e.target.value)}
                className="bg-[#0d1117] border-[#30363d] h-9 text-sm text-[#c9d1d9] rounded-lg"
                autoFocus
                data-testid="input-rename"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 h-9 text-xs text-[#8b949e] hover:text-white hover:bg-[#30363d] rounded-lg" onClick={() => { setRenameDialogOpen(false); setRenameDialogTarget(null); }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-9 bg-[#58a6ff] hover:bg-[#4c96eb] text-white rounded-lg text-xs" disabled={!renameDialogValue.trim() || renameDialogValue === renameDialogTarget?.oldName || renameFileMutation.isPending || renameRunnerEntryMutation.isPending} data-testid="button-confirm-rename">
                {(renameFileMutation.isPending || renameRunnerEntryMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : "Rename"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
