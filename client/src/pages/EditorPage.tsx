import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Route, Switch } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EditorWorkspace } from '@/components/EditorWorkspace';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { File, Project } from '@shared/schema';

export default function EditorPage() {
  const { projectId } = useParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Parse project ID
  const projectIdNum = projectId ? parseInt(projectId) : 0;
  
  // Get project details
  const { 
    data: project, 
    isLoading: isLoadingProject,
    error: projectError,
  } = useQuery({
    queryKey: ['/api/projects', projectIdNum],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectIdNum}`);
      return res.json();
    },
    enabled: !!projectIdNum && !!user,
  });
  
  // Get project files
  const { 
    data: files = [], 
    isLoading: isLoadingFiles,
    error: filesError,
  } = useQuery<File[]>({
    queryKey: ['/api/projects', projectIdNum, 'files'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectIdNum}/files`);
      return res.json();
    },
    enabled: !!projectIdNum && !!user,
  });
  
  // Update file content mutation
  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: number, content: string }) => {
      const res = await apiRequest('PATCH', `/api/files/${fileId}`, { content });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', parseInt(projectId), 'files'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Create file mutation
  const createFileMutation = useMutation({
    mutationFn: async ({ name, isFolder, parentId }: { name: string, isFolder: boolean, parentId?: number | null }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/files`, {
        name,
        isFolder,
        parentId: parentId || null,
        content: '',
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', parseInt(projectId), 'files'] });
      toast({
        title: 'File created',
        description: `Created ${data.name} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest('DELETE', `/api/files/${fileId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', parseInt(projectId), 'files'] });
      toast({
        title: 'File deleted',
        description: 'File was deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Handle file update
  const handleFileUpdate = async (fileId: number, content: string) => {
    await updateFileMutation.mutateAsync({ fileId, content });
  };
  
  // Handle file creation
  const handleFileCreate = async (name: string, isFolder: boolean, parentId?: number | null) => {
    await createFileMutation.mutateAsync({ name, isFolder, parentId });
  };
  
  // Handle file deletion
  const handleFileDelete = async (fileId: number) => {
    await deleteFileMutation.mutateAsync(fileId);
  };
  
  // Show loading state
  if (isLoadingProject || isLoadingFiles) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (projectError || filesError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl text-destructive">!</span>
          </div>
          <h2 className="text-xl font-semibold">Error Loading Project</h2>
          <p className="text-muted-foreground">
            {projectError ? (projectError as Error).message : (filesError as Error).message}
          </p>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      <EditorWorkspace
        project={project}
        files={files}
        onFileUpdate={handleFileUpdate}
        onFileCreate={handleFileCreate}
        onFileDelete={handleFileDelete}
      />
    </div>
  );
}