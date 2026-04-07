import { useState } from "react";
import { Folder, File, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'file' | 'folder' | 'workspace';
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const ContextMenu = ({
  x,
  y,
  type,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onClose
}: ContextMenuProps) => {
  const [mode, setMode] = useState<'menu' | 'newFile' | 'newFolder'>('menu');
  const [name, setName] = useState("");
  
  const handleCreateFile = () => {
    if (name.trim()) {
      onCreateFile(name.trim());
      setName("");
      setMode('menu');
    }
  };
  
  const handleCreateFolder = () => {
    if (name.trim()) {
      onCreateFolder(name.trim());
      setName("");
      setMode('menu');
    }
  };
  
  const handleClickOutside = (event: React.MouseEvent) => {
    event.stopPropagation();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'newFile') {
        handleCreateFile();
      } else if (mode === 'newFolder') {
        handleCreateFolder();
      }
    } else if (e.key === 'Escape') {
      setMode('menu');
      setName("");
    }
  };
  
  const positionStyle = {
    top: `${y}px`,
    left: `${x}px`,
  };
  
  return (
    <div 
      className="fixed z-50 bg-popover border shadow-md rounded-md overflow-hidden w-60"
      style={positionStyle}
      onClick={handleClickOutside}
    >
      {mode === 'menu' && (
        <div className="py-1">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
            onClick={() => setMode('newFile')}
          >
            <File className="h-4 w-4" />
            New File
          </button>
          
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
            onClick={() => setMode('newFolder')}
          >
            <Folder className="h-4 w-4" />
            New Folder
          </button>
          
          {type !== 'workspace' && (
            <>
              <div className="h-px bg-border my-1" />
              
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 text-red-500"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
      
      {mode === 'newFile' && (
        <div className="p-3">
          <h3 className="text-sm font-medium mb-2">New File</h3>
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Filename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setMode('menu');
                  setName("");
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleCreateFile}
                disabled={!name.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {mode === 'newFolder' && (
        <div className="p-3">
          <h3 className="text-sm font-medium mb-2">New Folder</h3>
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setMode('menu');
                  setName("");
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleCreateFolder}
                disabled={!name.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};