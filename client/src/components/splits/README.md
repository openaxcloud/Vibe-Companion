# Splits Layout System

A complete Replit-style drag-and-drop panel system for the E-Code Platform IDE. This implementation provides a flexible layout system where users can arrange their workspace with draggable, resizable, and floatable panes.

## Features

### Core Features
- ✅ **Drag and Drop**: Drag tabs between panes or files from the file tree
- ✅ **Split Panes**: Split panes horizontally or vertically  
- ✅ **Merge Tabs**: Drop tabs on headers to merge them into existing panes
- ✅ **Floating Panes**: Float panes outside the layout and move them freely
- ✅ **Resize Handles**: Draggable borders between panes with visual feedback
- ✅ **Context Menus**: Right-click panes for quick actions
- ✅ **Layout Persistence**: Automatically saves layout to localStorage
- ✅ **Smooth Animations**: Spring physics and fluid transitions

### Drop Zones
The system implements 5 hit areas for dropping:
1. **Header**: Merge tabs into existing pane
2. **Top/Bottom**: Split vertically
3. **Left/Right**: Split horizontally  
4. **Center**: Replace or merge content

### Visual Feedback
- 50px minimum drag radius visualization
- Highlighted drop zones with preview
- Animated drag overlay
- Conical sections for ergonomic dragging

## Architecture

### Core Components
- `SplitsLayout`: Main layout container with DnD context
- `SplitsPane`: Individual pane with tabs and content
- `SplitsResizeHandle`: Draggable resize handles between panes
- `FloatingPane`: Floating window container
- `SplitsEditorLayout`: Integration with existing editor

### Data Structures
- `Split`: Node with direction and children
- `PaneGroup`: Container with tabs and active index
- `FloatingPane`: Floating pane with position
- `TabInfo`: Tab metadata and content

### State Management
- **Zustand Store**: Central state management
- **Layout Operations**: Split, merge, float, resize
- **History Management**: Undo/redo support
- **Persistence**: Auto-save to localStorage

## Usage

### Basic Setup
```tsx
import { SplitsEditorLayout } from '@/components/splits';
import '@/styles/splits.css';

<SplitsEditorLayout
  files={files}
  activeFileId={activeFileId}
  onFileSelect={handleFileSelect}
  editorContent={<EditorComponent />}
  terminalContent={<TerminalComponent />}
  previewContent={<PreviewComponent />}
/>
```

### Programmatic Control
```tsx
import useSplitsStore from '@/stores/splits-store';

const { 
  splitPane,
  floatPane,
  addTab,
  saveLayout 
} = useSplitsStore();

// Split a pane
splitPane('pane-id', 'horizontal');

// Float a pane
floatPane('pane-id');

// Add a new tab
addTab('pane-id', {
  id: 'tab-1',
  title: 'New File',
  content: <FileContent />
});
```

## Keyboard Shortcuts
- **Drag**: Click and drag tabs or panes
- **Right-click**: Open context menu
- **Escape**: Cancel drag operation

## Configuration

### Feature Flags
The system uses a feature flag in `ReplitEditorLayout.tsx`:
```tsx
const useSplitsLayout = true; // Enable/disable splits
```

### Styling
Custom styles are in `client/src/styles/splits.css` with CSS variables for theming:
- `--splits-animation-duration`: Animation speed
- `--splits-resize-handle-size`: Handle thickness
- `--splits-drop-zone-color`: Drop zone highlight

## Performance

- **React Spring**: Hardware-accelerated animations
- **Will-change**: Optimized for transforms
- **Debounced saves**: Prevents excessive localStorage writes
- **Lazy loading**: Components load on demand

## Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (touch support)

## Future Enhancements
- [ ] Keyboard navigation between panes
- [ ] Preset layouts (IDE, Notebook, etc.)
- [ ] Export/import layout configurations
- [ ] Multi-monitor support
- [ ] Tab groups and workspaces