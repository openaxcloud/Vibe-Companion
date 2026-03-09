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
  Search, Hash, PanelLeft, Users, GitBranch, AlertCircle, Wand2, LogOut, Keyboard
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useProjectWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import AIPanel from "@/components/AIPanel";
import CodeEditor, { detectLanguage } from "@/components/CodeEditor";
import WorkspaceTerminal from "@/components/WorkspaceTerminal";
import CommandPalette from "@/components/CommandPalette";
import type { Project as ProjectType, File } from "@shared/schema";

function FileTypeIcon({ filename, className = "" }: { filename: string; className?: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, { bg: string; text: string; label: string }> = {
    js: { bg: "bg-yellow-500", text: "text-black", label: "JS" },
    jsx: { bg: "bg-yellow-500", text: "text-black", label: "JS" },
    ts: { bg: "bg-blue-500", text: "text-white", label: "TS" },
    tsx: { bg: "bg-blue-500", text: "text-white", label: "TS" },
    py: { bg: "bg-green-500", text: "text-white", label: "PY" },
    css: { bg: "bg-pink-500", text: "text-white", label: "CS" },
    html: { bg: "bg-orange-500", text: "text-white", label: "HT" },
    json: { bg: "bg-amber-500", text: "text-black", label: "JS" },
    md: { bg: "bg-gray-500", text: "text-white", label: "MD" },
    svg: { bg: "bg-emerald-600", text: "text-white", label: "SV" },
    png: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    jpg: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    jpeg: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    gif: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
  };
  const icon = iconMap[ext];
  if (icon) {
    return (
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0 ${icon.bg} ${className}`}>
        <span className={`text-[7px] font-bold leading-none ${icon.text}`}>{icon.label}</span>
      </span>
    );
  }
  return <FileIcon className={`w-3.5 h-3.5 shrink-0 text-[#9DA2B0] ${className}`} />;
}

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

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  fileId?: string;
  children: TreeNode[];
}

function buildFileTree(files: File[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join("/");

      if (isLast) {
        current.push({ name: part, path: pathSoFar, type: "file", fileId: file.id, children: [] });
      } else {
        let dir = current.find((n) => n.type === "dir" && n.name === part);
        if (!dir) {
          dir = { name: part, path: pathSoFar, type: "dir", children: [] };
          current.push(dir);
        }
        current = dir.children;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map((n) => ({ ...n, children: sortNodes(n.children) }));
  };

  return sortNodes(root);
}

export default function Project() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const SPECIAL_TABS = { WEBVIEW: "__webview__", SHELL: "__shell__", CONSOLE: "__console__" } as const;
  const isSpecialTab = (id: string) => id === SPECIAL_TABS.WEBVIEW || id === SPECIAL_TABS.SHELL || id === SPECIAL_TABS.CONSOLE;
  const isFileTab = (id: string) => !isSpecialTab(id);

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"terminal" | "shell">("terminal");
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(40);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileParentFolder, setNewFileParentFolder] = useState<string | null>(null);
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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const expandParentFolders = (filePath: string) => {
    const parts = filePath.split("/");
    if (parts.length > 1) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        for (let i = 1; i < parts.length; i++) {
          next.add(parts.slice(0, i).join("/"));
        }
        return next;
      });
    }
  };
  const ensureFileExplorerVisible = () => {
    setSidebarOpen(true);
    setSearchPanelOpen(false);
    setDeploymentsPanelOpen(false);
    setSettingsPanelOpen(false);
  };
  const [currentFsPath, setCurrentFsPath] = useState("/");
  const [activeRunnerPath, setActiveRunnerPath] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "terminal" | "preview" | "ai">("editor");
  const [viewMode, setViewMode] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ fileId: string; filename: string; line: number; text: string }[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [deploymentsPanelOpen, setDeploymentsPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [editorWordWrap, setEditorWordWrap] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(220);
  const dragStartX = useRef<number | null>(null);
  const dragStartW = useRef<number>(40);
  const editorPreviewContainerRef = useRef<HTMLDivElement>(null);

  const { user, logout: logoutMutation } = useAuth();
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
        const exitCode = (msg as any).exitCode ?? (msg.status === "completed" ? 0 : 1);
        setLogs((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), text: "", type: "info" },
          {
            id: Date.now() + Math.random(),
            text: msg.status === "completed"
              ? `Process exited with code ${exitCode}`
              : `Process failed with code ${exitCode}`,
            type: msg.status === "completed" ? "success" : "error",
          },
        ]);
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
    onError: (err: any, vars) => {
      toast({ title: "Failed to save file", description: err.message || "Could not save changes. Please try again.", variant: "destructive" });
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

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setTerminalVisible((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setPreviewPanelOpen((prev) => !prev);
      }
      if (e.key === "F5") {
        e.preventDefault();
        if (isRunning) { /* stop handled by run button */ } else if (!runMutation.isPending) handleRun();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning && !runMutation.isPending) handleRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFileId, fileContents, searchPanelOpen, isRunning]);

  const scrollTabIntoView = useCallback((tabId: string) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        const el = tabBarRef.current;
        if (!el) return;
        const tab = el.querySelector(`[data-testid="tab-${CSS.escape(tabId)}"]`) as HTMLElement;
        if (tab) {
          tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
      });
    }, 50);
  }, []);

  const openSpecialTab = useCallback((tabId: string) => {
    if (!openTabs.includes(tabId)) {
      setOpenTabs((prev) => [...prev, tabId]);
    }
    setActiveFileId(tabId);
    if (tabId !== SPECIAL_TABS.WEBVIEW) {
      setActiveRunnerPath(null);
    }
    scrollTabIntoView(tabId);
  }, [openTabs, scrollTabIntoView]);

  const openFile = (file: File) => {
    if (!openTabs.includes(file.id)) setOpenTabs((prev) => [...prev, file.id]);
    if (fileContents[file.id] === undefined) setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
    setActiveFileId(file.id);
    setActiveRunnerPath(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
    scrollTabIntoView(file.id);
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
    scrollTabIntoView(tabId);
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

  const closeOtherTabs = (keepTabId: string) => {
    openTabs.forEach((id) => {
      if (id !== keepTabId && dirtyFiles.has(id) && fileContents[id] !== undefined) {
        saveMutation.mutate({ fileId: id, content: fileContents[id] });
      }
    });
    setOpenTabs([keepTabId]);
    setActiveFileId(keepTabId);
    if (keepTabId.startsWith("runner:")) {
      setActiveRunnerPath(keepTabId.slice(7));
    } else {
      setActiveRunnerPath(null);
    }
  };

  const closeAllTabs = () => {
    openTabs.forEach((id) => {
      if (dirtyFiles.has(id) && fileContents[id] !== undefined) {
        saveMutation.mutate({ fileId: id, content: fileContents[id] });
      }
    });
    setOpenTabs([]);
    setActiveFileId(null);
    setActiveRunnerPath(null);
  };

  const closeTabsToRight = (tabId: string) => {
    const idx = openTabs.indexOf(tabId);
    if (idx < 0) return;
    const tabsToClose = openTabs.slice(idx + 1);
    tabsToClose.forEach((id) => {
      if (dirtyFiles.has(id) && fileContents[id] !== undefined) {
        saveMutation.mutate({ fileId: id, content: fileContents[id] });
      }
    });
    const newTabs = openTabs.slice(0, idx + 1);
    setOpenTabs(newTabs);
    if (activeFileId && !newTabs.includes(activeFileId)) {
      setActiveFileId(tabId);
      if (tabId.startsWith("runner:")) {
        setActiveRunnerPath(tabId.slice(7));
      } else {
        setActiveRunnerPath(null);
      }
    }
  };

  const copyTabPath = (tabId: string) => {
    const isRunner = tabId.startsWith("runner:");
    const file = isRunner ? null : filesQuery.data?.find((f) => f.id === tabId);
    const path = isRunner ? tabId.slice(7) : file?.filename || tabId;
    navigator.clipboard.writeText(path);
    toast({ title: "Path copied", description: path });
  };

  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [tabBarOverflow, setTabBarOverflow] = useState(false);

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const checkOverflow = () => {
      setTabBarOverflow(el.scrollWidth > el.clientWidth);
    };
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY || e.deltaX;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", handleWheel);
    };
  }, [openTabs]);

  const scrollTabBar = (direction: "left" | "right") => {
    const el = tabBarRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -120 : 120, behavior: "smooth" });
  };

  const handleTabDragStart = (e: React.DragEvent, tabId: string) => {
    setDragTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
  };

  const handleTabDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragTabId && tabId !== dragTabId) {
      setDragOverTabId(tabId);
    }
  };

  const handleTabDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    setDragOverTabId(null);
    if (!dragTabId || dragTabId === targetTabId) return;
    const fromIdx = openTabs.indexOf(dragTabId);
    const toIdx = openTabs.indexOf(targetTabId);
    if (fromIdx < 0 || toIdx < 0) return;
    const newTabs = [...openTabs];
    newTabs.splice(fromIdx, 1);
    const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    newTabs.splice(insertIdx, 0, dragTabId);
    setOpenTabs(newTabs);
    setDragTabId(null);
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
      const ext = activeFileName?.split(".").pop()?.toLowerCase();
      const langMap: Record<string, string> = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python" };
      const detectedLang = ext ? langMap[ext] : undefined;
      const res = await apiRequest("POST", `/api/projects/${projectId}/run`, {
        code,
        language: detectedLang || projectQuery.data?.language || "javascript",
      });
      return res.json();
    },
    onSuccess: () => {
      setIsRunning(true);
      openSpecialTab(SPECIAL_TABS.CONSOLE);
    },
    onError: (err: any) => {
      toast({ title: "Run failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRun = () => {
    if (isRunning) { setIsRunning(false); return; }

    const isHtmlFile = activeFileName?.endsWith(".html");
    if (isHtmlFile) {
      const html = generateHtmlPreview();
      if (html) {
        setPreviewHtml(html);
        openSpecialTab(SPECIAL_TABS.WEBVIEW);
        setLogs((prev) => [...prev, {
          id: Date.now(),
          text: `▶ Opened HTML preview for ${activeFileName}`,
          type: "success",
        }]);
        return;
      }
    }

    const timestamp = new Date().toLocaleTimeString();
    setLogs([{
      id: Date.now(),
      text: `▶ Run started at ${timestamp}`,
      type: "info",
    }]);
    openSpecialTab(SPECIAL_TABS.CONSOLE);
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
      const fullFilename = newFileParentFolder ? `${newFileParentFolder}/${filename}` : filename;
      if (useRunnerFS) {
        const basePath = newFileParentFolder || currentFsPath;
        const path = (basePath === "/" ? "/" : basePath + "/") + filename;
        await apiRequest("POST", `/api/workspaces/${projectId}/fs/write`, { path, content: "" });
        return { path, name: filename } as any;
      }
      const res = await apiRequest("POST", `/api/projects/${projectId}/files`, { filename: fullFilename, content: "" });
      return res.json();
    },
    onSuccess: (result: any) => {
      invalidateFs();
      if (useRunnerFS && result.path) {
        const entry: FsEntry = { name: result.name, path: result.path, type: "file" };
        openRunnerFile(entry);
      } else {
        const file = result as File;
        openFile(file);
        expandParentFolders(file.filename);
      }
      ensureFileExplorerVisible();
      setNewFileDialogOpen(false);
      setNewFileName("");
      setNewFileParentFolder(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create file", description: err.message || "Could not create the file. Please try again.", variant: "destructive" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const basePath = newFileParentFolder || currentFsPath;
      const path = (basePath === "/" ? "/" : basePath + "/") + folderName;
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
    onError: (err: any) => {
      toast({ title: "Failed to delete file", description: err.message || "Could not delete the file.", variant: "destructive" });
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
    onError: (err: any) => {
      toast({ title: "Failed to rename file", description: err.message || "Could not rename the file.", variant: "destructive" });
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

  const duplicateFileMutation = useMutation({
    mutationFn: async ({ fileId, filename, content }: { fileId: string; filename: string; content: string }) => {
      const ext = filename.includes(".") ? "." + filename.split(".").pop() : "";
      const base = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
      const newFilename = `${base}-copy${ext}`;
      const res = await apiRequest("POST", `/api/projects/${projectId}/files`, { filename: newFilename, content });
      return res.json();
    },
    onSuccess: (result: any) => {
      invalidateFs();
      const file = result as File;
      openFile(file);
      expandParentFolders(file.filename);
    },
    onError: (err: any) => {
      toast({ title: "Failed to duplicate file", description: err.message, variant: "destructive" });
    },
  });

  const copyPathToClipboard = (path: string) => {
    navigator.clipboard.writeText(path);
    toast({ title: "Path copied to clipboard" });
  };

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
    onError: (err: any) => {
      toast({ title: "Failed to update project", description: err.message || "Could not save project settings.", variant: "destructive" });
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
    onError: (err: any) => {
      toast({ title: "Publish failed", description: err.message || "Could not toggle publish state. Please try again.", variant: "destructive" });
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
  const activeIsSpecial = activeFileId ? isSpecialTab(activeFileId) : false;
  const isRunnerTab = !activeIsSpecial && activeFileId?.startsWith("runner:");
  const activeFile = (isRunnerTab || activeIsSpecial) ? null : filesQuery.data?.find((f) => f.id === activeFileId);
  const activeFileName = activeIsSpecial ? "" : isRunnerTab ? (activeFileId!.slice(7).split("/").pop() || "") : (activeFile?.filename || "");
  const currentCode = (activeFileId && !activeIsSpecial) ? fileContents[activeFileId] ?? "" : "";
  const editorLanguage = activeFileName ? detectLanguage(activeFileName) : "javascript";

  const generateHtmlPreview = useCallback(() => {
    const files = filesQuery.data;
    if (!files || files.length === 0) return null;

    const getContent = (fileId: string, fallback: string) => {
      return fileContents[fileId] !== undefined ? fileContents[fileId] : fallback;
    };

    const htmlFile = files.find((f) => f.filename.endsWith(".html")) ||
      files.find((f) => f.filename === "index.html");

    if (!htmlFile) return null;

    let html = getContent(htmlFile.id, htmlFile.content);

    const cssFiles = files.filter((f) => f.filename.endsWith(".css"));
    const jsFiles = files.filter((f) => f.filename.endsWith(".js") && !f.filename.endsWith(".min.js"));

    for (const cssFile of cssFiles) {
      const cssName = cssFile.filename.split("/").pop() || cssFile.filename;
      const linkRegex = new RegExp(`<link[^>]*href=["'](?:\\./)?${cssName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*/?>`, 'gi');
      const cssContent = getContent(cssFile.id, cssFile.content);
      if (linkRegex.test(html)) {
        html = html.replace(linkRegex, `<style>${cssContent}</style>`);
      } else if (!html.includes(cssContent)) {
        html = html.replace('</head>', `<style>${cssContent}</style>\n</head>`);
      }
    }

    for (const jsFile of jsFiles) {
      const jsName = jsFile.filename.split("/").pop() || jsFile.filename;
      const scriptRegex = new RegExp(`<script[^>]*src=["'](?:\\./)?${jsName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, 'gi');
      const jsContent = getContent(jsFile.id, jsFile.content);
      if (scriptRegex.test(html)) {
        html = html.replace(scriptRegex, `<script>${jsContent}<\/script>`);
      } else if (!html.includes(jsContent)) {
        html = html.replace('</body>', `<script>${jsContent}<\/script>\n</body>`);
      }
    }

    return html;
  }, [filesQuery.data, fileContents]);

  const hasHtmlFile = filesQuery.data?.some((f) => f.filename.endsWith(".html")) || false;

  useEffect(() => {
    if (!useRunnerFS && hasHtmlFile) {
      const html = generateHtmlPreview();
      setPreviewHtml(html);
    } else if (!hasHtmlFile) {
      setPreviewHtml(null);
    }
  }, [generateHtmlPreview, useRunnerFS, hasHtmlFile]);

  const handlePreview = useCallback(() => {
    const html = generateHtmlPreview();
    if (html) {
      setPreviewHtml(html);
      setPreviewPanelOpen(true);
    } else {
      toast({ title: "No HTML file found", description: "Create an HTML file to preview your project", variant: "destructive" });
    }
  }, [generateHtmlPreview, toast]);

  const getFileColor = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const c: Record<string, string> = { js: "text-yellow-400", jsx: "text-yellow-400", ts: "text-blue-400", tsx: "text-blue-400", py: "text-green-400", json: "text-orange-400", css: "text-pink-400", html: "text-red-400", md: "text-gray-400" };
    return c[ext || ""] || "text-[#9DA2B0]";
  };

  if (projectQuery.isLoading) {
    return (
      <div className="h-screen flex flex-col bg-[#1C2333] text-sm select-none overflow-hidden">
        <div className="flex items-center px-3 h-11 bg-[#0E1525] border-b border-[#2B3245] shrink-0 gap-2">
          <Skeleton className="w-7 h-7 rounded-lg bg-[#2B3245]" />
          <Skeleton className="w-3 h-3 rounded bg-[#2B3245]" />
          <Skeleton className="w-32 h-4 rounded bg-[#2B3245]" />
          <div className="flex-1" />
          <Skeleton className="w-16 h-7 rounded-full bg-[#2B3245]" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-12 bg-[#0E1525] border-r border-[#2B3245] flex flex-col items-center py-2 gap-2 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-6 h-6 rounded bg-[#2B3245]" />
            ))}
          </div>
          <div className="w-[240px] bg-[#1C2333] border-r border-[#2B3245] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245]">
              <Skeleton className="w-12 h-3 rounded bg-[#2B3245]" />
              <div className="flex gap-1">
                <Skeleton className="w-5 h-5 rounded bg-[#2B3245]" />
                <Skeleton className="w-5 h-5 rounded bg-[#2B3245]" />
              </div>
            </div>
            <div className="flex-1 py-2 px-2 space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-1 py-[5px]">
                  <Skeleton className="w-4 h-4 rounded-[3px] bg-[#2B3245]" />
                  <Skeleton className={`h-3 rounded bg-[#2B3245] ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex items-center bg-[#0E1525] border-b border-[#2B3245] h-9 px-1 gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-24 h-6 rounded bg-[#2B3245]" />
              ))}
            </div>
            <div className="flex-1 bg-[#1C2333] p-4 space-y-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={`h-3 rounded bg-[#2B3245] ${i % 4 === 0 ? "w-3/4" : i % 4 === 1 ? "w-1/2" : i % 4 === 2 ? "w-5/6" : "w-2/3"}`} />
              ))}
            </div>
            <div className="h-[220px] border-t border-[#2B3245] bg-[#1C2333] p-3 space-y-2">
              <Skeleton className="w-16 h-3 rounded bg-[#2B3245]" />
              <Skeleton className="w-full h-3 rounded bg-[#2B3245]" />
              <Skeleton className="w-3/4 h-3 rounded bg-[#2B3245]" />
            </div>
          </div>
        </div>
        <div className="flex items-center px-3 h-6 bg-[#0E1525] border-t border-[#2B3245]/60 shrink-0">
          <Skeleton className="w-16 h-2.5 rounded bg-[#2B3245]" />
        </div>
      </div>
    );
  }

  const isMobile = viewMode === "mobile";
  const isTablet = viewMode === "tablet";

  const sidebarContent = (
    <div className={`${isMobile ? "flex-1" : "h-full"} bg-[#1C2333] flex flex-col ${isMobile ? "" : "border-r border-[#2B3245]"} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#9DA2B0] uppercase tracking-wider">Files</span>
          {useRunnerFS && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 font-medium">LIVE</span>}
        </div>
        <div className="flex items-center gap-0.5">
          {useRunnerFS && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => setNewFolderDialogOpen(true)} data-testid="button-new-folder" title="New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file" title="New File">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => invalidateFs()} title="Refresh">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {useRunnerFS && currentFsPath !== "/" && (
        <button className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-[#0079F2] hover:bg-[#2B3245] border-b border-[#2B3245] shrink-0 transition-colors duration-150" onClick={() => {
          const parent = currentFsPath.substring(0, currentFsPath.lastIndexOf("/")) || "/";
          setCurrentFsPath(parent);
        }}>
          <ChevronLeft className="w-3 h-3" /> ..
        </button>
      )}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {useRunnerFS ? (
          <>
            {runnerFsQuery.data?.map((entry) => {
              const entryId = `runner:${entry.path}`;
              const isDir = entry.type === "dir";
              const runnerCtxItems = isDir ? (
                <>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setNewFileDialogOpen(true)}>
                    <Plus className="w-3 h-3" /> New File
                  </ContextMenuItem>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setNewFolderDialogOpen(true)}>
                    <FolderPlus className="w-3 h-3" /> New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openRenameDialog(entryId, entry.name)}>
                    <Pencil className="w-3 h-3" /> Rename
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </ContextMenuItem>
                </>
              ) : (
                <>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openRunnerFile(entry)}>
                    <FileCode2 className="w-3 h-3" /> Open
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openRenameDialog(entryId, entry.name)}>
                    <Pencil className="w-3 h-3" /> Rename
                  </ContextMenuItem>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => copyPathToClipboard(entry.path)}>
                    <Copy className="w-3 h-3" /> Copy Path
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </ContextMenuItem>
                </>
              );
              return (
                <ContextMenu key={entry.path}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group flex items-center gap-2 px-3 py-[5px] cursor-pointer file-tree-item ${entryId === activeFileId ? "bg-[#2B3245]/70 text-[#F5F9FC]" : "text-[#9DA2B0] hover:text-[#F5F9FC]"}`}
                      onClick={() => { isDir ? setCurrentFsPath(entry.path) : openRunnerFile(entry); if (isMobile && !isDir) setMobileTab("editor"); }}
                      data-testid={`fs-entry-${entry.name}`}
                    >
                      {isDir ? <Folder className="w-3.5 h-3.5 shrink-0 text-[#9DA2B0]" /> : <FileTypeIcon filename={entry.name} />}
                      <span className="flex-1 text-[12px] truncate">{entry.name}{isDir ? "/" : ""}</span>
                      {!isDir && dirtyFiles.has(entryId) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#676D7E] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()} data-testid={`button-more-${entry.name}`}>
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#1C2333] border-[#2B3245] rounded-lg shadow-xl min-w-[160px]" align="start">
                          {isDir ? (
                            <>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => setNewFileDialogOpen(true)}>
                                <Plus className="w-3 h-3" /> New File
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => setNewFolderDialogOpen(true)}>
                                <FolderPlus className="w-3 h-3" /> New Folder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[#2B3245]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => openRenameDialog(entryId, entry.name)}>
                                <Pencil className="w-3 h-3" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[#2B3245]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                                <Trash2 className="w-3 h-3" /> Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => openRunnerFile(entry)}>
                                <FileCode2 className="w-3 h-3" /> Open
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[#2B3245]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => openRenameDialog(entryId, entry.name)}>
                                <Pencil className="w-3 h-3" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => copyPathToClipboard(entry.path)}>
                                <Copy className="w-3 h-3" /> Copy Path
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[#2B3245]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                                <Trash2 className="w-3 h-3" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-[#1C2333] border-[#2B3245] rounded-lg shadow-xl min-w-[160px]">
                    {runnerCtxItems}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
            {runnerFsQuery.isLoading && (
              <div className="py-2 px-2 space-y-1" data-testid="skeleton-runner-files">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-1 py-[5px]">
                    <Skeleton className="w-3.5 h-3.5 rounded-[3px] bg-[#2B3245]" />
                    <Skeleton className={`h-3 rounded bg-[#2B3245] ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`} />
                  </div>
                ))}
              </div>
            )}
            {runnerFsQuery.data?.length === 0 && !runnerFsQuery.isLoading && (
              <div className="px-3 py-6 text-center animate-fade-in">
                <p className="text-xs text-[#676D7E] mb-2">Empty directory</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="ghost" className="text-xs text-[#0079F2] transition-colors duration-150" onClick={() => setNewFileDialogOpen(true)}><Plus className="w-3 h-3 mr-1" /> File</Button>
                  <Button size="sm" variant="ghost" className="text-xs text-[#0079F2] transition-colors duration-150" onClick={() => setNewFolderDialogOpen(true)}><FolderPlus className="w-3 h-3 mr-1" /> Folder</Button>
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
            {(() => {
              const tree = buildFileTree(filesQuery.data || []);
              const folderContextMenuItems = (folderPath: string) => (
                <>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => { setNewFileParentFolder(folderPath); setNewFileDialogOpen(true); }}
                    data-testid={`ctx-new-file-${folderPath}`}
                  >
                    <Plus className="w-3 h-3" /> New File
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => { setNewFileParentFolder(folderPath); setNewFolderDialogOpen(true); }}
                    data-testid={`ctx-new-folder-${folderPath}`}
                  >
                    <FolderPlus className="w-3 h-3" /> New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => copyPathToClipboard(folderPath)}
                    data-testid={`ctx-copy-path-${folderPath}`}
                  >
                    <Copy className="w-3 h-3" /> Copy Path
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => handleDelete(folderPath, folderPath.split("/").pop() || folderPath, "dir")}
                    data-testid={`ctx-delete-${folderPath}`}
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </ContextMenuItem>
                </>
              );

              const fileContextMenuItems = (file: File, nodeName: string) => (
                <>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                    data-testid={`ctx-open-${file.id}`}
                  >
                    <FileCode2 className="w-3 h-3" /> Open
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => openRenameDialog(file.id, file.filename)}
                    data-testid={`ctx-rename-${file.id}`}
                  >
                    <Pencil className="w-3 h-3" /> Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => duplicateFileMutation.mutate({ fileId: file.id, filename: file.filename, content: file.content })}
                    data-testid={`ctx-duplicate-${file.id}`}
                  >
                    <Copy className="w-3 h-3" /> Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => copyPathToClipboard(file.filename)}
                    data-testid={`ctx-copy-path-${file.id}`}
                  >
                    <Copy className="w-3 h-3" /> Copy Path
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[#2B3245]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => handleDelete(file.id, file.filename, "file")}
                    data-testid={`ctx-delete-${file.id}`}
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </ContextMenuItem>
                </>
              );

              const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
                if (node.type === "dir") {
                  const isExpanded = expandedFolders.has(node.path);
                  return (
                    <div key={node.path}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            className="group flex items-center gap-1 py-[5px] cursor-pointer file-tree-item text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245]/40"
                            style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '12px' }}
                            onClick={() => toggleFolder(node.path)}
                            data-testid={`folder-item-${node.path}`}
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-[#676D7E]" /> : <ChevronRight className="w-3 h-3 shrink-0 text-[#676D7E]" />}
                            {isExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#9DA2B0]" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[#9DA2B0]" />}
                            <span className="flex-1 text-[12px] truncate ml-0.5">{node.name}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#676D7E] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" onClick={(e) => e.stopPropagation()} data-testid={`button-more-${node.path}`}>
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-[#1C2333] border-[#2B3245] rounded-lg shadow-2xl min-w-[160px]" align="start">
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => { setNewFileParentFolder(node.path); setNewFileDialogOpen(true); }}>
                                  <Plus className="w-3 h-3" /> New File
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => { setNewFileParentFolder(node.path); setNewFolderDialogOpen(true); }}>
                                  <FolderPlus className="w-3 h-3" /> New Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[#2B3245]" />
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => copyPathToClipboard(node.path)}>
                                  <Copy className="w-3 h-3" /> Copy Path
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[#2B3245]" />
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => handleDelete(node.path, node.name, "dir")}>
                                  <Trash2 className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="bg-[#1C2333] border-[#2B3245] rounded-lg shadow-xl min-w-[160px]">
                          {folderContextMenuItems(node.path)}
                        </ContextMenuContent>
                      </ContextMenu>
                      {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                  );
                }
                const file = filesQuery.data?.find((f) => f.id === node.fileId);
                if (!file) return null;
                return (
                  <ContextMenu key={node.fileId}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`group flex items-center gap-2 py-[5px] cursor-pointer file-tree-item ${file.id === activeFileId ? "bg-[#2B3245]/70 text-[#F5F9FC]" : "text-[#9DA2B0] hover:text-[#F5F9FC]"}`}
                        style={{ paddingLeft: `${20 + depth * 12}px`, paddingRight: '12px' }}
                        onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                        data-testid={`file-item-${file.id}`}
                      >
                        <FileTypeIcon filename={node.name} />
                        <span className="flex-1 text-[12px] truncate">{node.name}</span>
                        {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 rounded hover:bg-[#2B3245] text-[#676D7E] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" onClick={(e) => e.stopPropagation()} data-testid={`button-more-${file.id}`}>
                              <MoreHorizontal className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#1C2333] border-[#2B3245] rounded-lg shadow-2xl min-w-[160px]" align="start">
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}>
                              <FileCode2 className="w-3 h-3" /> Open
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#2B3245]" />
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => openRenameDialog(file.id, file.filename)}>
                              <Pencil className="w-3 h-3" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => duplicateFileMutation.mutate({ fileId: file.id, filename: file.filename, content: file.content })}>
                              <Copy className="w-3 h-3" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => copyPathToClipboard(file.filename)}>
                              <Copy className="w-3 h-3" /> Copy Path
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#2B3245]" />
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[#2B3245] cursor-pointer rounded-md" onClick={() => handleDelete(file.id, file.filename, "file")}>
                              <Trash2 className="w-3 h-3" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-[#1C2333] border-[#2B3245] rounded-lg shadow-xl min-w-[160px]">
                      {fileContextMenuItems(file, node.name)}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              };
              return tree.map((node) => renderNode(node, 0));
            })()}
            {filesQuery.isLoading && (
              <div className="py-2 px-2 space-y-1" data-testid="skeleton-file-tree">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-1 py-[5px]">
                    <Skeleton className="w-4 h-4 rounded-[3px] bg-[#2B3245]" />
                    <Skeleton className={`h-3 rounded bg-[#2B3245] ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`} />
                  </div>
                ))}
              </div>
            )}
            {!filesQuery.isLoading && filesQuery.data?.length === 0 && (
              <div className="px-3 py-6 text-center animate-fade-in" data-testid="empty-file-tree">
                <div className="w-10 h-10 rounded-xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center mx-auto mb-3">
                  <FileIcon className="w-5 h-5 text-[#323B4F]" />
                </div>
                <p className="text-xs text-[#9DA2B0] mb-1 font-medium">No files yet</p>
                <p className="text-[10px] text-[#676D7E] mb-3">Create your first file to get started</p>
                <Button size="sm" variant="ghost" className="text-xs text-[#0079F2]" onClick={() => setNewFileDialogOpen(true)}><Plus className="w-3 h-3 mr-1" /> Create File</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const getSpecialTabInfo = (tabId: string) => {
    if (tabId === SPECIAL_TABS.WEBVIEW) return { name: "Webview", icon: <Monitor className="w-3.5 h-3.5 shrink-0 text-[#0079F2]" /> };
    if (tabId === SPECIAL_TABS.SHELL) return { name: "Shell", icon: <Hash className="w-3.5 h-3.5 shrink-0 text-[#0CCE6B]" /> };
    if (tabId === SPECIAL_TABS.CONSOLE) return { name: "Console", icon: <Terminal className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" /> };
    return null;
  };

  const editorTabBar = openTabs.length > 0 ? (
    <div className="flex items-center bg-[#0E1525] border-b border-[#2B3245] shrink-0 h-9 overflow-hidden relative">
      {tabBarOverflow && (
        <button
          className="absolute left-0 z-10 h-full px-1.5 bg-[#0E1525] border-r border-[#2B3245] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#1C2333] transition-colors duration-150"
          onClick={() => scrollTabBar("left")}
          data-testid="button-tab-scroll-left"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      )}
      <div
        ref={tabBarRef}
        className={`flex items-center h-full flex-1 min-w-0 overflow-x-auto scrollbar-hide ${tabBarOverflow ? "pl-7 pr-7" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDragLeave={() => setDragOverTabId(null)}
        onDrop={() => { setDragOverTabId(null); setDragTabId(null); }}
      >
        {openTabs.map((tabId) => {
          const specialInfo = getSpecialTabInfo(tabId);
          const isRunner = !specialInfo && tabId.startsWith("runner:");
          const file = (!specialInfo && !isRunner) ? filesQuery.data?.find((f) => f.id === tabId) : null;
          const tabName = specialInfo ? specialInfo.name : isRunner ? tabId.slice(7).split("/").pop() || tabId : file?.filename || tabId;
          if (!specialInfo && !isRunner && !file) return null;
          const isActive = tabId === activeFileId;
          const isDragOver = dragOverTabId === tabId && dragTabId !== tabId;
          return (
            <ContextMenu key={tabId}>
              <ContextMenuTrigger asChild>
                <div
                  className={`group relative flex items-center gap-1.5 px-3 h-full cursor-pointer shrink-0 border-b-2 transition-colors duration-100 select-none ${isActive ? "bg-[#1C2333] text-[#F5F9FC] border-b-[#0079F2]" : "text-[#676D7E] hover:text-[#9DA2B0] hover:bg-[#1C2333]/40 border-b-transparent"} ${dragTabId === tabId ? "opacity-40" : "opacity-100"}`}
                  onClick={() => {
                    setActiveFileId(tabId);
                    if (specialInfo) {
                      setActiveRunnerPath(null);
                    } else if (isRunner) {
                      setActiveRunnerPath(tabId.slice(7));
                    } else {
                      setActiveRunnerPath(null);
                      if (file && fileContents[tabId] === undefined) setFileContents((prev) => ({ ...prev, [tabId]: file.content }));
                    }
                  }}
                  draggable
                  onDragStart={(e) => handleTabDragStart(e, tabId)}
                  onDragOver={(e) => handleTabDragOver(e, tabId)}
                  onDrop={(e) => handleTabDrop(e, tabId)}
                  onDragEnd={() => { setDragTabId(null); setDragOverTabId(null); }}
                  data-testid={`tab-${tabId}`}
                >
                  {isDragOver && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#0079F2] rounded-full z-10" />
                  )}
                  {specialInfo ? specialInfo.icon : <FileTypeIcon filename={tabName} />}
                  <span className="text-[11px] max-w-[120px] truncate font-medium whitespace-nowrap">{tabName}</span>
                  {tabId === SPECIAL_TABS.CONSOLE && isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />
                  )}
                  {tabId === SPECIAL_TABS.SHELL && wsStatus === "running" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />
                  )}
                  {!specialInfo && dirtyFiles.has(tabId) ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-0.5" />
                  ) : (
                    <button
                      className={`p-0.5 rounded hover:bg-[#2B3245] text-[#676D7E] hover:text-[#F5F9FC] transition-opacity duration-100 shrink-0 ml-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={(e) => closeTab(tabId, e)}
                      data-testid={`button-close-tab-${tabId}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52 bg-[#1C2333] border-[#2B3245] rounded-lg shadow-2xl">
                <ContextMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => closeTab(tabId)} data-testid={`context-close-${tabId}`}>
                  <X className="w-3.5 h-3.5" /> Close
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => closeOtherTabs(tabId)} data-testid={`context-close-others-${tabId}`}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => closeAllTabs()} data-testid={`context-close-all-${tabId}`}>
                  Close All
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => closeTabsToRight(tabId)} data-testid={`context-close-right-${tabId}`}>
                  Close to the Right
                </ContextMenuItem>
                {!specialInfo && (
                  <>
                    <ContextMenuSeparator className="bg-[#2B3245]" />
                    <ContextMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => copyTabPath(tabId)} data-testid={`context-copy-path-${tabId}`}>
                      <Copy className="w-3.5 h-3.5" /> Copy Path
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      {tabBarOverflow && (
        <button
          className="absolute right-0 z-10 h-full px-1.5 bg-[#0E1525] border-l border-[#2B3245] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#1C2333] transition-colors duration-150"
          onClick={() => scrollTabBar("right")}
          data-testid="button-tab-scroll-right"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  ) : null;

  const activeFilePath = isRunnerTab
    ? activeFileId!.slice(7)
    : (activeFile?.filename || "");
  const breadcrumbSegments = activeFilePath ? activeFilePath.split("/").filter(Boolean) : [];

  const breadcrumbBar = activeFileId && breadcrumbSegments.length > 0 ? (
    <div className="flex items-center gap-0.5 px-3 h-7 bg-[#1C2333] border-b border-[#2B3245] shrink-0 overflow-x-auto scrollbar-hide" data-testid="breadcrumb-bar">
      {breadcrumbSegments.map((segment, i) => {
        const isLast = i === breadcrumbSegments.length - 1;
        return (
          <span key={i} className="flex items-center gap-0.5 shrink-0">
            {i > 0 && <ChevronRight className="w-3 h-3 text-[#676D7E] shrink-0" />}
            <span
              className={`text-[11px] px-1 py-0.5 rounded ${isLast ? "text-[#F5F9FC] font-medium" : "text-[#676D7E] hover:text-[#9DA2B0] cursor-default"}`}
              data-testid={`breadcrumb-segment-${i}`}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  ) : null;

  const webviewTabContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#1C2333] animate-fade-in">
      <div className="flex items-center gap-1 px-1.5 h-8 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded shrink-0"
          onClick={() => {
            if (wsStatus === "running" && livePreviewUrl) {
              const iframe = document.getElementById("webview-tab-iframe") as HTMLIFrameElement;
              if (iframe) iframe.src = iframe.src;
            } else {
              const html = generateHtmlPreview();
              if (html) setPreviewHtml(html);
            }
          }}
          title="Refresh" data-testid="button-webview-tab-refresh"><RefreshCw className="w-3 h-3" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[#1C2333] border border-[#2B3245]/70">
            <Globe className="w-2.5 h-2.5 text-[#4A5068] shrink-0" />
            <span className="text-[10px] text-[#9DA2B0] truncate font-mono">{livePreviewUrl || (previewHtml ? "HTML Preview" : "localhost:3000")}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {livePreviewUrl && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded"
              onClick={() => window.open(livePreviewUrl, "_blank")}
              title="Open in new tab" data-testid="button-webview-tab-newtab"><ExternalLink className="w-3 h-3" /></Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {wsStatus === "running" && livePreviewUrl ? (
          <iframe id="webview-tab-iframe" src={livePreviewUrl} className="w-full h-full border-0 bg-white" title="Live Preview" loading="lazy" data-testid="iframe-webview-tab" />
        ) : previewHtml ? (
          <iframe srcDoc={previewHtml} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-webview-tab-html" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#676D7E] gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center">
              <Monitor className="w-7 h-7 text-[#676D7E]" />
            </div>
            <p className="text-sm font-medium text-[#F5F9FC]">Webview</p>
            <p className="text-xs text-center max-w-[220px] text-[#676D7E] leading-relaxed">
              {hasHtmlFile ? "Click Refresh to render your HTML" : wsStatus === "running" ? "Waiting for your app to serve on a port..." : "Create an HTML file or run your app to see a preview"}
            </p>
            {hasHtmlFile && wsStatus !== "running" && (
              <Button size="sm" variant="ghost" className="h-7 px-4 text-[11px] text-[#0079F2] hover:text-white hover:bg-[#0079F2] border border-[#0079F2]/30 rounded-full gap-1.5 transition-all" onClick={handlePreview} data-testid="button-webview-tab-preview">
                <Eye className="w-3 h-3" /> Preview HTML
              </Button>
            )}
          </div>
        )}
      </div>
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

  const shellTabContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#1C2333] animate-fade-in">
      <div className="flex items-center justify-between px-2 h-8 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
        <div className="flex items-center gap-2">
          <Hash className="w-3 h-3 text-[#0CCE6B]" />
          <span className="text-[11px] text-[#9DA2B0] font-medium">Shell</span>
          {wsStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
        </div>
        <div className="flex items-center gap-1">
          {wsStatusBadge}
          {workspaceButton}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <WorkspaceTerminal wsUrl={terminalWsUrl} runnerOffline={runnerOnline === false} visible={activeFileId === SPECIAL_TABS.SHELL} />
      </div>
    </div>
  );

  const consoleTabContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#1C2333] animate-fade-in">
      <div className="flex items-center justify-between px-2 h-8 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-[#F5A623]" />
          <span className="text-[11px] text-[#9DA2B0] font-medium">Console</span>
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => setLogs([])} title="Clear Console" data-testid="button-console-tab-clear"><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-testid="console-tab-output">
        {logs.length === 0 && !isRunning && !runMutation.isPending && <p className="text-[#676D7E] text-center py-4 text-xs">Press Run to execute your code</p>}
        {(isRunning || runMutation.isPending) && logs.length === 0 && (
          <div className="flex items-center gap-2 py-1 text-[#0079F2] border-b border-[#2B3245]/50 mb-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[11px]">Running {activeFileName || "code"}...</span>
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#9DA2B0]"}`}>
            <span className="whitespace-pre-wrap break-all">{log.text}</span>
          </div>
        ))}
        {isRunning && logs.length > 0 && <span className="animate-pulse text-[#0079F2]">_</span>}
      </div>
    </div>
  );

  const editorContent = (
    <div className="flex-1 overflow-hidden relative flex flex-col animate-fade-in">
      {activeFileId === SPECIAL_TABS.WEBVIEW ? webviewTabContent
       : activeFileId === SPECIAL_TABS.SHELL ? shellTabContent
       : activeFileId === SPECIAL_TABS.CONSOLE ? consoleTabContent
       : (
        <>
          {breadcrumbBar}
          {activeFileId ? (
            <div className="flex-1 overflow-hidden">
              <CodeEditor value={currentCode} onChange={handleCodeChange} language={editorLanguage} onCursorChange={handleCursorChange} fontSize={editorFontSize} tabSize={editorTabSize} wordWrap={editorWordWrap} />
            </div>
          ) : (!filesQuery.data || filesQuery.data.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-full bg-[#1C2333] animate-fade-in overflow-y-auto">
          <div className="max-w-md text-center px-6 py-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#F26522]/10 to-[#F26522]/5 border border-[#F26522]/20 flex items-center justify-center mx-auto mb-6">
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none" data-testid="img-replit-logo">
                <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[#F5F9FC] mb-2" data-testid="text-welcome-heading">Welcome to your project</h3>
            <p className="text-sm text-[#676D7E] mb-8 leading-relaxed">Get started by creating your first file or asking AI for help</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <button
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-[#0E1525] border border-[#2B3245] hover:border-[#0CCE6B]/40 hover:bg-[#0CCE6B]/5 transition-all text-center group"
                onClick={() => setNewFileDialogOpen(true)}
                data-testid="button-quickstart-create-file"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0CCE6B]/10 flex items-center justify-center group-hover:bg-[#0CCE6B]/20 transition-colors">
                  <Plus className="w-5 h-5 text-[#0CCE6B]" />
                </div>
                <span className="text-xs font-medium text-[#F5F9FC]">Create a file</span>
                <span className="text-[10px] text-[#676D7E]">Start from scratch</span>
              </button>
              <button
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-[#0E1525] border border-[#2B3245] hover:border-[#7C65CB]/40 hover:bg-[#7C65CB]/5 transition-all text-center group"
                onClick={() => { if (isMobile) setMobileTab("ai"); else { setAiPanelOpen(true); setSidebarOpen(false); } }}
                data-testid="button-quickstart-ask-ai"
              >
                <div className="w-10 h-10 rounded-lg bg-[#7C65CB]/10 flex items-center justify-center group-hover:bg-[#7C65CB]/20 transition-colors">
                  <Sparkles className="w-5 h-5 text-[#7C65CB]" />
                </div>
                <span className="text-xs font-medium text-[#F5F9FC]">Ask AI</span>
                <span className="text-[10px] text-[#676D7E]">Generate code with AI</span>
              </button>
              <button
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-[#0E1525] border border-[#2B3245] hover:border-[#0079F2]/40 hover:bg-[#0079F2]/5 transition-all text-center group cursor-default opacity-60"
                onClick={() => toast({ title: "Import files", description: "File import coming soon" })}
                data-testid="button-quickstart-import"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0079F2]/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-[#0079F2]" />
                </div>
                <span className="text-xs font-medium text-[#F5F9FC]">Import files</span>
                <span className="text-[10px] text-[#676D7E]">Coming soon</span>
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 mb-8 text-[10px] text-[#676D7E] font-mono" data-testid="text-keyboard-hints">
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-[#0E1525] border border-[#2B3245] text-[#9DA2B0]">⌘K</kbd> Commands</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-[#0E1525] border border-[#2B3245] text-[#9DA2B0]">⌘B</kbd> Sidebar</span>
            </div>
            <div className="text-left bg-[#0E1525] border border-[#2B3245] rounded-xl p-4" data-testid="section-getting-started">
              <h4 className="text-[11px] font-bold text-[#9DA2B0] uppercase tracking-widest mb-3">Getting Started</h4>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span>
                  <div>
                    <p className="text-[11px] text-[#F5F9FC] font-medium">Create your first file</p>
                    <p className="text-[10px] text-[#676D7E] mt-0.5">Click "Create a file" above or use the + button in the sidebar</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0079F2]/10 text-[#0079F2] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span>
                  <div>
                    <p className="text-[11px] text-[#F5F9FC] font-medium">Write your code</p>
                    <p className="text-[10px] text-[#676D7E] mt-0.5">Use the editor with syntax highlighting and auto-save</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F26522]/10 text-[#F26522] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span>
                  <div>
                    <p className="text-[11px] text-[#F5F9FC] font-medium">Run and preview</p>
                    <p className="text-[10px] text-[#676D7E] mt-0.5">Hit the Run button or press F5 to execute your code</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-[#1C2333] animate-fade-in">
          <div className="max-w-sm text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center mx-auto mb-6">
              <FileCode2 className="w-7 h-7 text-[#676D7E]" />
            </div>
            <h3 className="text-lg font-semibold text-[#F5F9FC] mb-2" data-testid="text-open-file-heading">Open a file to start editing</h3>
            <p className="text-sm text-[#676D7E] mb-6 leading-relaxed">Select a file from the sidebar or from the list below</p>
            <div className="flex flex-col gap-0.5 max-w-[280px] mx-auto mb-6" data-testid="list-recent-files">
              {filesQuery.data?.slice(0, 8).map((file) => (
                <button
                  key={file.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[#2B3245] transition-colors group"
                  onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                  data-testid={`button-recent-file-${file.id}`}
                >
                  <FileTypeIcon filename={file.filename} />
                  <span className="text-[12px] text-[#9DA2B0] group-hover:text-[#F5F9FC] truncate flex-1">{file.filename}</span>
                  <ChevronRight className="w-3 h-3 text-[#4A5068] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1 max-w-[220px] mx-auto">
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] transition-colors text-left" onClick={() => { if (isMobile) setMobileTab("files"); else { setSidebarOpen(true); setAiPanelOpen(false); } }} data-testid="button-open-explorer">
                <FolderOpen className="w-4 h-4 text-[#0079F2]" /> Explorer
                <span className="ml-auto text-[10px] text-[#676D7E] font-mono">⌘B</span>
              </button>
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] transition-colors text-left" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file-empty">
                <Plus className="w-4 h-4 text-[#0CCE6B]" /> New File
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );

  const terminalContent = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 animate-fade-in" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-testid="terminal-output">
      {logs.length === 0 && !isRunning && !runMutation.isPending && <p className="text-[#676D7E] text-center py-4 text-xs" data-testid="text-terminal-empty">Press Run to execute your code</p>}
      {(isRunning || runMutation.isPending) && logs.length === 0 && (
        <div className="flex items-center gap-2 py-1 text-[#0079F2] border-b border-[#2B3245]/50 mb-1" data-testid="text-run-header">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[11px]">Running {activeFileName || "code"}...</span>
        </div>
      )}
      {logs.map((log) => (
        <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[#9DA2B0]"}`}>
          <span className="whitespace-pre-wrap break-all">{log.text}</span>
        </div>
      ))}
      {isRunning && logs.length > 0 && <span className="animate-pulse text-[#0079F2]">_</span>}
    </div>
  );

  const previewContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#1C2333] animate-fade-in">
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
          <iframe id="live-preview-iframe" src={livePreviewUrl} className="flex-1 w-full border-0 bg-white" title="Live Preview" loading="lazy" data-testid="iframe-live-preview" />
        </>
      ) : previewHtml ? (
        <iframe srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-html-preview-mobile" />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[#676D7E] gap-3">
          <Globe className="w-10 h-10" />
          <p className="text-sm font-medium text-[#F5F9FC]">{hasHtmlFile ? "HTML Preview" : "Live Preview"}</p>
          {hasHtmlFile && wsStatus !== "running" ? (
            <>
              <p className="text-xs text-center max-w-[280px]">Preview your HTML project directly in the browser</p>
              <Button size="sm" variant="ghost" className="h-7 px-4 text-[11px] text-[#0079F2] hover:text-white hover:bg-[#0079F2] border border-[#0079F2]/30 rounded-full gap-1.5 transition-all" onClick={handlePreview} data-testid="button-preview-mobile-start">
                <Eye className="w-3 h-3" /> Preview HTML
              </Button>
            </>
          ) : wsStatus === "none" || wsStatus === "stopped" ? (
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
    <div className="flex-1 overflow-hidden animate-fade-in">
      <WorkspaceTerminal wsUrl={terminalWsUrl} runnerOffline={runnerOnline === false} visible={true} />
    </div>
  );

  const bottomPanel = (
    <div className="flex flex-col bg-[#1C2333] h-full">
      <div className="h-1 cursor-ns-resize resize-handle flex items-center justify-center shrink-0" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
        <div className="w-8 h-[2px] rounded-full bg-[#2B3245]" />
      </div>
      <div className="flex items-center justify-between px-1 h-9 border-b border-[#2B3245] bg-[#0E1525] shrink-0">
        <div className="flex items-center h-full">
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 ${bottomTab === "terminal" ? "text-[#F5F9FC] border-[#0079F2]" : "text-[#676D7E] border-transparent hover:text-[#9DA2B0]"}`} onClick={() => setBottomTab("terminal")}>
            <Terminal className="w-3 h-3" /> Console {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          </button>
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 ${bottomTab === "shell" ? "text-[#F5F9FC] border-[#0079F2]" : "text-[#676D7E] border-transparent hover:text-[#9DA2B0]"}`} onClick={() => setBottomTab("shell")} data-testid="tab-shell">
            <Hash className="w-3 h-3" /> Shell {wsStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          </button>
        </div>
        <div className="flex items-center gap-0.5 pr-1">
          {wsStatusBadge}
          {workspaceButton}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => setLogs([])} title="Clear Console" data-testid="button-clear-console"><Trash2 className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => setTerminalVisible(false)} title="Close" data-testid="button-close-terminal"><X className="w-3 h-3" /></Button>
        </div>
      </div>
      {bottomTab === "terminal" ? terminalContent : bottomTab === "shell" ? shellContent : terminalContent}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#1C2333] text-sm select-none overflow-hidden">
      {/* TOP BAR */}
      <div className="grid grid-cols-3 items-center px-3 h-11 bg-[#0E1525] border-b border-[#2B3245] shrink-0 z-40">
        <div className="flex items-center gap-1.5 min-w-0">
          <button className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:bg-[#1C2333] transition-colors duration-150 group" onClick={() => setLocation("/dashboard")} title="Home" data-testid="button-back">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="group-hover:scale-110 transition-transform">
              <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
              <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
              <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
            </svg>
          </button>
          <ChevronRight className="w-3 h-3 text-[#323B4F] shrink-0" />
          <span className="text-[13px] font-medium text-[#F5F9FC] truncate max-w-[180px]" data-testid="text-project-name">{project?.name}</span>
          {project?.isPublished && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">Live</span>}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className={`h-7 px-5 text-[11px] font-semibold rounded-full gap-1.5 transition-all duration-150 ${isRunning ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)] btn-run-red" : "bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_12px_rgba(12,206,107,0.3)] btn-run-green"}`}
                  onClick={handleRun}
                  disabled={runMutation.isPending}
                  data-testid="button-run"
                >
                  {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isRunning ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Play className="w-3 h-3 fill-current" /> Run</>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">{isRunning ? "Stop (F5)" : "Run (F5)"}</TooltipContent>
            </Tooltip>
            {hasHtmlFile && wsStatus !== "running" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-3 text-[11px] font-medium rounded-full gap-1.5 text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] border border-[#2B3245] transition-all duration-150"
                    onClick={handlePreview}
                    data-testid="button-preview"
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Preview HTML (⌘\)</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-end gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-md gap-1.5 transition-colors duration-150" onClick={() => toast({ title: "Coming soon", description: "Invite feature coming soon" })} data-testid="button-invite">
                  <Users className="w-3.5 h-3.5" /> Invite
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Invite collaborators</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-md gap-1.5 transition-colors duration-150" onClick={() => setPublishDialogOpen(true)} data-testid="button-publish">
                  <Rocket className="w-3.5 h-3.5" /> Publish
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Publish your project</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-md transition-colors duration-150" data-testid="button-kebab-menu">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#1C2333] border-[#2B3245] rounded-lg shadow-2xl">
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
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded transition-colors duration-150" onClick={() => setLogs([])} title="Clear Console" data-testid="button-clear-console-mobile"><Trash2 className="w-3 h-3" /></Button>
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
                    expandParentFolders(file.filename);
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
            <TooltipProvider delayDuration={200}>
            <div className="w-12 bg-[#0E1525] border-r border-[#2B3245] flex flex-col items-center py-1 shrink-0" data-testid="activity-bar">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${sidebarOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => { const shouldOpen = !sidebarOpen || aiPanelOpen || searchPanelOpen || deploymentsPanelOpen || settingsPanelOpen; setSidebarOpen(shouldOpen); setAiPanelOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); }}
                    data-testid="activity-explorer"
                  >
                    {sidebarOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <PanelLeft className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Files</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${searchPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => { setSearchPanelOpen(!searchPanelOpen); if (!searchPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); } }}
                    data-testid="activity-search"
                  >
                    {searchPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Search className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Search</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${aiPanelOpen ? "text-[#7C65CB]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => { setAiPanelOpen(!aiPanelOpen); if (!aiPanelOpen) { setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); } }}
                    data-testid="activity-ai"
                  >
                    {aiPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#7C65CB]" />}
                    <Sparkles className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">AI Agent</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors text-[#676D7E] hover:text-[#F5F9FC]`}
                    data-testid="activity-git"
                  >
                    <GitBranch className="w-5 h-5" />
                    {dirtyFiles.size > 0 && <span className="absolute top-1.5 right-2 w-[7px] h-[7px] rounded-full bg-red-500 border border-[#0E1525]" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Git</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${deploymentsPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => { setDeploymentsPanelOpen(!deploymentsPanelOpen); if (!deploymentsPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setSettingsPanelOpen(false); } }}
                    data-testid="activity-deployments"
                  >
                    {deploymentsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Rocket className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Deployments</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${openTabs.includes(SPECIAL_TABS.WEBVIEW) && activeFileId === SPECIAL_TABS.WEBVIEW ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => openSpecialTab(SPECIAL_TABS.WEBVIEW)}
                    data-testid="activity-webview"
                  >
                    {openTabs.includes(SPECIAL_TABS.WEBVIEW) && activeFileId === SPECIAL_TABS.WEBVIEW && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Monitor className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Webview</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${openTabs.includes(SPECIAL_TABS.SHELL) && activeFileId === SPECIAL_TABS.SHELL ? "text-[#0CCE6B]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => openSpecialTab(SPECIAL_TABS.SHELL)}
                    data-testid="activity-shell"
                  >
                    {openTabs.includes(SPECIAL_TABS.SHELL) && activeFileId === SPECIAL_TABS.SHELL && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0CCE6B]" />}
                    <Hash className="w-5 h-5" />
                    {wsStatus === "running" && <span className="absolute top-1.5 right-2 w-[6px] h-[6px] rounded-full bg-[#0CCE6B] border border-[#0E1525]" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Shell</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${openTabs.includes(SPECIAL_TABS.CONSOLE) && activeFileId === SPECIAL_TABS.CONSOLE ? "text-[#F5A623]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => openSpecialTab(SPECIAL_TABS.CONSOLE)}
                    data-testid="activity-console"
                  >
                    {openTabs.includes(SPECIAL_TABS.CONSOLE) && activeFileId === SPECIAL_TABS.CONSOLE && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F5A623]" />}
                    <Terminal className="w-5 h-5" />
                    {isRunning && <span className="absolute top-1.5 right-2 w-[6px] h-[6px] rounded-full bg-[#0CCE6B] animate-pulse border border-[#0E1525]" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Console</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${settingsPanelOpen ? "text-[#F5F9FC]" : "text-[#676D7E] hover:text-[#F5F9FC]"}`}
                    onClick={() => { setSettingsPanelOpen(!settingsPanelOpen); if (!settingsPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); } }}
                    data-testid="activity-settings"
                  >
                    {settingsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Settings className="w-5 h-5" />
                    <span className={`absolute bottom-1.5 right-2 w-[6px] h-[6px] rounded-full border border-[#0E1525] ${wsStatus === "running" ? "bg-[#0CCE6B]" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[#676D7E]"}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1C2333] text-[#F5F9FC] border-[#2B3245] text-xs">Settings</TooltipContent>
              </Tooltip>

              <div className="flex-1" />

              <div className="flex flex-col items-center mb-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0079F2]/50 transition-all"
                      style={{ background: "linear-gradient(135deg, #F26522, #E84D8A)" }}
                      data-testid="activity-user-avatar"
                    >
                      {(() => {
                        const name = user?.displayName || user?.email || "";
                        const parts = name.split(/[\s@]+/).filter(Boolean);
                        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                        return name.slice(0, 2).toUpperCase() || "U";
                      })()}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" className="w-48 bg-[#1C2333] border-[#2B3245] rounded-lg shadow-2xl">
                    <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => setLocation("/settings")} data-testid="menu-account-settings">
                      <Settings className="w-3.5 h-3.5" /> Account Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer" onClick={() => setCommandPaletteOpen(true)} data-testid="menu-keyboard-shortcuts">
                      <Keyboard className="w-3.5 h-3.5" /> Keyboard Shortcuts
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#2B3245]" />
                    <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-[#2B3245] focus:text-red-300 cursor-pointer" onClick={() => logoutMutation.mutate()} data-testid="menu-sign-out">
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            </TooltipProvider>

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
                    expandParentFolders(file.filename);
                    ensureFileExplorerVisible();
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
                        <FileTypeIcon filename={result.filename} />
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

            {/* DEPLOYMENTS PANEL */}
            {deploymentsPanelOpen && !aiPanelOpen && !searchPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[#2B3245] bg-[#1C2333] flex flex-col`} data-testid="deployments-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
                  <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest">Deployments</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setDeploymentsPanelOpen(false)} data-testid="button-close-deployments">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="px-3 py-3 border-b border-[#2B3245]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${project?.isPublished ? "bg-[#0CCE6B]" : "bg-[#676D7E]"}`} />
                      <span className="text-xs font-medium text-[#F5F9FC]">{project?.isPublished ? "Published" : "Not published"}</span>
                    </div>
                    {project?.isPublished && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0E1525] border border-[#2B3245]">
                          <Globe className="w-3 h-3 text-[#0079F2] shrink-0" />
                          <span className="text-[10px] text-[#9DA2B0] truncate font-mono flex-1">{`${window.location.origin}/shared/${projectId}`}</span>
                          <button className="p-0.5 text-[#676D7E] hover:text-[#F5F9FC]" onClick={copyShareUrl} data-testid="button-copy-deploy-url">
                            {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button className="p-0.5 text-[#676D7E] hover:text-[#F5F9FC]" onClick={() => window.open(`/shared/${projectId}`, "_blank")} data-testid="button-open-deploy-url">
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0E1525] border border-[#2B3245]">
                      <div className="flex items-center gap-2">
                        <Rocket className="w-3.5 h-3.5 text-[#0CCE6B]" />
                        <span className="text-[11px] text-[#F5F9FC]">Publish</span>
                      </div>
                      <Switch
                        checked={project?.isPublished || false}
                        onCheckedChange={() => publishMutation.mutate()}
                        disabled={publishMutation.isPending}
                        data-testid="switch-deploy-publish"
                      />
                    </div>
                  </div>
                  <div className="px-3 py-3 border-b border-[#2B3245]">
                    <span className="text-[10px] font-bold text-[#676D7E] uppercase tracking-widest">Deployment History</span>
                    <div className="mt-2 space-y-1.5">
                      {project?.isPublished ? (
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[#0E1525] border border-[#2B3245]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-[#F5F9FC] font-medium">Production</p>
                            <p className="text-[9px] text-[#676D7E]">{new Date().toLocaleDateString()} · Live</p>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Active</span>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-[10px] text-[#676D7E]">No deployments yet</p>
                          <p className="text-[9px] text-[#4A5068] mt-1">Publish your project to create a deployment</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <span className="text-[10px] font-bold text-[#676D7E] uppercase tracking-widest">Custom Domain</span>
                    <div className="mt-2 p-3 rounded-lg bg-[#0E1525] border border-[#2B3245] border-dashed">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#676D7E]" />
                        <span className="text-[11px] text-[#9DA2B0]">Custom Domain</span>
                      </div>
                      <p className="text-[10px] text-[#4A5068] leading-relaxed">Connect a custom domain to your deployment. This feature is coming soon.</p>
                      <Button variant="ghost" size="sm" className="mt-2 h-7 px-3 text-[10px] text-[#676D7E] border border-[#2B3245] hover:text-[#9DA2B0] hover:bg-[#2B3245] rounded-md w-full" disabled data-testid="button-add-domain">
                        Add Domain
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SETTINGS PANEL */}
            {settingsPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[#2B3245] bg-[#1C2333] flex flex-col`} data-testid="settings-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
                  <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest">Settings</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]" onClick={() => setSettingsPanelOpen(false)} data-testid="button-close-settings">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="px-3 py-3 border-b border-[#2B3245]">
                    <span className="text-[10px] font-bold text-[#676D7E] uppercase tracking-widest">Theme</span>
                    <div className="mt-2 flex gap-2">
                      <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-[#0079F2]/10 border border-[#0079F2]/30 text-[11px] text-[#F5F9FC]" data-testid="button-theme-dark">
                        <span className="w-4 h-4 rounded-full bg-[#0E1525] border border-[#2B3245]" />
                        Dark
                      </button>
                      <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-[#0E1525] border border-[#2B3245] text-[11px] text-[#676D7E] opacity-50 cursor-not-allowed" disabled data-testid="button-theme-light">
                        <span className="w-4 h-4 rounded-full bg-white border border-gray-300" />
                        Light
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-3 border-b border-[#2B3245]">
                    <span className="text-[10px] font-bold text-[#676D7E] uppercase tracking-widest">Editor</span>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#9DA2B0]">Font Size</span>
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded" onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))} data-testid="button-font-size-decrease">
                            <span className="text-xs font-bold">−</span>
                          </Button>
                          <span className="text-[11px] text-[#F5F9FC] w-6 text-center font-mono" data-testid="text-font-size">{editorFontSize}</span>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded" onClick={() => setEditorFontSize(Math.min(24, editorFontSize + 1))} data-testid="button-font-size-increase">
                            <span className="text-xs font-bold">+</span>
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#9DA2B0]">Tab Size</span>
                        <div className="flex items-center gap-1">
                          {[2, 4].map((size) => (
                            <button key={size} onClick={() => setEditorTabSize(size)} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${editorTabSize === size ? "bg-[#0079F2] text-white" : "bg-[#0E1525] text-[#676D7E] hover:text-[#9DA2B0] border border-[#2B3245]"}`} data-testid={`button-tab-size-${size}`}>
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#9DA2B0]">Word Wrap</span>
                        <Switch checked={editorWordWrap} onCheckedChange={setEditorWordWrap} data-testid="switch-word-wrap" />
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-3 border-b border-[#2B3245]">
                    <span className="text-[10px] font-bold text-[#676D7E] uppercase tracking-widest">Project</span>
                    <div className="mt-2">
                      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#2B3245] transition-colors text-left" onClick={() => { setSettingsPanelOpen(false); setProjectSettingsOpen(true); }} data-testid="button-open-project-settings">
                        <Settings className="w-3.5 h-3.5 text-[#676D7E]" />
                        <span className="text-[11px] text-[#9DA2B0]">Project Settings</span>
                        <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <span className="text-[10px] font-bold text-[#676D7E] uppercase tracking-widest">About</span>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#676D7E]">Version</span>
                        <span className="text-[10px] text-[#9DA2B0] font-mono">1.0.0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#676D7E]">Runtime</span>
                        <span className="text-[10px] text-[#9DA2B0] font-mono">Node.js</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#676D7E]">Editor</span>
                        <span className="text-[10px] text-[#9DA2B0] font-mono">CodeMirror 6</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#2B3245]">
                        <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
                          <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                          <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                          <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
                        </svg>
                        <span className="text-[10px] text-[#676D7E]">Powered by Replit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FILE EXPLORER SIDEBAR */}
            <div className={`shrink-0 transition-all duration-200 overflow-hidden ${sidebarOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen ? (isTablet ? "w-[200px]" : "w-[240px]") : "w-0"}`}>
              <div className={`${isTablet ? "w-[200px]" : "w-[240px]"} h-full`}>
                {sidebarContent}
              </div>
            </div>

            {/* MAIN EDITOR AREA */}
            <div ref={editorPreviewContainerRef} className="flex-1 flex flex-col overflow-hidden min-w-0">
              {editorTabBar}
              {editorContent}
            </div>

          </div>

          {/* STATUS BAR */}
          <TooltipProvider delayDuration={200}>
          <div className="flex items-center justify-between px-2 h-6 bg-[#0E1525] border-t border-[#2B3245]/60 shrink-0">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[#9DA2B0] hover:bg-[#2B3245]/60 hover:text-[#F5F9FC] transition-colors" data-testid="button-git-branch">
                    <GitBranch className="w-3 h-3" />
                    <span className="font-medium">main</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] bg-[#1C2333] text-[#F5F9FC] border-[#2B3245]">
                  Current branch: main
                </TooltipContent>
              </Tooltip>

              <span className="w-px h-3 bg-[#2B3245]" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[#676D7E] hover:bg-[#2B3245]/60 hover:text-[#F5F9FC] transition-colors"
                    onClick={() => toast({ title: "Problems", description: "No problems detected in workspace." })}
                    data-testid="button-problems"
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>0</span>
                    <X className="w-2.5 h-2.5 ml-0.5" />
                    <span>0</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] bg-[#1C2333] text-[#F5F9FC] border-[#2B3245]">
                  No Problems
                </TooltipContent>
              </Tooltip>

              <span className="w-px h-3 bg-[#2B3245]" />

              <span className="flex items-center gap-1.5 text-[10px] text-[#676D7E]">
                <span className={`w-[5px] h-[5px] rounded-full ${wsStatus === "running" ? "bg-[#0CCE6B] shadow-[0_0_6px_rgba(12,206,107,0.6)] animate-pulse" : wsStatus === "starting" ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)] animate-pulse" : wsStatus === "error" ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)] animate-pulse" : "bg-[#4A5068]"}`} />
                {wsStatus === "running" ? "Workspace Running" : wsStatus === "starting" ? "Starting Workspace..." : wsStatus === "none" ? "Ready" : wsStatus === "stopped" ? "Workspace Stopped" : wsStatus === "error" ? "Workspace Error" : wsStatus === "offline" ? "Offline" : wsStatus}
              </span>
              {connected && <span className="text-[10px] text-[#4A5068] flex items-center gap-1"><Wifi className="w-2.5 h-2.5" /> WS</span>}
            </div>
            <div className="flex items-center gap-2">
              {activeFileName && <span className="text-[10px] text-[#9DA2B0]" data-testid="text-cursor-position">Ln {cursorLine}, Col {cursorCol}</span>}
              {activeFileName && <span className="text-[10px] text-[#9DA2B0]" data-testid="text-tab-size">Spaces: {editorTabSize}</span>}
              {activeFileName && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] text-[#9DA2B0] capitalize hover:text-[#F5F9FC] hover:bg-[#2B3245]/60 px-1.5 h-5 rounded transition-colors cursor-pointer" data-testid="button-language-selector">
                      {editorLanguage}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-40 p-1 bg-[#1C2333] border-[#2B3245] rounded-lg shadow-2xl">
                    {["javascript", "typescript", "python", "html", "css", "json", "markdown"].map((lang) => (
                      <button
                        key={lang}
                        className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded capitalize transition-colors ${lang === editorLanguage ? "bg-[#0079F2]/20 text-[#0079F2]" : "text-[#9DA2B0] hover:bg-[#2B3245] hover:text-[#F5F9FC]"}`}
                        data-testid={`lang-option-${lang}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
              {activeFileName && <span className="text-[10px] text-[#4A5068]">UTF-8</span>}
              {activeFileName && <span className="text-[10px] text-[#4A5068]">LF</span>}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[#4A5068] hover:bg-[#2B3245]/60 hover:text-[#9DA2B0] transition-colors" data-testid="button-prettier">
                    <Wand2 className="w-3 h-3" />
                    <span>Prettier</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] bg-[#1C2333] text-[#F5F9FC] border-[#2B3245]">
                  Format Document
                </TooltipContent>
              </Tooltip>

              <span className="text-[10px] text-[#4A5068] flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 32 32" fill="none">
                  <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="currentColor"/>
                  <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="currentColor"/>
                  <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="currentColor"/>
                </svg>
                Replit
              </span>
            </div>
          </div>
          </TooltipProvider>
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

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        files={filesQuery.data}
        isRunning={isRunning}
        onRun={handleRun}
        onNewFile={() => setNewFileDialogOpen(true)}
        onNewFolder={() => setNewFolderDialogOpen(true)}
        onToggleTerminal={() => setTerminalVisible((prev) => !prev)}
        onToggleAI={() => { setAiPanelOpen((prev) => !prev); if (!aiPanelOpen) { setSidebarOpen(false); setSearchPanelOpen(false); } }}
        onTogglePreview={() => setPreviewPanelOpen((prev) => !prev)}
        onToggleSidebar={() => { setSidebarOpen((prev) => !prev); setAiPanelOpen(false); setSearchPanelOpen(false); }}
        onProjectSettings={() => setProjectSettingsOpen(true)}
        onPublish={() => setPublishDialogOpen(true)}
        onGoToDashboard={() => setLocation("/dashboard")}
        onOpenFile={(file) => { openFile(file); if (isMobile) setMobileTab("editor"); }}
      />

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
