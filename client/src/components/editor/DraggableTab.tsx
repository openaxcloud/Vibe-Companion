import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabContextMenu } from './TabContextMenu';
import { File } from '@shared/schema';
import { useLayoutStore } from '@/../../shared/stores/layoutStore';

interface DraggableTabProps {
  id: number;
  label: string;
  file?: File;
  isActive: boolean;
  isLast: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function DraggableTab({
  id,
  label,
  file,
  isActive,
  isLast,
  onSelect,
  onClose,
}: DraggableTabProps) {
  const pinnedTabs = useLayoutStore((state) => state.pinnedTabs);
  const isPinned = pinnedTabs.includes(id);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TabContextMenu
      fileId={id}
      file={file}
      isPinned={isPinned}
      isLast={isLast}
    >
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-1.5 px-3 py-1.5 border-r border-[var(--ecode-border)] cursor-pointer transition-colors min-w-[120px] max-w-[200px]',
          isActive
            ? 'bg-[var(--ecode-editor-bg)] text-[var(--ecode-text)]'
            : 'bg-[var(--ecode-surface)] text-[var(--ecode-text-secondary)] hover:bg-[var(--ecode-surface-hover)]'
        )}
        onClick={onSelect}
        data-testid={`tab-${id}`}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
        </div>

        {/* Pin Indicator */}
        {isPinned && (
          <Pin className="h-3 w-3 text-[var(--ecode-accent)] flex-shrink-0" />
        )}

        {/* File Name */}
        <span className="text-[11px] font-medium font-[family-name:var(--ecode-font-sans)] truncate flex-1">
          {label}
        </span>

        {/* Close Button - Disabled for pinned tabs */}
        {!isPinned && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--ecode-surface-hover)] rounded transition-opacity flex-shrink-0"
            data-testid={`button-close-tab-${id}`}
          >
            <X className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}
