/**
 * Enhanced Mobile File Explorer with Real File Operations
 * 
 * Fortune 500 Quality Implementation:
 * - ✅ Context menus with working Rename/Duplicate/Delete
 * - ✅ Empty state detection from actual file list
 * - ✅ Loading skeleton with smooth animations
 * - ✅ Toast notifications for all actions
 * - ✅ Haptic feedback on interactions
 * - ✅ Full parity with Replit mobile file explorer
 */

import { useState, useCallback, useEffect } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { 
  Folder, File, FileText, FileCode, Image, MoreVertical,
  Edit2, Copy, Trash2, FolderPlus, FilePlus, X, Loader2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface FileItem {
  id: number;
  name: string;
  type: 'file' | 'folder';
  path: string;
  parentId: number | null;
  content?: string;
  size?: number;
  lastModified?: Date;
  children?: FileItem[];
  extension?: string;
}

interface EnhancedMobileFileExplorerProps {
  projectId: string | number;
  selectedFileId?: number;
  isOpen: boolean;
  onClose: () => void;
  onFileSelect?: (file: FileItem) => void;
  className?: string;
}

function getFileIcon(extension?: string) {
  if (!extension) return FileText;
  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'py', 'go', 'rs'];
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  
  if (codeExtensions.includes(extension.toLowerCase())) return FileCode;
  if (imageExtensions.includes(extension.toLowerCase())) return Image;
  return FileText;
}

function FileTreeSkeleton() {
  return (
    <div className="space-y-2 p-4" data-testid="file-tree-skeleton">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1 rounded" style={{ maxWidth: `${120 + (i * 20) % 80}px` }} />
        </div>
      ))}
    </div>
  );
}

function NoFilesEmptyState({ onCreateFile }: { onCreateFile: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 p-6 text-center" data-testid="no-files-empty-state">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Folder className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-[15px] font-semibold mb-2">No files yet</h3>
      <p className="text-[13px] text-muted-foreground mb-4">
        Create your first file to get started
      </p>
      <Button 
        onClick={onCreateFile}
        className="min-h-[44px] touch-manipulation"
        data-testid="button-create-first-file"
      >
        <FilePlus className="h-4 w-4 mr-2" />
        Create File
      </Button>
    </div>
  );
}

export function EnhancedMobileFileExplorer({
  projectId,
  selectedFileId,
  isOpen,
  onClose,
  onFileSelect,
  className,
}: EnhancedMobileFileExplorerProps) {
  const { toast } = useToast();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [renameDialog, setRenameDialog] = useState<{ file: FileItem; newName: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<FileItem | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{ type: 'file' | 'folder'; name: string; parentId: number | null } | null>(null);
  const [contextMenuFile, setContextMenuFile] = useState<FileItem | null>(null);

  // Fetch files from API - use template literal as queryKey[0] for default fetcher
  const { data: files = [], isLoading, refetch } = useQuery<FileItem[]>({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId && isOpen,
  });

  // Dynamic hasFiles detection from actual file list
  const hasFiles = files.length > 0;

  // Haptic feedback helper
  const haptic = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest('PATCH', `/api/files/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: 'Renamed', description: 'File renamed successfully' });
      setRenameDialog(null);
      haptic();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to rename', variant: 'destructive' });
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (file: FileItem) => {
      const newName = `${file.name.replace(/\.[^.]+$/, '')} (copy)${file.extension ? `.${file.extension}` : ''}`;
      return apiRequest('POST', `/api/files/${projectId}`, {
        name: newName,
        isFolder: file.type === 'folder',
        parentId: file.parentId,
        content: file.content || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: 'Duplicated', description: 'File duplicated successfully' });
      haptic();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to duplicate', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: 'Deleted', description: 'File deleted successfully' });
      setDeleteDialog(null);
      haptic([10, 10, 10]);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  // Create file/folder mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; isFolder: boolean; parentId: number | null }) => {
      return apiRequest('POST', `/api/files/${projectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ 
        title: 'Created', 
        description: `${newItemDialog?.type === 'folder' ? 'Folder' : 'File'} created successfully` 
      });
      setNewItemDialog(null);
      haptic();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create', variant: 'destructive' });
    },
  });

  // Build file tree from flat list
  const buildFileTree = useCallback((items: FileItem[]): FileItem[] => {
    const map = new Map<number, FileItem>();
    const roots: FileItem[] = [];

    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parentId === null) {
        roots.push(node);
      } else {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    // Sort: folders first, then alphabetically
    const sortItems = (items: FileItem[]): FileItem[] => {
      return items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }).map(item => ({
        ...item,
        children: item.children ? sortItems(item.children) : undefined,
      }));
    };

    return sortItems(roots);
  }, []);

  const fileTree = buildFileTree(files);

  const toggleFolder = (id: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    haptic(5);
  };

  const handleFileSelect = (file: FileItem) => {
    if (file.type === 'folder') {
      toggleFolder(file.id);
    } else {
      onFileSelect?.(file);
      onClose();
      haptic();
    }
  };

  const handleRename = () => {
    if (!renameDialog) return;
    const { file, newName } = renameDialog;
    if (newName.trim() && newName !== file.name) {
      renameMutation.mutate({ id: file.id, name: newName.trim() });
    } else {
      setRenameDialog(null);
    }
  };

  const handleDuplicate = (file: FileItem) => {
    duplicateMutation.mutate(file);
  };

  const handleDelete = () => {
    if (deleteDialog) {
      deleteMutation.mutate(deleteDialog.id);
    }
  };

  const handleCreate = () => {
    if (!newItemDialog || !newItemDialog.name.trim()) return;
    createMutation.mutate({
      name: newItemDialog.name.trim(),
      isFolder: newItemDialog.type === 'folder',
      parentId: newItemDialog.parentId,
    });
  };

  const openNewFileDialog = (parentId: number | null = null) => {
    setNewItemDialog({ type: 'file', name: '', parentId });
    haptic();
  };

  const openNewFolderDialog = (parentId: number | null = null) => {
    setNewItemDialog({ type: 'folder', name: '', parentId });
    haptic();
  };

  // Render file tree item
  const renderFileItem = (item: FileItem, level: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const isSelected = item.id === selectedFileId;
    const Icon = item.type === 'folder' ? Folder : getFileIcon(item.extension);

    return (
      <div key={item.id} data-testid={`file-item-${item.id}`}>
        <LazyMotionDiv
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors touch-manipulation',
            'active:scale-[0.98] active:bg-surface-tertiary-solid',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-tertiary-solid'
          )}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => handleFileSelect(item)}
          data-testid={`button-file-${item.id}`}
        >
          <Icon className={cn(
            'h-4 w-4 flex-shrink-0',
            item.type === 'folder' ? 'text-amber-500' : 'text-muted-foreground'
          )} />
          
          <span className="flex-1 truncate text-[13px]">{item.name}</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  haptic(5);
                }}
                data-testid={`button-file-menu-${item.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameDialog({ file: item, newName: item.name });
                  haptic();
                }}
                data-testid={`menu-rename-${item.id}`}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate(item);
                }}
                data-testid={`menu-duplicate-${item.id}`}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              {item.type === 'folder' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openNewFileDialog(item.id);
                    }}
                    data-testid={`menu-new-file-${item.id}`}
                  >
                    <FilePlus className="h-4 w-4 mr-2" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openNewFolderDialog(item.id);
                    }}
                    data-testid={`menu-new-folder-${item.id}`}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialog(item);
                  haptic();
                }}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-delete-${item.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </LazyMotionDiv>

        {/* Render children if folder is expanded */}
        {item.type === 'folder' && item.children && (
          <div className={cn("collapsible-content", isExpanded && "expanded")}>
            <div>
              {item.children.map(child => renderFileItem(child, level + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="left" className={cn('w-[85vw] max-w-sm p-0', className)}>
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>Files</SheetTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openNewFileDialog()}
                  className="h-9 w-9 p-0"
                  data-testid="button-new-file"
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openNewFolderDialog()}
                  className="h-9 w-9 p-0"
                  data-testid="button-new-folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)]">
            {isLoading ? (
              <FileTreeSkeleton />
            ) : !hasFiles ? (
              <NoFilesEmptyState onCreateFile={() => openNewFileDialog()} />
            ) : (
              <div className="py-2">
                {fileTree.map(item => renderFileItem(item))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameDialog?.file.type}</DialogTitle>
            <DialogDescription>
              Enter a new name for "{renameDialog?.file.name}"
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameDialog?.newName || ''}
            onChange={(e) => setRenameDialog(prev => prev ? { ...prev, newName: e.target.value } : null)}
            placeholder="New name"
            className="min-h-[44px]"
            autoFocus
            data-testid="input-rename"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)} data-testid="button-cancel-rename">
              Cancel
            </Button>
            <Button 
              onClick={handleRename} 
              disabled={renameMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteDialog?.type}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New File/Folder Dialog */}
      <Dialog open={!!newItemDialog} onOpenChange={(open) => !open && setNewItemDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create new {newItemDialog?.type}
            </DialogTitle>
            <DialogDescription>
              Enter a name for the new {newItemDialog?.type}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newItemDialog?.name || ''}
            onChange={(e) => setNewItemDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
            placeholder={newItemDialog?.type === 'folder' ? 'Folder name' : 'file.ts'}
            className="min-h-[44px]"
            autoFocus
            data-testid="input-new-item-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewItemDialog(null)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={createMutation.isPending || !newItemDialog?.name.trim()}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EnhancedMobileFileExplorer;
