import React, { useState, Suspense } from "react";
import { ReplitFileExplorer } from "../files/ReplitFileExplorer";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Loader2 } from "lucide-react";
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const ReplitMonacoEditor = instrumentedLazy(() => 
  import("./ReplitMonacoEditor").then(module => ({ default: module.ReplitMonacoEditor })), 'ReplitMonacoEditor'
);

const ReplitTerminal = instrumentedLazy(() => 
  import("../terminal/ReplitTerminal").then(module => ({ default: module.ReplitTerminal })), 'ReplitTerminal'
);

const EditorFallback = () => (
  <div className="h-full flex items-center justify-center bg-[var(--ecode-editor-bg)]">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--ecode-accent)]" />
      <p className="text-[13px] text-[var(--ecode-text-secondary)]">Loading editor...</p>
    </div>
  </div>
);

const TerminalFallback = () => (
  <div className="h-full flex items-center justify-center bg-[var(--ecode-editor-bg)]">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--ecode-accent)]" />
      <p className="text-[11px] text-[var(--ecode-text-secondary)]">Loading terminal...</p>
    </div>
  </div>
);

interface FileNode {
  id: number;
  name: string;
  path: string;
  type: "file" | "folder";
  size: number;
  lastModified: Date;
  language?: string;
  isReadOnly?: boolean;
  isHidden?: boolean;
  isStarred?: boolean;
  permissions?: "read" | "write" | "execute";
  content?: string;
  children?: FileNode[];
  parent?: FileNode;
}

interface AdvancedEditorIntegrationProps {
  projectId: number;
  className?: string;
}

export function AdvancedEditorIntegration({
  projectId,
  className = "",
}: AdvancedEditorIntegrationProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);

  const handleFileSelect = (file: FileNode) => {
    if (file.type === "file") {
      setSelectedFile(file);
    }
  };

  const handleFileCreate = (path: string, type: "file" | "folder") => {
  };

  const handleRunCode = () => {
    setIsRunning(true);
    setShowTerminal(true);
    
    // Simulate execution
    setTimeout(() => {
      setIsRunning(false);
    }, 3000);
  };

  const handleStopCode = () => {
    setIsRunning(false);
  };

  const handleCommandExecute = (command: string) => {
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* File Explorer */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
          <div className="h-full border-r border-[var(--ecode-border)] bg-[var(--ecode-sidebar)]">
            <ReplitFileExplorer
              projectId={projectId}
              onFileSelect={handleFileSelect}
              onFileCreate={handleFileCreate}
              selectedFile={selectedFile}
              className="h-full"
              showHidden={false}
              readonly={false}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-[var(--ecode-border)] hover:bg-[var(--ecode-accent)]/50" />

        {/* Editor and Terminal */}
        <ResizablePanel defaultSize={80}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Monaco Editor */}
            <ResizablePanel defaultSize={showTerminal ? 65 : 100}>
              <div className="h-full bg-[var(--ecode-editor-bg)]">
                {selectedFile ? (
                  <Suspense fallback={<EditorFallback />}>
                    <ReplitMonacoEditor
                      projectId={projectId}
                      fileId={selectedFile.id}
                      onRunCode={handleRunCode}
                      onStopCode={handleStopCode}
                      isRunning={isRunning}
                      theme="dark"
                      showCollaborators={true}
                    />
                  </Suspense>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4 text-[var(--ecode-text-secondary)]">
                        📁
                      </div>
                      <h3 className="text-[15px] font-medium text-[var(--ecode-text)] mb-2">
                        Welcome to Your Workspace
                      </h3>
                      <p className="text-[var(--ecode-text-secondary)] mb-4">
                        Select a file from the sidebar to start coding
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>

            {/* Terminal */}
            {showTerminal && (
              <>
                <ResizableHandle className="bg-[var(--ecode-border)] hover:bg-[var(--ecode-accent)]/50" />
                <ResizablePanel defaultSize={35} minSize={25}>
                  <Suspense fallback={<TerminalFallback />}>
                    <ReplitTerminal
                      projectId={projectId}
                      className="h-full"
                      onCommandExecute={handleCommandExecute}
                      theme="dark"
                      allowMultipleSessions={true}
                    />
                  </Suspense>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}