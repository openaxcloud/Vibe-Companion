import { useState, Suspense } from 'react';
import { useParams } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { ReplitBottomTabs } from '@/components/mobile/ReplitBottomTabs';
import { ReplitToolsSheet } from '@/components/mobile/ReplitToolsSheet';
import { MobileFileExplorer } from '@/components/mobile/MobileFileExplorer';
import { LazyMobileCodeEditor } from '@/components/mobile/LazyMobileCodeEditor';
import { MobilePreviewPanel } from '@/components/mobile/MobilePreviewPanel';
import { MobileDatabasePanel } from '@/components/mobile/MobileDatabasePanel';
import { MobileSecretsPanel } from '@/components/mobile/MobileSecretsPanel';
import { MobilePackagesPanel } from '@/components/mobile/MobilePackagesPanel';
import { ReplitGitPanel } from '@/components/editor/ReplitGitPanel';
import { MobileDebugPanel } from '@/components/mobile/MobileDebugPanel';
import { ReplitAgentPanelV3 } from '@/components/ai/ReplitAgentPanelV3';
import { AgentPanelErrorBoundary } from '@/components/ai/AgentPanelErrorBoundary';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  ArrowLeft, 
  RefreshCw, 
  Share2, 
  MoreVertical,
  Loader2,
  MessageSquarePlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const MobileTerminal = instrumentedLazy(() => 
  import('@/components/mobile/MobileTerminal').then(module => ({ default: module.MobileTerminal })),
  'MobileTerminal'
);

const TerminalFallback = () => (
  <div className="h-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-[11px] text-muted-foreground">Loading terminal...</p>
    </div>
  </div>
);

type MobileTab = 'agent' | 'files' | 'code' | 'terminal' | 'preview' | 'more';

export default function MobileWorkspace() {
  const params = useParams();
  const projectId = (params.projectId || params.id) as string;

  if (!projectId) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Project ID required. Navigate from dashboard.</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<MobileTab>('agent');
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | undefined>();
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Split-view: agent chat visible with floating preview overlay
  const [previewOverlay, setPreviewOverlay] = useState(false);

  const handleTabChange = (tabId: MobileTab) => {
    if (tabId === 'files') {
      setIsFilesOpen(true);
    } else if (tabId === 'more') {
      setActiveTab(tabId);
      setActiveTool(null);
      setToolsSheetOpen(true);
    } else {
      // If switching away from preview tab, also close overlay
      if (tabId !== 'preview') setPreviewOverlay(false);
      setActiveTab(tabId);
      setActiveTool(null);
    }
  };

  const handleToolSelect = (toolId: string) => {
    setActiveTool(toolId);
    setToolsSheetOpen(false);
  };

  const handleFileSelect = (file: any) => {
    setSelectedFileId(file.id);
    setIsFilesOpen(false);
    setActiveTab('code');
  };

  // Layers icon in preview panel → switch to agent with floating preview overlay
  const handleEnterOverlayMode = () => {
    setPreviewOverlay(true);
    setActiveTab('agent');
  };

  // Close the preview tab → go back to agent
  const handleClosePreview = () => {
    setPreviewOverlay(false);
    setActiveTab('agent');
  };

  const isPreviewTab = activeTab === 'preview';

  // Tab title shown in header center
  const tabTitle: Record<MobileTab, string> = {
    agent: 'Agent',
    files: 'Files',
    code: 'Code',
    terminal: 'Shell',
    preview: 'Preview',
    more: 'Tools',
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'agent':
      case 'more':
        return (
          <div className="flex-1 flex flex-col min-h-0 bg-background">
            <AgentPanelErrorBoundary>
              <ReplitAgentPanelV3 
                projectId={projectId}
                className="flex-1 min-h-0"
              />
            </AgentPanelErrorBoundary>
          </div>
        );

      case 'files':
        return null;

      case 'code':
        return (
          <LazyMobileCodeEditor 
            fileId={selectedFileId}
            projectId={projectId}
            onSave={async (content: string) => {
              if (!selectedFileId) return;
              await apiRequest('PUT', `/api/projects/${projectId}/files/${selectedFileId}`, { content });
            }}
            className="h-full"
          />
        );

      case 'terminal':
        return (
          <Suspense fallback={<TerminalFallback />}>
            <MobileTerminal 
              projectId={projectId}
              sessionId={`mobile-${projectId}`}
              className="h-full"
            />
          </Suspense>
        );

      case 'preview':
        return (
          <MobilePreviewPanel 
            projectId={projectId}
            className="h-full"
            onClose={handleClosePreview}
            onOverlayMode={handleEnterOverlayMode}
          />
        );

      default:
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-[13px] text-muted-foreground">Tab: {activeTab}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col bg-background md:hidden overflow-hidden" style={{ height: '100dvh', paddingBottom: 'calc(var(--mobile-nav-height, 52px) + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Top Navigation Bar ── hidden when in full preview tab (preview has its own header) */}
      {!isPreviewTab && (
        <header className="flex items-center justify-between h-14 px-4 border-b bg-background flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          {/* Center: active tab name */}
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">
              {tabTitle[activeTab]}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              data-testid="button-new-chat"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              data-testid="button-more"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </header>
      )}

      {/* ── Tab Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {renderTabContent()}

        {/* ── Floating Preview Overlay (split-view mode) ── */}
        {previewOverlay && (
          <div
            className="absolute bottom-20 right-3 w-[48%] h-[45%] rounded-2xl shadow-2xl border border-border overflow-hidden z-50 bg-background"
            data-testid="mobile-preview-overlay-card"
          >
            <MobilePreviewPanel
              projectId={projectId}
              isOverlay={true}
              onClose={() => setPreviewOverlay(false)}
            />
          </div>
        )}
      </div>

      {/* ── Bottom Tab Navigation ── always visible */}
      <ReplitBottomTabs
        activeTab={activeTab}
        onTabChange={(tab) => handleTabChange(tab as MobileTab)}
      />

      {/* File Explorer Modal */}
      <MobileFileExplorer 
        isOpen={isFilesOpen}
        onClose={() => setIsFilesOpen(false)}
        projectId={projectId}
        onFileSelect={handleFileSelect}
        currentFileId={selectedFileId}
      />

      {/* Tools Sheet */}
      <ReplitToolsSheet
        open={toolsSheetOpen}
        onOpenChange={setToolsSheetOpen}
        onToolSelect={handleToolSelect}
      />

      {/* Tool Panels */}
      <Sheet open={!!activeTool} onOpenChange={(open) => !open && setActiveTool(null)}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="capitalize">{activeTool}</SheetTitle>
          </SheetHeader>
          {activeTool === 'database' && <MobileDatabasePanel projectId={projectId} />}
          {activeTool === 'auth' && <MobileSecretsPanel projectId={projectId} />}
          {activeTool === 'integrations' && <MobilePackagesPanel projectId={projectId} />}
          {activeTool === 'git' && <ReplitGitPanel projectId={projectId} className="h-full" mode="mobile" />}
          {activeTool === 'developer' && <MobileDebugPanel projectId={projectId} />}
          {!['database', 'auth', 'integrations', 'git', 'developer'].includes(activeTool || '') && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-[13px]">
                {activeTool} panel — Coming soon
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
