// @ts-nocheck
/**
 * UnifiedIDELayout - Responsive IDE that adapts to screen size
 *
 * Layout modes:
 * - Desktop (>1024px): 3 resizable panels (AI Agent 30% | Main Content 52% | File Explorer 18%)
 * - Tablet (768-1024px): 2 panels with collapsible sidebar
 * - Mobile (<768px): Bottom tab navigation with swipe between panels
 *
 * Uses useIDEWorkspace for centralized state management
 */

import { useState, useCallback, Suspense, useRef, useEffect, useMemo, startTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { createPanHandlers, type PanInfo } from '@/lib/native-motion';
import { useIDEWorkspace, availableTools } from '@/hooks';
import { useDeviceType } from '@/hooks/use-media-query';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { useProblemsCount } from '@/hooks/use-problems-count';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Zap,
  X,
  Layers,
  Rocket,
  PanelLeftOpen,
  PanelLeftClose,
  MoreHorizontal,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  Lock,
  ListTodo,
  FolderOpen,
} from 'lucide-react';
import { ECodeLoading } from '@/components/ECodeLoading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ProjectGuest } from '@shared/schema';

import { TopNavBar } from '@/components/ide/TopNavBar';
import { StatusBar } from '@/components/ide/StatusBar';
import { ReplitActivityBar, type ActivityItem } from '@/components/ide/ReplitActivityBar';
import { ReplitTabBar } from '@/components/ide/ReplitTabBar';
import { ReplitToolsSheet } from '@/components/ide/ReplitToolsSheet';
import { QuickFileSearch } from '@/components/ide/QuickFileSearch';
import { KeyboardShortcutsOverlay } from '@/components/ide/KeyboardShortcutsOverlay';
import { ReplitFileExplorer } from '@/components/editor/ReplitFileExplorer';
// Direct imports to avoid loading ALL mobile components via barrel file
import { ReplitMobileInputBar } from '@/components/mobile/ReplitMobileInputBar';
import { ReplitMobileHeader } from '@/components/mobile/ReplitMobileHeader';
import { type MobileTab } from '@/components/mobile/ReplitMobileNavigation';
import { ReplitBottomTabs } from '@/components/mobile/ReplitBottomTabs';

import { ReplitMonacoEditor } from '@/components/editor/ReplitMonacoEditor';
import { ReplitTerminalPanel } from '@/components/editor/ReplitTerminalPanel';
import { ReplitDeploymentPanel } from '@/components/ide/ReplitDeploymentPanel';
import { ReplitAgentPanelV3 } from '@/components/ai/ReplitAgentPanelV3';
import { AgentPanelErrorBoundary } from '@/components/ai/AgentPanelErrorBoundary';
import type { ExternalInputHandlers } from '@/components/ai/ReplitAgentPanelV3';
import { ResponsiveWebPreview } from '@/components/editor/ResponsiveWebPreview';
import { AgentActionsPanel } from '@/components/ide/AgentActionsPanel';
import { ToolsPanel } from '@/components/ide/ToolsPanel';
import { MobilePreviewPanel } from '@/components/mobile/MobilePreviewPanel';
import { MobileMoreMenu } from '@/components/mobile/MobileMoreMenu';
import { MobileSecurityPanel } from '@/components/mobile/MobileSecurityPanel';
import { MobileTabSwitcher } from '@/components/mobile/MobileTabSwitcher';
import CommandPalette from '@/components/CommandPalette';
import { GlobalSearch } from '@/components/GlobalSearch';
import { CollaborationPanel } from '@/components/CollaborationPanel';
import { DatabasePanel } from '@/components/ide/DatabasePanel';
import { ReplitAuthPanel } from '@/components/ide/ReplitAuthPanel';
import { ReplitGitPanel } from '@/components/editor/ReplitGitPanel';
import { ReplitPackagesPanel } from '@/components/editor/ReplitPackagesPanel';
import { ReplitDebuggerPanel } from '@/components/editor/ReplitDebuggerPanel';
import { ReplitTestingPanel } from '@/components/editor/ReplitTestingPanel';
import { ReplitSecretsPanel } from '@/components/editor/ReplitSecretsPanel';
import { ReplitHistoryPanel } from '@/components/editor/ReplitHistoryPanel';
import { UnifiedCheckpointsPanel } from '@/components/UnifiedCheckpointsPanel';
import { ReplitSettingsPanel } from '@/components/editor/ReplitSettingsPanel';
import { ReplitThemesPanel } from '@/components/editor/ReplitThemesPanel';
import { ReplitMultiplayers } from '@/components/editor/ReplitMultiplayers';
import { WorkflowsPanel } from '@/components/ide/WorkflowsPanel';
import { ExtensionsMarketplace } from '@/components/ExtensionsMarketplace';
import { VisualEditorPanel } from '@/components/ide/VisualEditorPanel';
import { ShellPanel } from '@/components/editor/ShellPanel';
import { AppStoragePanel } from '@/components/editor/AppStoragePanel';
import { ReplitConsolePanel } from '@/components/ide/ReplitConsolePanel';
import { ResourcesPanel } from '@/components/ide/ResourcesPanel';
import TaskBoard from '@/components/TaskBoard';
import { LogsViewerPanel } from '@/components/ide/LogsViewerPanel';
import SlideEditor from '@/components/SlideEditor';
import VideoEditor from '@/components/VideoEditor';
import AnimationPreview from '@/components/AnimationPreview';
import DesignCanvas from '@/components/DesignCanvas';
import ConversionDialog from '@/components/ConversionDialog';
import AutomationsPanel from '@/components/AutomationsPanel';
import BackupRecoverySection from '@/components/BackupRecoverySection';
import ConfigPanel from '@/components/ConfigPanel';
import FeedbackInboxPanel from '@/components/FeedbackInboxPanel';
import GitHubPanel from '@/components/GitHubPanel';
import IntegrationsPanel from '@/components/IntegrationsPanel';
import MCPPanel from '@/components/MCPPanel';
import MergeConflictPanel from '@/components/MergeConflictPanel';
import MonitoringPanel from '@/components/MonitoringPanel';
import NetworkingPanel from '@/components/NetworkingPanel';
import SkillsPanel from '@/components/SkillsPanel';
import SSHPanel from '@/components/SSHPanel';
import ThreadsPanel from '@/components/ThreadsPanel';
import TestRunnerPanel from '@/components/TestRunnerPanel';
import SecurityScannerPanel from '@/components/SecurityScannerPanel';

interface UnifiedIDELayoutProps {
  projectId: string;
  className?: string;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const mobileTabOrder: MobileTab[] = ['preview', 'agent', 'terminal', 'deploy', 'more'];
const PRIMARY_MOBILE_TABS: MobileTab[] = ['preview', 'agent', 'terminal', 'deploy'];

function UnifiedIDELayout({ projectId, className }: UnifiedIDELayoutProps) {
  const deviceType = useDeviceType();
  const { toast } = useToast();
  const connectionStatus = useConnectionStatus();
  const { errorsCount } = useProblemsCount(projectId);

  const workspace = useIDEWorkspace(projectId);

  const {
    project,
    projectName,
    files,
    filesRaw,
    isLoadingProject,
    user,
    activeTab,
    setActiveTab,
    tabs,
    selectedFileId,
    setSelectedFileId,
    showFileExplorer,
    setShowFileExplorer,
    isRunning,
    setIsRunning,
    executionId,
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
    gitBranch,
    gitChangesCount,
    cursorPosition,
    lastSaved,
    problemsCount,
    publishState,
    handleFileSelect,
    handleTabClose,
    handleTabReorder,
    handleTabPin,
    handleTabDuplicate,
    handleSplitRight,
    handleRunStop,
    handleAddTool,
    // Real integrations
    activeFileId,
    activeFileName,
    activeFileContent,
    activeFileLanguage,
    fileContents,
    setFileContents,
    dirtyFiles,
    clearDirtyFile,
    handleCodeChange,
    handleCursorChange,
    formatDocument,
    isFormatting,
    lintDiagnostics,
    wsConnected,
    wsStatus,
    livePreviewUrl,
    connectionQuality,
    remoteUsers,
    activeYtext,
    remoteAwareness,
    collabConnected,
    logs,
    currentConsoleRunId,
    pendingAIMessage,
    setPendingAIMessage,
    userPrefs,
    savePrefs,
    creditBalance,
    // New exports
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
    // Visual editor
    visualEditorActive,
    selectedVEElement,
    setSelectedVEElement,
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
    conversionFrameName,
    conversionTargetType,
    addArtifactDialogOpen,
    setAddArtifactDialogOpen,
    newArtifactName,
    setNewArtifactName,
    newArtifactType,
    setNewArtifactType,
    // Framework
    frameworkCheckbox,
    setFrameworkCheckbox,
    frameworkDesc,
    setFrameworkDesc,
    frameworkCategory,
    setFrameworkCategory,
    frameworkCoverUrl,
    setFrameworkCoverUrl,
    // Deploy dialog
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
    // Workspace mode
    workspaceMode,
    setWorkspaceMode,
    // Split editor
    splitEditorFileId,
    setSplitEditorFileId,
    // Git blame
    blameEnabled,
    setBlameEnabled,
    blameData,
    // Merge conflicts
    mergeConflicts,
    setMergeConflicts,
    mergeResolutions,
    setMergeResolutions,
  } = workspace;

  const queryClient = useQueryClient();
  const { setTheme: setGlobalTheme } = useTheme();

  const historyFiles = useMemo(() =>
    Array.isArray(filesRaw) ? filesRaw.map((f: any) => ({ id: String(f.id), filename: f.filename, content: f.content })) : [],
    [filesRaw]
  );

  const handleHistoryClose = useCallback(() => {
    setActiveActivityItem('files');
    if (activeFileId && !isNaN(Number(activeFileId))) {
      setActiveTab(`file:${activeFileId}`);
    } else {
      const firstFileTab = workspace.openTabs?.find((t: string) => !isNaN(Number(t)));
      if (firstFileTab) {
        setActiveTab(`file:${firstFileTab}`);
      }
    }
  }, [setActiveActivityItem, setActiveTab, activeFileId, workspace.openTabs]);

  const handleFileRestored = useCallback((fileId: string, filename: string, content: string) => {
    setFileContents((prev: Record<string, string>) => ({ ...prev, [fileId]: content }));
    clearDirtyFile(fileId);
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
  }, [setFileContents, clearDirtyFile, queryClient, projectId]);


  // Sync userPrefs theme with ThemeProvider on load and changes
  useEffect(() => {
    if (userPrefs?.theme === 'dark' || userPrefs?.theme === 'light') {
      setGlobalTheme(userPrefs.theme as 'dark' | 'light');
    }
  }, [userPrefs?.theme, setGlobalTheme]);

  // Auto-run on initial load (like Replit)
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    if (isRunning) { hasAutoRun.current = true; return; }
    const filesReady = files && files.length > 0;
    const projectLoaded = !!project;
    if (filesReady && projectLoaded) {
      hasAutoRun.current = true;
      handleRunStop();
    }
  }, [files, project, isRunning, handleRunStop]);

  const isConnected = wsConnected ?? (connectionStatus.isOnline && connectionStatus.backendHealthy);

  // Activity bar click handler
  const handleActivityItemClick = useCallback((item: ActivityItem) => {
    setActiveActivityItem(item);
    switch (item) {
      case 'files':
        setShowFileExplorer((prev: boolean) => !prev);
        break;
      case 'search':
        handleAddTool('search');
        break;
      case 'git':
        handleAddTool('git');
        break;
      case 'packages':
        handleAddTool('packages');
        break;
      case 'debug':
        handleAddTool('debugger');
        break;
      case 'terminal':
        handleAddTool('terminal');
        break;
      case 'agent':
        setIsSidebarCollapsed(false);
        setLeftPanelTab('agent');
        break;
      case 'deploy':
        handleAddTool('deployment');
        break;
      case 'secrets':
        handleAddTool('secrets');
        break;
      case 'database':
        handleAddTool('database');
        break;
      case 'preview':
        handleAddTool('preview');
        break;
      case 'workflows':
        handleAddTool('workflows');
        break;
      case 'history':
        handleAddTool('history');
        break;
      case 'extensions':
        handleAddTool('extensions');
        break;
      case 'tasks':
        setIsSidebarCollapsed(false);
        setLeftPanelTab('tasks');
        break;
      case 'settings':
        handleAddTool('settings');
        break;
      case 'monitoring':
        handleAddTool('monitoring');
        break;
      case 'integrations':
        handleAddTool('integrations');
        break;
      case 'checkpoints':
        handleAddTool('checkpoints');
        break;
      case 'mcp':
        handleAddTool('mcp');
        break;
      case 'ssh':
        handleAddTool('ssh');
        break;
      case 'security-scanner':
        handleAddTool('security-scanner');
        break;
      case 'collaboration':
        handleAddTool('collaboration');
        break;
    }
  }, [setActiveActivityItem, setShowFileExplorer, setIsSidebarCollapsed, setLeftPanelTab, handleAddTool]);

  // Mobile state
  const [mobileActiveTab, setMobileActiveTabRaw] = useState<MobileTab>('preview');
  const lastPrimaryTabRef = useRef<MobileTab>('preview');

  const setMobileActiveTab = useCallback((tab: MobileTab) => {
    if (PRIMARY_MOBILE_TABS.includes(tab)) {
      lastPrimaryTabRef.current = tab;
    }
    startTransition(() => {
      setMobileActiveTabRaw(tab);
    });
  }, []);

  const returnToLastPrimaryTab = useCallback(() => {
    setMobileActiveTab(lastPrimaryTabRef.current);
  }, [setMobileActiveTab]);

  const handleMobileBack = useCallback(() => {
    if (PRIMARY_MOBILE_TABS.includes(mobileActiveTab)) {
      window.location.href = '/dashboard';
    } else {
      returnToLastPrimaryTab();
    }
  }, [mobileActiveTab, returnToLastPrimaryTab]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [mobileAgentHandlers, setMobileAgentHandlersState] = useState<ExternalInputHandlers | null>(null);
  const mobileAgentHandlersRef = useRef<ExternalInputHandlers | null>(null);
  const setMobileAgentHandlers = useCallback((handlers: ExternalInputHandlers | null) => {
    mobileAgentHandlersRef.current = handlers;
    setMobileAgentHandlersState(handlers);
  }, []);
  const [mobileAIMode, setMobileAIMode] = useState<'chat' | 'agent' | 'plan'>('agent');
  const [mobileAgentMode, setMobileAgentMode] = useState<'economy' | 'power' | 'turbo'>(() => {
    try { return (localStorage.getItem('mobile-agent-mode') as any) || 'economy'; } catch { return 'economy'; }
  });
  const [mobileAgentToolsConfig, setMobileAgentToolsConfig] = useState({
    liteMode: false, webSearch: true, appTesting: false, codeOptimizations: false, architect: false, turbo: false,
  });
  const pendingMobileMessageRef = useRef<string | null>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const handleMobileAttach = useCallback(() => {
    mobileFileInputRef.current?.click();
  }, []);
  const handleMobileFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      mobileAgentHandlers?.addFiles?.(Array.from(files));
    }
    if (mobileFileInputRef.current) mobileFileInputRef.current.value = '';
  }, [mobileAgentHandlers]);

  useEffect(() => {
    if (mobileAgentHandlers?.agentMode) {
      const mode = mobileAgentHandlers.agentMode as 'economy' | 'power' | 'turbo';
      if (['economy', 'power', 'turbo'].includes(mode) && mode !== mobileAgentMode) {
        setMobileAgentMode(mode);
        try { localStorage.setItem('mobile-agent-mode', mode); } catch {}
      }
    }
  }, [mobileAgentHandlers?.agentMode]);

  useEffect(() => {
    if (mobileAgentHandlers?.aiMode && mobileAgentHandlers.aiMode !== mobileAIMode) {
      setMobileAIMode(mobileAgentHandlers.aiMode);
    }
  }, [mobileAgentHandlers?.aiMode]);

  useEffect(() => {
    if (mobileAgentHandlers?.agentToolsConfig) {
      setMobileAgentToolsConfig(mobileAgentHandlers.agentToolsConfig);
    }
  }, [mobileAgentHandlers?.agentToolsConfig]);

  useEffect(() => {
    if (mobileAgentHandlers?.handleSubmit && pendingMobileMessageRef.current) {
      const msg = pendingMobileMessageRef.current;
      pendingMobileMessageRef.current = null;
      try {
        mobileAgentHandlers.handleSubmit(msg);
      } catch (err) {
        console.error('[MobileSubmit] Failed to send queued message:', err);
        toast({ title: 'Failed to send message', description: 'Please try again.', variant: 'destructive' });
      }
    }
  }, [mobileAgentHandlers?.handleSubmit]);

  const bootstrapConsumedRef = useRef(false);
  const [bootstrapPendingMessage, setBootstrapPendingMessage] = useState<string | null>(null);
  useEffect(() => {
    if (bootstrapConsumedRef.current || !projectId) return;
    const promptKey = `agent-prompt-${projectId}`;
    const savedPrompt = sessionStorage.getItem(promptKey);
    if (savedPrompt) {
      bootstrapConsumedRef.current = true;
      sessionStorage.removeItem(promptKey);
      sessionStorage.removeItem(`agent-build-mode-${projectId}`);
      setBootstrapPendingMessage(savedPrompt);
      setMobileActiveTab('agent');
    }
  }, [projectId, setMobileActiveTab]);

  // Tab content animation
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const [tabContentVisible, setTabContentVisible] = useState(true);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }, []);

  useEffect(() => {
    if (displayedTab !== activeTab) {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (prefersReducedMotion) {
        setDisplayedTab(activeTab);
        setTabContentVisible(true);
        return;
      }
      setTabContentVisible(false);
      transitionTimerRef.current = setTimeout(() => {
        setDisplayedTab(activeTab);
        setTabContentVisible(true);
        transitionTimerRef.current = null;
      }, 100);
    }
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [activeTab, displayedTab, prefersReducedMotion]);

  // Open tabs for mobile navigation
  interface OpenTab {
    id: string;
    name: string;
    icon: string;
  }
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { id: 'preview', name: 'Preview', icon: 'preview' },
    { id: 'agent', name: 'Agent', icon: 'agent' },
    { id: 'deploy', name: 'Deploy', icon: 'deploy' },
  ]);
  const [activeOpenTabId, setActiveOpenTabId] = useState('preview');

  const toolNameMap: Record<string, string> = {
    agent: 'Agent', preview: 'Preview', deploy: 'Deploy', console: 'Console',
    database: 'Database', git: 'Git', secrets: 'Secrets', auth: 'Auth',
    settings: 'Settings', history: 'History', workflows: 'Workflows',
    extensions: 'Extensions', packages: 'Packages', terminal: 'Shell',
    debug: 'Debug', checkpoints: 'Checkpoints', security: 'Security',
    collaboration: 'Collaboration', search: 'Search',
    automations: 'Automations', config: 'Config', feedback: 'Feedback',
    github: 'GitHub', integrations: 'Integrations', mcp: 'MCP',
    'merge-conflicts': 'Merge Conflicts', monitoring: 'Monitoring',
    networking: 'Networking', skills: 'Skills',
    ssh: 'SSH', threads: 'Threads', 'test-runner': 'Test Runner',
    'security-scanner': 'Scanner', backup: 'Backup',
  };

  const handleAddOpenTab = useCallback((toolId: string) => {
    const existingTab = openTabs.find(t => t.id === toolId);
    if (existingTab) {
      setActiveOpenTabId(toolId);
    } else {
      const newTab: OpenTab = { id: toolId, name: toolNameMap[toolId] || toolId, icon: toolId };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveOpenTabId(toolId);
    }
    setMobileActiveTab(toolId as MobileTab);
  }, [openTabs]);

  const handleCloseOpenTab = useCallback((tabId: string) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeOpenTabId === tabId && newTabs.length > 0) {
        const nextTab = newTabs[newTabs.length - 1].id;
        setActiveOpenTabId(nextTab);
        setMobileActiveTab(nextTab as MobileTab);
      }
      return newTabs;
    });
  }, [activeOpenTabId, setMobileActiveTab]);

  const handleSelectOpenTab = useCallback((tabId: string) => {
    setActiveOpenTabId(tabId);
    setMobileActiveTab(tabId as MobileTab);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        handleAddOpenTab('search');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setShowQuickFileSearch(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setShowQuickFileSearch, handleAddOpenTab]);

  // Mobile swipe handlers
  const mobileSwipeHandlers = useMemo(() => createPanHandlers({
    axis: 'x',
    threshold: SWIPE_THRESHOLD,
    onEnd: (info: PanInfo) => {
      const isSwipeLeft = info.offset.x < -SWIPE_THRESHOLD && Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD * 1000;
      const isSwipeRight = info.offset.x > SWIPE_THRESHOLD && Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD * 1000;
      if (isSwipeLeft || isSwipeRight) {
        const currentIndex = mobileTabOrder.indexOf(mobileActiveTab);
        let newIndex = currentIndex;
        if (isSwipeLeft && currentIndex < mobileTabOrder.length - 1) newIndex = currentIndex + 1;
        else if (isSwipeRight && currentIndex > 0) newIndex = currentIndex - 1;
        if (newIndex !== currentIndex) {
          setMobileActiveTab(mobileTabOrder[newIndex]);
          if ('vibrate' in navigator) navigator.vibrate(10);
        }
      }
    }
  }), [mobileActiveTab]);

  const deploymentStatus = publishState?.status === 'live' ? 'live'
    : publishState?.status === 'publishing' ? 'deploying'
    : publishState?.status === 'failed' ? 'failed'
    : 'idle';

  // Loading state
  if (isLoadingProject && deviceType === 'desktop') {
    return <ECodeLoading fullScreen size="lg" text="Loading workspace..." />;
  }

  if (!project && !isLoadingProject) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--ide-bg)]">
        <div className="text-center space-y-4">
          <p className="text-[var(--ide-text-muted)]">Project not found or access denied.</p>
          <Button onClick={() => window.location.href = '/dashboard'}>Go back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const mobileHandleFileSelect = useCallback((file: { id: string | number; name?: string; filename?: string }) => {
    handleFileSelect(file);
    if (deviceType !== 'desktop') {
      setMobileActiveTab('code' as MobileTab);
    }
  }, [handleFileSelect, deviceType, setMobileActiveTab]);

  // Mobile content renderer
  const renderMobileContent = () => {
    if (isLoadingProject) {
      return <div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading workspace..." /></div>;
    }
    switch (mobileActiveTab) {
      case 'preview':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Preview..." /></div>}><MobilePreviewPanel projectId={projectId} /></Suspense>;
      case 'agent':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Agent..." /></div>}><AgentPanelErrorBoundary><ReplitAgentPanelV3 projectId={projectId} mode="mobile" agentToolsSettings={agentToolsSettings} onAgentToolsSettingsChange={setAgentToolsSettings} hideInput={true} onExternalInput={setMobileAgentHandlers} pendingMessage={bootstrapPendingMessage} onPendingMessageConsumed={() => setBootstrapPendingMessage(null)} /></AgentPanelErrorBoundary></Suspense>;
      case 'deploy':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Deploy..." /></div>}><ReplitDeploymentPanel projectId={projectId} /></Suspense>;
      case 'git':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitGitPanel projectId={projectId} /></Suspense>;
      case 'packages':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitPackagesPanel projectId={projectId} /></Suspense>;
      case 'secrets':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitSecretsPanel projectId={projectId} /></Suspense>;
      case 'database':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><DatabasePanel projectId={projectId} /></Suspense>;
      case 'terminal':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ShellPanel projectId={projectId} /></Suspense>;
      case 'code':
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Editor..." /></div>}>
            <div className="flex flex-col h-full">
              {activeFileId ? (
                <>
                  <div className="flex items-center h-9 px-3 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] shrink-0">
                    <button onClick={() => setMobileActiveTab('files' as MobileTab)} className="mr-2 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" data-testid="btn-back-to-files">
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-medium text-[var(--ide-text)] truncate" data-testid="text-active-filename">{activeFileName || 'Untitled'}</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ReplitMonacoEditor projectId={projectId} fileId={activeFileId} fileContents={fileContents} onCodeChange={handleCodeChange} onCursorChange={handleCursorChange} fontSize={userPrefs?.fontSize} tabSize={userPrefs?.tabSize} wordWrap={userPrefs?.wordWrap} minimap={false} filename={activeFileName || undefined} ytext={activeYtext} remoteAwareness={collabConnected ? remoteAwareness : undefined} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)]" data-testid="text-no-file-selected">
                  <p className="text-sm">Select a file to edit</p>
                </div>
              )}
            </div>
          </Suspense>
        );
      case 'files':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Files..." /></div>}><ReplitFileExplorer projectId={projectId} files={Array.isArray(filesRaw) ? filesRaw : []} onFileSelect={(file: { id: string; name: string }) => mobileHandleFileSelect({ id: parseInt(file.id, 10), name: file.name })} selectedFileId={selectedFileId !== null ? String(selectedFileId) : null} /></Suspense>;
      case 'history':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitHistoryPanel projectId={projectId} files={historyFiles} onClose={handleHistoryClose} onFileRestored={handleFileRestored} initialFile={activeFileName || null} /></Suspense>;
      case 'settings':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitSettingsPanel projectId={projectId} userPrefs={userPrefs} savePrefs={savePrefs} /></Suspense>;
      case 'extensions':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ExtensionsMarketplace projectId={projectId} className="h-full" /></Suspense>;
      case 'workflows':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><WorkflowsPanel projectId={projectId} /></Suspense>;
      case 'debug':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitDebuggerPanel projectId={projectId} /></Suspense>;
      case 'security':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MobileSecurityPanel projectId={projectId} /></Suspense>;
      case 'search':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><GlobalSearch isOpen={true} inline={true} onClose={returnToLastPrimaryTab} projectId={projectId} onFileSelect={(file: any) => mobileHandleFileSelect({ id: file.id, name: file.name })} /></Suspense>;
      case 'tasks':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Tasks..." /></div>}><TaskBoard projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'checkpoints':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><UnifiedCheckpointsPanel projectId={projectId} maxHeight="calc(100vh - 120px)" /></Suspense>;
      case 'slides':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Slides..." /></div>}><SlideEditor projectId={projectId} /></Suspense>;
      case 'video':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Video..." /></div>}><VideoEditor projectId={projectId} /></Suspense>;
      case 'animation':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Animation..." /></div>}><AnimationPreview projectId={projectId} previewUrl={livePreviewUrl} /></Suspense>;
      case 'design':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Design..." /></div>}><DesignCanvas projectId={projectId} /></Suspense>;
      case 'themes':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitThemesPanel projectId={projectId} /></Suspense>;
      case 'testing':
      case 'tests':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitTestingPanel projectId={projectId} /></Suspense>;
      case 'storage':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><AppStoragePanel projectId={projectId} /></Suspense>;
      case 'auth':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitAuthPanel projectId={projectId} /></Suspense>;
      case 'visual-editor':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><VisualEditorPanel projectId={projectId} /></Suspense>;
      case 'console':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitConsolePanel projectId={projectId} isRunning={isRunning} logs={logs} onStop={handleRunStop} onAskAI={(text) => { setPendingAIMessage(text); }} activeFileName={activeFileName || undefined} currentConsoleRunId={currentConsoleRunId} /></Suspense>;
      case 'resources':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ResourcesPanel projectId={projectId} /></Suspense>;
      case 'logs':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><LogsViewerPanel projectId={projectId} /></Suspense>;
      case 'collaboration':
        return user ? <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><CollaborationPanel projectId={parseInt(projectId, 10)} currentUser={user} /></Suspense> : null;
      case 'automations':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><AutomationsPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'backup':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><BackupRecoverySection projectId={projectId} /></Suspense>;
      case 'config':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ConfigPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'feedback':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><FeedbackInboxPanel projectId={projectId} onClose={returnToLastPrimaryTab} onSendToAI={(text) => { setPendingAIMessage(text); setMobileActiveTab('agent'); }} /></Suspense>;
      case 'github':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><GitHubPanel projectId={projectId} projectName={projectName} /></Suspense>;
      case 'integrations':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><IntegrationsPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'mcp':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MCPPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'merge-conflicts':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MergeConflictPanel projectId={projectId} conflicts={mergeConflicts} resolutions={mergeResolutions} onClose={returnToLastPrimaryTab} onMergeComplete={() => { setMergeConflicts([]); setMergeResolutions([]); returnToLastPrimaryTab(); }} onAbort={() => { setMergeConflicts([]); setMergeResolutions([]); returnToLastPrimaryTab(); }} onResolutionChange={(updated) => setMergeResolutions(updated)} /></Suspense>;
      case 'monitoring':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MonitoringPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'networking':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><NetworkingPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'skills':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><SkillsPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'ssh':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><SSHPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'threads':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ThreadsPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'test-runner':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><TestRunnerPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'security-scanner':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><SecurityScannerPanel projectId={projectId} onClose={returnToLastPrimaryTab} /></Suspense>;
      case 'more':
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading..." /></div>}>
          <MobileMoreMenu
            projectId={projectId}
            isOpen={false}
            inline={true}
            onClose={returnToLastPrimaryTab}
            onOpenGit={() => handleAddOpenTab('git')}
            onOpenPackages={() => handleAddOpenTab('packages')}
            onOpenSecrets={() => handleAddOpenTab('secrets')}
            onOpenDatabase={() => handleAddOpenTab('database')}
            onOpenSettings={() => handleAddOpenTab('settings')}
            onOpenDebug={() => handleAddOpenTab('debug')}
            onOpenCollaboration={() => handleAddOpenTab('collaboration')}
            onOpenWorkflows={() => handleAddOpenTab('workflows')}
            onOpenHistory={() => handleAddOpenTab('history')}
            onOpenCheckpoints={() => handleAddOpenTab('checkpoints')}
            onOpenExtensions={() => handleAddOpenTab('extensions')}
            onOpenSecurity={() => handleAddOpenTab('security')}
            onOpenCommandPalette={() => setShowCommandPalette(true)}
            onOpenGlobalSearch={() => handleAddOpenTab('search')}
            onOpenQuickFileSearch={() => setShowQuickFileSearch(true)}
            onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
            onOpenAutomations={() => handleAddOpenTab('automations')}
            onOpenConfig={() => handleAddOpenTab('config')}
            onOpenFeedback={() => handleAddOpenTab('feedback')}
            onOpenGitHub={() => handleAddOpenTab('github')}
            onOpenIntegrations={() => handleAddOpenTab('integrations')}
            onOpenMCP={() => handleAddOpenTab('mcp')}
            onOpenMergeConflicts={() => handleAddOpenTab('merge-conflicts')}
            onOpenMonitoring={() => handleAddOpenTab('monitoring')}
            onOpenNetworking={() => handleAddOpenTab('networking')}
            onOpenSkills={() => handleAddOpenTab('skills')}
            onOpenSSH={() => handleAddOpenTab('ssh')}
            onOpenThreads={() => handleAddOpenTab('threads')}
            onOpenTestRunner={() => handleAddOpenTab('test-runner')}
            onOpenSecurityScanner={() => handleAddOpenTab('security-scanner')}
            onOpenBackup={() => handleAddOpenTab('backup')}
          />
          </Suspense>
        );
      default:
        return null;
    }
  };

  // Desktop content renderer
  const renderDesktopContent = () => {
    const currentTab = tabs.find(t => t.id === displayedTab);
    if (!currentTab) {
      return <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)] text-xs">Select a tab</div>;
    }

    if (currentTab.id === 'preview' || currentTab.id === 'webpreview') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ResponsiveWebPreview projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'console') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitConsolePanel projectId={projectId} isRunning={isRunning} logs={logs} onStop={handleRunStop} onAskAI={(text) => { setPendingAIMessage(text); setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }} activeFileName={activeFileName || undefined} currentConsoleRunId={currentConsoleRunId} /></Suspense>;
    }
    if (currentTab.id === 'shell') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ShellPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id.startsWith('file:')) {
      return (
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize={70} minSize={30}>
            <div className="flex flex-col h-full">
              <div className="flex items-center h-7 px-2 bg-[var(--ide-surface)] border-b border-[var(--ide-border)] shrink-0 justify-between">
                <span className="text-[11px] text-[var(--ide-text-muted)] truncate" data-testid="text-editor-filepath">{activeFileName || ''}</span>
                <div className="flex items-center gap-1">
                  {formatDocument && (
                    <button
                      onClick={formatDocument}
                      disabled={isFormatting}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded hover:bg-[var(--ide-surface-hover)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors disabled:opacity-50"
                      title="Format Document (Prettier)"
                      data-testid="button-format-document"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
                      {isFormatting ? 'Formatting...' : 'Format'}
                    </button>
                  )}
                </div>
              </div>
              {lintDiagnostics && lintDiagnostics.length > 0 && (
                <div className="max-h-24 overflow-y-auto bg-[var(--ide-surface)] border-b border-[var(--ide-border)] px-3 py-1" data-testid="lint-diagnostics-panel">
                  {lintDiagnostics.map((d: any, i: number) => (
                    <div key={i} className={`flex items-start gap-2 text-[11px] py-0.5 ${d.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                      <span className="shrink-0">{d.severity === 'error' ? '●' : '▲'}</span>
                      <span className="text-[var(--ide-text-muted)] shrink-0">Ln {d.line}, Col {d.column}</span>
                      <span className="truncate">{d.message}</span>
                      {d.ruleId && <span className="text-[var(--ide-text-muted)] shrink-0">({d.ruleId})</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex-1 min-h-0">
                <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}>
                  <ReplitMonacoEditor projectId={projectId} fileId={activeFileId} fileContents={fileContents} onCodeChange={handleCodeChange} onCursorChange={handleCursorChange} fontSize={userPrefs?.fontSize} tabSize={userPrefs?.tabSize} wordWrap={userPrefs?.wordWrap} minimap={userPrefs?.minimap} filename={activeFileName || undefined} ytext={activeYtext} remoteAwareness={collabConnected ? remoteAwareness : undefined} />
                </Suspense>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={10} collapsible collapsedSize={4}>
            <div className="h-full flex flex-col border-t border-[var(--ide-border)]">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-xs text-[var(--ide-text-muted)]">Loading...</div>}>
                <ReplitConsolePanel projectId={projectId} isRunning={isRunning} logs={logs} onStop={handleRunStop} onAskAI={(text) => { setPendingAIMessage(text); setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }} activeFileName={activeFileName || undefined} currentConsoleRunId={currentConsoleRunId} />
              </Suspense>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    }
    if (currentTab.id === 'git') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitGitPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'packages') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitPackagesPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'secrets' || currentTab.id === 'env' || currentTab.id === 'env-vars') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitSecretsPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'database' || currentTab.id === 'database-browser') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><DatabasePanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'auth') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitAuthPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'debugger' || currentTab.id === 'debug') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitDebuggerPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'settings') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitSettingsPanel projectId={projectId} userPrefs={userPrefs} savePrefs={savePrefs} /></Suspense>;
    }
    if (currentTab.id === 'history' || currentTab.id === 'rewind') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitHistoryPanel projectId={projectId} files={historyFiles} onClose={handleHistoryClose} onFileRestored={handleFileRestored} initialFile={activeFileName || null} /></Suspense>;
    }
    if (currentTab.id === 'checkpoints') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><UnifiedCheckpointsPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'workflows') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><WorkflowsPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'extensions') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ExtensionsMarketplace projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'security') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MobileSecurityPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'collaboration' || currentTab.id === 'multiplayer') {
      return user ? (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}>
          <CollaborationPanel projectId={parseInt(projectId, 10)} currentUser={user} />
        </Suspense>
      ) : <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)] text-xs">Please log in to access collaboration</div>;
    }
    if (currentTab.id === 'search' || currentTab.id === 'global-search') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><GlobalSearch isOpen={true} inline={true} onClose={() => {}} projectId={projectId} onFileSelect={(file: any) => handleFileSelect({ id: file.id, name: file.name })} /></Suspense>;
    }
    if (currentTab.id === 'deployment' || currentTab.id === 'deploy') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitDeploymentPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'terminal') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ShellPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'resources') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ResourcesPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'logs') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><LogsViewerPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'visual-editor') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><VisualEditorPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'slides') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Slides..." /></div>}><SlideEditor projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'video') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Video..." /></div>}><VideoEditor projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'animation') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Animation..." /></div>}><AnimationPreview projectId={projectId} previewUrl={livePreviewUrl} exportDialogOpen={animationExportOpen} onExportDialogClose={() => setAnimationExportOpen(false)} /></Suspense>;
    }
    if (currentTab.id === 'design') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Design..." /></div>}><DesignCanvas projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'storage') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><AppStoragePanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'themes') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitThemesPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'testing' || currentTab.id === 'tests') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitTestingPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'automations') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><AutomationsPanel projectId={projectId} onClose={() => handleTabClose('automations')} /></Suspense>;
    }
    if (currentTab.id === 'backup') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><BackupRecoverySection projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'config') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ConfigPanel projectId={projectId} onClose={() => handleTabClose('config')} /></Suspense>;
    }
    if (currentTab.id === 'feedback') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><FeedbackInboxPanel projectId={projectId} onClose={() => handleTabClose('feedback')} onSendToAI={(text) => { setPendingAIMessage(text); setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }} /></Suspense>;
    }
    if (currentTab.id === 'github') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><GitHubPanel projectId={projectId} projectName={projectName} /></Suspense>;
    }
    if (currentTab.id === 'integrations') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><IntegrationsPanel projectId={projectId} onClose={() => handleTabClose('integrations')} /></Suspense>;
    }
    if (currentTab.id === 'mcp') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MCPPanel projectId={projectId} onClose={() => handleTabClose('mcp')} /></Suspense>;
    }
    if (currentTab.id === 'merge-conflicts') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MergeConflictPanel projectId={projectId} conflicts={mergeConflicts} resolutions={mergeResolutions} onClose={() => handleTabClose('merge-conflicts')} onMergeComplete={() => { setMergeConflicts([]); setMergeResolutions([]); handleTabClose('merge-conflicts'); }} onAbort={() => { setMergeConflicts([]); setMergeResolutions([]); handleTabClose('merge-conflicts'); }} onResolutionChange={(updated) => setMergeResolutions(updated)} /></Suspense>;
    }
    if (currentTab.id === 'monitoring') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MonitoringPanel projectId={projectId} onClose={() => handleTabClose('monitoring')} /></Suspense>;
    }
    if (currentTab.id === 'networking') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><NetworkingPanel projectId={projectId} onClose={() => handleTabClose('networking')} /></Suspense>;
    }
    if (currentTab.id === 'skills') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><SkillsPanel projectId={projectId} onClose={() => handleTabClose('skills')} /></Suspense>;
    }
    if (currentTab.id === 'ssh') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><SSHPanel projectId={projectId} onClose={() => handleTabClose('ssh')} /></Suspense>;
    }
    if (currentTab.id === 'threads') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ThreadsPanel projectId={projectId} onClose={() => handleTabClose('threads')} /></Suspense>;
    }
    if (currentTab.id === 'test-runner') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><TestRunnerPanel projectId={projectId} onClose={() => handleTabClose('test-runner')} /></Suspense>;
    }
    if (currentTab.id === 'security-scanner') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><SecurityScannerPanel projectId={projectId} onClose={() => handleTabClose('security-scanner')} /></Suspense>;
    }

    return <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)] text-xs">Select a file or tool</div>;
  };

  // === MOBILE LAYOUT ===
  if (deviceType === 'mobile') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[var(--ide-bg)]"><ECodeLoading size="lg" text="Loading IDE..." /></div>}>
      <div className={cn('flex flex-col w-screen overflow-hidden bg-[var(--ide-bg)] touch-manipulation', className)} style={{ height: '100dvh', paddingBottom: 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px))' }} data-testid="mobile-layout" data-ide-layout="unified">
        <ReplitMobileHeader
          activeTab={mobileActiveTab}
          onBack={handleMobileBack}
          onHistory={() => handleAddOpenTab('history')}
          onNewTab={() => setShowQuickFileSearch(true)}
          onMore={() => setShowMobileMoreMenu(true)}
          isRunning={isRunning}
          onRunStop={handleRunStop}
          projectName={projectName}
        />

        <div
          className="flex-1 overflow-hidden min-h-0 flex flex-col"
          {...((mobileActiveTab === 'preview' || mobileActiveTab === 'agent') ? mobileSwipeHandlers : {})}
        >
          <div key={mobileActiveTab} className="flex-1 min-h-0 overflow-auto animate-fade-in">
            {renderMobileContent()}
          </div>
        </div>

        {mobileActiveTab === 'agent' && (
          <div className="shrink-0">
            <ReplitMobileInputBar
              placeholder="What would you like to build?"
              onSubmit={(value) => {
                const h = mobileAgentHandlersRef.current || mobileAgentHandlers;
                if (!h?.handleSubmit) {
                  pendingMobileMessageRef.current = value;
                  toast({ title: 'Connecting...', description: 'Your message will be sent momentarily.' });
                  return;
                }
                try {
                  h.handleSubmit(value);
                } catch (err) {
                  console.error('[MobileSubmit] Failed to send message:', err);
                  toast({ title: 'Failed to send message', description: 'Please try again.', variant: 'destructive' });
                }
              }}
              isWorking={mobileAgentHandlers?.isWorking}
              aiMode={mobileAgentHandlers?.aiMode ?? mobileAIMode}
              onAIModeChange={(mode) => {
                setMobileAIMode(mode);
                const h = mobileAgentHandlersRef.current || mobileAgentHandlers;
                h?.onAIModeChange?.(mode);
              }}
              agentMode={mobileAgentMode}
              onAgentModeChange={(m) => { setMobileAgentMode(m); try { localStorage.setItem('mobile-agent-mode', m); } catch {} const h = mobileAgentHandlersRef.current || mobileAgentHandlers; h?.onModeChange?.(m); }}
              agentToolsConfig={mobileAgentHandlers?.agentToolsConfig ?? mobileAgentToolsConfig}
              onAgentToolsConfigChange={(config) => {
                setMobileAgentToolsConfig(config);
                const h = mobileAgentHandlersRef.current || mobileAgentHandlers;
                const prev = h?.agentToolsConfig ?? mobileAgentToolsConfig;
                const diff: Record<string, boolean> = {};
                for (const key of Object.keys(config) as (keyof typeof config)[]) {
                  if (config[key] !== prev[key]) {
                    diff[key] = config[key];
                  }
                }
                if (Object.keys(diff).length > 0) {
                  h?.onAgentToolsConfigChange?.(diff);
                }
              }}
              onAttach={handleMobileAttach}
              onVoice={mobileAgentHandlers?.onVoice}
              isRecording={mobileAgentHandlers?.isRecording}
              isTranscribing={mobileAgentHandlers?.isTranscribing}
              pendingAttachmentsCount={mobileAgentHandlers?.pendingAttachmentsCount ?? 0}
              attachments={mobileAgentHandlers?.attachments}
              onRemoveAttachment={mobileAgentHandlers?.removeAttachment}
            />
          </div>
        )}
        <input ref={mobileFileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv" className="hidden" onChange={handleMobileFileSelected} />

        <ReplitBottomTabs
          activeTab={mobileActiveTab}
          onTabChange={(tab: string) => {
            if (tab === 'more') {
              setShowMobileMoreMenu(true);
            } else {
              handleSelectOpenTab(tab);
            }
          }}
          openTabs={openTabs}
          onCloseTab={handleCloseOpenTab}
          badgeCounts={{
            git: gitChangesCount > 0 ? gitChangesCount : undefined,
            errors: errorsCount > 0 ? errorsCount : undefined,
          }}
          isConnected={isConnected}
        />

        <MobileMoreMenu
          projectId={projectId}
          isOpen={showMobileMoreMenu}
          onClose={() => setShowMobileMoreMenu(false)}
          onOpenGit={() => { setShowMobileMoreMenu(false); handleAddOpenTab('git'); }}
          onOpenPackages={() => { setShowMobileMoreMenu(false); handleAddOpenTab('packages'); }}
          onOpenSecrets={() => { setShowMobileMoreMenu(false); handleAddOpenTab('secrets'); }}
          onOpenDatabase={() => { setShowMobileMoreMenu(false); handleAddOpenTab('database'); }}
          onOpenSettings={() => { setShowMobileMoreMenu(false); handleAddOpenTab('settings'); }}
          onOpenDebug={() => { setShowMobileMoreMenu(false); handleAddOpenTab('debug'); }}
          onOpenCollaboration={() => { setShowMobileMoreMenu(false); handleAddOpenTab('collaboration'); }}
          onOpenWorkflows={() => { setShowMobileMoreMenu(false); handleAddOpenTab('workflows'); }}
          onOpenHistory={() => { setShowMobileMoreMenu(false); handleAddOpenTab('history'); }}
          onOpenCheckpoints={() => { setShowMobileMoreMenu(false); handleAddOpenTab('checkpoints'); }}
          onOpenExtensions={() => { setShowMobileMoreMenu(false); handleAddOpenTab('extensions'); }}
          onOpenSecurity={() => { setShowMobileMoreMenu(false); handleAddOpenTab('security'); }}
          onOpenCommandPalette={() => { setShowMobileMoreMenu(false); setShowCommandPalette(true); }}
          onOpenGlobalSearch={() => { setShowMobileMoreMenu(false); handleAddOpenTab('search'); }}
          onOpenQuickFileSearch={() => { setShowMobileMoreMenu(false); setShowQuickFileSearch(true); }}
          onOpenKeyboardShortcuts={() => { setShowMobileMoreMenu(false); setShowKeyboardShortcuts(true); }}
          onOpenAutomations={() => { setShowMobileMoreMenu(false); handleAddOpenTab('automations'); }}
          onOpenConfig={() => { setShowMobileMoreMenu(false); handleAddOpenTab('config'); }}
          onOpenFeedback={() => { setShowMobileMoreMenu(false); handleAddOpenTab('feedback'); }}
          onOpenGitHub={() => { setShowMobileMoreMenu(false); handleAddOpenTab('github'); }}
          onOpenIntegrations={() => { setShowMobileMoreMenu(false); handleAddOpenTab('integrations'); }}
          onOpenMCP={() => { setShowMobileMoreMenu(false); handleAddOpenTab('mcp'); }}
          onOpenMergeConflicts={() => { setShowMobileMoreMenu(false); handleAddOpenTab('merge-conflicts'); }}
          onOpenMonitoring={() => { setShowMobileMoreMenu(false); handleAddOpenTab('monitoring'); }}
          onOpenNetworking={() => { setShowMobileMoreMenu(false); handleAddOpenTab('networking'); }}
          onOpenSkills={() => { setShowMobileMoreMenu(false); handleAddOpenTab('skills'); }}
          onOpenSSH={() => { setShowMobileMoreMenu(false); handleAddOpenTab('ssh'); }}
          onOpenThreads={() => { setShowMobileMoreMenu(false); handleAddOpenTab('threads'); }}
          onOpenTestRunner={() => { setShowMobileMoreMenu(false); handleAddOpenTab('test-runner'); }}
          onOpenSecurityScanner={() => { setShowMobileMoreMenu(false); handleAddOpenTab('security-scanner'); }}
          onOpenBackup={() => { setShowMobileMoreMenu(false); handleAddOpenTab('backup'); }}
          problemsCount={errorsCount}
        />

        <ReplitToolsSheet
          open={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          onSelectTool={(tool) => { handleAddTool(tool); handleAddOpenTab(tool); setShowToolsSheet(false); }}
        />

        <MobileTabSwitcher
          isOpen={showTabSwitcher}
          onClose={() => setShowTabSwitcher(false)}
          openTabs={openTabs}
          activeTabId={activeOpenTabId}
          onTabSelect={handleSelectOpenTab}
          onTabClose={handleCloseOpenTab}
          onNewTab={() => { setShowTabSwitcher(false); setShowToolsSheet(true); }}
        />
      </div>
      </Suspense>
    );
  }

  // === TABLET LAYOUT ===
  if (deviceType === 'tablet') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[var(--ide-bg)]"><ECodeLoading size="lg" text="Loading IDE..." /></div>}>
      <div className={cn('flex flex-col w-screen overflow-hidden bg-[var(--ide-bg)] touch-manipulation', className)} style={{ height: '100dvh', paddingBottom: 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px))' }} data-testid="tablet-layout" data-ide-layout="unified">
        <header className="flex items-center justify-between h-12 px-3 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] z-50 relative">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setShowFileExplorer(!showFileExplorer)} className="h-9 w-9 shrink-0">
              {showFileExplorer ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
            <span className="font-medium text-[var(--ide-text)] text-[13px] truncate">{projectName}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              className={cn(
                'h-8 px-4 text-[11px] font-semibold rounded-full gap-1.5 transition-all',
                isRunning
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                  : 'bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] shadow-[0_0_8px_rgba(12,206,107,0.3)]'
              )}
              onClick={handleRunStop}
            >
              {isRunning ? (
                <><Layers className="w-3 h-3" /> Stop</>
              ) : (
                <><Zap className="w-3 h-3" /> Run</>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowToolsSheet(true)} className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            {renderMobileContent()}
          </div>
        </div>

        {mobileActiveTab === 'agent' && (
          <div className="shrink-0">
            <ReplitMobileInputBar
              placeholder="What would you like to build?"
              onSubmit={(value) => {
                const h = mobileAgentHandlersRef.current || mobileAgentHandlers;
                if (!h?.handleSubmit) {
                  pendingMobileMessageRef.current = value;
                  toast({ title: 'Connecting...', description: 'Your message will be sent momentarily.' });
                  return;
                }
                try {
                  h.handleSubmit(value);
                } catch (err) {
                  console.error('[MobileSubmit] Failed to send message:', err);
                  toast({ title: 'Failed to send message', description: 'Please try again.', variant: 'destructive' });
                }
              }}
              isWorking={mobileAgentHandlers?.isWorking}
              aiMode={mobileAgentHandlers?.aiMode ?? mobileAIMode}
              onAIModeChange={(mode) => {
                setMobileAIMode(mode);
                const h = mobileAgentHandlersRef.current || mobileAgentHandlers;
                h?.onAIModeChange?.(mode);
              }}
              agentMode={mobileAgentMode}
              onAgentModeChange={(m) => { setMobileAgentMode(m); try { localStorage.setItem('mobile-agent-mode', m); } catch {} const h = mobileAgentHandlersRef.current || mobileAgentHandlers; h?.onModeChange?.(m); }}
              agentToolsConfig={mobileAgentHandlers?.agentToolsConfig ?? mobileAgentToolsConfig}
              onAgentToolsConfigChange={(config) => {
                setMobileAgentToolsConfig(config);
                const h = mobileAgentHandlersRef.current || mobileAgentHandlers;
                const prev = h?.agentToolsConfig ?? mobileAgentToolsConfig;
                const diff: Record<string, boolean> = {};
                for (const key of Object.keys(config) as (keyof typeof config)[]) {
                  if (config[key] !== prev[key]) {
                    diff[key] = config[key];
                  }
                }
                if (Object.keys(diff).length > 0) {
                  h?.onAgentToolsConfigChange?.(diff);
                }
              }}
              onAttach={handleMobileAttach}
              onVoice={mobileAgentHandlers?.onVoice}
              isRecording={mobileAgentHandlers?.isRecording}
              isTranscribing={mobileAgentHandlers?.isTranscribing}
              pendingAttachmentsCount={mobileAgentHandlers?.pendingAttachmentsCount ?? 0}
              attachments={mobileAgentHandlers?.attachments}
              onRemoveAttachment={mobileAgentHandlers?.removeAttachment}
            />
          </div>
        )}
        <input ref={mobileFileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv" className="hidden" onChange={handleMobileFileSelected} />

        <ReplitBottomTabs
          activeTab={mobileActiveTab}
          onTabChange={(tab: string) => {
            if (tab === 'more') {
              setShowMobileMoreMenu(true);
            } else {
              handleSelectOpenTab(tab);
            }
          }}
          openTabs={openTabs}
          onCloseTab={handleCloseOpenTab}
          badgeCounts={{
            git: gitChangesCount > 0 ? gitChangesCount : undefined,
            errors: errorsCount > 0 ? errorsCount : undefined,
          }}
          isConnected={isConnected}
        />

        <MobileMoreMenu
          projectId={projectId}
          isOpen={showMobileMoreMenu}
          onClose={() => setShowMobileMoreMenu(false)}
          onOpenGit={() => { setShowMobileMoreMenu(false); handleAddOpenTab('git'); }}
          onOpenPackages={() => { setShowMobileMoreMenu(false); handleAddOpenTab('packages'); }}
          onOpenSecrets={() => { setShowMobileMoreMenu(false); handleAddOpenTab('secrets'); }}
          onOpenDatabase={() => { setShowMobileMoreMenu(false); handleAddOpenTab('database'); }}
          onOpenSettings={() => { setShowMobileMoreMenu(false); handleAddOpenTab('settings'); }}
          onOpenDebug={() => { setShowMobileMoreMenu(false); handleAddOpenTab('debug'); }}
          onOpenCollaboration={() => { setShowMobileMoreMenu(false); handleAddOpenTab('collaboration'); }}
          onOpenWorkflows={() => { setShowMobileMoreMenu(false); handleAddOpenTab('workflows'); }}
          onOpenHistory={() => { setShowMobileMoreMenu(false); handleAddOpenTab('history'); }}
          onOpenCheckpoints={() => { setShowMobileMoreMenu(false); handleAddOpenTab('checkpoints'); }}
          onOpenExtensions={() => { setShowMobileMoreMenu(false); handleAddOpenTab('extensions'); }}
          onOpenSecurity={() => { setShowMobileMoreMenu(false); handleAddOpenTab('security'); }}
          onOpenCommandPalette={() => { setShowMobileMoreMenu(false); setShowCommandPalette(true); }}
          onOpenGlobalSearch={() => { setShowMobileMoreMenu(false); handleAddOpenTab('search'); }}
          onOpenQuickFileSearch={() => { setShowMobileMoreMenu(false); setShowQuickFileSearch(true); }}
          onOpenKeyboardShortcuts={() => { setShowMobileMoreMenu(false); setShowKeyboardShortcuts(true); }}
          onOpenAutomations={() => { setShowMobileMoreMenu(false); handleAddOpenTab('automations'); }}
          onOpenConfig={() => { setShowMobileMoreMenu(false); handleAddOpenTab('config'); }}
          onOpenFeedback={() => { setShowMobileMoreMenu(false); handleAddOpenTab('feedback'); }}
          onOpenGitHub={() => { setShowMobileMoreMenu(false); handleAddOpenTab('github'); }}
          onOpenIntegrations={() => { setShowMobileMoreMenu(false); handleAddOpenTab('integrations'); }}
          onOpenMCP={() => { setShowMobileMoreMenu(false); handleAddOpenTab('mcp'); }}
          onOpenMergeConflicts={() => { setShowMobileMoreMenu(false); handleAddOpenTab('merge-conflicts'); }}
          onOpenMonitoring={() => { setShowMobileMoreMenu(false); handleAddOpenTab('monitoring'); }}
          onOpenNetworking={() => { setShowMobileMoreMenu(false); handleAddOpenTab('networking'); }}
          onOpenSkills={() => { setShowMobileMoreMenu(false); handleAddOpenTab('skills'); }}
          onOpenSSH={() => { setShowMobileMoreMenu(false); handleAddOpenTab('ssh'); }}
          onOpenThreads={() => { setShowMobileMoreMenu(false); handleAddOpenTab('threads'); }}
          onOpenTestRunner={() => { setShowMobileMoreMenu(false); handleAddOpenTab('test-runner'); }}
          onOpenSecurityScanner={() => { setShowMobileMoreMenu(false); handleAddOpenTab('security-scanner'); }}
          onOpenBackup={() => { setShowMobileMoreMenu(false); handleAddOpenTab('backup'); }}
        />

        <ReplitToolsSheet
          open={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          onSelectTool={(tool) => { handleAddTool(tool); handleAddOpenTab(tool); setShowToolsSheet(false); }}
        />
      </div>
      </Suspense>
    );
  }

  // === DESKTOP LAYOUT ===
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[var(--ide-bg)]"><ECodeLoading size="lg" text="Loading IDE..." /></div>}>
    <div className={cn("flex h-screen bg-[var(--ide-bg)] overflow-hidden", className)} data-testid="desktop-layout" data-ide-layout="unified">
      {/* Activity Bar */}
      <ReplitActivityBar
        activeItem={activeActivityItem}
        onItemClick={handleActivityItemClick}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        badgeCounts={{
          git: gitChangesCount > 0 ? gitChangesCount : undefined,
          debug: problemsCount.errors > 0 ? problemsCount.errors : undefined,
        }}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Navigation Bar */}
        <TopNavBar
          projectName={projectName}
          projectSlug={String(project?.id || projectId)}
          ownerUsername={user?.displayName || user?.email || ''}
          projectId={projectId}
          isDeployed={!!publishState?.url}
          onRun={handleRunStop}
          isRunning={isRunning}
          tabs={[]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          showTabs={false}
          onOpenToolsSheet={() => setShowToolsSheet(true)}
          availableTools={availableTools}
          onAddTool={handleAddTool}
          showFileExplorer={showFileExplorer}
          onToggleFileExplorer={() => setShowFileExplorer((prev: boolean) => !prev)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenGlobalSearch={() => { setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }}
          onProjectSettings={() => setProjectSettingsOpen(true)}
          onPublish={() => setPublishDialogOpen(true)}
          onInvite={() => setInviteDialogOpen(true)}
          onFork={() => forkMutation.mutate(undefined)}
        />

        {/* Tab Bar */}
        <ReplitTabBar
          tabs={tabs.map(tab => ({
            id: tab.id,
            label: tab.label,
            closable: tab.closable,
            pinned: tab.pinned,
            modified: tab.modified,
            path: tab.path,
          }))}
          activeTabId={activeTab}
          onTabClick={setActiveTab}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onTabPin={handleTabPin}
          onTabDuplicate={handleTabDuplicate}
          onSplitRight={handleSplitRight}
          onAddTab={() => setShowToolsSheet(true)}
        />

        {/* Main Resizable Panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1" data-testid="desktop-panel-group">
          {/* Left Panel: Agent only */}
          {!isSidebarCollapsed && (
            <ResizablePanel defaultSize={25} minSize={18} maxSize={40} data-testid="desktop-left-panel">
              <div className="h-full flex flex-col border-r border-[var(--ide-border)]">
                <AgentPanelErrorBoundary>
                  <ReplitAgentPanelV3
                    key={`agent-${projectId}`}
                    projectId={projectId}
                    mode="desktop"
                    activeFileId={activeFileId}
                    activeFileName={activeFileName}
                    activeFileContent={activeFileContent}
                    activeFileLanguage={activeFileLanguage}
                    files={Array.isArray(filesRaw) ? filesRaw.map((f: any) => ({ id: String(f.id), filename: f.filename, content: f.content })) : []}
                    onFileCreated={(file: any) => { workspace.createFileMutation?.reset(); }}
                    onFileUpdated={(file: any) => { }}
                    onApplyCode={(filename: string, code: string) => {
                      const file = filesRaw?.find((f: any) => f.filename === filename);
                      if (file) {
                        workspace.saveMutation.mutate({ fileId: String(file.id), content: code });
                      }
                    }}
                    pendingMessage={bootstrapPendingMessage || pendingAIMessage}
                    onPendingMessageConsumed={() => { setBootstrapPendingMessage(null); setPendingAIMessage(null); }}
                    agentToolsSettings={agentToolsSettings}
                    onAgentToolsSettingsChange={setAgentToolsSettings}
                    onExternalInput={setMobileAgentHandlers}
                  />
                </AgentPanelErrorBoundary>
              </div>
            </ResizablePanel>
          )}

          {!isSidebarCollapsed && <ResizableHandle />}

          {/* Main Content Panel */}
          <ResizablePanel defaultSize={isSidebarCollapsed ? (showFileExplorer ? 85 : 100) : (showFileExplorer ? 60 : 75)} minSize={25} data-testid="desktop-main-panel">
            <div className="h-full flex flex-col">
              <div
                className={cn(
                  "h-full w-full transition-opacity duration-100 ease-in-out",
                  tabContentVisible ? "opacity-100" : "opacity-0"
                )}
              >
                {renderDesktopContent()}
              </div>
            </div>
          </ResizablePanel>

          {/* File Explorer Panel (Right side, like Replit) */}
          {showFileExplorer && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={15} minSize={12} maxSize={25} data-testid="desktop-files-panel">
                <div className="h-full flex flex-col border-l border-[var(--ide-border)]">
                  <div className="h-9 border-b border-[var(--ide-border)] flex items-center justify-between px-2.5 bg-[var(--ide-panel)]">
                    <h3 className="font-medium text-xs text-[var(--ide-text-muted)] uppercase tracking-wider">Files</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFileExplorer(false)}
                      className="h-6 w-6 p-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                    >
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ReplitFileExplorer
                    projectId={projectId}
                    files={Array.isArray(filesRaw) ? filesRaw : []}
                    onFileSelect={(file: { id: string; name: string }) => handleFileSelect({ id: parseInt(file.id, 10), name: file.name })}
                    selectedFileId={activeFileId}
                    dirtyFiles={dirtyFiles}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Status Bar */}
        <StatusBar
          gitBranch={gitBranch}
          isRunning={isRunning}
          cursorPosition={cursorPosition}
          language="TypeScript"
          encoding="UTF-8"
          onShowShortcuts={() => setShowKeyboardShortcuts(true)}
          isConnected={isConnected}
          lastSaved={lastSaved}
          problems={problemsCount}
          deploymentStatus={deploymentStatus as any}
          deploymentUrl={publishState?.url}
          onDeployClick={() => { setLeftPanelTab('deployment'); setDeploymentTab('logs'); }}
          wsStatus={wsStatus}
          onStartWorkspace={handleStartWorkspace}
          onStopWorkspace={handleStopWorkspace}
          wsLoading={wsLoading}
        />
      </div>

      {/* Overlays */}
      <QuickFileSearch
        open={showQuickFileSearch}
        onOpenChange={setShowQuickFileSearch}
        files={files.map(f => ({
          id: f.id.toString(),
          name: f.name,
          type: 'file' as const,
          path: f.path || '',
          content: f.content || ''
        }))}
        onFileSelect={(file) => {
          const fileId = parseInt(file.id, 10);
          if (fileId) {
            setSelectedFileId(fileId);
            handleFileSelect({ id: fileId, name: file.name });
          }
          setShowQuickFileSearch(false);
        }}
      />

      <KeyboardShortcutsOverlay
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
      />

      <ReplitToolsSheet
        open={showToolsSheet}
        onClose={() => setShowToolsSheet(false)}
        onSelectTool={(tool) => { handleAddTool(tool); handleAddOpenTab(tool); setShowToolsSheet(false); }}
      />

      <Suspense fallback={null}>
        <CommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          files={Array.isArray(filesRaw) ? filesRaw : []}
          isRunning={isRunning}
          onRun={handleRunStop}
          onNewFile={() => {}}
          onNewFolder={() => {}}
          onToggleTerminal={() => handleAddTool('terminal')}
          onToggleAI={() => { setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }}
          onTogglePreview={() => handleAddTool('preview')}
          onToggleSidebar={() => setShowFileExplorer(prev => !prev)}
          onProjectSettings={() => setProjectSettingsOpen(true)}
          onPublish={() => setPublishDialogOpen(true)}
          onGoToDashboard={() => { window.location.href = '/dashboard'; }}
          onOpenFile={(file: any) => {
            setShowCommandPalette(false);
            handleFileSelect({ id: typeof file.id === 'string' ? parseInt(file.id, 10) : file.id, name: file.filename || file.name || '' });
          }}
          onForkProject={() => forkMutation.mutate('public')}
          projectId={projectId}
        />
      </Suspense>

      {/* ═══ Project Settings Dialog ═══ */}
      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Project Settings</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Configure your project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation.mutate({ name: projectNameInput, language: projectLangInput }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Name</Label>
              <Input value={projectNameInput} onChange={(e) => setProjectNameInput(e.target.value)} className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Language</Label>
              <div className="flex flex-wrap gap-2">
                {['javascript', 'typescript', 'python', 'go', 'ruby', 'cpp', 'java', 'rust', 'bash', 'html'].map((lang) => (
                  <button key={lang} type="button" onClick={() => setProjectLangInput(lang)} className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${projectLangInput === lang ? 'bg-[#0079F2] text-white' : 'bg-[var(--ide-bg)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-[var(--ide-border)]'}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full h-9 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" disabled={updateProjectMutation.isPending}>
              {updateProjectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Publish Dialog ═══ */}
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
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${workspace.project?.visibility === 'private' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : workspace.project?.visibility === 'team' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>{workspace.project?.visibility === 'private' ? 'Private' : workspace.project?.visibility === 'team' ? 'Team' : 'Public'}</span>
              </div>
              <div className="flex gap-2">
                {['public', 'private', 'team'].map((v) => (
                  <button key={v} onClick={() => visibilityMutation.mutate(v)} disabled={visibilityMutation.isPending} className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${workspace.project?.visibility === v ? 'bg-[#0079F2]/10 text-[#0079F2] border-[#0079F2]/30' : 'bg-[var(--ide-panel)] text-[var(--ide-text-muted)] border-[var(--ide-border)] hover:text-[var(--ide-text-secondary)]'}`}>
                    {v === 'public' ? 'Public' : v === 'private' ? 'Private' : 'Team'}
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
                <Switch checked={deployIsPrivate} onCheckedChange={(v) => { setDeployIsPrivate(v); if (workspace.project?.isPublished) deploySettingsMutation.mutate({ isPrivate: v }); }} />
              </div>
              {workspace.project?.visibility === 'private' && (
                <div className="space-y-2 border-t border-[var(--ide-border)] pt-3">
                  <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium">Invited Guests</p>
                  <div className="flex gap-2">
                    <Input placeholder="Email address" value={deployInviteEmail} onChange={(e) => setDeployInviteEmail(e.target.value)} className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-8 text-xs text-[var(--ide-text)] rounded-lg flex-1" onKeyDown={(e) => { if (e.key === 'Enter' && deployInviteEmail.trim()) { inviteGuestMutation.mutate({ email: deployInviteEmail.trim(), role: 'viewer' }); setDeployInviteEmail(''); } }} />
                    <Button size="sm" className="h-8 px-3 text-[11px] bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg" onClick={() => { if (deployInviteEmail.trim()) { inviteGuestMutation.mutate({ email: deployInviteEmail.trim(), role: 'viewer' }); setDeployInviteEmail(''); } }}>Invite</Button>
                  </div>
                  {(guestsQuery.data || []).length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(guestsQuery.data || []).map((guest: ProjectGuest) => (
                        <div key={guest.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-[var(--ide-panel)] border border-[var(--ide-border)]/50">
                          <div>
                            <span className="text-[11px] text-[var(--ide-text)]">{guest.email}</span>
                            <span className="text-[9px] text-[var(--ide-text-muted)] ml-2">{guest.acceptedAt ? 'Accepted' : 'Pending'}</span>
                          </div>
                          <button onClick={() => removeGuestMutation.mutate(guest.id)} className="text-[var(--ide-text-muted)] hover:text-red-400 transition-colors">
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
                <p className="text-sm font-medium text-[var(--ide-text)]">{workspace.project?.name}</p>
                <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">{workspace.project?.language} · {filesRaw?.length || 0} files</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--ide-text-secondary)]">{workspace.project?.isPublished ? 'Published' : 'Draft'}</span>
                <Switch checked={workspace.project?.isPublished || false} onCheckedChange={() => workspace.publishMutation.mutate()} disabled={workspace.publishMutation.isPending} />
              </div>
            </div>

            {workspace.project?.isPublished && (
              <div className="space-y-2">
                <Label className="text-[11px] text-[var(--ide-text-secondary)]">Shareable URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/shared/${projectId}`} className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg flex-1" />
                  <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={copyShareUrl}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={() => window.open(`/shared/${projectId}`, '_blank')}>
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
                <Switch checked={workspace.project?.isDevFramework || frameworkCheckbox} onCheckedChange={(checked) => { if (workspace.project?.isDevFramework && !checked) { frameworkUnpublishMutation.mutate(); setFrameworkCheckbox(false); } else { setFrameworkCheckbox(checked); } }} disabled={frameworkPublishMutation.isPending || frameworkUnpublishMutation.isPending} />
              </div>
              {(frameworkCheckbox || workspace.project?.isDevFramework) && !workspace.project?.isDevFramework && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-[var(--ide-text-secondary)]">Description</Label>
                    <Input value={frameworkDesc} onChange={(e) => setFrameworkDesc(e.target.value)} placeholder="A brief description of your framework..." className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-[var(--ide-text-secondary)]">Category</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {['frontend', 'backend', 'fullstack', 'systems', 'scripting', 'other'].map((cat) => (
                        <button key={cat} type="button" onClick={() => setFrameworkCategory(cat)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${frameworkCategory === cat ? 'bg-[#0079F2] text-white' : 'bg-[var(--ide-bg)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] border border-[var(--ide-border)]'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-[var(--ide-text-secondary)]">Cover Image URL (optional)</Label>
                    <Input value={frameworkCoverUrl} onChange={(e) => setFrameworkCoverUrl(e.target.value)} placeholder="https://example.com/cover.png" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg" />
                  </div>
                  <Button className="w-full h-9 bg-[#0CCE6B] hover:bg-[#0AB85E] text-black rounded-lg text-xs font-medium" disabled={frameworkPublishMutation.isPending} onClick={() => frameworkPublishMutation.mutate({ description: frameworkDesc, category: frameworkCategory, coverUrl: frameworkCoverUrl })}>
                    {frameworkPublishMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Publish Framework'}
                  </Button>
                </div>
              )}
              {workspace.project?.isDevFramework && (
                <div className="p-2.5 rounded-lg bg-[#0CCE6B]/10 border border-[#0CCE6B]/20">
                  <p className="text-[11px] text-[#0CCE6B] font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Published as Developer Framework
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Invite Collaborators Dialog ═══ */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Invite Collaborators</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Share this link to invite others to collaborate in real-time</DialogDescription>
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
                    <Input readOnly value={inviteLink} className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-xs text-[var(--ide-text)] rounded-lg flex-1 font-mono" />
                    <Button size="sm" variant="ghost" className="h-9 px-3 shrink-0" onClick={handleCopyInviteLink}>
                      {inviteLinkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--ide-text-muted)]">Anyone with this link can join your project as an editor.</p>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs border-[var(--ide-border)] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]" onClick={handleGenerateInviteLink}>
                  Generate New Link
                </Button>
              </>
            ) : (
              <Button className="w-full h-9 bg-[#0079F2] hover:bg-[#0068D6] text-white rounded-lg text-xs font-medium" onClick={handleGenerateInviteLink}>
                Generate Invite Link
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Artifact Dialog ═══ */}
      <Dialog open={addArtifactDialogOpen} onOpenChange={setAddArtifactDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Add Artifact</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Add a new artifact to this project</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newArtifactName.trim()) createArtifactMutation.mutate({ name: newArtifactName.trim(), type: newArtifactType }); }} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Name</Label>
              <Input value={newArtifactName} onChange={(e) => setNewArtifactName(e.target.value)} placeholder="My Artifact" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm text-[var(--ide-text)] rounded-lg focus:border-[#0079F2]" autoFocus required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[var(--ide-text-secondary)]">Type</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {['web-app', 'mobile-app', 'slides', 'animation', 'design', 'data-visualization', 'automation', '3d-game', 'document', 'spreadsheet'].map((t) => (
                  <button key={t} type="button" className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 shadow-sm hover:shadow-lg transition-all duration-300 text-[9px] font-medium transition-all ${newArtifactType === t ? 'border-[#0079F2] bg-[#0079F2]/10 text-[#0079F2]' : 'border-[var(--ide-border)] hover:border-[var(--ide-text-muted)] text-[var(--ide-text-muted)]'}`} onClick={() => setNewArtifactType(t)}>
                    <span className="leading-tight text-center">{t.replace(/-/g, ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 h-9 text-xs rounded-lg" onClick={() => setAddArtifactDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 h-9 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" disabled={!newArtifactName.trim() || createArtifactMutation.isPending}>
                {createArtifactMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Conversion Dialog ═══ */}
      {conversionDialogOpen && (
        <Suspense fallback={null}>
          <ConversionDialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen} projectId={projectId} frameId={conversionFrameId} frameName={conversionFrameName} initialTargetType={conversionTargetType} />
        </Suspense>
      )}

      {/* ═══ Animation Export ═══ */}
      {animationExportOpen && (
        <Suspense fallback={null}>
          <AnimationPreview projectId={projectId} previewUrl={livePreviewUrl} exportDialogOpen={animationExportOpen} onExportDialogClose={() => setAnimationExportOpen(false)} />
        </Suspense>
      )}

      {/* ═══ Split Editor ═══ */}
      {splitEditorFileId && (
        <Dialog open={!!splitEditorFileId} onOpenChange={(open) => { if (!open) setSplitEditorFileId(null); }}>
          <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-[var(--ide-text)] text-base">Split View</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={<ECodeLoading size="md" />}>
                <ReplitMonacoEditor projectId={projectId} fileId={splitEditorFileId} fileContents={fileContents} onCodeChange={handleCodeChange} onCursorChange={handleCursorChange} fontSize={userPrefs?.fontSize} tabSize={userPrefs?.tabSize} wordWrap={userPrefs?.wordWrap} minimap={userPrefs?.minimap} filename={filesRaw?.find((f: any) => String(f.id) === splitEditorFileId)?.filename} />
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </Suspense>
  );
}

export default UnifiedIDELayout;
