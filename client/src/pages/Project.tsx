/* @refresh reset */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as Y from "yjs";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, Play, Square, Terminal, FileCode2, Plus, Loader2,
  X, Trash2, Pencil, FolderOpen, Settings, MoreHorizontal,
  File as FileIcon, FilePlus, RefreshCw, Sparkles, Globe, Rocket, Copy, Check, ExternalLink,
  Server, AlertTriangle, Power, CircleStop, Wifi, WifiOff,
  Folder, FolderPlus, ChevronRight, ChevronDown, ChevronUp, Monitor, Eye, Code2,
  Search, Hash, PanelLeft, Users, GitBranch, AlertCircle, Wand2, LogOut, Keyboard, GitCommitHorizontal, Key, Upload, Package,
  ArrowLeft, ArrowRight, Save, GripHorizontal, Database, FlaskConical, Shield, HardDrive, ShieldCheck, Puzzle, Zap, GitMerge, Download,
  Activity, MessageSquare, Network, Brain, BarChart3, Clock, Lock, Calendar, Layers, Plug2, Cpu, Frame, Maximize2, Inbox, MousePointer2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import PackagesPanel from "@/components/PackagesPanel";
import ConfigPanel from "@/components/ConfigPanel";
import DatabasePanel from "@/components/DatabasePanel";
import BackupRecoverySection from "@/components/BackupRecoverySection";
import TestRunnerPanel from "@/components/TestRunnerPanel";
import SecurityScannerPanel from "@/components/SecurityScannerPanel";
import AppStoragePanel from "@/components/AppStoragePanel";
import AuthPanel from "@/components/AuthPanel";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import AutomationsPanel from "@/components/AutomationsPanel";
import AgentAutomationsPane from "@/components/AgentAutomationsPane";
import WorkflowsPanel from "@/components/WorkflowsPanel";
import MonitoringPanel from "@/components/MonitoringPanel";
import PublishingPanel from "@/components/PublishingPanel";
import ThreadsPanel from "@/components/ThreadsPanel";
import NetworkingPanel from "@/components/NetworkingPanel";
import SkillsPanel from "@/components/SkillsPanel";
import MCPPanel from "@/components/MCPPanel";
import SpotlightOverlay from "@/components/SpotlightOverlay";
import CheckpointsPanel from "@/components/CheckpointsPanel";
import SSHPanel from "@/components/SSHPanel";
import FeedbackInboxPanel from "@/components/FeedbackInboxPanel";
import UserSettingsPanel from "@/components/UserSettingsPanel";
import type { UserPreferences, MergeConflictFile, MergeResolution } from "@shared/schema";
import { DEFAULT_PREFERENCES, COMMUNITY_THEMES } from "@shared/schema";
import MergeConflictPanel from "@/components/MergeConflictPanel";
import FileHistoryPanel from "@/components/FileHistoryPanel";
import { DevicePresetSelector, DevToolsToggle, DeviceFrame, useErudaInjection, injectErudaIntoHtml, useDevicePresetPersistence, ArtifactTypeIcon, ArtifactTypeControls, getArtifactTypeMeta } from "@/components/PreviewDevTools";
import VisualEditorPanel, { injectVisualEditorScript, activateVisualEditor, deactivateVisualEditor, VE_OVERLAY_SCRIPT, type SelectedElement, type VisualEdit } from "@/components/VisualEditor";
import type { DevicePreset } from "@/components/PreviewDevTools";
import MobilePreview, { isMobileAppProject } from "@/components/MobilePreview";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useExternalKeyboardDetection } from "@/hooks/use-keyboard-detection";
import { useProjectWebSocket } from "@/hooks/use-websocket";
import { useCollaboration, type RemoteUser } from "@/hooks/use-collaboration";
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import AIPanel from "@/components/AIPanel";
import { playNotificationSound, sendPushNotification } from "@/lib/notifications";
import ConsolePanel from "@/components/ConsolePanel";
import CodeEditor, { detectLanguage, type BlameEntry } from "@/components/CodeEditor";
import { LSPClient, detectLSPLanguage, type LSPLanguage } from "@/lib/lspClient";
import WorkspaceTerminal, { type WorkspaceTerminalHandle } from "@/components/WorkspaceTerminal";
import CommandPalette from "@/components/CommandPalette";
import EnvVarsPanel from "@/components/EnvVarsPanel";
import GitHubPanel from "@/components/GitHubPanel";
import SlideEditor from "@/components/SlideEditor";
import VideoEditor from "@/components/VideoEditor";
import AnimationPreview from "@/components/AnimationPreview";
import DesignCanvas from "@/components/DesignCanvas";
import ConversionDialog from "@/components/ConversionDialog";
import {
  usePaneLayout, PaneOptionsMenu, ResizeHandle, FloatingPaneWrapper,
  useWorkspaceBroadcast, savePaneLayout, loadPaneLayout,
  savePaneLayoutToServer, loadPaneLayoutFromServer,
  type PaneNode, type PaneLayoutState, type FloatingPane, type PaneBroadcastMessage,
  getAllLeafPanes as getPaneLeaves, getAllLayoutTabs,
} from "@/components/PaneManager";
import type { Project as ProjectType, File, ProjectGuest, Artifact } from "@shared/schema";
import { ARTIFACT_TYPES } from "@shared/schema";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function FileTypeIcon({ filename, className = "" }: { filename: string; className?: string }) {
  if (filename === "ecode.md" || filename.endsWith("/ecode.md")) {
    return (
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0 bg-[#7C65CB] ${className}`}>
        <span className="text-[7px] font-bold leading-none text-white">EC</span>
      </span>
    );
  }
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
    pdf: { bg: "bg-red-600", text: "text-white", label: "PD" },
    docx: { bg: "bg-blue-600", text: "text-white", label: "DX" },
    xlsx: { bg: "bg-green-600", text: "text-white", label: "XL" },
    pptx: { bg: "bg-orange-600", text: "text-white", label: "PT" },
    csv: { bg: "bg-amber-500", text: "text-black", label: "CV" },
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

const _layoutRestoredFlags = new Map<string, boolean>();

function _projectPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const _layoutKey = projectId || "";
  const queryClient = useQueryClient();

  const SPECIAL_TABS = { WEBVIEW: "__webview__", SHELL: "__shell__", CONSOLE: "__console__", CONFIG: "__config__" } as const;
  const CONFLICT_TAB_PREFIX = "__conflict__";
  const isSpecialTab = (id: string) => id === SPECIAL_TABS.WEBVIEW || id === SPECIAL_TABS.SHELL || id === SPECIAL_TABS.CONSOLE || id === SPECIAL_TABS.CONFIG || id.startsWith(CONFLICT_TAB_PREFIX);
  const isFileTab = (id: string) => !isSpecialTab(id) && !id.startsWith(CONFLICT_TAB_PREFIX);
  const isConflictTab = (id: string) => id.startsWith(CONFLICT_TAB_PREFIX);

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentConsoleRunId, setCurrentConsoleRunId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"terminal" | "shell" | "problems" | "references">("terminal");
  const [runDropdownOpen, setRunDropdownOpen] = useState(false);
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [webviewUrlInput, setWebviewUrlInput] = useState("");
  const [selectedDevicePreset, setSelectedDevicePreset] = useState("responsive");
  const [customDeviceWidth, setCustomDeviceWidth] = useState<number | null>(null);
  const [customDeviceHeight, setCustomDeviceHeight] = useState<number | null>(null);
  const [devToolsActive, setDevToolsActive] = useState(false);
  const [visualEditorActive, setVisualEditorActive] = useState(false);
  const [selectedVEElement, setSelectedVEElement] = useState<SelectedElement | null>(null);
  const [visualEditorIframeId, setVisualEditorIframeId] = useState("webview-tab-iframe");
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [conversionFrameId, setConversionFrameId] = useState("");
  const [conversionFrameName, setConversionFrameName] = useState("");
  const [conversionTargetType, setConversionTargetType] = useState<string | undefined>(undefined);
  const [newFileParentFolder, setNewFileParentFolder] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [animationExportOpen, setAnimationExportOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [frameworkCheckbox, setFrameworkCheckbox] = useState(false);
  const [frameworkDesc, setFrameworkDesc] = useState("");
  const [frameworkCategory, setFrameworkCategory] = useState("other");
  const [frameworkCoverUrl, setFrameworkCoverUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectLang, setProjectLang] = useState("");
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoInviteEmail, setInfoInviteEmail] = useState("");
  const [deployInviteEmail, setDeployInviteEmail] = useState("");
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);

  type ToolPanelId = "search" | "git" | "fileHistory" | "deployments" | "packages" | "database" | "tests" | "security" | "storage" | "auth" | "integrations" | "automations" | "agentAutomations" | "workflows" | "monitoring" | "publishing" | "threads" | "networking" | "skills" | "mcp" | "checkpoints" | "settings" | "envVars" | "ssh" | "inbox";
  const [openPanelTabs, setOpenPanelTabs] = useState<ToolPanelId[]>([]);
  const [activePanelTab, setActivePanelTab] = useState<ToolPanelId | null>(null);
  const openPanelTabsRef = useRef(openPanelTabs);
  openPanelTabsRef.current = openPanelTabs;
  const activePanelTabRef = useRef(activePanelTab);
  activePanelTabRef.current = activePanelTab;

  const sidebarShouldBeOpen = sidebarOpen && !aiPanelOpen && openPanelTabs.length === 0;
  useEffect(() => {
    if (!sidebarPanelRef.current) return;
    if (sidebarShouldBeOpen && sidebarPanelRef.current.isCollapsed()) {
      sidebarPanelRef.current.expand();
    } else if (!sidebarShouldBeOpen && !sidebarPanelRef.current.isCollapsed()) {
      sidebarPanelRef.current.collapse();
    }
  }, [sidebarShouldBeOpen]);

  useEffect(() => {
    if (!terminalPanelRef.current) return;
    if (terminalVisible && terminalPanelRef.current.isCollapsed()) {
      terminalPanelRef.current.expand();
    } else if (!terminalVisible && !terminalPanelRef.current.isCollapsed()) {
      terminalPanelRef.current.collapse();
    }
  }, [terminalVisible]);

  useEffect(() => {
    if (!previewPanelRef.current) return;
    if (previewPanelOpen && previewPanelRef.current.isCollapsed()) {
      previewPanelRef.current.expand();
    } else if (!previewPanelOpen && !previewPanelRef.current.isCollapsed()) {
      previewPanelRef.current.collapse();
    }
  }, [previewPanelOpen]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [wsStatus, setWsStatus] = useState<"offline" | "starting" | "running" | "stopped" | "error" | "none">("none");
  const [wsLoading, setWsLoading] = useState(false);
  const [runnerOnline, setRunnerOnline] = useState<boolean | null>(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [expoGoUrl, setExpoGoUrl] = useState<string | null>(null);
  const devUrl = projectId ? `${projectId}.dev.e-code.ai` : null;
  const fullDevUrl = devUrl ? `${window.location.protocol}//${devUrl}` : null;
  const [selectedPreviewPort, setSelectedPreviewPort] = useState<number | null>(null);
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
    setOpenPanelTabs([]);
    setActivePanelTab(null);
  };
  const [currentFsPath, setCurrentFsPath] = useState("/");
  const [activeRunnerPath, setActiveRunnerPath] = useState<string | null>(null);
  type MobileTabType = "files" | "editor" | "terminal" | "preview" | "ai" | "search" | "git" | "fileHistory" | "deployments" | "packages" | "database" | "tests" | "security" | "storage" | "auth" | "integrations" | "automations" | "workflows" | "monitoring" | "threads" | "networking" | "checkpoints" | "settings" | "ssh" | "inbox";
  const [mobileTab, setMobileTab] = useState<MobileTabType>("ai");
  const [prevMobileTab, setPrevMobileTab] = useState<MobileTabType>("editor");
  const [mobileShellMode, setMobileShellMode] = useState<"console" | "shell">("console");
  const [viewMode, setViewMode] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [workspaceMode, setWorkspaceMode] = useState<"editor" | "canvas">(() => {
    try {
      const saved = localStorage.getItem(`workspace-mode-${projectId}`);
      if (saved === "canvas") return "canvas";
    } catch {}
    return "editor";
  });
  const [mobileToolbarHidden, setMobileToolbarHidden] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuSwipeY, setMoreMenuSwipeY] = useState(0);
  const moreMenuTouchStartY = useRef(0);
  const lastScrollY = useRef(0);
  const tabOrder = ["files", "editor", "terminal", "preview", "ai", "search", "git", "fileHistory", "deployments", "packages", "database", "tests", "security", "storage", "auth", "integrations", "automations", "workflows", "monitoring", "threads", "networking", "checkpoints", "settings", "ssh", "inbox"] as const;
  const overflowTabs: { id: MobileTabType; icon: typeof Sparkles; label: string; color: string }[] = [
    { id: "ai", icon: Sparkles, label: "Agent", color: "#7C65CB" },
    { id: "search", icon: Search, label: "Search", color: "#0079F2" },
    { id: "fileHistory", icon: Clock, label: "File History", color: "#F5A623" },
    { id: "deployments", icon: Rocket, label: "Deployments", color: "#0079F2" },
    { id: "packages", icon: Package, label: "Packages", color: "#0CCE6B" },
    { id: "database", icon: Database, label: "Database", color: "#F26522" },
    { id: "tests", icon: FlaskConical, label: "Tests", color: "#0CCE6B" },
    { id: "security", icon: Shield, label: "Security", color: "#E54D4D" },
    { id: "storage", icon: HardDrive, label: "App Storage", color: "#7C65CB" },
    { id: "auth", icon: ShieldCheck, label: "Auth", color: "#0CCE6B" },
    { id: "integrations", icon: Puzzle, label: "Integrations", color: "#0079F2" },
    { id: "automations", icon: Zap, label: "Automations", color: "#F5A623" },
    { id: "workflows", icon: GitMerge, label: "Workflows", color: "#0079F2" },
    { id: "monitoring", icon: Activity, label: "Monitoring", color: "#10B981" },
    { id: "threads", icon: MessageSquare, label: "Threads", color: "#8B5CF6" },
    { id: "networking", icon: Network, label: "Networking", color: "#06B6D4" },
    { id: "checkpoints", icon: Clock, label: "Checkpoints", color: "#7C65CB" },
    { id: "ssh", icon: Terminal, label: "SSH", color: "#F5A623" },
    { id: "inbox", icon: Inbox, label: "Feedback Inbox", color: "#0079F2" },
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

  const previewProxyUrl = useMemo(() => {
    if (!devToolsActive || !livePreviewUrl || !projectId) return null;
    return `/api/workspaces/${projectId}/preview-proxy/`;
  }, [devToolsActive, livePreviewUrl, projectId]);

  const effectivePreviewUrl = devToolsActive && previewProxyUrl ? previewProxyUrl : livePreviewUrl;

  useErudaInjection("webview-tab-iframe", devToolsActive && !previewProxyUrl, previewHtml, livePreviewUrl);
  useErudaInjection("preview-panel-iframe", devToolsActive && !previewProxyUrl, previewHtml, livePreviewUrl);
  useErudaInjection("live-preview-iframe", devToolsActive && !previewProxyUrl, previewHtml, livePreviewUrl);

  const { savedPreset, savedCustomWidth, savedCustomHeight, loaded: presetLoaded } = useDevicePresetPersistence(projectId);

  useEffect(() => {
    if (presetLoaded) {
      setSelectedDevicePreset(savedPreset);
      setCustomDeviceWidth(savedCustomWidth);
      setCustomDeviceHeight(savedCustomHeight);
    }
  }, [presetLoaded, savedPreset, savedCustomWidth, savedCustomHeight]);

  const handleDevicePresetSelect = useCallback((preset: DevicePreset) => {
    setSelectedDevicePreset(preset.id);
    if (preset.id === "custom" && preset.width && preset.height) {
      setCustomDeviceWidth(preset.width);
      setCustomDeviceHeight(preset.height);
    }
  }, []);

  const handleVisualEditorToggle = useCallback((iframeId: string) => {
    setVisualEditorActive(prev => {
      if (prev && visualEditorIframeId === iframeId) {
        deactivateVisualEditor(iframeId);
        setSelectedVEElement(null);
        return false;
      }
      if (prev && visualEditorIframeId !== iframeId) {
        deactivateVisualEditor(visualEditorIframeId);
      }
      setSelectedVEElement(null);
      setVisualEditorIframeId(iframeId);
      setTimeout(() => {
        injectVisualEditorScript(iframeId);
        activateVisualEditor(iframeId);
      }, 300);
      return true;
    });
  }, [visualEditorIframeId]);

  const handleVisualEditApply = useCallback(async (edit: VisualEdit) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/visual-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() as string },
        credentials: "include",
        body: JSON.stringify(edit),
      });
      if (!res.ok) {
        toast({ title: "Edit failed", description: `Server error (${res.status})`, variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.success && data.fileId) {
        setFileContents(prev => ({ ...prev, [data.fileId]: data.content }));
        toast({ title: "Edit applied", description: `Updated ${data.filename}` });
      } else if (data.needsAI) {
        toast({ title: "Complex edit", description: "This change needs the AI Agent. Use the AI Edit section below." });
      }
    } catch {
      toast({ title: "Edit failed", description: "Could not apply the visual edit" });
    }
  }, [projectId]);

  const handleJumpToSource = useCallback(async (element: SelectedElement) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/visual-edit/find-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() as string },
        credentials: "include",
        body: JSON.stringify({ text: element.text, className: element.className, tag: element.tag, dataTestId: element.dataTestId }),
      });
      if (!res.ok) {
        toast({ title: "Error", description: `Server error (${res.status})`, variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.fileId) {
        if (!openTabs.includes(data.fileId)) {
          setOpenTabs(prev => [...prev, data.fileId]);
        }
        setActiveFileId(data.fileId);
        toast({ title: "Source found", description: `${data.filename}:${data.line}` });
      } else {
        toast({ title: "Source not found", description: "Could not locate this element in the source files" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to find source location" });
    }
  }, [projectId, openTabs]);

  const handleAIHandoff = useCallback((element: SelectedElement, description: string) => {
    const context = `Visual Editor edit request for <${element.tag}> element${element.id ? ` #${element.id}` : ""}${element.className ? ` class="${typeof element.className === "string" ? element.className.split(" ").slice(0, 5).join(" ") : ""}"` : ""}${element.text ? ` with text "${element.text.slice(0, 50)}"` : ""}.\n\nRequested change: ${description}`;
    setAiPanelOpen(true);
    const aiInput = document.querySelector('[data-testid="input-ai-message"]') as HTMLTextAreaElement;
    if (aiInput) {
      aiInput.value = context;
      aiInput.dispatchEvent(new Event("input", { bubbles: true }));
      aiInput.focus();
    }
  }, []);

  useEffect(() => {
    if (!visualEditorActive) return;
    const currentIframeId = visualEditorIframeId;
    const handler = (e: MessageEvent) => {
      if (!e.data || !e.data.type) return;
      if (!e.data.type.startsWith("ve:")) return;
      const iframe = document.getElementById(currentIframeId) as HTMLIFrameElement;
      if (iframe && e.source !== iframe.contentWindow) return;
      if (e.data.type === "ve:select") {
        setSelectedVEElement(e.data.payload);
      } else if (e.data.type === "ve:deselect") {
        setSelectedVEElement(null);
      } else if (e.data.type === "ve:jump" && e.data.payload) {
        handleJumpToSource(e.data.payload);
      }
    };
    window.addEventListener("message", handler);

    const iframe = document.getElementById(currentIframeId) as HTMLIFrameElement;
    const onLoad = () => {
      setTimeout(() => {
        injectVisualEditorScript(currentIframeId);
        activateVisualEditor(currentIframeId);
      }, 200);
    };
    if (iframe) iframe.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("message", handler);
      if (iframe) iframe.removeEventListener("load", onLoad);
      deactivateVisualEditor(currentIframeId);
    };
  }, [visualEditorActive, visualEditorIframeId, handleJumpToSource]);

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
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchResults, setSearchResults] = useState<{ fileId: string; filename: string; line: number; text: string }[]>([]);
  interface ShellSession {
    sessionId: string;
    label: string;
    wsUrl: string | null;
  }
  const [shellSessions, setShellSessions] = useState<ShellSession[]>([{ sessionId: "default", label: "Shell", wsUrl: null }]);
  const [activeShellIndex, setActiveShellIndex] = useState(0);
  const [shellSearchOpen, setShellSearchOpen] = useState(false);
  const [shellSearchQuery, setShellSearchQuery] = useState("");
  const shellTerminalRefs = useRef<Map<string, WorkspaceTerminalHandle>>(new Map());
  const shellSearchInputRef = useRef<HTMLInputElement>(null);
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const toolPanelRegistry: { id: ToolPanelId; label: string; icon: typeof Search; color: string }[] = [
    { id: "search", label: "Search", icon: Search, color: "#0079F2" },
    { id: "git", label: "Source Control", icon: GitBranch, color: "#F26522" },
    { id: "fileHistory", label: "File History", icon: Clock, color: "#F5A623" },
    { id: "deployments", label: "Deployments", icon: Rocket, color: "#0079F2" },
    { id: "packages", label: "Packages", icon: Package, color: "#0CCE6B" },
    { id: "database", label: "Database", icon: Database, color: "#F26522" },
    { id: "tests", label: "Tests", icon: FlaskConical, color: "#0CCE6B" },
    { id: "security", label: "Security", icon: Shield, color: "#E54D4D" },
    { id: "storage", label: "App Storage", icon: HardDrive, color: "#7C65CB" },
    { id: "auth", label: "Auth", icon: ShieldCheck, color: "#0CCE6B" },
    { id: "integrations", label: "Integrations", icon: Puzzle, color: "#0079F2" },
    { id: "automations", label: "Automations", icon: Zap, color: "#F5A623" },
    { id: "agentAutomations", label: "Agents & Automations", icon: Zap, color: "#F5A623" },
    { id: "workflows", label: "Workflows", icon: GitMerge, color: "#0079F2" },
    { id: "monitoring", label: "Monitoring", icon: Activity, color: "#10B981" },
    { id: "publishing", label: "Publishing", icon: Rocket, color: "#0079F2" },
    { id: "threads", label: "Threads", icon: MessageSquare, color: "#8B5CF6" },
    { id: "networking", label: "Networking", icon: Network, color: "#06B6D4" },
    { id: "skills", label: "Skills", icon: Brain, color: "#7C65CB" },
    { id: "mcp", label: "MCP Servers", icon: Plug2, color: "#7C65CB" },
    { id: "checkpoints", label: "Checkpoints", icon: Clock, color: "#7C65CB" },
    { id: "settings", label: "Settings", icon: Settings, color: "#0079F2" },
    { id: "envVars", label: "Secrets", icon: Key, color: "#F5A623" },
    { id: "ssh", label: "SSH", icon: Terminal, color: "#F5A623" },
    { id: "inbox", label: "Feedback Inbox", icon: Inbox, color: "#0079F2" },
  ];
  const [dragPanelTabId, setDragPanelTabId] = useState<ToolPanelId | null>(null);
  const [dragOverPanelTabId, setDragOverPanelTabId] = useState<ToolPanelId | null>(null);
  const [panelAddMenuOpen, setPanelAddMenuOpen] = useState(false);

  const openPanel = useCallback((panelId: ToolPanelId) => {
    setOpenPanelTabs(prev => {
      if (prev.includes(panelId)) return prev;
      return [...prev, panelId];
    });
    setActivePanelTab(panelId);
    setSidebarOpen(false);
    setAiPanelOpen(false);
  }, []);

  const closePanel = useCallback((panelId: ToolPanelId) => {
    setOpenPanelTabs(prev => {
      const next = prev.filter(id => id !== panelId);
      if (activePanelTabRef.current === panelId) {
        const idx = prev.indexOf(panelId);
        const newActive = next.length > 0 ? (next[Math.min(idx, next.length - 1)] || next[0]) : null;
        setActivePanelTab(newActive);
      }
      return next;
    });
  }, []);

  const togglePanel = useCallback((panelId: ToolPanelId) => {
    const tabs = openPanelTabsRef.current;
    const active = activePanelTabRef.current;
    if (tabs.includes(panelId) && active === panelId) {
      closePanel(panelId);
    } else {
      openPanel(panelId);
    }
  }, [openPanel, closePanel]);

  const isPanelOpen = useCallback((panelId: ToolPanelId) => openPanelTabs.includes(panelId), [openPanelTabs]);

  const [fileHistoryInitialFile, setFileHistoryInitialFile] = useState<string | null>(null);
  const [fileHistoryOpenCounter, setFileHistoryOpenCounter] = useState(0);

  const openFileHistory = useCallback((filename?: string) => {
    if (filename) {
      setFileHistoryInitialFile(filename);
      setFileHistoryOpenCounter(c => c + 1);
    }
    openPanel("fileHistory");
  }, [openPanel]);

  const searchPanelOpen = isPanelOpen("search");
  const gitPanelOpen = isPanelOpen("git");
  const deploymentsPanelOpen = isPanelOpen("deployments");
  const settingsPanelOpen = isPanelOpen("settings");
  const packagesPanelOpen = isPanelOpen("packages");
  const databasePanelOpen = isPanelOpen("database");
  const testsPanelOpen = isPanelOpen("tests");
  const securityPanelOpen = isPanelOpen("security");
  const storagePanelOpen = isPanelOpen("storage");
  const authPanelOpen = isPanelOpen("auth");
  const integrationsPanelOpen = isPanelOpen("integrations");
  const automationsPanelOpen = isPanelOpen("automations");
  const workflowsPanelOpen = isPanelOpen("workflows");
  const monitoringPanelOpen = isPanelOpen("monitoring");
  const threadsPanelOpen = isPanelOpen("threads");
  const networkingPanelOpen = isPanelOpen("networking");
  const inboxPanelOpen = isPanelOpen("inbox");
  const envVarsPanelOpen = isPanelOpen("envVars");

  const handlePanelTabDragStart = useCallback((e: React.DragEvent, tabId: ToolPanelId) => {
    setDragPanelTabId(tabId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handlePanelTabDragOver = useCallback((e: React.DragEvent, tabId: ToolPanelId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragPanelTabId && dragPanelTabId !== tabId) {
      setDragOverPanelTabId(tabId);
    }
  }, [dragPanelTabId]);

  const handlePanelTabDrop = useCallback((e: React.DragEvent, tabId: ToolPanelId) => {
    e.preventDefault();
    if (dragPanelTabId && dragPanelTabId !== tabId) {
      setOpenPanelTabs(prev => {
        const next = [...prev];
        const fromIdx = next.indexOf(dragPanelTabId);
        const toIdx = next.indexOf(tabId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, dragPanelTabId);
        return next;
      });
    }
    setDragPanelTabId(null);
    setDragOverPanelTabId(null);
  }, [dragPanelTabId]);

  const [blameEnabled, setBlameEnabled] = useState(false);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("");
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffFile, setDiffFile] = useState<{ filename: string; oldContent?: string; newContent?: string; status: string } | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showConnectGithubDialog, setShowConnectGithubDialog] = useState(false);
  const [connectGithubInput, setConnectGithubInput] = useState("");
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
  const [mergeConflicts, setMergeConflicts] = useState<MergeConflictFile[]>([]);
  const [mergeResolutions, setMergeResolutions] = useState<MergeResolution[]>([]);
  const [mergeConflictPanelOpen, setMergeConflictPanelOpen] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, string>>({});
  const [resolvingConflicts, setResolvingConflicts] = useState(false);
  const mergeInProgress = mergeConflicts.length > 0;
  const gitStateHashRef = useRef<string>("");
  const lastDiffChangesRef = useRef<string>("");
  const [userPrefs, setUserPrefsLocal] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const [csvViewMode, setCsvViewMode] = useState<"table" | "raw">("table");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const editorFontSize = userPrefs.fontSize;
  const editorTabSize = userPrefs.tabSize;
  const editorWordWrap = userPrefs.wordWrap;
  const editorTheme = userPrefs.theme;

  useEffect(() => {
    fetch("/api/user/preferences", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(prefs => {
      if (prefs) {
        setUserPrefsLocal(prev => ({ ...prev, ...prefs, agentToolsConfig: { ...prev.agentToolsConfig, ...(prefs.agentToolsConfig || {}) } }));
      }
      setPrefsLoaded(true);
    }).catch(() => setPrefsLoaded(true));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const communityTheme = userPrefs.communityTheme ? COMMUNITY_THEMES.find(t => t.id === userPrefs.communityTheme) : null;
    const customTheme = userPrefs.customTheme;
    if (communityTheme) {
      root.style.setProperty("--ide-bg", communityTheme.colors.background);
      root.style.setProperty("--ide-panel", communityTheme.colors.panel);
      root.style.setProperty("--ide-text", communityTheme.colors.text);
      root.style.setProperty("--ide-border", communityTheme.colors.border);
    } else if (customTheme) {
      root.style.setProperty("--ide-bg", customTheme.colors.background);
      root.style.setProperty("--ide-panel", customTheme.colors.panel);
      root.style.setProperty("--ide-text", customTheme.colors.text);
      root.style.setProperty("--ide-border", customTheme.colors.border);
    } else {
      root.style.removeProperty("--ide-bg");
      root.style.removeProperty("--ide-panel");
      root.style.removeProperty("--ide-text");
      root.style.removeProperty("--ide-border");
    }
    return () => {
      root.style.removeProperty("--ide-bg");
      root.style.removeProperty("--ide-panel");
      root.style.removeProperty("--ide-text");
      root.style.removeProperty("--ide-border");
    };
  }, [userPrefs.communityTheme, userPrefs.customTheme]);

  const savePrefsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePrefs = useCallback((partial: Partial<UserPreferences>) => {
    if (!prefsLoaded) return;
    setUserPrefsLocal(prev => ({ ...prev, ...partial }));
    if (savePrefsTimeout.current) clearTimeout(savePrefsTimeout.current);
    savePrefsTimeout.current = setTimeout(() => {
      fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(partial),
      }).catch(() => {});
    }, 500);
  }, [prefsLoaded]);


  const setEditorFontSize = useCallback((v: number | ((prev: number) => number)) => {
    setUserPrefsLocal(prev => {
      const next = typeof v === "function" ? v(prev.fontSize) : v;
      savePrefs({ fontSize: next });
      return { ...prev, fontSize: next };
    });
  }, [savePrefs]);

  const setEditorTabSize = useCallback((v: number) => {
    savePrefs({ tabSize: v, indentationSize: v });
  }, [savePrefs]);

  const setEditorWordWrap = useCallback((v: boolean) => {
    savePrefs({ wordWrap: v });
  }, [savePrefs]);

  const setEditorTheme = useCallback((v: string) => {
    savePrefs({ theme: v });
  }, [savePrefs]);

  useEffect(() => {
    const root = document.documentElement;
    const ct = userPrefs.customTheme;
    const cid = userPrefs.communityTheme;
    if (ct) {
      root.style.setProperty("--ide-bg", ct.colors.background);
      root.style.setProperty("--ide-panel", ct.colors.panel);
      root.style.setProperty("--ide-text", ct.colors.text);
      root.style.setProperty("--ide-border", ct.colors.border);
      root.classList.add("dark");
    } else if (cid) {
      const found = COMMUNITY_THEMES.find(t => t.id === cid);
      if (found) {
        root.style.setProperty("--ide-bg", found.colors.background);
        root.style.setProperty("--ide-panel", found.colors.panel);
        root.style.setProperty("--ide-text", found.colors.text);
        root.style.setProperty("--ide-border", found.colors.border);
        root.classList.add("dark");
      }
    } else {
      root.style.removeProperty("--ide-bg");
      root.style.removeProperty("--ide-panel");
      root.style.removeProperty("--ide-text");
      root.style.removeProperty("--ide-border");
    }
    return () => {
      root.style.removeProperty("--ide-bg");
      root.style.removeProperty("--ide-panel");
      root.style.removeProperty("--ide-text");
      root.style.removeProperty("--ide-border");
    };
  }, [userPrefs.communityTheme, userPrefs.customTheme]);

  const [splitEditorFileId, setSplitEditorFileId] = useState<string | null>(null);
  const [splitEditorWidth, setSplitEditorWidth] = useState(50);
  const showMinimap = userPrefs.minimap;

  const paneLayout = usePaneLayout([], null);
  const { broadcast: broadcastPaneState, onMessage: onPaneBroadcast, openInNewWindow } = useWorkspaceBroadcast(projectId);
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { matchesCommand, getShortcutDisplay } = useKeyboardShortcuts();
  const [fileDragOver, setFileDragOver] = useState(false);
  const [customDomains, setCustomDomains] = useState<any[]>([]);
  const [showDomainInput, setShowDomainInput] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [deploymentType, setDeploymentType] = useState<"autoscale" | "static" | "reserved-vm" | "scheduled">("static");
  const [deployBuildCommand, setDeployBuildCommand] = useState("");
  const [deployRunCommand, setDeployRunCommand] = useState("");
  const [deployCpu, setDeployCpu] = useState(1);
  const [deployRam, setDeployRam] = useState(512);
  const [deployMaxMachines, setDeployMaxMachines] = useState(3);
  const [deployPublicDir, setDeployPublicDir] = useState("dist");
  const [deployAppType, setDeployAppType] = useState<"web_server" | "background_worker">("web_server");
  const [deployPortMapping, setDeployPortMapping] = useState(3000);
  const [deployScheduleDesc, setDeployScheduleDesc] = useState("");
  const [deployCronExpr, setDeployCronExpr] = useState("");
  const [deployJobTimeout, setDeployJobTimeout] = useState(300);
  const [deployIsPrivate, setDeployIsPrivate] = useState(false);
  const [deployShowBadge, setDeployShowBadge] = useState(true);
  const [deployEnableFeedback, setDeployEnableFeedback] = useState(false);
  const [deployCreateProductionDb, setDeployCreateProductionDb] = useState(false);
  const [deploySeedProductionDb, setDeploySeedProductionDb] = useState(false);
  const [deploySecretsEntries, setDeploySecretsEntries] = useState<{key: string; value: string}[]>([]);
  const [deployPanelTab, setDeployPanelTab] = useState<"config" | "history" | "process" | "analytics" | "settings">("config");
  const [deployProcessLogs, setDeployProcessLogs] = useState<string[]>([]);
  const deployLogsEndRef = useRef<HTMLDivElement>(null);
  const [convertingCron, setConvertingCron] = useState(false);
  const splitDragStartX = useRef<number | null>(null);
  const splitDragStartW = useRef<number>(50);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorPreviewContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoRun = useRef(false);

  const { user, logout: logoutMutation } = useAuth();
  const { messages, connected, connectionQuality, retryWebSocket, sendMessage: wsSendMessage } = useProjectWebSocket(projectId);
  const {
    remoteUsers,
    remoteAwareness,
    connected: collabConnected,
    sendAwareness: collabSendAwareness,
    getFileDoc,
    isFileSynced,
    onJoinNotification,
  } = useCollaboration(projectId, user?.id, activeFileId);
  const collabEditorRef = useRef<{ view?: { state: { selection: { main: { anchor: number; head: number } }; doc: { length: number } } } } | null>(null);

  const lastRecoveryRef = useRef<string | null>(null);
  useEffect(() => {
    const recoveryMsgs = messages.filter((m) => m.type === "git_recovery");
    if (recoveryMsgs.length > 0) {
      const latest = recoveryMsgs[recoveryMsgs.length - 1];
      const latestMsg = (latest as { message?: string }).message || "Repository automatically restored from backup";
      const key = `${recoveryMsgs.length}-${latestMsg}`;
      if (lastRecoveryRef.current !== key) {
        lastRecoveryRef.current = key;
        toast({
          title: "Git Recovery",
          description: latestMsg,
        });
      }
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(`workspace-mode-${projectId}`, workspaceMode);
    } catch {}
  }, [workspaceMode, projectId]);

  useEffect(() => {
    const canvasFrameMsgs = messages.filter((m: { type: string }) => m.type === "canvas_frame_created" || m.type === "canvas_frame_updated");
    if (canvasFrameMsgs.length > 0 && workspaceMode !== "canvas") {
      toast({ title: "Canvas Updated", description: "A new frame was added to the design canvas." });
    }
  }, [messages]);

  const projectQuery = useQuery<ProjectType>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Project not found");
      return res.json();
    },
  });
  const project = projectQuery.data;

  const creditBalanceQuery = useQuery<{
    monthlyCreditsIncluded: number;
    monthlyCreditsUsed: number;
    remaining: number;
    percentUsed: number;
    overageEnabled: boolean;
    overageCreditsUsed: number;
    lowCredits: boolean;
    exhausted: boolean;
    plan: string;
  }>({
    queryKey: ["/api/billing/credits"],
    queryFn: async () => {
      const res = await fetch("/api/billing/credits", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const [creditNotificationShown, setCreditNotificationShown] = useState<string | null>(null);
  useEffect(() => {
    const data = creditBalanceQuery.data;
    if (!data || data.monthlyCreditsIncluded <= 0) return;
    if (data.exhausted && creditNotificationShown !== "exhausted") {
      setCreditNotificationShown("exhausted");
      toast({
        title: "Credits Exhausted",
        description: data.overageEnabled
          ? "Your monthly credits are used up. Additional usage will be billed as overage."
          : "Your monthly credits are used up. Add a payment method or upgrade your plan to continue.",
        variant: "destructive",
      });
    } else if (data.lowCredits && !data.exhausted && creditNotificationShown !== "low") {
      setCreditNotificationShown("low");
      toast({
        title: "Credits Running Low",
        description: `You have ${data.remaining} credits remaining this month (${100 - data.percentUsed}% left).`,
      });
    }
  }, [creditBalanceQuery.data]);

  const runButtonWorkflowsQuery = useQuery<{ id: string; name: string; steps: any[] }[]>({
    queryKey: ["/api/projects", projectId, "workflows"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/workflows`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const setSelectedWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string | null) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/selected-workflow`, { workflowId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setRunDropdownOpen(false);
    },
  });

  const runWorkflowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/run-workflow`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (!data.success) {
        toast({ title: "Workflow failed", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Workflow run failed", description: err.message, variant: "destructive" });
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

  const projectConfigQuery = useQuery<{
    replit: {
      entrypoint?: string; run?: string | string[]; build?: string | string[];
      compile?: string | string[]; onBoot?: string; hidden?: string[];
      audio?: boolean; language?: string; modules?: string[];
      unitTest?: { language?: string }; packager?: any;
      deployment?: any; ports?: { localPort: number; externalPort: number }[];
      runEnv?: Record<string, string>; gitHubImport?: { requiredFiles?: string[] };
    };
    nix: { deps: string[] };
    raw: { replit: string; nix: string };
    hasReplitFile: boolean; hasNixFile: boolean;
  }>({
    queryKey: ["/api/projects", projectId, "config"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/config`, { credentials: "include" });
      if (!res.ok) return { replit: {}, nix: { deps: [] }, raw: { replit: "", nix: "" }, hasReplitFile: false, hasNixFile: false };
      return res.json();
    },
  });

  const hiddenPatterns = useMemo(() => {
    return projectConfigQuery.data?.replit?.hidden || [];
  }, [projectConfigQuery.data?.replit?.hidden]);

  const artifactsQuery = useQuery<Artifact[]>({
    queryKey: ["/api/projects", projectId, "artifacts"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/artifacts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(`project-${projectId}-active-artifact`);
      return saved || null;
    } catch { return null; }
  });
  const projectArtifacts = artifactsQuery.data || [];
  const activeArtifact = projectArtifacts.find(a => a.id === activeArtifactId) || projectArtifacts[0] || null;

  const setActiveArtifactIdPersisted = useCallback((id: string | null) => {
    setActiveArtifactId(id);
    if (projectId) {
      try {
        if (id) { localStorage.setItem(`project-${projectId}-active-artifact`, id); }
        else { localStorage.removeItem(`project-${projectId}-active-artifact`); }
      } catch {}
    }
  }, [projectId]);

  useEffect(() => {
    if (projectArtifacts.length === 0) return;
    if (!activeArtifactId) {
      setActiveArtifactIdPersisted(projectArtifacts[0].id);
    } else if (!projectArtifacts.find(a => a.id === activeArtifactId)) {
      setActiveArtifactIdPersisted(projectArtifacts[0].id);
    }
  }, [projectArtifacts, activeArtifactId, setActiveArtifactIdPersisted]);

  const artifactPreviewUrl = useMemo(() => {
    if (!activeArtifact) return null;
    const artType = activeArtifact.type;
    const entryFile = activeArtifact.entryFile;
    if (artType === "web-app" || artType === "mobile-app") {
      return null;
    }
    if (entryFile && wsStatus === "running" && livePreviewUrl) {
      const base = livePreviewUrl.replace(/\/$/, "");
      return `${base}/${entryFile.replace(/^\//, "")}`;
    }
    return null;
  }, [activeArtifact, wsStatus, livePreviewUrl]);

  const artifactPreviewHtml = useMemo(() => {
    if (!activeArtifact) return null;
    const artType = activeArtifact.type;
    if (artType === "web-app" || artType === "mobile-app") return null;
    const entryFile = activeArtifact.entryFile;
    if (!entryFile || !filesQuery.data) return null;
    const file = filesQuery.data.find(f => f.filename === entryFile || f.id === entryFile);
    if (!file) return null;
    const content = fileContents[file.id] !== undefined ? fileContents[file.id] : file.content;
    if (file.filename.endsWith(".html")) return content;
    return null;
  }, [activeArtifact, filesQuery.data, fileContents]);

  const isWebArtifact = !activeArtifact || activeArtifact.type === "web-app" || activeArtifact.type === "mobile-app";
  const showUrlBar = isWebArtifact || activeArtifact?.type === "data-viz" || activeArtifact?.type === "3d-game";

  const [addArtifactDialogOpen, setAddArtifactDialogOpen] = useState(false);
  const [newArtifactName, setNewArtifactName] = useState("");
  const [newArtifactType, setNewArtifactType] = useState("web-app");

  const createArtifactMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/artifacts`, data);
      return res.json();
    },
    onSuccess: (artifact: Artifact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "artifacts"] });
      setActiveArtifactIdPersisted(artifact.id);
      setAddArtifactDialogOpen(false);
      setNewArtifactName("");
      setNewArtifactType("web-app");
      toast({ title: "Artifact created" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteArtifactMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/artifacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "artifacts"] });
      setActiveArtifactIdPersisted(null);
      toast({ title: "Artifact deleted" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
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

  const githubStatusQuery = useQuery<{ connected: boolean; githubRepo: string | null; ahead: number; behind: number }>({
    queryKey: ["/api/projects", projectId, "git/github-status"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/github-status`, { credentials: "include" });
      if (!res.ok) return { connected: false, githubRepo: null, ahead: 0, behind: 0 };
      return res.json();
    },
    enabled: gitPanelOpen,
  });

  const mergeStatusQuery = useQuery<{ status: string; conflicts?: MergeConflictFile[]; resolutions?: MergeResolution[]; branch?: string }>({
    queryKey: ["/api/projects", projectId, "git/merge-status"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/merge-status`, { credentials: "include" });
      if (!res.ok) return { status: "none" };
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (mergeStatusQuery.data && mergeStatusQuery.data.status === "in_progress" && mergeStatusQuery.data.conflicts) {
      setMergeConflicts(mergeStatusQuery.data.conflicts);
      setMergeResolutions(mergeStatusQuery.data.resolutions || []);
      setMergeConflictPanelOpen(true);
    }
  }, [mergeStatusQuery.data]);

  useEffect(() => {
    if (!gitPanelOpen || !projectId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/git/state-hash`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.hash && gitStateHashRef.current && data.hash !== gitStateHashRef.current) {
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/branches"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/blame"] });
        }
        if (data.hash) gitStateHashRef.current = data.hash;
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [gitPanelOpen, projectId, queryClient]);

  useEffect(() => {
    if (gitDiffQuery.data?.changes?.length) {
      const changedFilenames = gitDiffQuery.data.changes.map((c: { filename: string }) => c.filename).sort().join("\n");
      const allChanged = new Set(gitDiffQuery.data.changes.map((c: { filename: string }) => c.filename));
      if (changedFilenames !== lastDiffChangesRef.current) {
        lastDiffChangesRef.current = changedFilenames;
        setStagedFiles(prev => {
          const filtered = new Set<string>();
          prev.forEach(f => { if (allChanged.has(f)) filtered.add(f); });
          if (filtered.size === 0) return allChanged;
          return filtered;
        });
      }
    } else {
      lastDiffChangesRef.current = "";
      setStagedFiles(new Set());
    }
  }, [gitDiffQuery.data?.changes]);

  const gitChangedFilenames = useMemo(() => {
    if (!userPrefs.filetreeGitStatus || !gitDiffQuery.data?.changes?.length) return new Set<string>();
    return new Set(gitDiffQuery.data.changes.map((c: { filename: string }) => c.filename));
  }, [gitDiffQuery.data?.changes, userPrefs.filetreeGitStatus]);

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
    if (!useRunnerFS && filesQuery.data && filesQuery.data.length > 0 && openTabs.length === 0 && !_layoutRestoredFlags.get(_layoutKey)) {
      const entrypoint = projectConfigQuery.data?.replit?.entrypoint;
      let targetFile = filesQuery.data[0];
      if (entrypoint) {
        const match = filesQuery.data.find((f: any) => f.filename === entrypoint || f.name === entrypoint);
        if (match) targetFile = match;
      }
      setOpenTabs([targetFile.id]);
      setActiveFileId(targetFile.id);
      setFileContents((prev) => ({ ...prev, [targetFile.id]: targetFile.content }));
    }
  }, [filesQuery.data, useRunnerFS, projectConfigQuery.data]);

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
      if (msg.type === "run_status" && msg.status === "running" && msg.consoleRunId) {
        setCurrentConsoleRunId(msg.consoleRunId);
      }
      if (msg.type === "run_status" && (msg.status === "completed" || msg.status === "failed")) {
        setIsRunning(false);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "console-runs"] });
          setCurrentConsoleRunId(null);
        }, 500);
      }
      if (msg.type === "workflow_log" && msg.message) {
        setLogs((prev) => [...prev, { id: Date.now() + Math.random(), text: msg.message!, type: msg.logType || "info" }]);
      }
      if (msg.type === "workflow_status") {
        if (msg.status === "running") {
          setIsRunning(true);
          setTerminalVisible(true);
          setBottomTab("terminal");
        } else if (msg.status === "completed" || msg.status === "failed") {
          setIsRunning(false);
        }
      }
      if (msg.type === "notification") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
      if (msg.type === "deploy_log" && (msg as any).line) {
        setDeployProcessLogs((prev) => {
          const next = [...prev, (msg as any).line as string];
          return next.length > 500 ? next.slice(-500) : next;
        });
      }
      if (msg.type === "deploy_status") {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deploy", "process"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deployments"] });
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (!runDropdownOpen) return;
    const handleClick = () => setRunDropdownOpen(false);
    const timer = setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", handleClick); };
  }, [runDropdownOpen]);

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

  const handleGenerateInviteLink = useCallback(async () => {
    if (!projectId) return;
    setInviteLoading(true);
    setInviteLinkCopied(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "editor" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create invite link");
      const data = await res.json();
      const fullUrl = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(fullUrl);
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate invite link", variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  }, [projectId, toast]);

  const handleCopyInviteLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    });
  }, [inviteLink]);

  useEffect(() => {
    onJoinNotification((userName: string, action: "joined" | "left") => {
      toast({
        title: action === "joined" ? `${userName} joined` : `${userName} left`,
        description: action === "joined" ? "Collaborating on this project" : "No longer editing",
        duration: 3000,
      });
    });
  }, [onJoinNotification]);

  const activeYtext = useMemo(() => {
    if (!activeFileId || !collabConnected) return null;
    if (!isFileSynced(activeFileId)) return null;
    const doc = getFileDoc(activeFileId);
    return doc.ytext;
  }, [activeFileId, collabConnected, isFileSynced, getFileDoc]);

  useEffect(() => {
    if (!activeYtext || !activeFileId) return;
    const fileId = activeFileId;
    const observer = (event: Y.YTextEvent) => {
      const content = activeYtext.toString();
      setFileContents(prev => {
        if (prev[fileId] === content) return prev;
        return { ...prev, [fileId]: content };
      });
      const isLocal = event.transaction.origin !== "remote";
      if (isLocal) {
        autoSave(fileId, content);
      }
      if (previewPanelOpen) {
        clearTimeout(previewRefreshTimer.current);
        previewRefreshTimer.current = setTimeout(() => {
          const html = generateHtmlPreviewRef.current?.();
          if (html) setPreviewHtml(html);
        }, 500);
      }
    };
    activeYtext.observe(observer);
    return () => {
      activeYtext.unobserve(observer);
    };
  }, [activeYtext, activeFileId, autoSave, previewPanelOpen]);

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
    if (activeFileId && collabConnected) {
      const view = collabEditorRef.current?.view;
      const selection = view ? {
        anchor: view.state.selection.main.anchor,
        head: view.state.selection.main.head,
      } : null;
      collabSendAwareness(activeFileId, selection);
    }
  }, [activeFileId, collabConnected, collabSendAwareness]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.getAttribute?.("contenteditable") === "true";

      if (matchesCommand("save-file", e)) {
        e.preventDefault();
        if (activeFileId && fileContents[activeFileId] !== undefined) {
          saveMutation.mutate({ fileId: activeFileId, content: fileContents[activeFileId] });
        }
        return;
      }
      if (matchesCommand("search-files", e)) {
        e.preventDefault();
        togglePanel("search");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "f" && (activeFileId === SPECIAL_TABS.SHELL || bottomTab === "shell")) {
        e.preventDefault();
        setShellSearchOpen(true);
        return;
      }
      if (matchesCommand("toggle-sidebar", e)) {
        e.preventDefault();
        setSidebarOpen(prev => {
          const willOpen = !prev;
          if (willOpen) { setAiPanelOpen(false); setOpenPanelTabs([]); setActivePanelTab(null); }
          return willOpen;
        });
        return;
      }
      if (matchesCommand("version-control", e)) {
        e.preventDefault();
        togglePanel("git");
        return;
      }
      if (matchesCommand("command-palette-alt", e)) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (matchesCommand("command-palette-shift", e)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (matchesCommand("toggle-terminal", e) || matchesCommand("toggle-terminal-alt", e)) {
        e.preventDefault();
        setTerminalVisible((prev) => !prev);
        return;
      }
      if (matchesCommand("toggle-preview", e)) {
        e.preventDefault();
        setPreviewPanelOpen((prev) => !prev);
        return;
      }
      if (matchesCommand("run", e)) {
        e.preventDefault();
        if (isRunning) { /* stop handled by run button */ } else if (!runMutation.isPending) handleRun();
        return;
      }
      if (matchesCommand("run-alt", e)) {
        e.preventDefault();
        if (!isRunning && !runMutation.isPending) handleRun();
        return;
      }
      if (matchesCommand("search-replace", e) && !isInput) {
        e.preventDefault();
        openPanel("search");
        setShowReplace(true);
        return;
      }
      if (matchesCommand("command-palette", e)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (matchesCommand("close-tab", e) && !isInput) {
        e.preventDefault();
        if (activeFileId && !activeFileId.startsWith("__")) {
          const idx = openTabs.indexOf(activeFileId);
          setOpenTabs(prev => prev.filter(id => id !== activeFileId));
          if (idx > 0) setActiveFileId(openTabs[idx - 1]);
          else if (openTabs.length > 1) setActiveFileId(openTabs[1]);
          else setActiveFileId(null);
        }
        return;
      }
      if (matchesCommand("new-file", e) && !isInput) {
        e.preventDefault();
        setNewFileDialogOpen(true);
        return;
      }
      if (matchesCommand("keyboard-shortcuts", e)) {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
        return;
      }
      if (matchesCommand("toggle-ai", e)) {
        e.preventDefault();
        if (viewMode === "mobile") { setMobileTab("ai"); } else { setAiPanelOpen(prev => !prev); }
        return;
      }
      if (matchesCommand("new-folder", e) && !isInput) {
        e.preventDefault();
        setNewFolderDialogOpen(true);
        return;
      }
      if (matchesCommand("project-settings", e)) {
        e.preventDefault();
        setProjectSettingsOpen(true);
        return;
      }
      if (matchesCommand("split-editor", e)) {
        e.preventDefault();
        setSplitEditorFileId(prev => prev ? null : activeFileId);
        return;
      }
      if (matchesCommand("toggle-minimap", e)) {
        e.preventDefault();
        savePrefs({ minimap: !showMinimap });
        return;
      }
      if (e.key === "Escape" && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        const isInEditor = target.closest(".cm-editor");
        const isInTerminal = target.closest(".xterm") || target.closest("[data-testid='workspace-terminal']");
        const isInConsole = target.closest("[data-testid='console-panel']");
        if (isInEditor || isInTerminal || isInConsole) {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.blur?.();
          const main = document.querySelector("[data-testid='project-workspace']") as HTMLElement;
          if (main) main.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFileId, fileContents, searchPanelOpen, isRunning, togglePanel, openPanel, matchesCommand, viewMode]);

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
    broadcastPaneState({ type: "tab-opened", tabId: file.id });
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
    broadcastPaneState({ type: "tab-closed", tabId: fileId });
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
        fileName: activeFileName || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsRunning(true);
      if (data?.consoleRunId) {
        setCurrentConsoleRunId(data.consoleRunId);
      }
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

    const project = projectQuery.data as any;
    if (project?.selectedWorkflowId) {
      const timestamp = new Date().toLocaleTimeString();
      setLogs([{
        id: Date.now(),
        text: `\x1b[36m━━━ Workflow run started at ${timestamp} ━━━\x1b[0m`,
        type: "info",
      }]);
      setTerminalVisible(true);
      setBottomTab("terminal");
      runWorkflowMutation.mutate();
      return;
    }

    const isHtmlFile = activeFileName?.endsWith(".html");
    if (isHtmlFile) {
      const html = generateHtmlPreview();
      if (html) {
        setPreviewHtml(html);
        if (userPrefs.automaticPreview) {
          if (!isMobile) {
            setPreviewPanelOpen(true);
          } else {
            openSpecialTab(SPECIAL_TABS.WEBVIEW);
          }
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

  const handleStopExecution = useCallback(async () => {
    if (!projectId) return;
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      await fetch(`/api/projects/${projectId}/stop`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    } catch {}
  }, [projectId]);

  const [pendingAIMessage, setPendingAIMessage] = useState<string | null>(null);

  const autoPromptHandled = useRef(false);
  useEffect(() => {
    if (autoPromptHandled.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    const autoPrompt = urlParams.get("prompt");
    if (autoPrompt) {
      autoPromptHandled.current = true;
      setPendingAIMessage(autoPrompt);
      setAiPanelOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleAgentComplete = useCallback(() => {
    if (userPrefs.agentAudioNotification) playNotificationSound();
    if (userPrefs.agentPushNotification) sendPushNotification("AI Agent", "Your AI agent has finished responding.");
  }, [userPrefs.agentAudioNotification, userPrefs.agentPushNotification]);

  const canvasFramesQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/projects", projectId, "canvas", "frames"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/canvas/frames`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const handleConvertFrame = useCallback((frameId: string, frameName: string, targetType: string) => {
    const typeMap: Record<string, string> = { react: "web", web: "web", native: "mobile", mobile: "mobile", "react native": "mobile" };
    setConversionFrameId(frameId);
    setConversionFrameName(frameName);
    setConversionTargetType(typeMap[targetType.toLowerCase()] || targetType);
    setConversionDialogOpen(true);
  }, []);

  const handleCanvasFrameCreate = useCallback(async (htmlContent: string, name?: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas/frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() as string },
        credentials: "include",
        body: JSON.stringify({
          name: name || "AI Generated Frame",
          htmlContent,
          x: Math.round(Math.random() * 200),
          y: Math.round(Math.random() * 200),
          width: 500,
          height: 400,
          zIndex: 0,
        }),
      });
      if (res.ok) {
        toast({ title: "Frame Added", description: "Design frame has been added to the canvas." });
        setWorkspaceMode("canvas");
      }
    } catch (err) {
      console.error("Failed to create canvas frame:", err);
    }
  }, [projectId]);

  const handleAskAIFromConsole = useCallback((logContent: string) => {
    const message = `Please analyze these console logs and help me debug any issues:\n\n\`\`\`\n${logContent.slice(0, 4000)}\n\`\`\``;
    setPendingAIMessage(message);
    setAiPanelOpen(true);
    setSidebarOpen(false);
    setOpenPanelTabs([]);
    setActivePanelTab(null);
  }, []);

  useEffect(() => {
    hasAutoRun.current = false;
  }, [projectId]);

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

  const handleDownloadFile = useCallback((filename: string, content: string, file?: { isBinary?: boolean; mimeType?: string | null }) => {
    const safeName = filename.split("/").pop() || filename;
    const isDataUri = content.startsWith("data:") && content.includes(";base64,");
    if (isDataUri || file?.isBinary) {
      const a = document.createElement("a");
      a.href = content;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const blob = new Blob([content], { type: file?.mimeType || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
      if (project?.isPublished) {
        const res = await apiRequest("POST", `/api/projects/${projectId}/publish`);
        return res.json();
      }
      const secrets: Record<string, string> = {};
      for (const entry of deploySecretsEntries) {
        if (entry.key.trim()) secrets[entry.key.trim()] = entry.value;
      }
      const res = await apiRequest("POST", `/api/projects/${projectId}/deploy`, {
        deploymentType,
        buildCommand: deployBuildCommand || undefined,
        runCommand: deployRunCommand || undefined,
        machineConfig: (deploymentType === "autoscale" || deploymentType === "reserved-vm") ? { cpu: deployCpu, ram: deployRam } : undefined,
        maxMachines: deploymentType === "autoscale" ? deployMaxMachines : undefined,
        publicDirectory: deploymentType === "static" ? deployPublicDir : undefined,
        appType: deploymentType === "reserved-vm" ? deployAppType : undefined,
        portMapping: deploymentType === "reserved-vm" ? deployPortMapping : undefined,
        cronExpression: deploymentType === "scheduled" ? deployCronExpr : undefined,
        scheduleDescription: deploymentType === "scheduled" ? deployScheduleDesc : undefined,
        jobTimeout: deploymentType === "scheduled" ? deployJobTimeout : undefined,
        deploymentSecrets: Object.keys(secrets).length > 0 ? secrets : undefined,
        isPrivate: deployIsPrivate,
        showBadge: deployShowBadge,
        enableFeedback: deployEnableFeedback,
        createProductionDb: deployCreateProductionDb || undefined,
        seedProductionDb: deploySeedProductionDb || undefined,
      });
      const deployData = await res.json();
      if (deployData.deployment?.status === "failed") {
        throw new Error(deployData.deployment?.buildLog || "Deployment build failed");
      }
      return deployData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deployments"] });
      toast({ title: project?.isPublished ? "Project unpublished" : "Deployment successful" });
    },
    onError: (err: any) => {
      toast({ title: "Deploy failed", description: err.message || "Deployment failed. Please try again.", variant: "destructive" });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async (visibility: string) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/visibility`, { visibility });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (err: any) => { toast({ title: "Failed to update visibility", description: err.message, variant: "destructive" }); },
  });

  const guestsQuery = useQuery<ProjectGuest[]>({
    queryKey: ["/api/projects", projectId, "guests"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/guests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: project?.visibility === "private",
  });

  const inviteGuestMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/guests`, { email, role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "guests"] });
      toast({ title: "Guest invited" });
    },
    onError: (err: any) => { toast({ title: "Failed to invite guest", description: err.message, variant: "destructive" }); },
  });

  const removeGuestMutation = useMutation({
    mutationFn: async (guestId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/guests/${guestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "guests"] });
      toast({ title: "Guest removed" });
    },
    onError: (err: any) => { toast({ title: "Failed to remove guest", description: err.message, variant: "destructive" }); },
  });

  const deployProcessQuery = useQuery<{ process: { projectId: string; port: number; status: string; startedAt: string; restartCount: number; pid?: number; uptime?: number; healthStatus?: string; resourceLimits: { maxMemoryMB: number; maxCpuPercent: number }; resourceUsage: { cpuPercent: number; memoryMb: number } | null } | null; liveUrl: string | null }>({
    queryKey: ["/api/projects", projectId, "deploy", "process"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deploy/process`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load process status");
      return res.json();
    },
    enabled: !!projectId && deployPanelTab === "process",
    refetchInterval: deployPanelTab === "process" ? 5000 : false,
    retry: 1,
  });

  const stopProcessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/deploy/stop`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deploy", "process"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deployments"] });
      toast({ title: "Process stopped" });
    },
    onError: (err: any) => { toast({ title: "Stop failed", description: err.message, variant: "destructive" }); },
  });

  const restartProcessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/deploy/restart`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deploy", "process"] });
      toast({ title: "Process restarting" });
    },
    onError: (err: any) => { toast({ title: "Restart failed", description: err.message, variant: "destructive" }); },
  });

  const streamLogsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/deploy/stream-logs`);
      return res.json();
    },
  });

  useEffect(() => {
    if (deployPanelTab === "process" && projectId) {
      streamLogsMutation.mutate();
    }
  }, [deployPanelTab, projectId]);

  useEffect(() => {
    if (deployLogsEndRef.current) {
      deployLogsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [deployProcessLogs]);

  const deployAnalyticsQuery = useQuery<{ pageViews: number; uniqueVisitors: number; topReferrers: { referrer: string; count: number }[]; trafficByDay: { date: string; views: number }[] }>({
    queryKey: ["/api/projects", projectId, "deploy", "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deploy/analytics`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    enabled: !!projectId && deployPanelTab === "analytics",
    retry: 1,
  });

  const convertCronMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", `/api/deploy/schedule-to-cron`, { description });
      return res.json();
    },
    onSuccess: (data: any) => {
      setDeployCronExpr(data.cronExpression);
      toast({ title: "Schedule converted", description: `Cron: ${data.cronExpression}` });
    },
    onError: () => {
      toast({ title: "Conversion failed", variant: "destructive" });
    },
  });

  const deploySettingsMutation = useMutation({
    mutationFn: async (settings: { isPrivate?: boolean; showBadge?: boolean; enableFeedback?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/deploy/settings`, settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deployments"] });
      toast({ title: "Settings updated" });
    },
  });

  const frameworkPublishMutation = useMutation({
    mutationFn: async (data: { description?: string; category?: string; coverUrl?: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/publish-as-framework`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: "Published as Developer Framework" });
    },
    onError: (err: any) => {
      toast({ title: "Framework publish failed", description: err.message, variant: "destructive" });
    },
  });

  const frameworkUnpublishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/unpublish-framework`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: "Removed from frameworks catalog" });
    },
    onError: (err: any) => {
      toast({ title: "Unpublish failed", description: err.message, variant: "destructive" });
    },
  });

  const deploymentsQuery = useQuery<{ id: string; version: number; status: string; buildLog: string | null; url: string | null; createdAt: string; finishedAt: string | null; deploymentType?: string; isPrivate?: boolean; responseHeaders?: Array<{ path: string; name: string; value: string }>; rewrites?: Array<{ from: string; to: string }> }[]>({
    queryKey: ["/api/projects", projectId, "deployments"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deployments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load deployments");
      return res.json();
    },
    enabled: !!projectId,
    retry: 1,
  });

  const [expandedDeployId, setExpandedDeployId] = useState<string | null>(null);

  useEffect(() => {
    const deps = deploymentsQuery.data;
    if (deps && deps.length > 0) {
      const liveDep = deps.find(d => d.status === "live");
      if (liveDep) {
        if (liveDep.isPrivate !== undefined) setDeployIsPrivate(liveDep.isPrivate);
      }
    }
  }, [deploymentsQuery.data]);

  const rollbackMutation = useMutation({
    mutationFn: async (version: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/deploy/rollback`, { version });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "deployments"] });
      toast({ title: "Rollback successful", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" });
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const body: { message: string; branchName: string; files: string[] } = {
        message: commitMessage.trim(),
        branchName: currentBranch,
        files: Array.from(stagedFiles),
      };
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/commits`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      setCommitMessage("");
      setStagedFiles(new Set());
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
    mutationFn: async (visibility?: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/fork`, { visibility: visibility || "public" });
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

  const previewPortsQuery = useQuery<{ id: string; internalPort: number; externalPort: number; label: string; isPublic: boolean; proxyUrl: string | null }[]>({
    queryKey: ["/api/projects", projectId, "networking", "ports"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/networking/ports`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
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
    if (hasAutoRun.current) return;
    if (isRunning || runMutation.isPending) return;
    if (!workspaceStatusQuery.isFetched) return;
    const resolvedStatus = workspaceStatusQuery.data?.status;
    if (resolvedStatus === "running" || resolvedStatus === "starting") {
      hasAutoRun.current = true;
      return;
    }
    const filesReady = useRunnerFS || filesQuery.isSuccess;
    const projectLoaded = !!projectQuery.data;
    const editorReady = useRunnerFS || !!activeFileId;
    if (filesReady && projectLoaded && editorReady) {
      hasAutoRun.current = true;
      handleRun();
    }
  }, [filesQuery.isSuccess, projectQuery.data, isRunning, runMutation.isPending, useRunnerFS, workspaceStatusQuery.isFetched, workspaceStatusQuery.data, activeFileId]);

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
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;

      interface SessionResponse {
        sessionId: string;
        lastCommand: string;
        lastActivity: number;
        selected: boolean;
      }

      fetch(`/api/workspaces/${projectId}/terminal-sessions`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((data: { sessions: SessionResponse[] } | null) => {
          if (data?.sessions?.length) {
            const restored: ShellSession[] = data.sessions.map((s) => ({
              sessionId: s.sessionId,
              label: s.lastCommand || "Shell",
              wsUrl: `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(s.sessionId)}`,
            }));
            setShellSessions(restored);
            const selectedIdx = data.sessions.findIndex((s) => s.selected);
            if (selectedIdx >= 0) setActiveShellIndex(selectedIdx);
          } else {
            fetch(`/api/workspaces/${projectId}/terminal-url`, { credentials: "include" })
              .then((r) => {
                if (!r.ok) throw new Error("Failed to get terminal URL");
                return r.json();
              })
              .then((d) => {
                setShellSessions([{ sessionId: "default", label: "Shell", wsUrl: d.wsUrl }]);
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          fetch(`/api/workspaces/${projectId}/terminal-url`, { credentials: "include" })
            .then((r) => {
              if (!r.ok) throw new Error("Failed to get terminal URL");
              return r.json();
            })
            .then((d) => {
              setShellSessions([{ sessionId: "default", label: "Shell", wsUrl: d.wsUrl }]);
            })
            .catch(() => {});
        });
    }
  }, [projectId]);

  useEffect(() => {
    if (wsStatus === "running" && projectId && userPrefs.forwardPorts) {
      const previewPort = project?.projectType === "mobile-app" ? 8081 : undefined;
      const portParam = previewPort ? `?port=${previewPort}` : "";
      fetch(`/api/workspaces/${projectId}/preview-url${portParam}`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to get preview URL");
          return r.json();
        })
        .then((d) => {
          let url = d.previewUrl;
          const portsCfg = projectConfigQuery.data?.replit?.ports;
          if (url && portsCfg && portsCfg.length > 0) {
            const httpPort = portsCfg.find((p: { localPort: number; externalPort: number }) => p.externalPort === 80 || p.externalPort === 443);
            if (httpPort) {
              try {
                const parsed = new URL(url);
                if (parsed.port && Number(parsed.port) !== httpPort.localPort) {
                  parsed.port = String(httpPort.localPort);
                  url = parsed.toString();
                }
              } catch {}
            }
          }
          setLivePreviewUrl(url);
          setExpoGoUrl(d.expoGoUrl || null);
          if (url && userPrefs.automaticPreview) setPreviewPanelOpen(true);
        })
        .catch(() => { setLivePreviewUrl(null); setExpoGoUrl(null); });
    } else if (!userPrefs.forwardPorts) {
      setLivePreviewUrl(null);
      setExpoGoUrl(null);
    } else {
      setLivePreviewUrl(null);
      setExpoGoUrl(null);
    }
  }, [wsStatus, projectId, userPrefs.forwardPorts, projectConfigQuery.data, project?.projectType]);

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

  const isMobileProject = useMemo(() => {
    if (project?.projectType === "mobile-app") return true;
    if ((project as any)?.outputType === "mobile") return true;
    const fileList = filesQuery.data;
    if (!fileList) return false;
    return isMobileAppProject(fileList.map(f => ({ filename: f.filename, content: f.content })));
  }, [project?.projectType, (project as any)?.outputType, filesQuery.data]);
  const isAnimationProject = (project as any)?.outputType === "animation" || project?.projectType === "animation";
  const isSlideProject = project?.projectType === "slides" || (project as any)?.outputType === "slides";
  const isDataVizProject = (project as any)?.outputType === "data-visualization";
  const is3DGameProject = (project as any)?.outputType === "3d-game";
  const isVideoProject = project?.projectType === "video";
  const isMediaProject = isSlideProject || isVideoProject;
  const activeIsSpecial = activeFileId ? isSpecialTab(activeFileId) : false;
  const isRunnerTab = !activeIsSpecial && activeFileId?.startsWith("runner:");
  const activeFile = (isRunnerTab || activeIsSpecial) ? null : filesQuery.data?.find((f) => f.id === activeFileId);
  const activeFileName = activeIsSpecial ? "" : isRunnerTab ? (activeFileId!.slice(7).split("/").pop() || "") : (activeFile?.filename || "");
  const activeFileIsBinary = activeFile?.isBinary || (activeFile?.content?.startsWith("data:") && activeFile?.content?.includes(";base64,"));
  const currentCode = (activeFileId && !activeIsSpecial && !activeFileIsBinary) ? fileContents[activeFileId] ?? "" : "";
  const editorLanguage = activeFileName ? detectLanguage(activeFileName) : "javascript";

  const lspClientsRef = useRef<Map<LSPLanguage, LSPClient>>(new Map());
  const [activeLspClient, setActiveLspClient] = useState<LSPClient | null>(null);
  const [lspConnected, setLspConnected] = useState(false);
  const lspClientRef = useRef<LSPClient | null>(null);

  const activeLspLang = useMemo<LSPLanguage | null>(() => {
    return activeFileName ? detectLSPLanguage(activeFileName) : null;
  }, [activeFileName]);

  useEffect(() => {
    if (!projectId) return;

    return () => {
      for (const client of lspClientsRef.current.values()) {
        client.disconnect();
      }
      lspClientsRef.current.clear();
      setActiveLspClient(null);
      lspClientRef.current = null;
      setLspConnected(false);
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !activeLspLang) {
      setActiveLspClient(null);
      lspClientRef.current = null;
      setLspConnected(false);
      return;
    }

    const existingClient = lspClientsRef.current.get(activeLspLang);
    if (existingClient && existingClient.isConnected()) {
      setActiveLspClient(existingClient);
      lspClientRef.current = existingClient;
      setLspConnected(true);
      return;
    }

    const client = new LSPClient(projectId, activeLspLang);
    lspClientsRef.current.set(activeLspLang, client);
    setActiveLspClient(client);
    lspClientRef.current = client;

    const unsubConn = client.onConnectionChange((connected) => {
      if (lspClientRef.current === client) {
        setLspConnected(connected);
      }
    });

    client.connect();

    return () => {
      unsubConn();
    };
  }, [projectId, activeLspLang]);

  const handleGoToDefinition = useCallback((uri: string, line: number, character: number) => {
    let filename = uri;
    if (filename.startsWith("file://")) {
      filename = filename.replace("file://", "");
      const projectRoot = `/home/runner/workspace/`;
      if (filename.startsWith(projectRoot)) {
        filename = filename.slice(projectRoot.length);
      } else {
        filename = filename.replace(/^\/+/, "");
      }
    }
    const file = filesQuery.data?.find(f => f.filename === filename);
    if (file) {
      if (!openTabs.includes(file.id)) {
        setOpenTabs(prev => [...prev, file.id]);
      }
      setActiveFileId(file.id);
      expandParentFolders(file.filename);

      setTimeout(() => {
        const editorView = collabEditorRef.current?.view;
        if (editorView) {
          const targetLine = Math.min(line + 1, (editorView.state.doc as any).lines);
          const lineObj = (editorView.state.doc as any).line(targetLine);
          const pos = lineObj.from + Math.min(character, lineObj.text.length);
          (editorView as any).dispatch({
            selection: { anchor: pos },
            scrollIntoView: true,
          });
          (editorView as any).focus();
        }
      }, 200);
    }
  }, [filesQuery.data, openTabs]);

  const [referencesResults, setReferencesResults] = useState<Array<{ uri: string; line: number; character: number; filename: string }>>([]);
  const [referencesOpen, setReferencesOpen] = useState(false);

  const handleFindReferences = useCallback(async (uri: string, line: number, character: number) => {
    const client = lspClientRef.current;
    if (!client || !client.isReady()) return;

    try {
      const locations = await client.references(uri, line, character);
      const projectRoot = `/home/runner/workspace/`;
      const results = locations.map(loc => {
        let fname = loc.uri;
        if (fname.startsWith("file://")) {
          fname = fname.replace("file://", "");
          if (fname.startsWith(projectRoot)) {
            fname = fname.slice(projectRoot.length);
          } else {
            fname = fname.replace(/^\/+/, "");
          }
        }
        return {
          uri: loc.uri,
          line: loc.range.start.line,
          character: loc.range.start.character,
          filename: fname,
        };
      });
      setReferencesResults(results);
      setReferencesOpen(true);
      setBottomTab("references");
      setTerminalVisible(true);
    } catch {}
  }, []);

  const handleRenameSymbol = useCallback(async (uri: string, line: number, character: number) => {
    const newName = window.prompt("New name:");
    if (!newName) return;

    const client = lspClientRef.current;
    if (!client || !client.isReady()) return;

    try {
      const result = await client.rename(uri, line, character, newName);
      if (!result) return;

      const projectRoot = `/home/runner/workspace/`;
      const resolveFilename = (u: string) => {
        let f = u;
        if (f.startsWith("file://")) {
          f = f.replace("file://", "");
          if (f.startsWith(projectRoot)) f = f.slice(projectRoot.length);
          else f = f.replace(/^\/+/, "");
        }
        return f;
      };

      interface LSPTextEdit {
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        newText: string;
      }
      const touchedFiles: Array<{ id: string; content: string }> = [];
      const applyEditsToFile = (fileUri: string, edits: LSPTextEdit[]) => {
        const fname = resolveFilename(fileUri);
        const file = filesQuery.data?.find(f => f.filename === fname);
        if (!file) return;

        let content = fileContents[file.id] ?? file.content ?? "";
        const sortedEdits = [...edits].sort((a, b) => {
          if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line;
          return b.range.start.character - a.range.start.character;
        });

        const lines = content.split("\n");
        for (const edit of sortedEdits) {
          const startLine = Math.min(edit.range.start.line, lines.length - 1);
          const endLine = Math.min(edit.range.end.line, lines.length - 1);
          const startChar = edit.range.start.character;
          const endChar = edit.range.end.character;

          if (startLine === endLine) {
            const l = lines[startLine];
            lines[startLine] = l.substring(0, startChar) + edit.newText + l.substring(endChar);
          } else {
            const prefix = lines[startLine].substring(0, startChar);
            const suffix = lines[endLine].substring(endChar);
            const newTextLines = edit.newText.split("\n");
            newTextLines[0] = prefix + newTextLines[0];
            newTextLines[newTextLines.length - 1] = newTextLines[newTextLines.length - 1] + suffix;
            lines.splice(startLine, endLine - startLine + 1, ...newTextLines);
          }
        }

        const newContent = lines.join("\n");
        setFileContents(prev => ({ ...prev, [file.id]: newContent }));
        setDirtyFiles(prev => new Set(prev).add(file.id));
        touchedFiles.push({ id: file.id, content: newContent });
      };

      if (result.changes) {
        for (const [fileUri, edits] of Object.entries(result.changes)) {
          applyEditsToFile(fileUri, edits as LSPTextEdit[]);
        }
      }

      if (result.documentChanges) {
        for (const docChange of result.documentChanges) {
          const dc = docChange as { textDocument?: { uri: string }; edits?: LSPTextEdit[] };
          if (dc.textDocument && dc.edits) {
            applyEditsToFile(dc.textDocument.uri, dc.edits);
          }
        }
      }

      for (const touched of touchedFiles) {
        saveMutation.mutate({ fileId: touched.id, content: touched.content });
      }
    } catch (err) {
      console.error("[LSP] Rename failed:", err);
    }
  }, [filesQuery.data, fileContents, projectId]);

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

  const isMobile = viewMode === "mobile";
  const isTablet = viewMode === "tablet";
  const { hasExternalKeyboard, isTabletDevice } = useExternalKeyboardDetection();
  const [keyboardModePromptOpen, setKeyboardModePromptOpen] = useState(false);
  const keyboardPromptShownRef = useRef(false);
  const keyboardReminderShownRef = useRef(false);
  const isOnTabletDevice = isTablet || (viewMode === "desktop" && isTabletDevice());
  const isKeyboardModeActive = isOnTabletDevice && userPrefs.keyboardMode && hasExternalKeyboard;

  useEffect(() => {
    if (
      hasExternalKeyboard &&
      isOnTabletDevice &&
      !userPrefs.keyboardMode &&
      !userPrefs.keyboardModePromptDismissed &&
      prefsLoaded &&
      !keyboardPromptShownRef.current
    ) {
      keyboardPromptShownRef.current = true;
      setKeyboardModePromptOpen(true);
    }
  }, [hasExternalKeyboard, isOnTabletDevice, userPrefs.keyboardMode, userPrefs.keyboardModePromptDismissed, prefsLoaded]);

  useEffect(() => {
    if (
      hasExternalKeyboard &&
      isOnTabletDevice &&
      !userPrefs.keyboardMode &&
      userPrefs.keyboardModePromptDismissed &&
      prefsLoaded &&
      !keyboardReminderShownRef.current
    ) {
      keyboardReminderShownRef.current = true;
      toast({ title: "External keyboard detected", description: "Enable Keyboard Mode in Settings for a desktop-like experience." });
    }
  }, [hasExternalKeyboard, isOnTabletDevice, userPrefs.keyboardMode, userPrefs.keyboardModePromptDismissed, prefsLoaded]);

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
          {hiddenPatterns.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={`w-6 h-6 rounded transition-colors duration-150 ${showHiddenFiles ? "text-[var(--ide-accent)] bg-[var(--ide-surface)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`}
              onClick={() => setShowHiddenFiles(!showHiddenFiles)}
              data-testid="button-toggle-hidden-files"
              title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
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
                  <ContextMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5" onClick={() => openFileHistory(entry.path)} data-testid={`context-file-history-${entryId}`}>
                    <Clock className="w-3 h-3" /> View File History
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
              const filteredFiles = showHiddenFiles ? (filesQuery.data || []) : (filesQuery.data || []).filter(f => {
                if (hiddenPatterns.length === 0) return true;
                return !hiddenPatterns.some(pattern => {
                  if (pattern.includes("*")) {
                    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
                    return regex.test(f.filename) || f.filename.split("/").some(part => regex.test(part));
                  }
                  return f.filename === pattern || f.filename.startsWith(pattern + "/") || f.filename.split("/").includes(pattern);
                });
              });
              const tree = buildFileTree(filteredFiles);
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
                  <ContextMenuItem
                    className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => openFileHistory(file.filename)}
                    data-testid={`ctx-history-${file.id}`}
                  >
                    <Clock className="w-3 h-3" /> View File History
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
                    onClick={() => handleDownloadFile(file.filename, fileContents[file.id] ?? file.content, file)}
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
                      {isExpanded && (
                        <div className="file-tree-indent" style={{ '--indent-left': `${14 + depth * 12}px` } as React.CSSProperties}>
                          {node.children.map((child) => renderNode(child, depth + 1))}
                        </div>
                      )}
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
                        <span className={`flex-1 text-[12px] truncate ${gitChangedFilenames.has(file.filename) ? "text-[#0CCE6B]" : ""}`}>{node.name}</span>
                        {file.filename === "ecode.md" && <span className="text-[8px] px-1 py-0.5 rounded bg-[#7C65CB]/15 text-[#7C65CB] font-semibold shrink-0" data-testid="badge-ecode-file">Config</span>}
                        {dirtyFiles.has(file.id) && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                        {gitChangedFilenames.has(file.filename) && <div className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] shrink-0" data-testid={`git-status-${file.id}`} />}
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
                            <DropdownMenuItem className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md" onClick={() => openFileHistory(file.filename)} data-testid={`dropdown-history-${file.id}`}>
                              <Clock className="w-3 h-3" /> File History
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
    if (tabId === SPECIAL_TABS.CONFIG) return { name: "Config", icon: <Settings className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" /> };
    if (tabId.startsWith(CONFLICT_TAB_PREFIX)) return { name: `⚠ ${tabId.slice(CONFLICT_TAB_PREFIX.length)}`, icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" /> };
    return null;
  };

  useEffect(() => {
    paneLayout.syncTabsToLayout(openTabs, activeFileId);
  }, [openTabs, activeFileId]);

  const layoutRestoredRef = useRef(false);
  useEffect(() => {
    if (projectId) {
      const localSaved = loadPaneLayout(projectId);
      if (localSaved) {
        paneLayout.setLayout(localSaved);
        const tabs: string[] = [];
        getAllLayoutTabs(localSaved.root, tabs);
        localSaved.floatingPanes.forEach(fp => fp.tabs.forEach(t => tabs.push(t)));
        const uniqueTabs = Array.from(new Set(tabs));
        if (uniqueTabs.length > 0) {
          setOpenTabs(uniqueTabs);
          layoutRestoredRef.current = true;
          _layoutRestoredFlags.set(_layoutKey, true);
          const activeLeaf = getPaneLeaves(localSaved.root).find(p => p.id === localSaved.activePaneId);
          if (activeLeaf?.activeTab) setActiveFileId(activeLeaf.activeTab);
          else setActiveFileId(uniqueTabs[0]);
        }
      }
      loadPaneLayoutFromServer(projectId).then(serverSaved => {
        if (serverSaved) {
          paneLayout.setLayout(serverSaved);
          savePaneLayout(projectId, serverSaved);
          const tabs: string[] = [];
          getAllLayoutTabs(serverSaved.root, tabs);
          serverSaved.floatingPanes.forEach(fp => fp.tabs.forEach(t => tabs.push(t)));
          const uniqueTabs = Array.from(new Set(tabs));
          if (uniqueTabs.length > 0) {
            setOpenTabs(uniqueTabs);
            layoutRestoredRef.current = true;
            _layoutRestoredFlags.set(_layoutKey, true);
            const activeLeaf = getPaneLeaves(serverSaved.root).find(p => p.id === serverSaved.activePaneId);
            if (activeLeaf?.activeTab) setActiveFileId(activeLeaf.activeTab);
            else setActiveFileId(uniqueTabs[0]);
          }
        }
      });
    }
    return () => {
      _layoutRestoredFlags.delete(_layoutKey);
    };
  }, [projectId]);

  const layoutBroadcastRef = useRef(false);
  const suppressBroadcastRef = useRef(false);
  const paneSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (projectId) {
      savePaneLayout(projectId, paneLayout.layout);
      if (paneSaveTimerRef.current) clearTimeout(paneSaveTimerRef.current);
      paneSaveTimerRef.current = setTimeout(() => {
        savePaneLayoutToServer(projectId, paneLayout.layout);
      }, 2000);
      if (layoutBroadcastRef.current && !suppressBroadcastRef.current) {
        broadcastPaneState({ type: "layout-sync", layout: paneLayout.layout });
      }
      suppressBroadcastRef.current = false;
      layoutBroadcastRef.current = true;
    }
  }, [paneLayout.layout, projectId]);

  useEffect(() => {
    return onPaneBroadcast((msg: PaneBroadcastMessage) => {
      if (msg.type === "tab-opened") {
        if (!openTabs.includes(msg.tabId)) {
          setOpenTabs(prev => [...prev, msg.tabId]);
        }
      }
      if (msg.type === "tab-closed") {
        setOpenTabs(prev => prev.filter(t => t !== msg.tabId));
      }
      if (msg.type === "layout-sync") {
        suppressBroadcastRef.current = true;
        paneLayout.setLayout(msg.layout);
        const layoutTabs: string[] = [];
        getAllLayoutTabs(msg.layout.root, layoutTabs);
        msg.layout.floatingPanes.forEach(fp => fp.tabs.forEach(t => layoutTabs.push(t)));
        const uniqueTabs = Array.from(new Set(layoutTabs));
        setOpenTabs(uniqueTabs);
        if (uniqueTabs.length > 0 && (!activeFileId || !uniqueTabs.includes(activeFileId))) {
          setActiveFileId(uniqueTabs[0]);
        }
      }
    });
  }, [onPaneBroadcast, openTabs, activeFileId]);

  const allLeafPanes = useMemo(() => getPaneLeaves(paneLayout.layout.root), [paneLayout.layout.root]);
  const isMultiPane = allLeafPanes.length > 1;

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
                    <ContextMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => { const f = filesQuery.data?.find(ff => ff.id === tabId); if (f) openFileHistory(f.filename); }} data-testid={`context-history-${tabId}`}>
                      <Clock className="w-3.5 h-3.5" /> File History
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-full px-2 border-l border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors duration-150 shrink-0"
            data-testid="button-tab-bar-add-panel"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]" align="end">
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={() => openSpecialTab(SPECIAL_TABS.CONSOLE)}
            data-testid="menu-open-console-tab"
          >
            <Terminal className="w-3.5 h-3.5 text-[#F5A623]" /> Console
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={() => openSpecialTab(SPECIAL_TABS.SHELL)}
            data-testid="menu-open-shell-tab"
          >
            <Hash className="w-3.5 h-3.5 text-[#0CCE6B]" /> Shell
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={() => openSpecialTab(SPECIAL_TABS.WEBVIEW)}
            data-testid="menu-open-webview-tab"
          >
            <Monitor className="w-3.5 h-3.5 text-[#0079F2]" /> Webview
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={() => openSpecialTab(SPECIAL_TABS.CONFIG)}
            data-testid="menu-open-config-tab"
          >
            <Settings className="w-3.5 h-3.5 text-[#F5A623]" /> Config
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
          <DropdownMenuItem
            className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer"
            onClick={() => setNewFileDialogOpen(true)}
            data-testid="menu-new-file-tab"
          >
            <FilePlus className="w-3.5 h-3.5" /> New File
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-full px-2.5 border-l border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors duration-150 shrink-0"
            data-testid="button-mobile-new-tab-empty"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]" align="end">
          <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => openSpecialTab(SPECIAL_TABS.CONSOLE)} data-testid="menu-empty-open-console">
            <Terminal className="w-3.5 h-3.5 text-[#F5A623]" /> Console
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => openSpecialTab(SPECIAL_TABS.SHELL)} data-testid="menu-empty-open-shell">
            <Hash className="w-3.5 h-3.5 text-[#0CCE6B]" /> Shell
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => openSpecialTab(SPECIAL_TABS.WEBVIEW)} data-testid="menu-empty-open-webview">
            <Monitor className="w-3.5 h-3.5 text-[#0079F2]" /> Webview
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
          <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setNewFileDialogOpen(true)} data-testid="menu-empty-new-file">
            <FilePlus className="w-3.5 h-3.5" /> New File
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
          onClick={() => { const iframe = document.getElementById("webview-tab-iframe") as HTMLIFrameElement; if (iframe?.contentWindow) { iframe.contentWindow.history.back(); } }}
          title="Back" data-testid="button-webview-tab-back"><ArrowLeft className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0"
          onClick={() => { const iframe = document.getElementById("webview-tab-iframe") as HTMLIFrameElement; if (iframe?.contentWindow) { iframe.contentWindow.history.forward(); } }}
          title="Forward" data-testid="button-webview-tab-forward"><ArrowRight className="w-3 h-3" /></Button>
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
          <form className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70" onSubmit={(e) => {
            e.preventDefault();
            if (webviewUrlInput.trim()) {
              const url = webviewUrlInput.startsWith("http://") || webviewUrlInput.startsWith("https://") ? webviewUrlInput : `https://${webviewUrlInput}`;
              const iframe = document.getElementById("webview-tab-iframe") as HTMLIFrameElement;
              if (iframe) iframe.src = url;
            }
          }}>
            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
            <input
              className="flex-1 bg-transparent text-[10px] text-[var(--ide-text-secondary)] font-mono outline-none placeholder:text-[var(--ide-text-muted)] min-w-0 cursor-pointer"
              value={webviewUrlInput || (livePreviewUrl ? (devUrl || livePreviewUrl) : (previewHtml ? "HTML Preview" : "localhost:3000"))}
              onChange={(e) => setWebviewUrlInput(e.target.value)}
              onFocus={() => setWebviewUrlInput(livePreviewUrl || "")}
              onBlur={() => { if (!webviewUrlInput.trim()) setWebviewUrlInput(""); }}
              onClick={() => { if (devUrl && livePreviewUrl && !webviewUrlInput) { navigator.clipboard.writeText(fullDevUrl || ""); toast({ title: "Development URL copied" }); } }}
              data-testid="input-webview-tab-url"
            />
          </form>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(previewPortsQuery.data?.length ?? 0) > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] font-mono text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] gap-1 rounded" data-testid="button-preview-port-selector">
                  <Wifi className="w-2.5 h-2.5" />
                  {selectedPreviewPort ? `:${selectedPreviewPort}` : "Ports"}
                  <ChevronDown className="w-2 h-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[140px]" align="end">
                {previewPortsQuery.data?.map((p) => (
                  <DropdownMenuItem key={p.id} className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer font-mono"
                    onClick={() => {
                      setSelectedPreviewPort(p.externalPort);
                      if (p.proxyUrl) {
                        const iframe = document.getElementById("webview-tab-iframe") as HTMLIFrameElement;
                        if (iframe) iframe.src = `${window.location.origin}${p.proxyUrl}`;
                      }
                    }}
                    data-testid={`preview-port-option-${p.externalPort}`}
                  >
                    <span className={selectedPreviewPort === p.externalPort ? "text-blue-400" : ""}>
                      :{p.internalPort} → :{p.externalPort}
                    </span>
                    <span className="text-[var(--ide-text-muted)] text-[9px] ml-auto">{p.label || ""}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isAnimationProject && (
            <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-[9px] font-medium text-[#7C65CB] hover:text-[#7C65CB] hover:bg-[#7C65CB]/10 rounded"
              onClick={() => setAnimationExportOpen(true)}
              title="Export animation as MP4" data-testid="button-animation-export-toolbar">
              <Download className="w-2.5 h-2.5" /> Export MP4
            </Button>
          )}
          <DevicePresetSelector selectedPreset={selectedDevicePreset} onSelect={handleDevicePresetSelect} projectId={projectId} customWidth={customDeviceWidth} customHeight={customDeviceHeight} onCustomSizeChange={(w, h) => { setCustomDeviceWidth(w); setCustomDeviceHeight(h); }} />
          <DevToolsToggle active={devToolsActive} onToggle={() => setDevToolsActive(!devToolsActive)} />
          <Button variant="ghost" size="icon" className={`w-6 h-6 rounded shrink-0 transition-colors ${visualEditorActive && visualEditorIframeId === "webview-tab-iframe" ? "text-[#7C65CB] bg-[#7C65CB]/15 hover:bg-[#7C65CB]/25" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`}
            onClick={() => handleVisualEditorToggle("webview-tab-iframe")}
            title={visualEditorActive ? "Disable Visual Editor" : "Enable Visual Editor — click elements to edit"}
            data-testid="button-visual-editor-webview"><MousePointer2 className="w-3 h-3" /></Button>
          {livePreviewUrl && (
            <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
              onClick={() => window.open(fullDevUrl || livePreviewUrl, "_blank")}
              title="Open in new tab" data-testid="button-webview-tab-newtab"><ExternalLink className="w-3 h-3" /></Button>
          )}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {isMobileProject ? (
            <MobilePreview previewUrl={wsStatus === "running" && livePreviewUrl ? (effectivePreviewUrl || livePreviewUrl) : null} previewHtml={previewHtml} projectName={project?.name} expoGoUrl={expoGoUrl} />
          ) : (
            <DeviceFrame selectedPreset={selectedDevicePreset} customWidth={customDeviceWidth} customHeight={customDeviceHeight}>
              <div className="relative w-full h-full">
                {wsStatus === "running" && livePreviewUrl ? (
                  <iframe id="webview-tab-iframe" src={effectivePreviewUrl!} className="w-full h-full border-0 bg-white dark:bg-white" title="Live Preview" loading="lazy" data-testid="iframe-webview-tab" />
                ) : previewHtml ? (
                  <iframe id="webview-tab-iframe" srcDoc={injectErudaIntoHtml(previewHtml!, devToolsActive)} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-webview-tab-html" />
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
                {isSlideProject && (previewHtml || livePreviewUrl) && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-10" data-testid="overlay-slides-nav">
                    <button
                      onClick={() => {
                        const iframe = (document.getElementById("webview-tab-iframe") || document.querySelector("[data-testid='iframe-webview-tab-html']")) as HTMLIFrameElement;
                        try { iframe?.contentWindow?.postMessage({ type: "navigate", direction: "prev" }, "*"); } catch {}
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      data-testid="button-slide-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-white/70 font-medium px-1" data-testid="text-slide-indicator">Slide Nav</span>
                    <button
                      onClick={() => {
                        const iframe = (document.getElementById("webview-tab-iframe") || document.querySelector("[data-testid='iframe-webview-tab-html']")) as HTMLIFrameElement;
                        try { iframe?.contentWindow?.postMessage({ type: "navigate", direction: "next" }, "*"); } catch {}
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      data-testid="button-slide-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const iframe = (document.getElementById("webview-tab-iframe") || document.querySelector("[data-testid='iframe-webview-tab-html']")) as HTMLIFrameElement;
                        try { iframe?.contentWindow?.postMessage({ type: "fullscreen" }, "*"); } catch {}
                        try { iframe?.requestFullscreen?.(); } catch {}
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors ml-1"
                      data-testid="button-slide-fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {isDataVizProject && (previewHtml || livePreviewUrl) && (
                  <div className="absolute top-3 right-3 z-10" data-testid="overlay-dataviz">
                    <button
                      onClick={() => {
                        const iframe = (document.getElementById("webview-tab-iframe") || document.querySelector("[data-testid='iframe-webview-tab-html']")) as HTMLIFrameElement;
                        try { iframe?.requestFullscreen?.(); } catch {}
                      }}
                      className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/80 hover:text-white rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors"
                      data-testid="button-dataviz-fullscreen"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Full Dashboard
                    </button>
                  </div>
                )}
                {is3DGameProject && (previewHtml || livePreviewUrl) && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5" data-testid="overlay-3dgame">
                    <button
                      onClick={() => {
                        const iframe = (document.getElementById("webview-tab-iframe") || document.querySelector("[data-testid='iframe-webview-tab-html']")) as HTMLIFrameElement;
                        try { iframe?.contentWindow?.postMessage({ type: "game-toggle-pause" }, "*"); } catch {}
                      }}
                      className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/80 hover:text-white rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors"
                      data-testid="button-game-playpause"
                    >
                      <Play className="w-3 h-3" />
                      Play / Pause
                    </button>
                    <button
                      onClick={() => {
                        const iframe = (document.getElementById("webview-tab-iframe") || document.querySelector("[data-testid='iframe-webview-tab-html']")) as HTMLIFrameElement;
                        try { iframe?.requestFullscreen?.(); } catch {}
                      }}
                      className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/80 hover:text-white rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors"
                      data-testid="button-game-fullscreen"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </DeviceFrame>
          )}
        </div>
        {visualEditorActive && visualEditorIframeId === "webview-tab-iframe" && (
          <div className="w-[280px] shrink-0 border-l border-[var(--ide-border)] overflow-hidden" data-testid="visual-editor-webview-panel">
            <VisualEditorPanel
              element={selectedVEElement}
              onClose={() => { setVisualEditorActive(false); deactivateVisualEditor("webview-tab-iframe"); setSelectedVEElement(null); }}
              onApplyEdit={handleVisualEditApply}
              onJumpToSource={handleJumpToSource}
              onAIHandoff={handleAIHandoff}
              iframeId="webview-tab-iframe"
            />
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

  const handleNewShell = useCallback(() => {
    if (!projectId) return;
    const newSessionId = `shell-${Date.now()}`;
    fetch(`/api/workspaces/${projectId}/terminal-sessions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: newSessionId }),
    })
      .then((r) => r.json())
      .then((d) => {
        const newSession: ShellSession = { sessionId: d.sessionId, label: "Shell", wsUrl: d.wsUrl };
        setShellSessions((prev) => {
          const updated = [...prev, newSession];
          setActiveShellIndex(updated.length - 1);
          return updated;
        });
        setShellDropdownOpen(false);
      })
      .catch(() => {});
  }, [projectId, shellSessions.length]);

  const handleCloseShell = useCallback((index: number) => {
    if (shellSessions.length <= 1) return;
    const session = shellSessions[index];
    if (projectId && session.sessionId !== "default") {
      fetch(`/api/workspaces/${projectId}/terminal-sessions/${session.sessionId}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
    }
    shellTerminalRefs.current.delete(session.sessionId);
    const newSessions = shellSessions.filter((_, i) => i !== index);
    setShellSessions(newSessions);
    if (activeShellIndex === index) {
      setActiveShellIndex(Math.min(index, newSessions.length - 1));
    } else if (activeShellIndex > index) {
      setActiveShellIndex(activeShellIndex - 1);
    }
  }, [shellSessions, activeShellIndex, projectId]);

  const handleShellLastCommand = useCallback((sessionId: string, command: string) => {
    setShellSessions((prev) =>
      prev.map((s) => (s.sessionId === sessionId ? { ...s, label: command.length > 20 ? command.slice(0, 20) + "…" : command } : s))
    );
  }, []);

  const handleShellSearchNext = useCallback(() => {
    if (!shellSearchQuery) return;
    const session = shellSessions[activeShellIndex];
    if (session) {
      shellTerminalRefs.current.get(session.sessionId)?.searchNext(shellSearchQuery);
    }
  }, [shellSearchQuery, shellSessions, activeShellIndex]);

  const handleShellSearchPrev = useCallback(() => {
    if (!shellSearchQuery) return;
    const session = shellSessions[activeShellIndex];
    if (session) {
      shellTerminalRefs.current.get(session.sessionId)?.searchPrevious(shellSearchQuery);
    }
  }, [shellSearchQuery, shellSessions, activeShellIndex]);

  const handleShellSearchClose = useCallback(() => {
    setShellSearchOpen(false);
    setShellSearchQuery("");
    const session = shellSessions[activeShellIndex];
    if (session) {
      shellTerminalRefs.current.get(session.sessionId)?.clearSearch();
    }
  }, [shellSessions, activeShellIndex]);

  useEffect(() => {
    const session = shellSessions[activeShellIndex];
    if (session && projectId) {
      fetch(`/api/workspaces/${projectId}/terminal-sessions/${encodeURIComponent(session.sessionId)}/select`, {
        method: "PUT",
        credentials: "include",
      }).catch(() => {});
    }
  }, [activeShellIndex, shellSessions, projectId]);

  useEffect(() => {
    if (shellSearchOpen && shellSearchInputRef.current) {
      shellSearchInputRef.current.focus();
    }
  }, [shellSearchOpen]);

  const shellSearchBar = shellSearchOpen ? (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0" data-testid="shell-search-bar">
      <Search className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
      <input
        ref={shellSearchInputRef}
        type="text"
        className="flex-1 min-w-0 bg-transparent text-[11px] text-[var(--ide-text)] outline-none placeholder:text-[var(--ide-text-muted)]"
        placeholder="Search terminal..."
        value={shellSearchQuery}
        onChange={(e) => {
          setShellSearchQuery(e.target.value);
          if (e.target.value) {
            const session = shellSessions[activeShellIndex];
            if (session) shellTerminalRefs.current.get(session.sessionId)?.searchNext(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) handleShellSearchPrev();
            else handleShellSearchNext();
          }
          if (e.key === "Escape") handleShellSearchClose();
        }}
        data-testid="shell-search-input"
      />
      <button onClick={handleShellSearchPrev} className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" title="Previous" data-testid="shell-search-prev">
        <ChevronUp className="w-3 h-3" />
      </button>
      <button onClick={handleShellSearchNext} className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" title="Next" data-testid="shell-search-next">
        <ChevronDown className="w-3 h-3" />
      </button>
      <button onClick={handleShellSearchClose} className="p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" title="Close" data-testid="shell-search-close">
        <X className="w-3 h-3" />
      </button>
    </div>
  ) : null;

  const shellTabContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      <div className="flex items-center justify-between px-2 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-1 relative">
          <button
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[var(--ide-surface)] transition-colors text-[11px] text-[var(--ide-text-secondary)] font-medium"
            onClick={() => setShellDropdownOpen(!shellDropdownOpen)}
            data-testid="shell-dropdown-toggle"
          >
            <Hash className="w-3 h-3 text-[#0CCE6B]" />
            <span className="truncate max-w-[120px]">{shellSessions[activeShellIndex]?.label || "Shell"}</span>
            {wsStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
            <ChevronDown className="w-3 h-3" />
          </button>
          {shellDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShellDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-md shadow-lg min-w-[180px] py-1" data-testid="shell-dropdown-menu">
                {shellSessions.map((s, i) => (
                  <div
                    key={s.sessionId}
                    className={`flex items-center gap-2 px-3 py-1.5 text-[11px] cursor-pointer hover:bg-[var(--ide-surface)] ${i === activeShellIndex ? "text-[var(--ide-text)] bg-[var(--ide-surface)]" : "text-[var(--ide-text-secondary)]"}`}
                    onClick={() => { setActiveShellIndex(i); setShellDropdownOpen(false); }}
                    data-testid={`shell-session-${s.sessionId}`}
                  >
                    <Hash className="w-3 h-3 text-[#0CCE6B]" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {i === activeShellIndex && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />}
                    {shellSessions.length > 1 && (
                      <button
                        className="p-0.5 rounded hover:bg-red-500/20 text-[var(--ide-text-muted)] hover:text-red-400 shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleCloseShell(i); setShellDropdownOpen(false); }}
                        data-testid={`shell-close-${s.sessionId}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="border-t border-[var(--ide-border)] mt-1 pt-1">
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)] w-full cursor-pointer"
                    onClick={handleNewShell}
                    data-testid="shell-new-session"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Shell</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            onClick={() => setShellSearchOpen(!shellSearchOpen)}
            title="Search (Ctrl+F)"
            data-testid="shell-search-toggle"
          >
            <Search className="w-3 h-3" />
          </button>
          {wsStatusBadge}
          {workspaceButton}
        </div>
      </div>
      {shellSearchBar}
      <div className="flex-1 overflow-hidden relative">
        {shellSessions.map((session, i) => (
          <div key={session.sessionId} className="absolute inset-0" style={{ display: i === activeShellIndex ? "block" : "none" }}>
            <WorkspaceTerminal
              ref={(handle) => {
                if (handle) shellTerminalRefs.current.set(session.sessionId, handle);
                else shellTerminalRefs.current.delete(session.sessionId);
              }}
              wsUrl={session.wsUrl}
              runnerOffline={runnerOnline === false}
              visible={activeFileId === SPECIAL_TABS.SHELL && i === activeShellIndex}
              onLastCommand={(cmd) => handleShellLastCommand(session.sessionId, cmd)}
              shellBell={userPrefs.shellBell}
              accessibleTerminal={userPrefs.accessibleTerminal}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const handleSendStdin = useCallback((data: string) => {
    wsSendMessage({ type: "stdin", data });
  }, [wsSendMessage]);

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

  const consoleTabContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      <ConsolePanel
        projectId={projectId!}
        isRunning={isRunning}
        logs={logs}
        onStop={handleStopExecution}
        onAskAI={handleAskAIFromConsole}
        activeFileName={activeFileName}
        currentConsoleRunId={currentConsoleRunId}
        onSendStdin={handleSendStdin}
      />
    </div>
  );

  const renderPaneContentForTab = (tabId: string | null) => {
    if (!tabId) return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--ide-panel)] text-[var(--ide-text-muted)]">
        <FileCode2 className="w-7 h-7 mb-2 opacity-40" />
        <p className="text-xs">No file open</p>
      </div>
    );

    if (tabId === SPECIAL_TABS.WEBVIEW) return webviewTabContent;
    if (tabId === SPECIAL_TABS.SHELL) return shellTabContent;
    if (tabId === SPECIAL_TABS.CONSOLE) return consoleTabContent;

    if (isConflictTab(tabId)) {
      return (
        <div className="flex-1 overflow-auto bg-[var(--ide-bg)] p-0">
          <div className="sticky top-0 z-10 bg-red-500/10 border-b border-red-500/30 px-4 py-2 flex items-center gap-2">
            <span className="text-[11px] font-bold text-red-400">CONFLICT</span>
            <span className="text-[11px] text-[var(--ide-text)] font-mono">{tabId.slice(CONFLICT_TAB_PREFIX.length)}</span>
          </div>
          <textarea
            className="w-full min-h-[400px] bg-[var(--ide-bg)] text-[var(--ide-text)] font-mono text-[13px] p-4 outline-none resize-none border-none leading-relaxed"
            value={fileContents[tabId] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setFileContents(prev => ({ ...prev, [tabId]: val }));
            }}
            data-testid={`editor-conflict-pane-${tabId.slice(CONFLICT_TAB_PREFIX.length)}`}
          />
        </div>
      );
    }

    const isRunner = tabId.startsWith("runner:");
    const file = (!isRunner) ? filesQuery.data?.find((f) => f.id === tabId) : null;
    const fileName = isRunner ? (tabId.slice(7).split("/").pop() || "") : (file?.filename || "");
    const isBinary = file?.isBinary || (file?.content?.startsWith("data:") && file?.content?.includes(";base64,"));
    const code = fileContents[tabId] ?? file?.content ?? "";
    const lang = fileName ? detectLanguage(fileName) : "javascript";

    if (isBinary) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 h-full bg-[var(--ide-bg)]">
          {file?.mimeType?.startsWith("image/") || file?.content?.startsWith("data:image/") ? (
            <img src={file?.content || ""} alt={fileName} className="max-w-full max-h-[60vh] object-contain rounded border border-[var(--ide-border)]" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <FileIcon className="w-16 h-16 text-[var(--ide-text-muted)] opacity-40" />
              <p className="text-sm text-[var(--ide-text-secondary)]">{fileName}</p>
              <p className="text-xs text-[var(--ide-text-muted)]">{file?.mimeType || "Binary file"}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <CodeEditor
        value={code}
        onChange={(val) => {
          setFileContents(prev => ({ ...prev, [tabId]: val }));
          setDirtyFiles(prev => new Set(prev).add(tabId));
          autoSave(tabId, val);
        }}
        language={lang}
        onCursorChange={tabId === activeFileId ? handleCursorChange : undefined}
        fontSize={editorFontSize}
        tabSize={editorTabSize}
        wordWrap={editorWordWrap}
        blameData={tabId === activeFileId && blameEnabled ? blameQuery.data?.blame : undefined}
        aiCompletions={true}
      />
    );
  };

  const renderPaneTabBar = (paneId: string, paneTabs: string[], paneActiveTab: string | null) => {
    const otherPaneIds = allLeafPanes.filter(p => p.id !== paneId).map(p => p.id);

    return (
      <div className="flex items-center shrink-0 h-9 overflow-hidden relative bg-[var(--ide-bg)] border-b border-[var(--ide-border)]">
        <div className="flex items-center h-full flex-1 min-w-0 overflow-x-auto scrollbar-hide"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={(e) => {
            e.preventDefault();
            const draggedTabId = e.dataTransfer.getData("text/pane-tab-id");
            const sourcePaneId = e.dataTransfer.getData("text/source-pane-id");
            if (draggedTabId && sourcePaneId && sourcePaneId !== paneId) {
              paneLayout.moveTabToPane(draggedTabId, sourcePaneId, paneId);
            }
          }}
        >
          {paneTabs.map((tabId) => {
            const specialInfo = getSpecialTabInfo(tabId);
            const isRunnerTab = !specialInfo && tabId.startsWith("runner:");
            const file = (!specialInfo && !isRunnerTab) ? filesQuery.data?.find((f) => f.id === tabId) : null;
            const tabName = specialInfo ? specialInfo.name : isRunnerTab ? tabId.slice(7).split("/").pop() || tabId : file?.filename || tabId;
            if (!specialInfo && !isRunnerTab && !file) return null;
            const isActive = tabId === paneActiveTab;
            return (
              <div
                key={tabId}
                className={`group relative flex items-center gap-1.5 px-3 h-full cursor-pointer shrink-0 border-b-2 transition-colors duration-100 select-none ${isActive ? "bg-[var(--ide-panel)] text-[var(--ide-text)] border-b-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/40 border-b-transparent"}`}
                onClick={() => {
                  paneLayout.setActiveTabInPane(paneId, tabId);
                  setActiveFileId(tabId);
                  if (tabId.startsWith("runner:")) {
                    setActiveRunnerPath(tabId.slice(7));
                  } else {
                    setActiveRunnerPath(null);
                  }
                  if (file && fileContents[tabId] === undefined) {
                    setFileContents((prev) => ({ ...prev, [tabId]: file.content }));
                  }
                }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/pane-tab-id", tabId);
                  e.dataTransfer.setData("text/source-pane-id", paneId);
                  e.dataTransfer.effectAllowed = "move";
                }}
                data-testid={`pane-tab-${paneId}-${tabId}`}
              >
                {specialInfo ? specialInfo.icon : <FileTypeIcon filename={tabName} />}
                <span className="text-[11px] max-w-[120px] truncate font-medium whitespace-nowrap">{tabName}</span>
                {!specialInfo && dirtyFiles.has(tabId) && (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-0.5" />
                )}
                <button
                  className={`p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-opacity duration-100 shrink-0 ml-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tabId, e);
                  }}
                  data-testid={`button-pane-close-tab-${paneId}-${tabId}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center shrink-0 border-l border-[var(--ide-border)]">
          <PaneOptionsMenu
            paneId={paneId}
            activeTab={paneActiveTab}
            tabs={paneTabs}
            otherPaneIds={otherPaneIds}
            isMaximized={paneLayout.layout.maximizedPaneId === paneId}
            isMultiPane={isMultiPane}
            onSplitRight={() => paneLayout.splitPane(paneId, "horizontal")}
            onSplitDown={() => paneLayout.splitPane(paneId, "vertical")}
            onMaximize={() => paneLayout.maximizePane(paneId)}
            onToggleFloat={() => paneLayout.toggleFloating(paneId)}
            onMoveTab={(toPaneId) => {
              if (paneActiveTab) paneLayout.moveTabToPane(paneActiveTab, paneId, toPaneId);
            }}
            onCloseTab={() => {
              if (paneActiveTab) closeTab(paneActiveTab);
            }}
            onCloseOtherTabs={() => {
              if (paneActiveTab) {
                const removedTabs = paneTabs.filter(t => t !== paneActiveTab);
                paneLayout.closeOtherTabsInPane(paneId, paneActiveTab);
                if (removedTabs.length > 0) {
                  setOpenTabs(prev => prev.filter(t => !removedTabs.includes(t)));
                }
              }
            }}
            onClosePane={() => {
              const otherLeaves = allLeafPanes.filter(p => p.id !== paneId);
              if (otherLeaves.length > 0 && paneTabs.length > 0) {
                const target = otherLeaves[0];
                paneTabs.forEach(t => {
                  if (!(target.tabs || []).includes(t)) {
                    paneLayout.moveTabToPane(t, paneId, target.id);
                  }
                });
              }
              paneLayout.closePane(paneId);
            }}
            onOpenNewWindow={openInNewWindow}
          />
        </div>
      </div>
    );
  };

  const renderPaneNode = (node: PaneNode, depth: number = 0): React.ReactNode => {
    if (node.type === "leaf") {
      if (paneLayout.layout.maximizedPaneId && paneLayout.layout.maximizedPaneId !== node.id) {
        return null;
      }
      const paneTabs = node.tabs || [];
      const paneActiveTab = node.activeTab || null;
      return (
        <div
          className={`flex flex-col overflow-hidden min-w-0 min-h-0 flex-1 ${paneLayout.layout.activePaneId === node.id ? "ring-1 ring-[#0079F2]/30" : ""}`}
          onClick={() => paneLayout.setActivePaneId(node.id)}
          data-testid={`pane-leaf-${node.id}`}
        >
          {renderPaneTabBar(node.id, paneTabs, paneActiveTab)}
          <div className="flex-1 overflow-hidden">
            {renderPaneContentForTab(paneActiveTab)}
          </div>
        </div>
      );
    }

    const dir = node.direction || "horizontal";
    const sizes = node.sizes || (node.children || []).map(() => 100 / (node.children || []).length);
    const visibleChildren = (node.children || []).filter(child => {
      if (paneLayout.layout.maximizedPaneId) {
        const leaves = getPaneLeaves(child);
        return leaves.some(l => l.id === paneLayout.layout.maximizedPaneId);
      }
      return true;
    });

    if (paneLayout.layout.maximizedPaneId && visibleChildren.length === 1) {
      return renderPaneNode(visibleChildren[0], depth + 1);
    }

    return (
      <div
        ref={depth === 0 ? paneContainerRef : undefined}
        className={`flex ${dir === "horizontal" ? "flex-row" : "flex-col"} flex-1 overflow-hidden min-w-0 min-h-0`}
        data-testid={`pane-split-${node.id}`}
      >
        {(node.children || []).map((child, i) => (
          <React.Fragment key={child.id}>
            {i > 0 && (
              <ResizeHandle
                direction={dir}
                splitId={node.id}
                index={i - 1}
                sizes={sizes}
                onResize={paneLayout.updateSplitSizes}
                containerRef={paneContainerRef}
              />
            )}
            <div style={{ [dir === "horizontal" ? "width" : "height"]: `${sizes[i]}%` }} className="overflow-hidden flex min-w-0 min-h-0">
              {renderPaneNode(child, depth + 1)}
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const editorContent = mergeConflictPanelOpen && mergeConflicts.length > 0 ? (
    <div className="flex-1 overflow-hidden relative flex flex-col animate-fade-in">
      <MergeConflictPanel
        projectId={projectId!}
        conflicts={mergeConflicts}
        resolutions={mergeResolutions}
        onClose={() => setMergeConflictPanelOpen(false)}
        onResolutionChange={(updated) => setMergeResolutions(updated)}
        onMergeComplete={() => {
          setMergeConflicts([]);
          setMergeResolutions([]);
          setConflictResolutions({});
          setMergeConflictPanelOpen(false);
          setOpenTabs(prev => prev.filter(t => !t.startsWith(CONFLICT_TAB_PREFIX)));
          setFileContents(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(CONFLICT_TAB_PREFIX)) delete next[k]; });
            return next;
          });
          if (activeFileId?.startsWith(CONFLICT_TAB_PREFIX)) setActiveFileId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/merge-status"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] });
        }}
        onAbort={() => {
          setMergeConflicts([]);
          setMergeResolutions([]);
          setConflictResolutions({});
          setMergeConflictPanelOpen(false);
          setOpenTabs(prev => prev.filter(t => !t.startsWith(CONFLICT_TAB_PREFIX)));
          setFileContents(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.startsWith(CONFLICT_TAB_PREFIX)) delete next[k]; });
            return next;
          });
          if (activeFileId?.startsWith(CONFLICT_TAB_PREFIX)) setActiveFileId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/merge-status"] });
        }}
      />
    </div>
  ) : workspaceMode === "canvas" && projectId ? (
    <div className="flex-1 overflow-hidden relative flex flex-col animate-fade-in">
      <DesignCanvas projectId={projectId} messages={messages} />
    </div>
  ) : isMediaProject ? (
    <div className="flex-1 overflow-hidden relative flex flex-col animate-fade-in">
      {isSlideProject && projectId ? <SlideEditor projectId={projectId} /> : null}
      {isVideoProject && projectId ? <VideoEditor projectId={projectId} /> : null}
    </div>
  ) : (
    <div className="flex-1 overflow-hidden relative flex flex-col animate-fade-in">
      {activeFileId === SPECIAL_TABS.WEBVIEW ? webviewTabContent
       : activeFileId === SPECIAL_TABS.SHELL ? shellTabContent
       : activeFileId === SPECIAL_TABS.CONSOLE ? consoleTabContent
       : activeFileId === SPECIAL_TABS.CONFIG ? (
        <ConfigPanel projectId={projectId!} onClose={() => { const idx = openTabs.indexOf(SPECIAL_TABS.CONFIG); if (idx >= 0) { const next = [...openTabs]; next.splice(idx, 1); setOpenTabs(next); setActiveFileId(next[Math.min(idx, next.length - 1)] || null); } }} />
       )
       : activeFileId && isConflictTab(activeFileId) ? (
        <div className="flex-1 overflow-auto bg-[var(--ide-bg)] p-0">
          <div className="sticky top-0 z-10 bg-red-500/10 border-b border-red-500/30 px-4 py-2 flex items-center gap-2">
            <span className="text-[11px] font-bold text-red-400">CONFLICT</span>
            <span className="text-[11px] text-[var(--ide-text)] font-mono">{activeFileId.slice(CONFLICT_TAB_PREFIX.length)}</span>
            <span className="text-[10px] text-[var(--ide-text-muted)]">Edit the content below to resolve the conflict, then use the Git panel to finalize.</span>
          </div>
          <textarea
            className="w-full min-h-[calc(100vh-200px)] bg-[var(--ide-bg)] text-[var(--ide-text)] font-mono text-[13px] p-4 outline-none resize-none border-none leading-relaxed"
            value={fileContents[activeFileId] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setFileContents(prev => ({ ...prev, [activeFileId!]: val }));
              const conflictFilename = activeFileId!.slice(CONFLICT_TAB_PREFIX.length);
              setConflictResolutions(prev => ({ ...prev, [conflictFilename]: val }));
            }}
            data-testid={`editor-conflict-${activeFileId.slice(CONFLICT_TAB_PREFIX.length)}`}
          />
        </div>
       ) : (
        <>
          {breadcrumbBar}
          {activeFileId ? (
            <div className="flex-1 overflow-hidden flex">
              <div className={splitEditorFileId ? "overflow-hidden" : "flex-1 overflow-hidden"} style={splitEditorFileId ? { width: `${splitEditorWidth}%` } : undefined}>
                {activeFileIsBinary ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 h-full bg-[var(--ide-bg)]" data-testid="binary-file-preview">
                    {activeFile?.mimeType?.startsWith("image/") || activeFile?.content?.startsWith("data:image/") ? (
                      <img
                        src={activeFile?.content || ""}
                        alt={activeFileName}
                        className="max-w-full max-h-[60vh] object-contain rounded border border-[var(--ide-border)]"
                        data-testid="img-binary-preview"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <FileIcon className="w-16 h-16 text-[var(--ide-text-muted)] opacity-40" />
                        <p className="text-sm text-[var(--ide-text-secondary)]">{activeFileName}</p>
                        <p className="text-xs text-[var(--ide-text-muted)]">
                          {activeFile?.mimeType || "Binary file"} — This file cannot be displayed in the editor
                        </p>
                        {activeFile?.content && (
                          <a
                            href={activeFile.content}
                            download={activeFileName}
                            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded transition-colors"
                            data-testid="link-download-binary"
                          >
                            <Download className="w-3.5 h-3.5" /> Download File
                          </a>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-[var(--ide-text-muted)] mt-2">
                      {activeFile?.mimeType || "Binary file"} · {activeFile?.content ? formatBytes(Math.ceil((activeFile.content.length * 3) / 4)) : "Unknown size"}
                    </p>
                  </div>
                ) : activeFileName.endsWith(".csv") && currentCode ? (
                  <div className="flex-1 flex flex-col h-full bg-[var(--ide-bg)] overflow-hidden" data-testid="csv-preview">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/50 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-amber-500"><span className="text-[7px] font-bold text-black">CV</span></span>
                        <span className="text-[11px] font-medium text-[var(--ide-text)]">{activeFileName}</span>
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Table Preview</span>
                      </div>
                      <button className="text-[10px] text-[#0079F2] hover:underline" onClick={() => setCsvViewMode(m => m === "table" ? "raw" : "table")} data-testid="button-toggle-csv-view">{csvViewMode === "table" ? "Show Raw" : "Show Table"}</button>
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                      {csvViewMode === "raw" ? (
                        <pre className="text-[11px] font-mono text-[var(--ide-text-secondary)] whitespace-pre-wrap" data-testid="csv-raw-view">{currentCode}</pre>
                      ) : (() => {
                        const lines = currentCode.split("\n").filter(l => l.trim());
                        const parseRow = (line: string) => {
                          const result: string[] = [];
                          let current = "";
                          let inQuotes = false;
                          for (let i = 0; i < line.length; i++) {
                            if (line[i] === '"') { inQuotes = !inQuotes; }
                            else if (line[i] === "," && !inQuotes) { result.push(current.trim()); current = ""; }
                            else { current += line[i]; }
                          }
                          result.push(current.trim());
                          return result;
                        };
                        const rows = lines.map(parseRow);
                        const headers = rows[0] || [];
                        const data = rows.slice(1);
                        return (
                          <table className="w-full text-[11px] border-collapse" data-testid="table-csv-data">
                            <thead>
                              <tr>
                                <th className="px-2 py-1.5 text-left font-semibold text-[var(--ide-text-muted)] bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[10px] sticky top-0">#</th>
                                {headers.map((h, i) => (
                                  <th key={i} className="px-2 py-1.5 text-left font-semibold text-[var(--ide-text)] bg-[var(--ide-surface)] border border-[var(--ide-border)] sticky top-0">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {data.map((row, ri) => (
                                <tr key={ri} className="hover:bg-[var(--ide-surface)]/50">
                                  <td className="px-2 py-1 text-[var(--ide-text-muted)] border border-[var(--ide-border)] text-[10px] font-mono">{ri + 1}</td>
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="px-2 py-1 text-[var(--ide-text-secondary)] border border-[var(--ide-border)]">{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <ContextMenu>
                    <ContextMenuTrigger className="w-full h-full" data-testid="editor-context-trigger">
                      <CodeEditor value={currentCode} onChange={handleCodeChange} language={editorLanguage} onCursorChange={handleCursorChange} fontSize={editorFontSize} tabSize={editorTabSize} wordWrap={editorWordWrap} blameData={blameEnabled ? blameQuery.data?.blame : undefined} aiCompletions={userPrefs.aiCodeCompletion} autoCloseBrackets={userPrefs.autoCloseBrackets} indentationChar={userPrefs.indentationChar} minimap={userPrefs.minimap} indentOnInput={userPrefs.indentationDetection} multiselectModifier={userPrefs.multiselectModifier} semanticTokens={userPrefs.semanticTokens} formatPastedText={userPrefs.formatPastedText} acceptSuggestionOnCommit={userPrefs.acceptSuggestionOnCommit} editorRef={collabEditorRef as React.MutableRefObject<import("@uiw/react-codemirror").ReactCodeMirrorRef | null>} ytext={activeYtext} remoteAwareness={remoteAwareness} lspClient={activeLspClient} filename={activeFileName} projectId={projectId} onGoToDefinition={handleGoToDefinition} onFindReferences={handleFindReferences} onRenameSymbol={handleRenameSymbol} />
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-[var(--ide-bg)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[200px] p-1" data-testid="editor-context-menu">
                      <ContextMenuItem
                        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                        data-testid="context-go-to-definition"
                        onClick={() => {
                          const view = collabEditorRef.current?.view;
                          if (!view || !lspClientRef.current || !activeFileName) return;
                          const pos = view.state.selection.main.head;
                          const line = (view.state.doc as any).lineAt(pos);
                          const uri = lspClientRef.current.makeUri(activeFileName);
                          lspClientRef.current.definition(uri, line.number - 1, pos - line.from).then(locs => {
                            if (locs.length > 0) handleGoToDefinition(locs[0].uri, locs[0].range.start.line, locs[0].range.start.character);
                          });
                        }}
                      >
                        <Code2 className="w-3.5 h-3.5" /> Go to Definition <span className="ml-auto text-[9px] opacity-50">F12</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                        data-testid="context-find-references"
                        onClick={() => {
                          const view = collabEditorRef.current?.view;
                          if (!view || !lspClientRef.current || !activeFileName) return;
                          const pos = view.state.selection.main.head;
                          const line = (view.state.doc as any).lineAt(pos);
                          const uri = lspClientRef.current.makeUri(activeFileName);
                          handleFindReferences(uri, line.number - 1, pos - line.from);
                        }}
                      >
                        <Search className="w-3.5 h-3.5" /> Find All References <span className="ml-auto text-[9px] opacity-50">⇧F12</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
                      <ContextMenuItem
                        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
                        data-testid="context-rename-symbol"
                        onClick={() => {
                          const view = collabEditorRef.current?.view;
                          if (!view || !lspClientRef.current || !activeFileName) return;
                          const pos = view.state.selection.main.head;
                          const line = (view.state.doc as any).lineAt(pos);
                          const uri = lspClientRef.current.makeUri(activeFileName);
                          handleRenameSymbol(uri, line.number - 1, pos - line.from);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Rename Symbol <span className="ml-auto text-[9px] opacity-50">F2</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )}
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
                        autoCloseBrackets={userPrefs.autoCloseBrackets}
                        indentationChar={userPrefs.indentationChar}
                        aiCompletions={userPrefs.aiCodeCompletion}
                        indentOnInput={userPrefs.indentationDetection}
                        multiselectModifier={userPrefs.multiselectModifier}
                        semanticTokens={userPrefs.semanticTokens}
                        formatPastedText={userPrefs.formatPastedText}
                        acceptSuggestionOnCommit={userPrefs.acceptSuggestionOnCommit}
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
              <svg width="40" height="40" viewBox="0 0 32 32" fill="none" data-testid="img-ecode-logo">
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
    <ConsolePanel
      projectId={projectId!}
      isRunning={isRunning}
      logs={logs}
      onStop={handleStopExecution}
      onAskAI={handleAskAIFromConsole}
      activeFileName={activeFileName}
      currentConsoleRunId={currentConsoleRunId}
      onSendStdin={handleSendStdin}
    />
  );

  const previewContent = (
    <div className="flex-1 overflow-hidden flex flex-col bg-[var(--ide-panel)] animate-fade-in">
      {wsStatus === "running" && livePreviewUrl ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[var(--ide-text-secondary)] shrink-0" />
              <span className="text-[11px] text-[var(--ide-text-secondary)] truncate cursor-pointer" onClick={() => { if (fullDevUrl) { navigator.clipboard.writeText(fullDevUrl); toast({ title: "Development URL copied" }); } }} data-testid="text-preview-dev-url">{devUrl || livePreviewUrl}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(previewPortsQuery.data?.length ?? 0) > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] font-mono text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] gap-0.5" data-testid="button-panel-port-selector">
                      <Wifi className="w-2.5 h-2.5" />
                      {selectedPreviewPort ? `:${selectedPreviewPort}` : "Ports"}
                      <ChevronDown className="w-2 h-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[140px]" align="end">
                    {previewPortsQuery.data?.map((p) => (
                      <DropdownMenuItem key={p.id} className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer font-mono"
                        onClick={() => {
                          setSelectedPreviewPort(p.externalPort);
                          if (p.proxyUrl) {
                            const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement;
                            if (iframe) iframe.src = `${window.location.origin}${p.proxyUrl}`;
                          }
                        }}
                        data-testid={`panel-port-option-${p.externalPort}`}
                      >
                        <span className={selectedPreviewPort === p.externalPort ? "text-blue-400" : ""}>
                          :{p.internalPort} → :{p.externalPort}
                        </span>
                        <span className="text-[var(--ide-text-muted)] text-[9px] ml-auto">{p.label || ""}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DevicePresetSelector selectedPreset={selectedDevicePreset} onSelect={handleDevicePresetSelect} projectId={projectId} customWidth={customDeviceWidth} customHeight={customDeviceHeight} onCustomSizeChange={(w, h) => { setCustomDeviceWidth(w); setCustomDeviceHeight(h); }} />
              <DevToolsToggle active={devToolsActive} onToggle={() => setDevToolsActive(!devToolsActive)} />
              <Button variant="ghost" size="icon" className={`w-5 h-5 transition-colors ${visualEditorActive && visualEditorIframeId === "live-preview-iframe" ? "text-[#7C65CB] bg-[#7C65CB]/15" : "text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]"}`}
                onClick={() => handleVisualEditorToggle("live-preview-iframe")}
                title={visualEditorActive ? "Disable Visual Editor" : "Enable Visual Editor"}
                data-testid="button-visual-editor-live"><MousePointer2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]"
                onClick={() => { const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement; if (iframe) iframe.src = effectivePreviewUrl || livePreviewUrl; }}
                title="Refresh" data-testid="button-preview-refresh"><RefreshCw className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] gap-1"
                onClick={() => window.open(fullDevUrl || livePreviewUrl, "_blank")} data-testid="button-preview-new-tab"><ExternalLink className="w-3 h-3" /> Open</Button>
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <DeviceFrame selectedPreset={selectedDevicePreset} customWidth={customDeviceWidth} customHeight={customDeviceHeight}>
                <iframe id="live-preview-iframe" src={effectivePreviewUrl!} className="w-full h-full border-0 bg-white" title="Live Preview" loading="lazy" data-testid="iframe-live-preview" />
              </DeviceFrame>
            </div>
            {visualEditorActive && visualEditorIframeId === "live-preview-iframe" && (
              <div className="w-[260px] shrink-0 border-l border-[var(--ide-border)] overflow-hidden" data-testid="visual-editor-live-panel">
                <VisualEditorPanel
                  element={selectedVEElement}
                  onClose={() => { setVisualEditorActive(false); deactivateVisualEditor("live-preview-iframe"); setSelectedVEElement(null); }}
                  onApplyEdit={handleVisualEditApply}
                  onJumpToSource={handleJumpToSource}
                  onAIHandoff={handleAIHandoff}
                  iframeId="live-preview-iframe"
                />
              </div>
            )}
          </div>
        </>
      ) : previewHtml ? (
        <>
          <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe className="w-3 h-3 text-[var(--ide-text-secondary)] shrink-0" />
              <span className="text-[11px] text-[var(--ide-text-secondary)] truncate">HTML Preview</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <DevicePresetSelector selectedPreset={selectedDevicePreset} onSelect={handleDevicePresetSelect} projectId={projectId} customWidth={customDeviceWidth} customHeight={customDeviceHeight} onCustomSizeChange={(w, h) => { setCustomDeviceWidth(w); setCustomDeviceHeight(h); }} />
              <DevToolsToggle active={devToolsActive} onToggle={() => setDevToolsActive(!devToolsActive)} />
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)]"
                onClick={() => { const html = generateHtmlPreview(); if (html) setPreviewHtml(html); }}
                title="Refresh" data-testid="button-preview-refresh-html"><RefreshCw className="w-3 h-3" /></Button>
            </div>
          </div>
          <DeviceFrame selectedPreset={selectedDevicePreset} customWidth={customDeviceWidth} customHeight={customDeviceHeight}>
            <iframe srcDoc={injectErudaIntoHtml(previewHtml!, devToolsActive)} className="w-full h-full border-0 bg-white" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-html-preview-mobile" />
          </DeviceFrame>
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

  const isShellInMainEditor = activeFileId === SPECIAL_TABS.SHELL;

  const shellContent = (
    <div className="flex-1 overflow-hidden animate-fade-in flex flex-col">
      {!isShellInMainEditor && shellSearchBar}
      <div className="flex-1 overflow-hidden relative">
        {!isShellInMainEditor && shellSessions.map((session, i) => (
          <div key={session.sessionId} className="absolute inset-0" style={{ display: i === activeShellIndex ? "block" : "none" }}>
            <WorkspaceTerminal
              ref={(handle) => {
                if (handle) shellTerminalRefs.current.set(session.sessionId, handle);
                else shellTerminalRefs.current.delete(session.sessionId);
              }}
              wsUrl={session.wsUrl}
              runnerOffline={runnerOnline === false}
              visible={bottomTab === "shell" && i === activeShellIndex}
              onLastCommand={(cmd) => handleShellLastCommand(session.sessionId, cmd)}
              shellBell={userPrefs.shellBell}
              accessibleTerminal={userPrefs.accessibleTerminal}
            />
          </div>
        ))}
        {isShellInMainEditor && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--ide-text-muted)]">
            <p className="text-xs">Shell is open in the editor area above</p>
          </div>
        )}
      </div>
    </div>
  );

  const bottomPanel = (
    <div className="flex flex-col bg-[var(--ide-panel)] h-full">
      <div className="flex items-center justify-between px-1 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center h-full overflow-x-auto">
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 ${bottomTab === "terminal" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`} onClick={() => setBottomTab("terminal")} data-testid="tab-console">
            <Terminal className="w-3 h-3" /> Console {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse" />}
          </button>
          <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 ${bottomTab === "problems" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`} onClick={() => setBottomTab("problems")} data-testid="tab-problems">
            <AlertCircle className="w-3 h-3" /> Problems <span className="text-[9px] px-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">0</span>
          </button>
          {referencesResults.length > 0 && (
            <button className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 ${bottomTab === "references" ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`} onClick={() => setBottomTab("references")} data-testid="tab-references">
              <Search className="w-3 h-3" /> References <span className="text-[9px] px-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">{referencesResults.length}</span>
            </button>
          )}
          {shellSessions.map((session, idx) => (
            <button
              key={session.sessionId}
              className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 hover-transition transition-colors duration-150 shrink-0 group ${bottomTab === "shell" && activeShellIndex === idx ? "text-[var(--ide-text)] border-[#0079F2]" : "text-[var(--ide-text-muted)] border-transparent hover:text-[var(--ide-text-secondary)]"}`}
              onClick={() => { setBottomTab("shell"); setActiveShellIndex(idx); }}
              data-testid={`tab-shell-${idx}`}
            >
              <Hash className="w-3 h-3" /> <span className="truncate max-w-[80px]">{session.label}</span>
              {bottomTab === "shell" && activeShellIndex === idx && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />}
              {shellSessions.length > 1 && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:text-[#FF6166]" onClick={(e) => {
                  e.stopPropagation();
                  handleCloseShell(idx);
                }}>
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
          <button
            className="flex items-center justify-center w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors ml-1 shrink-0"
            onClick={handleNewShell}
            title="New Shell"
            data-testid="button-new-terminal"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 pr-1 shrink-0">
          <button
            className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            onClick={() => setShellSearchOpen(!shellSearchOpen)}
            title="Search (Ctrl+F)"
            data-testid="bottom-shell-search-toggle"
          >
            <Search className="w-3 h-3" />
          </button>
          {wsStatusBadge}
          {workspaceButton}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors duration-150" onClick={() => { terminalPanelRef.current?.collapse(); }} title="Close" data-testid="button-close-terminal"><X className="w-3 h-3" /></Button>
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
      ) : bottomTab === "references" ? (
        <div className="flex-1 overflow-y-auto px-1 py-1 animate-fade-in" data-testid="references-panel">
          {referencesResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--ide-text-muted)]">
              <Search className="w-6 h-6 mb-2 opacity-40" />
              <p className="text-xs font-medium text-[var(--ide-text-secondary)]">No references found</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {referencesResults.map((ref, idx) => (
                <button
                  key={idx}
                  className="w-full flex items-center gap-2 px-2 py-1 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded transition-colors text-left"
                  data-testid={`reference-item-${idx}`}
                  onClick={() => handleGoToDefinition(ref.uri, ref.line, ref.character)}
                >
                  <FileCode2 className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" />
                  <span className="truncate font-medium">{ref.filename}</span>
                  <span className="text-[var(--ide-text-muted)] shrink-0">:{ref.line + 1}:{ref.character + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : terminalContent}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-panel)] text-sm select-none overflow-hidden" data-testid="project-workspace" tabIndex={-1}>
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
          <span className={`text-[13px] font-medium truncate cursor-pointer hover:text-[#0079F2] transition-colors ${isMobile ? "text-[var(--ide-text)] max-w-[120px]" : "text-[var(--ide-text)] max-w-[180px]"}`} onClick={() => setSpotlightOpen(prev => !prev)} data-testid="text-project-name">{project?.name}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${project?.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project?.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} data-testid="navbar-badge-visibility">{project?.visibility === "private" ? "Private" : project?.visibility === "team" ? "Team" : "Public"}</span>
          {project?.isPublished && <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${"bg-green-500/10 text-green-400 border border-green-500/20"}`}>Live</span>}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Button
                    size="sm"
                    className={`h-7 ${isMobile ? "px-3" : "px-4"} text-[11px] font-semibold ${!isMobile ? "rounded-l-full rounded-r-none" : "rounded-full"} gap-1.5 transition-all duration-150 ${isRunning ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)] btn-run-red" : "bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_12px_rgba(12,206,107,0.3)] btn-run-green"}`}
                    onClick={handleRun}
                    disabled={runMutation.isPending || runWorkflowMutation.isPending}
                    data-testid="button-run"
                  >
                    {(runMutation.isPending || runWorkflowMutation.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : isRunning ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Play className="w-3 h-3 fill-current" /> Run</>}
                  </Button>
                  {!isMobile && (
                    <div className="relative">
                      <Button
                        size="sm"
                        className={`h-7 px-1.5 text-[11px] font-semibold rounded-r-full rounded-l-none border-l border-black/10 transition-all duration-150 ${isRunning ? "bg-red-600 hover:bg-red-500 text-white" : "bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525]"}`}
                        onClick={(e) => { e.stopPropagation(); setRunDropdownOpen(!runDropdownOpen); }}
                        data-testid="button-run-dropdown"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      {runDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-xl z-50 py-1" data-testid="run-dropdown-menu">
                          <button
                            className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--ide-surface)] transition-colors flex items-center gap-2 ${!(projectQuery.data as any)?.selectedWorkflowId ? "text-[#0CCE6B] font-medium" : "text-[var(--ide-text)]"}`}
                            onClick={() => setSelectedWorkflowMutation.mutate(null)}
                            data-testid="run-option-default"
                          >
                            <Play className="w-3 h-3" /> Run App
                            {!(projectQuery.data as any)?.selectedWorkflowId && <Check className="w-3 h-3 ml-auto text-[#0CCE6B]" />}
                          </button>
                          {(runButtonWorkflowsQuery.data || []).map((wf) => (
                            <button
                              key={wf.id}
                              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--ide-surface)] transition-colors flex items-center gap-2 ${(projectQuery.data as any)?.selectedWorkflowId === wf.id ? "text-[#0079F2] font-medium" : "text-[var(--ide-text)]"}`}
                              onClick={() => setSelectedWorkflowMutation.mutate(wf.id)}
                              data-testid={`run-option-workflow-${wf.id}`}
                            >
                              <GitMerge className="w-3 h-3" /> {wf.name}
                              {(projectQuery.data as any)?.selectedWorkflowId === wf.id && <Check className="w-3 h-3 ml-auto text-[#0079F2]" />}
                            </button>
                          ))}
                          {(!runButtonWorkflowsQuery.data || runButtonWorkflowsQuery.data.length === 0) && (
                            <div className="px-3 py-1.5 text-[10px] text-[var(--ide-text-muted)]">No workflows created yet</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 px-3 text-[11px] font-medium rounded-full gap-1.5 transition-all duration-150 border ${workspaceMode === "canvas" ? "bg-[#7C65CB]/15 text-[#7C65CB] border-[#7C65CB]/30" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] border-[var(--ide-border)]"}`}
                    onClick={() => setWorkspaceMode(prev => prev === "canvas" ? "editor" : "canvas")}
                    data-testid="button-canvas-mode"
                  >
                    <Frame className="w-3 h-3" /> Canvas
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Design Canvas</TooltipContent>
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
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => setSpotlightOpen(true)}>
                    <Users className="w-3.5 h-3.5" /> Invite
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer" onClick={() => openPanel("git")}>
                    <GitBranch className="w-3.5 h-3.5" /> Version Control
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {remoteUsers.length > 0 && (
                <TooltipProvider delayDuration={200}>
                  <div className="flex items-center gap-1 mr-1" data-testid="presence-indicators">
                    {remoteUsers.slice(0, 5).map((ru) => (
                      <Tooltip key={ru.userId}>
                        <TooltipTrigger asChild>
                          <div
                            className="relative flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-semibold text-white cursor-default shrink-0 ring-2 ring-[var(--ide-bg)]"
                            style={{ backgroundColor: ru.color }}
                            data-testid={`presence-avatar-${ru.userId}`}
                          >
                            {ru.avatarUrl ? (
                              <img src={ru.avatarUrl} alt={ru.displayName} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              ru.displayName.charAt(0).toUpperCase()
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#0CCE6B] ring-1 ring-[var(--ide-bg)]" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ru.color }} />
                            {ru.displayName}
                            {ru.activeFileId && (
                              <span className="text-[var(--ide-text-muted)]">
                                {(() => { const file = filesQuery.data?.find((file) => file.id === ru.activeFileId); return file ? `editing ${file.filename}` : ""; })()}
                              </span>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {remoteUsers.length > 5 && (
                      <div className="w-6 h-6 rounded-full bg-[var(--ide-surface)] text-[9px] text-[var(--ide-text-muted)] flex items-center justify-center font-medium ring-2 ring-[var(--ide-bg)]">
                        +{remoteUsers.length - 5}
                      </div>
                    )}
                  </div>
                </TooltipProvider>
              )}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-md gap-1.5 transition-colors duration-150" onClick={() => setSpotlightOpen(true)} data-testid="button-invite">
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
                  <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px] text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-md gap-1.5 transition-colors duration-150" data-testid="button-export-doc">
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-2xl">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Export Project Data</div>
                  <DropdownMenuSeparator className="bg-[var(--ide-border)]" />
                  {[
                    { format: "pdf", label: "PDF Document", icon: "PD", color: "bg-red-600" },
                    { format: "docx", label: "Word Document", icon: "DX", color: "bg-blue-600" },
                    { format: "xlsx", label: "Excel Spreadsheet", icon: "XL", color: "bg-green-600" },
                    { format: "pptx", label: "PowerPoint Slides", icon: "PT", color: "bg-orange-600" },
                    { format: "csv", label: "CSV Data", icon: "CV", color: "bg-amber-500" },
                  ].map(({ format, label, icon, color }) => (
                    <DropdownMenuItem
                      key={format}
                      className="gap-2.5 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer px-3 py-2"
                      data-testid={`button-export-${format}`}
                      onClick={async () => {
                        try {
                          const projectFiles = filesQuery.data || [];
                          const sections = projectFiles.map((f: any) => ({
                            type: "table" as const,
                            headers: ["File", "Language"],
                            rows: [[f.filename, f.language || "unknown"]],
                          }));
                          if (sections.length === 0) {
                            sections.push({ type: "paragraph" as const, content: "No files in this project yet." } as any);
                          }
                          const res = await fetch(`/api/projects/${projectId}/generate-file`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()! } : {}) },
                            credentials: "include",
                            body: JSON.stringify({
                              format,
                              filename: `${project?.name || "project"}-export.${format}`,
                              title: `${project?.name || "Project"} — Export`,
                              sections: [{
                                type: "heading",
                                content: "Project Files",
                                level: 1,
                              }, {
                                type: "table",
                                headers: ["Filename", "Language", "Size"],
                                rows: projectFiles.map((f: any) => [f.filename, f.language || "—", f.content ? `${(f.content.length / 1024).toFixed(1)} KB` : "—"]),
                              }],
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            const a = document.createElement("a");
                            a.href = data.downloadUrl;
                            a.download = data.filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            toast({ title: `Exported as ${format.toUpperCase()}`, description: data.filename });
                          } else {
                            toast({ title: "Export failed", variant: "destructive" });
                          }
                        } catch {
                          toast({ title: "Export failed", variant: "destructive" });
                        }
                      }}
                    >
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0 ${color}`}>
                        <span className="text-[7px] font-bold leading-none text-white">{icon}</span>
                      </span>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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

      {showInfoPanel && (
        <div className="absolute top-10 left-0 z-50 w-80 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg shadow-2xl p-4 ml-2" data-testid="project-info-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--ide-text)]">Project Info</h3>
            <button onClick={() => setShowInfoPanel(false)} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" data-testid="btn-close-info-panel"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider">Name</label>
              <p className="text-sm text-[var(--ide-text)] font-medium">{project?.name}</p>
            </div>
            <div>
              <label className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-1 block">Visibility</label>
              <div className="flex gap-1">
                {project?.visibility === "team" ? (
                  <div className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium border bg-[#0079F2]/10 text-[#0079F2] border-[#0079F2]/30 text-center" data-testid="info-btn-visibility-team">Team</div>
                ) : (["public", "private"] as const).map(v => (
                  <button key={v} onClick={() => visibilityMutation.mutate(v)} disabled={visibilityMutation.isPending} className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all ${project?.visibility === v ? "bg-[#0079F2]/10 text-[#0079F2] border-[#0079F2]/30" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:border-[var(--ide-hover)]"}`} data-testid={`info-btn-visibility-${v}`}>{v === "public" ? "Public" : "Private"}</button>
                ))}
              </div>
            </div>
            {project?.visibility === "private" && (
              <div>
                <label className="text-[10px] text-[var(--ide-text-muted)] uppercase tracking-wider mb-1 block">Invited Guests</label>
                <div className="flex gap-1 mb-2">
                  <input type="email" placeholder="Email address" value={infoInviteEmail} onChange={(e) => setInfoInviteEmail(e.target.value)} className="flex-1 h-7 px-2 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]" onKeyDown={(e) => { if (e.key === "Enter" && infoInviteEmail.trim()) { inviteGuestMutation.mutate({ email: infoInviteEmail.trim(), role: "viewer" }); setInfoInviteEmail(""); } }} data-testid="info-input-invite-email" />
                  <button onClick={() => { if (infoInviteEmail.trim()) { inviteGuestMutation.mutate({ email: infoInviteEmail.trim(), role: "viewer" }); setInfoInviteEmail(""); } }} className="h-7 px-2 bg-[#0079F2] text-white text-[10px] rounded hover:bg-[#0066CC]" data-testid="info-btn-invite-guest">Invite</button>
                </div>
                {(guestsQuery.data || []).length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(guestsQuery.data || []).map((guest: ProjectGuest) => (
                      <div key={guest.id} className="flex items-center justify-between py-1 px-2 bg-[var(--ide-bg)] rounded text-[10px]">
                        <span className="text-[var(--ide-text)] truncate">{guest.email}</span>
                        <button onClick={() => removeGuestMutation.mutate(guest.id)} className="text-[var(--ide-text-muted)] hover:text-red-400 ml-1" data-testid={`info-btn-remove-guest-${guest.id}`}><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                        onClick={() => { setMobileShellMode("console"); setShellDropdownOpen(false); setShellSearchOpen(false); }}
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
                          <Hash className="w-3 h-3" /> <span className="truncate max-w-[60px]">{shellSessions[activeShellIndex]?.label || "Shell"}</span>
                          {wsStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {mobileShellMode === "shell" && (
                        <>
                          <button
                            className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                            onClick={() => setShellSearchOpen(!shellSearchOpen)}
                            title="Search"
                            data-testid="mobile-shell-search-toggle"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                            onClick={handleNewShell}
                            title="New Shell"
                            data-testid="mobile-shell-new"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {shellSessions.length > 1 && (
                            <button
                              className="p-1 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors relative"
                              onClick={() => setShellDropdownOpen(!shellDropdownOpen)}
                              title="Switch Shell"
                              data-testid="mobile-shell-switcher"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#0079F2] text-white text-[8px] rounded-full flex items-center justify-center font-bold">{shellSessions.length}</span>
                            </button>
                          )}
                        </>
                      )}
                      {wsStatusBadge}
                      {workspaceButton}
                    </div>
                  </div>
                  {mobileShellMode === "shell" && shellDropdownOpen && (
                    <div className="border-b border-[var(--ide-border)] bg-[var(--ide-bg)] px-1 py-1" data-testid="mobile-shell-dropdown">
                      {shellSessions.map((s, i) => (
                        <button
                          key={s.sessionId}
                          className={`flex items-center gap-2 w-full px-3 py-2 text-[12px] rounded transition-colors ${i === activeShellIndex ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]"}`}
                          onClick={() => { setActiveShellIndex(i); setShellDropdownOpen(false); }}
                          data-testid={`mobile-shell-option-${s.sessionId}`}
                        >
                          <Hash className="w-3 h-3 text-[#0CCE6B] shrink-0" />
                          <span className="flex-1 truncate text-left">{s.label}</span>
                          {i === activeShellIndex && <span className="w-1.5 h-1.5 rounded-full bg-[#0CCE6B] animate-pulse shrink-0" />}
                          {shellSessions.length > 1 && (
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-red-500/20 text-[var(--ide-text-muted)] hover:text-red-400 shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleCloseShell(i); setShellDropdownOpen(false); }}
                              data-testid={`mobile-shell-close-${s.sessionId}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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
                          if (iframe) iframe.src = effectivePreviewUrl || livePreviewUrl;
                        } else {
                          const html = generateHtmlPreview();
                          if (html) setPreviewHtml(html);
                        }
                      }} data-testid="button-webview-refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <form className="flex-1 mx-1 h-7 flex items-center px-2.5 rounded-lg bg-[var(--ide-panel)] border border-[var(--ide-border)]" onSubmit={(e) => {
                        e.preventDefault();
                        if (webviewUrlInput.trim()) {
                          const url = webviewUrlInput.startsWith("http://") || webviewUrlInput.startsWith("https://") ? webviewUrlInput : `https://${webviewUrlInput}`;
                          const iframe = document.getElementById("live-preview-iframe") as HTMLIFrameElement;
                          if (iframe) iframe.src = url;
                        }
                      }}>
                        <Globe className="w-3 h-3 text-[var(--ide-text-muted)] mr-1.5 shrink-0" />
                        <input
                          className="flex-1 bg-transparent text-[11px] text-[var(--ide-text-muted)] font-mono outline-none min-w-0"
                          value={webviewUrlInput || livePreviewUrl || (previewHtml ? "HTML Preview" : "localhost:3000")}
                          onChange={(e) => setWebviewUrlInput(e.target.value)}
                          onFocus={() => setWebviewUrlInput(livePreviewUrl || "")}
                          onBlur={() => { if (!webviewUrlInput.trim()) setWebviewUrlInput(""); }}
                          data-testid="input-webview-url"
                        />
                      </form>
                      <DevicePresetSelector selectedPreset={selectedDevicePreset} onSelect={handleDevicePresetSelect} projectId={projectId} customWidth={customDeviceWidth} customHeight={customDeviceHeight} onCustomSizeChange={(w, h) => { setCustomDeviceWidth(w); setCustomDeviceHeight(h); }} />
                      <DevToolsToggle active={devToolsActive} onToggle={() => setDevToolsActive(!devToolsActive)} />
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
                    pendingMessage={pendingAIMessage}
                    onPendingMessageConsumed={() => setPendingAIMessage(null)}
                    onAgentComplete={handleAgentComplete}
                    onCanvasFrameCreate={handleCanvasFrameCreate}
                    onConvertFrame={handleConvertFrame}
                    canvasFrames={canvasFramesQuery.data}
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
                  <div className="overflow-y-auto">
                    <BackupRecoverySection projectId={projectId} />
                  </div>
                </div>
              )}
              {mobileTab === "fileHistory" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-file-history-panel">
                  <FileHistoryPanel projectId={projectId} files={(filesQuery.data || []).map(f => ({ id: f.id, filename: f.filename, content: f.content }))} onClose={() => setMobileTab("editor")} onFileRestored={(fileId, _filename, content) => { setFileContents(prev => ({ ...prev, [fileId]: content })); setDirtyFiles(prev => { const next = new Set(prev); next.delete(fileId); return next; }); }} initialFile={fileHistoryInitialFile} openCounter={fileHistoryOpenCounter} />
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
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${project?.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project?.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} data-testid="mobile-badge-visibility">{project?.visibility === "private" ? "Private" : project?.visibility === "team" ? "Team" : "Public"}</span>
                        <span className={`w-2 h-2 rounded-full ${project?.isPublished ? "bg-[#0CCE6B]" : "bg-[var(--ide-text-muted)]"}`} />
                        <span className="text-xs font-medium text-[var(--ide-text)]">{project?.isPublished ? "Published" : "Not published"}</span>
                      </div>
                      <div className="flex gap-1.5 mb-3">
                        {["public", "private"].map((v) => (
                          <button key={v} onClick={() => visibilityMutation.mutate(v)} disabled={visibilityMutation.isPending} className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all ${project?.visibility === v ? "bg-[#0079F2]/10 text-[#0079F2] border-[#0079F2]/30" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] border-[var(--ide-border)]"}`} data-testid={`mobile-btn-visibility-${v}`}>{v === "public" ? "Public" : "Private"}</button>
                        ))}
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
                        {deploymentsQuery.isError ? (
                          <div className="py-4 text-center">
                            <p className="text-[10px] text-red-400">Failed to load deployments</p>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-[var(--ide-text-muted)] mt-1" onClick={() => deploymentsQuery.refetch()} data-testid="mobile-retry-deployments">Retry</Button>
                          </div>
                        ) : deploymentsQuery.isLoading ? (
                          <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)] mx-auto" /></div>
                        ) : (deploymentsQuery.data || []).length > 0 ? (
                          (() => {
                            const deps = deploymentsQuery.data || [];
                            const currentLiveIdx = deps.findIndex(d => d.status === "live");
                            return deps.map((dep, idx) => {
                              const isCurrentLive = idx === currentLiveIdx;
                              const statusColors: Record<string, string> = {
                                live: "bg-green-500/10 text-green-400 border-green-500/20",
                                building: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                failed: "bg-red-500/10 text-red-400 border-red-500/20",
                                stopped: "bg-gray-500/10 text-gray-400 border-gray-500/20",
                              };
                              const dotColors: Record<string, string> = {
                                live: "bg-[#0CCE6B]",
                                building: "bg-blue-400",
                                failed: "bg-red-400",
                                stopped: "bg-gray-400",
                              };
                              const duration = dep.finishedAt && dep.createdAt ? Math.round((new Date(dep.finishedAt).getTime() - new Date(dep.createdAt).getTime()) / 1000) : null;
                              return (
                                <div key={dep.id} className={`rounded-md bg-[var(--ide-bg)] border ${isCurrentLive ? "border-green-500/30" : "border-[var(--ide-border)]"}`} data-testid={`mobile-deployment-${dep.id}`}>
                                  <button className="flex items-center gap-2 px-2.5 py-2 w-full text-left" onClick={() => setExpandedDeployId(expandedDeployId === dep.id ? null : dep.id)} data-testid={`mobile-toggle-deployment-${dep.id}`}>
                                    {expandedDeployId === dep.id ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColors[dep.status] || "bg-gray-400"} shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] text-[var(--ide-text)] font-medium">v{dep.version}</p>
                                      <p className="text-[9px] text-[var(--ide-text-muted)]">{new Date(dep.createdAt).toLocaleString()}{duration !== null ? ` · ${duration}s` : ""}</p>
                                    </div>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${statusColors[dep.status] || statusColors.stopped}`}>{isCurrentLive ? "Live" : dep.status}</span>
                                  </button>
                                  {expandedDeployId === dep.id && (
                                    <div className="px-2.5 pb-2.5 space-y-2">
                                      {dep.buildLog && (
                                        <div className="bg-[var(--ide-panel)] rounded p-2 max-h-[120px] overflow-y-auto">
                                          <pre className="text-[9px] text-[var(--ide-text-muted)] font-mono whitespace-pre-wrap" data-testid={`mobile-build-log-${dep.id}`}>{dep.buildLog}</pre>
                                        </div>
                                      )}
                                      {dep.url && (
                                        <a href={dep.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#0079F2] hover:underline block truncate" data-testid={`mobile-deploy-url-${dep.id}`}>{dep.url}</a>
                                      )}
                                      {!isCurrentLive && (dep.status === "live" || dep.status === "stopped") && (
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] w-full border-[var(--ide-border)] text-[var(--ide-text-secondary)]" onClick={() => rollbackMutation.mutate(dep.version)} disabled={rollbackMutation.isPending} data-testid={`mobile-rollback-${dep.id}`}>
                                          {rollbackMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : `Rollback to v${dep.version}`}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()
                        ) : (
                          <div className="py-4 text-center">
                            <p className="text-[10px] text-[var(--ide-text-muted)]">No deployments yet</p>
                            <p className="text-[9px] text-[#4A5068] mt-1">Publish your project to create a deployment</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Custom Domain</span>
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
                  <PackagesPanel projectId={projectId} onClose={() => setMobileTab("editor")} onOpenFile={(filename) => {
                    const file = filesQuery.data?.find((f: any) => f.filename === filename);
                    if (file) { openFile(file); setMobileTab("editor"); }
                  }} />
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
              {mobileTab === "automations" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-automations-panel">
                  <AutomationsPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "workflows" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-workflows-panel">
                  <WorkflowsPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "monitoring" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-monitoring-panel">
                  <MonitoringPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "threads" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-threads-panel">
                  <ThreadsPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "networking" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-networking-panel">
                  <NetworkingPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "checkpoints" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-checkpoints-panel">
                  <CheckpointsPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "ssh" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-ssh-panel">
                  <SSHPanel projectId={projectId} onClose={() => setMobileTab("editor")} />
                </div>
              )}
              {mobileTab === "inbox" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-inbox-panel">
                  <FeedbackInboxPanel projectId={projectId} onClose={() => setMobileTab("editor")} onSendToAI={(text) => { setMobileTab("ai"); }} />
                </div>
              )}
              {mobileTab === "settings" && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--ide-panel)]" data-testid="mobile-settings-panel">
                  <UserSettingsPanel
                    prefs={userPrefs}
                    onPrefsChange={savePrefs as any}
                    onClose={() => setMobileTab("editor")}
                    onOpenProjectSettings={() => { setMobileTab("editor"); setProjectSettingsOpen(true); }}
                    onOpenEnvVars={() => { setMobileTab("editor"); openPanel("envVars"); }}
                  />
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
              { id: "git" as const, icon: GitBranch, label: "Git", color: "#F26522" },
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
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${sidebarOpen && !aiPanelOpen && openPanelTabs.length === 0 ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => { const shouldOpen = !sidebarOpen || aiPanelOpen || openPanelTabs.length > 0; setSidebarOpen(shouldOpen); setAiPanelOpen(false); setOpenPanelTabs([]); setActivePanelTab(null); }}
                    data-testid="activity-explorer"
                  >
                    {sidebarOpen && !aiPanelOpen && openPanelTabs.length === 0 && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <PanelLeft className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Files</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${searchPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("search")}
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
                    onClick={() => { setAiPanelOpen(!aiPanelOpen); if (!aiPanelOpen) { setSidebarOpen(false); setOpenPanelTabs([]); setActivePanelTab(null); } }}
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
                    onClick={() => openPanel("git")}
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
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${isPanelOpen("fileHistory") ? "text-[#F5A623]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("fileHistory")}
                    data-testid="activity-file-history"
                  >
                    {isPanelOpen("fileHistory") && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F5A623]" />}
                    <Clock className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">File History</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${deploymentsPanelOpen ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("deployments")}
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
                    onClick={() => openPanel("packages")}
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
                    onClick={() => openPanel("database")}
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
                    onClick={() => openPanel("tests")}
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
                    onClick={() => openPanel("security")}
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
                    onClick={() => openPanel("auth")}
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
                    onClick={() => openPanel("storage")}
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
                    onClick={() => openPanel("integrations")}
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
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${automationsPanelOpen ? "text-[#F5A623]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("automations")}
                    data-testid="activity-automations"
                  >
                    {automationsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F5A623]" />}
                    <Zap className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Automations</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${workflowsPanelOpen ? "text-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("workflows")}
                    data-testid="activity-workflows"
                  >
                    {workflowsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <GitMerge className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Workflows</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${monitoringPanelOpen ? "text-[#10B981]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("monitoring")}
                    data-testid="activity-monitoring"
                  >
                    {monitoringPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#10B981]" />}
                    <Activity className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Monitoring</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${threadsPanelOpen ? "text-[#8B5CF6]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("threads")}
                    data-testid="activity-threads"
                  >
                    {threadsPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#8B5CF6]" />}
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Threads</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${networkingPanelOpen ? "text-[#06B6D4]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("networking")}
                    data-testid="activity-networking"
                  >
                    {networkingPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#06B6D4]" />}
                    <Network className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Networking</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`relative w-full h-10 flex items-center justify-center transition-colors ${inboxPanelOpen ? "text-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
                    onClick={() => openPanel("inbox")}
                    data-testid="activity-inbox"
                  >
                    {inboxPanelOpen && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0079F2]" />}
                    <Inbox className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)] text-xs">Feedback Inbox</TooltipContent>
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
                    onClick={() => openPanel("settings")}
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

            {/* AI AGENT PANEL — Main panel (when open) */}
            {aiPanelOpen && (
              <div className={`${(isTablet && !isKeyboardModeActive) ? "w-[340px]" : "w-[50%] max-w-[700px] min-w-[380px]"} shrink-0 border-r border-[var(--ide-border)]`} data-testid="ai-agent-panel">
                <AIPanel
                  key={`ai-desktop-${projectId}`}
                  context={(activeFile || isRunnerTab) ? { language: project?.language || "javascript", filename: activeFileName, code: currentCode } : undefined}
                  onClose={() => setAiPanelOpen(false)}
                  projectId={projectId}
                  files={filesQuery.data}
                  pendingMessage={pendingAIMessage}
                  onPendingMessageConsumed={() => setPendingAIMessage(null)}
                  onAgentComplete={handleAgentComplete}
                  onCanvasFrameCreate={handleCanvasFrameCreate}
                  onConvertFrame={handleConvertFrame}
                  canvasFrames={canvasFramesQuery.data}
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

            {/* TABBED TOOL PANELS */}
            {openPanelTabs.length > 0 && !aiPanelOpen && (
              <div className={`${(isTablet && !isKeyboardModeActive) ? "w-[280px]" : "w-[300px]"} shrink-0 border-r border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col`} data-testid="tool-panel-container">
                <div className="flex items-center h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0 overflow-hidden" data-testid="panel-tab-bar">
                  <div className="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-hide h-full"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDragLeave={() => setDragOverPanelTabId(null)}
                    onDrop={() => { setDragOverPanelTabId(null); setDragPanelTabId(null); }}
                  >
                    {openPanelTabs.map((tabId) => {
                      const reg = toolPanelRegistry.find(p => p.id === tabId);
                      if (!reg) return null;
                      const Icon = reg.icon;
                      const isActive = tabId === activePanelTab;
                      const isDragOver = dragOverPanelTabId === tabId && dragPanelTabId !== tabId;
                      return (
                        <div
                          key={tabId}
                          className={`group relative flex items-center gap-1.5 px-2.5 h-full cursor-pointer shrink-0 border-b-2 transition-colors duration-100 select-none ${isActive ? "bg-[var(--ide-panel)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/40 border-b-transparent"} ${dragPanelTabId === tabId ? "opacity-40" : "opacity-100"}`}
                          style={isActive ? { borderBottomColor: reg.color } : undefined}
                          onClick={() => setActivePanelTab(tabId)}
                          draggable
                          onDragStart={(e) => handlePanelTabDragStart(e, tabId)}
                          onDragOver={(e) => handlePanelTabDragOver(e, tabId)}
                          onDrop={(e) => handlePanelTabDrop(e, tabId)}
                          onDragEnd={() => { setDragPanelTabId(null); setDragOverPanelTabId(null); }}
                          data-testid={`panel-tab-${tabId}`}
                        >
                          {isDragOver && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#0079F2] rounded-full z-10" />}
                          <Icon className="w-3 h-3 shrink-0" style={{ color: isActive ? reg.color : undefined }} />
                          <span className="text-[10px] truncate font-medium whitespace-nowrap max-w-[80px]">{reg.label}</span>
                          <button
                            className={`p-0.5 rounded hover:bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-opacity duration-100 shrink-0 ml-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            onClick={(e) => { e.stopPropagation(); closePanel(tabId); }}
                            data-testid={`button-close-panel-tab-${tabId}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <Popover open={panelAddMenuOpen} onOpenChange={setPanelAddMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="w-7 h-full flex items-center justify-center shrink-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)]/40 transition-colors border-l border-[var(--ide-border)]"
                        data-testid="button-add-panel-tab"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1 bg-[var(--ide-panel)] border-[var(--ide-border)]" side="bottom" align="end">
                      {toolPanelRegistry.filter(p => !openPanelTabs.includes(p.id)).map(panel => {
                        const Icon = panel.icon;
                        return (
                          <button
                            key={panel.id}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)] hover:text-[var(--ide-text)] transition-colors"
                            onClick={() => { openPanel(panel.id); setPanelAddMenuOpen(false); }}
                            data-testid={`button-add-panel-${panel.id}`}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: panel.color }} />
                            {panel.label}
                          </button>
                        );
                      })}
                      {toolPanelRegistry.filter(p => !openPanelTabs.includes(p.id)).length === 0 && (
                        <div className="px-2.5 py-1.5 text-[11px] text-[var(--ide-text-muted)]">All panels open</div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">

            {/* SEARCH PANEL */}
            {activePanelTab === "search" && (
              <div className="flex-1 flex flex-col" data-testid="search-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Search</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className={`w-6 h-6 rounded transition-colors ${showReplace ? "text-[#0079F2] bg-[#0079F2]/10" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`} onClick={() => setShowReplace(!showReplace)} title="Toggle Replace" data-testid="button-toggle-replace">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.293 5.293l-4-4a1 1 0 00-1.414 0l-4 4a1 1 0 001.414 1.414L5 4.414V12a3 3 0 003 3h4a1 1 0 100-2H8a1 1 0 01-1-1V4.414l1.707 1.293a1 1 0 001.414-1.414z" /></svg>
                    </Button>
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => closePanel("search")} data-testid="button-close-search">
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
                        closePanel("search");
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
            {activePanelTab === "deployments" && (
              <div className="flex-1 flex flex-col" data-testid="deployments-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                    <span className="text-[11px] font-semibold text-[var(--ide-text)]">Deployments</span>
                  </div>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded" onClick={() => closePanel("deployments")} data-testid="button-close-deployments">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="flex border-b border-[var(--ide-border)] shrink-0">
                  {(["config", "history", "process", "analytics", "settings"] as const).map(tab => (
                    <button key={tab} className={`flex-1 text-[10px] py-2 font-medium capitalize ${deployPanelTab === tab ? "text-[#0079F2] border-b-2 border-[#0079F2]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`} onClick={() => setDeployPanelTab(tab)} data-testid={`deploy-tab-${tab}`}>{tab}</button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {deployPanelTab === "config" && (
                    <div className="px-3 py-3 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${project?.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project?.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} data-testid="desktop-badge-visibility">{project?.visibility === "private" ? "Private" : project?.visibility === "team" ? "Team" : "Public"}</span>
                        <span className={`w-2 h-2 rounded-full ${project?.isPublished ? "bg-[#0CCE6B]" : "bg-[var(--ide-text-muted)]"}`} />
                        <span className="text-xs font-medium text-[var(--ide-text)]">{project?.isPublished ? "Published" : "Not published"}</span>
                      </div>
                      <div className="flex gap-1.5 mb-2">
                        {["public", "private"].map((v) => (
                          <button key={v} onClick={() => visibilityMutation.mutate(v)} disabled={visibilityMutation.isPending} className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all ${project?.visibility === v ? "bg-[#0079F2]/10 text-[#0079F2] border-[#0079F2]/30" : "bg-[var(--ide-bg)] text-[var(--ide-text-muted)] border-[var(--ide-border)]"}`} data-testid={`desktop-btn-visibility-${v}`}>{v === "public" ? "Public" : "Private"}</button>
                        ))}
                      </div>
                      {project?.isPublished && (
                        <div className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-[var(--ide-surface)] border border-[var(--ide-border)] mb-1">
                          <div className="flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-[var(--ide-text-muted)]" />
                            <span className="text-[10px] text-[var(--ide-text)]">Private Deployment</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${deployIsPrivate ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} data-testid="badge-deploy-visibility">{deployIsPrivate ? "Private" : "Public"}</span>
                            <Switch checked={deployIsPrivate} onCheckedChange={(v) => { setDeployIsPrivate(v); if (project?.isPublished) deploySettingsMutation.mutate({ isPrivate: v }); }} data-testid="toggle-deploy-private" />
                          </div>
                        </div>
                      )}
                      {project?.isPublished && (
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
                      )}

                      <div>
                        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block mb-2">Deployment Type</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            { type: "autoscale" as const, icon: Layers, label: "Autoscale", desc: "Auto-scaling web service" },
                            { type: "static" as const, icon: Globe, label: "Static", desc: "Static site hosting" },
                            { type: "reserved-vm" as const, icon: Server, label: "Reserved VM", desc: "Persistent compute" },
                            { type: "scheduled" as const, icon: Calendar, label: "Scheduled", desc: "Cron-based jobs" },
                          ]).map(({ type, icon: Icon, label, desc }) => (
                            <button
                              key={type}
                              className={`p-2 rounded-lg border text-left transition-all ${deploymentType === type ? "border-[#0079F2] bg-[#0079F2]/10" : "border-[var(--ide-border)] bg-[var(--ide-bg)] hover:border-[var(--ide-text-muted)]"}`}
                              onClick={() => setDeploymentType(type)}
                              data-testid={`deploy-type-${type}`}
                            >
                              <Icon className={`w-3.5 h-3.5 mb-1 ${deploymentType === type ? "text-[#0079F2]" : "text-[var(--ide-text-muted)]"}`} />
                              <p className="text-[10px] font-semibold text-[var(--ide-text)]">{label}</p>
                              <p className="text-[8px] text-[var(--ide-text-muted)]">{desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {(deploymentType === "autoscale" || deploymentType === "reserved-vm") && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Machine Power</span>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                              <span className="text-[10px] font-medium text-[var(--ide-text)]">{deployCpu} vCPU</span>
                            </div>
                            <input type="range" min="0.25" max="8" step="0.25" value={deployCpu} onChange={e => setDeployCpu(parseFloat(e.target.value))} className="w-full h-1.5 accent-[#0079F2]" data-testid="slider-cpu" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><HardDrive className="w-3 h-3" /> RAM</span>
                              <span className="text-[10px] font-medium text-[var(--ide-text)]">{deployRam >= 1024 ? `${(deployRam / 1024).toFixed(1)} GB` : `${deployRam} MB`}</span>
                            </div>
                            <input type="range" min="256" max="16384" step="256" value={deployRam} onChange={e => setDeployRam(parseInt(e.target.value))} className="w-full h-1.5 accent-[#0079F2]" data-testid="slider-ram" />
                          </div>
                          {deploymentType === "autoscale" && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-[var(--ide-text-muted)]">Max Machines</span>
                                <span className="text-[10px] font-medium text-[var(--ide-text)]">{deployMaxMachines}</span>
                              </div>
                              <input type="range" min="1" max="10" step="1" value={deployMaxMachines} onChange={e => setDeployMaxMachines(parseInt(e.target.value))} className="w-full h-1.5 accent-[#0079F2]" data-testid="slider-max-machines" />
                              <p className="text-[8px] text-[var(--ide-text-muted)] mt-1">~{(deployCpu * deployMaxMachines * 0.05).toFixed(2)} compute units/hr</p>
                            </div>
                          )}
                        </div>
                      )}

                      {deploymentType === "static" && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Static Config</span>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Public Directory</label>
                            <input type="text" value={deployPublicDir} onChange={e => setDeployPublicDir(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="dist" data-testid="input-public-dir" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Build Command</label>
                            <input type="text" value={deployBuildCommand} onChange={e => setDeployBuildCommand(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="npm run build" data-testid="input-build-command" />
                          </div>
                        </div>
                      )}

                      {deploymentType === "reserved-vm" && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">VM Config</span>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">App Type</label>
                            <div className="flex gap-2">
                              {(["web_server", "background_worker"] as const).map(t => (
                                <button key={t} className={`flex-1 text-[10px] py-1.5 rounded-md border ${deployAppType === t ? "border-[#0079F2] bg-[#0079F2]/10 text-[#0079F2]" : "border-[var(--ide-border)] text-[var(--ide-text-muted)]"}`} onClick={() => setDeployAppType(t)} data-testid={`app-type-${t}`}>
                                  {t === "web_server" ? "Web Server" : "Background Worker"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Build Command</label>
                            <input type="text" value={deployBuildCommand} onChange={e => setDeployBuildCommand(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="npm run build" data-testid="input-vm-build-command" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Run Command</label>
                            <input type="text" value={deployRunCommand} onChange={e => setDeployRunCommand(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="npm start" data-testid="input-vm-run-command" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Port Mapping</label>
                            <input type="number" value={deployPortMapping} onChange={e => setDeployPortMapping(parseInt(e.target.value) || 3000)} min={1} max={65535} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="3000" data-testid="input-vm-port-mapping" />
                          </div>
                        </div>
                      )}

                      {deploymentType === "scheduled" && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Schedule Config</span>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Schedule (natural language)</label>
                            <div className="flex gap-1">
                              <input type="text" value={deployScheduleDesc} onChange={e => setDeployScheduleDesc(e.target.value)} className="flex-1 h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] outline-none focus:border-[#0079F2]" placeholder="Every day at 3am" data-testid="input-schedule-desc" />
                              <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => { if (deployScheduleDesc.trim()) convertCronMutation.mutate(deployScheduleDesc); }} disabled={convertCronMutation.isPending || !deployScheduleDesc.trim()} data-testid="button-convert-cron">
                                {convertCronMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Cron Expression</label>
                            <input type="text" value={deployCronExpr} onChange={e => setDeployCronExpr(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="0 3 * * *" data-testid="input-cron-expr" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Build Command</label>
                            <input type="text" value={deployBuildCommand} onChange={e => setDeployBuildCommand(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="npm run build" data-testid="input-sched-build-command" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Run Command</label>
                            <input type="text" value={deployRunCommand} onChange={e => setDeployRunCommand(e.target.value)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" placeholder="node job.js" data-testid="input-sched-run-command" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--ide-text-muted)] block mb-1">Job Timeout (seconds)</label>
                            <input type="number" value={deployJobTimeout} onChange={e => setDeployJobTimeout(parseInt(e.target.value) || 300)} className="w-full h-7 text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] font-mono outline-none focus:border-[#0079F2]" data-testid="input-job-timeout" />
                          </div>
                        </div>
                      )}

                      {(deploymentType === "autoscale" || deploymentType === "static" || deploymentType === "reserved-vm" || deploymentType === "scheduled") && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Deployment Secrets</span>
                            <button className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setDeploySecretsEntries(prev => [...prev, { key: "", value: "" }])} data-testid="button-add-deploy-secret"><Plus className="w-3 h-3" /></button>
                          </div>
                          {deploySecretsEntries.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-1 mb-1">
                              <input type="text" value={entry.key} onChange={e => { const n = [...deploySecretsEntries]; n[idx].key = e.target.value; setDeploySecretsEntries(n); }} className="flex-1 h-6 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1.5 text-[var(--ide-text)] font-mono outline-none" placeholder="KEY" data-testid={`input-secret-key-${idx}`} />
                              <input type="password" value={entry.value} onChange={e => { const n = [...deploySecretsEntries]; n[idx].value = e.target.value; setDeploySecretsEntries(n); }} className="flex-1 h-6 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1.5 text-[var(--ide-text)] font-mono outline-none" placeholder="value" data-testid={`input-secret-value-${idx}`} />
                              <button onClick={() => setDeploySecretsEntries(prev => prev.filter((_, i) => i !== idx))} className="text-[var(--ide-text-muted)] hover:text-red-400"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        className={`w-full h-9 rounded-lg text-[12px] font-semibold gap-2 ${project?.isPublished ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" : "bg-[#0079F2] hover:bg-[#0066CC] text-white"}`}
                        onClick={() => publishMutation.mutate()}
                        disabled={publishMutation.isPending}
                        data-testid="button-deploy-publish"
                      >
                        {publishMutation.isPending ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {project?.isPublished ? "Unpublishing..." : "Deploying..."}</>
                        ) : project?.isPublished ? (
                          <><X className="w-3.5 h-3.5" /> Unpublish</>
                        ) : (
                          <><Rocket className="w-3.5 h-3.5" /> Deploy {deploymentType === "autoscale" ? "Autoscale" : deploymentType === "static" ? "Static" : deploymentType === "reserved-vm" ? "Reserved VM" : "Scheduled"}</>
                        )}
                      </Button>
                    </div>
                  )}

                  {deployPanelTab === "history" && (
                    <div className="px-3 py-3 space-y-3">
                      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Deployment History</span>
                      <div className="space-y-1.5">
                        {deploymentsQuery.isError ? (
                          <div className="py-4 text-center">
                            <p className="text-[10px] text-red-400">Failed to load deployments</p>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-[var(--ide-text-muted)] mt-1" onClick={() => deploymentsQuery.refetch()} data-testid="retry-deployments">Retry</Button>
                          </div>
                        ) : deploymentsQuery.isLoading ? (
                          <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)] mx-auto" /></div>
                        ) : (deploymentsQuery.data || []).length > 0 ? (
                          (() => {
                            const deps = deploymentsQuery.data || [];
                            const currentLiveIdx = deps.findIndex(d => d.status === "live");
                            return deps.map((dep, idx) => {
                              const isCurrentLive = idx === currentLiveIdx;
                              const statusColors: Record<string, string> = {
                                live: "bg-green-500/10 text-green-400 border-green-500/20",
                                building: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                                failed: "bg-red-500/10 text-red-400 border-red-500/20",
                                stopped: "bg-gray-500/10 text-gray-400 border-gray-500/20",
                              };
                              const dotColors: Record<string, string> = {
                                live: "bg-[#0CCE6B]",
                                building: "bg-blue-400",
                                failed: "bg-red-400",
                                stopped: "bg-gray-400",
                              };
                              const duration = dep.finishedAt && dep.createdAt ? Math.round((new Date(dep.finishedAt).getTime() - new Date(dep.createdAt).getTime()) / 1000) : null;
                              const typeLabel = dep.deploymentType || "static";
                              return (
                                <div key={dep.id} className={`rounded-md bg-[var(--ide-bg)] border ${isCurrentLive ? "border-green-500/30" : "border-[var(--ide-border)]"}`} data-testid={`deployment-${dep.id}`}>
                                  <button className="flex items-center gap-2 px-2.5 py-2 w-full text-left" onClick={() => setExpandedDeployId(expandedDeployId === dep.id ? null : dep.id)} data-testid={`toggle-deployment-${dep.id}`}>
                                    {expandedDeployId === dep.id ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />}
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColors[dep.status] || "bg-gray-400"} shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] text-[var(--ide-text)] font-medium">v{dep.version} <span className="text-[8px] text-[var(--ide-text-muted)] font-normal">{typeLabel}</span></p>
                                      <p className="text-[9px] text-[var(--ide-text-muted)]">{new Date(dep.createdAt).toLocaleString()}{duration !== null ? ` · ${duration}s` : ""}</p>
                                    </div>
                                    {dep.isPrivate && <Lock className="w-3 h-3 text-amber-500 shrink-0" data-testid={`lock-icon-${dep.id}`} />}
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${statusColors[dep.status] || statusColors.stopped}`}>{isCurrentLive ? "Live" : dep.status}</span>
                                  </button>
                                  {expandedDeployId === dep.id && (
                                    <div className="px-2.5 pb-2.5 space-y-2">
                                      {dep.buildLog && (
                                        <div className="bg-[var(--ide-panel)] rounded p-2 max-h-[150px] overflow-y-auto">
                                          <pre className="text-[9px] text-[var(--ide-text-muted)] font-mono whitespace-pre-wrap" data-testid={`build-log-${dep.id}`}>{dep.buildLog}</pre>
                                        </div>
                                      )}
                                      {dep.url && (
                                        <a href={dep.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#0079F2] hover:underline block truncate" data-testid={`deploy-url-${dep.id}`}>{dep.url}</a>
                                      )}
                                      {!isCurrentLive && (dep.status === "live" || dep.status === "stopped") && (
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] w-full border-[var(--ide-border)] text-[var(--ide-text-secondary)]" onClick={() => rollbackMutation.mutate(dep.version)} disabled={rollbackMutation.isPending} data-testid={`rollback-${dep.id}`}>
                                          {rollbackMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : `Rollback to v${dep.version}`}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()
                        ) : (
                          <div className="py-4 text-center">
                            <p className="text-[10px] text-[var(--ide-text-muted)]">No deployments yet</p>
                            <p className="text-[9px] text-[#4A5068] mt-1">Deploy your project to create a deployment</p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-[var(--ide-border)] pt-3">
                        <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block mb-2">Custom Domain</span>
                        {customDomains.length > 0 ? (
                          <div className="space-y-2">
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
                  )}

                  {deployPanelTab === "process" && (
                    <div className="px-3 py-3 space-y-3">
                      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Process Manager</span>
                      {deployProcessQuery.isLoading ? (
                        <div className="text-xs text-[var(--ide-text-muted)] py-4 text-center">Loading...</div>
                      ) : !deployProcessQuery.data?.process ? (
                        <div className="text-xs text-[var(--ide-text-muted)] py-4 text-center">No running process. Deploy to start one.</div>
                      ) : (() => {
                        const proc = deployProcessQuery.data.process;
                        const statusColor = (proc.status === "running" || proc.status === "live") ? "bg-[#0CCE6B]" : proc.status === "starting" ? "bg-amber-400" : (proc.status === "crashed" || proc.status === "stopped") ? "bg-red-500" : proc.status === "restarting" ? "bg-amber-400" : "bg-[var(--ide-text-muted)]";
                        const statusLabel = proc.status === "live" ? "Live" : proc.status === "running" ? "Running" : proc.status === "starting" ? "Starting" : proc.status === "crashed" ? "Crashed" : proc.status === "stopped" ? "Stopped" : proc.status === "restarting" ? "Restarting" : proc.status;
                        const uptime = proc.startedAt ? Math.floor((Date.now() - new Date(proc.startedAt).getTime()) / 1000) : 0;
                        const uptimeStr = uptime > 3600 ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m` : uptime > 60 ? `${Math.floor(uptime / 60)}m ${uptime % 60}s` : `${uptime}s`;
                        return (
                          <>
                            <div className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
                                  <span className="text-xs font-semibold text-[var(--ide-text)]" data-testid="process-status-label">{statusLabel}</span>
                                </div>
                                <div className="flex gap-1.5">
                                  <button className="text-[9px] px-2 py-1 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-surface-hover)]" onClick={() => restartProcessMutation.mutate()} disabled={restartProcessMutation.isPending} data-testid="button-restart-process">{restartProcessMutation.isPending ? "Restarting..." : "Restart"}</button>
                                  <button className="text-[9px] px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20" onClick={() => stopProcessMutation.mutate()} disabled={stopProcessMutation.isPending} data-testid="button-stop-process">{stopProcessMutation.isPending ? "Stopping..." : "Stop"}</button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <span className="text-[var(--ide-text-muted)]">Port</span>
                                  <span className="ml-1 text-[var(--ide-text)] font-mono" data-testid="text-process-port">{proc.port}</span>
                                </div>
                                <div>
                                  <span className="text-[var(--ide-text-muted)]">Uptime</span>
                                  <span className="ml-1 text-[var(--ide-text)]" data-testid="text-process-uptime">{uptimeStr}</span>
                                </div>
                                <div>
                                  <span className="text-[var(--ide-text-muted)]">Restarts</span>
                                  <span className="ml-1 text-[var(--ide-text)]" data-testid="text-process-restarts">{proc.restartCount}</span>
                                </div>
                                <div>
                                  <span className="text-[var(--ide-text-muted)]">PID</span>
                                  <span className="ml-1 text-[var(--ide-text)] font-mono">{proc.pid || "—"}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5 pt-1">
                                <div className="text-[10px] text-[var(--ide-text-muted)]">CPU Usage</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-[var(--ide-border)] overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${(proc.resourceUsage?.cpuPercent || 0) > 80 ? "bg-red-500" : (proc.resourceUsage?.cpuPercent || 0) > 50 ? "bg-amber-400" : "bg-[#0CCE6B]"}`} style={{ width: `${Math.min(100, proc.resourceUsage?.cpuPercent || 0)}%` }} />
                                  </div>
                                  <span className="text-[10px] text-[var(--ide-text)] w-14 text-right" data-testid="text-cpu-usage">{proc.resourceUsage?.cpuPercent?.toFixed(1) || "0.0"}% / {proc.resourceLimits?.maxCpuPercent || 100}%</span>
                                </div>
                                <div className="text-[10px] text-[var(--ide-text-muted)]">Memory Usage</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-[var(--ide-border)] overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${(proc.resourceUsage?.memoryMb || 0) > (proc.resourceLimits?.maxMemoryMB || 512) * 0.8 ? "bg-red-500" : (proc.resourceUsage?.memoryMb || 0) > (proc.resourceLimits?.maxMemoryMB || 512) * 0.5 ? "bg-amber-400" : "bg-[#0079F2]"}`} style={{ width: `${Math.min(100, (proc.resourceUsage?.memoryMb || 0) / (proc.resourceLimits?.maxMemoryMB || 512) * 100)}%` }} />
                                  </div>
                                  <span className="text-[10px] text-[var(--ide-text)] w-16 text-right" data-testid="text-memory-usage">{proc.resourceUsage?.memoryMb || 0} / {proc.resourceLimits?.maxMemoryMB || 512} MB</span>
                                </div>
                              </div>
                              {deployProcessQuery.data.liveUrl && (
                                <div className="text-[10px]">
                                  <span className="text-[var(--ide-text-muted)]">URL: </span>
                                  <a href={deployProcessQuery.data.liveUrl} target="_blank" rel="noopener noreferrer" className="text-[#0079F2] hover:underline" data-testid="link-process-url">{deployProcessQuery.data.liveUrl}</a>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Live Logs</span>
                                <button className="text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setDeployProcessLogs([])} data-testid="button-clear-logs">Clear</button>
                              </div>
                              <div className="bg-[#0D1117] border border-[var(--ide-border)] rounded-lg h-48 overflow-y-auto font-mono text-[10px] leading-4 p-2" data-testid="deploy-process-logs">
                                {deployProcessLogs.length === 0 ? (
                                  <div className="text-[var(--ide-text-muted)] text-center py-8">Waiting for logs...</div>
                                ) : (
                                  deployProcessLogs.map((line, i) => (
                                    <div key={i} className={`whitespace-pre-wrap break-all ${line.includes("[ERROR]") || line.includes("Error") ? "text-red-400" : line.includes("[WARN]") ? "text-amber-400" : "text-[#8B949E]"}`}>{line}</div>
                                  ))
                                )}
                                <div ref={deployLogsEndRef} />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {deployPanelTab === "analytics" && (
                    <div className="px-3 py-3 space-y-3">
                      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Visitor Analytics</span>
                      {deployAnalyticsQuery.isLoading ? (
                        <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)] mx-auto" /></div>
                      ) : deployAnalyticsQuery.data ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="analytics-page-views">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Eye className="w-3 h-3 text-blue-400" />
                                <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Page Views</span>
                              </div>
                              <span className="text-lg font-bold text-[var(--ide-text)]">{deployAnalyticsQuery.data.pageViews}</span>
                            </div>
                            <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid="analytics-unique-visitors">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Users className="w-3 h-3 text-green-400" />
                                <span className="text-[9px] text-[var(--ide-text-muted)] uppercase">Unique Visitors</span>
                              </div>
                              <span className="text-lg font-bold text-[var(--ide-text)]">{deployAnalyticsQuery.data.uniqueVisitors}</span>
                            </div>
                          </div>

                          {deployAnalyticsQuery.data.trafficByDay.length > 0 && (
                            <div data-testid="analytics-traffic-chart">
                              <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block mb-2">Traffic Over Time</span>
                              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]">
                                <div className="flex items-end gap-0.5 h-[80px]">
                                  {(() => {
                                    const data = deployAnalyticsQuery.data!.trafficByDay;
                                    const max = Math.max(...data.map(d => d.views), 1);
                                    return data.slice(-14).map((d, i) => (
                                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                        <div className="w-full bg-[#0079F2] rounded-t" style={{ height: `${(d.views / max) * 60}px`, minHeight: "2px" }} title={`${d.date}: ${d.views} views`} />
                                        <span className="text-[7px] text-[var(--ide-text-muted)]">{d.date.slice(5)}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}

                          {deployAnalyticsQuery.data.topReferrers.length > 0 && (
                            <div data-testid="analytics-referrers">
                              <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block mb-2">Top Referrers</span>
                              <div className="space-y-1">
                                {deployAnalyticsQuery.data.topReferrers.map((ref, i) => (
                                  <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-[var(--ide-surface)] text-[11px]">
                                    <span className="text-[var(--ide-text)] truncate flex-1">{ref.referrer}</span>
                                    <span className="text-[var(--ide-text-muted)] font-mono ml-2">{ref.count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {deployAnalyticsQuery.data.pageViews === 0 && (
                            <div className="py-4 text-center">
                              <BarChart3 className="w-6 h-6 text-[var(--ide-text-muted)] mx-auto mb-2" />
                              <p className="text-[10px] text-[var(--ide-text-muted)]">No visitor data yet</p>
                              <p className="text-[9px] text-[#4A5068] mt-1">Analytics will appear when your deployed app gets visitors</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-4 text-center">
                          <BarChart3 className="w-6 h-6 text-[var(--ide-text-muted)] mx-auto mb-2" />
                          <p className="text-[10px] text-[var(--ide-text-muted)]">Deploy your project to see analytics</p>
                        </div>
                      )}
                    </div>
                  )}

                  {deployPanelTab === "settings" && (
                    <div className="px-3 py-3 space-y-3">
                      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block">Access Controls</span>
                      <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)]">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                          <div>
                            <p className="text-[11px] text-[var(--ide-text)] font-medium">Private Deployment</p>
                            <p className="text-[9px] text-[var(--ide-text-muted)]">Teams plan only</p>
                          </div>
                        </div>
                        <Switch checked={deployIsPrivate} onCheckedChange={(v) => { setDeployIsPrivate(v); if (project?.isPublished) deploySettingsMutation.mutate({ isPrivate: v }); }} data-testid="toggle-private" />
                      </div>

                      <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider block mt-3">Badge & Feedback</span>
                      <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)]">
                        <div className="flex items-center gap-2">
                          <Rocket className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                          <div>
                            <p className="text-[11px] text-[var(--ide-text)] font-medium">Made with E-Code Badge</p>
                            <p className="text-[9px] text-[var(--ide-text-muted)]">Show badge on deployed app</p>
                          </div>
                        </div>
                        <Switch checked={deployShowBadge} onCheckedChange={(v) => { setDeployShowBadge(v); if (project?.isPublished) deploySettingsMutation.mutate({ showBadge: v }); }} data-testid="toggle-badge" />
                      </div>
                      <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)]">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                          <div>
                            <p className="text-[11px] text-[var(--ide-text)] font-medium">Feedback Widget</p>
                            <p className="text-[9px] text-[var(--ide-text-muted)]">Collect feedback from visitors</p>
                          </div>
                        </div>
                        <Switch checked={deployEnableFeedback} onCheckedChange={(v) => { setDeployEnableFeedback(v); if (project?.isPublished) deploySettingsMutation.mutate({ enableFeedback: v }); }} data-testid="toggle-feedback" />
                      </div>
                    </div>
                  )}

                  <div className="px-3 pb-3">
                    <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Database</span>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-[var(--ide-text)]">Create production database</p>
                          <p className="text-[9px] text-[var(--ide-text-muted)]">Provision a separate database schema for production</p>
                        </div>
                        <Switch checked={deployCreateProductionDb} onCheckedChange={setDeployCreateProductionDb} data-testid="toggle-create-production-db" />
                      </div>
                      {deployCreateProductionDb && (
                        <div className="flex items-center justify-between pl-3">
                          <div>
                            <p className="text-[11px] text-[var(--ide-text)]">Seed from dev data</p>
                            <p className="text-[9px] text-[var(--ide-text-muted)]">Copy development data to production</p>
                          </div>
                          <Switch checked={deploySeedProductionDb} onCheckedChange={setDeploySeedProductionDb} data-testid="toggle-seed-production-db" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GIT PANEL */}
            {activePanelTab === "git" && (
              <div className="flex-1 flex flex-col" data-testid="git-panel">
                <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
                  <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Source Control</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={() => closePanel("git")} data-testid="button-close-git">
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
                          checkoutMutation.mutate({ branchName: newBranch });
                        }}
                        disabled={mergeInProgress}
                        className="flex-1 text-[11px] text-[var(--ide-text)] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1 outline-none focus:border-[#0079F2] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] shrink-0" onClick={() => setShowBranchDialog(true)} title="Create branch" disabled={mergeInProgress} data-testid="button-create-branch">
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
                      disabled={!commitMessage.trim() || commitMutation.isPending || commitMessage === "Generating..." || stagedFiles.size === 0 || mergeInProgress}
                      data-testid="button-commit"
                    >
                      {commitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {stagedFiles.size > 0 ? `Commit ${stagedFiles.size} file${stagedFiles.size > 1 ? "s" : ""} to ${currentBranch}` : `No files staged`}
                    </Button>
                  </div>

                  {/* Changes section */}
                  <div className="border-b border-[var(--ide-border)]">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">Changes</span>
                      <div className="flex items-center gap-1.5">
                        {(gitDiffQuery.data?.changes?.length || 0) > 0 && (
                          <button
                            className="text-[9px] px-1.5 py-0.5 rounded text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
                            onClick={() => {
                              const allFiles = gitDiffQuery.data?.changes?.map((c: any) => c.filename) || [];
                              if (stagedFiles.size === allFiles.length) {
                                setStagedFiles(new Set());
                              } else {
                                setStagedFiles(new Set(allFiles));
                              }
                            }}
                            data-testid="button-toggle-stage-all"
                          >
                            {stagedFiles.size === (gitDiffQuery.data?.changes?.length || 0) && stagedFiles.size > 0 ? "Unstage All" : "Stage All"}
                          </button>
                        )}
                        <span className="text-[10px] text-[var(--ide-text-secondary)] font-mono">{stagedFiles.size > 0 ? `${stagedFiles.size}/` : ""}{gitDiffQuery.data?.changes?.length || 0}</span>
                      </div>
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
                          <div
                            key={change.filename}
                            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--ide-surface)]/50 text-left transition-colors group"
                            data-testid={`git-change-${change.filename}`}
                          >
                            <input
                              type="checkbox"
                              checked={stagedFiles.has(change.filename)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setStagedFiles(prev => {
                                  const next = new Set(prev);
                                  if (next.has(change.filename)) {
                                    next.delete(change.filename);
                                  } else {
                                    next.add(change.filename);
                                  }
                                  return next;
                                });
                              }}
                              className="w-3 h-3 rounded border-[var(--ide-border)] accent-[#0079F2] shrink-0 cursor-pointer"
                              data-testid={`checkbox-stage-${change.filename}`}
                            />
                            <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${change.status === "added" ? "text-[#0CCE6B]" : change.status === "deleted" ? "text-red-400" : "text-[#F5A623]"}`}>
                              {change.status === "added" ? "A" : change.status === "deleted" ? "D" : "M"}
                            </span>
                            <button
                              className="text-[11px] text-[var(--ide-text-secondary)] truncate flex-1 group-hover:text-[var(--ide-text)] text-left"
                              onClick={() => { setDiffFile(change); setShowDiffModal(true); }}
                              data-testid={`button-diff-${change.filename}`}
                            >
                              {change.filename}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Merge Conflicts section */}
                  {mergeConflicts.length > 0 && (
                    <div className="border-b border-[var(--ide-border)]">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Merge In Progress</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[9px] text-[#F5A623] hover:bg-[#F5A623]/10 rounded border border-[#F5A623]/30 gap-1"
                          onClick={() => setMergeConflictPanelOpen(true)}
                          data-testid="button-open-merge-panel"
                        >
                          <GitMerge className="w-3 h-3" />
                          Open Resolver ({mergeResolutions.length}/{mergeConflicts.length})
                        </Button>
                      </div>
                      <div className="pb-2 px-3 space-y-1.5">
                        <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 mb-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                            <span className="text-[10px] text-yellow-400 font-medium">
                              Commits, checkouts, and branch changes are disabled during merge
                            </span>
                          </div>
                          <div className="w-full bg-[var(--ide-bg)] rounded-full h-1.5 mt-1.5">
                            <div
                              className="bg-[#0CCE6B] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${mergeConflicts.length > 0 ? (mergeResolutions.length / mergeConflicts.length) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-[var(--ide-text-muted)] mt-1 block">
                            {mergeResolutions.length}/{mergeConflicts.length} conflicts resolved
                          </span>
                        </div>
                        {mergeConflicts.map((conflict) => {
                          const isResolved = mergeResolutions.some(r => r.filename === conflict.filename);
                          const isBinaryConflict = conflict.mergedContent?.startsWith("[Binary file conflict");
                          return (
                            <div key={conflict.filename} className={`rounded border p-2 flex items-center gap-1.5 ${isResolved ? "border-[#0CCE6B]/30 bg-[#0CCE6B]/5" : "border-red-500/30 bg-red-500/5"}`} data-testid={`conflict-${conflict.filename}`}>
                              {isResolved ? (
                                <Check className="w-3 h-3 text-[#0CCE6B] shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                              )}
                              <span className="text-[11px] text-[var(--ide-text)] font-mono truncate flex-1">{conflict.filename}</span>
                              {isBinaryConflict && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">Binary</span>}
                              {isResolved ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30">Resolved</span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">Conflicting</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                                  disabled={checkoutMutation.isPending || mergeInProgress}
                                  data-testid={`button-checkout-${commit.id}`}
                                >
                                  {mergeInProgress ? "Merge in progress" : checkoutMutation.isPending ? "Restoring..." : "Restore this version"}
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
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">GitHub Sync</span>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      {githubStatusQuery.data?.connected && githubStatusQuery.data?.githubRepo ? (
                        <>
                          <div className="flex items-center gap-2 text-[11px]">
                            <GitBranch className="w-3 h-3 text-[#0CCE6B] shrink-0" />
                            <a href={`https://github.com/${githubStatusQuery.data.githubRepo}`} target="_blank" rel="noopener noreferrer" className="text-[#0079F2] hover:underline truncate" data-testid="link-github-repo">
                              {githubStatusQuery.data.githubRepo}
                            </a>
                            <button
                              className="text-[var(--ide-text-muted)] hover:text-red-400 shrink-0"
                              onClick={async () => {
                                try {
                                  await apiRequest("DELETE", `/api/projects/${projectId}/git/connect-github`);
                                  queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] });
                                  toast({ title: "Disconnected from GitHub" });
                                } catch {}
                              }}
                              data-testid="button-disconnect-github"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {((githubStatusQuery.data?.ahead || 0) > 0 || (githubStatusQuery.data?.behind || 0) > 0) && (
                            <div className="flex items-center gap-2 text-[10px] text-[var(--ide-text-muted)]" data-testid="sync-status">
                              {(githubStatusQuery.data?.ahead || 0) > 0 && (
                                <span className="text-[#F5A623]">↑ {githubStatusQuery.data?.ahead} ahead</span>
                              )}
                              {(githubStatusQuery.data?.behind || 0) > 0 && (
                                <span className="text-[#0079F2]">↓ {githubStatusQuery.data?.behind} behind</span>
                              )}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <Button
                              className="flex-1 h-7 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white rounded font-medium gap-1"
                              onClick={async () => {
                                setPushing(true);
                                try {
                                  const res = await apiRequest("POST", `/api/projects/${projectId}/git/push`);
                                  const data = await res.json();
                                  queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] });
                                  toast({ title: "Pushed to GitHub", description: `${data.filesPushed} files pushed` });
                                } catch (err: unknown) {
                                  const message = err instanceof Error ? err.message : "Push failed";
                                  toast({ title: "Push failed", description: message, variant: "destructive" });
                                } finally {
                                  setPushing(false);
                                }
                              }}
                              disabled={pushing}
                              data-testid="button-git-push"
                            >
                              {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              Push
                            </Button>
                            <Button
                              className="flex-1 h-7 text-[10px] bg-[var(--ide-surface)] hover:bg-[var(--ide-surface)]/80 text-[var(--ide-text)] rounded font-medium gap-1 border border-[var(--ide-border)]"
                              onClick={async () => {
                                setPulling(true);
                                try {
                                  const pullHeaders: Record<string, string> = { "Content-Type": "application/json" };
                                  const csrf = getCsrfToken();
                                  if (csrf) pullHeaders["X-CSRF-Token"] = csrf;
                                  const res = await fetch(`/api/projects/${projectId}/git/pull`, {
                                    method: "POST",
                                    headers: pullHeaders,
                                    credentials: "include",
                                  });
                                  const data = await res.json();
                                  if (res.status === 409 && data.conflicts) {
                                    setMergeConflicts(data.conflicts);
                                    setMergeResolutions([]);
                                    setConflictResolutions({});
                                    setMergeConflictPanelOpen(true);
                                    toast({ title: "Merge conflicts detected", description: `${data.conflicts.length} file(s) have conflicts that need resolution`, variant: "destructive" });
                                  } else if (!res.ok) {
                                    toast({ title: "Pull failed", description: data.message || "Pull failed", variant: "destructive" });
                                  } else {
                                    setFileContents({});
                                    setOpenTabs([]);
                                    setActiveFileId(null);
                                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] });
                                    toast({ title: "Pulled from GitHub", description: `${data.filesPulled} files updated` });
                                  }
                                } catch (err: unknown) {
                                  const message = err instanceof Error ? err.message : "Pull failed";
                                  toast({ title: "Pull failed", description: message, variant: "destructive" });
                                } finally {
                                  setPulling(false);
                                }
                              }}
                              disabled={pulling}
                              data-testid="button-git-pull"
                            >
                              {pulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              Pull
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {showConnectGithubDialog ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={connectGithubInput}
                                onChange={(e) => setConnectGithubInput(e.target.value)}
                                placeholder="owner/repo"
                                className="w-full text-[11px] bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2.5 py-1.5 text-[var(--ide-text)] placeholder-[#4A5068] outline-none focus:border-[#0079F2]"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && connectGithubInput.trim().includes("/")) {
                                    (async () => {
                                      try {
                                        await apiRequest("POST", `/api/projects/${projectId}/git/connect-github`, { repoFullName: connectGithubInput.trim() });
                                        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] });
                                        setShowConnectGithubDialog(false);
                                        setConnectGithubInput("");
                                        toast({ title: "Connected to GitHub", description: connectGithubInput.trim() });
                                      } catch (err: unknown) {
                                        const message = err instanceof Error ? err.message : "Connection failed";
                                        toast({ title: "Connection failed", description: message, variant: "destructive" });
                                      }
                                    })();
                                  }
                                  if (e.key === "Escape") { setShowConnectGithubDialog(false); setConnectGithubInput(""); }
                                }}
                                autoFocus
                                data-testid="input-connect-github"
                              />
                              <div className="flex gap-1">
                                <Button
                                  className="flex-1 h-6 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white rounded"
                                  onClick={async () => {
                                    if (!connectGithubInput.trim().includes("/")) return;
                                    try {
                                      await apiRequest("POST", `/api/projects/${projectId}/git/connect-github`, { repoFullName: connectGithubInput.trim() });
                                      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] });
                                      setShowConnectGithubDialog(false);
                                      setConnectGithubInput("");
                                      toast({ title: "Connected to GitHub", description: connectGithubInput.trim() });
                                    } catch (err: unknown) {
                                      const message = err instanceof Error ? err.message : "Connection failed";
                                      toast({ title: "Connection failed", description: message, variant: "destructive" });
                                    }
                                  }}
                                  disabled={!connectGithubInput.trim().includes("/")}
                                  data-testid="button-confirm-connect-github"
                                >
                                  Connect
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-6 text-[10px] text-[var(--ide-text-muted)]"
                                  onClick={() => { setShowConnectGithubDialog(false); setConnectGithubInput(""); }}
                                  data-testid="button-cancel-connect-github"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              className="w-full h-7 text-[10px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-dashed border-[var(--ide-border)] rounded gap-1.5"
                              onClick={() => setShowConnectGithubDialog(true)}
                              data-testid="button-connect-github"
                            >
                              <GitBranch className="w-3 h-3" />
                              Connect GitHub Repository
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[var(--ide-border)]">
                    <div className="px-3 py-2">
                      <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">GitHub</span>
                    </div>
                    <GitHubPanel projectId={projectId} projectName={project?.name || "project"} onImported={(newProjectId) => { if (newProjectId) { setLocation(`/project/${newProjectId}`); } else { filesQuery.refetch(); } }} onCloned={() => { setFileContents({}); setOpenTabs([]); setActiveFileId(null); filesQuery.refetch(); queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/commits"] }); queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/diff"] }); queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "git/github-status"] }); }} />
                  </div>

                  <BackupRecoverySection projectId={projectId} />
                </div>
              </div>
            )}

            {activePanelTab === "packages" && (
              <div className="flex-1 flex flex-col">
                <PackagesPanel projectId={projectId} onClose={() => closePanel("packages")} onOpenFile={(filename) => {
                  const file = filesQuery.data?.find((f: any) => f.filename === filename);
                  if (file) openFile(file);
                }} />
              </div>
            )}

            {activePanelTab === "database" && (
              <div className="flex-1 flex flex-col" data-testid="database-sidebar">
                <DatabasePanel projectId={projectId} onClose={() => closePanel("database")} />
              </div>
            )}

            {activePanelTab === "tests" && (
              <div className="flex-1 flex flex-col" data-testid="tests-sidebar">
                <TestRunnerPanel projectId={projectId} onClose={() => closePanel("tests")} />
              </div>
            )}

            {activePanelTab === "security" && (
              <div className="flex-1 flex flex-col" data-testid="security-sidebar">
                <SecurityScannerPanel projectId={projectId} onClose={() => closePanel("security")} />
              </div>
            )}

            {activePanelTab === "storage" && (
              <div className="flex-1 flex flex-col" data-testid="storage-sidebar">
                <AppStoragePanel projectId={projectId} onClose={() => closePanel("storage")} />
              </div>
            )}

            {activePanelTab === "auth" && (
              <div className="flex-1 flex flex-col" data-testid="auth-sidebar">
                <AuthPanel projectId={projectId} onClose={() => closePanel("auth")} />
              </div>
            )}

            {activePanelTab === "integrations" && (
              <div className="flex-1 flex flex-col" data-testid="integrations-sidebar">
                <IntegrationsPanel projectId={projectId} onClose={() => closePanel("integrations")} />
              </div>
            )}

            {activePanelTab === "automations" && (
              <div className="flex-1 flex flex-col" data-testid="automations-sidebar">
                <AutomationsPanel projectId={projectId} onClose={() => closePanel("automations")} />
              </div>
            )}

            {activePanelTab === "agentAutomations" && (
              <div className="flex-1 flex flex-col" data-testid="agent-automations-sidebar">
                <AgentAutomationsPane projectId={projectId} onClose={() => closePanel("agentAutomations")} />
              </div>
            )}

            {activePanelTab === "workflows" && (
              <div className="flex-1 flex flex-col" data-testid="workflows-sidebar">
                <WorkflowsPanel projectId={projectId} onClose={() => closePanel("workflows")} />
              </div>
            )}

            {activePanelTab === "monitoring" && (
              <div className="flex-1 flex flex-col" data-testid="monitoring-sidebar">
                <MonitoringPanel projectId={projectId} onClose={() => closePanel("monitoring")} />
              </div>
            )}

            {activePanelTab === "publishing" && (
              <div className="flex-1 flex flex-col" data-testid="publishing-sidebar">
                <PublishingPanel projectId={projectId} onClose={() => closePanel("publishing")} />
              </div>
            )}

            {activePanelTab === "threads" && (
              <div className="flex-1 flex flex-col" data-testid="threads-sidebar">
                <ThreadsPanel projectId={projectId} onClose={() => closePanel("threads")} />
              </div>
            )}

            {activePanelTab === "networking" && (
              <div className="flex-1 flex flex-col" data-testid="networking-sidebar">
                <NetworkingPanel projectId={projectId} onClose={() => closePanel("networking")} />
              </div>
            )}

            {activePanelTab === "inbox" && (
              <div className="flex-1 flex flex-col" data-testid="inbox-sidebar">
                <FeedbackInboxPanel projectId={projectId} onClose={() => closePanel("inbox")} onSendToAI={(text) => { setAiPanelOpen(true); }} />
              </div>
            )}

            {activePanelTab === "skills" && (
              <div className="flex-1 flex flex-col" data-testid="skills-sidebar">
                <SkillsPanel projectId={projectId} onClose={() => closePanel("skills")} />
              </div>
            )}

            {activePanelTab === "mcp" && (
              <div className="flex-1 flex flex-col" data-testid="mcp-sidebar">
                <MCPPanel projectId={projectId} onClose={() => closePanel("mcp")} />
              </div>
            )}

            {activePanelTab === "checkpoints" && (
              <div className="flex-1 flex flex-col" data-testid="checkpoints-sidebar">
                <CheckpointsPanel projectId={projectId} onClose={() => closePanel("checkpoints")} />
              </div>
            )}

            {activePanelTab === "fileHistory" && (
              <div className="flex-1 flex flex-col" data-testid="file-history-sidebar">
                <FileHistoryPanel projectId={projectId} files={(filesQuery.data || []).map(f => ({ id: f.id, filename: f.filename, content: f.content }))} onClose={() => closePanel("fileHistory")} onFileRestored={(fileId, _filename, content) => { setFileContents(prev => ({ ...prev, [fileId]: content })); setDirtyFiles(prev => { const next = new Set(prev); next.delete(fileId); return next; }); }} initialFile={fileHistoryInitialFile} openCounter={fileHistoryOpenCounter} />
              </div>
            )}

            {activePanelTab === "envVars" && (
              <div className="flex-1 flex flex-col" data-testid="env-vars-sidebar">
                <EnvVarsPanel projectId={projectId} onClose={() => closePanel("envVars")} />
              </div>
            )}

            {activePanelTab === "ssh" && (
              <div className="flex-1 flex flex-col" data-testid="ssh-sidebar">
                <SSHPanel projectId={projectId} onClose={() => closePanel("ssh")} />
              </div>
            )}

            {activePanelTab === "settings" && (
              <UserSettingsPanel
                prefs={userPrefs}
                onPrefsChange={savePrefs as any}
                onClose={() => closePanel("settings")}
                onOpenProjectSettings={() => { closePanel("settings"); setProjectSettingsOpen(true); }}
                onOpenEnvVars={() => openPanel("envVars")}
              />
            )}

                </div>
              </div>
            )}

            <ResizablePanelGroup direction="horizontal" autoSaveId="ide-horizontal" className="flex-1 min-w-0">
            {/* FILE EXPLORER SIDEBAR */}
                <ResizablePanel
                  id="sidebar"
                  order={1}
                  ref={sidebarPanelRef}
                  defaultSize={sidebarShouldBeOpen ? 15 : 0}
                  minSize={10}
                  maxSize={30}
                  collapsible
                  collapsedSize={0}
                  onCollapse={() => setSidebarOpen(false)}
                  onExpand={() => { setSidebarOpen(true); setAiPanelOpen(false); setOpenPanelTabs([]); setActivePanelTab(null); }}
                  className="overflow-hidden"
                  data-testid="panel-sidebar"
                >
                  <div className="h-full">
                    {sidebarContent}
                  </div>
                </ResizablePanel>
                <ResizableHandle
                  className="w-px bg-[var(--ide-border)] hover:bg-[#0079F2] active:bg-[#0079F2] transition-colors group"
                  data-testid="handle-sidebar"
                  onDoubleClick={() => {
                    if (sidebarPanelRef.current?.isCollapsed()) {
                      sidebarPanelRef.current.expand();
                    } else {
                      sidebarPanelRef.current?.collapse();
                    }
                  }}
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 flex items-center justify-center pointer-events-none">
                    <div className="w-[3px] h-6 rounded-full bg-[var(--ide-border)] group-hover:bg-[#0079F2] group-active:bg-[#0079F2] transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                </ResizableHandle>

            {/* MAIN EDITOR + TERMINAL AREA */}
            <ResizablePanel id="editor-main" order={2} defaultSize={85} minSize={30}>
              <div ref={editorPreviewContainerRef} className="h-full overflow-hidden min-w-0 relative">
                <ResizablePanelGroup direction="vertical" autoSaveId="ide-vertical">
                  <ResizablePanel id="editor-area" order={1} defaultSize={70} minSize={20}>
                    <div className="h-full overflow-hidden min-w-0">
                      {!isMobile ? renderPaneNode(paneLayout.layout.root) : (
                        <>{editorTabBar}{editorContent}</>
                      )}
                    </div>
                  </ResizablePanel>
                      <ResizableHandle
                        className="h-px bg-[var(--ide-border)] hover:bg-[#0079F2] active:bg-[#0079F2] transition-colors group"
                        data-testid="handle-terminal"
                        onDoubleClick={() => {
                          if (terminalPanelRef.current?.isCollapsed()) {
                            terminalPanelRef.current.expand();
                          } else {
                            terminalPanelRef.current?.collapse();
                          }
                        }}
                      >
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 flex items-center justify-center pointer-events-none">
                          <div className="h-[3px] w-6 rounded-full bg-[var(--ide-border)] group-hover:bg-[#0079F2] group-active:bg-[#0079F2] transition-colors opacity-0 group-hover:opacity-100" />
                        </div>
                      </ResizableHandle>
                      <ResizablePanel
                        id="terminal"
                        order={2}
                        ref={terminalPanelRef}
                        defaultSize={terminalVisible ? 30 : 0}
                        minSize={8}
                        maxSize={70}
                        collapsible
                        collapsedSize={0}
                        onCollapse={() => setTerminalVisible(false)}
                        onExpand={() => setTerminalVisible(true)}
                        data-testid="panel-terminal"
                      >
                        {bottomPanel}
                      </ResizablePanel>
                </ResizablePanelGroup>
                {!isMobile && paneLayout.layout.floatingPanes.map(fp => (
                  <FloatingPaneWrapper
                    key={fp.id}
                    pane={fp}
                    onPositionChange={paneLayout.updateFloatingPosition}
                    onBringToFront={paneLayout.bringFloatingToFront}
                    onDock={paneLayout.dockFloatingPane}
                    onClose={(pId, tId) => { closeTab(tId); }}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-center h-7 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 overflow-x-auto scrollbar-hide">
                        {fp.tabs.map(tabId => {
                          const specialInfo = getSpecialTabInfo(tabId);
                          const file = !specialInfo ? filesQuery.data?.find(f => f.id === tabId) : null;
                          const tabName = specialInfo ? specialInfo.name : file?.filename || tabId;
                          return (
                            <div
                              key={tabId}
                              className={`flex items-center gap-1 px-2 h-full cursor-pointer shrink-0 text-[10px] ${tabId === fp.activeTab ? "text-[var(--ide-text)] bg-[var(--ide-panel)]" : "text-[var(--ide-text-muted)]"}`}
                              onClick={() => {
                                paneLayout.setLayout(prev => ({
                                  ...prev,
                                  floatingPanes: prev.floatingPanes.map(f => f.id === fp.id ? { ...f, activeTab: tabId } : f),
                                }));
                                setActiveFileId(tabId);
                              }}
                              data-testid={`floating-tab-${fp.id}-${tabId}`}
                            >
                              {specialInfo ? specialInfo.icon : <FileTypeIcon filename={tabName} />}
                              <span className="truncate max-w-[100px]">{tabName}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        {renderPaneContentForTab(fp.activeTab)}
                      </div>
                    </div>
                  </FloatingPaneWrapper>
                ))}
              </div>
            </ResizablePanel>
                <ResizableHandle
                  className="w-px bg-[var(--ide-border)] hover:bg-[#0079F2] active:bg-[#0079F2] transition-colors group"
                  data-testid="handle-preview"
                  onDoubleClick={() => {
                    if (previewPanelRef.current?.isCollapsed()) {
                      previewPanelRef.current.expand();
                    } else {
                      previewPanelRef.current?.collapse();
                    }
                  }}
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 flex items-center justify-center pointer-events-none">
                    <div className="w-[3px] h-6 rounded-full bg-[var(--ide-border)] group-hover:bg-[#0079F2] group-active:bg-[#0079F2] transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                </ResizableHandle>
                <ResizablePanel
                  id="preview"
                  order={3}
                  ref={previewPanelRef}
                  defaultSize={previewPanelOpen ? 40 : 0}
                  minSize={15}
                  maxSize={70}
                  collapsible
                  collapsedSize={0}
                  onCollapse={() => setPreviewPanelOpen(false)}
                  onExpand={() => setPreviewPanelOpen(true)}
                  data-testid="panel-preview"
                >
                  <div className="overflow-hidden flex flex-col h-full">
                    {projectArtifacts.length > 0 && (
                      <div className="flex items-center gap-0.5 px-1 h-7 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0 overflow-x-auto scrollbar-none" data-testid="artifact-switcher">
                        {projectArtifacts.map((art) => {
                          const meta = getArtifactTypeMeta(art.type);
                          const isActive = activeArtifact?.id === art.id;
                          return (
                            <button
                              key={art.id}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${isActive ? `bg-[${meta.color}]/10 border border-[${meta.color}]/25` : "text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)] hover:text-[var(--ide-text-secondary)]"}`}
                              style={isActive ? { backgroundColor: `${meta.color}15`, borderColor: `${meta.color}40`, color: meta.color } : undefined}
                              onClick={() => setActiveArtifactIdPersisted(art.id)}
                              data-testid={`artifact-tab-${art.id}`}
                            >
                              <ArtifactTypeIcon type={art.type} className="w-3 h-3" />
                              <span className="max-w-[80px] truncate">{art.name}</span>
                            </button>
                          );
                        })}
                        <button
                          className="flex items-center justify-center w-5 h-5 rounded text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)] hover:text-[var(--ide-text-secondary)] transition-all ml-0.5"
                          onClick={() => setAddArtifactDialogOpen(true)}
                          title="Add artifact"
                          data-testid="button-add-artifact"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1 px-1.5 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
                      {showUrlBar && (
                        <>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0"
                            onClick={() => { const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement; if (iframe?.contentWindow) { iframe.contentWindow.history.back(); } }}
                            title="Back" data-testid="button-preview-panel-back"><ArrowLeft className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0"
                            onClick={() => { const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement; if (iframe?.contentWindow) { iframe.contentWindow.history.forward(); } }}
                            title="Forward" data-testid="button-preview-panel-forward"><ArrowRight className="w-3 h-3" /></Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded shrink-0"
                        onClick={() => {
                          if (artifactPreviewUrl || (wsStatus === "running" && livePreviewUrl)) {
                            const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement;
                            if (iframe) iframe.src = iframe.src;
                          } else {
                            const html = generateHtmlPreview();
                            if (html) setPreviewHtml(html);
                          }
                        }}
                        title="Refresh" data-testid="button-preview-panel-refresh"><RefreshCw className="w-3 h-3" /></Button>
                      {showUrlBar ? (
                        <div className="flex-1 min-w-0">
                          <form className="flex items-center gap-2 h-[24px] px-3 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)]/70" onSubmit={(e) => {
                            e.preventDefault();
                            if (webviewUrlInput.trim()) {
                              const url = webviewUrlInput.startsWith("http://") || webviewUrlInput.startsWith("https://") ? webviewUrlInput : `https://${webviewUrlInput}`;
                              const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement;
                              if (iframe) iframe.src = url;
                            }
                          }}>
                            <Globe className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
                            <input
                              className="flex-1 bg-transparent text-[10px] text-[var(--ide-text-secondary)] font-mono outline-none placeholder:text-[var(--ide-text-muted)] min-w-0 cursor-pointer"
                              value={webviewUrlInput || (artifactPreviewUrl || livePreviewUrl ? (devUrl || artifactPreviewUrl || livePreviewUrl || "") : (previewHtml ? "HTML Preview" : "localhost:3000"))}
                              onChange={(e) => setWebviewUrlInput(e.target.value)}
                              onFocus={() => setWebviewUrlInput(artifactPreviewUrl || livePreviewUrl || "")}
                              onBlur={() => { if (!webviewUrlInput.trim()) setWebviewUrlInput(""); }}
                              onClick={() => { if (devUrl && livePreviewUrl && !webviewUrlInput) { navigator.clipboard.writeText(fullDevUrl || ""); toast({ title: "Development URL copied" }); } }}
                              data-testid="input-preview-panel-url"
                            />
                          </form>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0 flex items-center gap-2 px-2">
                          {activeArtifact && (
                            <>
                              <ArtifactTypeIcon type={activeArtifact.type} className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[10px] font-medium text-[var(--ide-text-secondary)] truncate">{activeArtifact.name}</span>
                              {activeArtifact.entryFile && (
                                <span className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate">{activeArtifact.entryFile}</span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <ArtifactTypeControls
                          artifactType={activeArtifact?.type || null}
                          onRefresh={() => {
                            const iframe = document.getElementById("preview-panel-iframe") as HTMLIFrameElement;
                            if (iframe) iframe.src = iframe.src;
                          }}
                        />
                        <DevicePresetSelector selectedPreset={selectedDevicePreset} onSelect={handleDevicePresetSelect} projectId={projectId} customWidth={customDeviceWidth} customHeight={customDeviceHeight} onCustomSizeChange={(w, h) => { setCustomDeviceWidth(w); setCustomDeviceHeight(h); }} />
                        <DevToolsToggle active={devToolsActive} onToggle={() => setDevToolsActive(!devToolsActive)} />
                        <Button variant="ghost" size="icon" className={`w-6 h-6 rounded shrink-0 transition-colors ${visualEditorActive && visualEditorIframeId === "preview-panel-iframe" ? "text-[#7C65CB] bg-[#7C65CB]/15 hover:bg-[#7C65CB]/25" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"}`}
                          onClick={() => handleVisualEditorToggle("preview-panel-iframe")}
                          title={visualEditorActive ? "Disable Visual Editor" : "Enable Visual Editor"}
                          data-testid="button-visual-editor-preview"><MousePointer2 className="w-3 h-3" /></Button>
                        {(livePreviewUrl || previewHtml || artifactPreviewUrl || artifactPreviewHtml) && (
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
                            onClick={() => {
                              const url = artifactPreviewUrl || livePreviewUrl;
                              const html = artifactPreviewHtml || previewHtml;
                              if (url) window.open(artifactPreviewUrl ? artifactPreviewUrl : (fullDevUrl || url), "_blank");
                              else if (html) { const blob = new Blob([html], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); }
                            }}
                            title="Open in new tab" data-testid="button-preview-panel-newtab"><ExternalLink className="w-3 h-3" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded"
                          onClick={() => { previewPanelRef.current?.collapse(); }}
                          title="Close preview" data-testid="button-preview-panel-close"><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="flex-1 flex overflow-hidden">
                      <div className="flex-1 overflow-hidden">
                        <DeviceFrame selectedPreset={selectedDevicePreset} customWidth={customDeviceWidth} customHeight={customDeviceHeight} className="bg-white">
                          {artifactPreviewUrl ? (
                            <iframe id="preview-panel-iframe" src={artifactPreviewUrl} className="w-full h-full border-0" title={`${activeArtifact?.name || "Artifact"} Preview`} loading="lazy" data-testid="iframe-preview-panel" />
                          ) : artifactPreviewHtml ? (
                            <iframe id="preview-panel-iframe" srcDoc={injectErudaIntoHtml(artifactPreviewHtml, devToolsActive)} className="w-full h-full border-0" sandbox="allow-scripts" title={`${activeArtifact?.name || "Artifact"} Preview`} loading="lazy" data-testid="iframe-preview-panel-html" />
                          ) : wsStatus === "running" && livePreviewUrl ? (
                            <iframe id="preview-panel-iframe" src={effectivePreviewUrl!} className="w-full h-full border-0" title="Live Preview" loading="lazy" data-testid="iframe-preview-panel" />
                          ) : previewHtml ? (
                            <iframe id="preview-panel-iframe" srcDoc={injectErudaIntoHtml(previewHtml!, devToolsActive)} className="w-full h-full border-0" sandbox="allow-scripts" title="HTML Preview" loading="lazy" data-testid="iframe-preview-panel-html" />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-[var(--ide-panel)] text-[var(--ide-text-muted)] gap-3">
                              {activeArtifact && !isWebArtifact ? (
                                <>
                                  <ArtifactTypeIcon type={activeArtifact.type} className="w-8 h-8" />
                                  <p className="text-xs text-center max-w-[200px]">
                                    {activeArtifact.entryFile ? `Set entry file "${activeArtifact.entryFile}" and run to preview` : `Configure an entry file for this ${getArtifactTypeMeta(activeArtifact.type).label} artifact`}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <Globe className="w-8 h-8" />
                                  <p className="text-xs text-center max-w-[200px]">{hasHtmlFile ? "Click Run to preview your HTML" : "Run your app to see the preview"}</p>
                                  {hasHtmlFile && (
                                    <Button size="sm" variant="ghost" className="h-7 px-4 text-[11px] text-[#0079F2] hover:text-white hover:bg-[#0079F2] border border-[#0079F2]/30 rounded-full gap-1.5" onClick={handlePreview} data-testid="button-preview-panel-start">
                                      <Eye className="w-3 h-3" /> Preview HTML
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </DeviceFrame>
                      </div>
                      {visualEditorActive && visualEditorIframeId === "preview-panel-iframe" && (
                        <div className="w-[280px] shrink-0 border-l border-[var(--ide-border)] overflow-hidden" data-testid="visual-editor-preview-panel">
                          <VisualEditorPanel
                            element={selectedVEElement}
                            onClose={() => { setVisualEditorActive(false); deactivateVisualEditor("preview-panel-iframe"); setSelectedVEElement(null); }}
                            onApplyEdit={handleVisualEditApply}
                            onJumpToSource={handleJumpToSource}
                            onAIHandoff={handleAIHandoff}
                            iframeId="preview-panel-iframe"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </ResizablePanel>
            </ResizablePanelGroup>

          </div>

          {/* STATUS BAR */}
          <TooltipProvider delayDuration={200}>
          <div className="flex items-center justify-between px-2 h-6 bg-[var(--ide-bg)] border-t border-[var(--ide-border)]/60 shrink-0">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center gap-1 px-1.5 h-5 rounded text-[10px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text)] transition-colors" onClick={() => openPanel("git")} data-testid="button-git-branch">
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
              {remoteUsers.length > 0 && (
                <span className="text-[10px] flex items-center gap-1 text-[var(--ide-text-muted)]" data-testid="status-collaborators">
                  <Users className="w-2.5 h-2.5" />
                  {remoteUsers.length + 1}
                </span>
              )}

              {creditBalanceQuery.data && creditBalanceQuery.data.monthlyCreditsIncluded > 0 && (
                <>
                  <span className="w-px h-3 bg-[var(--ide-surface)]" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={`flex items-center gap-1 px-1.5 h-5 rounded text-[10px] transition-colors ${
                          creditBalanceQuery.data.exhausted
                            ? "text-red-400 bg-red-400/10 hover:bg-red-400/20"
                            : creditBalanceQuery.data.lowCredits
                            ? "text-orange-400 bg-orange-400/10 hover:bg-orange-400/20"
                            : "text-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]/60 hover:text-[var(--ide-text)]"
                        }`}
                        onClick={() => setLocation("/settings")}
                        data-testid="status-credit-balance"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span className="font-medium">
                          {creditBalanceQuery.data.remaining} credits
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px] bg-[var(--ide-panel)] text-[var(--ide-text)] border-[var(--ide-border)]">
                      {creditBalanceQuery.data.remaining} / {creditBalanceQuery.data.monthlyCreditsIncluded} monthly credits remaining
                      {creditBalanceQuery.data.overageEnabled && " (overage enabled)"}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isKeyboardModeActive && (
                <div className="flex items-center gap-1.5 mr-2" data-testid="keyboard-shortcut-hints">
                  <Keyboard className="w-3 h-3 text-[#0079F2]" />
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[8px]">⌘K</kbd> Cmds
                  </span>
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[8px]">⌘S</kbd> Save
                  </span>
                  <span className="text-[9px] text-[var(--ide-text-muted)]">
                    <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] text-[8px]">⌘P</kbd> Files
                  </span>
                  <span className="w-px h-3 bg-[var(--ide-surface)]" />
                </div>
              )}
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

      {projectId && (
        <ConversionDialog
          open={conversionDialogOpen}
          onOpenChange={setConversionDialogOpen}
          projectId={projectId}
          frameId={conversionFrameId}
          frameName={conversionFrameName}
          initialTargetType={conversionTargetType}
        />
      )}

      <SpotlightOverlay
        projectId={projectId}
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        onProjectUpdated={(updated) => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
          setProjectName(updated.name);
          setProjectLang(updated.language);
        }}
      />

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
            <div className="p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--ide-text)]">Visibility</p>
                  <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">Control who can access this project</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${project?.visibility === "private" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : project?.visibility === "team" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}`} data-testid="badge-project-visibility">{project?.visibility === "private" ? "Private" : project?.visibility === "team" ? "Team" : "Public"}</span>
              </div>
              <div className="flex gap-2">
                {["public", "private", "team"].map((v) => (
                  <button
                    key={v}
                    onClick={() => visibilityMutation.mutate(v)}
                    disabled={visibilityMutation.isPending}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${project?.visibility === v ? "bg-[#0079F2]/10 text-[#0079F2] border-[#0079F2]/30" : "bg-[var(--ide-panel)] text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:text-[var(--ide-text-secondary)] hover:border-[var(--ide-border)]"}`}
                    data-testid={`btn-visibility-${v}`}
                  >
                    {v === "public" ? "Public" : v === "private" ? "Private" : "Team"}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                  <div>
                    <p className="text-[11px] text-[var(--ide-text)] font-medium">Private Deployment</p>
                    <p className="text-[9px] text-[var(--ide-text-muted)]">Require sign-in to access deployed app</p>
                  </div>
                </div>
                <Switch checked={deployIsPrivate} onCheckedChange={(v) => { setDeployIsPrivate(v); if (project?.isPublished) deploySettingsMutation.mutate({ isPrivate: v }); }} data-testid="dialog-toggle-private-deploy" />
              </div>
              {project?.visibility === "private" && (
                <div className="space-y-2 border-t border-[var(--ide-border)] pt-3">
                  <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium">Invited Guests</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email address"
                      value={deployInviteEmail}
                      onChange={(e) => setDeployInviteEmail(e.target.value)}
                      className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-8 text-xs text-[var(--ide-text)] rounded-lg flex-1"
                      data-testid="input-guest-email"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && deployInviteEmail.trim()) {
                          inviteGuestMutation.mutate({ email: deployInviteEmail.trim(), role: "viewer" }); setDeployInviteEmail("");
                        }
                      }}
                    />
                    <Button size="sm" className="h-8 px-3 text-[11px] bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg" data-testid="btn-invite-guest" onClick={() => {
                      if (deployInviteEmail.trim()) { inviteGuestMutation.mutate({ email: deployInviteEmail.trim(), role: "viewer" }); setDeployInviteEmail(""); }
                    }}>Invite</Button>
                  </div>
                  {(guestsQuery.data || []).length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(guestsQuery.data || []).map((guest: ProjectGuest) => (
                        <div key={guest.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-[var(--ide-panel)] border border-[var(--ide-border)]/50">
                          <div>
                            <span className="text-[11px] text-[var(--ide-text)]">{guest.email}</span>
                            <span className="text-[9px] text-[var(--ide-text-muted)] ml-2">{guest.acceptedAt ? "Accepted" : "Pending"}</span>
                          </div>
                          <button onClick={() => removeGuestMutation.mutate(guest.id)} className="text-[var(--ide-text-muted)] hover:text-red-400 transition-colors" data-testid={`btn-remove-guest-${guest.id}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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

            <div className="border-t border-[var(--ide-border)] pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--ide-text)]">Publish as Developer Framework</p>
                  <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">Let others discover and fork this project</p>
                </div>
                <Switch
                  checked={project?.isDevFramework || frameworkCheckbox}
                  onCheckedChange={(checked) => {
                    if (project?.isDevFramework && !checked) {
                      frameworkUnpublishMutation.mutate();
                      setFrameworkCheckbox(false);
                    } else {
                      setFrameworkCheckbox(checked);
                    }
                  }}
                  disabled={frameworkPublishMutation.isPending || frameworkUnpublishMutation.isPending}
                  data-testid="switch-framework"
                />
              </div>

              {(frameworkCheckbox || project?.isDevFramework) && !project?.isDevFramework && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-[var(--ide-text-secondary)]">Description</Label>
                    <Input
                      value={frameworkDesc}
                      onChange={(e) => setFrameworkDesc(e.target.value)}
                      placeholder="A brief description of your framework..."
                      className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg"
                      data-testid="input-framework-desc"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-[var(--ide-text-secondary)]">Category</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {["frontend", "backend", "fullstack", "systems", "scripting", "other"].map((cat) => (
                        <button key={cat} type="button" onClick={() => setFrameworkCategory(cat)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${frameworkCategory === cat ? "bg-[#0079F2] text-white" : "bg-[var(--ide-bg)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-[var(--ide-border)]"}`} data-testid={`btn-category-${cat}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-[var(--ide-text-secondary)]">Cover Image URL (optional)</Label>
                    <Input
                      value={frameworkCoverUrl}
                      onChange={(e) => setFrameworkCoverUrl(e.target.value)}
                      placeholder="https://example.com/cover.png"
                      className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg"
                      data-testid="input-framework-cover"
                    />
                  </div>
                  <Button
                    className="w-full h-9 bg-[#0CCE6B] hover:bg-[#0AB85E] text-black rounded-lg text-xs font-medium"
                    disabled={frameworkPublishMutation.isPending}
                    onClick={() => frameworkPublishMutation.mutate({ description: frameworkDesc, category: frameworkCategory, coverUrl: frameworkCoverUrl })}
                    data-testid="btn-publish-framework"
                  >
                    {frameworkPublishMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Publish Framework"}
                  </Button>
                </div>
              )}

              {project?.isDevFramework && (
                <div className="p-2.5 rounded-lg bg-[#0CCE6B]/10 border border-[#0CCE6B]/20">
                  <p className="text-[11px] text-[#0CCE6B] font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Published as Developer Framework
                  </p>
                  <p className="text-[10px] text-[var(--ide-text-secondary)] mt-1">
                    {project.frameworkCategory && <span className="capitalize">{project.frameworkCategory}</span>}
                    {project.frameworkDescription && <span> · {project.frameworkDescription}</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Invite Collaborators</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Share this link to invite others to collaborate on this project in real-time</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {inviteLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" />
              </div>
            ) : inviteLink ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--ide-text-secondary)]">Invite Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg flex-1 font-mono" data-testid="input-invite-link" />
                    <Button size="sm" variant="ghost" className="h-9 px-3 text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] shrink-0" onClick={handleCopyInviteLink} data-testid="button-copy-invite">
                      {inviteLinkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--ide-text-muted)]">Anyone with this link can join your project as an editor and collaborate in real-time.</p>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={handleGenerateInviteLink} data-testid="button-new-invite-link">
                  Generate New Link
                </Button>
              </>
            ) : (
              <Button className="w-full h-9 bg-[#0079F2] hover:bg-[#0068D6] text-white rounded-lg text-xs font-medium" onClick={handleGenerateInviteLink} data-testid="button-generate-invite">
                Generate Invite Link
              </Button>
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

      {isAnimationProject && projectId && (
        <AnimationPreview
          projectId={projectId}
          previewUrl={livePreviewUrl}
          previewHtml={previewHtml}
          exportDialogOpen={animationExportOpen}
          onExportDialogClose={() => setAnimationExportOpen(false)}
        />
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        files={filesQuery.data}
        isRunning={isRunning}
        onRun={handleRun}
        onNewFile={() => setNewFileDialogOpen(true)}
        onNewFolder={() => setNewFolderDialogOpen(true)}
        onToggleTerminal={() => setTerminalVisible((prev) => !prev)}
        onToggleAI={() => { setAiPanelOpen((prev) => !prev); if (!aiPanelOpen) { setSidebarOpen(false); setOpenPanelTabs([]); setActivePanelTab(null); } }}
        onTogglePreview={() => setPreviewPanelOpen((prev) => !prev)}
        onToggleSidebar={() => { const willOpen = !sidebarOpen; setSidebarOpen(willOpen); if (willOpen) { setAiPanelOpen(false); setOpenPanelTabs([]); setActivePanelTab(null); } }}
        onProjectSettings={() => setProjectSettingsOpen(true)}
        onPublish={() => setPublishDialogOpen(true)}
        onGoToDashboard={() => setLocation("/dashboard")}
        onOpenFile={(file) => { openFile(file); if (isMobile) setMobileTab("editor"); }}
        onSplitEditor={() => { if (activeFileId && !activeFileId.startsWith("__")) setSplitEditorFileId(activeFileId); }}
        onToggleMinimap={() => savePrefs({ minimap: !showMinimap })}
        onForkProject={() => forkMutation.mutate(undefined)}
        getShortcutDisplay={getShortcutDisplay}
        projectId={projectId}
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
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Quick reference for all available shortcuts. Customize in Settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              { category: "General", shortcuts: [
                { id: "command-palette", desc: "Command Palette" },
                { id: "command-palette-alt", desc: "Command Palette (Alt)" },
                { id: "toggle-sidebar", desc: "Toggle Sidebar" },
                { id: "keyboard-shortcuts", desc: "Keyboard Shortcuts" },
                { id: "run", desc: "Run / Stop" },
                { id: "run-alt", desc: "Run Code" },
              ]},
              { category: "Editor", shortcuts: [
                { id: "save-file", desc: "Save File" },
                { id: "new-file", desc: "New File" },
                { id: "close-tab", desc: "Close Tab" },
              ]},
              { category: "Panels", shortcuts: [
                { id: "toggle-terminal", desc: "Toggle Terminal" },
                { id: "toggle-terminal-alt", desc: "Toggle Terminal (Alt)" },
                { id: "toggle-preview", desc: "Toggle Preview" },
                { id: "search-files", desc: "Search in Files" },
                { id: "search-replace", desc: "Search & Replace" },
                { id: "version-control", desc: "Version Control" },
              ]},
            ].map(({ category, shortcuts }) => (
              <div key={category}>
                <h4 className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest mb-2">{category}</h4>
                <div className="space-y-1">
                  {shortcuts.map(({ id, desc }, i) => {
                    const keys = getShortcutDisplay(id);
                    const keyParts = keys ? keys.split("+") : [];
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--ide-surface)]/40">
                        <span className="text-[12px] text-[var(--ide-text-secondary)]">{desc}</span>
                        <div className="flex items-center gap-1">
                          {keyParts.length > 0 ? keyParts.map((k, j) => (
                            <kbd key={j} className="px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[10px] text-[var(--ide-text)] font-mono min-w-[24px] text-center">{k}</kbd>
                          )) : (
                            <span className="text-[10px] text-[var(--ide-text-muted)] italic">unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

      <Dialog open={keyboardModePromptOpen} onOpenChange={setKeyboardModePromptOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-[#0079F2]" /> Enable Keyboard Mode?
            </DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs leading-relaxed mt-2">
              We detected an external keyboard connected to your tablet. Keyboard Mode provides a desktop-like experience with wider panels, full toolbar, and keyboard shortcut hints. You can change this anytime in Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button
              variant="ghost"
              className="flex-1 h-9 text-xs text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] rounded-lg"
              onClick={() => {
                setKeyboardModePromptOpen(false);
                savePrefs({ keyboardModePromptDismissed: true });
              }}
              data-testid="button-keyboard-mode-dismiss"
            >
              Not now
            </Button>
            <Button
              className="flex-1 h-9 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium"
              onClick={() => {
                setKeyboardModePromptOpen(false);
                savePrefs({ keyboardMode: true, keyboardModePromptDismissed: true });
                toast({ title: "Keyboard Mode enabled", description: "Enjoying a desktop-like experience on your tablet." });
              }}
              data-testid="button-keyboard-mode-enable"
            >
              Enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addArtifactDialogOpen} onOpenChange={setAddArtifactDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Add Artifact</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">
              Add a new artifact to this project
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newArtifactName.trim()) createArtifactMutation.mutate({ name: newArtifactName.trim(), type: newArtifactType }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Name</Label>
              <Input
                value={newArtifactName}
                onChange={(e) => setNewArtifactName(e.target.value)}
                placeholder="My Artifact"
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]"
                autoFocus
                required
                data-testid="input-artifact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Type</Label>
              <div className="grid grid-cols-5 gap-1.5" data-testid="select-artifact-type">
                {ARTIFACT_TYPES.map((t) => {
                  const meta = getArtifactTypeMeta(t);
                  const selected = newArtifactType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg border text-[9px] font-medium transition-all ${selected ? "border-[var(--ide-text)] bg-[var(--ide-surface)]" : "border-[var(--ide-border)] hover:border-[var(--ide-text-muted)] hover:bg-[var(--ide-surface)]/50"}`}
                      style={selected ? { borderColor: meta.color, backgroundColor: `${meta.color}10` } : undefined}
                      onClick={() => setNewArtifactType(t)}
                      data-testid={`artifact-type-${t}`}
                    >
                      <ArtifactTypeIcon type={t} className="w-4 h-4" />
                      <span className={`leading-tight text-center ${selected ? "" : "text-[var(--ide-text-muted)]"}`} style={selected ? { color: meta.color } : undefined}>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 h-9 text-xs text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-lg" onClick={() => setAddArtifactDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-9 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" disabled={!newArtifactName.trim() || createArtifactMutation.isPending} data-testid="button-confirm-add-artifact">
                {createArtifactMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default _projectPage;

