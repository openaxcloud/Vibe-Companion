import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCode, Code, Terminal as TerminalIcon, Globe, Play, RotateCcw, Bot, MoreHorizontal, GitBranch, Bug, AlertCircle, Settings as SettingsIcon, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileEditorTabsProps {
  fileExplorer: React.ReactNode;
  codeEditor: React.ReactNode;
  terminal: React.ReactNode;
  preview: React.ReactNode;
  aiAgent?: React.ReactNode;
  moreMenu?: React.ReactNode;
  defaultTab?: string;
  className?: string;
  isRunning?: boolean;
  onRun?: () => void;
  onGitOpen?: () => void;
  onDebugOpen?: () => void;
  onProblemsOpen?: () => void;
  onSettingsOpen?: () => void;
  onShareOpen?: () => void;
}

export function MobileEditorTabs({
  fileExplorer,
  codeEditor,
  terminal,
  preview,
  aiAgent,
  moreMenu,
  defaultTab = 'code',
  className,
  isRunning = false,
  onRun,
  onGitOpen,
  onDebugOpen,
  onProblemsOpen,
  onSettingsOpen,
  onShareOpen
}: MobileEditorTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Production-grade mobile tab styling with touch optimization
  const getTabTriggerClass = (tabValue: string) => {
    // Min 44x44px touch target (iOS Human Interface Guidelines)
    const baseClass = "flex flex-col items-center justify-center gap-1 h-full min-h-[44px] px-2 py-1 transition-all duration-200 relative touch-manipulation";
    const isActive = activeTab === tabValue;
    
    if (isActive) {
      return cn(baseClass, 
        "bg-[var(--ecode-surface)] text-[var(--ecode-text)] border-t-2 border-[var(--ecode-accent)]",
        "shadow-sm",
        "active:scale-95" // Touch feedback
      );
    }
    
    return cn(baseClass, 
      "text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface-hover)]",
      "border-t-2 border-transparent",
      "active:scale-95 active:bg-[var(--ecode-surface-hover)]" // Touch feedback
    );
  };


  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-background)]", className)}>
      {/* Mobile Action Bar - Only show when relevant */}
      {(activeTab === 'code' || activeTab === 'terminal') && onRun && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium capitalize">{activeTab}</h3>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'code' && (
              <Button
                size="sm"
                onClick={onRun}
                disabled={isRunning}
                className="h-8 px-3 text-[11px]"
              >
                {isRunning ? (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                    Running
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Run
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Tab Content Areas */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="files" className="h-full m-0 overflow-hidden">
            <div className="h-full overflow-auto">
              {fileExplorer}
            </div>
          </TabsContent>
          
          <TabsContent value="code" className="h-full m-0 overflow-hidden">
            <div className="h-full">
              {codeEditor}
            </div>
          </TabsContent>
          
          <TabsContent value="terminal" className="h-full m-0 overflow-hidden">
            <div className="h-full">
              {terminal}
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="h-full m-0 overflow-hidden">
            <div className="h-full">
              {preview}
            </div>
          </TabsContent>
          
          {/* AI Assistant Tab (if provided) */}
          {aiAgent && (
            <TabsContent value="ai" className="h-full m-0 overflow-hidden">
              <div className="h-full">
                {aiAgent}
              </div>
            </TabsContent>
          )}
        </div>
        
        {/* Production Mobile Bottom Tab Bar - 5/6 Tabs (conditional AI) */}
        <TabsList className={cn(
          "grid w-full h-14 rounded-none border-t border-[var(--ecode-border)] bg-[var(--ecode-background)] p-0",
          aiAgent ? "grid-cols-6" : "grid-cols-5"
        )}>
          <TabsTrigger 
            value="files" 
            className={getTabTriggerClass('files')}
            data-testid="mobile-tab-files"
          >
            <FileCode className="h-5 w-5" />
            <span className="text-[10px] font-medium">Files</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="code" 
            className={getTabTriggerClass('code')}
            data-testid="mobile-tab-code"
          >
            <Code className="h-5 w-5" />
            <span className="text-[10px] font-medium">Code</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="terminal" 
            className={getTabTriggerClass('terminal')}
            data-testid="mobile-tab-terminal"
          >
            <TerminalIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Terminal</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="preview" 
            className={getTabTriggerClass('preview')}
            data-testid="mobile-tab-preview"
          >
            <Globe className="h-5 w-5" />
            <span className="text-[10px] font-medium">Preview</span>
          </TabsTrigger>
          
          {/* AI Tab (conditional) */}
          {aiAgent && (
            <TabsTrigger 
              value="ai" 
              className={getTabTriggerClass('ai')}
              data-testid="mobile-tab-ai"
            >
              <Bot className="h-5 w-5" />
              <span className="text-[10px] font-medium">AI</span>
            </TabsTrigger>
          )}
          
          {/* More Menu - Production Bottom Sheet (not a tab) */}
          <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-full min-h-[44px] px-2 py-1 transition-all duration-200 relative touch-manipulation",
                  "text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface-hover)]",
                  "border-t-2 border-transparent",
                  "active:scale-95 active:bg-[var(--ecode-surface-hover)]"
                )}
                data-testid="mobile-tab-more"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="text-left">Tools & Actions</SheetTitle>
              </SheetHeader>
              <div className="grid gap-2 py-4">
                {/* Git */}
                <button
                  onClick={() => {
                    onGitOpen?.();
                    setMoreSheetOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--ecode-surface-hover)] transition-colors touch-manipulation active:scale-98"
                  data-testid="mobile-more-git"
                >
                  <GitBranch className="h-5 w-5 text-[var(--ecode-accent)]" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Git</div>
                    <div className="text-[11px] text-[var(--ecode-text-muted)]">Version control</div>
                  </div>
                </button>
                
                {/* Debug */}
                <button
                  onClick={() => {
                    onDebugOpen?.();
                    setMoreSheetOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--ecode-surface-hover)] transition-colors touch-manipulation active:scale-98"
                  data-testid="mobile-more-debug"
                >
                  <Bug className="h-5 w-5 text-status-success" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Debug</div>
                    <div className="text-[11px] text-[var(--ecode-text-muted)]">Debugger panel</div>
                  </div>
                </button>
                
                {/* Problems */}
                <button
                  onClick={() => {
                    onProblemsOpen?.();
                    setMoreSheetOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--ecode-surface-hover)] transition-colors touch-manipulation active:scale-98"
                  data-testid="mobile-more-problems"
                >
                  <AlertCircle className="h-5 w-5 text-status-warning" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Problems</div>
                    <div className="text-[11px] text-[var(--ecode-text-muted)]">Code diagnostics</div>
                  </div>
                </button>
                
                {/* Settings */}
                <button
                  onClick={() => {
                    onSettingsOpen?.();
                    setMoreSheetOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--ecode-surface-hover)] transition-colors touch-manipulation active:scale-98"
                  data-testid="mobile-more-settings"
                >
                  <SettingsIcon className="h-5 w-5 text-status-info" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Settings</div>
                    <div className="text-[11px] text-[var(--ecode-text-muted)]">Project settings</div>
                  </div>
                </button>
                
                {/* Share */}
                <button
                  onClick={() => {
                    onShareOpen?.();
                    setMoreSheetOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--ecode-surface-hover)] transition-colors touch-manipulation active:scale-98"
                  data-testid="mobile-more-share"
                >
                  <Share2 className="h-5 w-5 text-primary" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Share</div>
                    <div className="text-[11px] text-[var(--ecode-text-muted)]">Share project</div>
                  </div>
                </button>
                
                {/* Custom More Menu (if provided) */}
                {moreMenu && (
                  <div className="border-t border-[var(--ecode-border)] pt-2 mt-2">
                    {moreMenu}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </TabsList>
      </Tabs>
    </div>
  );
}