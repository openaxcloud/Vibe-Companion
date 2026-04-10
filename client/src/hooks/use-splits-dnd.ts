import { useCallback, useEffect } from 'react';
import useSplitsStore from '@/stores/splits-store';
import { DragItem, TabInfo } from '@/types/splits';

export function useSplitsDnd() {
  const {
    startDrag,
    updateDrag,
    endDrag,
    addTab,
    moveTab,
    splitPane,
    generateTabId,
  } = useSplitsStore();

  // Handle file drag from file tree
  const handleFileDragStart = useCallback((
    file: { id: number; name: string; path: string },
    event: React.DragEvent
  ) => {
    const dragItem: DragItem = {
      type: 'file',
      source: 'file-tree',
      id: String(file.id),
      filePath: file.path,
      fileName: file.name,
    };

    startDrag(dragItem, { x: event.clientX, y: event.clientY });
  }, [startDrag]);

  // Handle tab drag from pane
  const handleTabDragStart = useCallback((
    tab: TabInfo,
    paneId: string,
    event: React.DragEvent
  ) => {
    const dragItem: DragItem = {
      type: 'tab',
      source: 'layout',
      id: tab.id,
      paneId,
      tabInfo: tab,
    };

    startDrag(dragItem, { x: event.clientX, y: event.clientY });
  }, [startDrag]);

  // Handle drag over
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    updateDrag({ x: event.clientX, y: event.clientY });
  }, [updateDrag]);

  // Handle drop on pane
  const handleDropOnPane = useCallback((
    targetPaneId: string,
    dropZone: 'top' | 'right' | 'bottom' | 'left' | 'center' | 'header',
    event: React.DragEvent
  ) => {
    event.preventDefault();
    
    const dragState = useSplitsStore.getState().dragState;
    
    if (!dragState.draggedItem) {
      endDrag();
      return;
    }

    const draggedItem = dragState.draggedItem;

    if (draggedItem.type === 'file') {
      // Create a new tab from the file
      const newTab: TabInfo = {
        id: generateTabId(),
        title: draggedItem.fileName || 'New File',
        type: 'editor',
        content: null,
        filePath: draggedItem.filePath,
        canClose: true,
      };

      if (dropZone === 'center' || dropZone === 'header') {
        // Add to existing pane
        addTab(targetPaneId, newTab, true);
      } else {
        // Split pane and add to new pane
        const direction = (dropZone === 'top' || dropZone === 'bottom') ? 'vertical' : 'horizontal';
        const newPaneId = useSplitsStore.getState().generatePaneId();
        
        splitPane(targetPaneId, direction, {
          id: newPaneId,
          tabs: [newTab],
          activeTabIndex: 0,
          percent: 50,
        });
      }
    } else if (draggedItem.type === 'tab' && draggedItem.paneId) {
      // Moving an existing tab
      if (dropZone === 'center' || dropZone === 'header') {
        // Move to existing pane
        moveTab(draggedItem.id, draggedItem.paneId, targetPaneId);
      } else {
        // Split pane and move to new pane
        const direction = (dropZone === 'top' || dropZone === 'bottom') ? 'vertical' : 'horizontal';
        const newPaneId = useSplitsStore.getState().generatePaneId();
        
        splitPane(targetPaneId, direction, {
          id: newPaneId,
          tabs: [],
          activeTabIndex: 0,
          percent: 50,
        });
        
        moveTab(draggedItem.id, draggedItem.paneId, newPaneId);
      }
    }

    endDrag();
  }, [addTab, moveTab, splitPane, generateTabId, endDrag]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Global drag event listeners
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      if (useSplitsStore.getState().dragState.isDragging) {
        e.preventDefault();
        updateDrag({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalDrop = (e: DragEvent) => {
      if (useSplitsStore.getState().dragState.isDragging) {
        e.preventDefault();
        endDrag();
      }
    };

    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [updateDrag, endDrag]);

  return {
    handleFileDragStart,
    handleTabDragStart,
    handleDragOver,
    handleDropOnPane,
    handleDragEnd,
  };
}