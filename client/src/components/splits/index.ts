export { SplitsLayout } from './SplitsLayout';
export { SplitsPane } from './SplitsPane';
export { SplitsResizeHandle } from './SplitsResizeHandle';
export { FloatingPane } from './FloatingPane';
export { DragOverlayContent } from './DragOverlayContent';
export { SplitsEditorLayout } from './SplitsEditorLayout';
export { SplitsEditorLayoutV2 } from './SplitsEditorLayoutV2';
export { 
  createEditorDefaultLayout, 
  TOOL_DOCK_TO_TAB_MAP, 
  TAB_TO_TOOL_DOCK_MAP,
  type PanelContentFactory 
} from './EditorDefaultLayout';

export { useSplitsDnd } from '@/hooks/use-splits-dnd';
export { default as useSplitsStore } from '@/stores/splits-store';

export type {
  LayoutNode,
  Split,
  PaneGroup,
  TabInfo,
  FloatingPane as FloatingPaneType,
  DragItem,
  DropTarget,
  DropZone,
  PaneType,
  DragState,
  ResizeState,
  LayoutState,
  LayoutOperations,
} from '@/types/splits';

export {
  isSplit,
  isPaneGroup,
  DEFAULT_LAYOUT,
} from '@/types/splits';