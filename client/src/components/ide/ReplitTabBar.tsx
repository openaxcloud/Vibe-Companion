import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  Copy,
  SplitSquareVertical,
  Pin,
  PinOff,
} from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon?: typeof FileText;
  closable?: boolean;
  pinned?: boolean;
  modified?: boolean;
  path?: string;
}

interface ReplitTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onAddTab?: () => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
  onTabPin?: (tabId: string) => void;
  onTabDuplicate?: (tabId: string) => void;
  onSplitRight?: (tabId: string) => void;
  className?: string;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
      return FileCode;
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
      return FileJson;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
    case 'webp':
      return FileImage;
    default:
      return FileText;
  }
};

export function ReplitTabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onAddTab,
  onTabReorder,
  onTabPin,
  onTabDuplicate,
  onSplitRight,
  className,
}: ReplitTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (ref) {
        ref.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, [tabs]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (draggedTabId && draggedTabId !== tabId) {
      setDragOverTabId(tabId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTabId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (draggedTabId && draggedTabId !== targetTabId && onTabReorder) {
      const fromIndex = tabs.findIndex(t => t.id === draggedTabId);
      const toIndex = tabs.findIndex(t => t.id === targetTabId);
      if (fromIndex !== -1 && toIndex !== -1) {
        onTabReorder(fromIndex, toIndex);
      }
    }
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const pinnedTabs = tabs.filter(t => t.pinned);
  const unpinnedTabs = tabs.filter(t => !t.pinned);

  const renderTab = (tab: Tab) => {
    const isActive = activeTabId === tab.id;
    const isDragging = draggedTabId === tab.id;
    const isDragOver = dragOverTabId === tab.id;
    const Icon = tab.icon || getFileIcon(tab.label);

    return (
      <ContextMenu key={tab.id}>
        <ContextMenuTrigger asChild>
          <div
            draggable={!tab.pinned}
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={cn(
              'group relative flex items-center gap-1.5 h-[32px] px-2.5 cursor-pointer select-none',
              'text-[12px] font-medium',
              'transition-colors duration-100 ease-out',
              tab.pinned && 'min-w-[36px] max-w-[36px] justify-center px-0',
              !tab.pinned && 'min-w-[90px] max-w-[160px]',
              isActive && [
                'bg-[var(--ecode-editor-bg)] text-[var(--ecode-text)]',
                'border-b-2 border-b-[var(--ecode-accent)]',
              ],
              !isActive && [
                'bg-transparent text-[var(--ecode-text-muted)]',
                'hover:bg-[var(--ecode-sidebar-hover)]/50 hover:text-[var(--ecode-text)]',
              ],
              isDragging && 'opacity-40',
              isDragOver && 'bg-[var(--ecode-accent)]/10'
            )}
          >
            <Icon className={cn(
              'h-3.5 w-3.5 flex-shrink-0 transition-colors',
              isActive ? 'text-[var(--ecode-accent)]' : 'text-[var(--ecode-text-muted)]'
            )} />
            
            {!tab.pinned && (
              <>
                <span className="truncate flex-1">{tab.label}</span>
                
                {tab.modified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ecode-accent)] flex-shrink-0" />
                )}
                
                {tab.closable !== false && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    className={cn(
                      'flex-shrink-0 p-0.5 rounded-sm transition-opacity',
                      'opacity-0 group-hover:opacity-70 hover:opacity-100',
                      'hover:bg-[var(--ecode-sidebar-hover)]'
                    )}
                    data-testid={`tab-close-${tab.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48" data-testid={`tab-context-menu-${tab.id}`}>
          <ContextMenuItem onClick={() => onTabClose(tab.id)} data-testid={`menu-close-tab-${tab.id}`}>
            <X className="h-4 w-4 mr-2" />
            Close
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => {
              tabs.filter(t => t.id !== tab.id).forEach(t => onTabClose(t.id));
            }}
            data-testid={`menu-close-others-${tab.id}`}
          >
            Close Others
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => {
              const idx = tabs.findIndex(t => t.id === tab.id);
              tabs.slice(idx + 1).forEach(t => onTabClose(t.id));
            }}
            data-testid={`menu-close-right-${tab.id}`}
          >
            Close to the Right
          </ContextMenuItem>
          <ContextMenuSeparator />
          {onTabPin && (
            <ContextMenuItem onClick={() => onTabPin(tab.id)} data-testid={`menu-pin-tab-${tab.id}`}>
              {tab.pinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </>
              )}
            </ContextMenuItem>
          )}
          {onTabDuplicate && (
            <ContextMenuItem onClick={() => onTabDuplicate(tab.id)} data-testid={`menu-duplicate-tab-${tab.id}`}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </ContextMenuItem>
          )}
          {onSplitRight && (
            <ContextMenuItem onClick={() => onSplitRight(tab.id)} data-testid={`menu-split-right-${tab.id}`}>
              <SplitSquareVertical className="h-4 w-4 mr-2" />
              Split Right
            </ContextMenuItem>
          )}
          {tab.path && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem 
                onClick={() => navigator.clipboard.writeText(tab.path!)}
                data-testid={`menu-copy-path-${tab.id}`}
              >
                Copy Path
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div
      className={cn(
        'flex items-center h-9 bg-[var(--ecode-surface)]',
        'border-b border-[var(--ecode-border)]',
        className
      )}
      data-testid="tab-bar"
    >
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="sm"
          onClick={scrollLeft}
          className="h-full w-5 p-0 rounded-none hover:bg-[var(--ecode-sidebar-hover)] flex-shrink-0 text-[var(--ecode-text-muted)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      )}
      
      <div className="relative flex-1 min-w-0">
        {canScrollLeft && (
          <div
            className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, var(--ecode-surface), transparent)' }}
          />
        )}
        <div
          ref={scrollRef}
          className="flex items-center w-full overflow-x-auto scrollbar-none gap-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {pinnedTabs.map(renderTab)}
          {pinnedTabs.length > 0 && unpinnedTabs.length > 0 && (
            <div className="w-px h-[18px] bg-[var(--ecode-border)] mx-0.5" />
          )}
          {unpinnedTabs.map(renderTab)}
        </div>
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, var(--ecode-surface), transparent)' }}
          />
        )}
      </div>
      
      {canScrollRight && (
        <Button
          variant="ghost"
          size="sm"
          onClick={scrollRight}
          className="h-full w-5 p-0 rounded-none hover:bg-[var(--ecode-sidebar-hover)] flex-shrink-0 text-[var(--ecode-text-muted)]"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
      
      {onAddTab && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddTab}
          className="h-full w-7 p-0 rounded-none hover:bg-[var(--ecode-sidebar-hover)] flex-shrink-0 text-[var(--ecode-text-muted)]"
          data-testid="tab-add"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
