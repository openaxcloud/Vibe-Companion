import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, Pin, Copy, PanelRight } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';

interface Tab {
  id: string;
  label: string;
  closable: boolean;
  pinned?: boolean;
  modified?: boolean;
  path?: string;
}

interface ReplitTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (from: number, to: number) => void;
  onTabPin?: (id: string) => void;
  onTabDuplicate?: (id: string) => void;
  onSplitRight?: (id: string) => void;
  onAddTab?: () => void;
}

export function ReplitTabBar({
  tabs, activeTabId, onTabClick, onTabClose, onTabReorder,
  onTabPin, onTabDuplicate, onSplitRight, onAddTab,
}: ReplitTabBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center h-[33px] bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex items-center flex-1 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab, index) => (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                className={cn(
                  'group flex items-center gap-1.5 h-[33px] px-3 cursor-pointer shrink-0 border-r border-[var(--ide-border)]/40 transition-colors',
                  activeTabId === tab.id
                    ? 'bg-[var(--ide-panel)] text-[var(--ide-text)] border-b-2 border-b-[#0079F2]'
                    : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/30'
                )}
                onClick={() => onTabClick(tab.id)}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) {
                    onTabReorder(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                data-testid={`tab-${tab.id}`}
              >
                {tab.pinned && <Pin className="w-2.5 h-2.5 text-[#F5A623] shrink-0" />}
                <span className="text-[11px] font-medium truncate max-w-[120px]">{tab.label}</span>
                {tab.modified && <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] shrink-0" />}
                {tab.closable && !tab.pinned && (
                  <button
                    className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--ide-surface)] transition-all"
                    onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                    data-testid={`close-tab-${tab.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)]">
              {onTabPin && (
                <ContextMenuItem onClick={() => onTabPin(tab.id)} className="text-xs gap-2">
                  <Pin className="w-3 h-3" /> {tab.pinned ? 'Unpin Tab' : 'Pin Tab'}
                </ContextMenuItem>
              )}
              {onTabDuplicate && (
                <ContextMenuItem onClick={() => onTabDuplicate(tab.id)} className="text-xs gap-2">
                  <Copy className="w-3 h-3" /> Duplicate Tab
                </ContextMenuItem>
              )}
              {onSplitRight && (
                <ContextMenuItem onClick={() => onSplitRight(tab.id)} className="text-xs gap-2">
                  <PanelRight className="w-3 h-3" /> Split Right
                </ContextMenuItem>
              )}
              {tab.closable && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onTabClose(tab.id)} className="text-xs gap-2 text-red-400">
                    <X className="w-3 h-3" /> Close Tab
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      {onAddTab && (
        <button
          onClick={onAddTab}
          className="w-8 h-[33px] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/30 transition-colors shrink-0"
          data-testid="add-tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
