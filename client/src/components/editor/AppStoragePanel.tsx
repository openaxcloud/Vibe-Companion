import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  HardDrive,
  Upload,
  FolderPlus,
  File,
  Folder,
  FolderOpen,
  Image,
  FileText,
  FileCode,
  FileVideo,
  FileAudio,
  Download,
  Trash2,
  Copy,
  Link,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  contentType?: string;
  lastModified?: string;
  children?: TreeNode[];
}

interface StorageStats {
  totalSize: number;
  totalSizeFormatted: string;
  fileCount: number;
  maxStorage: number;
  maxStorageFormatted: string;
  usagePercent: number;
}

interface StorageResponse {
  files: TreeNode[];
  stats: StorageStats;
}

interface AppStoragePanelProps {
  projectId: string | number;
  className?: string;
}

function getFileIcon(contentType?: string, name?: string) {
  if (!contentType && name) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-purple-500" />;
    }
    if (['mp4', 'webm', 'mov'].includes(ext || '')) {
      return <FileVideo className="w-4 h-4 text-red-500" />;
    }
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) {
      return <FileAudio className="w-4 h-4 text-yellow-500" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-blue-500" />;
    }
    if (['txt', 'md', 'pdf'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-gray-500" />;
    }
  }
  
  if (contentType?.startsWith('image/')) {
    return <Image className="w-4 h-4 text-purple-500" />;
  }
  if (contentType?.startsWith('video/')) {
    return <FileVideo className="w-4 h-4 text-red-500" />;
  }
  if (contentType?.startsWith('audio/')) {
    return <FileAudio className="w-4 h-4 text-yellow-500" />;
  }
  if (contentType?.includes('javascript') || contentType?.includes('json')) {
    return <FileCode className="w-4 h-4 text-blue-500" />;
  }
  if (contentType?.includes('text')) {
    return <FileText className="w-4 h-4 text-gray-500" />;
  }
  
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImageFile(contentType?: string, name?: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  const ext = name?.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
}

interface FileTreeItemProps {
  node: TreeNode;
  projectId: string | number;
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  onDownload: (path: string, name: string) => void;
  onDelete: (path: string) => void;
  onCopyUrl: (path: string) => void;
}

function FileTreeItem({
  node,
  projectId,
  depth,
  expandedFolders,
  toggleFolder,
  selectedFile,
  setSelectedFile,
  onDownload,
  onDelete,
  onCopyUrl,
}: FileTreeItemProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile === node.path;
  const isImage = node.type === 'file' && isImageFile(node.contentType, node.name);

  if (node.name === '.placeholder') return null;

  const handleClick = () => {
    if (node.type === 'folder') {
      toggleFolder(node.path);
    } else {
      setSelectedFile(node.path);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-accent/50 transition-colors",
              isSelected && "bg-accent"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={handleClick}
            data-testid={`storage-item-${node.path}`}
          >
            {node.type === 'folder' ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-yellow-500 shrink-0" />
                )}
              </>
            ) : (
              <>
                <span className="w-4" />
                {getFileIcon(node.contentType, node.name)}
              </>
            )}
            <span className="text-[13px] truncate flex-1" data-testid={`text-filename-${node.name}`}>
              {node.name}
            </span>
            {node.type === 'file' && node.size && (
              <span className="text-[11px] text-muted-foreground shrink-0">
                {formatSize(node.size)}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        {node.type === 'file' && (
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onDownload(node.path, node.name)} data-testid={`menu-download-${node.name}`}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopyUrl(node.path)} data-testid={`menu-copy-url-${node.name}`}>
              <Link className="w-4 h-4 mr-2" />
              Copy URL
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => onDelete(node.path)} 
              className="text-destructive"
              data-testid={`menu-delete-${node.name}`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              projectId={projectId}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              onDownload={onDownload}
              onDelete={onDelete}
              onCopyUrl={onCopyUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AppStoragePanel({ projectId, className }: AppStoragePanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const { toast } = useToast();

  const queryKey = ['/api/projects', projectId, 'storage'];

  const { data: storageData, isLoading, error, refetch } = useQuery<StorageResponse>({
    queryKey,
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/projects/${projectId}/storage`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch storage');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/projects/${projectId}/storage/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'storage'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest('POST', `/api/projects/${projectId}/storage/folder`, { name });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Folder created' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'storage'] });
      setShowNewFolderDialog(false);
      setNewFolderName('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create folder',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (path: string) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/storage/${encodeURIComponent(path)}`);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'File deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'storage'] });
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploadingFiles(prev => [...prev, file.name]);
      try {
        await uploadMutation.mutateAsync(file);
        toast({ title: 'Success', description: `Uploaded ${file.name}` });
      } finally {
        setUploadingFiles(prev => prev.filter(f => f !== file.name));
      }
    }
  }, [uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleDownload = useCallback((path: string, name: string) => {
    const url = `/api/projects/${projectId}/storage/${encodeURIComponent(path)}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [projectId]);

  const handleDelete = useCallback((path: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      deleteMutation.mutate(path);
    }
  }, [deleteMutation]);

  const handleCopyUrl = useCallback(async (path: string) => {
    const url = `${window.location.origin}/api/projects/${projectId}/storage/${encodeURIComponent(path)}/download`;
    await navigator.clipboard.writeText(url);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
    toast({ title: 'Copied', description: 'URL copied to clipboard' });
  }, [projectId, toast]);

  const selectedFileData = useMemo(() => {
    if (!selectedFile || !storageData?.files) return null;
    
    const findFile = (nodes: TreeNode[], path: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findFile(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findFile(storageData.files, selectedFile);
  }, [selectedFile, storageData?.files]);

  if (!projectId) {
    return (
      <div 
        className={cn("h-full flex flex-col items-center justify-center p-3 bg-background", className)}
        data-testid="storage-panel-no-project"
      >
        <HardDrive className="w-12 h-12 mb-4 text-muted-foreground opacity-40" />
        <p className="text-[13px] text-muted-foreground">Select a project to manage storage</p>
      </div>
    );
  }

  return (
    <div 
      className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}
      data-testid="app-storage-panel"
      {...getRootProps()}
    >
      <input {...getInputProps()} data-testid="input-file-upload" />
      
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]" data-testid="text-storage-title">Storage</span>
          {storageData?.stats && (
            <Badge className="h-4 px-1 text-[9px] bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)] rounded" data-testid="text-file-count">
              {storageData.stats.fileCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-storage"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => setShowNewFolderDialog(true)}
            data-testid="button-new-folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,42%)]/10"
            onClick={open}
            disabled={uploadingFiles.length > 0}
            data-testid="button-upload"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {storageData?.stats && (
        <div className="px-2.5 py-1 border-b border-[var(--ecode-border)] shrink-0">
          <div className="flex items-center justify-between text-[9px] text-[var(--ecode-text-muted)]">
            <span data-testid="text-storage-used">{storageData.stats.totalSizeFormatted}</span>
            <span data-testid="text-storage-max">{storageData.stats.maxStorageFormatted}</span>
          </div>
          <Progress 
            value={storageData.stats.usagePercent} 
            className="h-1 mt-1"
            data-testid="progress-storage-usage"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ScrollArea className="flex-1 lg:w-1/2 border-r border-border">
          <div className="p-2">
            {isDragActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg">
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-[13px] font-medium">Drop files here to upload</p>
                </div>
              </div>
            )}

            {uploadingFiles.length > 0 && (
              <div className="mb-2 p-2 bg-muted rounded-lg">
                {uploadingFiles.map(fileName => (
                  <div key={fileName} className="flex items-center gap-2 text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="truncate">Uploading {fileName}...</span>
                  </div>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-12 h-12 mb-3 text-destructive opacity-40" />
                <p className="text-[13px] text-muted-foreground">Failed to load storage</p>
                <Button variant="link" className="mt-2" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : !storageData?.files.length ? (
              <div 
                className="flex flex-col items-center justify-center py-12 text-center cursor-pointer"
                onClick={open}
              >
                <HardDrive className="w-12 h-12 mb-4 text-muted-foreground opacity-40" />
                <h4 className="text-base font-medium mb-2">No files uploaded</h4>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Drag & drop files or click to upload
                </p>
                <Button onClick={open} data-testid="button-upload-empty">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload files
                </Button>
              </div>
            ) : (
              storageData.files.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  projectId={projectId}
                  depth={0}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onCopyUrl={handleCopyUrl}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="hidden lg:flex lg:w-1/2 flex-col">
          {selectedFileData ? (
            <div className="flex-1 flex flex-col p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium truncate" data-testid="text-selected-filename">
                  {selectedFileData.name}
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {isImageFile(selectedFileData.contentType, selectedFileData.name) && (
                <div className="flex-1 flex items-center justify-center bg-muted rounded-lg mb-4 overflow-hidden">
                  <img
                    src={`/api/projects/${projectId}/storage/${encodeURIComponent(selectedFileData.path)}/download`}
                    alt={selectedFileData.name}
                    className="max-w-full max-h-[300px] object-contain"
                    data-testid="img-preview"
                  />
                </div>
              )}

              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span data-testid="text-file-size">{formatSize(selectedFileData.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span data-testid="text-file-type">{selectedFileData.contentType || 'Unknown'}</span>
                </div>
                {selectedFileData.lastModified && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modified</span>
                    <span data-testid="text-file-modified">
                      {new Date(selectedFileData.lastModified).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedFileData.path, selectedFileData.name)}
                  data-testid="button-download-selected"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyUrl(selectedFileData.path)}
                  data-testid="button-copy-url-selected"
                >
                  {copiedPath === selectedFileData.path ? (
                    <Check className="w-4 h-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  Copy URL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedFileData.path)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
              <File className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-[13px]">Select a file to view details</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              data-testid="input-folder-name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName.trim());
                }
              }}
            />
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate(newFolderName.trim())}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-create-folder"
            >
              {createFolderMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating...</>
              ) : (
                <><FolderPlus className="w-4 h-4 mr-1" /> Create</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppStoragePanel;
