import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, File, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BreadcrumbSegment {
  name: string;
  path: string;
  type: 'folder' | 'file';
}

interface ReplitBreadcrumbsProps {
  filePath?: string;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function ReplitBreadcrumbs({
  filePath = '',
  onNavigate,
  className,
}: ReplitBreadcrumbsProps) {
  if (!filePath) return null;

  // Parse file path into segments
  const segments: BreadcrumbSegment[] = filePath
    .split('/')
    .filter(Boolean)
    .map((name, index, arr) => {
      const path = arr.slice(0, index + 1).join('/');
      const isLast = index === arr.length - 1;
      return {
        name,
        path,
        type: isLast ? 'file' : 'folder',
      };
    });

  return (
    <div
      className={cn(
        "h-8 px-3 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] flex items-center gap-1 overflow-x-auto text-[11px] font-[family-name:var(--ecode-font-sans)]",
        className
      )}
      data-testid="breadcrumbs"
    >
      {/* Project Root */}
      <button
        onClick={() => onNavigate?.('/')}
        className="flex items-center gap-1 hover:bg-[var(--ecode-sidebar-hover)] px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
        data-testid="breadcrumb-root"
      >
        <Folder className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
        <span className="text-[var(--ecode-text-secondary)]">Project</span>
      </button>

      {/* Path Segments */}
      {segments.map((segment, index) => (
        <React.Fragment key={segment.path}>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          
          {index < segments.length - 1 ? (
            // Folder segments (with dropdown for siblings)
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 hover:bg-[var(--ecode-sidebar-hover)] px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                  data-testid={`breadcrumb-segment-${index}`}
                >
                  <Folder className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
                  <span className="text-[var(--ecode-text)]">{segment.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => onNavigate?.(segment.path)}
                  className="text-[11px]"
                >
                  <Folder className="h-3.5 w-3.5 mr-2" />
                  {segment.name}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Current file (no dropdown)
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded flex-shrink-0"
              data-testid="breadcrumb-current-file"
            >
              <File className="h-3.5 w-3.5 text-[var(--ecode-text-secondary)]" />
              <span className="text-[var(--ecode-text)] font-semibold">
                {segment.name}
              </span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
