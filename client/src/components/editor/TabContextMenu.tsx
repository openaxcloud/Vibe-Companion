import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { X, Pin, Copy, FolderOpen } from 'lucide-react';
import { useLayoutStore } from '@/../../shared/stores/layoutStore';
import { useToast } from '@/hooks/use-toast';
import { File } from '@shared/schema';

interface TabContextMenuProps {
  fileId: number;
  file?: File;
  isPinned: boolean;
  isLast: boolean;
  children: React.ReactNode;
}

export function TabContextMenu({
  fileId,
  file,
  isPinned,
  isLast,
  children,
}: TabContextMenuProps) {
  const { closeFile, closeOtherTabs, closeTabsToRight, togglePinTab } = useLayoutStore();
  const { toast } = useToast();

  const handleCopyPath = async () => {
    if (!file?.path) {
      toast({
        title: 'Error',
        description: 'File path not available',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(file.path);
      toast({
        title: 'Path copied',
        description: `Copied: ${file.path}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy path to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleRevealInFileTree = () => {
    // Feature requires parent component to handle file tree navigation
    // Parent components can implement this by scrolling to file in tree
    toast({
      title: 'Coming soon',
      description: 'Reveal in file tree will be available soon',
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {!isPinned && (
          <ContextMenuItem
            onClick={() => closeFile(fileId)}
            data-testid="context-menu-close"
          >
            <X className="mr-2 h-4 w-4" />
            Close Tab
            <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+W</span>
          </ContextMenuItem>
        )}
        
        {isPinned && (
          <ContextMenuItem
            disabled
            className="opacity-50"
            data-testid="context-menu-close-disabled"
          >
            <X className="mr-2 h-4 w-4" />
            Close Tab
            <span className="ml-auto text-[11px] text-muted-foreground">Pinned</span>
          </ContextMenuItem>
        )}
        
        <ContextMenuItem
          onClick={() => closeOtherTabs(fileId)}
          data-testid="context-menu-close-others"
        >
          <X className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Close Other Tabs</span>
            <span className="text-[11px] text-muted-foreground">Keeps pinned tabs</span>
          </div>
        </ContextMenuItem>
        
        {!isLast && (
          <ContextMenuItem
            onClick={() => closeTabsToRight(fileId)}
            data-testid="context-menu-close-right"
          >
            <X className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Close Tabs to the Right</span>
              <span className="text-[11px] text-muted-foreground">Keeps pinned tabs</span>
            </div>
          </ContextMenuItem>
        )}
        
        <ContextMenuSeparator />
        
        <ContextMenuItem
          onClick={() => togglePinTab(fileId)}
          data-testid="context-menu-toggle-pin"
        >
          <Pin className="mr-2 h-4 w-4" />
          {isPinned ? 'Unpin Tab' : 'Pin Tab'}
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem
          onClick={handleCopyPath}
          data-testid="context-menu-copy-path"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Path
        </ContextMenuItem>
        
        <ContextMenuItem
          onClick={handleRevealInFileTree}
          data-testid="context-menu-reveal"
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Reveal in File Tree
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
