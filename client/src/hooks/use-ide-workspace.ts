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
import type { SelectedElement, VisualEdit } from '@/components/VisualEditor';
import { injectVisualEditorScript, activateVisualEditor, deactivateVisualEditor } from '@/components/VisualEditor';

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
  'slides', 'video', 'animation', 'design', 'storage', 'themes',
  'testing', 'auth',
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

  // Workspace management state
  const [wsLoading, setWsLoading] = useState(false);
  const [runnerOnline, setRunnerOnline] = useState<boolean | null>(null);

  // Visual editor state
  const [visualEditorActive, setVisualEditorActive] = useState(false);
  const [selectedVEElement, setSelectedVEElement] = useState<SelectedElement | null>(null);
  const [visualEditorIframeId, setVisualEditorIframeId] = useState('webview-tab-iframe');

  // Dialog state
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [animationExportOpen, setAnimationExportOpen] = useState(false);
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [conversionFrameId, setConversionFrameId] = useState('');
  const [conversionFrameName, setConversionFrameName] = useState('');
  const [conversionTargetType, setConversionTargetType] = useState<string | undefined>(undefined);
  const [addArtifactDialogOpen, setAddArtifactDialogOpen] = useState(false);
  const [newArtifactName, setNewArtifactName] = useState('');
  const [newArtifactType, setNewArtifactType] = useState('web-app');

  // Framework publishing state
  const [frameworkCheckbox, setFrameworkCheckbox] = useState(false);
  const [frameworkDesc, setFrameworkDesc] = useState('');
  const [frameworkCategory, setFrameworkCategory] = useState('other');
  const [frameworkCoverUrl, setFrameworkCoverUrl] = useState('');

  // Deploy dialog state
  const [deployIsPrivate, setDeployIsPrivate] = useState(false);
  const [deployShowBadge, setDeployShowBadge] = useState(true);
  const [deployEnableFeedback, setDeployEnableFeedback] = useState(false);
  const [deployInviteEmail, setDeployInviteEmail] = useState('');

  // Project settings form state
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectLangInput, setProjectLangInput] = useState('');

  // Workspace mode
  const [workspaceMode, setWorkspaceMode] = useState<'editor' | 'canvas'>('editor');

  // Tab pinning state
  const [pinnedTabs, setPinnedTabs] = useState<Set<string>>(new Set());

  // Split editor state
  const [splitEditorFileId, setSplitEditorFileId] = useState<string | null>(null);

  // Git blame
  const [blameEnabled, setBlameEnabled] = useState(false);

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
  // UPDATE PROJECT MUTATION
  // ═══════════════════════════════════════════════
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; language?: string }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      setProjectSettingsOpen(false);
      toast({ title: 'Project updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update project', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // VISIBILITY MUTATION
  // ═══════════════════════════════════════════════
  const visibilityMutation = useMutation({
    mutationFn: async (visibility: string) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/visibility`, { visibility });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update visibility', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // GUESTS QUERY & MUTATIONS
  // ═══════════════════════════════════════════════
  const guestsQuery = useQuery<ProjectGuest[]>({
    queryKey: ['/api/projects', projectId, 'guests'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/guests`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: project?.visibility === 'private',
  });

  const inviteGuestMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/guests`, { email, role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'guests'] });
      toast({ title: 'Guest invited' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to invite guest', description: err.message, variant: 'destructive' });
    },
  });

  const removeGuestMutation = useMutation({
    mutationFn: async (guestId: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/guests/${guestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'guests'] });
      toast({ title: 'Guest removed' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to remove guest', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // INVITE LINK
  // ═══════════════════════════════════════════════
  const handleGenerateInviteLink = useCallback(async () => {
    if (!projectId) return;
    setInviteLoading(true);
    setInviteLinkCopied(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'editor' }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create invite link');
      const data = await res.json();
      const fullUrl = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(fullUrl);
    } catch {
      toast({ title: 'Error', description: 'Failed to generate invite link', variant: 'destructive' });
    } finally {
      setInviteLoading(false);
    }
  }, [projectId]);

  const handleCopyInviteLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    });
  }, [inviteLink]);

  const copyShareUrl = useCallback(() => {
    const url = `${window.location.origin}/shared/${projectId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'URL copied to clipboard' });
    });
  }, [projectId]);

  // ═══════════════════════════════════════════════
  // FRAMEWORK PUBLISH / UNPUBLISH
  // ═══════════════════════════════════════════════
  const frameworkPublishMutation = useMutation({
    mutationFn: async (data: { description?: string; category?: string; coverUrl?: string }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/publish-as-framework`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Published as Developer Framework' });
    },
    onError: (err: any) => {
      toast({ title: 'Framework publish failed', description: err.message, variant: 'destructive' });
    },
  });

  const frameworkUnpublishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/unpublish-framework`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      toast({ title: 'Removed from frameworks catalog' });
    },
    onError: (err: any) => {
      toast({ title: 'Unpublish failed', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // DEPLOY SETTINGS MUTATION
  // ═══════════════════════════════════════════════
  const deploySettingsMutation = useMutation({
    mutationFn: async (settings: { isPrivate?: boolean; showBadge?: boolean; enableFeedback?: boolean }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/deploy/settings`, settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'deployments'] });
      toast({ title: 'Settings updated' });
    },
  });

  // ═══════════════════════════════════════════════
  // FORK MUTATION
  // ═══════════════════════════════════════════════
  const forkMutation = useMutation({
    mutationFn: async (visibility?: string) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/fork`, { visibility: visibility || 'public' });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Project forked!', description: `Created "${data.name}"` });
      window.location.href = `/project/${data.id}`;
    },
    onError: (err: any) => {
      toast({ title: 'Fork failed', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // WORKSPACE MANAGEMENT
  // ═══════════════════════════════════════════════
  const workspaceStatusQuery = useQuery({
    queryKey: ['/api/workspaces', projectId, 'status'],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${projectId}/status`, { credentials: 'include' });
      if (res.status === 404) return { status: 'none' };
      if (!res.ok) return { status: 'error' };
      return res.json();
    },
    refetchInterval: wsStatus === 'starting' || wsStatus === 'running' ? 5000 : false,
  });

  useEffect(() => {
    if (workspaceStatusQuery.data?.status) {
      setWsStatus(workspaceStatusQuery.data.status);
    }
  }, [workspaceStatusQuery.data]);

  const initWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/workspaces/${projectId}`);
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.online) {
        setRunnerOnline(false);
        setWsStatus('offline');
        toast({ title: 'Runner offline', description: 'The runner VPS is not yet deployed', variant: 'destructive' });
      } else if (data.error) {
        setRunnerOnline(true);
        setWsStatus('error');
        toast({ title: 'Workspace error', description: data.error, variant: 'destructive' });
      } else {
        setRunnerOnline(true);
        setWsStatus('stopped');
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', projectId, 'status'] });
      }
    },
    onError: () => {
      setWsStatus('error');
    },
  });

  const startWorkspaceMutation = useMutation({
    mutationFn: async () => {
      setWsLoading(true);
      const res = await apiRequest('POST', `/api/workspaces/${projectId}/start`);
      return res.json();
    },
    onSuccess: () => {
      setWsStatus('running');
      setWsLoading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', projectId, 'status'] });
      toast({ title: 'Workspace started' });
    },
    onError: () => {
      setWsStatus('error');
      setWsLoading(false);
      toast({ title: 'Failed to start workspace', variant: 'destructive' });
    },
  });

  const stopWorkspaceMutation = useMutation({
    mutationFn: async () => {
      setWsLoading(true);
      const res = await apiRequest('POST', `/api/workspaces/${projectId}/stop`);
      return res.json();
    },
    onSuccess: () => {
      setWsStatus('stopped');
      setWsLoading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', projectId, 'status'] });
      toast({ title: 'Workspace stopped' });
    },
    onError: () => {
      setWsStatus('error');
      setWsLoading(false);
    },
  });

  const handleStartWorkspace = useCallback(() => {
    if (wsStatus === 'none' || wsStatus === 'offline') {
      initWorkspaceMutation.mutate();
    } else if (wsStatus === 'stopped' || wsStatus === 'error') {
      setWsStatus('starting');
      startWorkspaceMutation.mutate();
    }
  }, [wsStatus, initWorkspaceMutation, startWorkspaceMutation]);

  const handleStopWorkspace = useCallback(() => {
    if (wsStatus === 'running') {
      stopWorkspaceMutation.mutate();
    }
  }, [wsStatus, stopWorkspaceMutation]);

  // ═══════════════════════════════════════════════
  // UPLOAD FILE
  // ═══════════════════════════════════════════════
  const uploadFileMutation = useMutation({
    mutationFn: async (files: globalThis.File[]) => {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => {
      invalidateFs();
      toast({ title: 'Files uploaded' });
    },
    onError: (err: any) => {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // CREATE ARTIFACT MUTATION
  // ═══════════════════════════════════════════════
  const createArtifactMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: string }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/artifacts`, { name, type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'artifacts'] });
      setAddArtifactDialogOpen(false);
      setNewArtifactName('');
      toast({ title: 'Artifact created' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to create artifact', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // VISUAL EDITOR
  // ═══════════════════════════════════════════════
  const handleVisualEditorToggle = useCallback((iframeId: string) => {
    setVisualEditorActive(prev => {
      if (prev && visualEditorIframeId === iframeId) {
        deactivateVisualEditor(iframeId);
        setSelectedVEElement(null);
        return false;
      }
      setVisualEditorIframeId(iframeId);
      activateVisualEditor(iframeId);
      return true;
    });
  }, [visualEditorIframeId]);

  const applyVisualEditMutation = useMutation({
    mutationFn: async (edit: VisualEdit) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/visual-edit`, edit);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Visual edit applied' });
      invalidateFs();
    },
    onError: (err: any) => {
      toast({ title: 'Visual edit failed', description: err.message, variant: 'destructive' });
    },
  });

  // ═══════════════════════════════════════════════
  // GIT BLAME QUERY
  // ═══════════════════════════════════════════════
  const blameQuery = useQuery({
    queryKey: ['/api/projects', projectId, 'git/blame', activeFileId],
    queryFn: async () => {
      if (!activeFileId) return null;
      const file = filesQuery.data?.find(f => String(f.id) === activeFileId);
      if (!file) return null;
      const res = await fetch(`/api/projects/${projectId}/git/blame?file=${encodeURIComponent(file.filename)}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId && !!activeFileId && blameEnabled,
    staleTime: 10000,
  });

  // Sync project settings form state when project loads
  useEffect(() => {
    if (project) {
      setProjectNameInput(project.name || '');
      setProjectLangInput(project.language || '');
    }
  }, [project]);

  // Restore workspace mode from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`workspace-mode-${projectId}`);
      if (saved === 'canvas') setWorkspaceMode('canvas');
    } catch {}
  }, [projectId]);

  useEffect(() => {
    try {
      localStorage.setItem(`workspace-mode-${projectId}`, workspaceMode);
    } catch {}
  }, [workspaceMode, projectId]);

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
          closable: !pinnedTabs.has(tabId),
          pinned: pinnedTabs.has(tabId),
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
    const existing = filesQuery.data?.find(f => String(f.id) === String(file.id));
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

  const handleTabPin = useCallback((tabId: string) => {
    const realId = tabId.startsWith('file:') ? tabId.slice(5) : tabId;
    setPinnedTabs(prev => {
      const next = new Set(prev);
      if (next.has(realId)) {
        next.delete(realId);
      } else {
        next.add(realId);
      }
      return next;
    });
  }, []);

  const handleTabDuplicate = useCallback((tabId: string) => {
    const realId = tabId.startsWith('file:') ? tabId.slice(5) : tabId;
    const file = filesQuery.data?.find(f => String(f.id) === realId);
    if (file) {
      const dupId = `dup:${Date.now()}:${realId}`;
      setOpenTabs(prev => [...prev, dupId]);
      setFileContents(prev => ({ ...prev, [dupId]: file.content }));
      setActiveFileId(dupId);
    }
  }, [filesQuery.data]);

  const handleSplitRight = useCallback((tabId: string) => {
    const realId = tabId.startsWith('file:') ? tabId.slice(5) : tabId;
    setSplitEditorFileId(realId);
    toast({ title: 'Split editor opened' });
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
      status: project.isPublished ? 'live' as 'live' | 'idle' | 'publishing' | 'failed' : 'idle' as 'live' | 'idle' | 'publishing' | 'failed',
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
    updateProjectMutation,
    visibilityMutation,
    inviteGuestMutation,
    removeGuestMutation,
    frameworkPublishMutation,
    frameworkUnpublishMutation,
    deploySettingsMutation,
    forkMutation,
    uploadFileMutation,
    createArtifactMutation,
    applyVisualEditMutation,

    // Workspace management
    wsLoading,
    runnerOnline,
    handleStartWorkspace,
    handleStopWorkspace,
    initWorkspaceMutation,
    startWorkspaceMutation,
    stopWorkspaceMutation,

    // Visual editor
    visualEditorActive,
    setVisualEditorActive,
    selectedVEElement,
    setSelectedVEElement,
    visualEditorIframeId,
    handleVisualEditorToggle,

    // Dialog state
    projectSettingsOpen,
    setProjectSettingsOpen,
    publishDialogOpen,
    setPublishDialogOpen,
    inviteDialogOpen,
    setInviteDialogOpen,
    inviteLink,
    inviteLinkCopied,
    inviteLoading,
    handleGenerateInviteLink,
    handleCopyInviteLink,
    copyShareUrl,
    animationExportOpen,
    setAnimationExportOpen,
    conversionDialogOpen,
    setConversionDialogOpen,
    conversionFrameId,
    setConversionFrameId,
    conversionFrameName,
    setConversionFrameName,
    conversionTargetType,
    setConversionTargetType,
    addArtifactDialogOpen,
    setAddArtifactDialogOpen,
    newArtifactName,
    setNewArtifactName,
    newArtifactType,
    setNewArtifactType,

    // Framework state
    frameworkCheckbox,
    setFrameworkCheckbox,
    frameworkDesc,
    setFrameworkDesc,
    frameworkCategory,
    setFrameworkCategory,
    frameworkCoverUrl,
    setFrameworkCoverUrl,

    // Deploy dialog state
    deployIsPrivate,
    setDeployIsPrivate,
    deployShowBadge,
    setDeployShowBadge,
    deployEnableFeedback,
    setDeployEnableFeedback,
    deployInviteEmail,
    setDeployInviteEmail,

    // Project settings form
    projectNameInput,
    setProjectNameInput,
    projectLangInput,
    setProjectLangInput,

    // Guests
    guestsQuery,

    // Workspace mode
    workspaceMode,
    setWorkspaceMode,

    // Split editor
    splitEditorFileId,
    setSplitEditorFileId,

    // Git blame
    blameEnabled,
    setBlameEnabled,
    blameData: blameQuery.data,

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
