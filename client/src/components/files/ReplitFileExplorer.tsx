import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileMinus,
  Plus,
  MoreHorizontal,
  Search,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  Edit,
  Copy,
  Move,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GitBranch,
  Star,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FileNode {
  id: number;
  name: string;
  path: string;
  type: "file" | "folder";
  size: number;
  lastModified: Date;
  language?: string;
  isReadOnly?: boolean;
  isHidden?: boolean;
  isStarred?: boolean;
  permissions?: "read" | "write" | "execute";
  children?: FileNode[];
  parent?: FileNode;
}

interface ReplitFileExplorerProps {
  projectId: number;
  onFileSelect: (file: FileNode) => void;
  onFileCreate: (path: string, type: "file" | "folder") => void;
  selectedFile?: FileNode | null;
  className?: string;
  showHidden?: boolean;
  readonly?: boolean;
}

export function ReplitFileExplorer({
  projectId,
  onFileSelect,
  onFileCreate,
  selectedFile,
  className = "",
  showHidden = false,
  readonly = false,
}: ReplitFileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["/"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedItem, setDraggedItem] = useState<FileNode | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"file" | "folder">("file");
  const [createPath, setCreatePath] = useState("");
  const [newItemName, setNewItemName] = useState("");

  const { toast } = useToast();

  // Récupération de l'arbre de fichiers
  const { data: fileTree = [], isLoading, refetch } = useQuery<FileNode[]>({
    queryKey: ["/api/projects", projectId, "files"],
    staleTime: 30000, // 30 secondes
  });

  // Mutations pour les opérations sur les fichiers
  const createFileMutation = useMutation({
    mutationFn: async ({ path, type, name }: { path: string; type: "file" | "folder"; name: string }) => {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${path}/${name}`, type }),
      });
      if (!response.ok) throw new Error("Failed to create file/folder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setCreateDialogOpen(false);
      setNewItemName("");
      toast({
        title: "Created successfully",
        description: `${createType === "file" ? "File" : "Folder"} created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (file: FileNode) => {
      const response = await fetch(`/api/projects/${projectId}/files/${file.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete file/folder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      toast({
        title: "Deleted successfully",
        description: "File/folder deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ file, newName }: { file: FileNode; newName: string }) => {
      const response = await fetch(`/api/projects/${projectId}/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) throw new Error("Failed to rename file/folder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      toast({
        title: "Renamed successfully",
        description: "File/folder renamed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rename failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fonction pour obtenir l'icône appropriée selon le type de fichier
  const getFileIcon = (file: FileNode) => {
    if (file.type === "folder") {
      return expandedFolders.has(file.path) ? (
        <FolderOpen className="h-4 w-4 text-[var(--replit-blue)]" />
      ) : (
        <Folder className="h-4 w-4 text-[var(--replit-blue)]" />
      );
    }

    // Icônes par extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const iconClass = "h-4 w-4 text-[var(--replit-text-secondary)]";

    switch (extension) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'cs':
      case 'php':
      case 'rb':
      case 'go':
      case 'rs':
        return <FileCode className={iconClass} style={{ color: 'var(--replit-green)' }} />;
      
      case 'html':
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return <FileCode className={iconClass} style={{ color: 'var(--replit-orange)' }} />;
      
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
        return <FileText className={iconClass} style={{ color: 'var(--replit-purple)' }} />;
      
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return <FileImage className={iconClass} style={{ color: 'var(--replit-blue)' }} />;
      
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return <FileVideo className={iconClass} style={{ color: 'var(--replit-red)' }} />;
      
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
        return <FileAudio className={iconClass} style={{ color: 'var(--replit-warning)' }} />;
      
      default:
        return <File className={iconClass} />;
    }
  };

  // Gestion de l'expansion/contraction des dossiers
  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Filtrage des fichiers selon la recherche
  const filterFiles = (files: FileNode[]): FileNode[] => {
    if (!searchQuery) {
      return showHidden ? files : files.filter(file => !file.isHidden);
    }

    return files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVisibility = showHidden || !file.isHidden;
      return matchesSearch && matchesVisibility;
    }).concat(
      files
        .filter(file => file.type === "folder")
        .map(folder => ({
          ...folder,
          children: folder.children ? filterFiles(folder.children) : []
        }))
        .filter(folder => folder.children && folder.children.length > 0)
    );
  };

  // Rendu récursif de l'arbre de fichiers
  const renderFileTree = (files: FileNode[], level = 0) => {
    const filteredFiles = filterFiles(files);

    return filteredFiles.map((file) => (
      <div key={file.id} className="select-none">
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={`flex items-center py-1 px-2 rounded-md cursor-pointer replit-transition group ${
                selectedFile?.id === file.id
                  ? "bg-[var(--replit-accent)] text-white"
                  : "text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
              }`}
              style={{ paddingLeft: `${8 + level * 16}px` }}
              onClick={() => {
                if (file.type === "folder") {
                  toggleFolder(file.path);
                } else {
                  onFileSelect(file);
                }
              }}
              onDoubleClick={() => {
                if (file.type === "file") {
                  onFileSelect(file);
                }
              }}
              draggable={!readonly}
              onDragStart={() => setDraggedItem(file)}
              onDragEnd={() => setDraggedItem(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedItem && file.type === "folder" && draggedItem.id !== file.id) {
                  // Logique de déplacement de fichier
                  console.log("Move", draggedItem.name, "to", file.path);
                }
              }}
            >
              {/* Flèche d'expansion pour les dossiers */}
              {file.type === "folder" && (
                <div className="flex-shrink-0 mr-1">
                  {expandedFolders.has(file.path) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </div>
              )}

              {/* Icône du fichier/dossier */}
              <div className="flex-shrink-0 mr-2">
                {getFileIcon(file)}
              </div>

              {/* Nom du fichier */}
              <span className="truncate flex-1 text-sm">{file.name}</span>

              {/* Indicateurs d'état */}
              <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {file.isStarred && (
                  <Star className="h-3 w-3 text-[var(--replit-warning)] fill-current" />
                )}
                {file.isReadOnly && (
                  <Lock className="h-3 w-3 text-[var(--replit-text-secondary)]" />
                )}
                {file.isHidden && (
                  <EyeOff className="h-3 w-3 text-[var(--replit-text-secondary)]" />
                )}
              </div>

              {/* Menu actions */}
              {!readonly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 bg-[var(--replit-surface)] border-[var(--replit-border)]">
                    <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                      <Edit className="mr-2 h-3 w-3" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                      <Copy className="mr-2 h-3 w-3" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                      <Move className="mr-2 h-3 w-3" />
                      Move
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
                    <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                      <Download className="mr-2 h-3 w-3" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
                    <DropdownMenuItem
                      className="text-[var(--replit-danger)] hover:bg-[var(--replit-danger)]/10"
                      onClick={() => deleteFileMutation.mutate(file)}
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </ContextMenuTrigger>

          {!readonly && (
            <ContextMenuContent className="w-48 bg-[var(--replit-surface)] border-[var(--replit-border)]">
              <ContextMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Plus className="mr-2 h-3 w-3" />
                New File
              </ContextMenuItem>
              <ContextMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Folder className="mr-2 h-3 w-3" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-[var(--replit-border)]" />
              <ContextMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Upload className="mr-2 h-3 w-3" />
                Upload Files
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-[var(--replit-border)]" />
              <ContextMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Copy className="mr-2 h-3 w-3" />
                Copy
              </ContextMenuItem>
              <ContextMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Edit className="mr-2 h-3 w-3" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-[var(--replit-border)]" />
              <ContextMenuItem className="text-[var(--replit-danger)] hover:bg-[var(--replit-danger)]/10">
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>

        {/* Enfants du dossier */}
        {file.type === "folder" && 
         expandedFolders.has(file.path) && 
         file.children && 
         file.children.length > 0 && (
          <div className="ml-4">
            {renderFileTree(file.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const handleCreateNew = (type: "file" | "folder", parentPath = "/") => {
    setCreateType(type);
    setCreatePath(parentPath);
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!newItemName.trim()) return;
    
    createFileMutation.mutate({
      path: createPath,
      type: createType,
      name: newItemName.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-[var(--replit-text-secondary)]" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex flex-col ${className}`}>
        {/* Header avec recherche et actions */}
        <div className="p-3 border-b border-[var(--replit-border)]">
          <div className="flex items-center space-x-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-[var(--replit-text-secondary)]" />
              <Input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs bg-[var(--replit-surface-secondary)] border-[var(--replit-border)] text-[var(--replit-text)] placeholder:text-[var(--replit-text-secondary)]"
              />
            </div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[var(--replit-text-secondary)] hover:text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>

          {/* Actions de création */}
          {!readonly && (
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
                onClick={() => handleCreateNew("file")}
              >
                <Plus className="h-3 w-3 mr-1" />
                File
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
                onClick={() => handleCreateNew("folder")}
              >
                <Folder className="h-3 w-3 mr-1" />
                Folder
              </Button>
            </div>
          )}
        </div>

        {/* Arbre de fichiers */}
        <div className="flex-1 overflow-y-auto replit-scrollbar">
          <div className="p-2">
            {fileTree.length > 0 ? (
              renderFileTree(fileTree)
            ) : (
              <div className="text-center py-8 text-[var(--replit-text-secondary)]">
                <FileMinus className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No files found</p>
                {!readonly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => handleCreateNew("file")}
                  >
                    Create your first file
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dialog de création */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-[var(--replit-surface)] border-[var(--replit-border)]">
            <DialogHeader>
              <DialogTitle className="text-[var(--replit-text)]">
                Create New {createType === "file" ? "File" : "Folder"}
              </DialogTitle>
              <DialogDescription className="text-[var(--replit-text-secondary)]">
                Enter a name for the new {createType}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <Input
                type="text"
                placeholder={`${createType === "file" ? "filename.txt" : "folder-name"}`}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateSubmit()}
                className="bg-[var(--replit-surface-secondary)] border-[var(--replit-border)] text-[var(--replit-text)]"
                autoFocus
              />
            </div>
            
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
                className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={!newItemName.trim() || createFileMutation.isPending}
                className="bg-[var(--replit-accent)] hover:bg-[var(--replit-accent-hover)] text-white"
              >
                {createFileMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}