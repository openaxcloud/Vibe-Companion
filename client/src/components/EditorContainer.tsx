import { useState, useEffect } from "react";
import { File } from "@shared/schema";
import CodeEditor from "./CodeEditor";
import { Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorContainerProps {
  openFiles: File[];
  activeFileId: number | null;
  onFileClose: (id: number) => void;
  onFileSelect: (id: number) => void;
  onFileChange: (id: number, content: string) => void;
  onFileSave: (id: number) => void;
}

const EditorContainer = ({
  openFiles,
  activeFileId,
  onFileClose,
  onFileSelect,
  onFileChange,
  onFileSave,
}: EditorContainerProps) => {
  const [unsavedFiles, setUnsavedFiles] = useState<Record<number, boolean>>({});
  
  // Handle content changes
  const handleContentChange = (fileId: number, content: string) => {
    // Mark file as unsaved
    setUnsavedFiles(prev => ({
      ...prev,
      [fileId]: true
    }));
    
    // Notify parent component
    onFileChange(fileId, content);
  };
  
  // Handle file saving
  const handleSave = (fileId: number) => {
    // Mark file as saved
    setUnsavedFiles(prev => {
      const newState = { ...prev };
      delete newState[fileId];
      return newState;
    });
    
    // Notify parent
    onFileSave(fileId);
  };
  
  // Setup keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save with Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && activeFileId) {
        e.preventDefault();
        handleSave(activeFileId);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId]);
  
  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="border-b overflow-x-auto">
        <div className="flex">
          {openFiles.map(file => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-1 px-3 py-2 text-sm border-r cursor-pointer group",
                activeFileId === file.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
              onClick={() => onFileSelect(file.id)}
            >
              <span className="truncate max-w-[120px]">
                {file.name}
              </span>
              {unsavedFiles[file.id] && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
              <div className="flex items-center ml-1">
                {unsavedFiles[file.id] && (
                  <button
                    className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-background focus:outline-none focus:bg-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave(file.id);
                    }}
                    title="Save"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-background focus:outline-none focus:bg-background"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClose(file.id);
                  }}
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {openFiles.map(file => (
          <div
            key={file.id}
            className={cn(
              "h-full",
              activeFileId === file.id ? "block" : "hidden"
            )}
          >
            <CodeEditor
              file={file}
              onChange={(content) => handleContentChange(file.id, content)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditorContainer;