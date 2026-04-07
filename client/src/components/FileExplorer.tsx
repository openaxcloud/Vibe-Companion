import React, { useState } from 'react';
import { File } from '@shared/schema';
import { cn } from '@/lib/utils';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Folder, 
  FolderOpen,
  Plus,
  Trash,
  Edit,
  RefreshCw,
  FilePlus,
  FolderPlus,
  MoreVertical
} from 'lucide-react';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface FileExplorerProps {
  files: File[];
  selectedFile?: File;
  onFileSelect: (file: File) => void;
  onCreateFile?: (parentId: number | null, name: string) => Promise<void>;
  onCreateFolder?: (parentId: number | null, name: string) => Promise<void>;
  onRenameFile?: (file: File, newName: string) => Promise<void>;
  onDeleteFile?: (file: File) => Promise<void>;
  isLoading?: boolean;
}

interface FileNodeProps {
  file: File;
  files: File[];
  level: number;
  selectedFile?: File;
  onFileSelect: (file: File) => void;
  expanded: Record<number, boolean>;
  toggleExpand: (id: number) => void;
  onCreateFile?: (parentId: number | null, name: string) => Promise<void>;
  onCreateFolder?: (parentId: number | null, name: string) => Promise<void>;
  onRenameFile?: (file: File, newName: string) => Promise<void>;
  onDeleteFile?: (file: File) => Promise<void>;
}

const FileNode: React.FC<FileNodeProps> = ({ 
  file, 
  files, 
  level, 
  selectedFile, 
  onFileSelect, 
  expanded, 
  toggleExpand,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  
  const childFiles = files.filter(f => f.parentId === file.id);
  const isExpanded = expanded[file.id];
  const isFolder = file.isFolder;
  const isSelected = selectedFile?.id === file.id;
  
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onRenameFile && newName !== file.name) {
      await onRenameFile(file, newName);
    }
    setIsRenaming(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(file.name);
    }
  };
  
  const getFileIcon = () => {
    if (isFolder) {
      return isExpanded ? <FolderOpen className="h-4 w-4 mr-1.5" /> : <Folder className="h-4 w-4 mr-1.5" />;
    }
    
    // Return specific icon based on file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    return <FileText className="h-4 w-4 mr-1.5" />;
  };
  
  const indent = level * 12;
  
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div 
            className={cn(
              "flex items-center py-1 px-2 text-sm select-none cursor-pointer hover:bg-secondary/40", 
              isSelected && !isRenaming && "bg-secondary text-secondary-foreground"
            )}
            style={{ paddingLeft: `${indent}px` }}
            onClick={() => {
              if (!isRenaming) {
                if (isFolder) {
                  toggleExpand(file.id);
                } else {
                  onFileSelect(file);
                }
              }
            }}
          >
            {isFolder && (
              <div className="mr-1 text-muted-foreground" onClick={(e) => {
                e.stopPropagation();
                toggleExpand(file.id);
              }}>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            )}
            
            {getFileIcon()}
            
            {isRenaming ? (
              <form onSubmit={handleRename} className="flex-1">
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={handleKeyDown}
                  className="h-6 py-0 text-xs"
                  autoFocus
                />
              </form>
            ) : (
              <span className="truncate">{file.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="w-48">
          {!isFolder && (
            <ContextMenuItem onClick={() => onFileSelect(file)}>
              Open
            </ContextMenuItem>
          )}
          
          {isFolder && (
            <>
              <ContextMenuItem onClick={() => toggleExpand(file.id)}>
                {isExpanded ? 'Collapse' : 'Expand'}
              </ContextMenuItem>
              
              {onCreateFile && (
                <ContextMenuItem 
                  onClick={() => {
                    const name = prompt('Enter file name:');
                    if (name) onCreateFile(file.id, name);
                  }}
                >
                  New File
                </ContextMenuItem>
              )}
              
              {onCreateFolder && (
                <ContextMenuItem 
                  onClick={() => {
                    const name = prompt('Enter folder name:');
                    if (name) onCreateFolder(file.id, name);
                  }}
                >
                  New Folder
                </ContextMenuItem>
              )}
              
              <ContextMenuSeparator />
            </>
          )}
          
          {onRenameFile && (
            <ContextMenuItem onClick={() => setIsRenaming(true)}>
              Rename
            </ContextMenuItem>
          )}
          
          {onDeleteFile && (
            <ContextMenuItem 
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${file.name}?`)) {
                  onDeleteFile(file);
                }
              }}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Render children if expanded */}
      {isFolder && isExpanded && childFiles.map((childFile) => (
        <FileNode
          key={childFile.id}
          file={childFile}
          files={files}
          level={level + 1}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          expanded={expanded}
          toggleExpand={toggleExpand}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRenameFile={onRenameFile}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files,
  selectedFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  isLoading
}) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState<false | 'file' | 'folder'>(false);
  const [newItemName, setNewItemName] = useState('');
  
  // Get root level files
  const rootFiles = files.filter(file => file.parentId === null);
  
  // Filter files by search if search query exists
  const filteredFiles = searchQuery 
    ? files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : rootFiles;
  
  const toggleExpand = (id: number) => {
    setExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const handleNewItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newItemName.trim()) {
      return;
    }
    
    try {
      if (isCreatingNew === 'file' && onCreateFile) {
        await onCreateFile(null, newItemName);
      } else if (isCreatingNew === 'folder' && onCreateFolder) {
        await onCreateFolder(null, newItemName);
      }
      
      setNewItemName('');
      setIsCreatingNew(false);
    } catch (error) {
      console.error('Error creating new item:', error);
      alert('Failed to create new item');
    }
  };
  
  return (
    <div className="h-full flex flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <h2 className="text-sm font-medium">Files</h2>
        
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New File/Folder</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenuContent align="end">
              {onCreateFile && (
                <DropdownMenuItem onClick={() => setIsCreatingNew('file')}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  New File
                </DropdownMenuItem>
              )}
              
              {onCreateFolder && (
                <DropdownMenuItem onClick={() => setIsCreatingNew('folder')}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="px-2 py-1">
        <Input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      
      {isCreatingNew && (
        <div className="px-2 py-1 border-b border-border">
          <form onSubmit={handleNewItemSubmit}>
            <div className="flex items-center">
              {isCreatingNew === 'file' ? (
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
              )}
              
              <Input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`New ${isCreatingNew}...`}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end mt-1 space-x-1">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewItemName('');
                }}
              >
                Cancel
              </Button>
              
              <Button 
                type="submit" 
                size="sm"
                className="h-6 text-xs px-2"
              >
                Create
              </Button>
            </div>
          </form>
        </div>
      )}
      
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size="md" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            {searchQuery ? (
              <p>No files matching '{searchQuery}'</p>
            ) : (
              <p>No files yet</p>
            )}
          </div>
        ) : (
          searchQuery ? (
            // Show flat list for search results
            filteredFiles.map(file => (
              <div 
                key={file.id}
                className={cn(
                  "flex items-center py-1 px-2 text-sm select-none cursor-pointer hover:bg-secondary/40", 
                  selectedFile?.id === file.id && "bg-secondary text-secondary-foreground"
                )}
                onClick={() => {
                  if (!file.isFolder) {
                    onFileSelect(file);
                  }
                }}
              >
                {file.isFolder ? (
                  <Folder className="h-4 w-4 mr-1.5" />
                ) : (
                  <FileText className="h-4 w-4 mr-1.5" />
                )}
                <span className="truncate">{file.name}</span>
              </div>
            ))
          ) : (
            // Show tree structure for normal view
            rootFiles.map(file => (
              <FileNode
                key={file.id}
                file={file}
                files={files}
                level={0}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
                expanded={expanded}
                toggleExpand={toggleExpand}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onRenameFile={onRenameFile}
                onDeleteFile={onDeleteFile}
              />
            ))
          )
        )}
      </div>
    </div>
  );
};

export default FileExplorer;