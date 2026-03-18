import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useProjectWebSocket } from '@/hooks/use-websocket';
import { useCollaboration } from '@/hooks/use-collaboration';
import { apiRequest, getCsrfToken } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { Project as ProjectType, File, ProjectGuest, Artifact } from '@shared/schema';
import type { UserPreferences, MergeConflictFile, MergeResolution } from '@shared/schema';
import { DEFAULT_PREFERENCES, COMMUNITY_THEMES } from '@shared/schema';
import { detectLanguage } from '@/components/CodeEditor';

export interface TabItem {
  id: string;
  label: string;
  closable: boolean;
  pinned?: boolean;
  modified?: boolean;
  path?: string;
}

export interface FileItem {
  id: number;
  name: string;
  path?: string;
  content?: string;
  language?: string;
}

export type ActivityItem =
  | 'files' | 'search' | 'git' | 'packages' | 'debug'
  | 'terminal' | 'agent' | 'deploy' | 'secrets' | 'database'
  | 'preview' | 'workflows' | 'history' | 'extensions' | 'settings';

export const availableTools = [
  'preview', 'terminal', 'git', 'packages', 'secrets', 'database',
  'deployment', 'search', 'debugger', 'settings', 'history',
  'checkpoints', 'workflows', 'extensions', 'collaboration',
  'security', 'shell', 'console', 'resources', 'logs', 'visual-editor',
];

interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'error' | 'success';
}

export function useIDEWorkspace(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════
  // WEBSOCKET & COLLABORATION
  // ═══════════════════════════════════════════════
  const {
    messages,
    connected: wsConnected,
    connectionQuality,
    retryWebSocket,
    sendMessage: wsSendMessage,
  } = useProjectWebSocket(projectId);

  // ═══════════════════════════════════════════════
  // CORE STATE
  // ═══════════════════════════════════════════════
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
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<'offline' | 'starting' | 'running' | 'stopped' | 'error' | 'none'>('none');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  // UI panel state
  const [activeActivityItem, setActiveActivityItem] = useState<ActivityItem>('files');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<string>('agent');
  const [deploymentTab, setDeploymentTab] = useState<string | null>(null);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showQuickFileSearch, setShowQuickFileSearch] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [agentToolsSettings, setAgentToolsSettings] = useState<Record<string, any>>({});
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [executionId, setExecutionId] = useState<string | null>(null);

  // Git state
  const [currentBranch, setCurrentBranch] = useState('main');
  const [pendingAIMessage, setPendingAIMessage] = useState<string | null>(null);

  // User preferences
  const [userPrefs, setUserPrefsLocal] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const savePrefsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ═══════════════════════════════════════════════
  // WARN ON UNSAVED CHANGES
  // ═══════════════════════════════════════════════
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyFiles.size > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyFiles]);

  // ═══════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════
  const projectQuery = useQuery<ProjectType>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Project not found');
      return res.json();
    },
    enabled: !!projectId,
  });

  const filesQuery = useQuery<File[]>({
    queryKey: ['/api/projects', projectId, 'files'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/files`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load files');
      return res.json();
    },
    enabled: !!projectId,
  });

  const creditBalanceQuery = useQuery<{
    monthlyCreditsIncluded: number;
    remaining: number;
    percentUsed: number;
    overageEnabled: boolean;
    lowCredits: boolean;
    exhausted: boolean;
  }>({
    queryKey: ['/api/billing/credits'],
    queryFn: async () => {
      const res = await fetch('/api/billing/credits', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const deploymentsQuery = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'deployments'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deployments`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  const gitDiffQuery = useQuery<{ branch: string; changes: any[]; hasCommits: boolean }>({
    queryKey: ['/api/projects', projectId, 'git/diff', currentBranch],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/git/diff?branch=${currentBranch}`, { credentials: 'include' });
      if (!res.ok) return { branch: currentBranch, changes: [], hasCommits: false };
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 5000,
  });

  const project = projectQuery.data;
  const isLoadingProject = projectQuery.isLoading;

  // ═══════════════════════════════════════════════
  // COLLABORATION
  // ═══════════════════════════════════════════════
  const {
    remoteUsers,
    remoteAwareness,
    connected: collabConnected,
    sendAwareness: collabSendAwareness,
    getFileDoc,
    isFileSynced,
    onJoinNotification,
  } = useCollaboration(projectId, user?.id, activeFileId);

  useEffect(() => {
    onJoinNotification((userName: string, action: 'joined' | 'left') => {
      toast({
        title: action === 'joined' ? `${userName} joined` : `${userName} left`,
        description: action === 'joined' ? 'Collaborating on this project' : 'No longer editing',
        duration: 3000,
      });
    });
  }, [onJoinNotification]);

  // Y.js text binding for real-time collaboration
  const activeYtext = useMemo(() => {
    if (!activeFileId || !collabConnected) return null;
    if (!isFileSynced(activeFileId)) return null;
    const doc = getFileDoc(activeFileId);
    return doc.ytext;
  }, [activeFileId, collabConnected, isFileSynced, getFileDoc]);

  // ═══════════════════════════════════════════════
  // USER PREFERENCES
  // ═══════════════════════════════════════════════
  useEffect(() => {
    fetch('/api/user/preferences', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs) {
          setUserPrefsLocal(prev => ({ ...prev, ...prefs, agentToolsConfig: { ...prev.agentToolsConfig, ...(prefs.agentToolsConfig || {}) } }));
        }
        setPrefsLoaded(true);
      })
      .catch(() => setPrefsLoaded(true));
  }, []);

  const savePrefs = useCallback((partial: Partial<UserPreferences>) => {
    if (!prefsLoaded) return;
    setUserPrefsLocal(prev => ({ ...prev, ...partial }));
    if (savePrefsTimeout.current) clearTimeout(savePrefsTimeout.current);
    savePrefsTimeout.current = setTimeout(() => {
      fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(partial),
      }).catch(() => {});
    }, 500);
  }, [prefsLoaded]);

  // ═══════════════════════════════════════════════
  // WEBSOCKET MESSAGE HANDLING
  // ═══════════════════════════════════════════════
  useEffect(() => {
    for (const msg of messages) {
      if (msg.type === 'run_log' && msg.message) {
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), text: msg.message!, type: (msg as any).logType || 'info' }]);
      }
      if (msg.type === 'run_status' && (msg as any).status === 'running') {
        setWsStatus('running');
        if ((msg as any).consoleRunId) setCurrentConsoleRunId((msg as any).consoleRunId);
        if ((msg as any).url) setLivePreviewUrl((msg as any).url);
      }
      if (msg.type === 'run_status' && ((msg as any).status === 'completed' || (msg as any).status === 'failed')) {
        setIsRunning(false);
        setWsStatus((msg as any).status === 'completed' ? 'stopped' : 'error');
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'console-runs'] });
          setCurrentConsoleRunId(null);
        }, 500);
      }
      if (msg.type === 'workflow_log' && msg.message) {
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), text: msg.message!, type: (msg as any).logType || 'info' }]);
      }
      if (msg.type === 'workflow_status') {
        if ((msg as any).status === 'running') {
          setIsRunning(true);
          setTerminalVisible(true);
        } else if ((msg as any).status === 'completed' || (msg as any).status === 'failed') {
          setIsRunning(false);
        }
      }
      if (msg.type === 'deploy_log' && (msg as any).line) {
        // Handled by deployment panel
      }
      if (msg.type === 'deploy_status') {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      }
    }
  }, [messages, projectId, queryClient]);

  // ═══════════════════════════════════════════════
  // SAVE MUTATION
  // ═══════════════════════════════════════════════
  const saveMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      if (fileId.startsWith('runner:')) {
        const path = fileId.slice(7);
        await apiRequest('POST', `/api/workspaces/${projectId}/fs/write`, { path, content });
      } else {
        await apiRequest('PATCH', `/api/files/${fileId}`, { content });
      }
    },
    onSuccess: (_, vars) => {
      setDirtyFiles(prev => { const n = new Set(prev); n.delete(vars.fileId); return n; });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to save file', description: err.message || 'Could not save changes.', variant: 'destructive' });
    },
  });

  const autoSave = useCallback((fileId: string, newCode: string) => {
    setDirtyFiles(prev => new Set(prev).add(fileId));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ fileId, content: newCode });
    }, 2000);
  }, [saveMutation]);

  // ═══════════════════════════════════════════════
  // CODE CHANGE HANDLER
  // ═══════════════════════════════════════════════
  const handleCodeChange = useCallback((value: string) => {
    if (!activeFileId) return;
    setFileContents(prev => ({ ...prev, [activeFileId]: value }));
    autoSave(activeFileId, value);
  }, [activeFileId, autoSave]);

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
    if (activeFileId && collabConnected) {
      collabSendAwareness(activeFileId, null);
    }
  }, [activeFileId, collabConnected, collabSendAwareness]);

  // ═══════════════════════════════════════════════
  // RUN / STOP
  // ═══════════════════════════════════════════════
  const runMutation = useMutation({
    mutationFn: async () => {
      // Save dirty file before run
      if (activeFileId && dirtyFiles.has(activeFileId)) {
        await apiRequest('PATCH', `/api/files/${activeFileId}`, { content: fileContents[activeFileId] });
        setDirtyFiles(prev => { const n = new Set(prev); n.delete(activeFileId!); return n; });
      }
      const code = activeFileId ? (fileContents[activeFileId] ?? '') : '';
      const activeFile = filesQuery.data?.find(f => f.id === activeFileId);
      const fileName = activeFile?.filename;
      const ext = fileName?.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', html: 'javascript', css: 'javascript' };
      const language = (ext ? langMap[ext] : undefined) || project?.language || 'javascript';
      const res = await apiRequest('POST', `/api/projects/${projectId}/run`, { code, language, fileName: fileName || undefined });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsRunning(true);
      setWsStatus('starting');
      if (data?.consoleRunId) setCurrentConsoleRunId(data.consoleRunId);
      setTerminalVisible(true);
    },
    onError: (err: any) => {
      toast({ title: 'Run failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleRunStop = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      // Send stop request
      fetch(`/api/projects/${projectId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}) },
        credentials: 'include',
      }).catch(() => {});
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    setLogs([{ id: Date.now(), text: `\x1b[36m━━━ Run started at ${timestamp} ━━━\x1b[0m`, type: 'info' }]);
    setTerminalVisible(true);
    runMutation.mutate();
  }, [isRunning, projectId, runMutation]);

  // ═══════════════════════════════════════════════
  // FILE MUTATIONS
  // ═══════════════════════════════════════════════
  const invalidateFs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
  }, [queryClient, projectId]);

  const createFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/files`, { filename, content: '' });
      return res.json();
    },
    onSuccess: (result: any) => {
      invalidateFs();
      // Open the new file
      const file = result as File;
      openFile(file);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to create file', description: err.message, variant: 'destructive' });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => { await apiRequest('DELETE', `/api/files/${fileId}`); },
    onSuccess: (_, fileId) => {
      closeTab(fileId);
      invalidateFs();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to delete file', description: err.message, variant: 'destructive' });
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ fileId, filename }: { fileId: string; filename: string }) => {
      await apiRequest('PATCH', `/api/files/${fileId}`, { filename });
    },
    onSuccess: () => {
      invalidateFs();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to rename file', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // PUBLISH MUTATION
  // ═══════════════════════════════════════════════
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (project?.isPublished) {
        const res = await apiRequest('POST', `/api/projects/${projectId}/publish`);
        return res.json();
      }
      const res = await apiRequest('POST', `/api/projects/${projectId}/deploy`, { deploymentType: 'static' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({ title: project?.isPublished ? 'Project unpublished' : 'Deployment successful' });
    },
    onError: (err: any) => {
      toast({ title: 'Deploy failed', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // TAB MANAGEMENT
  // ═══════════════════════════════════════════════
  const openFile = useCallback((file: File) => {
    const fileId = String(file.id);
    if (!openTabs.includes(fileId)) setOpenTabs(prev => [...prev, fileId]);
    if (fileContents[fileId] === undefined) setFileContents(prev => ({ ...prev, [fileId]: file.content }));
    setActiveFileId(fileId);
  }, [openTabs, fileContents]);

  const closeTab = useCallback((fileId: string) => {
    if (dirtyFiles.has(fileId) && fileContents[fileId] !== undefined) {
      saveMutation.mutate({ fileId, content: fileContents[fileId] });
    }
    const newTabs = openTabs.filter(id => id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) {
      setActiveFileId(newTabs[newTabs.length - 1] || null);
    }
  }, [openTabs, activeFileId, dirtyFiles, fileContents, saveMutation]);

  // Auto-open first file
  useEffect(() => {
    if (filesQuery.data && filesQuery.data.length > 0 && openTabs.length === 0) {
      const first = filesQuery.data[0];
      setOpenTabs([String(first.id)]);
      setActiveFileId(String(first.id));
      setFileContents(prev => ({ ...prev, [String(first.id)]: first.content }));
    }
  }, [filesQuery.data]);

  // ═══════════════════════════════════════════════
  // MAPPED TAB ITEMS (for new layout components)
  // ═══════════════════════════════════════════════
  const activeFileName = useMemo(() => {
    if (!activeFileId) return null;
    const file = filesQuery.data?.find(f => String(f.id) === activeFileId);
    return file?.filename || null;
  }, [activeFileId, filesQuery.data]);

  const activeFileContent = useMemo(() => {
    if (!activeFileId) return null;
    return fileContents[activeFileId] ?? null;
  }, [activeFileId, fileContents]);

  const activeFileLanguage = useMemo(() => {
    if (!activeFileName) return null;
    return detectLanguage(activeFileName);
  }, [activeFileName]);

  // Convert internal tab state to TabItem[] for new components
  const tabs: TabItem[] = useMemo(() => {
    return openTabs.map(tabId => {
      const isFileTab = !tabId.startsWith('__') && !['preview', 'terminal', 'git', 'packages', 'secrets', 'database',
        'deployment', 'search', 'debugger', 'settings', 'history', 'checkpoints', 'workflows', 'extensions',
        'collaboration', 'security', 'shell', 'console', 'resources', 'logs', 'visual-editor'].includes(tabId);

      if (isFileTab) {
        const file = filesQuery.data?.find(f => String(f.id) === tabId);
        return {
          id: `file:${tabId}`,
          label: file?.filename?.split('/').pop() || tabId,
          closable: true,
          modified: dirtyFiles.has(tabId),
          path: file?.filename,
        };
      }

      const toolLabels: Record<string, string> = {
        preview: 'Preview', terminal: 'Terminal', git: 'Git',
        packages: 'Packages', secrets: 'Secrets', database: 'Database',
        deployment: 'Deploy', search: 'Search', debugger: 'Debugger',
        settings: 'Settings', history: 'History', checkpoints: 'Checkpoints',
        workflows: 'Workflows', extensions: 'Extensions', collaboration: 'Collaboration',
        security: 'Security', shell: 'Shell', console: 'Console',
        resources: 'Resources', logs: 'Logs', 'visual-editor': 'Visual Editor',
      };

      return {
        id: tabId,
        label: toolLabels[tabId] || tabId,
        closable: true,
      };
    });
  }, [openTabs, filesQuery.data, dirtyFiles]);

  const activeTab = useMemo(() => {
    if (!activeFileId) return '';
    const isFile = !['preview', 'terminal', 'git', 'packages', 'secrets', 'database',
      'deployment', 'search', 'debugger', 'settings', 'history', 'checkpoints', 'workflows', 'extensions',
      'collaboration', 'security', 'shell', 'console', 'resources', 'logs', 'visual-editor'].includes(activeFileId);
    return isFile ? `file:${activeFileId}` : activeFileId;
  }, [activeFileId]);

  const setActiveTab = useCallback((tabId: string) => {
    if (tabId.startsWith('file:')) {
      setActiveFileId(tabId.slice(5));
    } else {
      setActiveFileId(tabId);
    }
  }, []);

  const selectedFileId = useMemo(() => {
    if (!activeFileId) return null;
    const num = parseInt(activeFileId, 10);
    return isNaN(num) ? null : num;
  }, [activeFileId]);

  const setSelectedFileId = useCallback((id: number | null) => {
    setActiveFileId(id !== null ? String(id) : null);
  }, []);

  // File select handler (from file explorer)
  const handleFileSelect = useCallback((file: { id: number; name: string }) => {
    const fileId = String(file.id);
    if (!openTabs.includes(fileId)) {
      setOpenTabs(prev => [...prev, fileId]);
    }
    const existing = filesQuery.data?.find(f => f.id === file.id);
    if (existing && fileContents[fileId] === undefined) {
      setFileContents(prev => ({ ...prev, [fileId]: existing.content }));
    }
    setActiveFileId(fileId);
  }, [openTabs, filesQuery.data, fileContents]);

  const handleTabClose = useCallback((tabId: string) => {
    const realId = tabId.startsWith('file:') ? tabId.slice(5) : tabId;
    closeTab(realId);
  }, [closeTab]);

  const handleTabReorder = useCallback((fromIndex: number, toIndex: number) => {
    setOpenTabs(prev => {
      const newTabs = [...prev];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      return newTabs;
    });
  }, []);

  const handleTabPin = useCallback((_tabId: string) => {
    // Tab pinning is visual-only in new layout
  }, []);

  const handleTabDuplicate = useCallback((_tabId: string) => {
    toast({ title: 'Tab duplicated' });
  }, []);

  const handleSplitRight = useCallback((_tabId: string) => {
    toast({ title: 'Split view', description: 'Split view coming soon' });
  }, []);

  const handleAddTool = useCallback((toolId: string) => {
    if (!openTabs.includes(toolId)) {
      setOpenTabs(prev => [...prev, toolId]);
    }
    setActiveFileId(toolId);
  }, [openTabs]);

  // ═══════════════════════════════════════════════
  // DERIVED STATE
  // ═══════════════════════════════════════════════
  const gitChangesCount = gitDiffQuery.data?.changes?.length || 0;
  const cursorPosition = useMemo(() => ({ line: cursorLine, column: cursorCol }), [cursorLine, cursorCol]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!saveMutation.isPending && saveMutation.isSuccess) {
      setLastSaved(new Date());
    }
  }, [saveMutation.isPending, saveMutation.isSuccess]);

  const problemsCount = useMemo(() => ({ errors: 0, warnings: 0 }), []);

  const publishState = useMemo(() => {
    if (!project) return null;
    return {
      status: project.isPublished ? 'live' as const : 'idle' as const,
      url: project.isPublished ? `${window.location.origin}/shared/${projectId}` : undefined,
    };
  }, [project, projectId]);

  const files: FileItem[] = useMemo(() => {
    if (!filesQuery.data) return [];
    return (filesQuery.data as any[]).map((f: any) => ({
      id: f.id,
      name: f.filename || f.name,
      path: f.filename || f.name,
      content: f.content,
      language: f.language,
    }));
  }, [filesQuery.data]);

  // ═══════════════════════════════════════════════
  // CREDIT BALANCE NOTIFICATIONS
  // ═══════════════════════════════════════════════
  const [creditNotificationShown, setCreditNotificationShown] = useState<string | null>(null);
  useEffect(() => {
    const data = creditBalanceQuery.data;
    if (!data || (data.monthlyCreditsIncluded ?? 0) <= 0) return;
    if (data.exhausted && creditNotificationShown !== 'exhausted') {
      setCreditNotificationShown('exhausted');
      toast({ title: 'Credits Exhausted', description: data.overageEnabled
        ? 'Your monthly credits are used up. Additional usage will be billed as overage.'
        : 'Your monthly credits are used up. Upgrade your plan to continue.', variant: 'destructive' });
    } else if (data.lowCredits && !data.exhausted && creditNotificationShown !== 'low') {
      setCreditNotificationShown('low');
      toast({ title: 'Credits Running Low', description: `You have ${data.remaining} credits remaining.` });
    }
  }, [creditBalanceQuery.data, creditNotificationShown]);

  // ═══════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════
  return {
    // Project data
    project,
    projectLanguage: project?.language || 'typescript',
    projectName: project?.name || 'Untitled',
    projectDescription: project?.description || '',
    files,
    filesRaw: filesQuery.data || [],
    isLoadingProject,
    user,

    // Tab state (mapped for new components)
    activeTab,
    setActiveTab,
    tabs,
    selectedFileId,
    setSelectedFileId,

    // Internal file state (for editor/AI)
    activeFileId,
    setActiveFileId,
    activeFileName,
    activeFileContent,
    activeFileLanguage,
    fileContents,
    setFileContents,
    dirtyFiles,
    openTabs,

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

    // Git
    gitBranch: currentBranch,
    gitChangesCount,

    // Editor
    cursorPosition,
    lastSaved,
    problemsCount,
    handleCodeChange,
    handleCursorChange,

    // Publish
    publishState,

    // Callbacks
    handleFileSelect,
    handleTabClose,
    handleTabReorder,
    handleTabPin,
    handleTabDuplicate,
    handleSplitRight,
    handleRunStop,
    handleAddTool,

    // Mutations
    saveMutation,
    createFileMutation,
    deleteFileMutation,
    renameFileMutation,
    publishMutation,

    // WebSocket
    wsConnected,
    wsStatus,
    livePreviewUrl,
    connectionQuality,
    retryWebSocket,

    // Collaboration
    remoteUsers,
    remoteAwareness,
    collabConnected,
    activeYtext,

    // Logs/Console
    logs,
    setLogs,
    currentConsoleRunId,

    // AI
    pendingAIMessage,
    setPendingAIMessage,

    // User preferences
    userPrefs,
    savePrefs,

    // Credits
    creditBalance: creditBalanceQuery.data,

    bootstrapToken: null as string | null,
  };
}
