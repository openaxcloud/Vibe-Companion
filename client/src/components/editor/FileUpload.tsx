import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  projectId: number;
  parentId?: number;
  onClose?: () => void;
  className?: string;
}

export function FileUpload({ projectId, parentId, onClose, className }: FileUploadProps) {
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      if (parentId) {
        formData.append('parentId', parentId.toString());
      }

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to upload files');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({
        title: 'Files uploaded',
        description: 'Your files have been uploaded successfully',
      });
      onClose?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <div className={cn("p-6 relative", className)}>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-[var(--ecode-accent)] bg-[var(--ecode-accent)]/10"
            : "border-[var(--ecode-border)] hover:border-[var(--ecode-accent-subtle)]",
          uploadMutation.isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} disabled={uploadMutation.isPending} />
        
        <Upload className="h-12 w-12 mx-auto mb-4 text-[var(--ecode-text-muted)]" />
        
        {isDragActive ? (
          <p className="text-[var(--ecode-accent)]">Drop the files here...</p>
        ) : (
          <>
            <p className="text-[var(--ecode-text)] mb-2">
              Drag & drop files here, or click to select files
            </p>
            <p className="text-sm text-[var(--ecode-text-muted)]">
              Upload multiple files to your project
            </p>
          </>
        )}

        {uploadMutation.isPending && (
          <p className="mt-4 text-sm text-[var(--ecode-accent)]">
            Uploading files...
          </p>
        )}
      </div>
    </div>
  );
}