/**
 * Inline Mobile File Explorer for Files Tab
 * Shows file tree directly in the Files tab content (not as overlay)
 * Matches Replit's mobile Files tab behavior
 */

import { useState, useCallback } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyMotionSpan, LazyAnimatePresence } from '@/lib/motion';
import { 
  Folder, FolderOpen, File, FileText, FileCode, Image, 
  ChevronRight, ChevronDown, Plus, FolderPlus, FilePlus,
  MoreVertical, Search, RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReducedMotion, SPRING_CONFIG, getReducedMotionTransition } from '@/hooks/use-reduced-motion';
import { VirtualFileTree } from './VirtualFileTree';

interface FileItem {
  id: number;
  name: string;
  type: 'file' | 'folder';
  path: string;
  parentId: number | null;
  children?: FileItem[];
  extension?: string;
}

interface InlineMobileFileExplorerProps {
  projectId: string | number;
  selectedFileId?: number;
  onFileSelect?: (file: FileItem) => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  className?: string;
}

function getFileIcon(extension?: string) {
  if (!extension) return FileText;
  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'py', 'go', 'rs', 'md'];
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  
  if (codeExtensions.includes(extension.toLowerCase())) return FileCode;
  if (imageExtensions.includes(extension.toLowerCase())) return Image;
  return FileText;
}

function FileTreeSkeleton() {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className="space-y-2 p-4" data-testid="file-tree-skeleton">
      {[...Array(8)].map((_, i) => (
        <LazyMotionDiv 
          key={i} 
          className="flex items-center gap-3" 
          style={{ paddingLeft: `${(i % 3) * 16}px` }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={prefersReducedMotion ? { duration: 0.01 } : { delay: i * 0.05 }}
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1 rounded" style={{ maxWidth: `${120 + (i * 20) % 80}px` }} />
        </LazyMotionDiv>
      ))}
    </div>
  );
}

function NoFilesEmptyState({ onCreateFile }: { onCreateFile?: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <LazyMotionDiv 
      className="flex flex-col items-center justify-center h-64 p-6 text-center"
      data-testid="no-files-empty-state"
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={getReducedMotionTransition(prefersReducedMotion, SPRING_CONFIG.default)}
    >
      <div className="w-16 h-16 rounded-full bg-[var(--ecode-surface-hover)] flex items-center justify-center mb-4">
        <Folder className="h-8 w-8 text-[var(--ecode-text-muted)]" />
      </div>
      <h3 className="text-[15px] font-semibold mb-2 text-[var(--ecode-text)]">No files yet</h3>
      <p className="text-[13px] text-[var(--ecode-text-muted)] mb-4">
        Create your first file to get started
      </p>
      {onCreateFile && (
        <Button 
          onClick={onCreateFile}
          className="min-h-[44px] touch-manipulation bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)]"
          data-testid="button-create-first-file"
        >
          <FilePlus className="h-4 w-4 mr-2" />
          Create File
        </Button>
      )}
    </LazyMotionDiv>
  );
}

function FileTreeItem({ 
  file, 
  depth = 0, 
  selectedFileId,
  expandedFolders,
  onToggleFolder,
  onFileSelect 
}: { 
  file: FileItem; 
  depth?: number;
  selectedFileId?: number;
  expandedFolders: Set<number>;
  onToggleFolder: (id: number) => void;
  onFileSelect?: (file: FileItem) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const isFolder = file.type === 'folder';
  const isExpanded = expandedFolders.has(file.id);
  const isSelected = file.id === selectedFileId;
  const FileIcon = isFolder 
    ? (isExpanded ? FolderOpen : Folder) 
    : getFileIcon(file.extension);

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(file.id);
    } else {
      onFileSelect?.(file);
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  };

  return (
    <>
      <LazyMotionButton
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 py-2.5 px-3 text-left",
          "min-h-[44px] touch-manipulation rounded-lg",
          "transition-colors duration-150",
          isSelected 
            ? "bg-[var(--ecode-accent)]/15 text-[var(--ecode-accent)]" 
            : "hover:bg-[var(--ecode-surface-hover)] text-[var(--ecode-text)]",
          "active:bg-[var(--ecode-surface-hover)]"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        data-testid={`file-item-${file.name}`}
      >
        {isFolder && (
          <LazyMotionSpan
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.2 }}
          >
            <ChevronRight className="h-4 w-4 text-[var(--ecode-text-muted)]" />
          </LazyMotionSpan>
        )}
        <FileIcon className={cn(
          "h-4 w-4 flex-shrink-0",
          isFolder ? "text-[var(--ecode-accent)]" : "text-[var(--ecode-text-muted)]"
        )} />
        <span className="truncate text-[13px] font-medium">{file.name}</span>
      </LazyMotionButton>

      {isFolder && file.children && file.children.length > 0 && (
        <div className={cn("collapsible-content", isExpanded && "expanded")}>
          <div>
            {file.children.map(child => (
              <FileTreeItem
                key={child.id}
                file={child}
                depth={depth + 1}
                selectedFileId={selectedFileId}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function InlineMobileFileExplorer({
  projectId,
  selectedFileId,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  className,
}: InlineMobileFileExplorerProps) {
  const prefersReducedMotion = useReducedMotion();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const { data: files, isLoading, refetch } = useQuery<FileItem[]>({
    queryKey: [`/api/projects/${projectId}/files`],
  });

  const handleToggleFolder = useCallback((folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const filteredFiles = files?.filter(file => 
    !searchQuery || file.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const buildTree = (items: FileItem[], parentId: number | null = null): FileItem[] => {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: item.type === 'folder' ? buildTree(items, item.id) : undefined
      }))
      .sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
  };

  const fileTree = buildTree(filteredFiles);

  // Use VirtualFileTree for large file lists (50+ files) for performance
  const useVirtualTree = (files?.length || 0) > 50;

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-background)]", className)}>
      <div className="flex items-center gap-2 p-3 border-b border-[var(--ecode-border)]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ecode-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="pl-9 h-10 bg-[var(--ecode-surface)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
            data-testid="input-search-files"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 touch-manipulation"
              data-testid="button-file-actions"
            >
              <Plus className="h-5 w-5 text-[var(--ecode-accent)]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onCreateFile} className="min-h-[44px]">
              <FilePlus className="h-4 w-4 mr-2" />
              New File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateFolder} className="min-h-[44px]">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => refetch()} className="min-h-[44px]">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <FileTreeSkeleton />
        ) : fileTree.length === 0 ? (
          <NoFilesEmptyState onCreateFile={onCreateFile} />
        ) : useVirtualTree ? (
          <VirtualFileTree
            files={fileTree}
            onFileSelect={onFileSelect}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
            currentFileId={selectedFileId}
            className="h-full"
          />
        ) : (
          <LazyMotionDiv
            className="py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={getReducedMotionTransition(prefersReducedMotion, SPRING_CONFIG.default)}
          >
            {fileTree.map(file => (
              <FileTreeItem
                key={file.id}
                file={file}
                selectedFileId={selectedFileId}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                onFileSelect={onFileSelect}
              />
            ))}
          </LazyMotionDiv>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-[var(--ecode-border)] text-[11px] text-[var(--ecode-text-muted)] text-center">
        {files?.length || 0} files • Tap a file to edit
      </div>
    </div>
  );
}
