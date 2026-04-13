/**
 * useIDEWorkspace - Centralized IDE state management hook
 * 
 * Extracts all shared IDE state from IDEPage.tsx into a reusable hook
 * that desktop, tablet, and mobile views can consume.
 * 
 * @param projectId - The project ID to load
 * @returns All IDE state, queries, and action handlers
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { safeSessionStorage } from '@/lib/safe-storage';
import type { File, Project } from '@shared/schema';
import type { ActivityItem } from '@/components/ide/ReplitActivityBar';
import type { Tab as EditorTab } from '@/components/ide/ReplitTabBar';

export interface Tab {
  id: string;
  label: string;
  closable?: boolean;
  pinned?: boolean;
  modified?: boolean;
  path?: string;
}

export interface AgentToolsSettings {
  maxAutonomy: boolean;
  appTesting: boolean;
  extendedThinking: boolean;
  highPowerModels: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface ProblemsCount {
  errors: number;
  warnings: number;
}

export interface PublishState {
  status: 'idle' | 'publishing' | 'live' | 'failed' | 'needs-republish';
  url?: string;
  deployedAt?: string;
  errorMessage?: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export type DeploymentStatus = 'idle' | 'deploying' | 'live' | 'failed';

export interface AvailableTool {
  id: string;
  label: string;
  icon: string;
}

const getStorageKey = (projectId: string) => `ide-state-${projectId}`;

const loadPersistedState = (projectId: string) => {
  if (typeof window === 'undefined') return null;
  const stored = safeSessionStorage.getItem(getStorageKey(projectId));
  return stored ? JSON.parse(stored) : null;
};

const savePersistedState = (projectId: string, state: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  safeSessionStorage.setItem(getStorageKey(projectId), JSON.stringify(state));
};

const _decodedTokenCache = new Map<string, any>();
const decodeBootstrapToken = (token: string) => {
  if (!token || token.length < 10) return null;
  if (_decodedTokenCache.has(token)) return _decodedTokenCache.get(token);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      _decodedTokenCache.set(token, null);
      return null;
    }

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      if (pad === 1) {
        throw new Error('Invalid base64url string');
      }
      base64 += new Array(5 - pad).join('=');
    }

    const payload = JSON.parse(atob(base64));
    const result = {
      projectId: payload.projectId,
      sessionId: payload.sessionId,
      conversationId: payload.conversationId,
      userId: payload.userId
    };
    _decodedTokenCache.set(token, result);
    return result;
  } catch (e) {
    _decodedTokenCache.set(token, null);
    return null;
  }
};

const defaultAgentToolsSettings: AgentToolsSettings = {
  maxAutonomy: false,
  appTesting: true,
  extendedThinking: false,
  highPowerModels: false,
  webSearch: false,
  imageGeneration: true
};

const getStoredAgentToolsSettings = (projectId: string): AgentToolsSettings | null => {
  if (typeof window === 'undefined') return null;
  const stored = safeSessionStorage.getItem(`agent-tools-settings-${projectId}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('[useIDEWorkspace] Failed to parse agentToolsSettings:', e);
    }
  }
  return null;
};

export const availableTools: AvailableTool[] = [
  { id: 'console', label: 'Console', icon: '🖥️' },
  { id: 'terminal', label: 'Terminal', icon: '⌨️' },
  { id: 'git', label: 'Git', icon: '🔀' },
  { id: 'database', label: 'Database', icon: '💾' },
  { id: 'secrets', label: 'Secrets', icon: '🔐' },
  { id: 'packages', label: 'Packages', icon: '📦' },
  { id: 'testing', label: 'Tests', icon: '🧪' },
  { id: 'problems', label: 'Problems', icon: '⚠️' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'debugger', label: 'Debugger', icon: '🐛' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'output', label: 'Output', icon: '📄' },
  { id: 'security', label: 'Security', icon: '🛡️' },
  { id: 'resources', label: 'Resources', icon: '📊' },
  { id: 'deployment', label: 'Deploy', icon: '🚀' },
  { id: 'env', label: 'Environment', icon: '🔑' },
  { id: 'import-export', label: 'Import/Export', icon: '📁' },
  { id: 'database-browser', label: 'DB Browser', icon: '🗄️' },
  { id: 'package-viewer', label: 'Package Viewer', icon: '📦' },
  { id: 'ai-assistant', label: 'AI Assistant', icon: '🤖' },
  { id: 'billing', label: 'Billing', icon: '💳' },
  { id: 'extensions', label: 'Extensions', icon: '🧩' },
  { id: 'test-runner', label: 'Test Runner', icon: '🧪' },
  { id: 'shell', label: 'Shell', icon: '⌨️' },
  { id: 'webpreview', label: 'Web Preview', icon: '🌐' },
  { id: 'env-vars', label: 'Env Vars Manager', icon: '🔐' },
  { id: 'global-search', label: 'Global Search', icon: '🔎' },
  { id: 'logs', label: 'Logs Viewer', icon: '📋' },
  { id: 'progress', label: 'Progress', icon: '📊' },
  { id: 'video-replay', label: 'Video Replay', icon: '🎬' },
  { id: 'visual-editor', label: 'Visual Editor', icon: '🎨' },
  { id: 'rewind', label: 'Rewind', icon: '⏪' },
  { id: 'workflows', label: 'Workflows', icon: '⚡' },
  { id: 'collaboration', label: 'Collaboration', icon: '👥' },
  { id: 'auth', label: 'Auth', icon: '🔐' },
  { id: 'storage', label: 'App Storage', icon: '🗂️' },
  { id: 'history', label: 'History', icon: '⏱️' },
  { id: 'checkpoints', label: 'Checkpoints', icon: '📌' },
  { id: 'themes', label: 'Themes', icon: '🎨' },
  { id: 'multiplayers', label: 'Multiplayer', icon: '👥' },
  { id: 'deploy', label: 'Deploy', icon: '🚀' },
  { id: 'preview', label: 'Preview', icon: '👁️' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'task-board', label: 'Task Board', icon: '📋' },
  { id: 'task-detail', label: 'Task Detail', icon: '📝' },
];

export function useIDEWorkspace(projectId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse URL params
  const searchParams = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search) 
    : new URLSearchParams();
  const panelParam = searchParams.get('panel');
  const promptParam = searchParams.get('prompt');
  const autoStartAgent = searchParams.get('agent') === 'true' || panelParam === 'agent';
  const bootstrapToken = searchParams.get('bootstrap');

  // Decode bootstrap token
  const tokenData = bootstrapToken ? decodeBootstrapToken(bootstrapToken) : null;
  const agentSessionId = tokenData?.sessionId || null;
  const agentConversationId = tokenData?.conversationId || null;

  // Load persisted state
  const persistedState = loadPersistedState(projectId);
  const validatedState = persistedState ? {
    ...persistedState,
    selectedFileId: persistedState.selectedFileId && persistedState.tabs?.some((t: Tab) => t.id === `file:${persistedState.selectedFileId}`)
      ? persistedState.selectedFileId
      : undefined,
  } : null;

  // ========== BASE STATES ==========
  const defaultTabs: Tab[] = [
    { id: 'preview', label: 'Preview', closable: false },
    { id: 'console', label: 'Console', closable: false },
    { id: 'shell', label: 'Shell', closable: false }
  ];
  const restoredTabs = validatedState?.tabs || defaultTabs;
  const ensuredTabs = restoredTabs.some((t: Tab) => t.id === 'preview')
    ? restoredTabs
    : [{ id: 'preview', label: 'Preview', closable: false }, ...restoredTabs];
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const [activeTab, setActiveTab] = useState(isDesktop ? 'preview' : (validatedState?.activeTab || 'preview'));
  const [tabs, setTabs] = useState<Tab[]>(ensuredTabs);
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(validatedState?.selectedFileId);
  const [showFileExplorer, setShowFileExplorer] = useState(validatedState?.showFileExplorer ?? true);
  const [isRunning, setIsRunning] = useState(false);

  // ========== ACTIVITY STATES ==========
  const [activeActivityItem, setActiveActivityItem] = useState<ActivityItem>('files');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeEditorTabId, setActiveEditorTabId] = useState<string>('');

  // ========== PANEL STATES ==========
  const [leftPanelTab, setLeftPanelTab] = useState<string>('agent');
  const [deploymentTab, setDeploymentTab] = useState<'deploy' | 'logs' | 'analytics' | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showReplitDB, setShowReplitDB] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showQuickFileSearch, setShowQuickFileSearch] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // ========== AGENT STATES ==========
  const [agentToolsSettings, setAgentToolsSettingsInternal] = useState<AgentToolsSettings>(() => {
    return getStoredAgentToolsSettings(projectId) || defaultAgentToolsSettings;
  });

  const setAgentToolsSettings = useCallback((newSettings: AgentToolsSettings) => {
    setAgentToolsSettingsInternal(newSettings);
    safeSessionStorage.setItem(`agent-tools-settings-${projectId}`, JSON.stringify(newSettings));
  }, [projectId]);

  // ========== GIT STATES ==========
  const [gitBranch, setGitBranch] = useState('main');
  const [gitChangesCount, setGitChangesCount] = useState(0);

  // ========== EDITOR STATES ==========
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [problemsCount, setProblemsCount] = useState<ProblemsCount>({ errors: 0, warnings: 0 });

  // ========== RUNTIME STATE ==========
  const [runtimeAutoStarted, setRuntimeAutoStarted] = useState(false);
  const [executionId, setExecutionId] = useState<string | undefined>();

  // ========== BOOTSTRAP PROMPT STATE ==========
  const bootstrapPromptKey = `agent-prompt-${projectId}`;
  const [persistedBootstrapPrompt, setPersistedBootstrapPrompt] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = safeSessionStorage.getItem(bootstrapPromptKey);
      if (saved) return saved;
    }
    return null;
  });

  // ========== QUERIES ==========
  // ✅ FIX (Dec 25, 2025): Use stable query keys without bootstrap flag
  // This ensures cache persists when bootstrap token is cleared
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const url = `/api/projects/${projectId}${bootstrapToken ? `?bootstrap=${bootstrapToken}` : ''}`;
      const res = await apiRequest<Project>('GET', url);
      return res;
    },
    enabled: !!projectId && (!!user || !!bootstrapToken),
    staleTime: Infinity,
  });

  const { data: files = [], isLoading: isLoadingFiles } = useQuery<File[]>({
    queryKey: ['/api/projects', projectId, 'files'],
    queryFn: async () => {
      const url = `/api/projects/${projectId}/files${bootstrapToken ? `?bootstrap=${bootstrapToken}` : ''}`;
      const res = await apiRequest<File[]>('GET', url);
      return res || [];
    },
    enabled: !!projectId && (!!user || !!bootstrapToken),
    staleTime: Infinity,
  });

  const { data: publishState } = useQuery<PublishState>({
    queryKey: ['/api/projects', projectId, 'publish', 'status'],
    enabled: !!projectId && !!user,
    refetchInterval: (_data, _query) => {
      const data = _data;
      return data?.status === 'publishing' ? 2000 : false;
    },
  });

  // RATE LIMIT FIX: Increased refetchInterval from 30s to 60s
  const { data: gitStatus } = useQuery<GitStatus>({
    queryKey: ['/api/git/status'],
    enabled: !!projectId && !!user,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ========== DERIVED STATE ==========
  const deploymentStatus: DeploymentStatus = publishState?.status === 'publishing' 
    ? 'deploying' 
    : publishState?.status === 'live' || publishState?.status === 'needs-republish'
    ? 'live'
    : publishState?.status === 'failed'
    ? 'failed'
    : 'idle';

  const storedPrompt = projectId ? safeSessionStorage.getItem(`agent-prompt-${projectId}`) : null;

  const agentInitialPrompt = useMemo(() => {
    if (promptParam) return promptParam;
    if (autoStartAgent && storedPrompt) return storedPrompt;
    if (persistedBootstrapPrompt) return persistedBootstrapPrompt;
    if (bootstrapToken && project?.description) return project.description;
    return null;
  }, [promptParam, autoStartAgent, storedPrompt, persistedBootstrapPrompt, bootstrapToken, project?.description]);

  // Null safety for project object usage
  const isOwner = project && user ? project.ownerId === user.id : false;
  const projectTitle = project?.name || 'Loading...';

  // ========== EFFECTS ==========

  // Persist prompt from URL param
  useEffect(() => {
    if (promptParam && projectId) {
      safeSessionStorage.setItem(`agent-prompt-${projectId}`, promptParam);
      const url = new URL(window.location.href);
      url.searchParams.delete('prompt');
      window.history.replaceState({}, '', url);
    }
  }, [promptParam, projectId]);

  // Persist bootstrap prompt
  useEffect(() => {
    if (bootstrapToken && project?.description && !persistedBootstrapPrompt) {
      setPersistedBootstrapPrompt(project.description);
      safeSessionStorage.setItem(bootstrapPromptKey, project.description);
    }
  }, [bootstrapToken, project?.description, persistedBootstrapPrompt, bootstrapPromptKey]);

  // Persist IDE state
  useEffect(() => {
    if (!projectId) return;
    savePersistedState(projectId, {
      activeTab,
      tabs,
      selectedFileId,
      showFileExplorer,
    });
  }, [projectId, activeTab, tabs, selectedFileId, showFileExplorer]);

  // Switch to deployment tab when triggered
  useEffect(() => {
    if (deploymentTab) {
      setLeftPanelTab('deployment');
    }
  }, [deploymentTab]);

  // Update git changes count from query
  useEffect(() => {
    if (gitStatus) {
      const totalChanges = (gitStatus.staged?.length || 0) + 
                          (gitStatus.unstaged?.length || 0) + 
                          (gitStatus.untracked?.length || 0);
      setGitChangesCount(totalChanges);
      if (gitStatus.branch) {
        setGitBranch(gitStatus.branch);
      }
    }
  }, [gitStatus]);

  // Auto-open first file when project loads and no file is currently open
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (isLoadingFiles || files.length === 0) return;
    const hasOpenFileTab = tabs.some(t => t.id.startsWith('file:'));
    if (hasOpenFileTab || selectedFileId) return;

    const PREFERRED_NAMES = ['main.py', 'index.js', 'main.js', 'index.ts', 'main.ts', 'index.html', 'main.rb', 'main.go', 'Main.java', 'main.c', 'main.cpp', 'main.rs', 'main.lua', 'main.php'];
    const preferred = files.find(f => PREFERRED_NAMES.includes(f.filename || f.name) && !f.isDirectory);
    const firstFile = preferred || files.find(f => !f.isDirectory);
    if (!firstFile) return;

    autoOpenedRef.current = true;
    setSelectedFileId(firstFile.id);
    const tabId = `file:${firstFile.id}`;
    setTabs(prev => {
      if (!prev.find(t => t.id === tabId)) {
        return [...prev, { id: tabId, label: firstFile.filename || firstFile.name || String(firstFile.id), closable: true }];
      }
      return prev;
    });
    setActiveTab(tabId);
  }, [files, isLoadingFiles, tabs, selectedFileId]);

  // Auto-start runtime
  useEffect(() => {
    if (!runtimeAutoStarted && projectId && project && !isLoadingProject) {
      setRuntimeAutoStarted(true);
      apiRequest<{ success?: boolean; executionId?: string }>('POST', '/api/runtime/start', {
        projectId,
        mainFile: undefined,
        timeout: 30000
      }).then((data) => {
        setIsRunning(true);
        if (data?.executionId) setExecutionId(data.executionId);
      }).catch(() => {
      });
    }
  }, [projectId, project, isLoadingProject, runtimeAutoStarted]);

  // ========== CALLBACKS ==========

  const handleWorkspaceComplete = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('bootstrap');
    window.history.replaceState({}, '', url);
    
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
    
    toast({
      title: "Workspace Ready!",
      description: "Your AI-powered workspace has been created successfully.",
    });
  }, [projectId, toast, queryClient]);

  const handleWorkspaceError = useCallback((error: string) => {
    toast({
      title: "Workspace Creation Failed",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  const handleRunStop = useCallback(async () => {
    if (isRunning) {
      try {
        await apiRequest('POST', `/api/preview/projects/${projectId}/preview/stop`, {});
      } catch (_) {}
      setIsRunning(false);
      setExecutionId(undefined);
    } else {
      try {
        setIsRunning(true);
        const data = await apiRequest<{ success?: boolean; url?: string; executionId?: string }>(
          'POST', `/api/preview/projects/${projectId}/preview/start`, {}
        );
        if (data?.executionId) setExecutionId(data.executionId);
      } catch (_) {
        setIsRunning(false);
      }
    }
  }, [isRunning, projectId, setIsRunning, setExecutionId]);

  const handleFileSelect = useCallback((file: { id: string | number; name?: string; filename?: string }) => {
    const fId = String(file.id);
    setSelectedFileId(fId);
    const tabId = `file:${fId}`;
    const label = file.filename || file.name || fId;
    setTabs(prev => {
      if (!prev.find(t => t.id === tabId)) {
        return [...prev, { id: tabId, label, closable: true }];
      }
      return prev;
    });
    setActiveTab(tabId);
  }, []);

  const handleAddTool = useCallback((toolId: string) => {
    const tool = availableTools.find(t => t.id === toolId);
    if (!tool) return;
    
    if (tabs.find(t => t.id === toolId)) {
      setActiveTab(toolId);
      return;
    }
    
    setTabs(prev => [...prev, { id: toolId, label: tool.label, closable: true }]);
    setActiveTab(toolId);
  }, [tabs]);

  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTab === tabId) {
        setActiveTab(newTabs[0]?.id || 'preview');
      }
      return newTabs;
    });
  }, [activeTab]);

  const handleTabReorder = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);
      return newTabs;
    });
  }, []);

  const handleTabPin = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === tabId);
      if (tabIndex === -1) return prev;
      
      const tab = prev[tabIndex];
      const newTab = { ...tab, pinned: !tab.pinned };
      const newTabs = prev.filter(t => t.id !== tabId);
      
      if (newTab.pinned) {
        const pinnedCount = newTabs.filter(t => t.pinned).length;
        newTabs.splice(pinnedCount, 0, newTab);
      } else {
        const pinnedCount = newTabs.filter(t => t.pinned).length;
        newTabs.splice(pinnedCount, 0, newTab);
      }
      
      return newTabs;
    });
  }, []);

  const handleTabDuplicate = useCallback((tabId: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      
      const duplicateId = `${tabId}-copy-${Date.now()}`;
      const duplicateTab: Tab = {
        ...tab,
        id: duplicateId,
        label: `${tab.label} (copy)`,
        pinned: false,
      };
      
      const tabIndex = prev.findIndex(t => t.id === tabId);
      const newTabs = [...prev];
      newTabs.splice(tabIndex + 1, 0, duplicateTab);
      
      return newTabs;
    });
    toast({
      title: "Tab duplicated",
      description: "A copy of the tab has been created.",
    });
  }, [toast]);

  const handleSplitRight = useCallback((tabId: string) => {
    toast({
      title: "Split view",
      description: "Split view feature coming soon.",
    });
  }, [toast]);

  const handleToolsSheetSelect = useCallback((toolId: string) => {
    handleAddTool(toolId);
    setShowToolsSheet(false);
  }, [handleAddTool]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const refreshFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
  }, [queryClient, projectId]);

  const refreshProject = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
  }, [queryClient, projectId]);

  const projectLanguage = project?.language || 'javascript';
  const projectName = project?.name || 'Untitled Project';
  const projectDescription = project?.description || '';

  return {
    // Project info
    projectId,
    project,
    projectLanguage,
    projectName,
    projectDescription,
    isLoadingProject,
    files,
    isLoadingFiles,

    // Base states
    activeTab,
    setActiveTab,
    tabs,
    setTabs,
    selectedFileId,
    setSelectedFileId,
    showFileExplorer,
    setShowFileExplorer,
    isRunning,
    setIsRunning,
    executionId,
    setExecutionId,

    // Activity states
    activeActivityItem,
    setActiveActivityItem,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar,
    editorTabs,
    setEditorTabs,
    activeEditorTabId,
    setActiveEditorTabId,

    // Panel states
    leftPanelTab,
    setLeftPanelTab,
    deploymentTab,
    setDeploymentTab,
    showCommandPalette,
    setShowCommandPalette,
    showGlobalSearch,
    setShowGlobalSearch,
    showReplitDB,
    setShowReplitDB,
    showCollaboration,
    setShowCollaboration,
    showToolsSheet,
    setShowToolsSheet,
    showQuickFileSearch,
    setShowQuickFileSearch,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,

    // Agent states
    agentToolsSettings,
    setAgentToolsSettings,
    bootstrapToken,
    agentSessionId,
    agentConversationId,
    autoStartAgent,
    agentInitialPrompt,

    // Git states
    gitBranch,
    setGitBranch,
    gitChangesCount,
    setGitChangesCount,
    gitStatus,

    // Editor states
    cursorPosition,
    setCursorPosition,
    lastSaved,
    setLastSaved,
    problemsCount,
    setProblemsCount,

    // Deployment
    deploymentStatus,
    publishState,

    // Available tools
    availableTools,

    // Callbacks
    handleRunStop,
    handleWorkspaceComplete,
    handleWorkspaceError,
    handleFileSelect,
    handleAddTool,
    handleTabClose,
    handleTabReorder,
    handleTabPin,
    handleTabDuplicate,
    handleSplitRight,
    handleToolsSheetSelect,
    refreshFiles,
    refreshProject,

    // Auth
    user,
  };
}

export type UseIDEWorkspaceReturn = ReturnType<typeof useIDEWorkspace>;
