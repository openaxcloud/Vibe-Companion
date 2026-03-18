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

import { useState, useCallback, Suspense, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { createPanHandlers, type PanInfo } from '@/lib/native-motion';
import { useIDEWorkspace, availableTools } from '@/hooks';
import { useDeviceType } from '@/hooks/use-media-query';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { useProblemsCount } from '@/hooks/use-problems-count';
import { useToast } from '@/hooks/use-toast';
import { instrumentedLazy } from '@/utils/instrumented-lazy';
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
  ChevronLeft,
  Code,
  Terminal,
  Monitor,
  Bot,
  MoreHorizontal,
} from 'lucide-react';
import { ECodeLoading } from '@/components/ECodeLoading';

import { TopNavBar } from '@/components/ide/TopNavBar';
import { StatusBar } from '@/components/ide/StatusBar';
import { ReplitActivityBar, type ActivityItem } from '@/components/ide/ReplitActivityBar';
import { ReplitTabBar } from '@/components/ide/ReplitTabBar';
import { ReplitToolsSheet } from '@/components/ide/ReplitToolsSheet';
import { QuickFileSearch } from '@/components/ide/QuickFileSearch';
import { KeyboardShortcutsOverlay } from '@/components/ide/KeyboardShortcutsOverlay';
import { ReplitFileExplorer } from '@/components/editor/ReplitFileExplorer';
import { ReplitMobileNavigation, ReplitMobileInputBar, ReplitMobileHeader, type MobileTab } from '@/components/mobile';

// Lazy-loaded heavy components
const ReplitMonacoEditor = instrumentedLazy(() => import('@/components/editor/ReplitMonacoEditor').then(mod => ({ default: mod.ReplitMonacoEditor })), 'ReplitMonacoEditor');
const ReplitTerminalPanel = instrumentedLazy(() => import('@/components/editor/ReplitTerminalPanel').then(mod => ({ default: mod.ReplitTerminalPanel })), 'ReplitTerminalPanel');
const ReplitDeploymentPanel = instrumentedLazy(() => import('@/components/ide/ReplitDeploymentPanel').then(mod => ({ default: mod.ReplitDeploymentPanel })), 'ReplitDeploymentPanel');
import { ReplitAgentPanelV3 } from '@/components/ai/ReplitAgentPanelV3';
import { AgentPanelErrorBoundary } from '@/components/ai/AgentPanelErrorBoundary';
import type { ExternalInputHandlers } from '@/components/ai/ReplitAgentPanelV3';
const ResponsiveWebPreview = instrumentedLazy(() => import('@/components/editor/ResponsiveWebPreview').then(mod => ({ default: mod.ResponsiveWebPreview })), 'ResponsiveWebPreview');
const AgentActionsPanel = instrumentedLazy(() => import('@/components/ide/AgentActionsPanel').then(mod => ({ default: mod.AgentActionsPanel })), 'AgentActionsPanel');
const ToolsPanel = instrumentedLazy(() => import('@/components/ide/ToolsPanel').then(mod => ({ default: mod.ToolsPanel })), 'ToolsPanel');

// Mobile-specific lazy components
const MobilePreviewPanel = instrumentedLazy(() => import('@/components/mobile/MobilePreviewPanel').then(mod => ({ default: mod.MobilePreviewPanel })), 'MobilePreviewPanel');
const MobileMoreMenu = instrumentedLazy(() => import('@/components/mobile/MobileMoreMenu').then(mod => ({ default: mod.MobileMoreMenu })), 'MobileMoreMenu');
const MobileSecurityPanel = instrumentedLazy(() => import('@/components/mobile/MobileSecurityPanel').then(mod => ({ default: mod.MobileSecurityPanel })), 'MobileSecurityPanel');
const MobileTabSwitcher = instrumentedLazy(() => import('@/components/mobile/MobileTabSwitcher').then(mod => ({ default: mod.MobileTabSwitcher })), 'MobileTabSwitcher');

// Lazy tool panels
const CommandPalette = instrumentedLazy(() => import('@/components/CommandPalette'), 'CommandPalette');
const GlobalSearch = instrumentedLazy(() => import('@/components/GlobalSearch').then(mod => ({ default: mod.GlobalSearch || (mod as any).default })), 'GlobalSearch');
const CollaborationPanel = instrumentedLazy(() => import('@/components/CollaborationPanel').then(mod => ({ default: mod.CollaborationPanel || (mod as any).default })), 'CollaborationPanel');
const DatabasePanel = instrumentedLazy(() => import('@/components/ide/DatabasePanel').then(mod => ({ default: mod.DatabasePanel })), 'DatabasePanel');
const ReplitAuthPanel = instrumentedLazy(() => import('@/components/ide/ReplitAuthPanel').then(mod => ({ default: mod.ReplitAuthPanel })), 'ReplitAuthPanel');

const ReplitGitPanel = instrumentedLazy(() => import('@/components/editor/ReplitGitPanel').then(mod => ({ default: mod.ReplitGitPanel })), 'ReplitGitPanel');
const ReplitPackagesPanel = instrumentedLazy(() => import('@/components/editor/ReplitPackagesPanel').then(mod => ({ default: mod.ReplitPackagesPanel })), 'ReplitPackagesPanel');
const ReplitDebuggerPanel = instrumentedLazy(() => import('@/components/editor/ReplitDebuggerPanel').then(mod => ({ default: mod.ReplitDebuggerPanel })), 'ReplitDebuggerPanel');
const ReplitTestingPanel = instrumentedLazy(() => import('@/components/editor/ReplitTestingPanel').then(mod => ({ default: mod.ReplitTestingPanel })), 'ReplitTestingPanel');
const ReplitSecretsPanel = instrumentedLazy(() => import('@/components/editor/ReplitSecretsPanel').then(mod => ({ default: mod.ReplitSecretsPanel })), 'ReplitSecretsPanel');
const ReplitHistoryPanel = instrumentedLazy(() => import('@/components/editor/ReplitHistoryPanel').then(mod => ({ default: mod.ReplitHistoryPanel })), 'ReplitHistoryPanel');
const UnifiedCheckpointsPanel = instrumentedLazy(() => import('@/components/UnifiedCheckpointsPanel').then(mod => ({ default: mod.UnifiedCheckpointsPanel || (mod as any).default })), 'UnifiedCheckpointsPanel');
const ReplitSettingsPanel = instrumentedLazy(() => import('@/components/editor/ReplitSettingsPanel').then(mod => ({ default: mod.ReplitSettingsPanel })), 'ReplitSettingsPanel');
const ReplitThemesPanel = instrumentedLazy(() => import('@/components/editor/ReplitThemesPanel').then(mod => ({ default: mod.ReplitThemesPanel })), 'ReplitThemesPanel');
const ReplitMultiplayers = instrumentedLazy(() => import('@/components/editor/ReplitMultiplayers').then(mod => ({ default: mod.ReplitMultiplayers })), 'ReplitMultiplayers');
const WorkflowsPanel = instrumentedLazy(() => import('@/components/ide/WorkflowsPanel').then(mod => ({ default: mod.WorkflowsPanel })), 'WorkflowsPanel');
const ExtensionsMarketplace = instrumentedLazy(() => import('@/components/ExtensionsMarketplace').then(mod => ({ default: mod.ExtensionsMarketplace || (mod as any).default })), 'ExtensionsMarketplace');
const VisualEditorPanel = instrumentedLazy(() => import('@/components/ide/VisualEditorPanel').then(mod => ({ default: mod.VisualEditorPanel })), 'VisualEditorPanel');
const ShellPanel = instrumentedLazy(() => import('@/components/editor/ShellPanel').then(mod => ({ default: mod.ShellPanel })), 'ShellPanel');
const AppStoragePanel = instrumentedLazy(() => import('@/components/editor/AppStoragePanel').then(mod => ({ default: mod.AppStoragePanel })), 'AppStoragePanel');
const ReplitConsolePanel = instrumentedLazy(() => import('@/components/ide/ReplitConsolePanel').then(mod => ({ default: mod.ReplitConsolePanel })), 'ReplitConsolePanel');
const ResourcesPanel = instrumentedLazy(() => import('@/components/ide/ResourcesPanel').then(mod => ({ default: mod.ResourcesPanel })), 'ResourcesPanel');
const LogsViewerPanel = instrumentedLazy(() => import('@/components/ide/LogsViewerPanel').then(mod => ({ default: mod.LogsViewerPanel })), 'LogsViewerPanel');

import { ShortcutHint, ShortcutTester } from '@/components/utilities';
import { useAutonomousBuildStore } from '@/stores/autonomousBuildStore';
import { useSchemaWarmingStore } from '@/stores/schemaWarmingStore';

interface UnifiedIDELayoutProps {
  projectId: string;
  className?: string;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const mobileTabOrder: MobileTab[] = ['preview', 'agent', 'deploy', 'more'];

function UnifiedIDELayout({ projectId, className }: UnifiedIDELayoutProps) {
  const deviceType = useDeviceType();
  const { toast } = useToast();
  const connectionStatus = useConnectionStatus();
  const isConnected = wsConnected ?? (connectionStatus.isOnline && connectionStatus.backendHealthy);
  const { errorsCount } = useProblemsCount(projectId);
  const { isReady: isSchemaReady } = useSchemaWarmingStore();

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
    dirtyFiles,
    handleCodeChange,
    handleCursorChange,
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
    creditBalance,
  } = workspace;

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
      case 'settings':
        handleAddTool('settings');
        break;
    }
  }, [setActiveActivityItem, setShowFileExplorer, setIsSidebarCollapsed, setLeftPanelTab, handleAddTool]);

  // Mobile state
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('agent');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [mobileAgentHandlers, setMobileAgentHandlers] = useState<ExternalInputHandlers | null>(null);

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
  const [activeOpenTabId, setActiveOpenTabId] = useState('agent');

  const toolNameMap: Record<string, string> = {
    agent: 'Agent', preview: 'Preview', deploy: 'Deploy', console: 'Console',
    database: 'Database', git: 'Git', secrets: 'Secrets', auth: 'Auth',
    settings: 'Settings', history: 'History', workflows: 'Workflows',
    extensions: 'Extensions', packages: 'Packages', terminal: 'Terminal',
    debug: 'Debug', checkpoints: 'Checkpoints', security: 'Security',
    collaboration: 'Collaboration', search: 'Search',
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
        setActiveOpenTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeOpenTabId]);

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

  // Mobile content renderer
  const renderMobileContent = () => {
    if (isLoadingProject) {
      return <div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading workspace..." /></div>;
    }
    switch (mobileActiveTab) {
      case 'preview':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" text="Loading Preview..." /></div>}><MobilePreviewPanel projectId={projectId} /></Suspense>;
      case 'agent':
        return <AgentPanelErrorBoundary><ReplitAgentPanelV3 projectId={projectId} mode="mobile" agentToolsSettings={agentToolsSettings} onAgentToolsSettingsChange={setAgentToolsSettings} hideInput={true} onExternalInput={setMobileAgentHandlers} /></AgentPanelErrorBoundary>;
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
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitTerminalPanel projectId={projectId} /></Suspense>;
      case 'files':
        return <ReplitFileExplorer projectId={projectId} onFileSelect={handleFileSelect} selectedFileId={selectedFileId} />;
      case 'history':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitHistoryPanel projectId={projectId} /></Suspense>;
      case 'settings':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitSettingsPanel projectId={projectId} /></Suspense>;
      case 'extensions':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ExtensionsMarketplace projectId={parseInt(projectId, 10)} className="h-full" /></Suspense>;
      case 'workflows':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><WorkflowsPanel projectId={projectId} /></Suspense>;
      case 'debug':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitDebuggerPanel projectId={projectId} /></Suspense>;
      case 'security':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><MobileSecurityPanel projectId={projectId} /></Suspense>;
      case 'search':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><GlobalSearch isOpen={true} inline={true} onClose={() => setMobileActiveTab('agent')} projectId={projectId} onFileSelect={(file: any) => handleFileSelect({ id: file.id, name: file.name })} /></Suspense>;
      case 'checkpoints':
        return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><UnifiedCheckpointsPanel projectId={projectId} maxHeight="calc(100vh - 120px)" /></Suspense>;
      case 'more':
        return null;
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
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitMonacoEditor projectId={projectId} fileId={activeFileId} fileContents={fileContents} onCodeChange={handleCodeChange} onCursorChange={handleCursorChange} fontSize={userPrefs?.fontSize} tabSize={userPrefs?.tabSize} wordWrap={userPrefs?.wordWrap} minimap={userPrefs?.minimap} filename={activeFileName || undefined} ytext={activeYtext} remoteAwareness={collabConnected ? remoteAwareness : undefined} /></Suspense>;
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
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitSettingsPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'history' || currentTab.id === 'rewind') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitHistoryPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'checkpoints') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><UnifiedCheckpointsPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'workflows') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><WorkflowsPanel projectId={projectId} /></Suspense>;
    }
    if (currentTab.id === 'extensions') {
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ExtensionsMarketplace projectId={parseInt(projectId, 10)} /></Suspense>;
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
      return <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="md" /></div>}><ReplitTerminalPanel projectId={projectId} /></Suspense>;
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

    return <div className="flex items-center justify-center h-full text-[var(--ide-text-muted)] text-xs">Select a file or tool</div>;
  };

  // === MOBILE LAYOUT ===
  if (deviceType === 'mobile') {
    return (
      <div className={cn('flex flex-col h-screen w-screen overflow-hidden bg-[var(--ide-bg)] touch-manipulation', className)} data-testid="mobile-layout" data-ide-layout="unified">
        <ReplitMobileHeader
          activeTab={mobileActiveTab}
          onBack={() => window.history.back()}
          onHistory={() => handleAddOpenTab('history')}
          onNewTab={() => setShowQuickFileSearch(true)}
          onMore={() => setShowMobileMoreMenu(true)}
        />

        <div
          className="flex-1 overflow-hidden"
          {...((mobileActiveTab === 'preview' || mobileActiveTab === 'agent') ? mobileSwipeHandlers : {})}
          style={{ paddingBottom: mobileActiveTab === 'agent' ? '7.5rem' : '3rem' }}
        >
          <div key={mobileActiveTab} className="h-full overflow-auto animate-fade-in">
            {renderMobileContent()}
          </div>
        </div>

        {mobileActiveTab === 'agent' && (
          <ReplitMobileInputBar
            placeholder="What would you like to build?"
            onSubmit={(value) => mobileAgentHandlers?.handleSubmit?.(value)}
            isWorking={mobileAgentHandlers?.isWorking}
            agentMode={mobileAgentHandlers?.agentMode}
            onModeChange={(mode) => mobileAgentHandlers?.onModeChange?.(mode)}
          />
        )}

        <ReplitMobileNavigation
          activeTab={mobileActiveTab}
          onTabChange={setMobileActiveTab}
          isRunning={isRunning}
          onPlayStop={handleRunStop}
          isPanelOpen={showToolsSheet}
          onPanelToggle={() => setShowToolsSheet(!showToolsSheet)}
          onMorePress={() => setShowMobileMoreMenu(true)}
          openTabs={openTabs}
          activeOpenTabId={activeOpenTabId}
          onOpenTabSelect={handleSelectOpenTab}
          onAddTab={() => setShowToolsSheet(true)}
          onTabSwitcherOpen={() => setShowTabSwitcher(true)}
        />

        <Suspense fallback={null}>
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
            problemsCount={errorsCount}
          />
        </Suspense>

        <ReplitToolsSheet
          open={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          onSelectTool={(tool) => { handleAddTool(tool); handleAddOpenTab(tool); setShowToolsSheet(false); }}
        />

        <Suspense fallback={null}>
          <MobileTabSwitcher
            isOpen={showTabSwitcher}
            onClose={() => setShowTabSwitcher(false)}
            openTabs={openTabs}
            activeTabId={activeOpenTabId}
            onTabSelect={handleSelectOpenTab}
            onTabClose={handleCloseOpenTab}
            onNewTab={() => { setShowTabSwitcher(false); setShowToolsSheet(true); }}
          />
        </Suspense>
      </div>
    );
  }

  // === TABLET LAYOUT ===
  if (deviceType === 'tablet') {
    return (
      <div className={cn('flex flex-col h-screen w-screen overflow-hidden bg-[var(--ide-bg)] touch-manipulation', className)} data-testid="tablet-layout" data-ide-layout="unified">
        <header className="flex items-center justify-between h-12 px-3 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowFileExplorer(!showFileExplorer)} className="h-9 w-9">
              {showFileExplorer ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
            <span className="font-medium text-[var(--ide-text)] text-[13px]">{projectName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowToolsSheet(true)} className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto" style={{ paddingBottom: mobileActiveTab === 'agent' ? '8rem' : '3.5rem' }}>
          {renderMobileContent()}
        </div>

        {mobileActiveTab === 'agent' && (
          <ReplitMobileInputBar
            placeholder="What would you like to build?"
            onSubmit={(value) => mobileAgentHandlers?.handleSubmit?.(value)}
            isWorking={mobileAgentHandlers?.isWorking}
          />
        )}

        <ReplitMobileNavigation
          activeTab={mobileActiveTab}
          onTabChange={setMobileActiveTab}
          isRunning={isRunning}
          onPlayStop={handleRunStop}
          isPanelOpen={showToolsSheet}
          onPanelToggle={() => setShowToolsSheet(!showToolsSheet)}
          onMorePress={() => setShowMobileMoreMenu(true)}
          openTabs={openTabs}
          activeOpenTabId={activeOpenTabId}
          onOpenTabSelect={handleSelectOpenTab}
          onAddTab={() => setShowToolsSheet(true)}
          onTabSwitcherOpen={() => setShowTabSwitcher(true)}
        />

        <ReplitToolsSheet
          open={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          onSelectTool={(tool) => { handleAddTool(tool); handleAddOpenTab(tool); setShowToolsSheet(false); }}
        />
      </div>
    );
  }

  // === DESKTOP LAYOUT ===
  return (
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
          ownerUsername={user?.username || ''}
          projectId={projectId}
          isDeployed={false}
          onRun={handleRunStop}
          isRunning={isRunning}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onOpenToolsSheet={() => setShowToolsSheet(true)}
          availableTools={availableTools}
          onAddTool={handleAddTool}
          showFileExplorer={showFileExplorer}
          onToggleFileExplorer={() => setShowFileExplorer((prev: boolean) => !prev)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenGlobalSearch={() => { setIsSidebarCollapsed(false); setLeftPanelTab('agent'); }}
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
          {/* Left Panel: AI Agent / Actions / Tools / Deploy */}
          {!isSidebarCollapsed && (
            <ResizablePanel defaultSize={30} minSize={20} maxSize={40} data-testid="desktop-left-panel">
              <div className="h-full flex flex-col border-r border-[var(--ide-border)]">
                <Tabs value={leftPanelTab} onValueChange={setLeftPanelTab} className="h-full flex flex-col">
                  <TabsList className="w-full h-9 justify-start rounded-none border-b border-[var(--ide-border)] bg-[var(--ide-panel)] p-0 px-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    <TabsTrigger value="agent" className="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md" data-testid="tab-agent">
                      <Brain className="h-3.5 w-3.5" /> Agent
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md" data-testid="tab-actions">
                      <Zap className="h-3.5 w-3.5" /> Actions
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md" data-testid="tab-tools">
                      <Layers className="h-3.5 w-3.5" /> Tools
                    </TabsTrigger>
                    <TabsTrigger value="deployment" className="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md" data-testid="tab-deployment" onClick={() => setDeploymentTab('deploy')}>
                      <Rocket className="h-3.5 w-3.5" /> Deploy
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="agent" className="flex-1 mt-0 overflow-hidden" forceMount>
                    <ReplitAgentPanelV3
                      key={`agent-${projectId}`}
                      projectId={projectId}
                      mode="desktop"
                      activeFileId={activeFileId}
                      activeFileName={activeFileName}
                      activeFileContent={activeFileContent}
                      activeFileLanguage={activeFileLanguage}
                      files={filesRaw?.map((f: any) => ({ id: String(f.id), filename: f.filename, content: f.content })) || []}
                      onFileCreated={(file: any) => { workspace.createFileMutation?.reset(); }}
                      onFileUpdated={(file: any) => { }}
                      onApplyCode={(filename: string, code: string) => {
                        const file = filesRaw?.find((f: any) => f.filename === filename);
                        if (file) {
                          workspace.saveMutation.mutate({ fileId: String(file.id), content: code });
                        }
                      }}
                      pendingMessage={pendingAIMessage}
                      onPendingMessageConsumed={() => setPendingAIMessage(null)}
                      agentToolsSettings={agentToolsSettings}
                      onAgentToolsSettingsChange={setAgentToolsSettings}
                    />
                  </TabsContent>

                  <TabsContent value="actions" className="flex-1 mt-0 overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="sm" text="Loading Actions..." /></div>}>
                      <AgentActionsPanel projectId={projectId} />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="tools" className="flex-1 mt-0 overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="sm" text="Loading Tools..." /></div>}>
                      <ToolsPanel
                        availableTools={availableTools}
                        onSelectTool={handleAddTool}
                        activeTabs={tabs.map(t => t.id)}
                      />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="deployment" className="flex-1 mt-0 overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><ECodeLoading size="sm" text="Loading Deploy..." /></div>}>
                      <ReplitDeploymentPanel projectId={projectId} defaultTab={deploymentTab || 'deploy'} />
                    </Suspense>
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          )}

          {!isSidebarCollapsed && <ResizableHandle withHandle />}

          {/* Main Content Panel */}
          <ResizablePanel defaultSize={isSidebarCollapsed ? (showFileExplorer ? 82 : 100) : (showFileExplorer ? 52 : 70)} minSize={30} data-testid="desktop-main-panel">
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

          {/* File Explorer Panel (Right) */}
          {showFileExplorer && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={18} minSize={15} maxSize={30} data-testid="desktop-right-panel">
                <div className="h-full flex flex-col border-l border-[var(--ide-border)]">
                  <div className="h-9 border-b border-[var(--ide-border)] flex items-center justify-between px-2.5">
                    <h3 className="font-medium text-xs text-[var(--ide-text-muted)]">Files</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFileExplorer(false)}
                      className="h-6 w-6 p-0 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ReplitFileExplorer
                    projectId={projectId}
                    files={filesRaw || []}
                    onFileSelect={handleFileSelect}
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
          path: f.path,
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
          onOpenChange={setShowCommandPalette}
          files={files as any}
          onFileSelect={(file: any) => {
            setShowCommandPalette(false);
            if (typeof file === 'number') {
              handleFileSelect({ id: file, name: '' });
            } else {
              handleFileSelect({ id: file.id, name: file.name });
            }
          }}
          onToolSelect={(tool: string) => { setShowCommandPalette(false); handleAddTool(tool); }}
        />
      </Suspense>
    </div>
  );
}

export default UnifiedIDELayout;
