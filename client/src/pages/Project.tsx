import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, Play, Square, Terminal, FileCode2, Plus, Loader2,
  X, Trash2, Pencil, FolderOpen, Settings, MoreHorizontal,
  File as FileIcon, RefreshCw, Sparkles, Globe, Rocket, Copy, Check, ExternalLink,
  Server, AlertTriangle, Power, CircleStop, Wifi, WifiOff,
  Folder, FolderPlus, ChevronRight, ChevronDown, Monitor, Eye, Code2,
  Search, Hash, PanelLeft, Users, GitBranch
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
  const [bottomTab, setBottomTab] = useState<"terminal" | "shell">("terminal");
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(40);
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
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ fileId: string; filename: string; line: number; text: string }[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(220);
  const dragStartX = useRef<number | null>(null);
  const dragStartW = useRef<number>(40);
  const editorPreviewContainerRef = useRef<HTMLDivElement>(null);

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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchPanelOpen((prev) => !prev);
        if (!searchPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
        setAiPanelOpen(false);
        setSearchPanelOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning && !runMutation.isPending) handleRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFileId, fileContents, searchPanelOpen, isRunning]);

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
        .then((d) => {
          setLivePreviewUrl(d.previewUrl);
          if (d.previewUrl) setPreviewPanelOpen(true);
        })
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

  const handlePreviewDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragStartX.current = x;
    dragStartW.current = previewPanelWidth;
    const totalWidth = editorPreviewContainerRef.current?.clientWidth || window.innerWidth;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (dragStartX.current === null) return;
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const deltaPercent = ((dragStartX.current - cx) / totalWidth) * 100;
      setPreviewPanelWidth(Math.max(20, Math.min(60, dragStartW.current + deltaPercent)));
    };
    const onUp = () => {
      dragStartX.current = null;
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

  const performSearch = useCallback((term: string) => {
    if (!term.trim() || !filesQuery.data) {
      setSearchResults([]);
      return;
    }
    const results: { fileId: string; filename: string; line: number; text: string }[] = [];
    const lowerTerm = term.toLowerCase();
    for (const file of filesQuery.data) {
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerTerm)) {
          results.push({ fileId: file.id, filename: file.filename, line: i + 1, text: lines[i].trim() });
          if (results.length >= 100) break;
        }
      }
      if (results.length >= 100) break;
    }
    setSearchResults(results);
  }, [filesQuery.data]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm, performSearch]);

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
    return c[ext || ""] || "text-[#9DA2B0]";
  };

  if (projectQuery.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1C2333]">
        <Loader2 className="w-6 h-6 animate-spin text-[#0079F2]" />
      </div>
    );
  }

  const isMobile = viewMode === "mobile";
  const isTablet = viewMode === "tablet";

  const sidebarContent = (
    <div className={`${isMobile ? "flex-1" : "h-full"} bg-[#1C2333] flex flex-col ${isMobile ? "" : "border-r border-[#2B3245]"} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest">Files</span>
          {useRunnerFS && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20">LIVE</span>}
        </div>
        <div className="flex items-center gap-0">
          {useRunnerFS && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setNewFolderDialogOpen(true)} data-testid="button-new-folder" title="New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file" title="New File">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {useRunnerFS && currentFsPath !== "/" && (
        <button className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-[#0079F2] hover:bg-[#2B3245] border-b border-[#2B3245] shrink-0" onClick={() => {
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
                  className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${entryId === activeFileId ? "bg-[#2B3245] text-[#F5F9FC]" : "text-[#9DA2B0] hover:bg-[#323B4F] hover:text-[#F5F9FC]"}`}
                  onClick={() => { isDir ? setCurrentFsPath(entry.path) : openRunnerFile(entry); if (isMobile && !isDir) setMobileTab("editor"); }}
                  data-testid={`fs-entry-${entry.name}`}
                >
                  {isDir ? <Folder className="w-3.5 h-3.5 shrink-0 text-[#9DA2B0]" /> : <FileIcon className={`w-3.5 h-3.5 shrink-0 ${getFileColor(entry.name)}`} />}
                  <span className="flex-1 text-xs truncate">{entry.name}{isDir ? "/" : ""}</span>
                  {!isDir && dirtyFiles.has(entryId) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#9DA2B0] hover:text-white" onClick={(e) => { e.stopPropagation(); openRenameDialog(entryId, entry.name); }} data-testid={`button-rename-${entry.name}`}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#9DA2B0] hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDelete(entry.path, entry.name, entry.type); }} data-testid={`button-delete-${entry.name}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {runnerFsQuery.isLoading && <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#0079F2]" /></div>}
            {runnerFsQuery.data?.length === 0 && !runnerFsQuery.isLoading && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-[#676D7E] mb-2">Empty directory</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="ghost" className="text-xs text-[#0079F2]" onClick={() => setNewFileDialogOpen(true)}><Plus className="w-3 h-3 mr-1" /> File</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-[#0079F2]" onClick={() => setNewFolderDialogOpen(true)}><FolderPlus className="w-3 h-3 mr-1" /> Folder</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {(wsStatus === "stopped" || wsStatus === "none" || wsStatus === "offline") && (
              <div className="px-2 py-2 border-b border-[#2B3245]">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#1C2333] border border-[#2B3245]">
                  <Server className="w-3 h-3 text-[#676D7E] shrink-0" />
                  <span className="text-[10px] text-[#9DA2B0] flex-1">{wsStatus === "offline" ? "Runner offline" : "Start workspace"}</span>
                  <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] text-green-400 hover:text-green-300 hover:bg-green-600/10 shrink-0" onClick={handleStartWorkspace} disabled={wsLoading || initWorkspaceMutation.isPending || startWorkspaceMutation.isPending} data-testid="button-sidebar-start-workspace">
                    {(wsLoading || initWorkspaceMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            )}
            {filesQuery.data?.map((file) => (
              <div
                key={file.id}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${file.id === activeFileId ? "bg-[#2B3245] text-[#F5F9FC]" : "text-[#9DA2B0] hover:bg-[#323B4F] hover:text-[#F5F9FC]"}`}
                onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                data-testid={`file-item-${file.id}`}
              >
                <FileIcon className={`w-3.5 h-3.5 shrink-0 ${getFileColor(file.filename)}`} />
                <span className="flex-1 text-xs truncate">{file.filename}</span>
                {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#9DA2B0] hover:text-white" onClick={(e) => { e.stopPropagation(); openRenameDialog(file.id, file.filename); }} data-testid={`button-rename-${file.id}`}><Pencil className="w-3 h-3" /></button>
                  <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#9DA2B0] hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.filename, "file"); }} data-testid={`button-delete-${file.id}`}><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {filesQuery.data?.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-[#676D7E] mb-2">No files yet</p>
                <Button size="sm" variant="ghost" className="text-xs text-[#0079F2]" onClick={() => setNewFileDialogOpen(true)}><Plus className="w-3 h-3 mr-1" /> Create File</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const editorTabBar = openTabs.length > 0 ? (
    <div className="flex items-center bg-[#0E1525] border-b border-[#2B3245] overflow-x-auto shrink-0 scrollbar-hide h-9">
      {openTabs.map((tabId) => {
        const isRunner = tabId.startsWith("runner:");
        const file = isRunner ? null : filesQuery.data?.find((f) => f.id === tabId);
        const tabName = isRunner ? tabId.slice(7).split("/").pop() || tabId : file?.filename || tabId;
        if (!isRunner && !file) return null;
        const isActive = tabId === activeFileId;
        return (
          <div key={tabId} className={`group flex items-center gap-1.5 px-3 h-full cursor-pointer shrink-0 transition-colors border-b-2 ${isActive ? "bg-[#1C2333] text-[#F5F9FC] border-b-[#0079F2]" : "text-[#676D7E] hover:text-[#9DA2B0] hover:bg-[#1C2333]/30 border-b-transparent"}`}
            onClick={() => { setActiveFileId(tabId); if (isRunner) { setActiveRunnerPath(tabId.slice(7)); } else { setActiveRunnerPath(null); if (file && fileContents[tabId] === undefined) setFileContents((prev) => ({ ...prev, [tabId]: file.content })); } }}
            data-testid={`tab-${tabId}`}
          >
            <FileIcon className={`w-3 h-3 shrink-0 ${getFileColor(tabName)}`} />
            <span className="text-[11px] max-w-[120px] truncate">{tabName}</span>
            {dirtyFiles.has(tabId) ? (
              <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            ) : (
              <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#676D7E] hover:text-[#F5F9FC] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => closeTab(tabId, e)}><X className="w-2.5 h-2.5" /></button>
            )}
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
        <div className="flex flex-col items-center justify-center h-full bg-[#1C2333]">
          <div className="max-w-sm text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#676D7E"/>
                <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#676D7E"/>
                <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#676D7E"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#F5F9FC] mb-2">{project?.name || "Untitled"}</h3>
            <p className="text-sm text-[#676D7E] mb-8 leading-relaxed">Open a file to start editing</p>
            <div className="flex flex-col gap-1 max-w-[220px] mx-auto">
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] transition-colors text-left" onClick={() => { if (isMobile) setMobileTab("files"); else { setSidebarOpen(true); setAiPanelOpen(false); } }} data-testid="button-open-explorer">
                <FolderOpen className="w-4 h-4 text-[#0079F2]" /> Explorer
                <span className="ml-auto text-[10px] text-[#676D7E] font-mono">Ctrl+B</span>
              </button>
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] transition-colors text-left" onClick={() => { if (isMobile) setMobileTab("ai"); else { setAiPanelOpen(true); setSidebarOpen(false); } }} data-testid="button-open-ai-empty">
                <Sparkles className="w-4 h-4 text-[#7C65CB]" /> AI Agent
              </button>
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] transition-colors text-left" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file-empty">
                <Plus className="w-4 h-4 text-[#0CCE6B]" /> New File
                <span className="ml-auto text-[10px] text-[#676D7E] font-mono">Ctrl+N</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const terminalContent = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
      {logs.length === 0 && !isRunning && <p className="text-[#676D7E] text-center py-4 text-xs">Press Run to execute your code</p>}
      {logs.map((log) => (
        <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#9DA2B0]"}`}>
          <span className="whitespace-pre-wrap break-all">{log.text}</span>
        </div>
      ))}
      {isRunning && <span className="animate-pulse text-[#0079F2]">_</span>}
    </div>
  );

  const previewContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#1C2333]">
      {runnerOnline === false ? (
        <div className="flex flex-col items-center justify-center h-full text-[#676D7E] gap-2">
          <WifiOff className="w-8 h-8 text-orange-400/60" />
          <p className="text-xs text-orange-400/80">Preview unavailable (runner offline)</p>
        </div>
      ) : wsStatus === "running" && livePreviewUrl ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[#2B3245] bg-[#1C2333] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[#9DA2B0] shrink-0" />
              <span className="text-[11px] text-[#9DA2B0] truncate">{livePreviewUrl}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[#9DA2B0] hover:text-white hover:bg-[#2B3245]"
                onClick={() => { const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = livePreviewUrl; }}
                title="Refresh" data-testid="button-preview-refresh"><RefreshCw className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] gap-1"
                onClick={() => window.open(livePreviewUrl, "_blank")} data-testid="button-preview-new-tab"><ExternalLink className="w-3 h-3" /> Open</Button>
            </div>
          </div>
          <iframe id="live-preview-iframe" src={livePreviewUrl} className="flex-1 w-full border-0 bg-white" title="Live Preview" data-testid="iframe-live-preview" />
        </>
      ) : previewHtml ? (
        <iframe srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts" title="Preview" />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[#676D7E] gap-3">
          <Globe className="w-10 h-10" />
          <p className="text-sm font-medium text-[#F5F9FC]">Live Preview</p>
          {wsStatus === "none" || wsStatus === "stopped" ? (
            <>
              <p className="text-xs text-center max-w-[280px]">Start your server on port <span className="text-[#0079F2] font-mono">:3000</span> in the workspace to see the preview here.</p>
              <p className="text-[10px] text-[#2B3245]">Start the workspace then run your app</p>
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
    <div className="shrink-0 flex flex-col border-t border-[#2B3245] bg-[#1C2333]" style={{ height: terminalHeight }}>
      <div className="h-[3px] cursor-ns-resize resize-handle flex items-center justify-center shrink-0 hover:bg-[#0079F2]/40 transition-colors" onMouseDown={handleDragStart} onTouchStart={handleDragStart} />
      <div className="flex items-center justify-between px-1 h-9 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
        <div className="flex items-center h-full">
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "terminal" ? "text-[#F5F9FC] border-[#0079F2]" : "text-[#676D7E] border-transparent hover:text-[#9DA2B0]"}`} onClick={() => setBottomTab("terminal")}>
            <Terminal className="w-3.5 h-3.5" /> Console {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          </button>
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${bottomTab === "shell" ? "text-[#F5F9FC] border-[#0079F2]" : "text-[#676D7E] border-transparent hover:text-[#9DA2B0]"}`} onClick={() => setBottomTab("shell")} data-testid="tab-shell">
            <Hash className="w-3.5 h-3.5" /> Shell {wsStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded" onClick={() => setLogs([])} title="Clear"><RefreshCw className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded" onClick={() => setTerminalVisible(false)} title="Close"><X className="w-3 h-3" /></Button>
        </div>
      </div>
      {bottomTab === "terminal" ? terminalContent : bottomTab === "shell" ? shellContent : terminalContent}
    </div>
  );

  const wsStatusBadge = (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      wsStatus === "running" ? "bg-green-600/20 text-green-400 border border-green-600/30" :
      wsStatus === "starting" ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30" :
      wsStatus === "stopped" ? "bg-[#2B3245] text-[#9DA2B0] border border-[#676D7E]/30" :
      wsStatus === "error" ? "bg-red-600/20 text-red-400 border border-red-600/30" :
      wsStatus === "offline" ? "bg-orange-600/20 text-orange-400 border border-orange-600/30" :
      "bg-[#2B3245] text-[#676D7E] border border-[#2B3245]"
    }`} data-testid="text-workspace-status">
      <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "running" ? "bg-green-400 animate-pulse" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "stopped" ? "bg-[#9DA2B0]" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[#676D7E]"}`} />
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
    <div className="h-screen flex flex-col bg-[#1C2333] text-sm select-none overflow-hidden">
      {/* TOP BAR */}
      <div className="grid grid-cols-3 items-center px-2 h-10 bg-[#0E1525] border-b border-[#2B3245] shrink-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <button className="w-7 h-7 rounded-lg bg-[#1C2333] border border-[#2B3245] flex items-center justify-center shrink-0 hover:border-[#F26522]/40 transition-all" onClick={() => setLocation("/dashboard")} title="Home" data-testid="button-back">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
              <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
              <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
              <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
            </svg>
          </button>
          <ChevronRight className="w-3 h-3 text-[#676D7E] shrink-0" />
          <span className="text-[13px] font-semibold text-[#F5F9FC] truncate max-w-[180px]" data-testid="text-project-name">{project?.name}</span>
          {project?.isPublished && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">Live</span>}
        </div>
        <div className="flex items-center justify-center">
          <Button
            size="sm"
            className={`h-7 px-5 text-[11px] font-semibold rounded-full gap-1.5 ${isRunning ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]" : "bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_12px_rgba(12,206,107,0.3)]"}`}
            onClick={handleRun}
            disabled={runMutation.isPending}
            data-testid="button-run"
          >
            {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isRunning ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Play className="w-3 h-3 fill-current" /> Run</>}
          </Button>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-md gap-1.5" onClick={copyShareUrl} title="Invite" data-testid="button-invite">
            <Users className="w-3.5 h-3.5" /> Invite
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-md gap-1.5" onClick={() => setPublishDialogOpen(true)} title="Publish" data-testid="button-publish">
            <Rocket className="w-3.5 h-3.5" /> Publish
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-md" data-testid="button-kebab-menu">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#1C2333] border-[#2B3245] rounded-lg">
              <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => setProjectSettingsOpen(true)}>
                <Settings className="w-3.5 h-3.5" /> Project Settings
              </DropdownMenuItem>
              {!isMobile && (
                <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => setTerminalVisible(!terminalVisible)}>
                  <Terminal className="w-3.5 h-3.5" /> Toggle Terminal
                </DropdownMenuItem>
              )}
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
              <div className="flex-1 flex flex-col overflow-hidden bg-[#1C2333]">
                <div className="flex items-center justify-between px-2 py-1 border-b border-[#2B3245] bg-[#1C2333] shrink-0">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-[#9DA2B0]" />
                    <span className="text-[11px] text-[#9DA2B0]">Console</span>
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {wsStatusBadge}
                    {workspaceButton}
                  </div>
                </div>
                {terminalContent}
                {wsStatus === "running" && (
                  <div className="border-t border-[#2B3245] shrink-0" style={{ height: "40%" }}>
                    {shellContent}
                  </div>
                )}
              </div>
            )}
            {mobileTab === "preview" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#1C2333]">
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
          <div className="flex items-center justify-around h-12 bg-[#0E1525] border-t border-[#2B3245] shrink-0 z-40" data-testid="mobile-nav-bar">
            {([
              { id: "files" as const, icon: FolderOpen, label: "Files" },
              { id: "editor" as const, icon: Code2, label: "Editor" },
              { id: "terminal" as const, icon: Terminal, label: "Terminal" },
              { id: "preview" as const, icon: Globe, label: "Preview" },
              { id: "ai" as const, icon: Sparkles, label: "AI" },
            ]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileTab === id ? (id === "ai" ? "text-[#7C65CB]" : "text-[#0079F2]") : "text-[#676D7E]"}`}
                onClick={() => setMobileTab(id)}
                data-testid={`mobile-tab-${id}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{label}</span>
                {id === "terminal" && isRunning && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#0CCE6B]" />}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* === TABLET + DESKTOP LAYOUT: VS Code style === */}
          <div className="flex flex-1 overflow-hidden">
            {/* ACTIVITY BAR */}
            <div className="w-12 bg-[#0E1525] border-r border-[#2B3245] flex flex-col items-center py-1 shrink-0" data-testid="activity-bar">
              <button
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${sidebarOpen && !aiPanelOpen && !searchPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                onClick={() => { setSidebarOpen(!sidebarOpen || aiPanelOpen || searchPanelOpen); setAiPanelOpen(false); setSearchPanelOpen(false); }}
                title="Explorer (Ctrl+B)"
                data-testid="activity-explorer"
              >
                {sidebarOpen && !aiPanelOpen && !searchPanelOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#0079F2]" />}
                <PanelLeft className="w-[18px] h-[18px]" />
              </button>
              <button
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${searchPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                onClick={() => { setSearchPanelOpen(!searchPanelOpen); if (!searchPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); } }}
                title="Search (Ctrl+Shift+F)"
                data-testid="activity-search"
              >
                {searchPanelOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#0079F2]" />}
                <Search className="w-[18px] h-[18px]" />
              </button>
              <button
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${aiPanelOpen ? "text-[#7C65CB]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                onClick={() => { setAiPanelOpen(!aiPanelOpen); if (!aiPanelOpen) { setSidebarOpen(false); setSearchPanelOpen(false); } }}
                title="AI Agent"
                data-testid="activity-ai"
              >
                {aiPanelOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#7C65CB]" />}
                <Sparkles className="w-[18px] h-[18px]" />
              </button>
              <button
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${false ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                title="Version Control"
                data-testid="activity-git"
              >
                <GitBranch className="w-[18px] h-[18px]" />
              </button>
              <button
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${previewPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                onClick={() => setPreviewPanelOpen(!previewPanelOpen)}
                title="Webview"
                data-testid="activity-webview"
              >
                {previewPanelOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#0079F2]" />}
                <Monitor className="w-[18px] h-[18px]" />
              </button>

              <div className="flex-1" />

              <div className="flex flex-col items-center mb-1">
                <button
                  className={`relative w-full h-10 flex items-center justify-center transition-colors ${projectSettingsOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                  onClick={() => setProjectSettingsOpen(true)}
                  title="Settings"
                  data-testid="activity-settings"
                >
                  {projectSettingsOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#0079F2]" />}
                  <Settings className="w-[18px] h-[18px]" />
                  <span className={`absolute bottom-1.5 right-2 w-[6px] h-[6px] rounded-full border border-[#0E1525] ${wsStatus === "running" ? "bg-[#0CCE6B]" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[#676D7E]"}`} />
                </button>
              </div>
            </div>

            {/* AI AGENT PANEL — Main panel like Replit Agent (when open) */}
            {aiPanelOpen && (
              <div className={`${isTablet ? "w-[320px]" : "w-[45%] max-w-[600px] min-w-[340px]"} shrink-0 border-r border-[#2B3245]`} data-testid="ai-agent-panel">
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

            {/* SEARCH PANEL */}
            {searchPanelOpen && !aiPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[#2B3245] bg-[#1C2333] flex flex-col`} data-testid="search-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
                  <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest">Search</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setSearchPanelOpen(false)} data-testid="button-close-search">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="px-3 py-2 border-b border-[#2B3245]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#676D7E]" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search in files..."
                      className="pl-8 bg-[#0E1525] border-[#2B3245] h-8 text-xs text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40 rounded-md"
                      autoFocus
                      data-testid="input-search-files"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {searchTerm.trim() && searchResults.length === 0 && (
                    <div className="px-3 py-6 text-center">
                      <p className="text-xs text-[#676D7E]">No results found</p>
                    </div>
                  )}
                  {searchResults.map((result, i) => (
                    <button
                      key={`${result.fileId}-${result.line}-${i}`}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#2B3245] transition-colors border-b border-[#2B3245]/50"
                      onClick={() => {
                        const file = filesQuery.data?.find((f) => f.id === result.fileId);
                        if (file) { openFile(file); }
                        setSearchPanelOpen(false);
                      }}
                      data-testid={`search-result-${i}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <FileIcon className={`w-3 h-3 shrink-0 ${getFileColor(result.filename)}`} />
                        <span className="text-[10px] font-medium text-[#F5F9FC] truncate">{result.filename}</span>
                        <span className="text-[9px] text-[#676D7E] ml-auto shrink-0">:{result.line}</span>
                      </div>
                      <p className="text-[10px] text-[#9DA2B0] truncate font-mono pl-4">{result.text}</p>
                    </button>
                  ))}
                  {!searchTerm.trim() && (
                    <div className="px-3 py-8 text-center">
                      <Search className="w-8 h-8 text-[#2B3245] mx-auto mb-3" />
                      <p className="text-xs text-[#676D7E]">Type to search across all files</p>
                      <p className="text-[10px] text-[#2B3245] mt-1">Ctrl+Shift+F</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FILE EXPLORER SIDEBAR */}
            {sidebarOpen && !aiPanelOpen && !searchPanelOpen && (
              <div className={`${isTablet ? "w-[200px]" : "w-[240px]"} shrink-0`}>
                {sidebarContent}
              </div>
            )}

            {/* MAIN EDITOR + PREVIEW AREA */}
            <div ref={editorPreviewContainerRef} className="flex-1 flex overflow-hidden min-w-0">
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {editorTabBar}
                {editorContent}
                {terminalVisible && bottomPanel}
              </div>

              {previewPanelOpen && !aiPanelOpen && (
                <>
                  <div className="w-[3px] cursor-ew-resize resize-handle flex items-center justify-center shrink-0 bg-[#2B3245] hover:bg-[#0079F2]/50 transition-colors" onMouseDown={handlePreviewDragStart} onTouchStart={handlePreviewDragStart} />
                  <div className="flex flex-col overflow-hidden bg-[#1C2333] border-l border-[#2B3245]" style={{ width: `${previewPanelWidth}%` }} data-testid="preview-panel">
                    <div className="flex items-center gap-1.5 px-2 h-9 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded shrink-0"
                        onClick={() => { const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement; if (iframe) iframe.src = iframe.src; }}
                        title="Refresh" data-testid="button-preview-panel-refresh"><RefreshCw className="w-2.5 h-2.5" /></Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-[#1C2333] border border-[#2B3245]">
                          <Globe className="w-2.5 h-2.5 text-[#676D7E] shrink-0" />
                          <span className="text-[10px] text-[#9DA2B0] truncate font-mono">{livePreviewUrl || "localhost"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {livePreviewUrl && (
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded"
                            onClick={() => window.open(livePreviewUrl, "_blank")}
                            title="Open in new tab" data-testid="button-preview-panel-newtab"><ExternalLink className="w-3 h-3" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded"
                          onClick={() => setPreviewPanelOpen(false)}
                          title="Close" data-testid="button-preview-panel-close"><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {runnerOnline === false ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#676D7E] gap-3">
                          <WifiOff className="w-8 h-8 text-[#676D7E]" />
                          <p className="text-sm text-[#9DA2B0]">Preview unavailable</p>
                          <p className="text-xs text-[#676D7E]">Runner is offline</p>
                        </div>
                      ) : wsStatus === "running" && livePreviewUrl ? (
                        <iframe id="preview-panel-iframe" src={livePreviewUrl} className="w-full h-full border-0 bg-white" title="Live Preview" data-testid="iframe-preview-panel" />
                      ) : previewHtml ? (
                        <iframe srcDoc={previewHtml} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="Preview" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#676D7E] gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center">
                            <Monitor className="w-7 h-7 text-[#676D7E]" />
                          </div>
                          <p className="text-sm font-medium text-[#F5F9FC]">Webview</p>
                          <p className="text-xs text-center max-w-[220px] text-[#676D7E] leading-relaxed">
                            {wsStatus === "running" ? "Waiting for your app to serve on a port..." : "Run your app to see the live preview here"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* STATUS BAR */}
          <div className="flex items-center justify-between px-3 h-6 bg-[#0E1525] border-t border-[#2B3245] shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-[#676D7E]">
                <span className={`w-[5px] h-[5px] rounded-full ${wsStatus === "running" ? "bg-[#0CCE6B]" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "error" ? "bg-red-400" : "bg-[#676D7E]"}`} />
                {wsStatus === "running" ? "Running" : wsStatus === "starting" ? "Starting" : wsStatus === "none" ? "Ready" : wsStatus}
              </span>
              {connected && <span className="text-[10px] text-[#676D7E]">Connected</span>}
            </div>
            <div className="flex items-center gap-4">
              {activeFileName && <span className="text-[10px] text-[#9DA2B0]">{editorLanguage}</span>}
              {activeFileName && <span className="text-[10px] text-[#676D7E]">UTF-8</span>}
              <span className="text-[10px] text-[#676D7E] flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 32 32" fill="none" className="opacity-50">
                  <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="currentColor"/>
                  <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="currentColor"/>
                  <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="currentColor"/>
                </svg>
                Replit
              </span>
            </div>
          </div>
        </>
      )}

      {/* DIALOGS */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base">New File</DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">
              {useRunnerFS
                ? <>Create a new file in <span className="text-[#F5F9FC] font-mono">{currentFsPath === "/" ? "/" : currentFsPath}</span> (Runner FS)</>
                : "Create a new file in your project"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newFileName.trim()) createFileMutation.mutate(newFileName.trim()); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#9DA2B0]">Filename</Label>
              <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder={project?.language === "python" ? "script.py" : "index.ts"} className="bg-[#0E1525] border-[#2B3245] h-9 text-sm text-[#F5F9FC] rounded-lg focus:border-[#0079F2]" autoFocus data-testid="input-new-filename" />
            </div>
            <Button type="submit" className="w-full h-9 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-lg text-xs font-medium" disabled={createFileMutation.isPending}>
              {createFileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create File"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base">Project Settings</DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">Configure your project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation.mutate({ name: projectName, language: projectLang }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#9DA2B0]">Name</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-[#0E1525] border-[#2B3245] h-9 text-sm text-[#F5F9FC] rounded-lg focus:border-[#0079F2]" data-testid="input-project-name-settings" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-[#9DA2B0]">Language</Label>
              <div className="flex gap-2">
                {["javascript", "typescript", "python"].map((lang) => (
                  <button key={lang} type="button" onClick={() => setProjectLang(lang)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${projectLang === lang ? "bg-[#0079F2] text-white" : "bg-[#0E1525] text-[#9DA2B0] hover:text-[#F5F9FC] border border-[#2B3245]"}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full h-9 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" disabled={updateProjectMutation.isPending}>
              {updateProjectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#0CCE6B]" /> Publish Project
            </DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">Make your project publicly accessible via a shareable link</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1C2333] border border-[#2B3245]">
              <div>
                <p className="text-sm font-medium text-[#F5F9FC]">{project?.name}</p>
                <p className="text-[11px] text-[#9DA2B0] mt-0.5">{project?.language} · {filesQuery.data?.length || 0} files</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#9DA2B0]">{project?.isPublished ? "Published" : "Draft"}</span>
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
                <Label className="text-[11px] text-[#9DA2B0]">Shareable URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/shared/${projectId}`}
                    className="bg-[#1C2333] border-[#2B3245] h-9 text-xs text-[#F5F9FC] rounded-lg flex-1"
                    data-testid="input-share-url"
                  />
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] shrink-0" onClick={copyShareUrl}>
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] shrink-0" onClick={() => window.open(`/shared/${projectId}`, "_blank")}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base">New Folder</DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">Create a new folder in {currentFsPath === "/" ? "root" : currentFsPath}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim()); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#9DA2B0]">Folder name</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="src" className="bg-[#0E1525] border-[#2B3245] h-9 text-sm text-[#F5F9FC] rounded-lg focus:border-[#0079F2]" autoFocus data-testid="input-new-foldername" />
            </div>
            <Button type="submit" className="w-full h-9 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-lg text-xs font-medium" disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create Folder"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base">Delete {deleteTarget?.type === "dir" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">
              Are you sure you want to delete <span className="text-[#F5F9FC] font-medium">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1 h-9 text-xs text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-lg" onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
              Cancel
            </Button>
            <Button className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs" onClick={confirmDelete} disabled={deleteRunnerEntryMutation.isPending || deleteFileMutation.isPending} data-testid="button-confirm-delete">
              {(deleteRunnerEntryMutation.isPending || deleteFileMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={(open) => { setRenameDialogOpen(open); if (!open) setRenameDialogTarget(null); }}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base">Rename</DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">
              Rename <span className="text-[#F5F9FC] font-medium">{renameDialogTarget?.oldName}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitRenameDialog(); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[#9DA2B0]">New name</Label>
              <Input
                value={renameDialogValue}
                onChange={(e) => setRenameDialogValue(e.target.value)}
                className="bg-[#0E1525] border-[#2B3245] h-9 text-sm text-[#F5F9FC] rounded-lg focus:border-[#0079F2]"
                autoFocus
                data-testid="input-rename"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 h-9 text-xs text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-lg" onClick={() => { setRenameDialogOpen(false); setRenameDialogTarget(null); }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-9 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" disabled={!renameDialogValue.trim() || renameDialogValue === renameDialogTarget?.oldName || renameFileMutation.isPending || renameRunnerEntryMutation.isPending} data-testid="button-confirm-rename">
                {(renameFileMutation.isPending || renameRunnerEntryMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : "Rename"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
