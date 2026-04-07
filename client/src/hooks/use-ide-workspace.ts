// @ts-nocheck
/**
 * useIDEWorkspace - Centralized state management for the IDE
 * Provides project data, file management, tab management, and workspace state.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getCsrfToken } from '@/lib/queryClient';
import type { ActivityItem } from '@/components/ide/ReplitActivityBar';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
  closable?: boolean;
  pinned?: boolean;
  modified?: boolean;
  path?: string;
  fileId?: string;
  type?: 'file' | 'tool';
}

export interface FileItem {
  id: string;
  filename: string;
  content: string;
  language?: string;
  projectId: string;
  isBinary?: boolean;
  isDirectory?: boolean;
  size?: number;
  lastModified?: string;
}

// Tool tabs that can be opened
const TOOL_TABS: Record<string, { label: string }> = {
  terminal: { label: 'Terminal' },
  git: { label: 'Git' },
  packages: { label: 'Packages' },
  debugger: { label: 'Debugger' },
  testing: { label: 'Testing' },
  secrets: { label: 'Secrets' },
  database: { label: 'Database' },
  deployment: { label: 'Deploy' },
  collaboration: { label: 'Collaboration' },
  search: { label: 'Search' },
  history: { label: 'History' },
  themes: { label: 'Themes' },
  multiplayers: { label: 'Multiplayers' },
  checkpoints: { label: 'Checkpoints' },
  settings: { label: 'Settings' },
  extensions: { label: 'Extensions' },
  workflows: { label: 'Workflows' },
  debug: { label: 'Debug' },
  shell: { label: 'Shell' },
  storage: { label: 'Storage' },
  auth: { label: 'Auth' },
  'app-storage': { label: 'App Storage' },
  visual: { label: 'Visual Editor' },
  resources: { label: 'Resources' },
  logs: { label: 'Logs' },
  console: { label: 'Console' },
  automations: { label: 'Automations' },
  backup: { label: 'Backup' },
  config: { label: 'Config' },
  feedback: { label: 'Feedback' },
  github: { label: 'GitHub' },
  integrations: { label: 'Integrations' },
  mcp: { label: 'MCP' },
  'merge-conflicts': { label: 'Merge Conflicts' },
  monitoring: { label: 'Monitoring' },
  networking: { label: 'Networking' },
  publishing: { label: 'Publishing' },
  skills: { label: 'Skills' },
  ssh: { label: 'SSH' },
  threads: { label: 'Threads' },
  'test-runner': { label: 'Test Runner' },
  'security-scanner': { label: 'Security' },
  slides: { label: 'Slides' },
  video: { label: 'Video' },
  animation: { label: 'Animation' },
  design: { label: 'Design' },
};

export const availableTools = Object.entries(TOOL_TABS).map(([id, { label }]) => ({
  id,
  label,
  icon: 'tool',
}));

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    cpp: 'cpp', c: 'c', cs: 'csharp', php: 'php', swift: 'swift',
    kt: 'kotlin', html: 'html', css: 'css', scss: 'scss', sass: 'sass',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    sh: 'shell', bash: 'shell', sql: 'sql', graphql: 'graphql',
    vue: 'vue', svelte: 'svelte', toml: 'toml',
  };
  return map[ext] || 'plaintext';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useIDEWorkspace(projectId: string) {
  const queryClient = useQueryClient();

  // Read bootstrap token + build mode from URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const bootstrapToken = searchParams.get('bootstrap') || null;
  const buildMode = searchParams.get('buildMode') || null;

  // ── Server data ──────────────────────────────────────────────────────────

  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
    retry: false,
    staleTime: 30_000,
  });

  const { data: filesRawData, refetch: refetchFiles } = useQuery({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 5_000,
  });

  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    staleTime: 60_000,
  });

  const { data: userQuota } = useQuery({
    queryKey: ['/api/user/quota'],
    retry: false,
    staleTime: 30_000,
  });

  const { data: guestsQueryData } = useQuery({
    queryKey: [`/api/projects/${projectId}/guests`],
    enabled: !!projectId,
    retry: false,
  });

  const filesRaw: FileItem[] = Array.isArray(filesRawData) ? filesRawData : [];

  // ── Tab state ─────────────────────────────────────────────────────────────

  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  // File content cache (local edits)
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────

  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [activeActivityItem, setActiveActivityItem] = useState<ActivityItem>('agent');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<string>('agent');
  const [deploymentTab, setDeploymentTab] = useState<string>('overview');
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showQuickFileSearch, setShowQuickFileSearch] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [agentToolsSettings, setAgentToolsSettings] = useState<any>({});
  // Read pending bootstrap prompt from sessionStorage (set by Landing page)
  const [pendingAIMessage, setPendingAIMessage] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(`agent-prompt-${projectId}`);
      if (stored) {
        sessionStorage.removeItem(`agent-prompt-${projectId}`);
        return stored;
      }
    } catch {}
    return null;
  });

  // ── Workspace state ───────────────────────────────────────────────────────

  const [wsLoading, setWsLoading] = useState(false);
  const [runnerOnline, setRunnerOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState<string>('disconnected');
  const [connectionQuality, setConnectionQuality] = useState<string>('good');
  const [collabConnected, setCollabConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [currentConsoleRunId, setCurrentConsoleRunId] = useState<string | null>(null);

  // ── Visual editor ─────────────────────────────────────────────────────────

  const [visualEditorActive, setVisualEditorActive] = useState(false);
  const [selectedVEElement, setSelectedVEElement] = useState<any>(null);
  const [workspaceMode, setWorkspaceMode] = useState<string>('code');
  const [splitEditorFileId, setSplitEditorFileId] = useState<string | null>(null);

  // ── Git state ─────────────────────────────────────────────────────────────

  const [gitBranch, setGitBranch] = useState<string>('main');
  const [gitChangesCount, setGitChangesCount] = useState<number>(0);
  const [blameEnabled, setBlameEnabled] = useState(false);
  const [blameData, setBlameData] = useState<any>(null);
  const [mergeConflicts, setMergeConflicts] = useState<any[]>([]);
  const [mergeResolutions, setMergeResolutions] = useState<any[]>([]);

  // ── Cursor / status bar ────────────────────────────────────────────────────

  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [problemsCount, setProblemCount] = useState(0);
  const [publishState, setPublishState] = useState<string>('draft');

  // ── Dialog state ──────────────────────────────────────────────────────────

  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [animationExportOpen, setAnimationExportOpen] = useState(false);
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [conversionFrameId, setConversionFrameId] = useState<string | null>(null);
  const [conversionFrameName, setConversionFrameName] = useState<string | null>(null);
  const [conversionTargetType, setConversionTargetType] = useState<string | null>(null);
  const [addArtifactDialogOpen, setAddArtifactDialogOpen] = useState(false);
  const [newArtifactName, setNewArtifactName] = useState('');
  const [newArtifactType, setNewArtifactType] = useState('web-app');

  // ── Framework / publish fields ────────────────────────────────────────────

  const [frameworkCheckbox, setFrameworkCheckbox] = useState(false);
  const [frameworkDesc, setFrameworkDesc] = useState('');
  const [frameworkCategory, setFrameworkCategory] = useState('');
  const [frameworkCoverUrl, setFrameworkCoverUrl] = useState('');
  const [deployIsPrivate, setDeployIsPrivate] = useState(false);
  const [deployInviteEmail, setDeployInviteEmail] = useState('');
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectLangInput, setProjectLangInput] = useState('');

  // ── Sync project name/lang ────────────────────────────────────────────────

  useEffect(() => {
    if (project?.name) setProjectNameInput(project.name);
    if (project?.language) setProjectLangInput(project.language);
  }, [project?.name, project?.language]);

  // ── Active file from selected tab ─────────────────────────────────────────

  const currentFileTab = tabs.find(t => t.id === activeTab && t.type === 'file');
  const activeFileId = currentFileTab?.fileId || null;
  const activeFileName = currentFileTab ? (filesRaw.find(f => f.id === currentFileTab.fileId)?.filename || currentFileTab.label) : null;
  const activeFileRaw = activeFileId ? filesRaw.find(f => f.id === activeFileId) : null;
  const activeFileContent = activeFileId
    ? (fileContents[activeFileId] ?? activeFileRaw?.content ?? '')
    : null;
  const activeFileLanguage = activeFileName ? getLanguageFromFilename(activeFileName) : null;

  // ── Tab operations ────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((fileId: string) => {
    const file = (Array.isArray(filesRawData) ? filesRawData : []).find((f: FileItem) => f.id === fileId);
    if (!file) return;
    setSelectedFileId(fileId);

    const existingTab = tabs.find(t => t.fileId === fileId);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    const newTab: TabItem = {
      id: `file-${fileId}`,
      label: file.filename.split('/').pop() || file.filename,
      closable: true,
      fileId,
      type: 'file',
      path: file.filename,
      modified: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newTab.id);
  }, [tabs, filesRawData]);

  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      // If closing active tab, activate adjacent one
      if (activeTab === tabId && newTabs.length > 0) {
        const closedIndex = prev.findIndex(t => t.id === tabId);
        const nextTab = newTabs[Math.min(closedIndex, newTabs.length - 1)];
        setActiveTab(nextTab.id);
      } else if (newTabs.length === 0) {
        setActiveTab('');
      }
      return newTabs;
    });
    setDirtyFiles(prev => { const next = new Set(prev); next.delete(tabId); return next; });
  }, [activeTab]);

  const handleTabReorder = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return newTabs;
    });
  }, []);

  const handleTabPin = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, pinned: !t.pinned } : t));
  }, []);

  const handleTabDuplicate = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const newTab = { ...tab, id: `${tab.id}-copy-${Date.now()}`, pinned: false };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newTab.id);
  }, [tabs]);

  const handleSplitRight = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.fileId) setSplitEditorFileId(tab.fileId);
  }, [tabs]);

  const handleAddTool = useCallback((toolId: string) => {
    const existing = tabs.find(t => t.id === toolId);
    if (existing) {
      setActiveTab(toolId);
      return;
    }
    const toolDef = TOOL_TABS[toolId];
    const newTab: TabItem = {
      id: toolId,
      label: toolDef?.label || toolId,
      closable: true,
      type: 'tool',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(toolId);
  }, [tabs]);

  // ── Code change ───────────────────────────────────────────────────────────

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCodeChange = useCallback((fileId: string, content: string) => {
    setFileContents(prev => ({ ...prev, [fileId]: content }));
    setDirtyFiles(prev => new Set(prev).add(fileId));
    setTabs(prev => prev.map(t => t.fileId === fileId ? { ...t, modified: true } : t));

    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const csrfToken = getCsrfToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
        await fetch(`/api/files/${fileId}`, {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify({ content }),
        });
        setDirtyFiles(prev => { const next = new Set(prev); next.delete(fileId); return next; });
        setTabs(prev => prev.map(t => t.fileId === fileId ? { ...t, modified: false } : t));
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      } catch {}
    }, 1000);
  }, [projectId, queryClient]);

  const handleCursorChange = useCallback((position: { line: number; column: number }) => {
    setCursorPosition(position);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async (visibility: string) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}`, { visibility });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/publish`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/fork`, {});
      return res.json();
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
    },
  });

  const createArtifactMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/artifacts`, data);
      return res.json();
    },
  });

  const applyVisualEditMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/visual-edit`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
    },
  });

  const inviteGuestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/guests`, data);
      return res.json();
    },
  });

  const removeGuestMutation = useMutation({
    mutationFn: async (guestId: string) => {
      const res = await apiRequest('DELETE', `/api/projects/${projectId}/guests/${guestId}`, undefined);
      return res.json();
    },
  });

  const frameworkPublishMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/publish-framework`, data);
      return res.json();
    },
  });

  const frameworkUnpublishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/projects/${projectId}/publish-framework`, undefined);
      return res.json();
    },
  });

  const deploySettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/deploy-settings`, data);
      return res.json();
    },
  });

  // ── Workspace control ─────────────────────────────────────────────────────

  const handleStartWorkspace = useCallback(async () => {
    setWsLoading(true);
    try {
      const res = await apiRequest('POST', `/api/workspaces/${projectId}/start`, {});
      const data = await res.json();
      if (data.online) setRunnerOnline(true);
    } catch {}
    setWsLoading(false);
  }, [projectId]);

  const handleStopWorkspace = useCallback(async () => {
    setWsLoading(true);
    try {
      await apiRequest('POST', `/api/workspaces/${projectId}/stop`, {});
      setRunnerOnline(false);
    } catch {}
    setWsLoading(false);
  }, [projectId]);

  // ── Run / stop ────────────────────────────────────────────────────────────

  const handleRunStop = useCallback(async () => {
    if (isRunning) {
      setIsRunning(false);
      setExecutionId(null);
    } else {
      setIsRunning(true);
      try {
        const res = await apiRequest('POST', `/api/projects/${projectId}/execute`, { command: 'run' });
        const data = await res.json();
        if (data.executionId) setExecutionId(data.executionId);
      } catch {
        setIsRunning(false);
      }
    }
  }, [isRunning, projectId]);

  // ── Invite link ───────────────────────────────────────────────────────────

  const handleGenerateInviteLink = useCallback(async () => {
    setInviteLoading(true);
    try {
      const res = await apiRequest('POST', `/api/projects/${projectId}/invite`, {});
      const data = await res.json();
      if (data.link) setInviteLink(data.link);
    } catch {}
    setInviteLoading(false);
  }, [projectId]);

  const handleCopyInviteLink = useCallback(() => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    }
  }, [inviteLink]);

  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
  }, []);

  // ── Visual editor ─────────────────────────────────────────────────────────

  const handleVisualEditorToggle = useCallback(() => {
    setVisualEditorActive(prev => !prev);
  }, []);

  // ── Live preview URL ──────────────────────────────────────────────────────

  // For static web projects, construct a URL to /api/preview/:projectId
  const livePreviewUrl = project
    ? `/api/preview/${projectId}/`
    : '';

  // ── User prefs ────────────────────────────────────────────────────────────

  const userPrefs = (user as any)?.preferences || {};
  const creditBalance = (userQuota as any)?.creditsRemaining ?? null;

  // ── Open first file on load ───────────────────────────────────────────────

  useEffect(() => {
    if (filesRaw.length > 0 && tabs.length === 0) {
      // Open the first non-directory, non-hidden file
      const firstFile = filesRaw.find(
        f => !f.isDirectory && !f.filename.startsWith('.') && f.filename !== 'ecode.md'
      ) || filesRaw.find(f => !f.isDirectory);
      if (firstFile) {
        handleFileSelect(firstFile.id);
      }
    }
  }, [filesRaw.length, tabs.length]); // intentionally not including handleFileSelect

  // ── File created/updated callback (for AI panel) ──────────────────────────

  const handleFileCreated = useCallback((file: FileItem) => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
    // Auto-open the new file
    setTimeout(() => {
      const newTab: TabItem = {
        id: `file-${file.id}`,
        label: file.filename.split('/').pop() || file.filename,
        closable: true,
        fileId: file.id,
        type: 'file',
        path: file.filename,
        modified: false,
      };
      setTabs(prev => {
        const exists = prev.find(t => t.fileId === file.id);
        if (exists) return prev;
        return [...prev, newTab];
      });
      setActiveTab(`file-${file.id}`);
    }, 100);
  }, [projectId, queryClient]);

  const handleFileUpdated = useCallback((_file: FileItem) => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
  }, [projectId, queryClient]);

  // ── Guests query ──────────────────────────────────────────────────────────

  const guestsQuery = useQuery({
    queryKey: [`/api/projects/${projectId}/guests`],
    enabled: !!projectId,
    retry: false,
  });

  // ── Return everything ─────────────────────────────────────────────────────

  return {
    // Bootstrap
    bootstrapToken,
    buildMode,

    // Project
    project: project || null,
    projectLanguage: (project as any)?.language || '',
    projectName: (project as any)?.name || '',
    projectDescription: (project as any)?.description || '',
    isLoadingProject,

    // User
    user: user || null,
    userPrefs,
    creditBalance,

    // Files
    filesRaw,
    files: tabs,

    // Active file
    activeFileId,
    activeFileName,
    activeFileContent,
    activeFileLanguage,
    fileContents,
    dirtyFiles,
    selectedFileId,
    setSelectedFileId,

    // Tab management
    activeTab,
    setActiveTab,
    tabs,
    handleFileSelect,
    handleTabClose,
    handleTabReorder,
    handleTabPin,
    handleTabDuplicate,
    handleSplitRight,
    handleAddTool,

    // Code editing
    handleCodeChange,
    handleCursorChange,

    // UI state
    showFileExplorer,
    setShowFileExplorer,
    isRunning,
    setIsRunning,
    executionId,
    setExecutionId,
    activeActivityItem,
    setActiveActivityItem,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    leftPanelTab,
    setLeftPanelTab,
    deploymentTab,
    setDeploymentTab,
    showToolsSheet,
    setShowToolsSheet,
    showQuickFileSearch,
    setShowQuickFileSearch,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    agentToolsSettings,
    setAgentToolsSettings,
    pendingAIMessage,
    setPendingAIMessage,

    // Status bar
    gitBranch,
    gitChangesCount,
    cursorPosition,
    lastSaved,
    problemsCount,
    publishState,

    // Workspace / runner
    wsLoading,
    runnerOnline,
    wsConnected,
    wsStatus,
    livePreviewUrl,
    connectionQuality,
    remoteUsers,
    activeYtext: null,
    remoteAwareness: null,
    collabConnected,
    logs,
    currentConsoleRunId,

    // Visual editor
    visualEditorActive,
    selectedVEElement,
    setSelectedVEElement,
    handleVisualEditorToggle,

    // Workspace mode
    workspaceMode,
    setWorkspaceMode,

    // Split editor
    splitEditorFileId,
    setSplitEditorFileId,

    // Git / blame
    blameEnabled,
    setBlameEnabled,
    blameData,

    // Merge conflicts
    mergeConflicts,
    setMergeConflicts,
    mergeResolutions,
    setMergeResolutions,

    // Workspace control
    handleStartWorkspace,
    handleStopWorkspace,
    handleRunStop,

    // Mutations
    updateProjectMutation,
    visibilityMutation,
    publishMutation,
    inviteGuestMutation,
    removeGuestMutation,
    frameworkPublishMutation,
    frameworkUnpublishMutation,
    deploySettingsMutation,
    forkMutation,
    uploadFileMutation,
    createArtifactMutation,
    applyVisualEditMutation,

    // Invite
    inviteLink,
    inviteLinkCopied,
    inviteLoading,
    handleGenerateInviteLink,
    handleCopyInviteLink,
    copyShareUrl,

    // Dialogs
    projectSettingsOpen,
    setProjectSettingsOpen,
    publishDialogOpen,
    setPublishDialogOpen,
    inviteDialogOpen,
    setInviteDialogOpen,
    animationExportOpen,
    setAnimationExportOpen,
    conversionDialogOpen,
    setConversionDialogOpen,
    conversionFrameId,
    conversionFrameName,
    conversionTargetType,
    addArtifactDialogOpen,
    setAddArtifactDialogOpen,
    newArtifactName,
    setNewArtifactName,
    newArtifactType,
    setNewArtifactType,

    // Framework fields
    frameworkCheckbox,
    setFrameworkCheckbox,
    frameworkDesc,
    setFrameworkDesc,
    frameworkCategory,
    setFrameworkCategory,
    frameworkCoverUrl,
    setFrameworkCoverUrl,

    // Deploy fields
    deployIsPrivate,
    setDeployIsPrivate,
    deployInviteEmail,
    setDeployInviteEmail,

    // Project settings form
    projectNameInput,
    setProjectNameInput,
    projectLangInput,
    setProjectLangInput,

    // Guests
    guestsQuery,

    // Callbacks
    handleFileCreated,
    handleFileUpdated,
  };
}
