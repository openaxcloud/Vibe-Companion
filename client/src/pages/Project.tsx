/* @refresh reset */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Search, Hash, PanelLeft, Users, GitBranch, AlertCircle, Wand2, LogOut, Keyboard, GitCommitHorizontal, Key, Upload, Package,
  ArrowLeft, ArrowRight, Save, GripHorizontal, Database, FlaskConical, Shield, HardDrive, ShieldCheck, Puzzle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import PackagesPanel from "@/components/PackagesPanel";
import DatabasePanel from "@/components/DatabasePanel";
import TestRunnerPanel from "@/components/TestRunnerPanel";
import SecurityScannerPanel from "@/components/SecurityScannerPanel";
import AppStoragePanel from "@/components/AppStoragePanel";
import AuthPanel from "@/components/AuthPanel";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useProjectWebSocket } from "@/hooks/use-websocket";
import { toast } from "@/hooks/use-toast";
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
import CodeEditor, { detectLanguage, type BlameEntry } from "@/components/CodeEditor";
import WorkspaceTerminal from "@/components/WorkspaceTerminal";
import CommandPalette from "@/components/CommandPalette";
import EnvVarsPanel from "@/components/EnvVarsPanel";
import GitHubPanel from "@/components/GitHubPanel";
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
    go: { bg: "bg-cyan-500", text: "text-white", label: "GO" },
    rb: { bg: "bg-red-500", text: "text-white", label: "RB" },
    c: { bg: "bg-indigo-500", text: "text-white", label: "C" },
    h: { bg: "bg-indigo-400", text: "text-white", label: "H" },
    cpp: { bg: "bg-indigo-600", text: "text-white", label: "C+" },
    cc: { bg: "bg-indigo-600", text: "text-white", label: "C+" },
    cxx: { bg: "bg-indigo-600", text: "text-white", label: "C+" },
    hpp: { bg: "bg-indigo-400", text: "text-white", label: "H+" },
    java: { bg: "bg-red-600", text: "text-white", label: "JV" },
    rs: { bg: "bg-orange-700", text: "text-white", label: "RS" },
    sh: { bg: "bg-slate-500", text: "text-white", label: "SH" },
    bash: { bg: "bg-slate-500", text: "text-white", label: "SH" },
    svg: { bg: "bg-emerald-600", text: "text-white", label: "SV" },
    png: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    jpg: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    jpeg: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    gif: { bg: "bg-emerald-600", text: "text-white", label: "IM" },
    yaml: { bg: "bg-rose-500", text: "text-white", label: "YL" },
    yml: { bg: "bg-rose-500", text: "text-white", label: "YL" },
    toml: { bg: "bg-gray-600", text: "text-white", label: "TM" },
    xml: { bg: "bg-orange-600", text: "text-white", label: "XM" },
    sql: { bg: "bg-blue-600", text: "text-white", label: "SQ" },
    env: { bg: "bg-yellow-600", text: "text-black", label: ".E" },
    lock: { bg: "bg-gray-500", text: "text-white", label: "LK" },
    txt: { bg: "bg-gray-400", text: "text-white", label: "TX" },
    log: { bg: "bg-gray-400", text: "text-white", label: "LG" },
    dockerfile: { bg: "bg-blue-500", text: "text-white", label: "DK" },
    makefile: { bg: "bg-amber-700", text: "text-white", label: "MK" },
    scss: { bg: "bg-pink-600", text: "text-white", label: "SC" },
    less: { bg: "bg-purple-500", text: "text-white", label: "LS" },
    vue: { bg: "bg-green-600", text: "text-white", label: "VU" },
    svelte: { bg: "bg-orange-500", text: "text-white", label: "SV" },
  };
  const icon = iconMap[ext];
  if (icon) {
    return (
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0 ${icon.bg} ${className}`}>
        <span className={`text-[7px] font-bold leading-none ${icon.text}`}>{icon.label}</span>
      </span>
    );
  }
  return <FileIcon className={`w-3.5 h-3.5 shrink-0 text-[var(--ide-text-secondary)] ${className}`} />;
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

function _projectPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"terminal" | "shell" | "problems">("terminal");
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(40);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileParentFolder, setNewFileParentFolder] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
  type MobileTabType = "files" | "editor" | "terminal" | "preview" | "ai" | "search" | "git" | "deployments" | "packages" | "database" | "tests" | "security" | "storage" | "auth" | "integrations" | "settings";
  const [mobileTab, setMobileTab] = useState<MobileTabType>("ai");
  const [prevMobileTab, setPrevMobileTab] = useState<MobileTabType>("editor");
  const [mobileShellMode, setMobileShellMode] = useState<"console" | "shell">("console");
  const [viewMode, setViewMode] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [mobileToolbarHidden, setMobileToolbarHidden] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuSwipeY, setMoreMenuSwipeY] = useState(0);
  const moreMenuTouchStartY = useRef(0);
  const lastScrollY = useRef(0);
  const tabOrder = ["files", "editor", "terminal", "preview", "ai", "search", "git", "deployments", "packages", "database", "tests", "security", "storage", "auth", "integrations", "settings"] as const;
  const overflowTabs: { id: MobileTabType; icon: typeof Sparkles; label: string; color: string }[] = [
    { id: "ai", icon: Sparkles, label: "Agent", color: "#7C65CB" },
    { id: "search", icon: Search, label: "Search", color: "#0079F2" },
    { id: "git", icon: GitBranch, label: "Source Control", color: "#F26522" },
    { id: "deployments", icon: Rocket, label: "Deployments", color: "#0079F2" },
    { id: "packages", icon: Package, label: "Packages", color: "#0CCE6B" },
    { id: "database", icon: Database, label: "Database", color: "#F26522" },
    { id: "tests", icon: FlaskConical, label: "Tests", color: "#0CCE6B" },
    { id: "security", icon: Shield, label: "Security", color: "#E54D4D" },
    { id: "storage", icon: HardDrive, label: "App Storage", color: "#7C65CB" },
    { id: "auth", icon: ShieldCheck, label: "Auth", color: "#0CCE6B" },
    { id: "integrations", icon: Puzzle, label: "Integrations", color: "#0079F2" },
    { id: "settings", icon: Settings, label: "Settings", color: "#0079F2" },
  ];
  const overflowTabIds = overflowTabs.map(t => t.id);
  const isOverflowTabActive = overflowTabIds.includes(mobileTab);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [swipedFileId, setSwipedFileId] = useState<string | null>(null);
  const swipeStartX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipingFileId = useRef<string | null>(null);
  useEffect(() => { if (wsStatus !== "running") setMobileShellMode("console"); }, [wsStatus]);

  const handleMobileTabChange = useCallback((newTab: typeof mobileTab) => {
    const oldIdx = tabOrder.indexOf(mobileTab);
    const newIdx = tabOrder.indexOf(newTab);
    setSlideDirection(newIdx > oldIdx ? "right" : "left");
    setPrevMobileTab(mobileTab);
    setMobileTab(newTab);
    setTimeout(() => setSlideDirection(null), 300);
  }, [mobileTab]);

  const handleMobileScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const currentY = e.currentTarget.scrollTop;
    if (currentY > lastScrollY.current && currentY > 50) {
      setMobileToolbarHidden(true);
    } else if (currentY < lastScrollY.current) {
      setMobileToolbarHidden(false);
    }
    lastScrollY.current = currentY;
  }, []);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchResults, setSearchResults] = useState<{ fileId: string; filename: string; line: number; text: string }[]>([]);
  const [terminalTabs, setTerminalTabs] = useState<string[]>(["Terminal 1"]);
  const [activeTerminalTab, setActiveTerminalTab] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [deploymentsPanelOpen, setDeploymentsPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [envVarsPanelOpen, setEnvVarsPanelOpen] = useState(false);
  const [blameEnabled, setBlameEnabled] = useState(false);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("");
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffFile, setDiffFile] = useState<{ filename: string; oldContent?: string; newContent?: string; status: string } | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [packagesPanelOpen, setPackagesPanelOpen] = useState(false);
  const [databasePanelOpen, setDatabasePanelOpen] = useState(false);
  const [testsPanelOpen, setTestsPanelOpen] = useState(false);
  const [securityPanelOpen, setSecurityPanelOpen] = useState(false);
  const [storagePanelOpen, setStoragePanelOpen] = useState(false);
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [integrationsPanelOpen, setIntegrationsPanelOpen] = useState(false);
  const [splitEditorFileId, setSplitEditorFileId] = useState<string | null>(null);
  const [splitEditorWidth, setSplitEditorWidth] = useState(50);
  const [showMinimap, setShowMinimap] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [customDomains, setCustomDomains] = useState<any[]>([]);
  const [showDomainInput, setShowDomainInput] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const splitDragStartX = useRef<number | null>(null);
  const splitDragStartW = useRef<number>(50);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(220);
  const dragStartX = useRef<number | null>(null);
  const dragStartW = useRef<number>(40);
  const editorPreviewContainerRef = useRef<HTMLDivElement>(null);

  const { user, logout: logoutMutation } = useAuth();
  const { messages, connected, connectionQuality, retryWebSocket } = useProjectWebSocket(projectId);

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

  const gitCommitsQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "git/commits", currentBranch],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/commits?branch=${currentBranch}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: gitPanelOpen,
  });

  const gitBranchesQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "git/branches"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/branches`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: gitPanelOpen,
  });

  const gitDiffQuery = useQuery<{ branch: string; changes: any[]; hasCommits: boolean }>({
    queryKey: ["/api/projects", projectId, "git/diff", currentBranch],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/diff?branch=${currentBranch}`, { credentials: "include" });
      if (!res.ok) return { branch: currentBranch, changes: [], hasCommits: false };
      return res.json();
    },
    enabled: gitPanelOpen,
  });

  const blameFilename = useMemo(() => {
    if (!blameEnabled || !activeFileId || isSpecialTab(activeFileId)) return null;
    const f = filesQuery.data?.find((f) => f.id === activeFileId);
    return f?.filename || null;
  }, [blameEnabled, activeFileId, filesQuery.data]);

  const blameQuery = useQuery<{ filename: string; blame: BlameEntry[] }>({
    queryKey: ["/api/projects", projectId, "git/blame", blameFilename, currentBranch],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/blame/${encodeURIComponent(blameFilename!)}?branch=${currentBranch}`, { credentials: "include" });
      if (!res.ok) return { filename: blameFilename!, blame: [] };
      return res.json();
    },
    enabled: !!blameFilename,
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
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), text: "", type: "info" },
          {
            id: Date.now() + Math.random(),
            text: msg.status === "completed"
              ? `\x1b[32m✓ Process exited with code ${exitCode}\x1b[0m  (${timestamp})`
              : `\x1b[31m✗ Process failed with code ${exitCode}\x1b[0m  (${timestamp})`,
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
        setSidebarOpen(false);
      } else {
        setViewMode("desktop");
        setSidebarOpen(false);
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
      if (previewPanelOpen && previewHtml) {
        const html = generateHtmlPreviewRef.current?.();
        if (html) setPreviewHtml(html);
      }
      if (previewPanelOpen && livePreviewUrl) {
        setTimeout(() => {
          const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement || document.getElementById("webview-tab-iframe") as HTMLIFrameElement || document.getElementById("live-preview-iframe") as HTMLIFrameElement;
          if (iframe) iframe.src = iframe.src;
        }, 500);
      }
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

  const previewRefreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const generateHtmlPreviewRef = useRef<(() => string | null) | null>(null);

  const handleCodeChange = useCallback((value: string) => {
    if (!activeFileId) return;
    setFileContents((prev) => ({ ...prev, [activeFileId]: value }));
    autoSave(activeFileId, value);
    if (previewPanelOpen) {
      clearTimeout(previewRefreshTimer.current);
      previewRefreshTimer.current = setTimeout(() => {
        const html = generateHtmlPreviewRef.current?.();
        if (html) setPreviewHtml(html);
      }, 500);
    }
  }, [activeFileId, autoSave, previewPanelOpen]);

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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "G") {
        e.preventDefault();
        setGitPanelOpen((prev) => !prev);
        if (!gitPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "`")) {
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
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.getAttribute?.("contenteditable") === "true";
      if ((e.metaKey || e.ctrlKey) && e.key === "h" && !isInput) {
        e.preventDefault();
        setSearchPanelOpen(true);
        setShowReplace(true);
        if (aiPanelOpen) setAiPanelOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "w" && !isInput) {
        e.preventDefault();
        if (activeFileId && !activeFileId.startsWith("__")) {
          const idx = openTabs.indexOf(activeFileId);
          setOpenTabs(prev => prev.filter(id => id !== activeFileId));
          if (idx > 0) setActiveFileId(openTabs[idx - 1]);
          else if (openTabs.length > 1) setActiveFileId(openTabs[1]);
          else setActiveFileId(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && !isInput) {
        e.preventDefault();
        setNewFileDialogOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
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
      const code = activeFileId ? (fileContents[activeFileId] ?? "") : "";
      const ext = activeFileName?.split(".").pop()?.toLowerCase();
      const langMap: Record<string, string> = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", html: "javascript", css: "javascript" };
      const detectedLang = ext ? langMap[ext] : undefined;
      const language = detectedLang || projectQuery.data?.language || "javascript";
      const res = await apiRequest("POST", `/api/projects/${projectId}/run`, {
        code,
        language,
      });
      return res.json();
    },
    onSuccess: () => {
      setIsRunning(true);
      if (viewMode === "desktop") {
        setTerminalVisible(true);
      } else {
        openSpecialTab(SPECIAL_TABS.CONSOLE);
      }
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
        if (!isMobile) {
          setPreviewPanelOpen(true);
        } else {
          openSpecialTab(SPECIAL_TABS.WEBVIEW);
        }
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
      text: `\x1b[36m━━━ Run started at ${timestamp} ━━━\x1b[0m`,
      type: "info",
    }]);
    setTerminalVisible(true);
    setBottomTab("terminal");
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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !projectId) return;
    const formData = new FormData();
    for (let i = 0; i < Math.min(fileList.length, 5); i++) {
      formData.append("files", fileList[i]);
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        invalidateFs();
        toast({ title: `Uploaded ${data.count} file(s)` });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }, [projectId, invalidateFs, toast]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0 || !projectId) return;
    const formData = new FormData();
    for (let i = 0; i < Math.min(fileList.length, 10); i++) {
      formData.append("files", fileList[i]);
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        invalidateFs();
        toast({ title: `Uploaded ${data.count} file(s)` });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  }, [projectId, invalidateFs, toast]);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(true);
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
  }, []);

  const handleDownloadFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.split("/").pop() || filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

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

  const commitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/commits`, {
        message: commitMessage.trim(),
        branchName: currentBranch,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setCommitMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/branches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/blame"] });
      toast({ title: "Committed", description: `${data.id?.slice(0, 8)}: ${data.message}` });
    },
    onError: (err: any) => {
      toast({ title: "Commit failed", description: err.message, variant: "destructive" });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/branches`, {
        name,
        fromBranch: currentBranch,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setNewBranchName("");
      setShowBranchDialog(false);
      setCurrentBranch(data.name);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/branches"] });
      toast({ title: "Branch created", description: data.name });
    },
    onError: (err: any) => {
      toast({ title: "Branch creation failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/git/branches/${branchId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/branches"] });
      toast({ title: "Branch deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (params: { commitId?: string; branchName?: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/checkout`, params);
      return res.json();
    },
    onSuccess: (data: any) => {
      setFileContents({});
      setOpenTabs([]);
      setActiveFileId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/blame"] });
      toast({ title: "Checked out", description: `${data.filesRestored} files restored` });
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/fork`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project forked!", description: `Created "${data.name}"` });
      setLocation(`/project/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Fork failed", description: err.message, variant: "destructive" });
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
    if (projectId) {
      fetch(`/api/workspaces/${projectId}/terminal-url`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to get terminal URL");
          return r.json();
        })
        .then((d) => setTerminalWsUrl(d.wsUrl))
        .catch(() => setTerminalWsUrl(null));
    }
  }, [projectId]);

  useEffect(() => {
    if (wsStatus === "running" && projectId) {
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
    let regex: RegExp | null = null;
    try {
      if (searchRegex) {
        const pattern = searchWholeWord ? `\\b${term}\\b` : term;
        regex = new RegExp(pattern, searchCaseSensitive ? "g" : "gi");
      } else {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = searchWholeWord ? `\\b${escaped}\\b` : escaped;
        regex = new RegExp(pattern, searchCaseSensitive ? "g" : "gi");
      }
    } catch {
      setSearchResults([]);
      return;
    }
    for (const file of filesQuery.data) {
      const content = fileContents[file.id] ?? file.content;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push({ fileId: file.id, filename: file.filename, line: i + 1, text: lines[i].trim() });
          if (results.length >= 200) break;
        }
        regex.lastIndex = 0;
      }
      if (results.length >= 200) break;
    }
    setSearchResults(results);
  }, [filesQuery.data, fileContents, searchCaseSensitive, searchRegex, searchWholeWord]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm, performSearch]);

  const copyShareUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${projectId}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const loadCustomDomains = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/domains`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomDomains(data);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (deploymentsPanelOpen) loadCustomDomains();
  }, [deploymentsPanelOpen, loadCustomDomains]);

  const handleAddDomain = async () => {
    const domain = domainInput.trim();
    if (!domain) return;
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/domains`, { domain });
      const data = await res.json();
      setCustomDomains((prev: any[]) => [...prev, data.record]);
      setDomainInput("");
      setShowDomainInput(false);
      toast({ title: "Domain added", description: `Add a TXT record: ${data.record.verificationToken}` });
    } catch (err: any) {
      toast({ title: "Failed to add domain", description: err.message, variant: "destructive" });
    }
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

  useEffect(() => { generateHtmlPreviewRef.current = generateHtmlPreview; }, [generateHtmlPreview]);

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
    return c[ext || ""] || "text-[var(--ide-text-secondary)]";
  };

  const parseAnsi = useCallback((text: string) => {
    const parts: { text: string; color?: string }[] = [];
    const regex = /\x1b\[([\d;]+)m/g;
    let lastIndex = 0;
    let currentColor: string | undefined;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), color: currentColor });
      }
      const colorMap: Record<number, string | undefined> = {
        0: undefined, 31: "#EF4444", 32: "#22C55E", 33: "#EAB308", 34: "#3B82F6",
        35: "#A855F7", 36: "#06B6D4", 37: "#D1D5DB", 39: undefined,
        90: "#6B7280", 91: "#F87171", 92: "#4ADE80", 93: "#FACC15", 94: "#60A5FA",
        95: "#C084FC", 96: "#22D3EE", 97: "#F3F4F6",
      };
      const codes = match[1].split(";").map(Number);
      for (const code of codes) {
        if (code in colorMap) currentColor = colorMap[code];
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), color: currentColor });
    }
    if (parts.length === 0) return <span>{text}</span>;
    return <>{parts.map((p, i) => <span key={i} style={p.color ? { color: p.color } : undefined}>{p.text}</span>)}</>;
  }, []);

  if (projectQuery.isLoading) {
    return (
      <div className="h-screen flex flex-col bg-[var(--ide-panel)] text-sm select-none overflow-hidden">
        <div className="flex items-center px-3 h-11 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 gap-2">
          <Skeleton className="w-7 h-7 rounded-lg bg-[var(--ide-surface)]" />
          <Skeleton className="w-3 h-3 rounded bg-[var(--ide-surface)]" />
          <Skeleton className="w-32 h-4 rounded bg-[var(--ide-surface)]" />
          <div className="flex-1" />
          <Skeleton className="w-16 h-7 rounded-full bg-[var(--ide-surface)]" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-12 bg-[var(--ide-bg)] border-r border-[var(--ide-border)] flex flex-col items-center py-2 gap-2 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-6 h-6 rounded bg-[var(--ide-surface)]" />
            ))}
          </div>
          <div className="w-[240px] bg-[var(--ide-panel)] border-r border-[var(--ide-border)] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)]">
              <Skeleton className="w-12 h-3 rounded bg-[var(--ide-surface)]" />
              <div className="flex gap-1">
                <Skeleton className="w-5 h-5 rounded bg-[var(--ide-surface)]" />
                <Skeleton className="w-5 h-5 rounded bg-[var(--ide-surface)]" />
              </div>
            </div>
            <div className="flex-1 py-2 px-2 space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-1 py-[5px]">
                  <Skeleton className="w-4 h-4 rounded-[3px] bg-[var(--ide-surface)]" />
                  <Skeleton className={`h-3 rounded bg-[var(--ide-surface)] ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex items-center bg-[var(--ide-bg)] border-b border-[var(--ide-border)] h-9 px-1 gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-24 h-6 rounded bg-[var(--ide-surface)]" />
              ))}
            </div>
            <div className="flex-1 bg-[var(--ide-panel)] p-4 space-y-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={`h-3 rounded bg-[var(--ide-surface)] ${i % 4 === 0 ? "w-3/4" : i % 4 === 1 ? "w-1/2" : i % 4 === 2 ? "w-5/6" : "w-2/3"}`} />
              ))}
            </div>
            <div className="h-[220px] border-t border-[var(--ide-border)] bg-[var(--ide-panel)] p-3 space-y-2">
              <Skeleton className="w-16 h-3 rounded bg-[var(--ide-surface)]" />
              <Skeleton className="w-full h-3 rounded bg-[var(--ide-surface)]" />
              <Skeleton className="w-3/4 h-3 rounded bg-[var(--ide-surface)]" />
            </div>
          </div>
        </div>
        <div className="flex items-center px-3 h-6 bg-[var(--ide-bg)] border-t border-[var(--ide-border)]/60 shrink-0">
          <Skeleton className="w-16 h-2.5 rounded bg-[var(--ide-surface)]" />
        </div>
      </div>
    );
  }

  const isMobile = viewMode === "mobile";
  const isTablet = viewMode === "tablet";

  const sidebarContent = (
    <div className={`${isMobile ? "flex-1 bg-[var(--ide-panel)]" : "h-full bg-[var(--ide-panel)]"} flex flex-col ${isMobile ? "" : "border-r border-[var(--ide-border)]"} overflow-hidden`}>
      <div className={`flex items-center justify-between px-3 h-9 shrink-0 ${"border-b border-[var(--ide-border)]"}`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${"text-[var(--ide-text-secondary)]"}`}>Files</span>
          {useRunnerFS && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 font-medium">LIVE</span>}
        </div>
        <div className="flex items-center gap-0.5">
          {useRunnerFS && (
            <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors duration-150 ${"text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => setNewFolderDialogOpen(true)} data-testid="button-new-folder" title="New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors duration-150 ${"text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file" title="New File">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors duration-150 ${"text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => uploadInputRef.current?.click()} data-testid="button-upload-file" title="Upload File">
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="*/*" />
          <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors duration-150 ${"text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => invalidateFs()} title="Refresh">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {useRunnerFS && currentFsPath !== "/" && (
        <button className={`flex items-center gap-1.5 px-3 py-1 text-[11px] text-[#0079F2] shrink-0 transition-colors duration-150 ${"hover:bg-[var(--ide-surface)] border-b border-[var(--ide-border)]"}`} onClick={() => {
          const parent = currentFsPath.substring(0, currentFsPath.lastIndexOf("/")) || "/";
          setCurrentFsPath(parent);
        }}>
          <ChevronLeft className="w-3 h-3" /> ..
        </button>
      )}
      <div className={`flex-1 overflow-y-auto scrollbar-thin py-1 relative transition-colors ${fileDragOver ? "bg-[#0079F2]/10 ring-2 ring-inset ring-[#0079F2]/40" : ""}`}
        onDrop={handleFileDrop}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
      >
        {fileDragOver && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-[#0079F2]">
              <Upload className="w-8 h-8" />
              <span className="text-xs font-medium">Drop files here</span>
            </div>
          </div>
        )}
        {useRunnerFS ? (
          <>
            {runnerFsQuery.data?.map((entry) => {
              const entryId = `runner:${entry.path}`;
              const isDir = entry.type === "dir";
              const runnerCtxItems = isDir ? (
                <>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setNewFileDialogOpen(true)}>
                    <Plus className="w-3 h-3" /> New File
                  </ContextMenuItem>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => setNewFolderDialogOpen(true)}>
                    <FolderPlus className="w-3 h-3" /> New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openRenameDialog(entryId, entry.name)}>
                    <Pencil className="w-3 h-3" /> Rename
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </ContextMenuItem>
                </>
              ) : (
                <>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openRunnerFile(entry)}>
                    <FileCode2 className="w-3 h-3" /> Open
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openRenameDialog(entryId, entry.name)}>
                    <Pencil className="w-3 h-3" /> Rename
                  </ContextMenuItem>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => { const tabId = `runner:${entry.path}`; const content = fileContents[tabId]; if (content !== undefined) handleDownloadFile(entry.name, content); else toast({ title: "Open the file first to download" }); }}>
                    <Save className="w-3 h-3" /> Download
                  </ContextMenuItem>
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => copyPathToClipboard(entry.path)}>
                    <Copy className="w-3 h-3" /> Copy Path
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </ContextMenuItem>
                </>
              );
              return (
                <ContextMenu key={entry.path}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group flex items-center gap-2 px-3 ${isMobile ? "py-2.5" : "py-[5px]"} cursor-pointer file-tree-item ${entryId === activeFileId ? ("bg-[var(--ide-surface)]/70 text-[var(--ide-text)]") : ("text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]")} relative overflow-hidden`}
                      onClick={() => { if (swipedFileId === entryId) { setSwipedFileId(null); return; } isDir ? setCurrentFsPath(entry.path) : openRunnerFile(entry); if (isMobile && !isDir) setMobileTab("editor"); }}
                      onTouchStart={(e) => { if (isMobile) { swipeStartX.current = e.touches[0].clientX; swipingFileId.current = entryId; setSwipeOffset(0); } }}
                      onTouchMove={(e) => { if (isMobile && swipeStartX.current > 0 && swipingFileId.current === entryId) { const diff = swipeStartX.current - e.touches[0].clientX; if (diff > 10) setSwipeOffset(Math.min(diff, 120)); else if (diff < -10) { setSwipedFileId(null); setSwipeOffset(0); } } }}
                      onTouchEnd={() => { if (isMobile && swipingFileId.current === entryId) { if (swipeOffset > 60) { setSwipedFileId(entryId); } else { setSwipedFileId(null); } setSwipeOffset(0); swipeStartX.current = 0; swipingFileId.current = null; } }}
                      data-testid={`fs-entry-${entry.name}`}
                    >
                      <div className={`flex items-center gap-2 flex-1 min-w-0 transition-transform duration-200 ${swipedFileId === entryId ? "-translate-x-[120px]" : ""}`} style={swipeOffset > 0 && swipingFileId.current === entryId && swipedFileId !== entryId ? { transform: `translateX(-${swipeOffset}px)` } : undefined}>
                        {isDir ? <Folder className="w-3.5 h-3.5 shrink-0 text-[var(--ide-text-secondary)]" /> : <FileTypeIcon filename={entry.name} />}
                        <span className="flex-1 text-[12px] truncate">{entry.name}{isDir ? "/" : ""}</span>
                        {!isDir && dirtyFiles.has(entryId) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                      </div>
                      {isMobile && swipedFileId === entryId && (
                        <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
                          <button className="w-[60px] bg-[#0079F2] text-white flex items-center justify-center text-[10px] font-medium" onClick={(e) => { e.stopPropagation(); openRenameDialog(entryId, entry.name); setSwipedFileId(null); }} data-testid={`swipe-rename-${entry.name}`}><Pencil className="w-3 h-3" /></button>
                          <button className="w-[60px] bg-red-500 text-white flex items-center justify-center text-[10px] font-medium" onClick={(e) => { e.stopPropagation(); handleDelete(entry.path, entry.name, entry.type); setSwipedFileId(null); }} data-testid={`swipe-delete-${entry.name}`}><Trash2 className="w-3 h-3" /></button>
                        </div>
                      )}
                      {!isMobile && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()} data-testid={`button-more-${entry.name}`}>
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]" align="start">
                          {isDir ? (
                            <>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => setNewFileDialogOpen(true)}>
                                <Plus className="w-3 h-3" /> New File
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => setNewFolderDialogOpen(true)}>
                                <FolderPlus className="w-3 h-3" /> New Folder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => openRenameDialog(entryId, entry.name)}>
                                <Pencil className="w-3 h-3" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                                <Trash2 className="w-3 h-3" /> Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => openRunnerFile(entry)}>
                                <FileCode2 className="w-3 h-3" /> Open
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => openRenameDialog(entryId, entry.name)}>
                                <Pencil className="w-3 h-3" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => copyPathToClipboard(entry.path)}>
                                <Copy className="w-3 h-3" /> Copy Path
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                              <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => handleDelete(entry.path, entry.name, entry.type)}>
                                <Trash2 className="w-3 h-3" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]">
                    {runnerCtxItems}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
            {runnerFsQuery.isLoading && (
              <div className="py-2 px-2 space-y-1" data-testid="skeleton-runner-files">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-1 py-[5px]">
                    <Skeleton className="w-3.5 h-3.5 rounded-[3px] bg-[var(--ide-surface)]" />
                    <Skeleton className={`h-3 rounded bg-[var(--ide-surface)] ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`} />
                  </div>
                ))}
              </div>
            )}
            {runnerFsQuery.data?.length === 0 && !runnerFsQuery.isLoading && (
              <div className="px-3 py-6 text-center animate-fade-in">
                <p className="text-xs text-[var(--ide-text-muted)] mb-2">Empty directory</p>
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
              <div className="px-2 py-2 border-b border-[var(--ide-border)]">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--ide-panel)] border border-[var(--ide-border)]">
                  <Server className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                  <span className="text-[10px] text-[var(--ide-text-secondary)] flex-1">{wsStatus === "offline" ? "Runner offline" : "Start workspace"}</span>
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
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => { setNewFileParentFolder(folderPath); setNewFileDialogOpen(true); }}
                    data-testid={`ctx-new-file-${folderPath}`}
                  >
                    <Plus className="w-3 h-3" /> New File
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => { setNewFileParentFolder(folderPath); setNewFolderDialogOpen(true); }}
                    data-testid={`ctx-new-folder-${folderPath}`}
                  >
                    <FolderPlus className="w-3 h-3" /> New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => copyPathToClipboard(folderPath)}
                    data-testid={`ctx-copy-path-${folderPath}`}
                  >
                    <Copy className="w-3 h-3" /> Copy Path
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
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
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                    data-testid={`ctx-open-${file.id}`}
                  >
                    <FileCode2 className="w-3 h-3" /> Open
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => openRenameDialog(file.id, file.filename)}
                    data-testid={`ctx-rename-${file.id}`}
                  >
                    <Pencil className="w-3 h-3" /> Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => duplicateFileMutation.mutate({ fileId: file.id, filename: file.filename, content: file.content })}
                    data-testid={`ctx-duplicate-${file.id}`}
                  >
                    <Copy className="w-3 h-3" /> Duplicate
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => handleDownloadFile(file.filename, fileContents[file.id] ?? file.content)}
                    data-testid={`ctx-download-${file.id}`}
                  >
                    <Save className="w-3 h-3" /> Download
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => copyPathToClipboard(file.filename)}
                    data-testid={`ctx-copy-path-${file.id}`}
                  >
                    <Copy className="w-3 h-3" /> Copy Path
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
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
                            className={`group flex items-center gap-1 ${isMobile ? "py-2.5" : "py-[5px]"} cursor-pointer file-tree-item ${"text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/40"}`}
                            style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '12px' }}
                            onClick={() => toggleFolder(node.path)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-[#0079F2]/20"); }}
                            onDragLeave={(e) => { e.currentTarget.classList.remove("bg-[#0079F2]/20"); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("bg-[#0079F2]/20");
                              try {
                                const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                                if (data.fileId && data.filename) {
                                  const baseName = data.filename.split("/").pop() || data.filename;
                                  const newFilename = node.path === "/" ? baseName : `${node.path}/${baseName}`;
                                  if (newFilename !== data.filename) {
                                    renameFileMutation.mutate({ fileId: data.fileId, filename: newFilename });
                                  }
                                }
                              } catch {}
                            }}
                            data-testid={`folder-item-${node.path}`}
                          >
                            {isExpanded ? <ChevronDown className={`w-3 h-3 shrink-0 ${isMobile ? "text-[#9CA3AF]" : "text-[var(--ide-text-muted)]"}`} /> : <ChevronRight className={`w-3 h-3 shrink-0 ${isMobile ? "text-[#9CA3AF]" : "text-[var(--ide-text-muted)]"}`} />}
                            {isExpanded ? <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${"text-[var(--ide-text-secondary)]"}`} /> : <Folder className={`w-3.5 h-3.5 shrink-0 ${"text-[var(--ide-text-secondary)]"}`} />}
                            <span className="flex-1 text-[12px] truncate ml-0.5">{node.name}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" onClick={(e) => e.stopPropagation()} data-testid={`button-more-${node.path}`}>
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl min-w-[160px]" align="start">
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => { setNewFileParentFolder(node.path); setNewFileDialogOpen(true); }}>
                                  <Plus className="w-3 h-3" /> New File
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => { setNewFileParentFolder(node.path); setNewFolderDialogOpen(true); }}>
                                  <FolderPlus className="w-3 h-3" /> New Folder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => copyPathToClipboard(node.path)}>
                                  <Copy className="w-3 h-3" /> Copy Path
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                                <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => handleDelete(node.path, node.name, "dir")}>
                                  <Trash2 className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]">
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
                        className={`group flex items-center gap-2 ${isMobile ? "py-2.5" : "py-[5px]"} cursor-pointer file-tree-item ${file.id === activeFileId ? ("bg-[var(--ide-surface)]/70 text-[var(--ide-text)]") : ("text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]")}`}
                        style={{ paddingLeft: `${20 + depth * 12}px`, paddingRight: '12px' }}
                        onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ fileId: file.id, filename: file.filename })); e.dataTransfer.effectAllowed = "move"; }}
                        data-testid={`file-item-${file.id}`}
                      >
                        <FileTypeIcon filename={node.name} />
                        <span className="flex-1 text-[12px] truncate">{node.name}</span>
                        {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" onClick={(e) => e.stopPropagation()} data-testid={`button-more-${file.id}`}>
                              <MoreHorizontal className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl min-w-[160px]" align="start">
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}>
                              <FileCode2 className="w-3 h-3" /> Open
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => openRenameDialog(file.id, file.filename)}>
                              <Pencil className="w-3 h-3" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => duplicateFileMutation.mutate({ fileId: file.id, filename: file.filename, content: file.content })}>
                              <Copy className="w-3 h-3" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => copyPathToClipboard(file.filename)}>
                              <Copy className="w-3 h-3" /> Copy Path
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => handleDelete(file.id, file.filename, "file")}>
                              <Trash2 className="w-3 h-3" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]">
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
                    <Skeleton className="w-4 h-4 rounded-[3px] bg-[var(--ide-surface)]" />
                    <Skeleton className={`h-3 rounded bg-[var(--ide-surface)] ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-20" : "w-16"}`} />
                  </div>
                ))}
              </div>
            )}
            {!filesQuery.isLoading && filesQuery.data?.length === 0 && (
              <div className="px-3 py-6 text-center animate-fade-in" data-testid="empty-file-tree">
                <div className="w-10 h-10 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-3">
                  <FileIcon className="w-5 h-5 text-[var(--ide-text-muted)]" />
                </div>
                <p className="text-xs text-[var(--ide-text-secondary)] mb-1 font-medium">No files yet</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mb-3">Create your first file to get started</p>
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
    <div className={`flex items-center shrink-0 h-9 overflow-hidden relative ${"bg-[var(--ide-bg)] border-b border-[var(--ide-border)]"}`}>
      {tabBarOverflow && !isMobile && (
        <button
          className="absolute left-0 z-10 h-full px-1.5 bg-[var(--ide-bg)] border-r border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors duration-150"
          onClick={() => scrollTabBar("left")}
          data-testid="button-tab-scroll-left"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      )}
      <div
        ref={tabBarRef}
        className={`flex items-center h-full flex-1 min-w-0 overflow-x-auto scrollbar-hide ${tabBarOverflow && !isMobile ? "pl-7 pr-7" : ""}`}
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
                  className={`group relative flex items-center gap-1.5 ${isMobile ? "px-2.5" : "px-3"} h-full cursor-pointer shrink-0 border-b-2 transition-colors duration-100 select-none ${isActive ? ("bg-[var(--ide-panel)] text-[var(--ide-text)] border-b-[#0079F2]") : (isMobile ? "text-[#9CA3AF] hover:text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)] border-b-transparent" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/40 border-b-transparent")} ${dragTabId === tabId ? "opacity-40" : "opacity-100"}`}
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
                  draggable={!isMobile}
                  onDragStart={(e) => !isMobile && handleTabDragStart(e, tabId)}
                  onDragOver={(e) => !isMobile && handleTabDragOver(e, tabId)}
                  onDrop={(e) => !isMobile && handleTabDrop(e, tabId)}
                  onDragEnd={() => { setDragTabId(null); setDragOverTabId(null); }}
                  data-testid={`tab-${tabId}`}
                >
                  {isDragOver && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#0079F2] rounded-full z-10" />
                  )}
                  {specialInfo ? specialInfo.icon : <FileTypeIcon filename={tabName} />}
                  <span className={`${isMobile ? "text-[12px] max-w-[100px]" : "text-[11px] max-w-[120px]"} truncate font-medium whitespace-nowrap`}>{tabName}</span>
                  {tabId === SPECIAL_TABS.CONSOLE && isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />
                  )}
                  {tabId === SPECIAL_TABS.SHELL && wsStatus === "running" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />
                  )}
                  {!specialInfo && dirtyFiles.has(tabId) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-0.5" />
                  )}
                  {(isMobile || !(!specialInfo && dirtyFiles.has(tabId))) && (
                    <button
                      className={`${isMobile ? "p-1" : "p-0.5"} rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-opacity duration-100 shrink-0 ${!specialInfo && dirtyFiles.has(tabId) ? "" : "ml-0.5"} ${isMobile ? "opacity-100" : isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={(e) => closeTab(tabId, e)}
                      data-testid={`button-close-tab-${tabId}`}
                    >
                      <X className={`${isMobile ? "w-3 h-3" : "w-2.5 h-2.5"}`} />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl">
                <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => closeTab(tabId)} data-testid={`context-close-${tabId}`}>
                  <X className="w-3.5 h-3.5" /> Close
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => closeOtherTabs(tabId)} data-testid={`context-close-others-${tabId}`}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => {
                  const remaining = openTabs.filter(id => isSpecialTab(id) || dirtyFiles.has(id));
                  setOpenTabs(remaining);
                  if (activeFileId && !remaining.includes(activeFileId)) {
                    const next = remaining.length > 0 ? remaining[0] : null;
                    setActiveFileId(next);
                    setActiveRunnerPath(next && next.startsWith("runner:") ? next.slice(7) : null);
                  }
                }} data-testid={`context-close-saved-${tabId}`}>
                  Close Saved
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => closeAllTabs()} data-testid={`context-close-all-${tabId}`}>
                  Close All
                </ContextMenuItem>
                <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => closeTabsToRight(tabId)} data-testid={`context-close-right-${tabId}`}>
                  Close to the Right
                </ContextMenuItem>
                {!specialInfo && !tabId.startsWith("runner:") && (
                  <>
                    <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                    <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setSplitEditorFileId(tabId)} data-testid={`context-split-${tabId}`}>
                      <Code2 className="w-3.5 h-3.5" /> Split Right
                    </ContextMenuItem>
                    <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => copyTabPath(tabId)} data-testid={`context-copy-path-${tabId}`}>
                      <Copy className="w-3.5 h-3.5" /> Copy Path
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      {isMobile && (
        <button
          className="h-full px-2.5 border-l border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors duration-150 shrink-0"
          onClick={() => setNewFileDialogOpen(true)}
          data-testid="button-mobile-new-tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
      {tabBarOverflow && !isMobile && (
        <button
          className="absolute right-0 z-10 h-full px-1.5 bg-[var(--ide-bg)] border-l border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors duration-150"
          onClick={() => scrollTabBar("right")}
          data-testid="button-tab-scroll-right"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  ) : isMobile ? (
    <div className="flex items-center bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 h-9 overflow-hidden">
      <div className="flex items-center gap-2 px-3 flex-1 text-[var(--ide-text-muted)]">
        <Code2 className="w-3.5 h-3.5" />
        <span className="text-[11px]">No files open</span>
      </div>
      <button
        className="h-full px-2.5 border-l border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors duration-150 shrink-0"
        onClick={() => setNewFileDialogOpen(true)}
        data-testid="button-mobile-new-tab-empty"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  const activeFilePath = isRunnerTab
    ? activeFileId!.slice(7)
    : (activeFile?.filename || "");
  const breadcrumbSegments = activeFilePath ? activeFilePath.split("/").filter(Boolean) : [];

  const breadcrumbBar = activeFileId && breadcrumbSegments.length > 0 ? (
    <div className="flex items-center gap-0.5 px-3 h-7 bg-[var(--ide-panel)] border-b border-[var(--ide-border)] shrink-0 overflow-x-auto scrollbar-hide" data-testid="breadcrumb-bar">
      {breadcrumbSegments.map((segment, i) => {
        const isLast = i === breadcrumbSegments.length - 1;
        return (
          <span key={i} className="flex items-center gap-0.5 shrink-0">
            {i > 0 && <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
            <span
              className={`text-[11px] px-1 py-0.5 rounded ${isLast ? "text-[var(--ide-text)] font-medium" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] cursor-default"}`}
              data-testid={`breadcrumb-segment-${i}`}
            >
              {segment}
            </span>
          </span>
        );
      })}
      <div className="flex-1" />
      {activeFileId && !isSpecialTab(activeFileId) && (
        <button
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${blameEnabled ? "bg-[#7C65CB]/20 text-[#7C65CB] border border-[#7C65CB]/30" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
          onClick={() => setBlameEnabled(!blameEnabled)}
          title={blameEnabled ? "Hide Git blame annotations" : "Show Git blame annotations"}
          data-testid="button-toggle-blame"
        >
          <GitCommitHorizontal className="w-3 h-3" />
          {blameEnabled ? "Blame" : "Blame"}
          {blameEnabled && blameQuery.isLoading && <span className="w-1.5 h-1.5 rounded-full bg-[#7C65CB] animate-pulse" />}
        </button>
      )}
    </div>
  ) : null;

  const webviewTabContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      <div className="flex items-center gap-1 px-1.5 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0"
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
          <div className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70">
            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
            <span className="text-[10px] text-[var(--ide-text-secondary)] truncate font-mono">{livePreviewUrl || (previewHtml ? "HTML Preview" : "localhost:3000")}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {livePreviewUrl && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
              onClick={() => window.open(livePreviewUrl, "_blank")}
              title="Open in new tab" data-testid="button-webview-tab-newtab"><ExternalLink className="w-3 h-3" /></Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {wsStatus === "running" && livePreviewUrl ? (
          <iframe id="webview-tab-iframe" src={livePreviewUrl} className="w-full h-full border-0 bg-white dark:bg-white" title="Live Preview" loading="lazy" data-testid="iframe-webview-tab" />
        ) : previewHtml ? (
          <iframe srcDoc={previewHtml} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-webview-tab-html" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--ide-text-muted)] gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center">
              <Monitor className="w-7 h-7 text-[var(--ide-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--ide-text)]">Webview</p>
            <p className="text-xs text-center max-w-[220px] text-[var(--ide-text-muted)] leading-relaxed">
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
      wsStatus === "stopped" ? "bg-[var(--ide-surface)] text-[var(--ide-text-secondary)] border border-[var(--ide-text-muted)]/30" :
      wsStatus === "error" ? "bg-red-600/20 text-red-400 border border-red-600/30" :
      wsStatus === "offline" ? "bg-orange-600/20 text-orange-400 border border-orange-600/30" :
      "bg-[var(--ide-surface)] text-[var(--ide-text-muted)] border border-[var(--ide-border)]"
    }`} data-testid="text-workspace-status">
      <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "running" ? "bg-green-400 animate-pulse" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "stopped" ? "bg-[var(--ide-text-secondary)]" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[var(--ide-text-muted)]"}`} />
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
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      <div className="flex items-center justify-between px-2 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-2">
          <Hash className="w-3 h-3 text-[#0CCE6B]" />
          <span className="text-[11px] text-[var(--ide-text-secondary)] font-medium">Shell</span>
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
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      <div className="flex items-center justify-between px-2 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-[#F5A623]" />
          <span className="text-[11px] text-[var(--ide-text-secondary)] font-medium">Console</span>
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors duration-150" onClick={() => setLogs([])} title="Clear Console" data-testid="button-console-tab-clear"><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-testid="console-tab-output">
        {logs.length === 0 && !isRunning && !runMutation.isPending && <p className="text-[var(--ide-text-muted)] text-center py-4 text-xs">Press Run to execute your code</p>}
        {(isRunning || runMutation.isPending) && logs.length === 0 && (
          <div className="flex items-center gap-2 py-1 text-[#0079F2] border-b border-[var(--ide-border)]/50 mb-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[11px]">Running {activeFileName || "code"}...</span>
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-green-400" : "text-[var(--ide-text-secondary)]"}`}>
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
            <div className="flex-1 overflow-hidden flex">
              <div className={splitEditorFileId ? "overflow-hidden" : "flex-1 overflow-hidden"} style={splitEditorFileId ? { width: `${splitEditorWidth}%` } : undefined}>
                <CodeEditor value={currentCode} onChange={handleCodeChange} language={editorLanguage} onCursorChange={handleCursorChange} fontSize={editorFontSize} tabSize={editorTabSize} wordWrap={editorWordWrap} blameData={blameEnabled ? blameQuery.data?.blame : undefined} aiCompletions={true} />
              </div>
              {splitEditorFileId && (
                <>
                  <div
                    className="w-1 cursor-col-resize flex items-center justify-center shrink-0 hover:bg-[#0079F2]/30 transition-colors bg-[var(--ide-surface)]/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      splitDragStartX.current = e.clientX;
                      splitDragStartW.current = splitEditorWidth;
                      const onMove = (ev: MouseEvent) => {
                        if (splitDragStartX.current === null) return;
                        const container = editorPreviewContainerRef.current;
                        if (!container) return;
                        const dx = ev.clientX - splitDragStartX.current;
                        const pct = (dx / container.clientWidth) * 100;
                        setSplitEditorWidth(Math.max(20, Math.min(80, splitDragStartW.current + pct)));
                      };
                      const onUp = () => { splitDragStartX.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                      document.addEventListener("mousemove", onMove);
                      document.addEventListener("mouseup", onUp);
                    }}
                  >
                    <div className="w-[2px] h-8 rounded-full bg-[var(--ide-surface)]" />
                  </div>
                  <div className="overflow-hidden flex flex-col" style={{ width: `${100 - splitEditorWidth}%` }}>
                    <div className="flex items-center justify-between h-7 px-2 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0">
                      <div className="flex items-center gap-1.5">
                        <FileTypeIcon filename={(() => { const f = filesQuery.data?.find(f => f.id === splitEditorFileId); return f?.filename || ""; })()} />
                        <span className="text-[10px] text-[var(--ide-text-secondary)] truncate">{filesQuery.data?.find(f => f.id === splitEditorFileId)?.filename || ""}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => setSplitEditorFileId(null)} data-testid="button-close-split">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <CodeEditor
                        value={fileContents[splitEditorFileId] ?? filesQuery.data?.find(f => f.id === splitEditorFileId)?.content ?? ""}
                        onChange={(val) => {
                          setFileContents(prev => ({ ...prev, [splitEditorFileId]: val }));
                          setDirtyFiles(prev => new Set(prev).add(splitEditorFileId));
                          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                          saveTimerRef.current = setTimeout(() => {
                            saveMutation.mutate({ fileId: splitEditorFileId, content: val });
                          }, 1500);
                        }}
                        language={detectLanguage(filesQuery.data?.find(f => f.id === splitEditorFileId)?.filename || "")}
                        fontSize={editorFontSize}
                        tabSize={editorTabSize}
                        wordWrap={editorWordWrap}
                      />
                    </div>
                  </div>
                </>
              )}
              {showMinimap && !splitEditorFileId && (
                <div className="w-[60px] shrink-0 bg-[var(--ide-bg)] border-l border-[var(--ide-border)]/50 overflow-hidden relative select-none" data-testid="minimap">
                  <pre className="text-[2px] leading-[3px] text-[var(--ide-text-muted)]/40 font-mono p-1 whitespace-pre overflow-hidden pointer-events-none" style={{ transform: "scaleX(0.8)", transformOrigin: "left top" }}>
                    {currentCode.split("\n").slice(0, 200).map((line, i) => (
                      <div key={i} className={i + 1 === cursorLine ? "bg-[#0079F2]/20" : ""}>{line || " "}</div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          ) : (!filesQuery.data || filesQuery.data.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-full bg-[var(--ide-panel)] animate-fade-in overflow-y-auto">
          <div className="max-w-md text-center px-6 py-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#F26522]/10 to-[#F26522]/5 border border-[#F26522]/20 flex items-center justify-center mx-auto mb-6">
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none" data-testid="img-replit-logo">
                <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--ide-text)] mb-2" data-testid="text-welcome-heading">Welcome to your project</h3>
            <p className="text-sm text-[var(--ide-text-muted)] mb-8 leading-relaxed">Get started by creating your first file or asking AI for help</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <button
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] hover:border-[#0CCE6B]/40 hover:bg-[#0CCE6B]/5 transition-all text-center group"
                onClick={() => setNewFileDialogOpen(true)}
                data-testid="button-quickstart-create-file"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0CCE6B]/10 flex items-center justify-center group-hover:bg-[#0CCE6B]/20 transition-colors">
                  <Plus className="w-5 h-5 text-[#0CCE6B]" />
                </div>
                <span className="text-xs font-medium text-[var(--ide-text)]">Create a file</span>
                <span className="text-[10px] text-[var(--ide-text-muted)]">Start from scratch</span>
              </button>
              <button
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] hover:border-[#7C65CB]/40 hover:bg-[#7C65CB]/5 transition-all text-center group"
                onClick={() => { if (isMobile) setMobileTab("ai"); else { setAiPanelOpen(true); setSidebarOpen(false); } }}
                data-testid="button-quickstart-ask-ai"
              >
                <div className="w-10 h-10 rounded-lg bg-[#7C65CB]/10 flex items-center justify-center group-hover:bg-[#7C65CB]/20 transition-colors">
                  <Sparkles className="w-5 h-5 text-[#7C65CB]" />
                </div>
                <span className="text-xs font-medium text-[var(--ide-text)]">Ask AI</span>
                <span className="text-[10px] text-[var(--ide-text-muted)]">Generate code with AI</span>
              </button>
              <button
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] hover:border-[#0079F2]/40 hover:bg-[#0079F2]/5 transition-all text-center group"
                onClick={() => uploadInputRef.current?.click()}
                data-testid="button-quickstart-import"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0079F2]/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-[#0079F2]" />
                </div>
                <span className="text-xs font-medium text-[var(--ide-text)]">Import files</span>
                <span className="text-[10px] text-[var(--ide-text-muted)]">Upload from your device</span>
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 mb-8 text-[10px] text-[var(--ide-text-muted)] font-mono" data-testid="text-keyboard-hints">
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-secondary)]">⌘K</kbd> Commands</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-secondary)]">⌘B</kbd> Sidebar</span>
            </div>
            <div className="text-left bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-xl p-4" data-testid="section-getting-started">
              <h4 className="text-[11px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest mb-3">Getting Started</h4>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span>
                  <div>
                    <p className="text-[11px] text-[var(--ide-text)] font-medium">Create your first file</p>
                    <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">Click "Create a file" above or use the + button in the sidebar</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0079F2]/10 text-[#0079F2] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span>
                  <div>
                    <p className="text-[11px] text-[var(--ide-text)] font-medium">Write your code</p>
                    <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">Use the editor with syntax highlighting and auto-save</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F26522]/10 text-[#F26522] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span>
                  <div>
                    <p className="text-[11px] text-[var(--ide-text)] font-medium">Run and preview</p>
                    <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">Hit the Run button or press F5 to execute your code</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-[var(--ide-panel)] animate-fade-in">
          <div className="max-w-sm text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-6">
              <FileCode2 className="w-7 h-7 text-[var(--ide-text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--ide-text)] mb-2" data-testid="text-open-file-heading">Open a file to start editing</h3>
            <p className="text-sm text-[var(--ide-text-muted)] mb-6 leading-relaxed">Select a file from the sidebar or from the list below</p>
            <div className="flex flex-col gap-0.5 max-w-[280px] mx-auto mb-6" data-testid="list-recent-files">
              {filesQuery.data?.slice(0, 8).map((file) => (
                <button
                  key={file.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--ide-surface)] transition-colors group"
                  onClick={() => { openFile(file); if (isMobile) setMobileTab("editor"); }}
                  data-testid={`button-recent-file-${file.id}`}
                >
                  <FileTypeIcon filename={file.filename} />
                  <span className="text-[12px] text-[var(--ide-text-secondary)] group-hover:text-[var(--ide-text)] truncate flex-1">{file.filename}</span>
                  <ChevronRight className="w-3 h-3 text-[#4A5068] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1 max-w-[220px] mx-auto">
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={() => { if (isMobile) setMobileTab("files"); else { setSidebarOpen(true); setAiPanelOpen(false); } }} data-testid="button-open-explorer">
                <FolderOpen className="w-4 h-4 text-[#0079F2]" /> Explorer
                <span className="ml-auto text-[10px] text-[var(--ide-text-muted)] font-mono">⌘B</span>
              </button>
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={() => setNewFileDialogOpen(true)} data-testid="button-new-file-empty">
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 animate-fade-in" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "12px", lineHeight: "1.6" }} data-testid="terminal-output">
      {logs.length === 0 && !isRunning && !runMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--ide-text-muted)]" data-testid="text-terminal-empty">
          <Terminal className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-xs">Press <kbd className="px-1.5 py-0.5 mx-1 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text-secondary)] text-[10px]">F5</kbd> or click <span className="text-[#0CCE6B] font-medium">Run</span> to execute your code</p>
        </div>
      )}
      {(isRunning || runMutation.isPending) && logs.length === 0 && (
        <div className="flex items-center gap-2 py-1.5 text-[#0079F2] border-b border-[var(--ide-border)]/50 mb-1" data-testid="text-run-header">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[11px]">Running {activeFileName || "code"}...</span>
        </div>
      )}
      {logs.map((log) => (
        <div key={log.id} className={`leading-relaxed ${log.type === "error" ? "text-red-400" : log.type === "success" ? "text-[#0CCE6B]" : "text-[#C5C8D4]"}`}>
          <span className="whitespace-pre-wrap break-all">{log.text.includes('\x1b[') ? parseAnsi(log.text) : log.text}</span>
        </div>
      ))}
      {isRunning && logs.length > 0 && <span className="inline-block w-[7px] h-[14px] bg-[#0079F2] animate-pulse ml-0.5" />}
    </div>
  );

  const previewContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      {wsStatus === "running" && livePreviewUrl ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[var(--ide-text-secondary)] shrink-0" />
              <span className="text-[11px] text-[var(--ide-text-secondary)] truncate">{livePreviewUrl}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]"
                onClick={() => { const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = livePreviewUrl; }}
                title="Refresh" data-testid="button-preview-refresh"><RefreshCw className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] gap-1"
                onClick={() => window.open(livePreviewUrl, "_blank")} data-testid="button-preview-new-tab"><ExternalLink className="w-3 h-3" /> Open</Button>
            </div>
          </div>
          <iframe id="live-preview-iframe" src={livePreviewUrl} className="flex-1 w-full border-0 bg-white" title="Live Preview" loading="lazy" data-testid="iframe-live-preview" />
        </>
      ) : previewHtml ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[var(--ide-text-secondary)] shrink-0" />
              <span className="text-[11px] text-[var(--ide-text-secondary)] truncate">HTML Preview</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]"
                onClick={() => { const html = generateHtmlPreview(); if (html) setPreviewHtml(html); }}
                title="Refresh" data-testid="button-preview-refresh-html"><RefreshCw className="w-3 h-3" /></Button>
            </div>
          </div>
          <iframe srcDoc={previewHtml} className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-html-preview-mobile" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[var(--ide-text-secondary)] shrink-0" />
              <span className="text-[11px] text-[var(--ide-text-secondary)] truncate">localhost:3000</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]"
                onClick={() => { const html = generateHtmlPreview(); if (html) setPreviewHtml(html); }}
                title="Refresh" data-testid="button-preview-refresh-idle"><RefreshCw className="w-3 h-3" /></Button>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center h-full text-[var(--ide-text-muted)] gap-3">
            <Globe className="w-10 h-10" />
            <p className="text-sm font-medium text-[var(--ide-text)]">{hasHtmlFile ? "HTML Preview" : "Live Preview"}</p>
            {hasHtmlFile ? (
              <>
                <p className="text-xs text-center max-w-[280px]">Preview your HTML project directly in the browser</p>
                <Button size="sm" variant="ghost" className="h-7 px-4 text-[11px] text-[#0079F2] hover:text-white hover:bg-[#0079F2] border border-[#0079F2]/30 rounded-full gap-1.5 transition-all" onClick={handlePreview} data-testid="button-preview-mobile-start">
                  <Eye className="w-3 h-3" /> Preview HTML
                </Button>
              </>
            ) : runnerOnline === false ? (
              <>
                <p className="text-xs text-center max-w-[280px] text-orange-400/80">Runner is offline. Create an HTML file to use the built-in preview, or wait for the runner to come back online.</p>
              </>
            ) : wsStatus === "none" || wsStatus === "stopped" ? (
              <>
                <p className="text-xs text-center max-w-[280px]">Start your server on port <span className="text-[#0079F2] font-mono">:3000</span> in the workspace to see the preview here.</p>
                <p className="text-[10px] text-[var(--ide-border)]">Start the workspace then run your app</p>
              </>
            ) : (
              <p className="text-xs">Workspace starting up...</p>
            )}
          </div>
        </>
      )}
    </div>
  );

  const shellContent = (
    <div className="flex-1 overflow-hidden animate-fade-in">
      <WorkspaceTerminal wsUrl={terminalWsUrl} runnerOffline={runnerOnline === false} visible={true} />
    </div>
  );

  const bottomPanel = (
    <div className="flex flex-col bg-[var(--ide-panel)] h-full">
      <div className="h-1 cursor-ns-resize resize-handle flex items-center justify-center shrink-0" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
        <div className="w-8 h-[2px] rounded-full bg-[var(--ide-surface)]" />
      </div>
      <div className="flex items-center justify-between px-1 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center h-full overflow-x-auto">
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 ${bottomTab === "terminal" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`} onClick={() => setBottomTab("terminal")} data-testid="tab-console">
            <Terminal className="w-3 h-3" /> Console {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          </button>
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 ${bottomTab === "problems" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`} onClick={() => setBottomTab("problems")} data-testid="tab-problems">
            <AlertCircle className="w-3 h-3" /> Problems <span className="text-[9px] px-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">0</span>
          </button>
          {terminalTabs.map((tab, idx) => (
            <button
              key={idx}
              className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 group ${bottomTab === "shell" && activeTerminalTab === idx ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`}
              onClick={() => { setBottomTab("shell"); setActiveTerminalTab(idx); }}
              data-testid={`tab-shell-${idx}`}
            >
              <Hash className="w-3 h-3" /> {tab}
              {terminalTabs.length > 1 && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:text-[#FF6166]" onClick={(e) => {
                  e.stopPropagation();
                  const newTabs = terminalTabs.filter((_, i) => i !== idx);
                  setTerminalTabs(newTabs);
                  if (activeTerminalTab === idx) {
                    if (newTabs.length > 0) { setActiveTerminalTab(Math.min(idx, newTabs.length - 1)); } else { setBottomTab("terminal"); }
                  } else if (activeTerminalTab > idx) {
                    setActiveTerminalTab(activeTerminalTab - 1);
                  }
                }}>
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
          <button
            className="flex items-center justify-center w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors ml-1 shrink-0"
            onClick={() => { setTerminalTabs(prev => [...prev, `Terminal ${prev.length + 1}`]); setActiveTerminalTab(terminalTabs.length); setBottomTab("shell"); }}
            title="New Terminal"
            data-testid="button-new-terminal"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 pr-1 shrink-0">
          {wsStatusBadge}
          {workspaceButton}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors duration-150" onClick={() => setLogs([])} title="Clear Console" data-testid="button-clear-console"><Trash2 className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors duration-150" onClick={() => setTerminalVisible(false)} title="Close" data-testid="button-close-terminal"><X className="w-3 h-3" /></Button>
        </div>
      </div>
      {bottomTab === "terminal" ? terminalContent : bottomTab === "shell" ? shellContent : bottomTab === "problems" ? (
        <div className="flex-1 overflow-y-auto px-3 py-2 animate-fade-in" data-testid="problems-panel">
          <div className="flex flex-col items-center justify-center py-8 text-[var(--ide-text-muted)]">
            <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-xs font-medium text-[var(--ide-text-secondary)] mb-1">No problems detected</p>
            <p className="text-[10px]">Code analysis is active and monitoring your files</p>
          </div>
        </div>
      ) : terminalContent}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-panel)] text-sm select-none overflow-hidden">
      {/* TOP BAR */}
      <div className={`grid items-center ${isMobile ? "grid-cols-[1fr_auto_auto] gap-1 px-2 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]" : "grid-cols-3 px-3 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]"} h-11 shrink-0 z-40 transition-all duration-200 ${isMobile && mobileToolbarHidden ? "-mt-11" : ""}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <button className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 group ${"hover:bg-[var(--ide-panel)]"}`} onClick={() => setLocation("/dashboard")} title="Home" data-testid="button-back">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="group-hover:scale-110 transition-transform">
              <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
              <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
              <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
            </svg>
          </button>
          <ChevronRight className={`w-3 h-3 shrink-0 ${"text-[var(--ide-text-muted)]"}`} />
          <span className={`text-[13px] font-medium truncate ${isMobile ? "text-[var(--ide-text)] max-w-[120px]" : "text-[var(--ide-text)] max-w-[180px]"}`} data-testid="text-project-name">{project?.name}</span>
          {project?.isPublished && <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${"bg-green-500/10 text-green-400 border border-green-500/20"}`}>Live</span>}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className={`h-7 ${isMobile ? "px-3" : "px-5"} text-[11px] font-semibold rounded-full gap-1.5 transition-all duration-150 ${isRunning ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)] btn-run-red" : "bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_12px_rgba(12,206,107,0.3)] btn-run-green"}`}
                  onClick={handleRun}
                  disabled={runMutation.isPending}
                  data-testid="button-run"
                >
                  {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isRunning ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Play className="w-3 h-3 fill-current" /> Run</>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">{isRunning ? "Stop (F5)" : "Run (F5)"}</TooltipContent>
            </Tooltip>
            {hasHtmlFile && wsStatus !== "running" && !isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-3 text-[11px] font-medium rounded-full gap-1.5 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-[var(--ide-border)] transition-all duration-150"
                    onClick={handlePreview}
                    data-testid="button-preview"
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Preview HTML (⌘\)</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-end gap-1">
          {isMobile ? (
            <>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md transition-colors duration-150" onClick={() => setPublishDialogOpen(true)} data-testid="button-publish-mobile">
                <Rocket className="w-3.5 h-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-md transition-colors duration-150" data-testid="button-kebab-menu">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl shadow-black/10">
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setProjectSettingsOpen(true)}>
                    <Settings className="w-3.5 h-3.5" /> Project Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setPublishDialogOpen(true)}>
                    <Rocket className="w-3.5 h-3.5" /> Publish
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => toast({ title: "Coming soon", description: "Invite feature coming soon" })}>
                    <Users className="w-3.5 h-3.5" /> Invite
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setGitPanelOpen(true)}>
                    <GitBranch className="w-3.5 h-3.5" /> Version Control
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-md gap-1.5 transition-colors duration-150" onClick={() => toast({ title: "Coming soon", description: "Invite feature coming soon" })} data-testid="button-invite">
                      <Users className="w-3.5 h-3.5" /> Invite
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Invite collaborators</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-md gap-1.5 transition-colors duration-150" onClick={() => setPublishDialogOpen(true)} data-testid="button-publish">
                      <Rocket className="w-3.5 h-3.5" /> Publish
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Publish your project</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-md transition-colors duration-150" data-testid="button-kebab-menu">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl">
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setProjectSettingsOpen(true)}>
                    <Settings className="w-3.5 h-3.5" /> Project Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setTerminalVisible(!terminalVisible)}>
                    <Terminal className="w-3.5 h-3.5" /> Toggle Terminal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* RUNNER OFFLINE BANNER - only show briefly, not blocking */}

      {/* === MOBILE LAYOUT === */}
      {isMobile ? (
        <>
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
            <div className={`flex-1 flex flex-col overflow-hidden ${slideDirection === "right" ? "mobile-slide-left" : slideDirection === "left" ? "mobile-slide-right" : ""}`}>
              {mobileTab === "files" && sidebarContent}
              {mobileTab === "editor" && (
                <div className="flex-1 flex flex-col overflow-hidden" onScroll={handleMobileScroll}>
                  {editorTabBar}
                  {editorContent}
                </div>
              )}
              {mobileTab === "terminal" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]">
                  <div className="flex items-center justify-between px-2 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
                    <div className="flex items-center gap-0">
                      <button
                        className={`flex items-center gap-1.5 px-3 h-9 text-[11px] font-medium border-b-2 transition-colors ${mobileShellMode === "console" ? "text-[#F5A623] border-[#F5A623]" : "text-[#9CA3AF] border-transparent hover:text-[var(--ide-text-muted)]"}`}
                        onClick={() => setMobileShellMode("console")}
                        data-testid="mobile-shell-tab-console"
                      >
                        <Terminal className="w-3 h-3" /> Console
                        {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
                      </button>
                      {wsStatus === "running" && (
                        <button
                          className={`flex items-center gap-1.5 px-3 h-9 text-[11px] font-medium border-b-2 transition-colors ${mobileShellMode === "shell" ? "text-[#0CCE6B] border-[#0CCE6B]" : "text-[#9CA3AF] border-transparent hover:text-[var(--ide-text-muted)]"}`}
                          onClick={() => setMobileShellMode("shell")}
                          data-testid="mobile-shell-tab-shell"
                        >
                          <Hash className="w-3 h-3" /> Shell
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {mobileShellMode === "console" && (
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors duration-150" onClick={() => setLogs([])} title="Clear Console" data-testid="button-clear-console-mobile"><Trash2 className="w-3 h-3" /></Button>
                      )}
                      {wsStatusBadge}
                      {workspaceButton}
                    </div>
                  </div>
                  {mobileShellMode === "console" ? terminalContent : shellContent}
                </div>
              )}
              {mobileTab === "preview" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]">
                  <div className="flex items-center gap-1.5 px-2 h-10 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors" onClick={() => { try { const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement; if (iframe?.contentWindow) iframe.contentWindow.history.back(); } catch {} }} data-testid="button-webview-back"><ArrowLeft className="w-3.5 h-3.5" /></button>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors" onClick={() => { try { const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement; if (iframe?.contentWindow) iframe.contentWindow.history.forward(); } catch {} }} data-testid="button-webview-forward"><ArrowRight className="w-3.5 h-3.5" /></button>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors" onClick={() => {
                        if (wsStatus === "running" && livePreviewUrl) {
                          const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement;
                          if (iframe) iframe.src = livePreviewUrl;
                        } else {
                          const html = generateHtmlPreview();
                          if (html) setPreviewHtml(html);
                        }
                      }} data-testid="button-webview-refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <div className="flex-1 mx-1 h-7 flex items-center px-2.5 rounded-lg bg-[var(--ide-panel)] border border-[var(--ide-border)] text-[11px] text-[var(--ide-text-muted)] truncate font-mono" data-testid="text-webview-url">
                        <Globe className="w-3 h-3 text-[var(--ide-text-muted)] mr-1.5 shrink-0" />
                        <span className="truncate">{livePreviewUrl || (previewHtml ? "HTML Preview" : "localhost:3000")}</span>
                      </div>
                      {livePreviewUrl && (
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors" onClick={() => window.open(livePreviewUrl, "_blank")} data-testid="button-webview-external"><ExternalLink className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  {previewContent}
                </div>
              )}
              {mobileTab === "ai" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <AIPanel
                    key={`ai-mobile-fullscreen-${projectId}`}
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
              {mobileTab === "search" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-search-panel">
                  <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                    <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Search</span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors ${showReplace ? "text-[#0079F2] bg-[#0079F2]/10" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => setShowReplace(!showReplace)} title="Toggle Replace" data-testid="mobile-button-toggle-replace">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.293 5.293l-4-4a1 1 0 00-1.414 0l-4 4a1 1 0 001.414 1.414L5 4.414V12a3 3 0 003 3h4a1 1 0 100-2H8a1 1 0 01-1-1V4.414l1.707 1.293a1 1 0 001.414-1.414z" /></svg>
                      </Button>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-b border-[var(--ide-border)] space-y-2">
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search in files..."
                          className="pl-8 bg-[var(--ide-bg)] border-[var(--ide-border)] h-8 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40 rounded-md"
                          autoFocus
                          data-testid="mobile-input-search-files"
                        />
                      </div>
                      <button className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold shrink-0 transition-colors ${searchCaseSensitive ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/40" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-transparent"}`} onClick={() => setSearchCaseSensitive(!searchCaseSensitive)} title="Match Case" data-testid="mobile-button-search-case">Aa</button>
                      <button className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold shrink-0 transition-colors ${searchWholeWord ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/40" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-transparent"}`} onClick={() => setSearchWholeWord(!searchWholeWord)} title="Match Whole Word" data-testid="mobile-button-search-whole-word"><span className="border-b border-current px-0.5">ab</span></button>
                      <button className={`w-7 h-7 flex items-center justify-center rounded text-[11px] shrink-0 transition-colors font-mono ${searchRegex ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/40" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-transparent"}`} onClick={() => setSearchRegex(!searchRegex)} title="Use Regular Expression" data-testid="mobile-button-search-regex">.*</button>
                    </div>
                    {showReplace && (
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <Input value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} placeholder="Replace..." className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-8 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40 rounded-md pl-3" data-testid="mobile-input-replace-files" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 shrink-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
                          title="Replace All"
                          data-testid="mobile-button-replace-all"
                          onClick={() => {
                            if (!searchTerm.trim() || !filesQuery.data) return;
                            let count = 0;
                            let regex: RegExp;
                            try {
                              if (searchRegex) {
                                const pattern = searchWholeWord ? `\\b${searchTerm}\\b` : searchTerm;
                                regex = new RegExp(pattern, searchCaseSensitive ? "g" : "gi");
                              } else {
                                const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const pattern = searchWholeWord ? `\\b${escaped}\\b` : escaped;
                                regex = new RegExp(pattern, searchCaseSensitive ? "g" : "gi");
                              }
                            } catch { return; }
                            filesQuery.data.forEach((file) => {
                              const content = fileContents[file.id] ?? file.content ?? "";
                              const matches = content.match(regex);
                              if (matches && matches.length > 0) {
                                const newContent = content.replace(regex, replaceTerm);
                                setFileContents((prev) => ({ ...prev, [file.id]: newContent }));
                                saveMutation.mutate({ fileId: file.id, content: newContent });
                                count += matches.length;
                              }
                            });
                            if (count > 0) {
                              toast({ title: "Replace All", description: `Replaced ${count} occurrence${count === 1 ? "" : "s"} across files.` });
                              setSearchTerm(searchTerm);
                            } else {
                              toast({ title: "Replace All", description: "No matches found.", variant: "destructive" });
                            }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10a2 2 0 012 2v4a1 1 0 01-2 0V3H3v10h4a1 1 0 010 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm7 8l2 2-2 2m4-2H10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Button>
                      </div>
                    )}
                    {searchTerm.trim() && searchResults.length > 0 && (
                      <div className="text-[10px] text-[var(--ide-text-muted)]">{searchResults.length} result{searchResults.length === 1 ? "" : "s"} in {new Set(searchResults.map(r => r.fileId)).size} file{new Set(searchResults.map(r => r.fileId)).size === 1 ? "" : "s"}</div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {searchTerm.trim() && searchResults.length === 0 && (
                      <div className="px-3 py-6 text-center"><p className="text-xs text-[var(--ide-text-muted)]">No results found</p></div>
                    )}
                    {searchResults.map((result, i) => (
                      <button key={`${result.fileId}-${result.line}-${i}`} className="w-full text-left px-3 py-1.5 hover:bg-[var(--ide-surface)] transition-colors border-b border-[var(--ide-border)]/50" onClick={() => { const file = filesQuery.data?.find((f) => f.id === result.fileId); if (file) { openFile(file); } setMobileTab("editor"); }} data-testid={`mobile-search-result-${i}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FileTypeIcon filename={result.filename} />
                          <span className="text-[10px] font-medium text-[var(--ide-text)] truncate">{result.filename}</span>
                          <span className="text-[9px] text-[var(--ide-text-muted)] ml-auto shrink-0">:{result.line}</span>
                        </div>
                        <p className="text-[10px] text-[var(--ide-text-secondary)] truncate font-mono pl-4">{result.text}</p>
                      </button>
                    ))}
                    {!searchTerm.trim() && (
                      <div className="px-3 py-8 text-center">
                        <Search className="w-8 h-8 text-[var(--ide-border)] mx-auto mb-3" />
                        <p className="text-xs text-[var(--ide-text-muted)]">Type to search across all files</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {mobileTab === "git" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-git-panel">
                  <GitHubPanel projectId={projectId} projectName={project?.name || "project"} />
                </div>
              )}
              {mobileTab === "deployments" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-deployments-panel">
                  <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                    <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Deployments</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${project?.isPublished ? "bg-[#0CCE6B]" : "bg-[var(--ide-text-muted)]"}`} />
                        <span className="text-xs font-medium text-[var(--ide-text)]">{project?.isPublished ? "Published" : "Not published"}</span>
                      </div>
                      {project?.isPublished && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                            <Globe className="w-3 h-3 text-[#0079F2] shrink-0" />
                            <span className="text-[10px] text-[var(--ide-text-secondary)] truncate font-mono flex-1">{`${window.location.origin}/shared/${projectId}`}</span>
                            <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={copyShareUrl} data-testid="mobile-button-copy-deploy-url">
                              {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => window.open(`/shared/${projectId}`, "_blank")} data-testid="mobile-button-open-deploy-url">
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                        <div className="flex items-center gap-2">
                          <Rocket className="w-3.5 h-3.5 text-[#0CCE6B]" />
                          <span className="text-[11px] text-[var(--ide-text)]">Publish</span>
                        </div>
                        <Switch checked={project?.isPublished || false} onCheckedChange={() => publishMutation.mutate()} disabled={publishMutation.isPending} data-testid="mobile-switch-deploy-publish" />
                      </div>
                    </div>
                    <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Deployment History</span>
                      <div className="mt-2 space-y-1.5">
                        {project?.isPublished ? (
                          <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-[var(--ide-text)] font-medium">Production</p>
                              <p className="text-[9px] text-[var(--ide-text-muted)]">{new Date().toLocaleDateString()} · Live</p>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Active</span>
                          </div>
                        ) : (
                          <div className="py-4 text-center">
                            <p className="text-[10px] text-[var(--ide-text-muted)]">No deployments yet</p>
                            <p className="text-[9px] text-[#4A5068] mt-1">Publish your project to create a deployment</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Custom Domain</span>
                      {customDomains.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {customDomains.map((d: any) => (
                            <div key={d.id} className="p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-[var(--ide-text)] font-mono truncate flex-1">{d.domain}</span>
                                <button className="text-[var(--ide-text-muted)] hover:text-red-400 transition-colors ml-2" onClick={() => {
                                  apiRequest("DELETE", `/api/projects/${projectId}/domains/${d.id}`)
                                    .then(() => { setCustomDomains((prev: any[]) => prev.filter((x: any) => x.id !== d.id)); toast({ title: "Domain removed" }); });
                                }} data-testid={`mobile-button-remove-domain-${d.id}`}><X className="w-3 h-3" /></button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {d.verified ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30">Verified</span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">Pending</span>
                                )}
                                {d.sslStatus === "active" ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0079F2]/15 text-[#0079F2] border border-[#0079F2]/30">SSL Active</span>
                                ) : d.sslStatus === "provisioning" ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">SSL Provisioning</span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">No SSL</span>
                                )}
                              </div>
                              {!d.verified && (
                                <Button variant="ghost" size="sm" className="mt-2 h-6 px-2 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10 rounded w-full" onClick={() => {
                                  apiRequest("POST", `/api/projects/${projectId}/domains/${d.id}/verify`)
                                    .then(r => r.json()).then((data) => {
                                      if (data.verified) {
                                        setCustomDomains((prev: any[]) => prev.map((x: any) => x.id === d.id ? { ...x, verified: true, sslStatus: "provisioning" } : x));
                                        toast({ title: "Domain verified!", description: "SSL certificate is being provisioned." });
                                      } else {
                                        toast({ title: "Not verified", description: data.message, variant: "destructive" });
                                      }
                                    });
                                }} data-testid={`mobile-button-verify-domain-${d.id}`}>Verify DNS</Button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-2">
                        {showDomainInput ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={domainInput}
                              onChange={(e) => setDomainInput(e.target.value)}
                              placeholder="example.com"
                              className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2.5 py-1.5 text-[var(--ide-text)] placeholder-[#4A5068] outline-none focus:border-[#0079F2] font-mono"
                              onKeyDown={(e) => { if (e.key === "Enter" && domainInput.trim()) handleAddDomain(); if (e.key === "Escape") setShowDomainInput(false); }}
                              autoFocus
                              data-testid="mobile-input-custom-domain"
                            />
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-[#0CCE6B] hover:bg-[#0CCE6B]/10 rounded shrink-0" onClick={handleAddDomain} data-testid="mobile-button-confirm-domain">Add</Button>
                            <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0" onClick={() => setShowDomainInput(false)}><X className="w-3 h-3" /></Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] text-[var(--ide-text-secondary)] border border-[var(--ide-border)] border-dashed hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] hover:border-[#0079F2]/40 rounded-md w-full" onClick={() => setShowDomainInput(true)} data-testid="mobile-button-add-domain">
                            <Plus className="w-3 h-3 mr-1" /> Add Domain
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {mobileTab === "packages" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-packages-panel">
                  <PackagesPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "database" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-database-panel">
                  <DatabasePanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "tests" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-tests-panel">
                  <TestRunnerPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "security" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-security-panel">
                  <SecurityScannerPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "storage" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-storage-panel">
                  <AppStoragePanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "auth" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-auth-panel">
                  <AuthPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "integrations" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-integrations-panel">
                  <IntegrationsPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "settings" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-settings-panel">
                  <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                    <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Settings</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Theme</span>
                      <div className="mt-2 flex gap-2">
                        <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-[#0079F2]/10 border border-[#0079F2]/30 text-[11px] text-[var(--ide-text)]" data-testid="mobile-button-theme-dark">
                          <span className="w-4 h-4 rounded-full bg-[var(--ide-bg)] border border-[var(--ide-border)]" /> Dark
                        </button>
                        <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[11px] text-[var(--ide-text-muted)] opacity-50 cursor-not-allowed" disabled data-testid="mobile-button-theme-light">
                          <span className="w-4 h-4 rounded-full bg-white border border-gray-300" /> Light
                        </button>
                      </div>
                    </div>
                    <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Editor</span>
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--ide-text-secondary)]">Font Size</span>
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))} data-testid="mobile-button-font-size-decrease"><span className="text-xs font-bold">−</span></Button>
                            <span className="text-[11px] text-[var(--ide-text)] w-6 text-center font-mono" data-testid="mobile-text-font-size">{editorFontSize}</span>
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => setEditorFontSize(Math.min(24, editorFontSize + 1))} data-testid="mobile-button-font-size-increase"><span className="text-xs font-bold">+</span></Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--ide-text-secondary)]">Tab Size</span>
                          <div className="flex items-center gap-1">
                            {[2, 4].map((size) => (
                              <button key={size} onClick={() => setEditorTabSize(size)} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${editorTabSize === size ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] border border-[var(--ide-border)]"}`} data-testid={`mobile-button-tab-size-${size}`}>
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--ide-text-secondary)]">Word Wrap</span>
                          <Switch checked={editorWordWrap} onCheckedChange={setEditorWordWrap} data-testid="mobile-switch-word-wrap" />
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Project</span>
                      <div className="mt-2 space-y-0.5">
                        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={() => { setMobileTab("editor"); setProjectSettingsOpen(true); }} data-testid="mobile-button-open-project-settings">
                          <Settings className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                          <span className="text-[11px] text-[var(--ide-text-secondary)]">Project Settings</span>
                          <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={() => { setMobileTab("editor"); setEnvVarsPanelOpen(true); }} data-testid="mobile-button-open-env-vars">
                          <Key className="w-3.5 h-3.5 text-[#F5A623]" />
                          <span className="text-[11px] text-[var(--ide-text-secondary)]">Secrets</span>
                          <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
                        </button>
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">About</span>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--ide-text-muted)]">Version</span>
                          <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">1.0.0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--ide-text-muted)]">Runtime</span>
                          <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">Node.js</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--ide-text-muted)]">Editor</span>
                          <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">CodeMirror 6</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--ide-border)]">
                          <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
                            <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                            <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                            <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
                          </svg>
                          <span className="text-[10px] text-[var(--ide-text-muted)]">Powered by E-Code</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mobileTab === "editor" && (
              <div className={`absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2 transition-all duration-200 ${fabOpen ? "opacity-100" : ""}`}>
                {fabOpen && (
                  <div className="flex flex-col gap-2 mb-1 animate-fade-in">
                    <button
                      className="w-11 h-11 rounded-full bg-[#0CCE6B] text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                      onClick={() => { handleRun(); setFabOpen(false); }}
                      data-testid="fab-run"
                    >
                      {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      className="w-11 h-11 rounded-full bg-[#0079F2] text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                      onClick={() => {
                        if (activeFileId && fileContents[activeFileId]) {
                          saveMutation.mutate({ fileId: activeFileId, content: fileContents[activeFileId] });
                        }
                        setFabOpen(false);
                      }}
                      data-testid="fab-save"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      className="w-11 h-11 rounded-full bg-[#7C65CB] text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                      onClick={() => { setMobileTab("ai"); setFabOpen(false); }}
                      data-testid="fab-ai"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button
                  className={`w-14 h-14 rounded-full bg-[#0079F2] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all duration-200 ${fabOpen ? "rotate-45" : ""}`}
                  onClick={() => setFabOpen(!fabOpen)}
                  data-testid="fab-toggle"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>

          {/* MOBILE MORE MENU OVERLAY */}
          {moreMenuOpen && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="mobile-more-overlay">
              <div className="absolute inset-0 bg-black/50" onClick={() => setMoreMenuOpen(false)} />
              <div
                className="relative bg-[var(--ide-bg)] border-t border-[var(--ide-border)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up"
                style={{ transform: moreMenuSwipeY > 0 ? `translateY(${moreMenuSwipeY}px)` : undefined, transition: moreMenuSwipeY > 0 ? "none" : undefined }}
                data-testid="mobile-more-menu"
                onTouchStart={(e) => { moreMenuTouchStartY.current = e.touches[0].clientY; }}
                onTouchMove={(e) => { const dy = e.touches[0].clientY - moreMenuTouchStartY.current; setMoreMenuSwipeY(Math.max(0, dy)); }}
                onTouchEnd={() => { if (moreMenuSwipeY > 80) { setMoreMenuOpen(false); } setMoreMenuSwipeY(0); }}
              >
                <div className="flex justify-center pt-2 pb-1">
                  <div className="w-10 h-1 rounded-full bg-[var(--ide-border)]" />
                </div>
                <div className="px-4 py-2">
                  <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">More</span>
                </div>
                <div className="grid grid-cols-4 gap-1 px-3 pb-4">
                  {overflowTabs.map(({ id, icon: Icon, label, color }) => {
                    const isActive = mobileTab === id;
                    return (
                      <button
                        key={id}
                        className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-150 active:scale-95 ${isActive ? "bg-[var(--ide-surface)]" : "hover:bg-[var(--ide-surface)]"}`}
                        onClick={() => { handleMobileTabChange(id); setMoreMenuOpen(false); }}
                        data-testid={`mobile-more-item-${id}`}
                      >
                        <Icon className="w-5 h-5" style={{ color: isActive ? color : "#9CA3AF" }} />
                        <span className="text-[10px] font-medium leading-none" style={{ color: isActive ? color : "#9CA3AF" }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MOBILE BOTTOM NAV */}
          <div className="flex items-stretch h-[56px] bg-[var(--ide-bg)] border-t border-[var(--ide-border)] shrink-0 z-40 mobile-safe-bottom" data-testid="mobile-nav-bar">
            {([
              { id: "files" as const, icon: FolderOpen, label: "Files", color: "#6B7280" },
              { id: "editor" as const, icon: Code2, label: "Code", color: "#0079F2" },
              { id: "terminal" as const, icon: Terminal, label: "Shell", color: "#0CCE6B" },
              { id: "preview" as const, icon: Globe, label: "Webview", color: "#F5A623" },
            ]).map(({ id, icon: Icon, label, color }) => {
              const isActive = mobileTab === id;
              return (
                <button
                  key={id}
                  className="relative flex flex-col items-center justify-center gap-1 flex-1 transition-all duration-150 active:scale-90"
                  style={{ color: isActive ? color : "#9CA3AF" }}
                  onClick={() => { handleMobileTabChange(id); setMoreMenuOpen(false); }}
                  data-testid={`mobile-tab-${id}`}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2.5px] rounded-full transition-all duration-200" style={{ backgroundColor: color }} />
                  )}
                  <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? "scale-110" : ""}`} />
                  <span className={`text-[10px] font-medium leading-none ${isActive ? "opacity-100" : "opacity-70"}`}>{label}</span>
                  {id === "terminal" && isRunning && (
                    <span className="absolute top-1.5 right-[calc(50%-2px)] translate-x-3 w-2 h-2 rounded-full bg-[#0CCE6B] border-2 border-[var(--ide-bg)]" />
                  )}
                </button>
              );
            })}
            <button
              className="relative flex flex-col items-center justify-center gap-1 flex-1 transition-all duration-150 active:scale-90"
              style={{ color: isOverflowTabActive ? (overflowTabs.find(t => t.id === mobileTab)?.color || "#9CA3AF") : "#9CA3AF" }}
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              data-testid="mobile-tab-more"
            >
              {isOverflowTabActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2.5px] rounded-full transition-all duration-200" style={{ backgroundColor: overflowTabs.find(t => t.id === mobileTab)?.color || "#9CA3AF" }} />
              )}
              <MoreHorizontal className={`w-5 h-5 transition-transform duration-150 ${isOverflowTabActive ? "scale-110" : ""}`} />
              <span className={`text-[10px] font-medium leading-none ${isOverflowTabActive ? "opacity-100" : "opacity-70"}`}>More</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* === TABLET + DESKTOP LAYOUT: VS Code style === */}
          <div className="flex flex-1 overflow-hidden">
            {/* ACTIVITY BAR */}
            <TooltipProvider delayDuration={200}>
            <div className="w-12 bg-[var(--ide-bg)] border-r border-[var(--ide-border)] flex flex-col items-center py-1 shrink-0" data-testid="activity-bar">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${sidebarOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { const shouldOpen = !sidebarOpen || aiPanelOpen || searchPanelOpen || deploymentsPanelOpen || settingsPanelOpen; setSidebarOpen(shouldOpen); setAiPanelOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); }}
                    data-testid="activity-explorer"
                  >
                    {sidebarOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <PanelLeft className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Files</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${searchPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setSearchPanelOpen(!searchPanelOpen); if (!searchPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-search"
                  >
                    {searchPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Search className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Search</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${aiPanelOpen ? "text-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setAiPanelOpen(!aiPanelOpen); if (!aiPanelOpen) { setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-ai"
                  >
                    {aiPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#7C65CB]" />}
                    <Sparkles className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">AI Agent</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${gitPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setGitPanelOpen(!gitPanelOpen); if (!gitPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-git"
                  >
                    {gitPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F26522]" />}
                    <GitBranch className="w-5 h-5" />
                    {(gitDiffQuery.data?.changes?.length || 0) > 0 && <span className="absolute top-1.5 right-2 min-w-[16px] h-4 rounded-full bg-[#0079F2] flex items-center justify-center px-1"><span className="text-[9px] font-bold text-white">{gitDiffQuery.data?.changes?.length}</span></span>}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Source Control</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${deploymentsPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setDeploymentsPanelOpen(!deploymentsPanelOpen); if (!deploymentsPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setSettingsPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-deployments"
                  >
                    {deploymentsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Rocket className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Deployments</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${packagesPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setPackagesPanelOpen(!packagesPanelOpen); if (!packagesPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-packages"
                  >
                    {packagesPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0CCE6B]" />}
                    <Package className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Packages</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${databasePanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setDatabasePanelOpen(!databasePanelOpen); if (!databasePanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setPackagesPanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-database"
                  >
                    {databasePanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F26522]" />}
                    <Database className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Database</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${testsPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setTestsPanelOpen(!testsPanelOpen); if (!testsPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-tests"
                  >
                    {testsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0CCE6B]" />}
                    <FlaskConical className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Tests</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${securityPanelOpen ? "text-[#E54D4D]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setSecurityPanelOpen(!securityPanelOpen); if (!securityPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-security"
                  >
                    {securityPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#E54D4D]" />}
                    <Shield className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Security Scanner</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${authPanelOpen ? "text-[#0CCE6B]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setAuthPanelOpen(!authPanelOpen); if (!authPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-auth"
                  >
                    {authPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0CCE6B]" />}
                    <ShieldCheck className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Auth</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${storagePanelOpen ? "text-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setStoragePanelOpen(!storagePanelOpen); if (!storagePanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-storage"
                  >
                    {storagePanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#7C65CB]" />}
                    <HardDrive className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">App Storage</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${integrationsPanelOpen ? "text-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setIntegrationsPanelOpen(!integrationsPanelOpen); if (!integrationsPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); setGitPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); } }}
                    data-testid="activity-integrations"
                  >
                    {integrationsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Puzzle className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Integrations</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${openTabs.includes(SPECIAL_TABS.WEBVIEW) && activeFileId === SPECIAL_TABS.WEBVIEW ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openSpecialTab(SPECIAL_TABS.WEBVIEW)}
                    data-testid="activity-webview"
                  >
                    {openTabs.includes(SPECIAL_TABS.WEBVIEW) && activeFileId === SPECIAL_TABS.WEBVIEW && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Monitor className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Webview</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${openTabs.includes(SPECIAL_TABS.SHELL) && activeFileId === SPECIAL_TABS.SHELL ? "text-[#0CCE6B]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openSpecialTab(SPECIAL_TABS.SHELL)}
                    data-testid="activity-shell"
                  >
                    {openTabs.includes(SPECIAL_TABS.SHELL) && activeFileId === SPECIAL_TABS.SHELL && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0CCE6B]" />}
                    <Hash className="w-5 h-5" />
                    {wsStatus === "running" && <span className="absolute top-1.5 right-2 w-[6px] h-[6px] rounded-full bg-[#0CCE6B] border border-[var(--ide-bg)]" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Shell</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${openTabs.includes(SPECIAL_TABS.CONSOLE) && activeFileId === SPECIAL_TABS.CONSOLE ? "text-[#F5A623]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openSpecialTab(SPECIAL_TABS.CONSOLE)}
                    data-testid="activity-console"
                  >
                    {openTabs.includes(SPECIAL_TABS.CONSOLE) && activeFileId === SPECIAL_TABS.CONSOLE && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F5A623]" />}
                    <Terminal className="w-5 h-5" />
                    {isRunning && <span className="absolute top-1.5 right-2 w-[6px] h-[6px] rounded-full bg-[#0CCE6B] animate-pulse border border-[var(--ide-bg)]" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Console</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${settingsPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { setSettingsPanelOpen(!settingsPanelOpen); if (!settingsPanelOpen) { setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setPackagesPanelOpen(false); setDatabasePanelOpen(false); setTestsPanelOpen(false); setSecurityPanelOpen(false); setStoragePanelOpen(false); setAuthPanelOpen(false); setIntegrationsPanelOpen(false); } }}
                    data-testid="activity-settings"
                  >
                    {settingsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Settings className="w-5 h-5" />
                    <span className={`absolute bottom-1.5 right-2 w-[6px] h-[6px] rounded-full border border-[var(--ide-bg)] ${wsStatus === "running" ? "bg-[#0CCE6B]" : wsStatus === "starting" ? "bg-yellow-400 animate-pulse" : wsStatus === "error" ? "bg-red-400" : wsStatus === "offline" ? "bg-orange-400" : "bg-[var(--ide-text-muted)]"}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Settings</TooltipContent>
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
                  <DropdownMenuContent side="right" align="end" className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl">
                    <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setLocation("/settings")} data-testid="menu-account-settings">
                      <Settings className="w-3.5 h-3.5" /> Account Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setCommandPaletteOpen(true)} data-testid="menu-keyboard-shortcuts">
                      <Keyboard className="w-3.5 h-3.5" /> Keyboard Shortcuts
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                    <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-[var(--ide-surface)] focus:text-red-300 cursor-pointer" onClick={() => logoutMutation.mutate()} data-testid="menu-sign-out">
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            </TooltipProvider>

            {/* AI AGENT PANEL — Main panel like Replit Agent (when open) */}
            {aiPanelOpen && (
              <div className={`${isTablet ? "w-[340px]" : "w-[50%] max-w-[700px] min-w-[380px]"} shrink-0 border-r border-[var(--ide-border)]`} data-testid="ai-agent-panel">
                <AIPanel
                  key={`ai-desktop-${projectId}`}
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
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="search-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Search</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors ${showReplace ? "text-[#0079F2] bg-[#0079F2]/10" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => setShowReplace(!showReplace)} title="Toggle Replace" data-testid="button-toggle-replace">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.293 5.293l-4-4a1 1 0 00-1.414 0l-4 4a1 1 0 001.414 1.414L5 4.414V12a3 3 0 003 3h4a1 1 0 100-2H8a1 1 0 01-1-1V4.414l1.707 1.293a1 1 0 001.414-1.414z" /></svg>
                    </Button>
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => setSearchPanelOpen(false)} data-testid="button-close-search">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="px-3 py-2 border-b border-[var(--ide-border)] space-y-2">
                  <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search in files..."
                        className="pl-8 bg-[var(--ide-bg)] border-[var(--ide-border)] h-8 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40 rounded-md"
                        autoFocus
                        data-testid="input-search-files"
                      />
                    </div>
                    <button
                      className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold shrink-0 transition-colors ${searchCaseSensitive ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/40" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-transparent"}`}
                      onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
                      title="Match Case"
                      data-testid="button-search-case"
                    >
                      Aa
                    </button>
                    <button
                      className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold shrink-0 transition-colors ${searchWholeWord ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/40" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-transparent"}`}
                      onClick={() => setSearchWholeWord(!searchWholeWord)}
                      title="Match Whole Word"
                      data-testid="button-search-whole-word"
                    >
                      <span className="border-b border-current px-0.5">ab</span>
                    </button>
                    <button
                      className={`w-7 h-7 flex items-center justify-center rounded text-[11px] shrink-0 transition-colors font-mono ${searchRegex ? "bg-[#0079F2]/20 text-[#0079F2] border border-[#0079F2]/40" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border border-transparent"}`}
                      onClick={() => setSearchRegex(!searchRegex)}
                      title="Use Regular Expression"
                      data-testid="button-search-regex"
                    >
                      .*
                    </button>
                  </div>
                  {showReplace && (
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <Input
                          value={replaceTerm}
                          onChange={(e) => setReplaceTerm(e.target.value)}
                          placeholder="Replace..."
                          className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-8 text-xs text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40 rounded-md pl-3"
                          data-testid="input-replace-files"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 shrink-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
                        title="Replace All"
                        data-testid="button-replace-all"
                        onClick={() => {
                          if (!searchTerm.trim() || !filesQuery.data) return;
                          let count = 0;
                          let regex: RegExp;
                          try {
                            if (searchRegex) {
                              const pattern = searchWholeWord ? `\\b${searchTerm}\\b` : searchTerm;
                              regex = new RegExp(pattern, searchCaseSensitive ? "g" : "gi");
                            } else {
                              const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const pattern = searchWholeWord ? `\\b${escaped}\\b` : escaped;
                              regex = new RegExp(pattern, searchCaseSensitive ? "g" : "gi");
                            }
                          } catch { return; }
                          filesQuery.data.forEach((file) => {
                            const content = fileContents[file.id] ?? file.content ?? "";
                            const matches = content.match(regex);
                            if (matches && matches.length > 0) {
                              const newContent = content.replace(regex, replaceTerm);
                              setFileContents((prev) => ({ ...prev, [file.id]: newContent }));
                              saveMutation.mutate({ fileId: file.id, content: newContent });
                              count += matches.length;
                            }
                          });
                          if (count > 0) {
                            toast({ title: "Replace All", description: `Replaced ${count} occurrence${count === 1 ? "" : "s"} across files.` });
                            setSearchTerm(searchTerm);
                          } else {
                            toast({ title: "Replace All", description: "No matches found.", variant: "destructive" });
                          }
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10a2 2 0 012 2v4a1 1 0 01-2 0V3H3v10h4a1 1 0 010 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm7 8l2 2-2 2m4-2H10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </Button>
                    </div>
                  )}
                  {searchTerm.trim() && searchResults.length > 0 && (
                    <div className="text-[10px] text-[var(--ide-text-muted)]">{searchResults.length} result{searchResults.length === 1 ? "" : "s"} in {new Set(searchResults.map(r => r.fileId)).size} file{new Set(searchResults.map(r => r.fileId)).size === 1 ? "" : "s"}</div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {searchTerm.trim() && searchResults.length === 0 && (
                    <div className="px-3 py-6 text-center">
                      <p className="text-xs text-[var(--ide-text-muted)]">No results found</p>
                    </div>
                  )}
                  {searchResults.map((result, i) => (
                    <button
                      key={`${result.fileId}-${result.line}-${i}`}
                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--ide-surface)] transition-colors border-b border-[var(--ide-border)]/50"
                      onClick={() => {
                        const file = filesQuery.data?.find((f) => f.id === result.fileId);
                        if (file) { openFile(file); }
                        setSearchPanelOpen(false);
                      }}
                      data-testid={`search-result-${i}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <FileTypeIcon filename={result.filename} />
                        <span className="text-[10px] font-medium text-[var(--ide-text)] truncate">{result.filename}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)] ml-auto shrink-0">:{result.line}</span>
                      </div>
                      <p className="text-[10px] text-[var(--ide-text-secondary)] truncate font-mono pl-4">{result.text}</p>
                    </button>
                  ))}
                  {!searchTerm.trim() && (
                    <div className="px-3 py-8 text-center">
                      <Search className="w-8 h-8 text-[var(--ide-border)] mx-auto mb-3" />
                      <p className="text-xs text-[var(--ide-text-muted)]">Type to search across all files</p>
                      <p className="text-[10px] text-[var(--ide-border)] mt-1">Ctrl+Shift+F</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DEPLOYMENTS PANEL */}
            {deploymentsPanelOpen && !aiPanelOpen && !searchPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="deployments-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Deployments</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => setDeploymentsPanelOpen(false)} data-testid="button-close-deployments">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${project?.isPublished ? "bg-[#0CCE6B]" : "bg-[var(--ide-text-muted)]"}`} />
                      <span className="text-xs font-medium text-[var(--ide-text)]">{project?.isPublished ? "Published" : "Not published"}</span>
                    </div>
                    {project?.isPublished && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                          <Globe className="w-3 h-3 text-[#0079F2] shrink-0" />
                          <span className="text-[10px] text-[var(--ide-text-secondary)] truncate font-mono flex-1">{`${window.location.origin}/shared/${projectId}`}</span>
                          <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={copyShareUrl} data-testid="button-copy-deploy-url">
                            {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button className="p-0.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => window.open(`/shared/${projectId}`, "_blank")} data-testid="button-open-deploy-url">
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                      <div className="flex items-center gap-2">
                        <Rocket className="w-3.5 h-3.5 text-[#0CCE6B]" />
                        <span className="text-[11px] text-[var(--ide-text)]">Publish</span>
                      </div>
                      <Switch
                        checked={project?.isPublished || false}
                        onCheckedChange={() => publishMutation.mutate()}
                        disabled={publishMutation.isPending}
                        data-testid="switch-deploy-publish"
                      />
                    </div>
                  </div>
                  <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                    <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Deployment History</span>
                    <div className="mt-2 space-y-1.5">
                      {project?.isPublished ? (
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-[var(--ide-text)] font-medium">Production</p>
                            <p className="text-[9px] text-[var(--ide-text-muted)]">{new Date().toLocaleDateString()} · Live</p>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Active</span>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-[10px] text-[var(--ide-text-muted)]">No deployments yet</p>
                          <p className="text-[9px] text-[#4A5068] mt-1">Publish your project to create a deployment</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Custom Domain</span>
                    {customDomains.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {customDomains.map((d: any) => (
                          <div key={d.id} className="p-2.5 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-[var(--ide-text)] font-mono truncate flex-1">{d.domain}</span>
                              <button className="text-[var(--ide-text-muted)] hover:text-red-400 transition-colors ml-2" onClick={() => {
                                apiRequest("DELETE", `/api/projects/${projectId}/domains/${d.id}`)
                                  .then(() => { setCustomDomains((prev: any[]) => prev.filter((x: any) => x.id !== d.id)); toast({ title: "Domain removed" }); });
                              }} data-testid={`button-remove-domain-${d.id}`}><X className="w-3 h-3" /></button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {d.verified ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30">Verified</span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">Pending</span>
                              )}
                              {d.sslStatus === "active" ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0079F2]/15 text-[#0079F2] border border-[#0079F2]/30">SSL Active</span>
                              ) : d.sslStatus === "provisioning" ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">SSL Provisioning</span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">No SSL</span>
                              )}
                            </div>
                            {!d.verified && (
                              <Button variant="ghost" size="sm" className="mt-2 h-6 px-2 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10 rounded w-full" onClick={() => {
                                apiRequest("POST", `/api/projects/${projectId}/domains/${d.id}/verify`)
                                  .then(r => r.json()).then((data) => {
                                    if (data.verified) {
                                      setCustomDomains((prev: any[]) => prev.map((x: any) => x.id === d.id ? { ...x, verified: true, sslStatus: "provisioning" } : x));
                                      toast({ title: "Domain verified!", description: "SSL certificate is being provisioned." });
                                    } else {
                                      toast({ title: "Not verified", description: data.message, variant: "destructive" });
                                    }
                                  });
                              }} data-testid={`button-verify-domain-${d.id}`}>Verify DNS</Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      {showDomainInput ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            placeholder="example.com"
                            className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2.5 py-1.5 text-[var(--ide-text)] placeholder-[#4A5068] outline-none focus:border-[#0079F2] font-mono"
                            onKeyDown={(e) => { if (e.key === "Enter" && domainInput.trim()) handleAddDomain(); if (e.key === "Escape") setShowDomainInput(false); }}
                            autoFocus
                            data-testid="input-custom-domain"
                          />
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-[#0CCE6B] hover:bg-[#0CCE6B]/10 rounded shrink-0" onClick={handleAddDomain} data-testid="button-confirm-domain">Add</Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0" onClick={() => setShowDomainInput(false)}><X className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] text-[var(--ide-text-secondary)] border border-[var(--ide-border)] border-dashed hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] hover:border-[#0079F2]/40 rounded-md w-full" onClick={() => setShowDomainInput(true)} data-testid="button-add-domain">
                          <Plus className="w-3 h-3 mr-1" /> Add Domain
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GIT PANEL */}
            {gitPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="git-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Source Control</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => setGitPanelOpen(false)} data-testid="button-close-git">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Branch selector */}
                  <div className="px-3 py-2.5 border-b border-[var(--ide-border)]">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-[#F26522] shrink-0" />
                      <select
                        value={currentBranch}
                        onChange={(e) => {
                          const newBranch = e.target.value;
                          setCurrentBranch(newBranch);
                          const branch = gitBranchesQuery.data?.find((b: any) => b.name === newBranch);
                          if (branch?.headCommitId) {
                            checkoutMutation.mutate({ branchName: newBranch });
                          }
                        }}
                        className="flex-1 text-[11px] text-[var(--ide-text)] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1 outline-none focus:border-[#0079F2] cursor-pointer"
                        data-testid="select-git-branch"
                      >
                        {(gitBranchesQuery.data?.length || 0) > 0 ? (
                          gitBranchesQuery.data!.map((b: any) => (
                            <option key={b.id} value={b.name}>{b.name}{b.isDefault ? " (default)" : ""}</option>
                          ))
                        ) : (
                          <option value="main">main</option>
                        )}
                      </select>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] shrink-0" onClick={() => setShowBranchDialog(true)} title="Create branch" data-testid="button-create-branch">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {showBranchDialog && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          placeholder="New branch name..."
                          className="flex-1 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1 text-[var(--ide-text)] placeholder-[#4A5068] outline-none focus:border-[#0079F2]"
                          onKeyDown={(e) => { if (e.key === "Enter" && newBranchName.trim()) createBranchMutation.mutate(newBranchName.trim()); if (e.key === "Escape") setShowBranchDialog(false); }}
                          autoFocus
                          data-testid="input-new-branch"
                        />
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-[#0CCE6B] hover:bg-[#0CCE6B]/10 shrink-0" onClick={() => { if (newBranchName.trim()) createBranchMutation.mutate(newBranchName.trim()); }} disabled={createBranchMutation.isPending} data-testid="button-confirm-branch">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] shrink-0" onClick={() => { setShowBranchDialog(false); setNewBranchName(""); }} data-testid="button-cancel-branch">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Commit section */}
                  <div className="px-3 py-2.5 border-b border-[var(--ide-border)]">
                    <div className="relative">
                      <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Commit message..."
                        className="w-full text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2.5 py-2 pr-20 text-[var(--ide-text)] placeholder-[#4A5068] outline-none focus:border-[#0079F2] resize-none min-h-[60px]"
                        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && commitMessage.trim()) { e.preventDefault(); commitMutation.mutate(); } }}
                        data-testid="textarea-commit-message"
                      />
                      <button
                        className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[#7C65CB]/15 text-[#7C65CB] hover:bg-[#7C65CB]/25 transition-colors disabled:opacity-50"
                        onClick={async () => {
                          try {
                            setCommitMessage("Generating...");
                            const res = await apiRequest("POST", `/api/projects/${projectId}/git/generate-commit-message`, { branch: currentBranch });
                            const data = await res.json();
                            setCommitMessage(data.message || "Update project files");
                          } catch {
                            setCommitMessage("");
                          }
                        }}
                        disabled={commitMessage === "Generating..."}
                        data-testid="button-generate-commit-message"
                      >
                        {commitMessage === "Generating..." ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        AI
                      </button>
                    </div>
                    <Button
                      className="w-full mt-1.5 h-7 text-[11px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white rounded font-medium gap-1.5"
                      onClick={() => commitMutation.mutate()}
                      disabled={!commitMessage.trim() || commitMutation.isPending || commitMessage === "Generating..."}
                      data-testid="button-commit"
                    >
                      {commitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Commit to {currentBranch}
                    </Button>
                  </div>

                  {/* Changes section */}
                  <div className="border-b border-[var(--ide-border)]">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Changes</span>
                      <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">{gitDiffQuery.data?.changes?.length || 0}</span>
                    </div>
                    {gitDiffQuery.isLoading ? (
                      <div className="px-3 py-4 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
                    ) : !gitDiffQuery.data?.hasCommits ? (
                      <div className="px-3 pb-3">
                        <p className="text-[10px] text-[#4A5068] text-center py-2">No commits yet. Make your first commit to start tracking changes.</p>
                      </div>
                    ) : (gitDiffQuery.data?.changes?.length || 0) === 0 ? (
                      <div className="px-3 pb-3">
                        <p className="text-[10px] text-[#4A5068] text-center py-2">No changes detected</p>
                      </div>
                    ) : (
                      <div className="pb-1">
                        {gitDiffQuery.data!.changes.map((change: any) => (
                          <button
                            key={change.filename}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ide-surface)]/50 text-left transition-colors group"
                            onClick={() => { setDiffFile(change); setShowDiffModal(true); }}
                            data-testid={`git-change-${change.filename}`}
                          >
                            <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${change.status === "added" ? "text-[#0CCE6B]" : change.status === "deleted" ? "text-red-400" : "text-[#F5A623]"}`}>
                              {change.status === "added" ? "A" : change.status === "deleted" ? "D" : "M"}
                            </span>
                            <span className="text-[11px] text-[var(--ide-text-secondary)] truncate flex-1 group-hover:text-[var(--ide-text)]">{change.filename}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Commit history */}
                  <div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">History</span>
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { gitCommitsQuery.refetch(); gitDiffQuery.refetch(); }} data-testid="button-refresh-git">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                    {gitCommitsQuery.isLoading ? (
                      <div className="px-3 py-4 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
                    ) : (gitCommitsQuery.data?.length || 0) === 0 ? (
                      <div className="px-3 pb-3 text-center">
                        <div className="w-10 h-10 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-2">
                          <GitBranch className="w-5 h-5 text-[var(--ide-text-muted)]" />
                        </div>
                        <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium">No commits yet</p>
                        <p className="text-[10px] text-[#4A5068] mt-1">Create your first commit to start version tracking</p>
                      </div>
                    ) : (
                      <div className="pb-2">
                        {gitCommitsQuery.data!.map((commit: any, i: number) => (
                          <div key={commit.id} className="px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors group" data-testid={`git-commit-${commit.id}`}>
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col items-center shrink-0 mt-0.5">
                                <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#0079F2]" : "bg-[var(--ide-surface)]"} shrink-0`} />
                                {i < (gitCommitsQuery.data!.length - 1) && <div className="w-px flex-1 bg-[var(--ide-surface)] min-h-[24px]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-[var(--ide-text)] leading-snug truncate">{commit.message}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] text-[var(--ide-text-muted)] font-mono">{commit.id?.slice(0, 7)}</span>
                                  <span className="text-[9px] text-[#4A5068]">·</span>
                                  <span className="text-[9px] text-[#4A5068]">{new Date(commit.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                  <span className="text-[9px] text-[#4A5068]">{new Date(commit.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <button
                                  className="text-[9px] text-[#0079F2] hover:text-[#0079F2]/80 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => checkoutMutation.mutate({ commitId: commit.id })}
                                  disabled={checkoutMutation.isPending}
                                  data-testid={`button-checkout-${commit.id}`}
                                >
                                  {checkoutMutation.isPending ? "Restoring..." : "Restore this version"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Branch list */}
                  {(gitBranchesQuery.data?.length || 0) > 1 && (
                    <div className="border-t border-[var(--ide-border)]">
                      <div className="px-3 py-2">
                        <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Branches</span>
                      </div>
                      {gitBranchesQuery.data!.map((branch: any) => (
                        <div key={branch.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ide-surface)]/30 group" data-testid={`git-branch-${branch.name}`}>
                          <GitBranch className={`w-3 h-3 shrink-0 ${branch.name === currentBranch ? "text-[#F26522]" : "text-[var(--ide-text-muted)]"}`} />
                          <span className={`text-[11px] flex-1 truncate ${branch.name === currentBranch ? "text-[var(--ide-text)] font-medium" : "text-[var(--ide-text-secondary)]"}`}>{branch.name}</span>
                          {branch.name === currentBranch && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20">current</span>}
                          {!branch.isDefault && branch.name !== currentBranch && (
                            <button className="text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteBranchMutation.mutate(branch.id)} data-testid={`button-delete-branch-${branch.name}`}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-[var(--ide-border)]">
                    <div className="px-3 py-2">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">GitHub</span>
                    </div>
                    <GitHubPanel projectId={projectId} projectName={project?.name || "project"} onImported={(newProjectId) => { if (newProjectId) { setLocation(`/project/${newProjectId}`); } else { filesQuery.refetch(); } }} />
                  </div>
                </div>
              </div>
            )}

            {/* PACKAGES PANEL */}
            {packagesPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`}>
                <PackagesPanel projectId={projectId} onClose={() => setPackagesPanelOpen(false)} />
              </div>
            )}

            {/* DATABASE PANEL */}
            {databasePanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="database-sidebar">
                <DatabasePanel projectId={projectId} onClose={() => setDatabasePanelOpen(false)} />
              </div>
            )}

            {/* TEST RUNNER PANEL */}
            {testsPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="tests-sidebar">
                <TestRunnerPanel projectId={projectId} onClose={() => setTestsPanelOpen(false)} />
              </div>
            )}

            {securityPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="security-sidebar">
                <SecurityScannerPanel projectId={projectId} onClose={() => setSecurityPanelOpen(false)} />
              </div>
            )}

            {storagePanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="storage-sidebar">
                <AppStoragePanel projectId={projectId} onClose={() => setStoragePanelOpen(false)} />
              </div>
            )}

            {/* AUTH PANEL */}
            {authPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="auth-sidebar">
                <AuthPanel projectId={projectId} onClose={() => setAuthPanelOpen(false)} />
              </div>
            )}

            {/* INTEGRATIONS PANEL */}
            {integrationsPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="integrations-sidebar">
                <IntegrationsPanel projectId={projectId} onClose={() => setIntegrationsPanelOpen(false)} />
              </div>
            )}

            {/* ENV VARS PANEL */}
            {envVarsPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="env-vars-sidebar">
                <EnvVarsPanel projectId={projectId} onClose={() => setEnvVarsPanelOpen(false)} />
              </div>
            )}

            {/* SETTINGS PANEL */}
            {settingsPanelOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && (
              <div className={`${isTablet ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="settings-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Settings</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => setSettingsPanelOpen(false)} data-testid="button-close-settings">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                    <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Theme</span>
                    <div className="mt-2 flex gap-2">
                      <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-[#0079F2]/10 border border-[#0079F2]/30 text-[11px] text-[var(--ide-text)]" data-testid="button-theme-dark">
                        <span className="w-4 h-4 rounded-full bg-[var(--ide-bg)] border border-[var(--ide-border)]" />
                        Dark
                      </button>
                      <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[11px] text-[var(--ide-text-muted)] opacity-50 cursor-not-allowed" disabled data-testid="button-theme-light">
                        <span className="w-4 h-4 rounded-full bg-white border border-gray-300" />
                        Light
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                    <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Editor</span>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--ide-text-secondary)]">Font Size</span>
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))} data-testid="button-font-size-decrease">
                            <span className="text-xs font-bold">−</span>
                          </Button>
                          <span className="text-[11px] text-[var(--ide-text)] w-6 text-center font-mono" data-testid="text-font-size">{editorFontSize}</span>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => setEditorFontSize(Math.min(24, editorFontSize + 1))} data-testid="button-font-size-increase">
                            <span className="text-xs font-bold">+</span>
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--ide-text-secondary)]">Tab Size</span>
                        <div className="flex items-center gap-1">
                          {[2, 4].map((size) => (
                            <button key={size} onClick={() => setEditorTabSize(size)} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${editorTabSize === size ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] border border-[var(--ide-border)]"}`} data-testid={`button-tab-size-${size}`}>
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--ide-text-secondary)]">Word Wrap</span>
                        <Switch checked={editorWordWrap} onCheckedChange={setEditorWordWrap} data-testid="switch-word-wrap" />
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-3 border-b border-[var(--ide-border)]">
                    <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Project</span>
                    <div className="mt-2 space-y-0.5">
                      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={() => { setSettingsPanelOpen(false); setProjectSettingsOpen(true); }} data-testid="button-open-project-settings">
                        <Settings className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                        <span className="text-[11px] text-[var(--ide-text-secondary)]">Project Settings</span>
                        <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
                      </button>
                      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ide-surface)] transition-colors text-left" onClick={() => { setSettingsPanelOpen(false); setEnvVarsPanelOpen(true); }} data-testid="button-open-env-vars">
                        <Key className="w-3.5 h-3.5 text-[#F5A623]" />
                        <span className="text-[11px] text-[var(--ide-text-secondary)]">Secrets</span>
                        <ChevronRight className="w-3 h-3 text-[#4A5068] ml-auto" />
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">About</span>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Version</span>
                        <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">1.0.0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Runtime</span>
                        <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">Node.js</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Editor</span>
                        <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">CodeMirror 6</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--ide-border)]">
                        <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
                          <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                          <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                          <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
                        </svg>
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Powered by E-Code</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FILE EXPLORER SIDEBAR */}
            <div className={`shrink-0 transition-all duration-200 overflow-hidden ${sidebarOpen && !aiPanelOpen && !searchPanelOpen && !deploymentsPanelOpen && !settingsPanelOpen && !gitPanelOpen && !envVarsPanelOpen && !packagesPanelOpen && !authPanelOpen && !integrationsPanelOpen ? (isTablet ? "w-[200px]" : "w-[240px]") : "w-0"}`}>
              <div className={`${isTablet ? "w-[200px]" : "w-[240px]"} h-full`}>
                {sidebarContent}
              </div>
            </div>

            {/* MAIN EDITOR + TERMINAL + PREVIEW AREA */}
            <div ref={editorPreviewContainerRef} className="flex-1 flex overflow-hidden min-w-0">
              <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={previewPanelOpen ? { width: `${100 - previewPanelWidth}%` } : undefined}>
                {editorTabBar}
                <div className="flex-1 overflow-hidden min-w-0">
                  {editorContent}
                </div>
                {terminalVisible && (
                  <div className="shrink-0 border-t border-[var(--ide-border)]" style={{ height: `${terminalHeight}px` }}>
                    {bottomPanel}
                  </div>
                )}
              </div>
              {previewPanelOpen && (
                <>
                  <div className="w-1 cursor-col-resize flex items-center justify-center shrink-0 hover:bg-[#0079F2]/30 transition-colors bg-[var(--ide-surface)]/50" onMouseDown={handlePreviewDragStart}>
                    <div className="w-[2px] h-8 rounded-full bg-[var(--ide-surface)]" />
                  </div>
                  <div className="overflow-hidden flex flex-col" style={{ width: `${previewPanelWidth}%` }}>
                    <div className="flex items-center gap-1 px-1.5 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0"
                        onClick={() => {
                          if (wsStatus === "running" && livePreviewUrl) {
                            const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement;
                            if (iframe) iframe.src = iframe.src;
                          } else {
                            const html = generateHtmlPreview();
                            if (html) setPreviewHtml(html);
                          }
                        }}
                        title="Refresh" data-testid="button-preview-panel-refresh"><RefreshCw className="w-3 h-3" /></Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70">
                          <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
                          <span className="text-[10px] text-[var(--ide-text-secondary)] truncate font-mono">{livePreviewUrl || (previewHtml ? "HTML Preview" : "localhost:3000")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {(livePreviewUrl || previewHtml) && (
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
                            onClick={() => { if (livePreviewUrl) window.open(livePreviewUrl, "_blank"); else if (previewHtml) { const blob = new Blob([previewHtml], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); } }}
                            title="Open in new tab" data-testid="button-preview-panel-newtab"><ExternalLink className="w-3 h-3" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
                          onClick={() => setPreviewPanelOpen(false)}
                          title="Close preview" data-testid="button-preview-panel-close"><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden bg-white">
                      {wsStatus === "running" && livePreviewUrl ? (
                        <iframe id="preview-panel-iframe" src={livePreviewUrl} className="w-full h-full border-0" title="Live Preview" loading="lazy" data-testid="iframe-preview-panel" />
                      ) : previewHtml ? (
                        <iframe srcDoc={previewHtml} className="w-full h-full border-0" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-preview-panel-html" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-[var(--ide-panel)] text-[var(--ide-text-muted)] gap-3">
                          <Globe className="w-8 h-8" />
                          <p className="text-xs text-center max-w-[200px]">{hasHtmlFile ? "Click Run to preview your HTML" : "Run your app to see the preview"}</p>
                          {hasHtmlFile && (
                            <Button size="sm" variant="ghost" className="h-7 px-4 text-[11px] text-[#0079F2] hover:text-white hover:bg-[#0079F2] border border-[#0079F2]/30 rounded-full gap-1.5" onClick={handlePreview} data-testid="button-preview-panel-start">
                              <Eye className="w-3 h-3" /> Preview HTML
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* STATUS BAR */}
          <TooltipProvider delayDuration={200}>
          <div className="flex items-center justify-between px-2 h-6 bg-[var(--ide-bg)] border-t border-[var(--ide-border)]/60 shrink-0">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text)] transition-colors" onClick={() => { setGitPanelOpen(true); setAiPanelOpen(false); setSidebarOpen(false); setSearchPanelOpen(false); setDeploymentsPanelOpen(false); setSettingsPanelOpen(false); }} data-testid="button-git-branch">
                    <GitBranch className="w-3 h-3" />
                    <span className="font-medium">{currentBranch}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                  Current branch: {currentBranch}
                </TooltipContent>
              </Tooltip>

              <span className="w-px h-3 bg-[var(--ide-surface)]" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text)] transition-colors"
                    onClick={() => toast({ title: "Problems", description: "No problems detected in workspace." })}
                    data-testid="button-problems"
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>0</span>
                    <X className="w-2.5 h-2.5 ml-0.5" />
                    <span>0</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                  No Problems
                </TooltipContent>
              </Tooltip>

              <span className="w-px h-3 bg-[var(--ide-surface)]" />

              <span className="flex items-center gap-1.5 text-[10px] text-[var(--ide-text-muted)]">
                <span className={`w-[5px] h-[5px] rounded-full ${wsStatus === "running" ? "bg-[#0CCE6B] shadow-[0_0_6px_rgba(12,206,107,0.6)] animate-pulse" : wsStatus === "starting" ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)] animate-pulse" : wsStatus === "error" ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)] animate-pulse" : "bg-[#4A5068]"}`} />
                {wsStatus === "running" ? "Workspace Running" : wsStatus === "starting" ? "Starting Workspace..." : wsStatus === "none" ? "Ready" : wsStatus === "stopped" ? "Workspace Stopped" : wsStatus === "error" ? "Workspace Error" : wsStatus === "offline" ? "Offline" : wsStatus}
              </span>
              <span
                className={`text-[10px] flex items-center gap-1 cursor-pointer ${
                  connectionQuality === "excellent" ? "text-[#0CCE6B]" :
                  connectionQuality === "good" ? "text-[#4A9F6E]" :
                  connectionQuality === "poor" ? "text-yellow-400" :
                  connectionQuality === "polling" ? "text-orange-400" :
                  "text-red-400"
                }`}
                data-testid="status-connection-quality"
                onClick={connectionQuality === "polling" || connectionQuality === "disconnected" ? retryWebSocket : undefined}
                title={
                  connectionQuality === "excellent" ? "Excellent connection" :
                  connectionQuality === "good" ? "Good connection" :
                  connectionQuality === "poor" ? "Poor connection" :
                  connectionQuality === "polling" ? "Polling fallback (click to retry WS)" :
                  "Disconnected (click to retry)"
                }
              >
                <Wifi className="w-2.5 h-2.5" />
                {connectionQuality === "polling" ? "Poll" :
                 connectionQuality === "disconnected" ? "Off" :
                 "WS"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {activeFileName && <span className="text-[10px] text-[var(--ide-text-secondary)]" data-testid="text-cursor-position">Ln {cursorLine}, Col {cursorCol}</span>}
              {activeFileName && <span className="text-[10px] text-[var(--ide-text-secondary)]" data-testid="text-tab-size">Spaces: {editorTabSize}</span>}
              {activeFileName && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] text-[var(--ide-text-secondary)] capitalize hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/60 px-1.5 h-5 rounded transition-colors cursor-pointer" data-testid="button-language-selector">
                      {editorLanguage}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-40 p-1 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl">
                    {["javascript", "typescript", "python", "go", "rust", "cpp", "java", "ruby", "bash", "html", "css", "json", "markdown"].map((lang) => (
                      <button
                        key={lang}
                        className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded capitalize transition-colors ${lang === editorLanguage ? "bg-[#0079F2]/20 text-[#0079F2]" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)] hover:text-[var(--ide-text)]"}`}
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
                  <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[#4A5068] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text-secondary)] transition-colors" data-testid="button-prettier">
                    <Wand2 className="w-3 h-3" />
                    <span>Prettier</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                  Format Document
                </TooltipContent>
              </Tooltip>

              <span className="text-[10px] text-[#4A5068] flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 32 32" fill="none">
                  <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="currentColor"/>
                  <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="currentColor"/>
                  <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="currentColor"/>
                </svg>
                E-Code
              </span>
            </div>
          </div>
          </TooltipProvider>
        </>
      )}

      {/* DIALOGS */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">New File</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">
              {useRunnerFS
                ? <>Create a new file in <span className="text-[var(--ide-text)] font-mono">{currentFsPath === "/" ? "/" : currentFsPath}</span> (Runner FS)</>
                : "Create a new file in your project"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newFileName.trim()) createFileMutation.mutate(newFileName.trim()); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Filename</Label>
              <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder={project?.language === "python" ? "script.py" : "index.ts"} className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]" autoFocus data-testid="input-new-filename" />
            </div>
            <Button type="submit" className="w-full h-9 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-lg text-xs font-medium" disabled={createFileMutation.isPending}>
              {createFileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create File"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Project Settings</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Configure your project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation.mutate({ name: projectName, language: projectLang }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Name</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]" data-testid="input-project-name-settings" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Language</Label>
              <div className="flex flex-wrap gap-2">
                {["javascript", "typescript", "python", "go", "ruby", "cpp", "java", "rust", "bash", "html"].map((lang) => (
                  <button key={lang} type="button" onClick={() => setProjectLang(lang)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${projectLang === lang ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-[var(--ide-border)]"}`}>
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
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#0CCE6B]" /> Publish Project
            </DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Make your project publicly accessible via a shareable link</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--ide-panel)] border border-[var(--ide-border)]">
              <div>
                <p className="text-sm font-medium text-[var(--ide-text)]">{project?.name}</p>
                <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">{project?.language} · {filesQuery.data?.length || 0} files</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--ide-text-secondary)]">{project?.isPublished ? "Published" : "Draft"}</span>
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
                <Label className="text-[11px] text-[var(--ide-text-secondary)]">Shareable URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/shared/${projectId}`}
                    className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg flex-1"
                    data-testid="input-share-url"
                  />
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] shrink-0" onClick={copyShareUrl}>
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] shrink-0" onClick={() => window.open(`/shared/${projectId}`, "_blank")}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">New Folder</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Create a new folder in {currentFsPath === "/" ? "root" : currentFsPath}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim()); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Folder name</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="src" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]" autoFocus data-testid="input-new-foldername" />
            </div>
            <Button type="submit" className="w-full h-9 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-lg text-xs font-medium" disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create Folder"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Delete {deleteTarget?.type === "dir" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">
              Are you sure you want to delete <span className="text-[var(--ide-text)] font-medium">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1 h-9 text-xs text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-lg" onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
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
        onSplitEditor={() => { if (activeFileId && !activeFileId.startsWith("__")) setSplitEditorFileId(activeFileId); }}
        onToggleMinimap={() => setShowMinimap(prev => !prev)}
        onForkProject={() => forkMutation.mutate()}
      />

      {showDiffModal && diffFile && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowDiffModal(false)}>
          <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="diff-modal">
            <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--ide-border)] shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${diffFile.status === "added" ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" : diffFile.status === "deleted" ? "bg-red-500/10 text-red-400" : "bg-[#F5A623]/10 text-[#F5A623]"}`}>
                  {diffFile.status === "added" ? "ADDED" : diffFile.status === "deleted" ? "DELETED" : "MODIFIED"}
                </span>
                <span className="text-[12px] text-[var(--ide-text)] font-medium font-mono">{diffFile.filename}</span>
              </div>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => setShowDiffModal(false)} data-testid="button-close-diff">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto font-mono text-[12px] leading-[20px]">
              {diffFile.status === "added" && diffFile.newContent && (
                diffFile.newContent.split("\n").map((line, i) => (
                  <div key={i} className="flex hover:bg-[#0CCE6B]/5">
                    <span className="w-10 text-right pr-2 text-[#4A5068] select-none shrink-0 bg-[#0CCE6B]/5">{i + 1}</span>
                    <span className="px-2 text-[#0CCE6B]">+ {line}</span>
                  </div>
                ))
              )}
              {diffFile.status === "deleted" && diffFile.oldContent && (
                diffFile.oldContent.split("\n").map((line, i) => (
                  <div key={i} className="flex hover:bg-red-500/5">
                    <span className="w-10 text-right pr-2 text-[#4A5068] select-none shrink-0 bg-red-500/5">{i + 1}</span>
                    <span className="px-2 text-red-400">- {line}</span>
                  </div>
                ))
              )}
              {diffFile.status === "modified" && (() => {
                const oldLines = (diffFile.oldContent || "").split("\n");
                const newLines = (diffFile.newContent || "").split("\n");
                const maxLen = Math.max(oldLines.length, newLines.length);
                const diffLines: { type: "same" | "add" | "remove"; text: string; lineNum: number }[] = [];
                for (let i = 0; i < maxLen; i++) {
                  const oldLine = i < oldLines.length ? oldLines[i] : undefined;
                  const newLine = i < newLines.length ? newLines[i] : undefined;
                  if (oldLine === newLine) {
                    diffLines.push({ type: "same", text: oldLine || "", lineNum: i + 1 });
                  } else {
                    if (oldLine !== undefined) diffLines.push({ type: "remove", text: oldLine, lineNum: i + 1 });
                    if (newLine !== undefined) diffLines.push({ type: "add", text: newLine, lineNum: i + 1 });
                  }
                }
                return diffLines.map((d, i) => (
                  <div key={i} className={`flex ${d.type === "add" ? "bg-[#0CCE6B]/8 hover:bg-[#0CCE6B]/12" : d.type === "remove" ? "bg-red-500/8 hover:bg-red-500/12" : "hover:bg-[var(--ide-surface)]/30"}`}>
                    <span className={`w-10 text-right pr-2 select-none shrink-0 ${d.type === "add" ? "text-[#0CCE6B]/60 bg-[#0CCE6B]/5" : d.type === "remove" ? "text-red-400/60 bg-red-500/5" : "text-[#4A5068]"}`}>{d.lineNum}</span>
                    <span className={`px-2 ${d.type === "add" ? "text-[#0CCE6B]" : d.type === "remove" ? "text-red-400" : "text-[var(--ide-text-secondary)]"}`}>
                      {d.type === "add" ? "+" : d.type === "remove" ? "-" : " "} {d.text}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base flex items-center gap-2"><Keyboard className="w-4 h-4" /> Keyboard Shortcuts</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Quick reference for all available shortcuts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              { category: "General", shortcuts: [
                { keys: ["Ctrl", "P"], desc: "Command Palette" },
                { keys: ["Ctrl", "K"], desc: "Command Palette" },
                { keys: ["Ctrl", "B"], desc: "Toggle Sidebar" },
                { keys: ["Ctrl", "/"], desc: "Keyboard Shortcuts" },
                { keys: ["F5"], desc: "Run / Stop" },
                { keys: ["Ctrl", "Enter"], desc: "Run Code" },
              ]},
              { category: "Editor", shortcuts: [
                { keys: ["Ctrl", "S"], desc: "Save File" },
                { keys: ["Ctrl", "N"], desc: "New File" },
                { keys: ["Ctrl", "W"], desc: "Close Tab" },
                { keys: ["Tab"], desc: "Accept AI Completion" },
                { keys: ["Escape"], desc: "Dismiss AI Completion" },
              ]},
              { category: "Panels", shortcuts: [
                { keys: ["Ctrl", "J"], desc: "Toggle Terminal" },
                { keys: ["Ctrl", "`"], desc: "Toggle Terminal" },
                { keys: ["Ctrl", "\\"], desc: "Toggle Preview" },
                { keys: ["Ctrl", "Shift", "F"], desc: "Search in Files" },
                { keys: ["Ctrl", "H"], desc: "Search & Replace" },
                { keys: ["Ctrl", "Shift", "G"], desc: "Version Control" },
              ]},
            ].map(({ category, shortcuts }) => (
              <div key={category}>
                <h4 className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest mb-2">{category}</h4>
                <div className="space-y-1">
                  {shortcuts.map(({ keys, desc }, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--ide-surface)]/40">
                      <span className="text-[12px] text-[var(--ide-text-secondary)]">{desc}</span>
                      <div className="flex items-center gap-1">
                        {keys.map((k, j) => (
                          <kbd key={j} className="px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[10px] text-[var(--ide-text)] font-mono min-w-[24px] text-center">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={(open) => { setRenameDialogOpen(open); if (!open) setRenameDialogTarget(null); }}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Rename</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">
              Rename <span className="text-[var(--ide-text)] font-medium">{renameDialogTarget?.oldName}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitRenameDialog(); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">New name</Label>
              <Input
                value={renameDialogValue}
                onChange={(e) => setRenameDialogValue(e.target.value)}
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]"
                autoFocus
                data-testid="input-rename"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 h-9 text-xs text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-lg" onClick={() => { setRenameDialogOpen(false); setRenameDialogTarget(null); }}>
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

export default _projectPage;

