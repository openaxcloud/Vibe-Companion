import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Project, File } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import EditorLayout from "@/components/layout/EditorLayout";
import FileExplorer from "@/components/FileExplorer";
import EditorContainer from "@/components/EditorContainer";
import Preview from "@/components/Preview";
import BottomPanel from "@/components/BottomPanel";
import TopNavbar from "@/components/TopNavbar";
import { ContextMenu } from "@/components/ContextMenu";

export default function Editor() {
  const { id } = useParams();
  const { toast } = useToast();
  const [openFiles, setOpenFiles] = useState<File[]>([]);
  const [activeFileId, setActiveFileId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'file' | 'folder' | 'workspace';
    id?: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    type: 'workspace'
  });

  // Get project data
  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${id}`],
  });

  // Get project files
  const { data: files = [], isLoading: isFilesLoading } = useQuery<File[]>({
    queryKey: [`/api/projects/${id}/files`],
  });

  // Save file content mutation
  const saveFileMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: number, content: string }) => {
      const res = await apiRequest('PATCH', `/api/files/${fileId}`, { content });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/files`] });
      toast({
        title: "File saved",
        description: "Your changes have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save file",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create file mutation
  const createFileMutation = useMutation({
    mutationFn: async ({ name, content, parentId, isFolder }: { 
      name: string, 
      content?: string, 
      parentId?: number,
      isFolder: boolean
    }) => {
      const res = await apiRequest('POST', `/api/projects/${id}/files`, { 
        name, 
        content: content || '', 
        parentId, 
        isFolder 
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/files`] });
      toast({
        title: data.isFolder ? "Folder created" : "File created",
        description: `${data.name} has been created.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete file/folder mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      await apiRequest('DELETE', `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/files`] });
      toast({
        title: "Deleted successfully",
        description: "The item has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handler functions
  const handleFileOpen = (file: File) => {
    // Don't open folders
    if (file.isFolder) return;
    
    // Check if file is already open
    if (!openFiles.some(f => f.id === file.id)) {
      setOpenFiles(prev => [...prev, file]);
    }
    
    setActiveFileId(file.id);
  };
  
  const handleFileClose = (fileId: number) => {
    setOpenFiles(prev => prev.filter(file => file.id !== fileId));
    
    // If we're closing the active file, select another one
    if (activeFileId === fileId) {
      const remainingFiles = openFiles.filter(file => file.id !== fileId);
      setActiveFileId(remainingFiles.length > 0 ? remainingFiles[0].id : null);
    }
  };
  
  const handleFileSelect = (fileId: number) => {
    setActiveFileId(fileId);
  };
  
  const handleFileChange = (fileId: number, content: string) => {
    setOpenFiles(prev => 
      prev.map(file => 
        file.id === fileId 
          ? { ...file, content } 
          : file
      )
    );
  };
  
  const handleFileSave = (fileId: number) => {
    const fileToSave = openFiles.find(file => file.id === fileId);
    if (fileToSave) {
      saveFileMutation.mutate({ fileId, content: fileToSave.content || '' });
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder' | 'workspace', id?: number) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      id,
    });
  };
  
  const handleCreateFile = (name: string) => {
    createFileMutation.mutate({ 
      name, 
      isFolder: false,
      parentId: contextMenu.type === 'workspace' ? undefined : contextMenu.id,
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const handleCreateFolder = (name: string) => {
    createFileMutation.mutate({ 
      name, 
      isFolder: true,
      parentId: contextMenu.type === 'workspace' ? undefined : contextMenu.id,
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const handleDeleteFile = () => {
    if (contextMenu.id) {
      deleteFileMutation.mutate(contextMenu.id);
      
      // If the file is open, close it
      if (openFiles.some(file => file.id === contextMenu.id)) {
        handleFileClose(contextMenu.id);
      }
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  // Open a file automatically when files are loaded and none are open
  useEffect(() => {
    if (files && files.length > 0 && openFiles.length === 0) {
      // Find the first non-folder file
      const firstFile = files.find(file => !file.isFolder);
      if (firstFile) {
        handleFileOpen(firstFile);
      }
    }
  }, [files, openFiles]);
  
  const activeFile = openFiles.find(file => file.id === activeFileId);
  
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopNavbar 
        project={project} 
        activeFile={activeFile} 
        isLoading={isProjectLoading} 
      />
      
      <EditorLayout
        fileExplorer={
          <FileExplorer
            files={files}
            isLoading={isFilesLoading}
            onFileOpen={handleFileOpen}
            onContextMenu={handleContextMenu}
          />
        }
        editor={
          <EditorContainer
            openFiles={openFiles}
            activeFileId={activeFileId}
            onFileClose={handleFileClose}
            onFileSelect={handleFileSelect}
            onFileChange={handleFileChange}
            onFileSave={handleFileSave}
          />
        }
        preview={
          <Preview
            openFiles={openFiles}
            projectId={project?.id}
          />
        }
        bottomPanel={
          <BottomPanel
            activeFile={activeFile}
          />
        }
      />
      
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDeleteFile}
          onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        />
      )}
    </div>
  );
}
