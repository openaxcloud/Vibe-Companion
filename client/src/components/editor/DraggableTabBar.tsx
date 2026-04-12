import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableTab } from './DraggableTab';
import { File } from '@shared/schema';

interface DraggableTabBarProps {
  tabs: number[];
  files?: File[];
  activeFileId?: number;
  onTabSelect: (fileId: number) => void;
  onTabClose: (fileId: number) => void;
  onTabsReorder: (newOrder: number[]) => void;
}

export function DraggableTabBar({
  tabs,
  files = [],
  activeFileId,
  onTabSelect,
  onTabClose,
  onTabsReorder,
}: DraggableTabBarProps) {
  const [localTabs, setLocalTabs] = useState(tabs);

  // Sync local tabs with props via useEffect (prevents render-phase state updates)
  useEffect(() => {
    setLocalTabs(tabs);
  }, [tabs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localTabs.indexOf(Number(active.id));
      const newIndex = localTabs.indexOf(Number(over.id));
      
      const newOrder = arrayMove(localTabs, oldIndex, newIndex);
      setLocalTabs(newOrder);
      onTabsReorder(newOrder);
    }
  }

  const getFileName = (fileId: number) => {
    const file = files.find(f => f.id === fileId);
    return file?.filename || file?.name || `File ${fileId}`;
  };

  return (
    <div
      className="flex items-center bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] overflow-x-auto scrollbar-thin"
      data-testid="draggable-tab-bar"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localTabs.map(String)}
          strategy={horizontalListSortingStrategy}
        >
          {localTabs.map((fileId, index) => {
            const file = files.find(f => f.id === fileId);
            return (
              <DraggableTab
                key={fileId}
                id={fileId}
                label={getFileName(fileId)}
                file={file}
                isActive={fileId === activeFileId}
                isLast={index === localTabs.length - 1}
                onSelect={() => onTabSelect(fileId)}
                onClose={() => onTabClose(fileId)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
