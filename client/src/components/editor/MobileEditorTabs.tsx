import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCode, Code, Terminal as TerminalIcon, Globe, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileEditorTabsProps {
  fileExplorer: React.ReactNode;
  codeEditor: React.ReactNode;
  terminal: React.ReactNode;
  preview: React.ReactNode;
  defaultTab?: string;
  className?: string;
  isRunning?: boolean;
  onRun?: () => void;
}

export function MobileEditorTabs({
  fileExplorer,
  codeEditor,
  terminal,
  preview,
  defaultTab = 'code',
  className,
  isRunning = false,
  onRun
}: MobileEditorTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [hasTerminalOutput, setHasTerminalOutput] = useState(false);
  const [hasPreviewContent, setHasPreviewContent] = useState(false);

  // Enhanced mobile tab styling
  const getTabTriggerClass = (tabValue: string) => {
    const baseClass = "flex flex-col items-center justify-center gap-1 h-full px-2 py-1 transition-all duration-200 relative";
    const isActive = activeTab === tabValue;
    
    if (isActive) {
      return cn(baseClass, 
        "bg-[var(--ecode-surface)] text-[var(--ecode-text)] border-t-2 border-[var(--ecode-accent)]",
        "shadow-sm"
      );
    }
    
    return cn(baseClass, 
      "text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-surface-hover)]",
      "border-t-2 border-transparent"
    );
  };

  const getNotificationBadge = (tabValue: string) => {
    if (tabValue === 'terminal' && hasTerminalOutput && activeTab !== 'terminal') {
      return (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      );
    }
    if (tabValue === 'preview' && hasPreviewContent && activeTab !== 'preview') {
      return (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
      );
    }
    return null;
  };

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-background)]", className)}>
      {/* Mobile Action Bar - Only show when relevant */}
      {(activeTab === 'code' || activeTab === 'terminal') && onRun && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium capitalize">{activeTab}</h3>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'code' && (
              <Button
                size="sm"
                onClick={onRun}
                disabled={isRunning}
                className="h-8 px-3 text-xs"
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
        </div>
        
        {/* Enhanced Bottom Tab Bar */}
        <TabsList className="grid w-full grid-cols-4 h-14 rounded-none border-t border-[var(--ecode-border)] bg-[var(--ecode-background)] p-0">
          <TabsTrigger 
            value="files" 
            className={getTabTriggerClass('files')}
          >
            <div className="relative">
              <FileCode className="h-4 w-4" />
              {getNotificationBadge('files')}
            </div>
            <span className="text-[10px] font-medium">Files</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="code" 
            className={getTabTriggerClass('code')}
          >
            <div className="relative">
              <Code className="h-4 w-4" />
              {getNotificationBadge('code')}
            </div>
            <span className="text-[10px] font-medium">Code</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="terminal" 
            className={getTabTriggerClass('terminal')}
          >
            <div className="relative">
              <TerminalIcon className="h-4 w-4" />
              {getNotificationBadge('terminal')}
            </div>
            <span className="text-[10px] font-medium">Terminal</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="preview" 
            className={getTabTriggerClass('preview')}
          >
            <div className="relative">
              <Globe className="h-4 w-4" />
              {getNotificationBadge('preview')}
            </div>
            <span className="text-[10px] font-medium">Preview</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}