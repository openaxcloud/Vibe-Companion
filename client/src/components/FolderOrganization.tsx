import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Folder, 
  FolderPlus, 
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  SortAsc,
  Filter,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FolderOrganizationProps {
  projectId: number;
  files?: any[];
  onFileMove?: (fileId: number, folderId: string) => void;
}

interface FolderItem {
  id: string;
  name: string;
  type: string;
  fileCount: number;
  color?: string;
  expanded?: boolean;
}

export function FolderOrganization({ projectId, files = [], onFileMove }: FolderOrganizationProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const { toast } = useToast();

  // Fetch folders from API
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['/api/folders', projectId],
    enabled: !!projectId
  });

  // Create new folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/folders', {
        projectId,
        name
      });
    },
    onSuccess: () => {
      toast({
        title: "Folder Created",
        description: "New folder has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/folders', projectId] });
      setNewFolderName('');
      setShowNewFolder(false);
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create folder",
        variant: "destructive"
      });
    }
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return await apiRequest('DELETE', `/api/folders/${folderId}`);
    },
    onSuccess: () => {
      toast({
        title: "Folder Deleted",
        description: "Folder has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/folders', projectId] });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete folder",
        variant: "destructive"
      });
    }
  });

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleFileDropToFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const fileId = parseInt(e.dataTransfer.getData('fileId'));
    if (fileId && onFileMove) {
      onFileMove(fileId, folderId);
    }
  };

  const filteredFolders = folders.filter((folder: FolderItem) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Default folder suggestions if no folders exist
  const defaultFolders = [
    { name: 'src', type: 'source', color: 'blue' },
    { name: 'components', type: 'components', color: 'green' },
    { name: 'styles', type: 'styles', color: 'purple' },
    { name: 'utils', type: 'utilities', color: 'orange' },
    { name: 'tests', type: 'tests', color: 'red' },
    { name: 'docs', type: 'documentation', color: 'gray' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          <h3 className="text-[15px] font-semibold">Folder Organization</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewFolder(!showNewFolder)}
        >
          <FolderPlus className="h-4 w-4 mr-1" />
          New Folder
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="icon" variant="outline">
          <SortAsc className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="flex gap-2 p-3 border rounded-lg bg-muted/50">
          <Input
            placeholder="Enter folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <Button 
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim() || createFolderMutation.isPending}
          >
            Create
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setShowNewFolder(false);
              setNewFolderName('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Folders List */}
      <div className="space-y-2">
        {filteredFolders.length > 0 ? (
          filteredFolders.map((folder: FolderItem) => (
            <div
              key={folder.id}
              className="border rounded-lg hover:bg-surface-hover-solid transition-colors"
              onDrop={(e) => handleFileDropToFolder(e, folder.id)}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="p-0.5 hover:bg-surface-hover-solid rounded"
                  >
                    {expandedFolders.has(folder.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedFolders.has(folder.id) ? (
                    <FolderOpen className="h-4 w-4 text-primary" />
                  ) : (
                    <Folder className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium">{folder.name}</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {folder.fileCount || 0} files
                  </Badge>
                  {folder.type && (
                    <Badge variant="outline" className="text-[11px]">
                      {folder.type}
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {/* Rename logic */}}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {/* Move logic */}}>
                      Move
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteFolderMutation.mutate(folder.id)}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Expanded folder content */}
              {expandedFolders.has(folder.id) && (
                <div className="px-10 pb-3">
                  <div className="space-y-1">
                    {files
                      .filter((file: any) => file.folderId === folder.id)
                      .map((file: any) => (
                        <div 
                          key={file.id}
                          className="flex items-center gap-2 py-1 px-2 hover:bg-surface-hover-solid rounded text-[13px]"
                        >
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span>{file.name}</span>
                        </div>
                      ))}
                    {files.filter((file: any) => file.folderId === folder.id).length === 0 && (
                      <p className="text-[13px] text-muted-foreground italic">
                        Drop files here to organize
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">No folders yet</p>
                <p className="text-[13px] mb-6">Create folders to organize your project files</p>
                
                {/* Folder suggestions */}
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide mb-3">Quick create:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {defaultFolders.map((suggestion) => (
                      <Button
                        key={suggestion.name}
                        size="sm"
                        variant="outline"
                        onClick={() => createFolderMutation.mutate(suggestion.name)}
                        disabled={createFolderMutation.isPending}
                      >
                        <FolderPlus className="h-3 w-3 mr-1" />
                        {suggestion.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tips */}
      {folders.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader className="py-3">
            <CardTitle className="text-[13px]">Organization Tips</CardTitle>
          </CardHeader>
          <CardContent className="py-3 space-y-1 text-[11px] text-muted-foreground">
            <p>• Drag and drop files into folders to organize them</p>
            <p>• Use descriptive folder names for better organization</p>
            <p>• Create nested folders for complex projects</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}