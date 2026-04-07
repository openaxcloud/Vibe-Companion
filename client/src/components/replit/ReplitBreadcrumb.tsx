import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  ChevronRight, 
  ChevronDown, 
  Home, 
  Folder, 
  FolderOpen,
  FileText,
  Code,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  id: string;
  title: string;
  path: string;
  type: 'home' | 'folder' | 'file';
  children?: BreadcrumbItem[];
  icon?: React.ReactNode;
}

interface ReplitBreadcrumbProps {
  items: BreadcrumbItem[];
  onItemClick?: (item: BreadcrumbItem) => void;
  maxItems?: number;
  className?: string;
}

const getItemIcon = (item: BreadcrumbItem) => {
  if (item.icon) return item.icon;
  
  switch (item.type) {
    case 'home':
      return <Home className="h-3 w-3" />;
    case 'folder':
      return <Folder className="h-3 w-3" />;
    case 'file':
      if (item.path.endsWith('.js') || item.path.endsWith('.jsx')) {
        return <Code className="h-3 w-3 text-yellow-500" />;
      }
      if (item.path.endsWith('.ts') || item.path.endsWith('.tsx')) {
        return <Code className="h-3 w-3 text-blue-500" />;
      }
      if (item.path.endsWith('.py')) {
        return <Code className="h-3 w-3 text-green-500" />;
      }
      if (item.path.endsWith('.html')) {
        return <Code className="h-3 w-3 text-orange-500" />;
      }
      if (item.path.endsWith('.css')) {
        return <Code className="h-3 w-3 text-blue-400" />;
      }
      return <FileText className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

export function ReplitBreadcrumb({
  items,
  onItemClick,
  maxItems = 5,
  className
}: ReplitBreadcrumbProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Handle overflow by showing ... for middle items
  const visibleItems = items.length > maxItems 
    ? [
        ...items.slice(0, 2),
        ...items.slice(-(maxItems - 2))
      ]
    : items;

  const hasOverflow = items.length > maxItems;
  const overflowItems = hasOverflow ? items.slice(2, -(maxItems - 2)) : [];

  return (
    <div className={cn(
      "flex items-center h-8 px-3 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] text-[13px]",
      className
    )}>
      <div className="flex items-center min-w-0 flex-1">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const showOverflow = hasOverflow && index === 2 && visibleItems.length > 2;
          
          return (
            <div key={item.id} className="flex items-center min-w-0">
              {/* Overflow indicator */}
              {showOverflow && (
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 hover:bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-secondary)]"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                      {overflowItems.map((overflowItem) => (
                        <DropdownMenuItem
                          key={overflowItem.id}
                          onClick={() => onItemClick?.(overflowItem)}
                          className="flex items-center gap-2"
                        >
                          {getItemIcon(overflowItem)}
                          {overflowItem.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="h-3 w-3 text-[var(--ecode-text-secondary)] mx-1" />
                </div>
              )}

              {/* Breadcrumb item */}
              <div className="flex items-center min-w-0">
                {item.children && item.children.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 px-2 hover:bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text)] flex items-center gap-1 min-w-0",
                          isLast && "font-medium"
                        )}
                      >
                        {getItemIcon(item)}
                        <span className="truncate max-w-[120px]">{item.title}</span>
                        <ChevronDown className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                      {item.children.map((child) => (
                        <DropdownMenuItem
                          key={child.id}
                          onClick={() => onItemClick?.(child)}
                          className="flex items-center gap-2"
                        >
                          {getItemIcon(child)}
                          {child.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-6 px-2 hover:bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text)] flex items-center gap-1 min-w-0",
                      isLast && "font-medium"
                    )}
                    onClick={() => onItemClick?.(item)}
                  >
                    {getItemIcon(item)}
                    <span className="truncate max-w-[120px]">{item.title}</span>
                  </Button>
                )}
              </div>

              {/* Separator */}
              {!isLast && (
                <ChevronRight className="h-3 w-3 text-[var(--ecode-text-secondary)] mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-secondary)]"
          title="Settings"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}