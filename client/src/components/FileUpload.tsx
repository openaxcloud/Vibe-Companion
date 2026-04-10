import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Upload, FileUp, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  projectId: number;
  parentId?: number | null;
  onUploadComplete?: () => void;
  className?: string;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function FileUpload({ projectId, parentId, onUploadComplete, className = '' }: FileUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setIsUploading(true);
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append('files', file);
      });
      
      if (parentId) {
        formData.append('parentId', parentId.toString());
      }

      const response = await apiRequest('POST', `/api/files/${projectId}/upload-multiple`, formData);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${projectId}`] });
      toast({
        title: 'Files uploaded',
        description: 'Your files have been uploaded successfully'
      });
      setUploadFiles([]);
      onUploadComplete?.();
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload files',
        variant: 'destructive'
      });
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));
    
    setUploadFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startUpload = () => {
    const files = uploadFiles.map(uf => uf.file);
    uploadMutation.mutate(files);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true
  });

  const totalSize = uploadFiles.reduce((sum, uf) => sum + uf.file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/25 hover:border-primary/50'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-[13px] text-muted-foreground">
          {isDragActive 
            ? 'Drop files here...' 
            : 'Drag and drop files here, or click to select'
          }
        </p>
      </div>

      {uploadFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] text-muted-foreground">
              {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} ({formatSize(totalSize)})
            </span>
            {!isUploading && (
              <Button 
                size="sm" 
                onClick={startUpload}
                disabled={uploadFiles.length === 0}
              >
                <FileUp className="h-4 w-4 mr-2" />
                Upload All
              </Button>
            )}
          </div>

          {uploadFiles.map((uploadFile, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate">{uploadFile.file.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatSize(uploadFile.file.size)}</p>
              </div>
              
              {uploadFile.status === 'uploading' && (
                <Progress value={uploadFile.progress} className="w-20" />
              )}
              
              {uploadFile.status === 'success' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              
              {uploadFile.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}