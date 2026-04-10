import React, { useState, useEffect, Suspense } from 'react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Terminal as TerminalIcon,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery, useIsDesktop } from '@/hooks/use-media-query';
import { ReplitMultiplayers } from './ReplitMultiplayers';
import { ReplitToolDock } from './ReplitToolDock';
import { ReplitAgentPanelV3 } from '../ai/ReplitAgentPanelV3';
import { ReplitFileSidebar } from './ReplitFileSidebar';
import { ReplitSearchPanel } from './ReplitSearchPanel';
import { ReplitGitPanel } from './ReplitGitPanel';
import { ReplitDatabasePanel } from './ReplitDatabasePanel';
import { ReplitPackagesPanel } from './ReplitPackagesPanel';
import { ReplitSettingsPanel } from './ReplitSettingsPanel';
import { ReplitSecretsPanel } from './ReplitSecretsPanel';
import { ReplitThemesPanel } from './ReplitThemesPanel';
import { ReplitDebuggerPanel } from './ReplitDebuggerPanel';
import { ReplitTestingPanel } from './ReplitTestingPanel';
import { ReplitHistoryPanel } from './ReplitHistoryPanel';
import { ShellPanel } from './ShellPanel';
import { AppStoragePanel } from './AppStoragePanel';
import { ResponsiveWebPreview } from './ResponsiveWebPreview';

const ReplitTerminalPanel = instrumentedLazy(() => 
  import('./ReplitTerminalPanel').then(module => ({ default: module.ReplitTerminalPanel })), 'ReplitTerminalPanel'
);

const TerminalFallback = () => (
  <div className="h-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-[11px] text-muted-foreground">Loading terminal...</p>
    </div>
  </div>
);
// Lazy load Splits to avoid bundling with non-editor pages
// Using V2 with SplitsLayout + Floating Panes support
const SplitsEditorLayout = instrumentedLazy(() => 
  import('../splits').then(module => ({ default: module.SplitsEditorLayoutV2 })), 'SplitsEditorLayout'
);

interface ReplitEditorLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  bottomPanel?: React.ReactNode;
  rightPanels?: {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
  }[];
  files?: any[];
  activeFileId?: number;
  onFileSelect?: (file: any) => void;
  onFileCreate?: (name: string, isFolder: boolean, parentId?: number) => void;
  onFileDelete?: (fileId: number) => void;
  onFileRename?: (fileId: number, newName: string) => void;
  projectName?: string;
  projectId?: string;
  defaultRightPanel?: string;
  onRightPanelChange?: (panelId: string | null) => void;
  leftPanelOpen?: boolean;
  onLeftPanelOpenChange?: (open: boolean) => void;
  rightPanelOpen?: boolean;
  onRightPanelOpenChange?: (open: boolean) => void;
  activeRightPanel?: string | null;
  bottomPanelOpen?: boolean;
  onBottomPanelOpenChange?: (open: boolean) => void;
}

export function ReplitEditorLayout({
  leftPanel,
  centerPanel,
  bottomPanel,
  rightPanels = [],
  files = [],
  activeFileId,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  projectName,
  projectId,
  defaultRightPanel,
  onRightPanelChange,
  leftPanelOpen: leftPanelOpenProp,
  onLeftPanelOpenChange,
  rightPanelOpen: rightPanelOpenProp,
  onRightPanelOpenChange,
  activeRightPanel: activeRightPanelProp,
  bottomPanelOpen: bottomPanelOpenProp,
  onBottomPanelOpenChange,
}: ReplitEditorLayoutProps) {
  // Use the new Splits layout system on desktop only (enables floating panes)
  // SplitsEditorLayout includes ReplitToolDock + AI Agent + all IDE panels
  // Keep legacy layout for mobile/tablet (different UX patterns)
  const isDesktop = useIsDesktop();
  const useSplitsLayout = isDesktop; // Enable floating panes on desktop (>1440px)

  if (useSplitsLayout) {
    return (
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-muted">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-[13px] text-muted-foreground">Loading editor layout...</p>
          </div>
        </div>
      }>
        <SplitsEditorLayout
          files={files}
          activeFileId={activeFileId}
          onFileSelect={onFileSelect}
          onFileCreate={onFileCreate}
          onFileDelete={onFileDelete}
          onFileRename={onFileRename}
          projectName={projectName}
          projectId={projectId}
        />
      </React.Suspense>
    );
  }

  // Original layout code continues below...
  const [internalLeftPanelOpen, setInternalLeftPanelOpen] = useState(leftPanelOpenProp ?? true);
  const [internalRightPanelOpen, setInternalRightPanelOpen] = useState(rightPanelOpenProp ?? true);
  const [internalBottomPanelOpen, setInternalBottomPanelOpen] = useState(bottomPanelOpenProp ?? false);
  const [internalActiveRightPanel, setInternalActiveRightPanel] = useState<string | null>(
    activeRightPanelProp ?? (defaultRightPanel || rightPanels[0]?.id || null)
  );
  const [activeTool, setActiveTool] = useState('files');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileBottomPanelOpen, setMobileBottomPanelOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const rightPanelOpen = rightPanelOpenProp ?? internalRightPanelOpen;
  const bottomPanelOpen = bottomPanelOpenProp ?? internalBottomPanelOpen;
  const activeRightPanel = activeRightPanelProp ?? internalActiveRightPanel;
  const leftPanelOpen = leftPanelOpenProp ?? internalLeftPanelOpen;

  // Add the multiplayers panel to rightPanels if it doesn't exist
  const enhancedRightPanels = React.useMemo(() => {
    const panels = [...rightPanels];
    
    // Add multiplayers panel if it doesn't exist
    if (!panels.find(p => p.id === 'multiplayers')) {
      panels.unshift({
        id: 'multiplayers',
        title: 'Multiplayers',
        icon: null,
        content: <ReplitMultiplayers projectId={projectId} />
      });
    }
    
    return panels;
  }, [rightPanels, projectId]);

  // Get the content for the active tool
  const getToolContent = () => {
    switch(activeTool) {
      case 'files':
        return leftPanel || (
          <ReplitFileSidebar
            files={files}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect || (() => {})}
            onFileCreate={onFileCreate || (() => {})}
            onFileDelete={onFileDelete || (() => {})}
            onFileRename={onFileRename}
            projectName={projectName}
            projectId={projectId}
          />
        );
      case 'agent':
        return <ReplitAgentPanelV3 projectId={projectId || '1'} className="h-full" />;
      case 'search':
        return <ReplitSearchPanel projectId={projectId} />;
      case 'git':
        return <ReplitGitPanel projectId={projectId} />;
      case 'debug':
      case 'debugger':
        return <ReplitDebuggerPanel projectId={projectId} />;
      case 'testing':
        return <ReplitTestingPanel projectId={projectId} />;
      case 'database':
        return <ReplitDatabasePanel projectId={projectId} />;
      case 'packages':
        return <ReplitPackagesPanel projectId={projectId} />;
      case 'settings':
        return <ReplitSettingsPanel projectId={projectId} />;
      case 'terminal':
        return (
          <Suspense fallback={<TerminalFallback />}>
            <ReplitTerminalPanel projectId={projectId} />
          </Suspense>
        );
      case 'preview':
        return (
          <ResponsiveWebPreview 
            projectId={projectId || '1'} 
            isRunning={true}
            className="h-full"
          />
        );
      case 'secrets':
        return <ReplitSecretsPanel projectId={projectId} />;
      case 'shell':
        return <ShellPanel projectId={projectId || ''} />;
      case 'storage':
        return <AppStoragePanel projectId={projectId || ''} />;
      case 'themes':
        return <ReplitThemesPanel projectId={projectId} />;
      case 'history':
        return <ReplitHistoryPanel projectId={projectId} />;
      case 'multiplayers':
        return <ReplitMultiplayers projectId={projectId} />;
      default:
        return (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-[13px]">{activeTool} coming soon...</p>
          </div>
        );
    }
  };

  useEffect(() => {
    if (leftPanelOpenProp !== undefined) {
      setInternalLeftPanelOpen(leftPanelOpenProp);
    }
  }, [leftPanelOpenProp]);

  useEffect(() => {
    if (rightPanelOpenProp !== undefined) {
      setInternalRightPanelOpen(rightPanelOpenProp);
    }
  }, [rightPanelOpenProp]);

  useEffect(() => {
    if (bottomPanelOpenProp !== undefined) {
      setInternalBottomPanelOpen(bottomPanelOpenProp);
    }
  }, [bottomPanelOpenProp]);

  useEffect(() => {
    if (activeRightPanelProp !== undefined) {
      setInternalActiveRightPanel(activeRightPanelProp);
    }
  }, [activeRightPanelProp]);

  useEffect(() => {
    if (isMobile) {
      updateLeftPanelOpen(false);
      updateRightPanelOpen(false);
      updateBottomPanelOpen(false);
    }
  }, [isMobile]);

  const handleRightPanelChange = (panelId: string | null) => {
    setActiveRightPanelState(panelId || null);
  };

  const updateLeftPanelOpen = (open: boolean) => {
    if (leftPanelOpenProp === undefined) {
      setInternalLeftPanelOpen(open);
    }
    onLeftPanelOpenChange?.(open);
  };

  const updateRightPanelOpen = (open: boolean) => {
    if (rightPanelOpenProp === undefined) {
      setInternalRightPanelOpen(open);
    }
    onRightPanelOpenChange?.(open);
  };

  const updateBottomPanelOpen = (open: boolean) => {
    if (bottomPanelOpenProp === undefined) {
      setInternalBottomPanelOpen(open);
    }
    onBottomPanelOpenChange?.(open);
  };

  const setActiveRightPanelState = (panelId: string | null) => {
    if (activeRightPanelProp === undefined) {
      setInternalActiveRightPanel(panelId);
    }
    onRightPanelChange?.(panelId);
  };

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Mobile Tool Dock */}
        <div className="flex border-b border-border bg-background overflow-x-auto">
          <ReplitToolDock
            activeTool={activeTool}
            onToolChange={setActiveTool}
            isCollapsed={false}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-background overflow-hidden">
          {centerPanel}
        </div>

        {/* Mobile Bottom Panel */}
        {bottomPanel && (
          <>
            <button
              onClick={() => setMobileBottomPanelOpen(!mobileBottomPanelOpen)}
              className="p-2 border-t border-border bg-muted flex items-center justify-between"
            >
              <span className="text-[13px] text-foreground">Console</span>
              {mobileBottomPanelOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {mobileBottomPanelOpen && (
              <div className="h-[40vh] border-t border-border bg-background">
                {bottomPanel}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Left Tool Dock - Fixed 40px width */}
      <ReplitToolDock
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />

      <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
        {/* Left Panel - Tool Content (Files/Agent/etc) */}
        {leftPanelOpen && (
          <>
            <ResizablePanel 
              defaultSize={20} 
              minSize={15} 
              maxSize={30}
              className="bg-background"
            >
              <div className="h-full bg-background border-r border-border">
                {getToolContent()}
              </div>
            </ResizablePanel>

            <ResizableHandle
              className="w-[1px] bg-border hover:cursor-col-resize"
            />
          </>
        )}

        {/* Center Panel - Code Editor */}
        <ResizablePanel 
          defaultSize={rightPanelOpen ? 50 : 70} 
          minSize={30}
          className="bg-background"
        >
          {bottomPanelOpen ? (
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70}>
                <div className="h-full bg-background">
                  {centerPanel}
                </div>
              </ResizablePanel>

              <ResizableHandle
                className="h-[1px] bg-border hover:cursor-row-resize"
              />
              
              <ResizablePanel defaultSize={25} minSize={10} maxSize={50}>
                <div className="h-full bg-background border-t border-border">
                  {/* Console/Terminal Header */}
                  <div className="h-8 flex items-center justify-between px-3 bg-background border-b border-border">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-status-success">
                      <TerminalIcon className="h-3.5 w-3.5" />
                      Console
                    </div>
                    <button
                      onClick={() => updateBottomPanelOpen(false)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="h-3 w-3 text-status-success" />
                    </button>
                  </div>
                  <div className="h-[calc(100%-32px)] bg-background">
                    {bottomPanel}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full bg-background">
              {centerPanel}
            </div>
          )}
        </ResizablePanel>

        {rightPanelOpen && enhancedRightPanels.length > 0 && (
          <>
            <ResizableHandle
              className="w-[1px] bg-border hover:cursor-col-resize"
            />

            {/* Right Panel - Multiplayers/Preview/etc */}
            <ResizablePanel 
              defaultSize={25} 
              minSize={20} 
              maxSize={40}
              className="bg-background"
            >
              <div className="h-full bg-[var(--ecode-surface)] border-l border-[var(--ecode-border)] flex flex-col">
                {/* Right Panel Tab Headers - Replit Style */}
                <div className="h-9 flex items-center border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] px-2.5">
                  {enhancedRightPanels.map((panel, index) => {
                    const isActive = activeRightPanel === panel.id;
                    return (
                      <button
                        key={panel.id}
                        onClick={() => handleRightPanelChange(panel.id)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium transition-colors rounded-md mr-1",
                          isActive
                            ? "bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text)]"
                            : "text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                        )}
                      >
                        {panel.title}
                      </button>
                    );
                  })}
                  
                  <div className="flex-1" />
                  
                  <button
                    onClick={() => updateRightPanelOpen(false)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Right Panel Content */}
                <div className="flex-1 overflow-hidden bg-background">
                  {enhancedRightPanels.map((panel) => (
                    <div
                      key={panel.id}
                      className={cn(
                        "h-full",
                        activeRightPanel === panel.id ? "block" : "hidden"
                      )}
                    >
                      {panel.content}
                    </div>
                  ))}
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      
      {/* Floating buttons to reopen panels - Replit Style */}
      {!leftPanelOpen && (
        <button
          onClick={() => updateLeftPanelOpen(true)}
          className="fixed left-14 top-20 p-1.5 bg-background border border-border rounded-md shadow-sm hover:shadow-md transition-shadow"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {!rightPanelOpen && (
        <button
          onClick={() => updateRightPanelOpen(true)}
          className="fixed right-2 top-20 p-1.5 bg-background border border-border rounded-md shadow-sm hover:shadow-md transition-shadow"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {!bottomPanelOpen && bottomPanel && (
        <button
          onClick={() => updateBottomPanelOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background border border-border rounded-md shadow-sm hover:shadow-md transition-shadow flex items-center gap-2"
        >
          <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Console</span>
        </button>
      )}
    </div>
  );
}