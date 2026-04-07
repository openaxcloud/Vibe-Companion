import React, { useState, useEffect } from 'react';
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList, 
  CommandSeparator
} from '@/components/ui/command';
import { File, Project } from '@shared/schema';
import { 
  ArrowRight, 
  File as FileIcon, 
  FolderOpen, 
  Terminal, 
  Settings, 
  Play, 
  PlusCircle, 
  FileCode, 
  Search,
  User,
  GitBranch,
  Upload,
  Download,
  Trash,
  Clipboard,
  Save
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | undefined;
  files: File[];
  onFileSelect: (file: File) => void;
  onCreateFile: (isFolder: boolean) => void;
  onActionSelect: (action: string) => void;
}

export function CommandPalette({ 
  open, 
  onOpenChange, 
  project, 
  files,
  onFileSelect,
  onCreateFile,
  onActionSelect
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
    }
  }, [open]);
  
  // Keyboard shortcut to open command palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);
  
  const runActions = [
    { name: 'Run', icon: <Play className="h-4 w-4 mr-2" />, value: 'run' },
    { name: 'Deploy', icon: <Upload className="h-4 w-4 mr-2" />, value: 'deploy' },
  ];
  
  const fileActions = [
    { name: 'New File', icon: <FileIcon className="h-4 w-4 mr-2" />, value: 'new-file' },
    { name: 'New Folder', icon: <FolderOpen className="h-4 w-4 mr-2" />, value: 'new-folder' },
    { name: 'Save All', icon: <Save className="h-4 w-4 mr-2" />, value: 'save-all' },
  ];
  
  const gitActions = [
    { name: 'Git Pull', icon: <Download className="h-4 w-4 mr-2" />, value: 'git-pull' },
    { name: 'Git Push', icon: <Upload className="h-4 w-4 mr-2" />, value: 'git-push' },
    { name: 'Git Commit', icon: <GitBranch className="h-4 w-4 mr-2" />, value: 'git-commit' },
  ];
  
  const miscActions = [
    { name: 'Settings', icon: <Settings className="h-4 w-4 mr-2" />, value: 'settings' },
    { name: 'Terminal', icon: <Terminal className="h-4 w-4 mr-2" />, value: 'terminal' },
    { name: 'Share', icon: <User className="h-4 w-4 mr-2" />, value: 'share' },
  ];
  
  // Filter files based on search query
  const filteredFiles = searchQuery.length > 0
    ? files.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];
  
  // Filter actions based on search query
  const searchActions = [...runActions, ...fileActions, ...gitActions, ...miscActions];
  const filteredActions = searchQuery.length > 0
    ? searchActions.filter(action => action.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchActions;
  
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Type a command or search..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {searchQuery.length === 0 && (
          <>
            <CommandGroup heading="Run">
              {runActions.map((action) => (
                <CommandItem
                  key={action.value}
                  onSelect={() => {
                    onActionSelect(action.value);
                    onOpenChange(false);
                  }}
                >
                  {action.icon}
                  <span>{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            
            <CommandSeparator />
            
            <CommandGroup heading="File">
              {fileActions.map((action) => (
                <CommandItem
                  key={action.value}
                  onSelect={() => {
                    if (action.value === 'new-file') {
                      onCreateFile(false);
                    } else if (action.value === 'new-folder') {
                      onCreateFile(true);
                    } else {
                      onActionSelect(action.value);
                    }
                    onOpenChange(false);
                  }}
                >
                  {action.icon}
                  <span>{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            
            {project && (
              <>
                <CommandSeparator />
                
                <CommandGroup heading="Git">
                  {gitActions.map((action) => (
                    <CommandItem
                      key={action.value}
                      onSelect={() => {
                        onActionSelect(action.value);
                        onOpenChange(false);
                      }}
                    >
                      {action.icon}
                      <span>{action.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            
            <CommandSeparator />
            
            <CommandGroup heading="Tools">
              {miscActions.map((action) => (
                <CommandItem
                  key={action.value}
                  onSelect={() => {
                    onActionSelect(action.value);
                    onOpenChange(false);
                  }}
                >
                  {action.icon}
                  <span>{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        
        {searchQuery.length > 0 && filteredActions.length > 0 && (
          <CommandGroup heading="Actions">
            {filteredActions.map((action) => (
              <CommandItem
                key={action.value}
                onSelect={() => {
                  if (action.value === 'new-file') {
                    onCreateFile(false);
                  } else if (action.value === 'new-folder') {
                    onCreateFile(true);
                  } else {
                    onActionSelect(action.value);
                  }
                  onOpenChange(false);
                }}
              >
                {action.icon}
                <span>{action.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        
        {searchQuery.length > 0 && filteredFiles.length > 0 && (
          <>
            {filteredActions.length > 0 && <CommandSeparator />}
            
            <CommandGroup heading="Files">
              {filteredFiles.map((file) => (
                <CommandItem
                  key={file.id}
                  onSelect={() => {
                    onFileSelect(file);
                    onOpenChange(false);
                  }}
                >
                  {file.isFolder ? (
                    <FolderOpen className="h-4 w-4 mr-2" />
                  ) : (
                    <FileCode className="h-4 w-4 mr-2" />
                  )}
                  <span>{file.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}