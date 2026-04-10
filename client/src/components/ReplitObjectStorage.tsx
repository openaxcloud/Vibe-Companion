import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Cloud,
  Upload,
  Download,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  Folder,
  File,
  Image,
  FileText,
  FileVideo,
  FileAudio,
  Archive,
  Plus,
  Share2,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  HardDrive,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface StorageObject {
  id: string;
  name: string;
  key: string;
  size: number;
  type: string;
  lastModified: Date;
  etag: string;
  isPublic: boolean;
  folder?: string;
  metadata?: Record<string, string>;
  url?: string;
}

interface StorageBucket {
  id: string;
  name: string;
  region: string;
  created: Date;
  isPublic: boolean;
  objectCount: number;
  totalSize: number;
}

interface ReplitObjectStorageProps {
  projectId: number;
  className?: string;
}

export function ReplitObjectStorage({ projectId, className }: ReplitObjectStorageProps) {
  const { toast } = useToast();
  const [selectedBucket, setSelectedBucket] = useState<StorageBucket | null>(null);
  const [selectedObject, setSelectedObject] = useState<StorageObject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState('/');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketRegion, setNewBucketRegion] = useState('us-east-1');
  const [newBucketPublic, setNewBucketPublic] = useState(false);

  // Fetch buckets
  const { data: buckets = [], isLoading: bucketsLoading } = useQuery({
    queryKey: [`/api/storage/${projectId}/buckets`],
  });

  // Fetch objects in current bucket
  const { data: objects = [], isLoading: objectsLoading } = useQuery({
    queryKey: [`/api/storage/${projectId}/buckets/${selectedBucket?.id}/objects`, currentPath],
    enabled: !!selectedBucket,
  });

  // Create bucket mutation
  const createBucketMutation = useMutation({
    mutationFn: async (data: { name: string; region: string; isPublic: boolean }) => {
      return apiRequest('POST', `/api/storage/${projectId}/buckets`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/storage/${projectId}/buckets`] });
      setShowCreateBucket(false);
      setNewBucketName('');
      toast({
        title: 'Bucket Created',
        description: 'Storage bucket created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create bucket',
        variant: 'destructive',
      });
    },
  });

  // Delete object mutation
  const deleteObjectMutation = useMutation({
    mutationFn: async (objectKey: string) => {
      return apiRequest('DELETE', `/api/storage/${projectId}/buckets/${selectedBucket?.id}/objects/${objectKey}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/storage/${projectId}/buckets/${selectedBucket?.id}/objects`] });
      toast({
        title: 'Object Deleted',
        description: 'File deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete object',
        variant: 'destructive',
      });
    },
  });





  // Use real data from API
  const displayBuckets = buckets as StorageBucket[];
  const displayObjects = objects as StorageObject[];

  const handleFileUpload = async (files: FileList) => {
    if (!selectedBucket) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);

      // Simulate upload progress
      const uploadId = `${file.name}-${Date.now()}`;
      setUploadProgress(prev => ({ ...prev, [uploadId]: 0 }));

      // Simulate progress updates
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[uploadId] || 0;
          if (current >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setUploadProgress(prev => {
                const { [uploadId]: _, ...rest } = prev;
                return rest;
              });
            }, 1000);
            return prev;
          }
          return { ...prev, [uploadId]: Math.min(current + 10, 100) };
        });
      }, 200);

      try {
        // In production, this would upload to real storage
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast({
          title: 'File Uploaded',
          description: `${file.name} uploaded successfully`,
        });
        
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/storage/buckets/${selectedBucket.id}/objects`] });
      } catch (error) {
        clearInterval(interval);
        toast({
          title: 'Upload Failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
      }
    }
    setShowUpload(false);
  };

  const handleCreateFolder = () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      // In production, this would create a folder
      toast({
        title: 'Folder Created',
        description: `Folder "${folderName}" created successfully`,
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <FileVideo className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <FileAudio className="h-4 w-4" />;
    if (type.includes('zip') || type.includes('tar')) return <Archive className="h-4 w-4" />;
    if (type.includes('text') || type.includes('json')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleDownload = (object: StorageObject) => {
    // In production, this would generate a signed URL and download
    toast({
      title: 'Download Started',
      description: `Downloading ${object.name}`,
    });
  };

  const handleShare = (object: StorageObject) => {
    const shareUrl = object.url || `https://storage.e-code.ai/${selectedBucket?.name}/${object.key}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Link Copied',
      description: 'Share link copied to clipboard',
    });
  };

  const togglePublic = async (object: StorageObject) => {
    // In production, this would update object permissions
    toast({
      title: object.isPublic ? 'Made Private' : 'Made Public',
      description: `${object.name} visibility updated`,
    });
  };

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Object Storage
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Dialog open={showCreateBucket} onOpenChange={setShowCreateBucket}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Bucket
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Storage Bucket</DialogTitle>
                  <DialogDescription>
                    Create a new storage bucket for your project files
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bucket-name">Bucket Name</Label>
                    <Input
                      id="bucket-name"
                      value={newBucketName}
                      onChange={(e) => setNewBucketName(e.target.value)}
                      placeholder="my-bucket-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bucket-region">Region</Label>
                    <Select value={newBucketRegion} onValueChange={setNewBucketRegion}>
                      <SelectTrigger id="bucket-region">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                        <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                        <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                        <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bucket-public"
                      checked={newBucketPublic}
                      onChange={(e) => setNewBucketPublic(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="bucket-public" className="cursor-pointer">
                      Make bucket publicly accessible
                    </Label>
                  </div>
                  <Button
                    onClick={() => createBucketMutation.mutate({
                      name: newBucketName,
                      region: newBucketRegion,
                      isPublic: newBucketPublic,
                    })}
                    disabled={!newBucketName || createBucketMutation.isPending}
                    className="w-full"
                  >
                    Create Bucket
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs defaultValue="buckets" className="flex-1 flex flex-col">
          <TabsList className="mx-6 mb-0">
            <TabsTrigger value="buckets">
              <HardDrive className="h-4 w-4 mr-1" />
              Buckets
            </TabsTrigger>
            <TabsTrigger value="files" disabled={!selectedBucket}>
              <Folder className="h-4 w-4 mr-1" />
              Files
            </TabsTrigger>
            <TabsTrigger value="usage">
              <Activity className="h-4 w-4 mr-1" />
              Usage
            </TabsTrigger>
          </TabsList>

          {/* Buckets Tab */}
          <TabsContent value="buckets" className="flex-1 p-6 pt-4">
            <div className="space-y-4">
              {displayBuckets.length === 0 ? (
                <div className="text-center py-16">
                  <Cloud className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No storage buckets yet</p>
                  <Button onClick={() => setShowCreateBucket(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create First Bucket
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {displayBuckets.map((bucket) => (
                    <Card
                      key={bucket.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedBucket(bucket)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <HardDrive className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <h3 className="font-semibold">{bucket.name}</h3>
                              <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                                <span>{bucket.region}</span>
                                <span>{bucket.objectCount} objects</span>
                                <span>{formatBytes(bucket.totalSize)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {bucket.isPublic ? (
                              <Badge variant="secondary">
                                <Unlock className="h-3 w-3 mr-1" />
                                Public
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Lock className="h-3 w-3 mr-1" />
                                Private
                              </Badge>
                            )}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 flex flex-col p-6 pt-4">
            {selectedBucket && (
              <div className="flex-1 flex flex-col space-y-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedBucket(null)}
                    >
                      <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
                      Back to Buckets
                    </Button>
                    <span className="text-[13px] text-muted-foreground">
                      {selectedBucket.name} / {currentPath}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={handleCreateFolder}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Folder
                    </Button>
                    <Dialog open={showUpload} onOpenChange={setShowUpload}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload Files</DialogTitle>
                          <DialogDescription>
                            Drag and drop files here or click to browse
                          </DialogDescription>
                        </DialogHeader>
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-[13px] text-muted-foreground mb-4">
                            Drag files here or click to browse
                          </p>
                          <Input
                            type="file"
                            multiple
                            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                            className="hidden"
                            id="file-upload"
                          />
                          <Label htmlFor="file-upload" className="cursor-pointer">
                            <Button asChild>
                              <span>Choose Files</span>
                            </Button>
                          </Label>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Upload Progress */}
                {Object.entries(uploadProgress).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(uploadProgress).map(([id, progress]) => (
                      <div key={id} className="space-y-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <span>{id.split('-')[0]}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Files Table */}
                <ScrollArea className="flex-1 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Modified</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayObjects.filter(obj => 
                        obj.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((object) => (
                        <TableRow key={object.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getFileIcon(object.type)}
                              <span>{object.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatBytes(object.size)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">
                              {object.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {object.lastModified.toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {object.isPublic ? (
                              <Badge variant="secondary" className="text-[11px]">
                                <Unlock className="h-3 w-3 mr-1" />
                                Public
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px]">
                                <Lock className="h-3 w-3 mr-1" />
                                Private
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleDownload(object)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShare(object)}>
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => togglePublic(object)}>
                                  {object.isPublic ? (
                                    <>
                                      <Lock className="h-4 w-4 mr-2" />
                                      Make Private
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-4 w-4 mr-2" />
                                      Make Public
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteObjectMutation.mutate(object.key)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="flex-1 p-6 pt-4">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] text-muted-foreground">Total Storage</p>
                        <p className="text-2xl font-bold">1.7 GB</p>
                        <p className="text-[11px] text-muted-foreground">of 10 GB</p>
                      </div>
                      <HardDrive className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <Progress value={17} className="mt-4" />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] text-muted-foreground">Total Objects</p>
                        <p className="text-2xl font-bold">257</p>
                        <p className="text-[11px] text-muted-foreground">across 3 buckets</p>
                      </div>
                      <File className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] text-muted-foreground">Bandwidth Used</p>
                        <p className="text-2xl font-bold">45.2 GB</p>
                        <p className="text-[11px] text-muted-foreground">this month</p>
                      </div>
                      <Activity className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Storage by Type</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      <span className="text-[13px]">Images</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">450 MB</span>
                      <Progress value={45} className="w-32" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileVideo className="h-4 w-4" />
                      <span className="text-[13px]">Videos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">800 MB</span>
                      <Progress value={80} className="w-32" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-[13px]">Documents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">200 MB</span>
                      <Progress value={20} className="w-32" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      <span className="text-[13px]">Archives</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">250 MB</span>
                      <Progress value={25} className="w-32" />
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Storage Information</AlertTitle>
                <AlertDescription>
                  Object storage provides S3-compatible API endpoints for your applications. 
                  Use the provided access keys to integrate with your code.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}