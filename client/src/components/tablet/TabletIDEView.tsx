/**
 * TabletIDEView Component
 * Tablet-optimized IDE with sliding drawer navigation + resizable dual panels
 * Supports iPad, Surface, and Android tablets with touch-first interactions
 */

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';
import { useQuery } from '@tanstack/react-query';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Code,
  Terminal,
  Monitor,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  Bot,
  Rocket,
  GitBranch,
  Package,
  Key,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useTablet, useTabletLayout, useTabletOrientation } from '@/hooks/use-tablet';
import {
  useDrawerPersistence,
  usePanelPersistence,
  usePanelSizesPersistence,
  useTabletFilePersistence,
} from '@/hooks/use-tablet-persistence';
import { TabletDrawerContent } from './TabletDrawerContent';
import { LazyMobileCodeEditor } from '@/components/mobile/LazyMobileCodeEditor';
import { MobilePreviewPanel } from '@/components/mobile/MobilePreviewPanel';
import { MobileCollaborationPanel } from '@/components/mobile/MobileCollaborationPanel';
import { useToast } from '@/hooks/use-toast';
import { ToastProvider as DesignSystemToastProvider } from '@/design-system';
import { ShortcutHint, ShortcutTester } from '@/components/utilities';
import { AgentToolsPanel } from '@/components/ai/AgentToolsPanel';
import { ReplitAgentPanelV3 } from '@/components/ai/ReplitAgentPanelV3';
import { RAGStatsDisplay, useRAGStats } from '@/components/ai/RAGControls';
import { useAgentTools } from '@/hooks/useAgentTools';
import { ReplitDeploymentPanel } from '@/components/ide/ReplitDeploymentPanel';
import { ReplitPublishButton } from '@/components/ide/ReplitPublishButton';
import { GitPanel } from '@/components/ide/GitPanel';
import { ReplitPackagesPanel } from '@/components/editor/ReplitPackagesPanel';
import { ReplitSettingsPanel } from '@/components/editor/ReplitSettingsPanel';
import { ReplitSecretsPanel } from '@/components/editor/ReplitSecretsPanel';
import { ReplitDebuggerPanel } from '@/components/editor/ReplitDebuggerPanel';
import { useConnectionStatus } from '@/hooks/use-connection-status';
import { useProblemsCount } from '@/hooks/use-problems-count';

const MobileTerminal = instrumentedLazy(() => 
  import('@/components/mobile/MobileTerminal').then(module => ({ default: module.MobileTerminal })), 'MobileTerminal'
);

const AutonomousWorkspaceViewer = instrumentedLazy(() => 
  import('@/components/ide/AutonomousWorkspaceViewer').then(module => ({ default: module.AutonomousWorkspaceViewer })), 'AutonomousWorkspaceViewer'
);

const TerminalFallback = () => (
  <div className="h-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-[11px] text-muted-foreground">Loading terminal...</p>
    </div>
  </div>
);

export type TabletPanel = 'editor' | 'terminal' | 'preview' | 'agent' | 'deploy' | 'git' | 'packages' | 'secrets' | 'settings' | 'debug';

interface TabletIDEViewProps {
  projectId: string; // UUID string from route params
  className?: string;
  bootstrapToken?: string | null;
  onWorkspaceComplete?: () => void;
  onWorkspaceError?: (error: string) => void;
}

export function TabletIDEView({ projectId, className, bootstrapToken, onWorkspaceComplete, onWorkspaceError }: TabletIDEViewProps) {
  // Tablet detection and layout config
  const { isIPad, isIPadPro, orientation, screenSize } = useTablet();
  const layout = useTabletLayout();
  const { toast } = useToast();
  
  // Agent Tools state for tablet
  const numericProjectId = parseInt(projectId, 10) || 1;
  const { settings: agentSettings, updateSettings: updateAgentSettings } = useAgentTools(numericProjectId);
  
  // State management with persistence (tablet-8)
  const [drawerOpen, setDrawerOpen] = useDrawerPersistence(projectId);
  const [rightPanel, setRightPanel] = usePanelPersistence(projectId, layout.canSplitView);
  const [selectedFileId, setSelectedFileId] = useTabletFilePersistence(projectId);
  const [isCollaborationOpen, setIsCollaborationOpen] = useState(false);
  const { 
    editorPanelSize, 
    setEditorPanelSize, 
    rightPanelSize, 
    setRightPanelSize 
  } = usePanelSizesPersistence(projectId);
  
  // Query git status for badge count
  interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    unstaged: string[];
    untracked: string[];
  }
  
  const { data: gitStatus } = useQuery<GitStatus>({
    queryKey: ['/api/git/status'],
    refetchInterval: 30000,
  });
  
  // Calculate badge counts from git status
  const gitChangesCount = gitStatus 
    ? (gitStatus.staged?.length || 0) + (gitStatus.unstaged?.length || 0) + (gitStatus.untracked?.length || 0)
    : 0;
  
  // Connection status detection
  const isConnected = useConnectionStatus();
  
  // Problems/errors count
  const { errorsCount } = useProblemsCount(projectId);
  
  // Keyboard utilities feature flags
  const [enableShortcutHint, setEnableShortcutHint] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('keyboard-shortcut-hint') !== 'false';
  });
  const [enableShortcutTester, setEnableShortcutTester] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('keyboard-shortcut-tester') === 'true';
  });
  
  // Listen for keyboard settings changes
  useEffect(() => {
    const handleKeyboardSettingsChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Use event detail if available, otherwise fallback to localStorage
      const hintValue = customEvent.detail?.shortcutHint ?? localStorage.getItem('keyboard-shortcut-hint');
      const testerValue = customEvent.detail?.shortcutTester ?? localStorage.getItem('keyboard-shortcut-tester');
      
      setEnableShortcutHint(hintValue !== 'false');
      setEnableShortcutTester(testerValue === 'true');
    };
    
    window.addEventListener('keyboard-settings-changed', handleKeyboardSettingsChanged);
    return () => window.removeEventListener('keyboard-settings-changed', handleKeyboardSettingsChanged);
  }, []);
  
  // Refs for gesture handling
  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  
  // Update drawer visibility when layout capabilities change
  useEffect(() => {
    if (!layout.canShowSidebar && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [layout.canShowSidebar, drawerOpen]);
  
  // Drawer toggle handler
  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev);
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);
  
  // Swipe gesture to open/close drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchDuration = Date.now() - touchStartTime.current;
    const swipeDistance = touchEndX - touchStartX.current;
    const swipeVelocity = swipeDistance / touchDuration;
    
    // Swipe from left edge to open drawer
    if (!drawerOpen && touchStartX.current < 20 && swipeDistance > 80) {
      setDrawerOpen(true);
      if ('vibrate' in navigator) navigator.vibrate(10);
    }
    // Swipe right to left to close drawer
    else if (drawerOpen && swipeDistance < -80 && Math.abs(swipeVelocity) > 0.3) {
      setDrawerOpen(false);
      if ('vibrate' in navigator) navigator.vibrate(10);
    }
  };
  
  // Tool action handlers
  const handleOpenTerminal = useCallback(() => {
    // Close drawer first, then switch panel to ensure pointer events work
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('terminal');
      toast({
        title: 'Terminal Opened',
        description: 'Terminal panel is now active',
      });
    }, 100); // Small delay to let drawer close animation complete
  }, [toast]);
  
  const handleOpenAIAgent = useCallback(() => {
    setDrawerOpen(false);
    setRightPanel('agent');
    toast({
      title: '🤖 AI Agent',
      description: 'Agent Tools panel opened',
      duration: 2000,
    });
  }, [toast]);
  
  const handleOpenDeploy = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('deploy');
      toast({
        title: 'Deployments',
        description: 'Deploy your app to production',
        duration: 2000,
      });
    }, 100);
  }, [toast]);
  
  const handleOpenGit = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('git');
      toast({
        title: 'Source Control',
        description: 'Manage your Git repository',
        duration: 2000,
      });
    }, 100);
  }, [toast]);
  
  const handleOpenPackages = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('packages');
      toast({
        title: 'Packages',
        description: 'Manage project dependencies',
        duration: 2000,
      });
    }, 100);
  }, [toast]);
  
  const handleOpenSecrets = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('secrets');
      toast({
        title: 'Secrets',
        description: 'Manage environment variables',
        duration: 2000,
      });
    }, 100);
  }, [toast]);
  
  const handleOpenDebugger = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('debug');
      toast({
        title: 'Debugger',
        description: 'Debug your application',
        duration: 2000,
      });
    }, 100);
  }, [toast]);
  
  const handleOpenSettings = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setRightPanel('settings');
      toast({
        title: 'Settings',
        description: 'Configure your IDE',
        duration: 2000,
      });
    }, 100);
  }, [toast]);
  
  // Single panel switcher (for fallback mode - includes Editor, Preview, Terminal, Agent)
  const SinglePanelSwitcher = () => (
    <div className="flex items-center gap-1 border-b border-border bg-background/95 backdrop-blur p-1">
      <Button
        variant={rightPanel === 'editor' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('editor')}
        className="flex-1 h-10 touch-manipulation px-2"
        data-testid="button-editor-panel"
      >
        <Code className="h-4 w-4 mr-1" />
        <span className="text-[11px]">Editor</span>
      </Button>
      <Button
        variant={rightPanel === 'preview' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('preview')}
        className="flex-1 h-10 touch-manipulation px-2"
        data-testid="button-preview-panel"
      >
        <Monitor className="h-4 w-4 mr-1" />
        <span className="text-[11px]">Preview</span>
      </Button>
      <Button
        variant={rightPanel === 'terminal' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('terminal')}
        className="flex-1 h-10 touch-manipulation px-2"
        data-testid="button-terminal-panel"
      >
        <Terminal className="h-4 w-4 mr-1" />
        <span className="text-[11px]">Terminal</span>
      </Button>
      <Button
        variant={rightPanel === 'agent' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('agent')}
        className="flex-1 h-10 touch-manipulation px-2"
        data-testid="button-agent-panel"
      >
        <Bot className="h-4 w-4 mr-1" />
        <span className="text-[11px]">Agent</span>
      </Button>
    </div>
  );
  
  // Right panel switcher (for split-view mode - Preview/Terminal/Agent)
  const RightPanelSwitcher = () => (
    <div className="flex items-center gap-1 border-b border-border bg-background/95 backdrop-blur p-1">
      <Button
        variant={rightPanel === 'preview' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('preview')}
        className="flex-1 h-12 touch-manipulation"
        data-testid="button-preview-panel"
      >
        <Monitor className="h-5 w-5 mr-2" />
        Preview
      </Button>
      <Button
        variant={rightPanel === 'terminal' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('terminal')}
        className="flex-1 h-12 touch-manipulation"
        data-testid="button-terminal-panel"
      >
        <Terminal className="h-5 w-5 mr-2" />
        Terminal
      </Button>
      <Button
        variant={rightPanel === 'agent' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setRightPanel('agent')}
        className="flex-1 h-12 touch-manipulation"
        data-testid="button-agent-panel"
      >
        <Bot className="h-5 w-5 mr-2" />
        Agent
      </Button>
    </div>
  );
  
  return (
    <DesignSystemToastProvider>
      <div
        className={cn(
          'flex h-screen w-screen overflow-hidden bg-background',
          'touch-manipulation select-none',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        data-testid="tablet-ide-view"
      >
      {/* Sliding Drawer Navigation */}
      <LazyAnimatePresence>
        {drawerOpen && (
          <LazyMotionDiv
            ref={drawerRef}
            initial={{ y: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed left-0 top-0 z-40 h-full bg-background border-r border-border',
              'shadow-xl'
            )}
            style={{ width: layout.optimalSidebarWidth }}
            data-testid="drawer-navigation"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-muted/30">
              <h2 className="text-[13px] font-semibold">File Explorer</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDrawer}
                className="h-10 w-10 touch-manipulation"
                data-testid="button-close-drawer"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Drawer Content - Files and Tools */}
            <div className="h-[calc(100%-3.5rem)] overflow-hidden">
              <TabletDrawerContent
                projectId={projectId}
                onFileSelect={(file) => {
                  setSelectedFileId(file.id);
                  // Auto-close drawer on small tablets in portrait
                  if (orientation === 'portrait' && screenSize === 'small') {
                    setDrawerOpen(false);
                  }
                }}
                onClose={() => setDrawerOpen(false)}
                onOpenAIAgent={handleOpenAIAgent}
                onOpenDeploy={handleOpenDeploy}
                onOpenGit={handleOpenGit}
                onOpenTerminal={handleOpenTerminal}
                onOpenPackages={handleOpenPackages}
                onOpenDebugger={handleOpenDebugger}
                onOpenSettings={handleOpenSettings}
                onOpenCollaboration={() => setIsCollaborationOpen(true)}
                gitChangesCount={gitChangesCount}
                errorsCount={errorsCount}
              />
            </div>
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
      
      {/* Drawer Overlay (close on tap outside) */}
      {drawerOpen && (
        <LazyMotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          data-testid="drawer-overlay"
        />
      )}
      
      {/* Main Content Area with Resizable Panels */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="flex items-center gap-2 h-14 px-4 border-b border-border bg-background/95 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDrawer}
            className="h-10 w-10 touch-manipulation"
            data-testid="button-toggle-drawer"
          >
            {drawerOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
          
          {/* Connection status indicator */}
          <div className="flex items-center">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          <div className="flex-1 flex items-center gap-2">
            <Code className="h-5 w-5 text-muted-foreground" />
            <span className="text-[13px] font-medium truncate">
              {selectedFileId ? `File ${selectedFileId}` : 'No file selected'}
            </span>
          </div>
          
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {errorsCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500">
                <AlertCircle className="h-3 w-3" />
                <span className="text-[11px] font-medium">{errorsCount}</span>
              </div>
            )}
            {gitChangesCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                <span className="text-[11px] font-medium">{gitChangesCount}</span>
              </div>
            )}
          </div>
          
          <ReplitPublishButton
            projectId={projectId}
            onOpenLogs={() => setRightPanel('deploy')}
            onOpenAnalytics={() => setRightPanel('deploy')}
          />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 touch-manipulation"
            data-testid="button-search"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 touch-manipulation"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Resizable Dual-Panel Layout */}
        <div className="flex-1 overflow-hidden pointer-events-auto">
          {layout.canSplitView ? (
            <ResizablePanelGroup
              direction="horizontal"
              onLayout={(sizes) => {
                // Persist both panel sizes (tablet-8)
                if (sizes[0]) {
                  setEditorPanelSize(sizes[0]);
                }
                if (sizes[1]) {
                  setRightPanelSize(sizes[1]);
                }
              }}
            >
              {/* Editor Panel */}
              <ResizablePanel
                defaultSize={editorPanelSize}
                minSize={30}
                maxSize={70}
                className="relative"
              >
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-hidden">
                    <LazyMobileCodeEditor
                      projectId={projectId}
                      fileId={selectedFileId || undefined}
                      className="h-full"
                    />
                  </div>
                </div>
              </ResizablePanel>
              
              {/* Resizable Handle with touch-optimized hit area */}
              <ResizableHandle
                withHandle
                className={cn(
                  'w-2 bg-border hover:bg-primary/20 transition-colors',
                  'touch-manipulation cursor-col-resize',
                  'relative after:absolute after:inset-y-0 after:left-1/2',
                  'after:-translate-x-1/2 after:w-8' // Wider touch target
                )}
              />
              
              {/* Right Panel (Preview or Terminal) */}
              <ResizablePanel
                defaultSize={rightPanelSize}
                minSize={25}
                maxSize={50}
              >
                <div className="h-full flex flex-col">
                  <RightPanelSwitcher />
                  <div className="flex-1 overflow-hidden">
                    {rightPanel === 'preview' ? (
                      <MobilePreviewPanel projectId={projectId} />
                    ) : rightPanel === 'terminal' ? (
                      <Suspense fallback={<TerminalFallback />}>
                        <MobileTerminal projectId={projectId} />
                      </Suspense>
                    ) : rightPanel === 'agent' ? (
                      <div className="h-full overflow-hidden bg-background">
                        <ReplitAgentPanelV3
                          projectId={projectId}
                          mode="tablet"
                          agentToolsSettings={agentSettings}
                          onAgentToolsSettingsChange={updateAgentSettings}
                        />
                      </div>
                    ) : rightPanel === 'deploy' ? (
                      <ReplitDeploymentPanel projectId={projectId} className="h-full" />
                    ) : rightPanel === 'git' ? (
                      <GitPanel projectId={projectId} mode="tablet" />
                    ) : rightPanel === 'packages' ? (
                      <ReplitPackagesPanel />
                    ) : rightPanel === 'secrets' ? (
                      <ReplitSecretsPanel />
                    ) : rightPanel === 'settings' ? (
                      <ReplitSettingsPanel />
                    ) : rightPanel === 'debug' ? (
                      <ReplitDebuggerPanel projectId={projectId} />
                    ) : null}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            // Fallback for small portrait tablets: single panel with switcher
            <div className="h-full flex flex-col">
              <SinglePanelSwitcher />
              <div className="flex-1 overflow-hidden">
                {rightPanel === 'editor' ? (
                  <LazyMobileCodeEditor
                    projectId={projectId}
                    fileId={selectedFileId || undefined}
                    className="h-full"
                  />
                ) : rightPanel === 'preview' ? (
                  <MobilePreviewPanel projectId={projectId} />
                ) : rightPanel === 'terminal' ? (
                  <Suspense fallback={<TerminalFallback />}>
                    <MobileTerminal projectId={projectId} />
                  </Suspense>
                ) : rightPanel === 'agent' ? (
                  <div className="h-full overflow-hidden bg-background">
                    <ReplitAgentPanelV3
                      projectId={projectId}
                      mode="tablet"
                      agentToolsSettings={agentSettings}
                      onAgentToolsSettingsChange={updateAgentSettings}
                    />
                  </div>
                ) : rightPanel === 'deploy' ? (
                  <ReplitDeploymentPanel projectId={projectId} className="h-full" />
                ) : rightPanel === 'git' ? (
                  <GitPanel projectId={projectId} />
                ) : rightPanel === 'packages' ? (
                  <ReplitPackagesPanel />
                ) : rightPanel === 'secrets' ? (
                  <ReplitSecretsPanel />
                ) : rightPanel === 'settings' ? (
                  <ReplitSettingsPanel />
                ) : rightPanel === 'debug' ? (
                  <ReplitDebuggerPanel projectId={projectId} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Keyboard Utilities (work with external keyboards on tablet) */}
      {enableShortcutHint && <ShortcutHint />}
      {enableShortcutTester && <ShortcutTester />}
      
      {/* Collaboration Panel */}
      <MobileCollaborationPanel
        projectId={parseInt(projectId, 10) || 0}
        isOpen={isCollaborationOpen}
        onClose={() => setIsCollaborationOpen(false)}
      />
      
      {/* Autonomous Workspace Viewer - shows animated progress during workspace creation */}
      {bootstrapToken && (
        <Suspense fallback={null}>
          <AutonomousWorkspaceViewer
            bootstrapToken={bootstrapToken}
            projectId={projectId}
            onComplete={onWorkspaceComplete}
            onError={onWorkspaceError}
          />
        </Suspense>
      )}
      </div>
    </DesignSystemToastProvider>
  );
}
