import { useState, useEffect, useRef } from 'react';
import { 
  X, Search, Folder, File, ChevronRight, ChevronDown, Plus,
  FileText, FileCode, Image, Film, Music, Archive, Database,
  Edit2, Trash2, Copy, FolderPlus, RefreshCw, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePullToRefresh } from '@/hooks/use-mobile-gestures';
import { VirtualFileTree } from './VirtualFileTree';
import { useFileBrowserPersistence } from '@/hooks/use-mobile-persistence';
import { FileExplorerSkeleton } from './MobileLoadingSkeleton';
import { NoFilesEmptyState, NoSearchResultsEmptyState } from './MobileEmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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
  isHidden?: boolean;
}

interface MobileFileExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | number;
  onFileSelect?: (file: FileItem) => void;
  currentFileId?: number;
}

function getFileIcon(extension?: string) {
  if (!extension) return FileText;
  
  const iconMap: Record<string, React.ElementType> = {
    'js': FileCode,
    'jsx': FileCode,
    'ts': FileCode,
    'tsx': FileCode,
    'css': FileCode,
    'html': FileCode,
    'json': FileCode,
    'md': FileText,
    'txt': FileText,
    'png': Image,
    'jpg': Image,
    'jpeg': Image,
    'gif': Image,
    'svg': Image,
    'mp4': Film,
    'avi': Film,
    'mov': Film,
    'mp3': Music,
    'wav': Music,
    'zip': Archive,
    'rar': Archive,
    'tar': Archive,
    'db': Database,
    'sql': Database,
  };
  
  return iconMap[extension.toLowerCase()] || FileText;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(date?: Date): string {
  if (!date) return '';
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 7) return `${days} days ago`;
  return new Date(date).toLocaleDateString();
}

function FileTreeItem({ 
  item, 
  level = 0, 
  onSelect,
  currentFileId,
  onLongPress 
}: { 
  item: FileItem;
  level?: number;
  onSelect: (item: FileItem) => void;
  currentFileId?: number;
  onLongPress?: (item: FileItem) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const isActive = currentFileId === item.id;
  const extension = item.name.includes('.') ? item.name.split('.').pop() : undefined;
  const Icon = item.type === 'folder' ? Folder : getFileIcon(extension);
  
  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      onLongPress?.(item);
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 500);
    setLongPressTimer(timer);
  };
  
  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  const handleClick = () => {
    if (item.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(item);
    }
  };
  
  return (
    <>
      <div
        className={cn(
          'flex items-center px-3 py-3 mobile-touch-target cursor-pointer',
          'hover:bg-[var(--ecode-surface-hover)] active:bg-[var(--ecode-surface-hover)]',
          'active:scale-98 transition-transform duration-100',
          isActive && 'bg-surface-tertiary-solid border-l-2 border-[var(--ecode-accent)]'
        )}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {item.type === 'folder' && (
          <div
            className={cn(
              "mr-1 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        
        <Icon className={cn(
          'h-4 w-4 mr-2',
          item.type === 'folder' 
            ? 'text-amber-500' 
            : 'text-muted-foreground'
        )} />
        
        <span className={cn(
          'flex-1 text-[13px] truncate',
          isActive && 'font-medium text-[var(--ecode-accent)]'
        )}>
          {item.name}
        </span>
        
        {item.type === 'file' && item.size && (
          <span className="text-[11px] text-muted-foreground">
            {formatFileSize(item.size)}
          </span>
        )}
      </div>
      
      {item.type === 'folder' && item.children && (
        <div
          className={cn(
            "folder-content-enter",
            isExpanded && "expanded"
          )}
        >
          {item.children.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              currentFileId={currentFileId}
              onLongPress={onLongPress}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function MobileFileExplorer({
  isOpen,
  onClose,
  projectId,
  onFileSelect,
  currentFileId
}: MobileFileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ file: FileItem; newName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{ type: 'file' | 'folder'; name: string } | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const { expandedFolders, setExpandedFolders } = useFileBrowserPersistence(projectId);
  
  const { toast } = useToast();
  
  const { data: files = [], isLoading, refetch } = useQuery<FileItem[]>({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId && isOpen,
  });
  
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
      if ('vibrate' in navigator) {
        navigator.vibrate([10, 10, 10]);
      }
    },
    threshold: 80,
    enabled: isOpen && !isLoading,
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; isDirectory: boolean; parentId: number | null }) => {
      const path = data.name;
      return apiRequest('POST', `/api/projects/${projectId}/files`, {
        name: data.name,
        path: path,
        isDirectory: data.isDirectory,
        content: data.isDirectory ? '' : '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      const itemType = newItemDialog?.type === 'folder' ? 'Dossier' : 'Fichier';
      toast({ 
        title: 'Succès', 
        description: `${itemType} créé avec succès` 
      });
      setNewItemDialog(null);
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Échec de la création';
      toast({ title: 'Erreur', description: errorMessage, variant: 'destructive' });
    },
  });
  
  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) =>
      apiRequest('PATCH', `/api/files/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      const itemType = renameDialog?.file.type === 'folder' ? 'Dossier' : 'Fichier';
      toast({ title: 'Succès', description: `${itemType} renommé avec succès` });
      setRenameDialog(null);
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Échec du renommage';
      toast({ title: 'Erreur', description: errorMessage, variant: 'destructive' });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest('DELETE', `/api/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      const itemType = deleteConfirm?.type === 'folder' ? 'Dossier' : 'Fichier';
      toast({ title: 'Succès', description: `${itemType} supprimé avec succès` });
      setDeleteConfirm(null);
      setShowContextMenu(false);
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Échec de la suppression';
      toast({ title: 'Erreur', description: errorMessage, variant: 'destructive' });
    },
  });
  
  const duplicateMutation = useMutation({
    mutationFn: async (file: FileItem) =>
      apiRequest('POST', `/api/projects/${projectId}/files`, {
        name: `${file.name} (copie)`,
        path: `${file.name} (copie)`,
        isDirectory: file.type === 'folder',
        content: file.content || '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: 'Succès', description: 'Fichier dupliqué avec succès' });
      setShowContextMenu(false);
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Échec de la duplication';
      toast({ title: 'Erreur', description: errorMessage, variant: 'destructive' });
    },
  });
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    if (deltaX < 0) {
      setSwipeX(Math.max(deltaX, -100));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX < -50) {
      onClose();
    }
    setSwipeX(0);
    touchStartRef.current = null;
  };
  
  const handleLongPress = (item: FileItem) => {
    setSelectedItem(item);
    setShowContextMenu(true);
  };
  
  const handleFileSelect = (file: FileItem) => {
    if (file.type === 'file') {
      onFileSelect?.(file);
      onClose();
    }
  };
  
  const handleToggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };
  
  const filterFiles = (items: FileItem[], query: string): FileItem[] => {
    if (!query) return items;
    
    return items.reduce((acc: FileItem[], item) => {
      if (item.name.toLowerCase().includes(query.toLowerCase())) {
        acc.push(item);
      } else if (item.children) {
        const filteredChildren = filterFiles(item.children, query);
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  };
  
  const filteredFiles = filterFiles(files, searchQuery);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      <div
        className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-background z-50 shadow-2xl flex flex-col animate-slide-from-left"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
          <h2 className="text-[15px] font-semibold text-foreground">Fichiers</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 touch-manipulation active:scale-95 transition-transform"
            data-testid="mobile-file-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="px-4 py-2 border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-[13px] touch-manipulation"
              data-testid="mobile-file-search"
            />
          </div>
        </div>
        
        <div className="flex gap-2 px-4 py-2 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 touch-manipulation active:scale-95 transition-transform"
            onClick={() => setNewItemDialog({ type: 'file', name: '' })}
            disabled={createMutation.isPending}
            data-testid="mobile-file-new-file-btn"
          >
            {createMutation.isPending && newItemDialog?.type === 'file' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            Nouveau fichier
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 touch-manipulation active:scale-95 transition-transform"
            onClick={() => setNewItemDialog({ type: 'folder', name: '' })}
            disabled={createMutation.isPending}
            data-testid="mobile-file-new-folder-btn"
          >
            {createMutation.isPending && newItemDialog?.type === 'folder' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <FolderPlus className="h-3 w-3 mr-1" />
            )}
            Nouveau dossier
          </Button>
        </div>
        
        <div className="flex-1 relative overflow-hidden">
          {pullDistance > 0 && (
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none transition-all duration-150"
              style={{ 
                height: `${Math.min(pullDistance, 80)}px`,
                opacity: pullDistance > 20 ? 1 : pullDistance / 20,
                paddingTop: `${Math.min(pullDistance * 0.3, 24)}px`
              }}
              data-testid="mobile-file-pull-refresh"
            >
              <RefreshCw 
                className={cn(
                  'h-5 w-5 text-[var(--ecode-accent)]',
                  isRefreshing && 'animate-spin'
                )} 
              />
            </div>
          )}

          {isLoading ? (
            <div data-testid="mobile-file-loading">
              <FileExplorerSkeleton className="h-full" />
            </div>
          ) : filteredFiles.length > 0 ? (
            <div 
              className="h-full transition-transform duration-150" 
              style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)` }}
            >
              <VirtualFileTree
                files={filteredFiles}
                onFileSelect={handleFileSelect}
                onLongPress={handleLongPress}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                currentFileId={currentFileId}
                className="h-full"
              />
            </div>
          ) : searchQuery ? (
            <NoSearchResultsEmptyState
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
              className="h-full"
            />
          ) : (
            <NoFilesEmptyState
              onCreateFile={() => setNewItemDialog({ type: 'file', name: '' })}
              onCreateFolder={() => setNewItemDialog({ type: 'folder', name: '' })}
              className="h-full"
            />
          )}
        </div>
        
        {showContextMenu && selectedItem && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4 rounded-t-2xl shadow-2xl mobile-safe-bottom animate-slide-up-menu"
            data-testid="mobile-file-context-menu"
          >
            <div className="mb-3">
              <p className="text-[13px] font-medium text-foreground">{selectedItem.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {selectedItem.type === 'folder' ? 'Dossier' : `Fichier${selectedItem.size ? ` · ${formatFileSize(selectedItem.size)}` : ''}`}
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start touch-manipulation active:scale-98 transition-transform" 
                size="sm"
                onClick={() => {
                  setRenameDialog({ file: selectedItem, newName: selectedItem.name });
                  setShowContextMenu(false);
                }}
                data-testid="mobile-file-action-rename"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Renommer
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start touch-manipulation active:scale-98 transition-transform" 
                size="sm"
                onClick={() => duplicateMutation.mutate(selectedItem)}
                disabled={duplicateMutation.isPending}
                data-testid="mobile-file-action-duplicate"
              >
                {duplicateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Dupliquer
              </Button>
              <Button 
                variant="destructive" 
                className="w-full justify-start touch-manipulation active:scale-98 transition-transform" 
                size="sm"
                onClick={() => {
                  setDeleteConfirm(selectedItem);
                  setShowContextMenu(false);
                }}
                data-testid="mobile-file-action-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <Button
                variant="ghost"
                className="w-full touch-manipulation text-muted-foreground active:scale-98 transition-transform"
                size="sm"
                onClick={() => setShowContextMenu(false)}
                data-testid="mobile-file-action-cancel"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
        
        <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
          <DialogContent className="max-w-[90%] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Renommer {renameDialog?.file.type === 'folder' ? 'le dossier' : 'le fichier'}
              </DialogTitle>
              <DialogDescription>
                Entrez le nouveau nom pour "{renameDialog?.file.name}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rename-input" className="sr-only">Nouveau nom</Label>
              <Input
                id="rename-input"
                value={renameDialog?.newName || ''}
                onChange={(e) => setRenameDialog(prev => prev ? { ...prev, newName: e.target.value } : null)}
                placeholder="Nouveau nom"
                className="touch-manipulation"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameDialog?.newName.trim()) {
                    renameMutation.mutate({ id: renameDialog.file.id, name: renameDialog.newName.trim() });
                  }
                }}
                data-testid="mobile-file-rename-input"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setRenameDialog(null)}
                className="touch-manipulation"
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (renameDialog?.newName.trim()) {
                    renameMutation.mutate({ id: renameDialog.file.id, name: renameDialog.newName.trim() });
                  }
                }}
                disabled={!renameDialog?.newName.trim() || renameMutation.isPending}
                className="touch-manipulation"
                data-testid="mobile-file-rename-confirm"
              >
                {renameMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Renommer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent className="max-w-[90%] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Supprimer {deleteConfirm?.type === 'folder' ? 'le dossier' : 'le fichier'}
              </DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer "{deleteConfirm?.name}" ? Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="touch-manipulation"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirm) {
                    deleteMutation.mutate(deleteConfirm.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="touch-manipulation"
                data-testid="mobile-file-delete-confirm"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={!!newItemDialog} onOpenChange={(open) => !open && setNewItemDialog(null)}>
          <DialogContent className="max-w-[90%] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Créer un {newItemDialog?.type === 'folder' ? 'dossier' : 'fichier'}
              </DialogTitle>
              <DialogDescription>
                Entrez le nom du nouveau {newItemDialog?.type === 'folder' ? 'dossier' : 'fichier'}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="new-item-input" className="sr-only">Nom</Label>
              <Input
                id="new-item-input"
                value={newItemDialog?.name || ''}
                onChange={(e) => setNewItemDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder={newItemDialog?.type === 'folder' ? 'Nom du dossier' : 'Nom du fichier'}
                className="touch-manipulation"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemDialog?.name.trim()) {
                    createMutation.mutate({
                      name: newItemDialog.name.trim(),
                      isDirectory: newItemDialog.type === 'folder',
                      parentId: null,
                    });
                  }
                }}
                data-testid="mobile-file-new-item-input"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setNewItemDialog(null)}
                className="touch-manipulation"
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (newItemDialog?.name.trim()) {
                    createMutation.mutate({
                      name: newItemDialog.name.trim(),
                      isDirectory: newItemDialog.type === 'folder',
                      parentId: null,
                    });
                  }
                }}
                disabled={!newItemDialog?.name.trim() || createMutation.isPending}
                className="touch-manipulation"
                data-testid="mobile-file-new-item-confirm"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
