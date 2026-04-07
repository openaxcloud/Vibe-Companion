import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Cloud, 
  Upload, 
  Download, 
  Folder, 
  File,
  Image,
  Video,
  FileText,
  Archive,
  Share,
  Lock,
  Unlock,
  Settings,
  Trash2,
  Copy,
  ExternalLink,
  HardDrive,
  Globe,
  Shield,
  Zap
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface StorageFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  mimeType?: string;
  url: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  owner: string;
  accessCount: number;
  path: string;
}

interface StorageBucket {
  id: string;
  name: string;
  region: string;
  size: number;
  fileCount: number;
  isPublic: boolean;
  createdAt: string;
}

interface StorageStats {
  totalStorage: number;
  usedStorage: number;
  totalFiles: number;
  publicFiles: number;
  privateFiles: number;
  totalBandwidth: number;
}

export function ObjectStorage() {
  const [selectedBucket, setSelectedBucket] = useState<string>('repl-default-bucket');
  const [currentPath, setCurrentPath] = useState('/');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: buckets = [], isLoading: bucketsLoading } = useQuery<StorageBucket[]>({
    queryKey: ['/api/storage/buckets'],
  });

  const { data: filesData, isLoading: filesLoading } = useQuery<{ files: StorageFile[] }>({
    queryKey: ['/api/storage/files', selectedBucket, currentPath],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBucket) params.set('bucketId', selectedBucket);
      if (currentPath) params.set('path', currentPath);
      const res = await fetch(`/api/storage/files?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch files');
      return res.json();
    },
  });

  const files = filesData?.files || [];

  const { data: storageStatsData, isLoading: statsLoading } = useQuery<StorageStats>({
    queryKey: ['/api/storage/stats'],
  });

  const storageStats: StorageStats = storageStatsData || {
    totalStorage: 0,
    usedStorage: 0,
    totalFiles: 0,
    publicFiles: 0,
    privateFiles: 0,
    totalBandwidth: 0,
  };

  const isLoading = bucketsLoading || filesLoading || statsLoading;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: StorageFile) => {
    if (file.type === 'folder') return <Folder className="h-5 w-5" />;
    
    if (file.mimeType?.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
    if (file.mimeType?.startsWith('video/')) return <Video className="h-5 w-5 text-purple-500" />;
    if (file.mimeType?.includes('json') || file.mimeType?.includes('text')) return <FileText className="h-5 w-5 text-green-500" />;
    if (file.mimeType?.includes('zip') || file.mimeType?.includes('archive')) return <Archive className="h-5 w-5 text-orange-500" />;
    
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handleGetUploadParameters = async (fileName: string, fileType: string) => {
    // This would normally call your backend to get a presigned URL with file metadata
    return {
      method: 'PUT' as const,
      url: `https://storage.googleapis.com/bucket/uploads/${fileName}`
    };
  };

  const handleUploadComplete = (result: any) => {
    // Handle upload completion
    queryClient.invalidateQueries({ queryKey: ['/api/storage/files'] });
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const handleBulkAction = (action: 'delete' | 'makePublic' | 'makePrivate') => {
    // Handle bulk actions on selected files
    setSelectedFiles(new Set());
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      // Upload each file using presigned URLs
      for (const file of Array.from(files)) {
        const uploadParams = await handleGetUploadParameters(file.name, file.type);
        
        // Upload to presigned URL
        const response = await fetch(uploadParams.url, {
          method: uploadParams.method,
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });
        
        // Check response status
        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}: ${response.status} ${response.statusText}`);
        }
      }
      
      // Call completion handler only on success
      handleUploadComplete({ filesUploaded: files.length });
      
      // Show success toast
      toast({
        title: 'Upload Successful',
        description: `Successfully uploaded ${files.length} file${files.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Upload failed:', error);
      
      // Show error toast to user
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Cloud className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Cross-App Object Storage</h1>
            <p className="text-muted-foreground">
              Scalable cloud storage with global CDN, fine-grained access control, and cross-project sharing
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-file-upload"
          />
          <Button onClick={() => fileInputRef.current?.click()} data-testid="button-upload-files">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(storageStats.usedStorage)}</div>
            <p className="text-[11px] text-muted-foreground">
              of {formatFileSize(storageStats.totalStorage)} total
            </p>
            <Progress 
              value={(storageStats.usedStorage / storageStats.totalStorage) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Total Files</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storageStats.totalFiles}</div>
            <p className="text-[11px] text-muted-foreground">
              {storageStats.publicFiles} public, {storageStats.privateFiles} private
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Bandwidth</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(storageStats.totalBandwidth)}</div>
            <p className="text-[11px] text-muted-foreground">
              This month via global CDN
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.9%</div>
            <p className="text-[11px] text-muted-foreground">
              Uptime with edge caching
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="files" className="space-y-4">
        <TabsList>
          <TabsTrigger value="files">File Browser</TabsTrigger>
          <TabsTrigger value="buckets">Buckets</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* File Browser Tab */}
        <TabsContent value="files" className="space-y-4">
          {/* File Browser Controls */}
          <Card>
            <CardHeader>
              <CardTitle>File Browser</CardTitle>
              <CardDescription>
                Browse, manage, and share files across all your projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Navigation and Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map((bucket) => (
                        <SelectItem key={bucket.id} value={bucket.id}>
                          {bucket.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[13px] text-muted-foreground">
                    {currentPath}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedFiles.size > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[13px] text-muted-foreground">
                        {selectedFiles.size} selected
                      </span>
                      <Button variant="outline" size="sm" onClick={() => handleBulkAction('makePublic')}>
                        <Unlock className="h-4 w-4 mr-1" />
                        Make Public
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBulkAction('makePrivate')}>
                        <Lock className="h-4 w-4 mr-1" />
                        Make Private
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBulkAction('delete')}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                  <Select value={viewMode} onValueChange={(value: 'grid' | 'list') => setViewMode(value)}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="list">List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* File Grid/List */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:border-gray-300 ${
                        selectedFiles.has(file.id) ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => toggleFileSelection(file.id)}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
                          {getFileIcon(file)}
                        </div>
                        <div className="text-center">
                          <div className="text-[13px] font-medium truncate w-full">{file.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {file.type === 'file' ? formatFileSize(file.size) : '—'}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {file.isPublic ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Globe className="h-3 w-3 mr-1" />
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-600 border-gray-600">
                              <Lock className="h-3 w-3 mr-1" />
                              Private
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors hover:border-gray-300 ${
                        selectedFiles.has(file.id) ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => toggleFileSelection(file.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {getFileIcon(file)}
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-[13px] text-muted-foreground">
                            {file.owner} • {new Date(file.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-[13px] text-muted-foreground">
                          {file.type === 'file' ? formatFileSize(file.size) : '—'}
                        </div>
                        <div className="text-[13px] text-muted-foreground">
                          {file.accessCount} views
                        </div>
                        <Badge variant={file.isPublic ? 'default' : 'secondary'}>
                          {file.isPublic ? 'Public' : 'Private'}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Share className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buckets Tab */}
        <TabsContent value="buckets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Buckets</CardTitle>
              <CardDescription>
                Manage storage buckets across different regions and projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buckets.map((bucket) => (
                  <Card key={bucket.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{bucket.name}</span>
                        <Badge variant={bucket.isPublic ? 'default' : 'secondary'}>
                          {bucket.isPublic ? 'Public' : 'Private'}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Region: {bucket.region}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span>Storage Used:</span>
                          <span>{formatFileSize(bucket.size)}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span>Files:</span>
                          <span>{bucket.fileCount}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span>Created:</span>
                          <span>{new Date(bucket.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <Button variant="outline" size="sm" className="flex-1">
                            Browse
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Control & Permissions</CardTitle>
              <CardDescription>
                Manage file permissions, sharing settings, and access policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Public/Private Files */}
                <div>
                  <h3 className="text-[15px] font-medium mb-3">File Visibility</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center">
                          <Globe className="h-5 w-5 mr-2 text-green-500" />
                          Public Files
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{storageStats.publicFiles}</div>
                        <p className="text-[13px] text-muted-foreground">
                          Accessible via public URLs
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center">
                          <Lock className="h-5 w-5 mr-2 text-red-500" />
                          Private Files
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{storageStats.privateFiles}</div>
                        <p className="text-[13px] text-muted-foreground">
                          Require authentication
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Access Policies */}
                <div>
                  <h3 className="text-[15px] font-medium mb-3">Access Policies</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="font-medium">Cross-Project Access</div>
                          <div className="text-[13px] text-muted-foreground">
                            Allow files to be shared between projects
                          </div>
                        </div>
                      </div>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Globe className="h-5 w-5 text-green-500" />
                        <div>
                          <div className="font-medium">Public CDN Access</div>
                          <div className="text-[13px] text-muted-foreground">
                            Serve public files via global CDN
                          </div>
                        </div>
                      </div>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Lock className="h-5 w-5 text-red-500" />
                        <div>
                          <div className="font-medium">Signed URL Access</div>
                          <div className="text-[13px] text-muted-foreground">
                            Generate temporary access URLs for private files
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">Available</Badge>
                    </div>
                  </div>
                </div>

                {/* Sharing Settings */}
                <div>
                  <h3 className="text-[15px] font-medium mb-3">Sharing Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Default File Visibility</Label>
                      <Select defaultValue="private">
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="public">Public</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Link Expiration (Private Files)</Label>
                      <Select defaultValue="24h">
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1h">1 Hour</SelectItem>
                          <SelectItem value="24h">24 Hours</SelectItem>
                          <SelectItem value="7d">7 Days</SelectItem>
                          <SelectItem value="30d">30 Days</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>
                  Storage and bandwidth usage over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span>Storage Usage</span>
                      <span>{Math.round((storageStats.usedStorage / storageStats.totalStorage) * 100)}%</span>
                    </div>
                    <Progress value={(storageStats.usedStorage / storageStats.totalStorage) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span>Bandwidth (This Month)</span>
                      <span>{formatFileSize(storageStats.totalBandwidth)}</span>
                    </div>
                    <Progress value={52} />
                  </div>
                  <div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span>CDN Cache Hit Rate</span>
                      <span>94.2%</span>
                    </div>
                    <Progress value={94} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Popular Files */}
            <Card>
              <CardHeader>
                <CardTitle>Most Accessed Files</CardTitle>
                <CardDescription>
                  Files with the highest access counts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files
                    .filter(f => f.type === 'file')
                    .sort((a, b) => b.accessCount - a.accessCount)
                    .slice(0, 5)
                    .map((file) => (
                      <div key={file.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getFileIcon(file)}
                          <div>
                            <div className="text-[13px] font-medium">{file.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>
                        <div className="text-[13px] font-medium">
                          {file.accessCount} views
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Global CDN Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Global CDN Performance</CardTitle>
              <CardDescription>
                File delivery performance across global edge locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">12ms</div>
                  <div className="text-[13px] text-muted-foreground">Avg Response Time</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">150+</div>
                  <div className="text-[13px] text-muted-foreground">Edge Locations</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">99.9%</div>
                  <div className="text-[13px] text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">94%</div>
                  <div className="text-[13px] text-muted-foreground">Cache Hit Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}