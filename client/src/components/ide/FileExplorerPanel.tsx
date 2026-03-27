// @ts-nocheck
import { ReplitFileExplorer } from '@/components/editor/ReplitFileExplorer';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}

interface FileExplorerPanelProps {
  files: FileNode[];
  selectedFile: FileNode | null;
  onFileSelect: (file: FileNode) => void;
  onClose: () => void;
  projectId: string;
  isBootstrapping?: boolean;
}

export function FileExplorerPanel({
  files,
  selectedFile,
  onFileSelect,
  onClose,
  projectId,
  isBootstrapping = false
}: FileExplorerPanelProps) {
  // Convert string ID to number for ReplitFileExplorer
  const projectIdNum = parseInt(projectId, 10);
  const selectedFileId = selectedFile ? parseInt(selectedFile.id, 10) : undefined;
  
  return (
    <div className="h-full flex flex-col border-l border-[var(--ecode-border)]">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="font-medium text-xs text-[var(--ecode-text-muted)]">Files</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
          data-testid="button-close-explorer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      {/* File Explorer */}
      <ReplitFileExplorer
        projectId={projectIdNum}
        onFileSelect={(file) => {
          // Convert back to our FileNode format
          const fileNode: FileNode = {
            id: file.id.toString(),
            name: file.name,
            type: file.type,
            path: file.path,
            content: file.content,
            children: []
          };
          onFileSelect(fileNode);
        }}
        selectedFileId={selectedFileId}
        isBootstrapping={isBootstrapping}
      />
    </div>
  );
}
