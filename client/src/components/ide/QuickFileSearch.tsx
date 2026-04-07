import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { File as FileIcon, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}

interface QuickFileSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
}

export function QuickFileSearch({
  open,
  onOpenChange,
  files,
  onFileSelect
}: QuickFileSearchProps) {
  const [query, setQuery] = useState('');
  
  // Flatten file tree
  const flattenFiles = (nodes: FileNode[]): FileNode[] => {
    let flat: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        flat.push(node);
      }
      if (node.children) {
        flat = flat.concat(flattenFiles(node.children));
      }
    }
    return flat;
  };
  
  // Filter files by query
  const filteredFiles = useMemo(() => {
    const allFiles = flattenFiles(files);
    if (!query) return allFiles;
    
    const lowerQuery = query.toLowerCase();
    return allFiles.filter(file =>
      file.name.toLowerCase().includes(lowerQuery) ||
      file.path.toLowerCase().includes(lowerQuery)
    );
  }, [files, query]);
  
  const handleSelect = (file: FileNode) => {
    onFileSelect(file);
    setQuery('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredFiles.length > 0) {
      handleSelect(filteredFiles[0]);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick File Search</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name or path..."
            autoFocus
            data-testid="input-file-search"
          />
          
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {filteredFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleSelect(file)}
                  data-testid={`file-result-${file.id}`}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors",
                    "flex items-center gap-3"
                  )}
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{file.path}</div>
                  </div>
                </button>
              ))}
              
              {filteredFiles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No files found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
