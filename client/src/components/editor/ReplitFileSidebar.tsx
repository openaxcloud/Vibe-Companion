import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  FileText, 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreVertical,
  Upload,
  Download,
  RefreshCw,
  Settings,
  ChevronRight,
  ChevronDown,
  File,
  Code,
  Image,
  FileJson,
  GitBranch,
  Database,
  Package,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { File as FileType } from '@shared/schema';
import { useMediaQuery } from '@/hooks/use-media-query';
import { FileUpload } from './FileUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReplitFileSidebarProps {
  files: FileType[];
  activeFileId?: number;
  onFileSelect: (file: FileType) => void;
  onFileCreate: (name: string, isFolder: boolean, parentId?: number) => void;
  onFileDelete: (fileId: number) => void;
  onFileRename?: (fileId: number, newName: string) => void;
  projectName?: string;
  projectId?: number;
}

interface FileTreeItemProps {
  file: FileType;
  files: FileType[];
  level: number;
  activeFileId?: number;
  onFileSelect: (file: FileType) => void;
  onFileCreate: (name: string, isFolder: boolean, parentId?: number) => void;
  onFileDelete: (fileId: number) => void;
  onFileRename?: (fileId: number, newName: string) => void;
}

function getFileIcon(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <Code className="h-4 w-4 text-yellow-500" />;
    case 'json':
    case 'jsonc':
      return <FileJson className="h-4 w-4 text-orange-500" />;
    case 'html':
    case 'htm':
      return <FileText className="h-4 w-4 text-red-500" />;
    case 'css':
    case 'scss':
    case 'sass':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <Image className="h-4 w-4 text-purple-500" />;
    case 'md':
    case 'mdx':
      return <FileText className="h-4 w-4 text-gray-500" />;
    default:
      return <File className="h-4 w-4 text-[var(--ecode-text-muted)]" />;
  }
}

function FileTreeItem({ 
  file, 
  files, 
  level, 
  activeFileId, 
  onFileSelect, 
  onFileCreate, 
  onFileDelete,
  onFileRename 
}: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputType, setInputType] = useState<'file' | 'folder'>('file');
  const [isRenaming, setIsRenaming] = useState(false);

  const children = files.filter(f => f.parentId === file.id);
  const hasChildren = children.length > 0;

  const handleCreate = () => {
    if (inputValue.trim()) {
      onFileCreate(inputValue.trim(), inputType === 'folder', file.id);
      setInputValue('');
      setShowInput(false);
      setExpanded(true);
    }
  };

  const handleRename = () => {
    if (inputValue.trim() && onFileRename) {
      onFileRename(file.id, inputValue.trim());
      setInputValue('');
      setIsRenaming(false);
    }
  };

  if (isRenaming) {
    return (
      <div className="flex items-center px-2 py-1" style={{ paddingLeft: `${level * 12 + 8}px` }}>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setIsRenaming(false);
          }}
          onBlur={handleRename}
          className="h-6 text-xs"
          autoFocus
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-center px-2 py-0.5 cursor-pointer hover:bg-[var(--ecode-sidebar-hover)]",
          activeFileId === file.id && "bg-[var(--ecode-accent-subtle)] text-[var(--ecode-accent)]"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (file.isFolder) {
            setExpanded(!expanded);
          } else {
            onFileSelect(file);
          }
        }}
      >
        {file.isFolder ? (
          <button
            className="p-0.5 hover:bg-[var(--ecode-sidebar-hover)] rounded"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        
        {file.isFolder ? (
          expanded ? (
            <FolderOpen className="h-4 w-4 ml-1 text-[var(--ecode-text-muted)]" />
          ) : (
            <Folder className="h-4 w-4 ml-1 text-[var(--ecode-text-muted)]" />
          )
        ) : (
          <div className="ml-1">{getFileIcon(file.name)}</div>
        )}
        
        <span className="ml-2 text-sm flex-1 truncate">{file.name}</span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {file.isFolder && (
              <>
                <DropdownMenuItem onClick={() => {
                  setInputType('file');
                  setShowInput(true);
                  setExpanded(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setInputType('folder');
                  setShowInput(true);
                  setExpanded(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => {
              setInputValue(file.name);
              setIsRenaming(true);
            }}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onFileDelete(file.id)}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {file.isFolder && expanded && showInput && (
        <div className="flex items-center px-2 py-1" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
          {inputType === 'folder' ? (
            <Folder className="h-4 w-4 mr-2 text-[var(--ecode-text-muted)]" />
          ) : (
            <File className="h-4 w-4 mr-2 text-[var(--ecode-text-muted)]" />
          )}
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputType === 'folder' ? 'Folder name' : 'File name'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setShowInput(false);
                setInputValue('');
              }
            }}
            onBlur={() => {
              setShowInput(false);
              setInputValue('');
            }}
            className="h-6 text-xs"
            autoFocus
          />
        </div>
      )}

      {file.isFolder && expanded && (
        <>
          {children.map((child) => (
            <FileTreeItem
              key={child.id}
              file={child}
              files={files}
              level={level + 1}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onFileCreate={onFileCreate}
              onFileDelete={onFileDelete}
              onFileRename={onFileRename}
            />
          ))}
        </>
      )}
    </>
  );
}

export function ReplitFileSidebar({ 
  files, 
  activeFileId, 
  onFileSelect, 
  onFileCreate, 
  onFileDelete,
  onFileRename,
  projectName = "Project",
  projectId
}: ReplitFileSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'file' | 'folder'>('file');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');

  const rootFiles = files.filter(f => !f.parentId);
  
  const filteredFiles = searchQuery
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : rootFiles;

  const handleNewItem = () => {
    if (newItemName.trim()) {
      onFileCreate(newItemName.trim(), newItemType === 'folder');
      setNewItemName('');
      setShowNewInput(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-background)]">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-[var(--ecode-border)]">
        <h2 className="text-sm font-medium">Files</h2>
        <div className="flex items-center gap-1">
          <DropdownMenu open={showNewMenu} onOpenChange={setShowNewMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setNewItemType('file');
                setShowNewInput(true);
                setShowNewMenu(false);
              }}>
                <File className="h-4 w-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewItemType('folder');
                setShowNewInput(true);
                setShowNewMenu(false);
              }}>
                <Folder className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setShowUploadDialog(true);
                setShowNewMenu(false);
              }}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--ecode-border)]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--ecode-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* New Item Input */}
      {showNewInput && (
        <div className="px-3 py-2 border-b border-[var(--ecode-border)]">
          <div className="flex items-center gap-2">
            {newItemType === 'folder' ? (
              <Folder className="h-4 w-4 text-[var(--ecode-text-muted)]" />
            ) : (
              <File className="h-4 w-4 text-[var(--ecode-text-muted)]" />
            )}
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={newItemType === 'folder' ? 'Folder name' : 'File name'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewItem();
                if (e.key === 'Escape') {
                  setShowNewInput(false);
                  setNewItemName('');
                }
              }}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--ecode-text-muted)]">
              {searchQuery ? 'No files found' : 'No files yet'}
            </div>
          ) : (
            filteredFiles.map((file) => (
              <FileTreeItem
                key={file.id}
                file={file}
                files={files}
                level={0}
                activeFileId={activeFileId}
                onFileSelect={onFileSelect}
                onFileCreate={onFileCreate}
                onFileDelete={onFileDelete}
                onFileRename={onFileRename}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Bottom Tabs */}
      <div className="h-10 flex items-center border-t border-[var(--ecode-border)]">
        <Button variant="ghost" size="sm" className="h-full rounded-none flex-1 text-xs">
          <GitBranch className="h-3 w-3 mr-1" />
          Git
        </Button>
        <Button variant="ghost" size="sm" className="h-full rounded-none flex-1 text-xs">
          <Database className="h-3 w-3 mr-1" />
          Database
        </Button>
        <Button variant="ghost" size="sm" className="h-full rounded-none flex-1 text-xs">
          <Package className="h-3 w-3 mr-1" />
          Packages
        </Button>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Drag and drop files here or click to browse
            </DialogDescription>
          </DialogHeader>
          {projectId && (
            <FileUpload 
              projectId={projectId} 
              onClose={() => setShowUploadDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}