import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Image, 
  Archive,
  X,
  CheckCircle,
  AlertCircle,
  Folder
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface FileUploadDropzoneProps {
  projectId: number;
  currentPath?: string;
  onUploadComplete?: () => void;
  className?: string;
}

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const FILE_ICONS: Record<string, JSX.Element> = {
  'image': <Image className="h-4 w-4" />,
  'archive': <Archive className="h-4 w-4" />,
  'folder': <Folder className="h-4 w-4" />,
  'default': <FileText className="h-4 w-4" />
};

export function FileUploadDropzone({ 
  projectId, 
  currentPath = '/', 
  onUploadComplete,
  className 
}: FileUploadDropzoneProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const processFiles = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
    setIsUploading(true);

    let successCount = 0;
    
    // Upload files using real API
    for (const uploadFile of newFiles) {
      try {
        // Update status to uploading
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        ));

        // Read file content
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          
          // Check if file is text or binary
          if (uploadFile.file.type.startsWith('text/') || 
              uploadFile.file.name.match(/\.(txt|js|jsx|ts|tsx|html|css|json|md|py|java|cpp|go|rs|xml|yaml|yml)$/i)) {
            reader.readAsText(uploadFile.file);
          } else {
            // For binary files, convert to base64
            reader.readAsDataURL(uploadFile.file);
          }
        });

        // Update progress to 50% after reading
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, progress: 50 } : f
        ));

        // Upload to server
        const response = await apiRequest('POST', `/api/projects/${projectId}/files`, {
          name: uploadFile.file.name,
          content: content,
          isFolder: false,
          parentId: currentPath ? parseInt(currentPath) : null
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        // Mark as success
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
        ));
        successCount++;
      } catch (error) {
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : f
        ));
      }
    }

    setIsUploading(false);
    onUploadComplete?.();
    
    if (successCount > 0) {
      toast({
        title: 'Upload Complete',
        description: `Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`,
      });
    }
  }, [projectId, currentPath, onUploadComplete, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    noClick: false,
    noKeyboard: false
  });

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) return FILE_ICONS.image;
    if (['zip', 'tar', 'gz', 'rar'].includes(ext || '')) return FILE_ICONS.archive;
    return FILE_ICONS.default;
  };

  const getFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <Card>
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            className={cn(
              "p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
              "hover:border-primary hover:bg-muted/50",
              isDragActive && "border-primary bg-primary/10",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <Upload className={cn(
                "h-10 w-10 text-muted-foreground",
                isDragActive && "text-primary"
              )} />
              <div>
                <p className="text-[13px] font-medium">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  or click to browse files
                </p>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                Upload to: {currentPath}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[13px] font-medium">Upload Queue</h4>
              {!isUploading && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUploadFiles([])}
                  className="h-7 text-[11px]"
                >
                  Clear All
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              {uploadFiles.map(uploadFile => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  {getFileIcon(uploadFile.file.name)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        {getFileSize(uploadFile.file.size)}
                      </span>
                    </div>
                    
                    {uploadFile.status === 'uploading' && (
                      <Progress 
                        value={uploadFile.progress} 
                        className="h-1 mt-1" 
                      />
                    )}
                    
                    {uploadFile.error && (
                      <p className="text-[11px] text-red-500 mt-1">{uploadFile.error}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {uploadFile.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {uploadFile.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {uploadFile.status === 'pending' && (
                      <Badge variant="secondary" className="text-[11px]">
                        Pending
                      </Badge>
                    )}
                    {uploadFile.status !== 'uploading' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}