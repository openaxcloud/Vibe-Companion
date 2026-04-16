import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronRight, ChevronDown, FileIcon, FolderOpen, Folder,
  Plus, RefreshCw, Search, Upload, Trash2, Pencil, Copy,
  FolderPlus, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, getCsrfToken } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  fileId?: string;
  children: FileNode[];
}

interface ReplitFileExplorerProps {
  projectId: string;
  files: any[];
  onFileSelect: (file: { id: string; name: string }) => void;
  selectedFileId: string | null;
  isBootstrapping?: boolean;
  showHiddenFiles?: boolean;
  onToggleHiddenFiles?: () => void;
  gitChangedFiles?: Set<string>;
  onCreateFile?: () => void;
  onUploadFile?: () => void;
  dirtyFiles?: Set<string>;
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { bg: string; label: string }> = {
    js: { bg: 'bg-yellow-500', label: 'JS' },
    jsx: { bg: 'bg-yellow-500', label: 'JX' },
    ts: { bg: 'bg-blue-500', label: 'TS' },
    tsx: { bg: 'bg-blue-500', label: 'TX' },
    py: { bg: 'bg-green-500', label: 'PY' },
    css: { bg: 'bg-pink-500', label: 'CS' },
    scss: { bg: 'bg-pink-400', label: 'SC' },
    html: { bg: 'bg-orange-500', label: 'HT' },
    json: { bg: 'bg-amber-500', label: 'JS' },
    md: { bg: 'bg-gray-500', label: 'MD' },
    svg: { bg: 'bg-emerald-500', label: 'SV' },
    yml: { bg: 'bg-purple-500', label: 'YM' },
    yaml: { bg: 'bg-purple-500', label: 'YM' },
    go: { bg: 'bg-cyan-500', label: 'GO' },
    rs: { bg: 'bg-orange-600', label: 'RS' },
    java: { bg: 'bg-red-500', label: 'JV' },
    rb: { bg: 'bg-red-400', label: 'RB' },
    php: { bg: 'bg-indigo-500', label: 'PH' },
    sh: { bg: 'bg-gray-600', label: 'SH' },
    sql: { bg: 'bg-blue-400', label: 'SQ' },
  };
  const icon = iconMap[ext];
  if (icon) {
    return (
      <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-[3px] shrink-0', icon.bg)}>
        <span className="text-[7px] font-bold text-white">{icon.label}</span>
      </span>
    );
  }
  return <FileIcon className="w-3.5 h-3.5 shrink-0 text-[var(--ide-text-secondary)]" />;
}

function buildFileTree(files: any[]): FileNode[] {
  const root: FileNode[] = [];
  for (const file of files) {
    const parts = (file.filename || file.name || '').split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join('/');
      if (isLast) {
        current.push({ name: part, path: pathSoFar, type: 'file', fileId: file.id, children: [] });
      } else {
        let dir = current.find(n => n.type === 'dir' && n.name === part);
        if (!dir) {
          dir = { name: part, path: pathSoFar, type: 'dir', children: [] };
          current.push(dir);
        }
        current = dir.children;
      }
    }
  }
  const sortNodes = (nodes: FileNode[]): FileNode[] =>
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(n => ({ ...n, children: sortNodes(n.children) }));
  return sortNodes(root);
}

function getGitStatusIndicator(path: string, gitChangedFiles?: Set<string>): React.ReactNode {
  if (!gitChangedFiles || !gitChangedFiles.has(path)) return null;
  return <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Modified" />;
}

function TreeItem({
  node, depth, selectedFileId, expandedDirs, toggleDir, onFileSelect,
  gitChangedFiles, dirtyFiles, onRename, onDelete, onCopyPath, onNewFile, onNewFolder,
}: {
  node: FileNode; depth: number; selectedFileId: string | null;
  expandedDirs: Set<string>; toggleDir: (path: string) => void;
  onFileSelect: (file: { id: string; name: string }) => void;
  gitChangedFiles?: Set<string>;
  dirtyFiles?: Set<string>;
  onRename: (id: string, currentName: string) => void;
  onDelete: (id: string, name: string, type: 'file' | 'dir') => void;
  onCopyPath: (path: string) => void;
  onNewFile: (parentFolder: string) => void;
  onNewFolder: (parentFolder: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = node.type === 'file' && node.fileId === selectedFileId;
  const isDirty = node.type === 'file' && node.fileId && dirtyFiles?.has(node.fileId);

  const contextMenuItems = node.type === 'dir' ? (
    <>
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => onNewFile(node.path)}
      >
        <Plus className="w-3 h-3" /> New File
      </ContextMenuItem>
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => onNewFolder(node.path)}
      >
        <FolderPlus className="w-3 h-3" /> New Folder
      </ContextMenuItem>
      <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => onCopyPath(node.path)}
      >
        <Copy className="w-3 h-3" /> Copy Path
      </ContextMenuItem>
      <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => onDelete(node.path, node.name, 'dir')}
      >
        <Trash2 className="w-3 h-3" /> Delete
      </ContextMenuItem>
    </>
  ) : (
    <>
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => { if (node.fileId) onFileSelect({ id: node.fileId, name: node.path }); }}
      >
        <ExternalLink className="w-3 h-3" /> Open
      </ContextMenuItem>
      <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => { if (node.fileId) onRename(node.fileId, node.path); }}
      >
        <Pencil className="w-3 h-3" /> Rename
      </ContextMenuItem>
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => onCopyPath(node.path)}
      >
        <Copy className="w-3 h-3" /> Copy Path
      </ContextMenuItem>
      <ContextMenuSeparator className="bg-[var(--ide-surface)]" />
      <ContextMenuItem
        className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-[var(--ide-surface)] cursor-pointer rounded-md px-2 py-1.5"
        onClick={() => { if (node.fileId) onDelete(node.fileId, node.name, 'file'); }}
      >
        <Trash2 className="w-3 h-3" /> Delete
      </ContextMenuItem>
    </>
  );

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className={cn(
              'group flex items-center gap-1.5 w-full h-7 text-left transition-colors',
              isSelected ? 'bg-[var(--ide-surface)] text-[var(--ide-text)]' : 'text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50 hover:text-[var(--ide-text)]'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => {
              if (node.type === 'dir') {
                toggleDir(node.path);
              } else if (node.fileId) {
                onFileSelect({ id: node.fileId, name: node.path });
              }
            }}
          >
            {node.type === 'dir' ? (
              <>
                {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                {isExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[#F5A623]" />}
              </>
            ) : (
              <>
                <span className="w-3 shrink-0" />
                <FileTypeIcon filename={node.name} />
              </>
            )}
            <span className="text-[11px] truncate flex-1">{node.name}</span>
            {getGitStatusIndicator(node.path, gitChangedFiles)}
            {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-lg shadow-xl min-w-[160px]">
          {contextMenuItems}
        </ContextMenuContent>
      </ContextMenu>
      {node.type === 'dir' && isExpanded && node.children.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFileId={selectedFileId}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          onFileSelect={onFileSelect}
          gitChangedFiles={gitChangedFiles}
          dirtyFiles={dirtyFiles}
          onRename={onRename}
          onDelete={onDelete}
          onCopyPath={onCopyPath}
          onNewFile={onNewFile}
          onNewFolder={onNewFolder}
        />
      ))}
    </div>
  );
}

export function ReplitFileExplorer({
  projectId,
  files,
  onFileSelect,
  selectedFileId,
  isBootstrapping,
  showHiddenFiles,
  onToggleHiddenFiles,
  gitChangedFiles,
  onCreateFile,
  onUploadFile,
  dirtyFiles,
}: ReplitFileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [fileDragOver, setFileDragOver] = useState(false);

  // Dialog states
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileParentFolder, setNewFileParentFolder] = useState('');
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentFolder, setNewFolderParentFolder] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'file' | 'dir' } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const onNewFile = () => { setNewFileParentFolder(''); setNewFileName(''); setNewFileDialogOpen(true); };
    const onNewFolder = () => { setNewFolderParentFolder(''); setNewFolderName(''); setNewFolderDialogOpen(true); };
    window.addEventListener('ecode:new-file', onNewFile);
    window.addEventListener('ecode:new-folder', onNewFolder);
    return () => { window.removeEventListener('ecode:new-file', onNewFile); window.removeEventListener('ecode:new-folder', onNewFolder); };
  }, []);

  const filteredFiles = useMemo(() => {
    let result = files || [];
    if (!showHiddenFiles) {
      result = result.filter((f: any) => {
        const name = f.filename || f.name || '';
        const parts = name.split('/');
        return !parts.some((part: string) => part.startsWith('.'));
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((f: any) => {
        const name = (f.filename || f.name || '').toLowerCase();
        return name.includes(term);
      });
    }
    return result;
  }, [files, showHiddenFiles, searchTerm]);

  const tree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const invalidateFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
  }, [queryClient, projectId]);

  // --- Create File ---
  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim()) return;
    const filename = newFileParentFolder
      ? `${newFileParentFolder}/${newFileName.trim()}`
      : newFileName.trim();
    try {
      await apiRequest('POST', `/api/projects/${projectId}/files`, {
        filename,
        content: '',
      });
      invalidateFiles();
      toast({ title: 'File created', description: filename });
      setNewFileDialogOpen(false);
      setNewFileName('');
      setNewFileParentFolder('');
    } catch (err: any) {
      toast({ title: 'Failed to create file', description: err.message, variant: 'destructive' });
    }
  }, [newFileName, newFileParentFolder, projectId, invalidateFiles, toast]);

  // --- Create Folder (creates a placeholder .gitkeep inside) ---
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    const folderPath = newFolderParentFolder
      ? `${newFolderParentFolder}/${newFolderName.trim()}`
      : newFolderName.trim();
    try {
      await apiRequest('POST', `/api/projects/${projectId}/files`, {
        filename: `${folderPath}/.gitkeep`,
        content: '',
      });
      invalidateFiles();
      toast({ title: 'Folder created', description: folderPath });
      setNewFolderDialogOpen(false);
      setNewFolderName('');
      setNewFolderParentFolder('');
      // Auto-expand the new folder
      setExpandedDirs(prev => new Set(prev).add(folderPath));
    } catch (err: any) {
      toast({ title: 'Failed to create folder', description: err.message, variant: 'destructive' });
    }
  }, [newFolderName, newFolderParentFolder, projectId, invalidateFiles, toast]);

  // --- Delete ---
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'file') {
        await apiRequest('DELETE', `/api/files/${deleteTarget.id}`);
      } else {
        const dirFiles = (files || []).filter((f: any) => {
          const fname = f.filename || f.name || '';
          return fname === deleteTarget.id || fname.startsWith(deleteTarget.id + '/');
        });
        const ids = dirFiles.map((f: any) => f.id);
        if (ids.length > 0) {
          await apiRequest('POST', '/api/files/batch-delete', { ids });
        }
      }
      invalidateFiles();
      toast({ title: 'Deleted', description: deleteTarget.name });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    }
  }, [deleteTarget, files, invalidateFiles, toast]);

  // --- Rename ---
  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await apiRequest('PATCH', `/api/files/${renameTarget.id}`, {
        filename: renameValue.trim(),
      });
      invalidateFiles();
      toast({ title: 'Renamed', description: renameValue.trim() });
      setRenameDialogOpen(false);
      setRenameTarget(null);
      setRenameValue('');
    } catch (err: any) {
      toast({ title: 'Failed to rename', description: err.message, variant: 'destructive' });
    }
  }, [renameTarget, renameValue, invalidateFiles, toast]);

  // --- Upload ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < uploadedFiles.length; i++) {
      formData.append('files', uploadedFiles[i]);
    }
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });
      invalidateFiles();
      toast({ title: 'Files uploaded', description: `${uploadedFiles.length} file(s) uploaded` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    // Reset the input
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  }, [projectId, invalidateFiles, toast]);

  // --- Drag & Drop Upload ---
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < droppedFiles.length; i++) {
      formData.append('files', droppedFiles[i]);
    }
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });
      invalidateFiles();
      toast({ title: 'Files uploaded', description: `${droppedFiles.length} file(s) uploaded` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  }, [projectId, invalidateFiles, toast]);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(true);
  }, []);

  const handleFileDragLeave = useCallback(() => {
    setFileDragOver(false);
  }, []);

  // --- Copy Path ---
  const copyPathToClipboard = useCallback((path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      toast({ title: 'Copied', description: path });
    });
  }, [toast]);

  // --- Context menu action handlers ---
  const openRenameDialog = useCallback((id: string, currentName: string) => {
    setRenameTarget({ id, currentName });
    setRenameValue(currentName);
    setRenameDialogOpen(true);
  }, []);

  const openDeleteConfirm = useCallback((id: string, name: string, type: 'file' | 'dir') => {
    setDeleteTarget({ id, name, type });
    setDeleteConfirmOpen(true);
  }, []);

  const openNewFileDialog = useCallback((parentFolder: string) => {
    setNewFileParentFolder(parentFolder);
    setNewFileName('');
    setNewFileDialogOpen(true);
  }, []);

  const openNewFolderDialog = useCallback((parentFolder: string) => {
    setNewFolderParentFolder(parentFolder);
    setNewFolderName('');
    setNewFolderDialogOpen(true);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-[var(--ide-border)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ide-text-secondary)]">Files</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 rounded transition-colors duration-150 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={() => {
              if (onCreateFile) {
                onCreateFile();
              } else {
                setNewFileParentFolder('');
                setNewFileName('');
                setNewFileDialogOpen(true);
              }
            }}
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 rounded transition-colors duration-150 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={() => {
              setNewFolderParentFolder('');
              setNewFolderName('');
              setNewFolderDialogOpen(true);
            }}
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 rounded transition-colors duration-150 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={() => {
              if (onUploadFile) {
                onUploadFile();
              } else {
                uploadInputRef.current?.click();
              }
            }}
            title="Upload File"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="*/*" />
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 rounded transition-colors duration-150 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={invalidateFiles}
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
          {onToggleHiddenFiles && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'w-6 h-6 rounded transition-colors duration-150',
                showHiddenFiles
                  ? 'text-[var(--ide-accent)] bg-[var(--ide-surface)]'
                  : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]'
              )}
              onClick={onToggleHiddenFiles}
              title={showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'}
            >
              {showHiddenFiles ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1 px-2 h-7 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-md">
          <Search className="w-3 h-3 text-[var(--ide-text-muted)]" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-[11px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none"
          />
        </div>
      </div>

      {/* File Tree */}
      <div
        className={cn(
          'flex-1 overflow-auto transition-colors',
          fileDragOver && 'bg-[#0079F2]/10 ring-2 ring-inset ring-[#0079F2]/40'
        )}
        onDrop={handleFileDrop}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
      >
        {fileDragOver && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-[#0079F2]">
              <Upload className="w-8 h-8" />
              <span className="text-xs font-medium">Drop files here</span>
            </div>
          </div>
        )}
        {isBootstrapping ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 border-[#0079F2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[var(--ide-text-muted)]">
              {searchTerm ? 'No matching files' : 'No files yet'}
            </p>
            {!searchTerm && (
              <div className="flex gap-2 justify-center mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-[#0079F2]"
                  onClick={() => { setNewFileParentFolder(''); setNewFileName(''); setNewFileDialogOpen(true); }}
                >
                  <Plus className="w-3 h-3 mr-1" /> File
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-[#0079F2]"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3 mr-1" /> Upload
                </Button>
              </div>
            )}
          </div>
        ) : (
          tree.map(node => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              selectedFileId={selectedFileId}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileSelect={onFileSelect}
              gitChangedFiles={gitChangedFiles}
              dirtyFiles={dirtyFiles}
              onRename={openRenameDialog}
              onDelete={openDeleteConfirm}
              onCopyPath={copyPathToClipboard}
              onNewFile={openNewFileDialog}
              onNewFolder={openNewFolderDialog}
            />
          ))
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)]">New File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {newFileParentFolder && (
              <p className="text-xs text-[var(--ide-text-muted)]">
                Creating in: <span className="text-[var(--ide-text-secondary)]">{newFileParentFolder}/</span>
              </p>
            )}
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.ext"
              className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFileDialogOpen(false)} className="text-[var(--ide-text-secondary)]">Cancel</Button>
            <Button onClick={handleCreateFile} disabled={!newFileName.trim()} className="bg-[#0079F2] hover:bg-[#0066CC] text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)]">New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {newFolderParentFolder && (
              <p className="text-xs text-[var(--ide-text-muted)]">
                Creating in: <span className="text-[var(--ide-text-secondary)]">{newFolderParentFolder}/</span>
              </p>
            )}
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="folder-name"
              className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderDialogOpen(false)} className="text-[var(--ide-text-secondary)]">Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="bg-[#0079F2] hover:bg-[#0066CC] text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)]">Delete {deleteTarget?.type === 'dir' ? 'Folder' : 'File'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--ide-text-secondary)]">
            Are you sure you want to delete <span className="font-mono text-[var(--ide-text)]">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }} className="text-[var(--ide-text-secondary)]">Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={(open) => { setRenameDialogOpen(open); if (!open) setRenameTarget(null); }}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)]">Rename</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-[var(--ide-text-muted)]">
              Current: <span className="font-mono text-[var(--ide-text-secondary)]">{renameTarget?.currentName}</span>
            </p>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="new-name"
              className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRenameDialogOpen(false); setRenameTarget(null); }} className="text-[var(--ide-text-secondary)]">Cancel</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || renameValue === renameTarget?.currentName} className="bg-[#0079F2] hover:bg-[#0066CC] text-white">Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
