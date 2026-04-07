import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Search,
  X,
  Download,
  Upload,
  Edit2,
  Trash2,
  Copy,
  Scissors,
  Clipboard,
  RefreshCw,
  Eye,
  EyeOff,
  FileCode,
  FileJson,
  FileImage,
  FileVideo,
  FileArchive,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FileNode {
  id: number;
  name: string;
  type: "file" | "folder";
  content?: string;
  size?: number;
  lastModified?: Date;
  path: string;
  parentId: number | null;
  children?: FileNode[];
  isOpen?: boolean;
  isHidden?: boolean;
  permissions?: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
}

interface ReplitFileExplorerProps {
  projectId: number;
  onFileSelect?: (file: FileNode) => void;
  selectedFileId?: number;
}

export function ReplitFileExplorer({
  projectId,
  onFileSelect,
  selectedFileId,
}: ReplitFileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [draggedFile, setDraggedFile] = useState<FileNode | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [clipboard, setClipboard] = useState<{ file: FileNode; operation: "copy" | "cut" } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ file: FileNode; newName: string } | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{ parentId: number | null; type: "file" | "folder"; name: string } | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<FileNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch files from API
  const { data: files = [], isLoading, refetch } = useQuery<FileNode[]>({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId,
  });

  // File operations mutations
  const createFileMutation = useMutation({
    mutationFn: async (data: { name: string; isFolder: boolean; parentId: number | null; content?: string }) => 
      apiRequest(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "Success", description: "File created successfully" });
      setNewItemDialog(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create file", variant: "destructive" });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; content?: string }) =>
      apiRequest(`/api/files/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "Success", description: "File updated successfully" });
      setRenameDialog(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update file", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/files/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "Success", description: "File deleted successfully" });
      setDeleteConfirmDialog(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" });
    },
  });

  // Build file tree structure
  const buildFileTree = (files: FileNode[]): FileNode[] => {
    const fileMap = new Map<number, FileNode>();
    const rootFiles: FileNode[] = [];

    // First pass: create map
    files.forEach(file => {
      fileMap.set(file.id, { ...file, children: [] });
    });

    // Second pass: build tree
    files.forEach(file => {
      const fileNode = fileMap.get(file.id)!;
      if (file.parentId === null) {
        rootFiles.push(fileNode);
      } else {
        const parent = fileMap.get(file.parentId);
        if (parent && parent.children) {
          parent.children.push(fileNode);
        }
      }
    });

    // Sort files: folders first, then alphabetically
    const sortFiles = (files: FileNode[]) => {
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      files.forEach(file => {
        if (file.children) {
          sortFiles(file.children);
        }
      });
    };

    sortFiles(rootFiles);
    return rootFiles;
  };

  // Filter files based on search
  const filterFiles = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
    
    const filtered: FileNode[] = [];
    nodes.forEach(node => {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        filtered.push(node);
      } else if (node.children) {
        const filteredChildren = filterFiles(node.children, query);
        if (filteredChildren.length > 0) {
          filtered.push({ ...node, children: filteredChildren });
        }
      }
    });
    return filtered;
  };

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'go':
      case 'rs':
        return <FileCode className="h-4 w-4" />;
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
        return <FileJson className="h-4 w-4" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return <FileImage className="h-4 w-4" />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'webm':
        return <FileVideo className="h-4 w-4" />;
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar':
        return <FileArchive className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, file: FileNode) => {
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, file: FileNode) => {
    e.preventDefault();
    if (file.type === "folder" && draggedFile && draggedFile.id !== file.id) {
      e.dataTransfer.dropEffect = "move";
      setDragOverFolder(file.path);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, targetFile: FileNode) => {
    e.preventDefault();
    setDragOverFolder(null);
    
    if (!draggedFile || draggedFile.id === targetFile.id) return;
    
    if (targetFile.type === "folder") {
      try {
        await updateFileMutation.mutateAsync({
          id: draggedFile.id,
          parentId: targetFile.id,
        });
      } catch (error) {
        console.error("Failed to move file:", error);
      }
    }
    
    setDraggedFile(null);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        await createFileMutation.mutateAsync({
          name: file.name,
          isFolder: false,
          parentId: null,
          content,
        });
      };
      
      reader.readAsText(file);
    }
  };

  // Copy/Cut/Paste operations
  const handleCopy = (file: FileNode) => {
    setClipboard({ file, operation: "copy" });
    toast({ title: "Copied", description: `${file.name} copied to clipboard` });
  };

  const handleCut = (file: FileNode) => {
    setClipboard({ file, operation: "cut" });
    toast({ title: "Cut", description: `${file.name} cut to clipboard` });
  };

  const handlePaste = async (targetId: number | null) => {
    if (!clipboard) return;

    if (clipboard.operation === "copy") {
      await createFileMutation.mutateAsync({
        name: `${clipboard.file.name} (copy)`,
        isFolder: clipboard.file.type === "folder",
        parentId: targetId,
        content: clipboard.file.content,
      });
    } else {
      await updateFileMutation.mutateAsync({
        id: clipboard.file.id,
        parentId: targetId,
      });
    }

    setClipboard(null);
  };

  // Render file tree recursively
  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFiles.has(node.id) || selectedFileId === node.id;
      const isDragOver = dragOverFolder === node.path;
      const isHidden = node.name.startsWith('.');

      if (isHidden && !showHidden) return null;

      return (
        <div key={node.id}>
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                className={`
                  flex items-center py-1 px-2 rounded-md cursor-pointer select-none
                  ${isSelected ? "bg-[var(--ecode-accent)] text-white" : "hover:bg-[var(--ecode-sidebar-hover)]"}
                  ${isDragOver ? "bg-[var(--ecode-accent)]/20" : ""}
                  ${isHidden ? "opacity-60" : ""}
                `}
                style={{ paddingLeft: `${8 + level * 16}px` }}
                onClick={() => {
                  if (node.type === "folder") {
                    toggleFolder(node.path);
                  } else {
                    onFileSelect?.(node);
                  }
                }}
                onDragStart={(e) => handleDragStart(e, node)}
                onDragOver={(e) => handleDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node)}
                draggable
              >
                {node.type === "folder" ? (
                  <>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-1 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-1 flex-shrink-0" />
                    )}
                    {isExpanded ? (
                      <FolderOpen className="h-4 w-4 mr-2 flex-shrink-0 text-[var(--ecode-blue)]" />
                    ) : (
                      <Folder className="h-4 w-4 mr-2 flex-shrink-0 text-[var(--ecode-blue)]" />
                    )}
                  </>
                ) : (
                  <div className="ml-5 mr-2 flex-shrink-0">
                    {getFileIcon(node.name)}
                  </div>
                )}
                <span className="truncate text-sm">{node.name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              {node.type === "folder" && (
                <>
                  <ContextMenuItem onClick={() => setNewItemDialog({ parentId: node.id, type: "file", name: "" })}>
                    <FilePlus className="h-4 w-4 mr-2" />
                    New File
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => setNewItemDialog({ parentId: node.id, type: "folder", name: "" })}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem onClick={() => setRenameDialog({ file: node, newName: node.name })}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCopy(node)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCut(node)}>
                <Scissors className="h-4 w-4 mr-2" />
                Cut
              </ContextMenuItem>
              {clipboard && (
                <ContextMenuItem onClick={() => handlePaste(node.type === "folder" ? node.id : node.parentId)}>
                  <Clipboard className="h-4 w-4 mr-2" />
                  Paste
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem 
                onClick={() => setDeleteConfirmDialog(node)} 
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          
          {node.type === "folder" && isExpanded && node.children && (
            <div>{renderFileTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const fileTree = buildFileTree(files);
  const filteredTree = filterFiles(fileTree, searchQuery);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-[var(--ecode-sidebar-bg)]">
        {/* Header */}
        <div className="p-3 border-b border-[var(--ecode-border)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[var(--ecode-text)]">Files</h3>
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNewItemDialog({ parentId: null, type: "file", name: "" })}
                  >
                    <FilePlus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New File</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNewItemDialog({ parentId: null, type: "folder", name: "" })}
                  >
                    <FolderPlus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Folder</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload Files</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowHidden(!showHidden)}
                  >
                    {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showHidden ? "Hide" : "Show"} Hidden Files</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-[var(--ecode-text-secondary)]" />
            <Input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 pr-7 text-xs bg-[var(--ecode-bg)] border-[var(--ecode-border)]"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* File Tree */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <div className="text-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto text-[var(--ecode-text-secondary)]" />
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="text-center py-4 text-[var(--ecode-text-secondary)] text-sm">
                {searchQuery ? "No files found" : "No files in this project"}
              </div>
            ) : (
              renderFileTree(filteredTree)
            )}
          </div>
        </ScrollArea>

        {/* Hidden file input for uploads */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* New File/Folder Dialog */}
        <Dialog open={!!newItemDialog} onOpenChange={() => setNewItemDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create New {newItemDialog?.type === "folder" ? "Folder" : "File"}
              </DialogTitle>
              <DialogDescription>
                Enter a name for the new {newItemDialog?.type === "folder" ? "folder" : "file"}.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newItemDialog?.name || ""}
              onChange={(e) => setNewItemDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder={newItemDialog?.type === "folder" ? "folder-name" : "filename.js"}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItemDialog?.name) {
                  createFileMutation.mutate({
                    name: newItemDialog.name,
                    isFolder: newItemDialog.type === "folder",
                    parentId: newItemDialog.parentId,
                    content: newItemDialog.type === "file" ? "" : undefined,
                  });
                }
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewItemDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newItemDialog?.name) {
                    createFileMutation.mutate({
                      name: newItemDialog.name,
                      isFolder: newItemDialog.type === "folder",
                      parentId: newItemDialog.parentId,
                      content: newItemDialog.type === "file" ? "" : undefined,
                    });
                  }
                }}
                disabled={!newItemDialog?.name || createFileMutation.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={!!renameDialog} onOpenChange={() => setRenameDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename {renameDialog?.file.type === "folder" ? "Folder" : "File"}</DialogTitle>
              <DialogDescription>
                Enter a new name for "{renameDialog?.file.name}".
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameDialog?.newName || ""}
              onChange={(e) => setRenameDialog(prev => prev ? { ...prev, newName: e.target.value } : null)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameDialog?.newName) {
                  updateFileMutation.mutate({
                    id: renameDialog.file.id,
                    name: renameDialog.newName,
                  });
                }
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (renameDialog?.newName) {
                    updateFileMutation.mutate({
                      id: renameDialog.file.id,
                      name: renameDialog.newName,
                    });
                  }
                }}
                disabled={!renameDialog?.newName || updateFileMutation.isPending}
              >
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmDialog} onOpenChange={() => setDeleteConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleteConfirmDialog?.type === "folder" ? "Folder" : "File"}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteConfirmDialog?.name}"?
                {deleteConfirmDialog?.type === "folder" && " This will also delete all files inside it."}
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmDialog) {
                    deleteFileMutation.mutate(deleteConfirmDialog.id);
                  }
                }}
                disabled={deleteFileMutation.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}