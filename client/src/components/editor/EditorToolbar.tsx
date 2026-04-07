import { ChevronRight, Map, FolderOpen, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  filePath?: string;
  fileName?: string;
  minimapEnabled: boolean;
  onToggleMinimap: () => void;
  onBreadcrumbClick?: (segment: string, index: number) => void;
}

export function EditorToolbar({
  filePath,
  fileName,
  minimapEnabled,
  onToggleMinimap,
  onBreadcrumbClick,
}: EditorToolbarProps) {
  // Parse file path into breadcrumb segments
  const getBreadcrumbs = () => {
    if (!filePath) return [];
    
    const segments = filePath.split('/').filter(Boolean);
    return segments;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="h-8 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] flex items-center justify-between px-3 flex-shrink-0">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-1" data-testid="editor-breadcrumbs">
            {breadcrumbs.map((segment, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isFolder = !isLast;
              
              return (
                <div key={index} className="flex items-center gap-1">
                  <button
                    onClick={() => onBreadcrumbClick?.(segment, index)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors',
                      'font-[family-name:var(--ecode-font-sans)]',
                      isLast
                        ? 'text-[var(--ecode-text)] bg-[var(--ecode-surface-hover)]'
                        : 'text-[var(--ecode-text-secondary)] hover:bg-[var(--ecode-surface-hover)] hover:text-[var(--ecode-text)]'
                    )}
                    data-testid={`breadcrumb-${index}`}
                  >
                    {isFolder ? (
                      <FolderOpen className="h-3.5 w-3.5" />
                    ) : (
                      <File className="h-3.5 w-3.5" />
                    )}
                    <span className="truncate max-w-[150px]">{segment}</span>
                  </button>
                  
                  {!isLast && (
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--ecode-text-muted)] flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-[var(--ecode-text-muted)] font-[family-name:var(--ecode-font-sans)]">
            <File className="h-3.5 w-3.5" />
            <span>{fileName || 'No file selected'}</span>
          </div>
        )}
      </div>

      {/* Toolbar Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMinimap}
                className={cn(
                  'h-6 px-2 text-[11px]',
                  minimapEnabled && 'bg-[var(--ecode-surface-hover)]'
                )}
                data-testid="button-toggle-minimap"
              >
                <Map className={cn(
                  'h-3.5 w-3.5',
                  minimapEnabled ? 'text-[var(--ecode-accent)]' : 'text-[var(--ecode-text-muted)]'
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{minimapEnabled ? 'Hide Minimap' : 'Show Minimap'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
