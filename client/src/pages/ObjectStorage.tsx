import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  HardDrive, 
  Upload, 
  Download, 
  Trash2, 
  FolderPlus,
  MoreVertical,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  File,
  Folder,
  Search,
  Copy,
  Share2,
  Lock,
  Unlock,
  Eye,
  Info,
  ChevronRight,
  Cloud,
  RefreshCw,
  ExternalLink,
  Key
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ECodeLoading } from "@/components/ECodeLoading";

interface StorageFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  mimeType: string;
  lastModified: string;
  url?: string;
  isPublic: boolean;
  metadata?: Record<string, any>;
}

interface StorageFolder {
  id: string;
  name: string;
  path: string;
  fileCount: number;
  size: number;
  lastModified: string;
}

interface StorageStats {
  totalSize: number;
  usedSize: number;
  fileCount: number;
  folderCount: number;
  bandwidth: {
    used: number;
    limit: number;
  };
}

export default function ObjectStorage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("files");
  const [currentPath, setCurrentPath] = useState("/");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form state
  const [newFolderName, setNewFolderName] = useState("");

  // Fetch storage stats
  const { data: stats, isLoading: statsLoading } = useQuery<StorageStats>({
    queryKey: ['/api/storage/stats'],
  });

  // Fetch files and folders
  const { data: items = { files: [], folders: [] }, isLoading: itemsLoading } = useQuery<{
    files: StorageFile[];
    folders: StorageFolder[];
  }>({
    queryKey: ['/api/storage/list', currentPath],
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0);
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);
      
      const res = await apiRequest('POST', '/api/storage/upload', formData);
      if (!res.ok) throw new Error('Failed to upload file');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storage/stats'] });
      setUploadDialogOpen(false);
      setUploadProgress(0);
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully",
      });
    }
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/storage/folder', {
        name,
        path: currentPath
      });
      if (!res.ok) throw new Error('Failed to create folder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/list'] });
      setCreateFolderDialogOpen(false);
      setNewFolderName("");
      toast({
        title: "Folder created",
        description: "The folder has been created successfully",
      });
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await apiRequest('DELETE', `/api/storage/file/${fileId}`);
      if (!res.ok) throw new Error('Failed to delete file');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storage/stats'] });
      toast({
        title: "File deleted",
        description: "The file has been removed",
      });
    }
  });

  // Toggle file visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ fileId, isPublic }: { fileId: string; isPublic: boolean }) => {
      const res = await apiRequest('PATCH', `/api/storage/file/${fileId}`, { isPublic });
      if (!res.ok) throw new Error('Failed to update file visibility');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/list'] });
      toast({
        title: "Visibility updated",
        description: "File visibility has been changed",
      });
    }
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Film className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      case 'archive': return <Archive className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = items.files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (statsLoading || itemsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="relative h-full min-h-[calc(100vh-200px)]">
          <div className="absolute inset-0 flex items-center justify-center">
            <ECodeLoading size="lg" text="Loading storage..." />
          </div>
        </div>
      </div>
    );
  }

  const usagePercentage = stats ? (stats.usedSize / stats.totalSize) * 100 : 0;
  const bandwidthPercentage = stats ? (stats.bandwidth.used / stats.bandwidth.limit) * 100 : 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Object Storage</h1>
          <p className="text-muted-foreground">
            Store and manage your files in the cloud
          </p>
        </div>
        <div className="space-x-2">
          <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-new-folder">
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>
                  Enter a name for your new folder
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="folder-name">Folder Name</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My Folder"
                  className="mt-2"
                  data-testid="input-folder-name"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateFolderDialogOpen(false)} data-testid="button-cancel-folder">
                  Cancel
                </Button>
                <Button 
                  onClick={() => createFolderMutation.mutate(newFolderName)}
                  disabled={!newFolderName || createFolderMutation.isPending}
                  data-testid="button-create-folder"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-files">
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Files</DialogTitle>
                <DialogDescription>
                  Select files to upload to your storage
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-[13px] text-muted-foreground mb-2">
                    Drag and drop files here, or click to browse
                  </p>
                  <Input
                    type="file"
                    multiple
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFileMutation.mutate(file);
                    }}
                  />
                  <Button variant="outline" size="sm" asChild data-testid="button-browse-files">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                </div>
                {uploadProgress > 0 && (
                  <div className="mt-4">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-[13px] text-muted-foreground mt-2 text-center">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(stats?.usedSize || 0)}
            </div>
            <Progress value={usagePercentage} className="h-2 mt-2" />
            <p className="text-[11px] text-muted-foreground mt-1">
              {formatFileSize(stats?.totalSize || 0)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.fileCount || 0}</div>
            <p className="text-[11px] text-muted-foreground">
              Across {stats?.folderCount || 0} folders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bandwidth Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(stats?.bandwidth.used || 0)}
            </div>
            <Progress value={bandwidthPercentage} className="h-2 mt-2" />
            <p className="text-[11px] text-muted-foreground mt-1">
              {formatFileSize(stats?.bandwidth.limit || 0)} limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storage Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[15px] font-semibold">S3 Compatible</div>
            <p className="text-[11px] text-muted-foreground">
              CDN enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-files"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-storage">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files" data-testid="tab-files">Files & Folders</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span>/</span>
            {currentPath.split('/').filter(Boolean).map((part, index) => (
              <div key={index} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                <span>{part}</span>
              </div>
            ))}
          </div>

          {/* Folders */}
          {items.folders.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.folders.map((folder) => (
                <Card 
                  key={folder.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setCurrentPath(folder.path)}
                  data-testid={`card-folder-${folder.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      {folder.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-[13px] text-muted-foreground">
                      <span>{folder.fileCount} files</span>
                      <span>{formatFileSize(folder.size)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Files */}
          <div className="grid gap-4">
            {filteredFiles.map((file) => (
              <Card key={file.id} data-testid={`card-file-${file.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <CardTitle className="text-base">{file.name}</CardTitle>
                        <CardDescription className="text-[11px]">
                          {formatFileSize(file.size)} • {file.lastModified}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={file.isPublic ? "default" : "secondary"}>
                        {file.isPublic ? (
                          <Unlock className="h-3 w-3 mr-1" />
                        ) : (
                          <Lock className="h-3 w-3 mr-1" />
                        )}
                        {file.isPublic ? "Public" : "Private"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-file-menu-${file.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem data-testid={`menu-download-${file.id}`}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          {file.url && (
                            <DropdownMenuItem onClick={() => copyToClipboard(file.url!)} data-testid={`menu-copy-url-${file.id}`}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy URL
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => toggleVisibilityMutation.mutate({
                              fileId: file.id,
                              isPublic: !file.isPublic
                            })}
                            data-testid={`menu-toggle-visibility-${file.id}`}
                          >
                            {file.isPublic ? (
                              <>
                                <Lock className="mr-2 h-4 w-4" />
                                Make Private
                              </>
                            ) : (
                              <>
                                <Unlock className="mr-2 h-4 w-4" />
                                Make Public
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={`menu-share-${file.id}`}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteFileMutation.mutate(file.id)}
                            data-testid={`menu-delete-${file.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                {file.url && file.isPublic && (
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded text-[11px]">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate flex-1">{file.url}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => copyToClipboard(file.url!)}
                        data-testid={`button-copy-url-${file.id}`}
                      >
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {filteredFiles.length === 0 && items.folders.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No files yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first file to get started
                </p>
                <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-empty">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
              <CardDescription>
                Configure your object storage preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Default Visibility</h3>
                <p className="text-[13px] text-muted-foreground mb-3">
                  Choose whether new files are public or private by default
                </p>
                <select className="w-full p-2 rounded-md border bg-background" data-testid="select-default-visibility">
                  <option value="private">Private (Recommended)</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div>
                <h3 className="font-medium mb-2">CDN Settings</h3>
                <p className="text-[13px] text-muted-foreground mb-3">
                  Enable CDN for faster file delivery worldwide
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="default">CDN Enabled</Badge>
                  <span className="text-[13px] text-muted-foreground">
                    Files are served from edge locations
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Access Keys</h3>
                <p className="text-[13px] text-muted-foreground mb-3">
                  Generate API keys for programmatic access
                </p>
                <Button variant="outline" data-testid="button-generate-key">
                  <Key className="mr-2 h-4 w-4" />
                  Generate Access Key
                </Button>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>S3 Compatible API</AlertTitle>
            <AlertDescription>
              Use any S3-compatible SDK or tool to access your storage programmatically.
              Your bucket name is <code className="font-mono">ecode-{stats?.fileCount}</code>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}