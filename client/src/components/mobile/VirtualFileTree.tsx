import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Folder, File, ChevronRight, ChevronDown,
  FileText, FileCode, Image, Film, Music, Archive, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItem {
  id: number;
  name: string;
  type: 'file' | 'folder';
  path: string;
  parentId: number | null; // Match MobileFileExplorer interface
  extension?: string;
  children?: FileItem[];
}

interface VirtualFileTreeProps {
  files: FileItem[];
  onFileSelect?: (file: FileItem) => void;
  onLongPress?: (file: FileItem) => void;
  expandedFolders: Set<number>;
  onToggleFolder: (id: number) => void;
  currentFileId?: number;
  className?: string;
}

// Virtual scrolling configuration
const ITEM_HEIGHT = 44; // Height in pixels for each file/folder item
const OVERSCAN = 3; // Number of items to render outside viewport

// Helper to get file icon based on extension
const getFileIcon = (extension?: string) => {
  if (!extension) return FileText;
  
  const iconMap: Record<string, any> = {
    // Code
    'ts': FileCode, 'tsx': FileCode, 'js': FileCode, 'jsx': FileCode,
    'py': FileCode, 'java': FileCode, 'cpp': FileCode, 'c': FileCode,
    'go': FileCode, 'rs': FileCode, 'php': FileCode, 'rb': FileCode,
    // Images
    'png': Image, 'jpg': Image, 'jpeg': Image, 'gif': Image, 'svg': Image,
    'webp': Image, 'ico': Image,
    // Media
    'mp4': Film, 'avi': Film, 'mov': Film, 'webm': Film,
    'mp3': Music, 'wav': Music, 'ogg': Music,
    // Archives
    'zip': Archive, 'tar': Archive, 'gz': Archive, 'rar': Archive,
    // Database
    'db': Database, 'sql': Database, 'sqlite': Database,
  };
  
  return iconMap[extension.toLowerCase()] || FileText;
};

export function VirtualFileTree({
  files,
  onFileSelect,
  onLongPress,
  expandedFolders,
  onToggleFolder,
  currentFileId,
  className
}: VirtualFileTreeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Flatten the tree for virtual scrolling
  const flattenTree = useCallback((items: FileItem[], depth = 0): Array<FileItem & { depth: number }> => {
    const result: Array<FileItem & { depth: number }> = [];
    
    for (const item of items) {
      result.push({ ...item, depth });
      
      if (item.type === 'folder' && item.children && expandedFolders.has(item.id)) {
        result.push(...flattenTree(item.children, depth + 1));
      }
    }
    
    return result;
  }, [expandedFolders]);
  
  const flatItems = flattenTree(files);
  const totalHeight = flatItems.length * ITEM_HEIGHT;
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    flatItems.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );
  
  const visibleItems = flatItems.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;
  
  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };
  
  // Measure container height
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerHeight(entries[0].contentRect.height);
      }
    });
    
    if (scrollRef.current) {
      observer.observe(scrollRef.current);
      setContainerHeight(scrollRef.current.clientHeight);
    }
    
    return () => observer.disconnect();
  }, []);
  
  // Long press handling
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const handleTouchStart = (item: FileItem) => {
    const timer = setTimeout(() => {
      onLongPress?.(item);
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 500);
    setPressTimer(timer);
  };
  
  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };
  
  return (
    <div
      ref={scrollRef}
      className={cn('overflow-y-auto overflow-x-hidden', className)}
      onScroll={handleScroll}
      style={{ height: '100%', position: 'relative' }}
      data-testid="virtual-file-tree"
    >
      {/* Virtual scroll container */}
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {/* Visible items */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => {
            const Icon = item.type === 'folder' ? Folder : getFileIcon(item.extension);
            const isExpanded = expandedFolders.has(item.id);
            const isActive = item.type === 'file' && currentFileId === item.id;
            
            return (
              <div
                key={`${item.id}-${startIndex + idx}`}
                className={cn(
                  'flex items-center px-3 py-2 cursor-pointer transition-colors touch-manipulation',
                  isActive 
                    ? 'bg-accent dark:bg-[var(--ecode-sidebar-hover)] text-accent-foreground dark:text-white' 
                    : 'hover:bg-muted dark:hover:bg-[var(--ecode-surface-hover)] active:bg-surface-tertiary-solid',
                  item.type === 'file' && 'pl-9'
                )}
                style={{
                  height: `${ITEM_HEIGHT}px`,
                  paddingLeft: `${item.depth * 16 + 12}px`
                }}
                onClick={() => {
                  if (item.type === 'folder') {
                    onToggleFolder(item.id);
                  } else {
                    onFileSelect?.(item);
                  }
                }}
                onTouchStart={() => handleTouchStart(item)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                data-testid={`file-item-${item.id}`}
              >
                {item.type === 'folder' && (
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 mr-1 transition-transform flex-shrink-0',
                      isExpanded && 'transform rotate-90'
                    )}
                  />
                )}
                
                <Icon className={cn(
                  'h-4 w-4 mr-2 flex-shrink-0',
                  item.type === 'folder' ? 'text-blue-400' : 'text-muted-foreground'
                )} />
                
                <span className="text-[13px] text-foreground truncate">
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
