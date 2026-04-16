// @ts-nocheck
/**
 * SplitsEditorLayout V2 - Using SplitsLayout with Floating Panes
 * Simplified version to prove floating panes work on desktop
 */

import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { File } from '@shared/schema';
import { SplitsLayout } from './SplitsLayout';
import { ReplitToolDock } from '../editor/ReplitToolDock';
import { ReplitFileSidebar } from '../editor/ReplitFileSidebar';
import { ReplitSearchPanel } from '../editor/ReplitSearchPanel';
import { ReplitAgentPanelV3 } from '../ai/ReplitAgentPanelV3';
import { ReplitGitPanel } from '../editor/ReplitGitPanel';
import { ReplitDebuggerPanel } from '../editor/ReplitDebuggerPanel';
import { ReplitTestingPanel } from '../editor/ReplitTestingPanel';
import { ReplitDatabasePanel } from '../editor/ReplitDatabasePanel';
import { ReplitPackagesPanel } from '../editor/ReplitPackagesPanel';
import { ReplitHistoryPanel } from '../editor/ReplitHistoryPanel';
import { ReplitSecretsPanel } from '../editor/ReplitSecretsPanel';
import { ReplitSettingsPanel } from '../editor/ReplitSettingsPanel';
import { ReplitProblemsPanel } from '../editor/ReplitProblemsPanel';
import { ReplitOutputPanel } from '../editor/ReplitOutputPanel';
import { ReplitStatusBar } from '../editor/ReplitStatusBar';
import { ReplitBreadcrumbs } from '../editor/ReplitBreadcrumbs';
import { ReplitTerminal } from '../terminal/ReplitTerminal';
import { MultiTabEditor } from '../editor/MultiTabEditor';
import { CommandPalette, generateDefaultCommands } from '../command-palette/CommandPalette';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useLayoutStore } from '@/../../shared/stores/layoutStore';
import useSplitsStore from '@/stores/splits-store';
import { useDeviceType } from '@/hooks/use-media-query';
import { createEditorDefaultLayout, TOOL_DOCK_TO_TAB_MAP } from './EditorDefaultLayout';
import { Play, Share2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isPaneGroup } from '@/types/splits';

interface SplitsEditorLayoutV2Props {
  files?: File[];
  activeFileId?: number;
  onFileSelect?: (file: File) => void;
  onFileCreate?: (name: string, isFolder: boolean, parentId?: number) => void;
  onFileDelete?: (fileId: number) => void;
  onFileRename?: (fileId: number, newName: string) => void;
  projectName?: string;
  projectId?: string;
  className?: string;
}

export function SplitsEditorLayoutV2({
  files = [],
  activeFileId,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  projectName = 'Untitled Project',
  projectId,
  className,
}: SplitsEditorLayoutV2Props) {
  const commandPalette = useCommandPalette();
  const { activeTool, setActiveTool } = useLayoutStore();
  
  // Device detection for responsive UI (tablet gets compact mode, laptop gets desktop mode)
  const rawDeviceType = useDeviceType();
  const agentMode = rawDeviceType === 'laptop' ? 'desktop' : rawDeviceType;
  
  const {
    root,
    initializeLayout,
    findNode,
    setActivePane,
    setActiveTab,
    setCenterStackHeight,
  } = useSplitsStore();
  
  // Measure actual center-stack height for Fortune 500-grade 216px minimum enforcement
  const centerStackRef = useRef<HTMLDivElement>(null);

  // Initialize layout on mount with pre-populated content
  useEffect(() => {
    if (!root) {
      const panelContent = {
        files: (
          <ReplitFileSidebar
            files={files}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
            onFileCreate={onFileCreate}
            onFileDelete={onFileDelete}
            onFileRename={onFileRename}
            projectName={projectName}
            projectId={Number(projectId)}
          />
        ),
        search: <ReplitSearchPanel />,
        git: <ReplitGitPanel projectId={projectId} />,
        agent: <ReplitAgentPanelV3 projectId={projectId || '1'} mode={agentMode as 'desktop' | 'tablet' | 'mobile'} />,
        debugger: <ReplitDebuggerPanel projectId={projectId} />,
        testing: <ReplitTestingPanel projectId={projectId} />,
        database: <ReplitDatabasePanel projectId={projectId} />,
        packages: <ReplitPackagesPanel projectId={projectId} />,
        history: <ReplitHistoryPanel projectId={projectId} />,
        secrets: <ReplitSecretsPanel projectId={projectId} />,
        settings: <ReplitSettingsPanel />,
        editor: (
          <div className="h-full flex flex-col bg-[var(--ecode-editor-bg)]">
            <ReplitBreadcrumbs
              filePath={files?.find(f => f.id === activeFileId)?.path || ''}
              onNavigate={(path) => {
                window.dispatchEvent(new CustomEvent('ecode:reveal-path', { detail: { path } }));
              }}
            />
            <div className="flex-1 overflow-hidden">
              <MultiTabEditor
                files={files}
                activeFileId={activeFileId}
                onFileSelect={onFileSelect}
                onChange={(fileId, content) => {}}
              />
            </div>
          </div>
        ),
        terminal: (
          <ReplitTerminal 
            projectId={Number(projectId) || 1} 
            className="h-full"
            theme="dark"
            allowMultipleSessions={true}
          />
        ),
        output: <ReplitOutputPanel projectId={projectId} />,
        problems: (
          <ReplitProblemsPanel 
            projectId={projectId}
            onFileNavigate={(file, line, column) => {}}
          />
        ),
        console: (
          <div className="h-full bg-[var(--ecode-terminal-bg)] p-4">
            <p className="text-[var(--ecode-terminal-text)] text-[11px] font-[family-name:var(--ecode-font-mono)]">
              Console output will appear here...
            </p>
          </div>
        ),
        debugConsole: (
          <div className="h-full bg-[var(--ecode-terminal-bg)] p-4">
            <p className="text-[var(--ecode-terminal-text)] text-[11px] font-[family-name:var(--ecode-font-mono)]">
              Debug console ready. Start debugging to see output here.
            </p>
          </div>
        ),
        preview: (
          <div className="h-full w-full flex flex-col bg-[var(--ecode-surface)]">
            {/* Browser-like Header */}
            <div className="flex items-center gap-2 h-10 px-3 border-b border-[var(--ecode-border)] bg-[var(--ecode-background)]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-[var(--ecode-surface)] border border-[var(--ecode-border)] text-[11px] text-[var(--ecode-text-muted)]">
                  <span className="opacity-60">🔒</span>
                  <span>localhost:5000</span>
                </div>
              </div>
            </div>
            
            {/* Wireframe App Preview */}
            <div className="flex-1 overflow-auto p-4">
              <div className="max-w-lg mx-auto space-y-4">
                {/* Header Wireframe */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-dashed border-[var(--ecode-border)] bg-[var(--ecode-background)]">
                  <div className="w-24 h-6 rounded bg-[var(--ecode-border)] animate-pulse" />
                  <div className="flex gap-2">
                    <div className="w-16 h-6 rounded bg-[var(--ecode-border)] animate-pulse" />
                    <div className="w-16 h-6 rounded bg-[var(--ecode-border)] animate-pulse" />
                  </div>
                </div>
                
                {/* Hero Wireframe */}
                <div className="p-6 rounded-lg border border-dashed border-[var(--ecode-border)] bg-[var(--ecode-background)] space-y-4">
                  <div className="w-3/4 h-8 rounded bg-[var(--ecode-border)] animate-pulse mx-auto" />
                  <div className="w-2/3 h-4 rounded bg-[var(--ecode-border)] animate-pulse mx-auto" />
                  <div className="w-32 h-10 rounded bg-[var(--ecode-accent)]/20 border border-[var(--ecode-accent)]/40 mx-auto animate-pulse" />
                </div>
                
                {/* Content Cards Wireframe */}
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 rounded-lg border border-dashed border-[var(--ecode-border)] bg-[var(--ecode-background)] space-y-3">
                      <div className="w-full h-20 rounded bg-[var(--ecode-border)] animate-pulse" />
                      <div className="w-3/4 h-4 rounded bg-[var(--ecode-border)] animate-pulse" />
                      <div className="w-1/2 h-3 rounded bg-[var(--ecode-border)] animate-pulse" />
                    </div>
                  ))}
                </div>
                
                {/* Build Status */}
                <div className="flex items-center justify-center gap-2 p-4 rounded-lg border border-dashed border-[var(--ecode-accent)]/30 bg-[var(--ecode-accent)]/5">
                  <div className="w-2 h-2 rounded-full bg-[var(--ecode-accent)] animate-pulse" />
                  <span className="text-[13px] text-[var(--ecode-text-muted)] font-[family-name:var(--ecode-font-sans)]">
                    Your app preview will appear here when running
                  </span>
                </div>
              </div>
            </div>
          </div>
        ),
      };
      
      const defaultLayout = createEditorDefaultLayout(projectId || '1', panelContent);
      initializeLayout(defaultLayout);
    }
  }, [root, projectId, files, activeFileId, onFileSelect, onFileCreate, onFileDelete, onFileRename, projectName, initializeLayout]);

  // Sync tool dock with active pane using store actions (no mutations!)
  const handleToolChange = (tool: string) => {
    setActiveTool(tool);
    
    // Map tool to tab and activate via store action
    const tabId = TOOL_DOCK_TO_TAB_MAP[tool];
    if (tabId) {
      // Use store actions to update state properly
      setActivePane('left-dock');
      setActiveTab('left-dock', tabId); // Activate the specific tab by ID
    }
  };

  // Measure center-stack height with ResizeObserver (Fortune 500-grade precision)
  useEffect(() => {
    const container = centerStackRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        setCenterStackHeight(height);
      }
    });
    
    observer.observe(container);
    
    return () => observer.disconnect();
  }, [setCenterStackHeight]);

  // Command palette commands
  const commands = useMemo(() => generateDefaultCommands({
    onToolSelect: handleToolChange,
    onNavigate: (path) => {},
  }), [handleToolChange]);

  return (
    <>
      {/* Command Palette */}
      <CommandPalette
        open={commandPalette.isOpen}
        onOpenChange={commandPalette.setIsOpen}
        commands={commands}
        files={files}
        onFileSelect={onFileSelect}
        onToolSelect={setActiveTool}
      />

      <div className={cn("flex flex-col h-full w-full bg-[var(--ecode-background)]", className)}>
        {/* Top Toolbar */}
        <div className="h-12 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)] flex items-center px-4 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-[13px] font-semibold text-[var(--ecode-text)] font-[family-name:var(--ecode-font-sans)]">
              {projectName}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="default"
              className="bg-[var(--ecode-button-primary)] hover:bg-[var(--ecode-button-primary-hover)] text-white gap-2"
              data-testid="button-run-project"
            >
              <Play className="h-4 w-4" />
              Run
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2 border-[var(--ecode-border)] text-[var(--ecode-text)]"
              data-testid="button-share-project"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2 border-[var(--ecode-border)] text-[var(--ecode-text)]"
              data-testid="button-deploy-project"
            >
              <Rocket className="h-4 w-4" />
              Deploy
            </Button>
          </div>
        </div>

        {/* Main Layout - Tool Dock + SplitsLayout */}
        <div ref={centerStackRef} className="flex flex-1 overflow-hidden">
          {/* Tool Dock */}
          <ReplitToolDock
            activeTool={activeTool}
            onToolChange={handleToolChange}
          />

          {/* SplitsLayout with Floating Panes Support */}
          <div className="flex-1">
            <SplitsLayout />
          </div>
        </div>

        {/* Status Bar */}
        <ReplitStatusBar
          language={files?.find(f => f.id === activeFileId)?.name?.split('.').pop() || 'plaintext'}
          lineNumber={1}
          columnNumber={1}
          encoding="UTF-8"
          gitBranch="main"
          hasGitChanges={false}
          errorCount={0}
          warningCount={0}
          infoCount={0}
          isConnected={true}
          onProblemsClick={() => setActivePane('center-bottom')}
          onGitClick={() => handleToolChange('git')}
          onSettingsClick={() => handleToolChange('settings')}
        />
      </div>
    </>
  );
}
