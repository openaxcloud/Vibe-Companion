import { useState } from "react";
import { ReplitMonacoEditor } from "./ReplitMonacoEditor";
import { ReplitFileExplorer } from "../files/ReplitFileExplorer";
import { ReplitTerminal } from "../terminal/ReplitTerminal";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface FileNode {
  id: number;
  name: string;
  path: string;
  type: "file" | "folder";
  content?: string;
  language?: string;
  lastModified: Date;
  children?: FileNode[];
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
    console.log("Creating", type, "at", path);
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
    console.log("Terminal command:", command);
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* File Explorer */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
          <div className="h-full border-r border-[var(--replit-border)] bg-[var(--replit-sidebar)]">
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

        <ResizableHandle className="bg-[var(--replit-border)] hover:bg-[var(--replit-accent)]/50" />

        {/* Editor and Terminal */}
        <ResizablePanel defaultSize={80}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Monaco Editor */}
            <ResizablePanel defaultSize={showTerminal ? 65 : 100}>
              <div className="h-full bg-[var(--replit-editor-bg)]">
                {selectedFile ? (
                  <ReplitMonacoEditor
                    projectId={projectId}
                    fileId={selectedFile.id}
                    onRunCode={handleRunCode}
                    onStopCode={handleStopCode}
                    isRunning={isRunning}
                    theme="dark"
                    showCollaborators={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4 text-[var(--replit-text-secondary)]">
                        📁
                      </div>
                      <h3 className="text-lg font-medium text-[var(--replit-text)] mb-2">
                        Welcome to Your Workspace
                      </h3>
                      <p className="text-[var(--replit-text-secondary)] mb-4">
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
                <ResizableHandle className="bg-[var(--replit-border)] hover:bg-[var(--replit-accent)]/50" />
                <ResizablePanel defaultSize={35} minSize={25}>
                  <ReplitTerminal
                    projectId={projectId}
                    className="h-full"
                    onCommandExecute={handleCommandExecute}
                    theme="dark"
                    allowMultipleSessions={true}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}