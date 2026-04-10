/**
 * Split View Editor
 * Multi-pane editor for tablets and desktop
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PanInfo } from '@/lib/motion';
import { LazyMotionDiv, LazyMotionButton, LazyMotionSpan } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export type SplitOrientation = 'horizontal' | 'vertical';
export type PaneSize = 'auto' | number; // number is percentage

export interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  orientation?: SplitOrientation;
  defaultSize?: number; // percentage (0-100)
  minSize?: number; // percentage
  maxSize?: number; // percentage
  resizable?: boolean;
  onSizeChange?: (size: number) => void;
  className?: string;
}

// ============================================================================
// SPLIT VIEW COMPONENT
// ============================================================================

export const SplitView: React.FC<SplitViewProps> = ({
  left,
  right,
  orientation = 'horizontal',
  defaultSize = 50,
  minSize = 20,
  maxSize = 80,
  resizable = true,
  onSizeChange,
  className,
}) => {
  const ds = useDesignSystem();
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = orientation === 'horizontal';

  const handleDrag = useCallback(
    (_: any, info: PanInfo) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      let newSize: number;

      if (isHorizontal) {
        const mouseX = info.point.x - rect.left;
        newSize = (mouseX / rect.width) * 100;
      } else {
        const mouseY = info.point.y - rect.top;
        newSize = (mouseY / rect.height) * 100;
      }

      // Clamp size
      newSize = Math.max(minSize, Math.min(maxSize, newSize));

      setSize(newSize);
      onSizeChange?.(newSize);
    },
    [isHorizontal, minSize, maxSize, onSizeChange]
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    triggerHaptic('light');
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    triggerHaptic('light');
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left/Top Pane */}
      <div
        style={{
          [isHorizontal ? 'width' : 'height']: `${size}%`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {left}
      </div>

      {/* Resize Handle */}
      {resizable && (
        <LazyMotionDiv
          drag={isHorizontal ? 'x' : 'y'}
          dragConstraints={containerRef}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          whileHover={{ opacity: 1 }}
          style={{
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: `${size}%`,
            [isHorizontal ? 'width' : 'height']: '8px',
            [isHorizontal ? 'height' : 'width']: '100%',
            transform: isHorizontal ? 'translateX(-4px)' : 'translateY(-4px)',
            cursor: isHorizontal ? 'ew-resize' : 'ns-resize',
            zIndex: ds.zIndex.sticky,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDragging ? 1 : 0,
            transition: 'opacity 0.2s ease',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {/* Visual indicator */}
          <div
            style={{
              [isHorizontal ? 'width' : 'height']: '2px',
              [isHorizontal ? 'height' : 'width']: isDragging ? '100%' : '40px',
              backgroundColor: ds.colors.interactive.primary,
              borderRadius: '1px',
              transition: isDragging ? 'none' : 'all 0.2s ease',
              boxShadow: isDragging
                ? `0 0 8px ${ds.colors.interactive.primary}`
                : 'none',
            }}
          />
        </LazyMotionDiv>
      )}

      {/* Right/Bottom Pane */}
      <div
        style={{
          [isHorizontal ? 'width' : 'height']: `${100 - size}%`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {right}
      </div>
    </div>
  );
};

// ============================================================================
// TRIPLE SPLIT VIEW (for advanced layouts)
// ============================================================================

export interface TripleSplitViewProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  defaultLeftSize?: number;
  defaultRightSize?: number;
  minSize?: number;
  maxSize?: number;
  resizable?: boolean;
}

export const TripleSplitView: React.FC<TripleSplitViewProps> = ({
  left,
  center,
  right,
  defaultLeftSize = 25,
  defaultRightSize = 25,
  minSize = 15,
  maxSize = 40,
  resizable = true,
}) => {
  const [leftSize, setLeftSize] = useState(defaultLeftSize);
  const [rightSize, setRightSize] = useState(defaultRightSize);

  const centerSize = 100 - leftSize - rightSize;

  return (
    <SplitView
      left={left}
      right={
        <SplitView
          left={center}
          right={right}
          defaultSize={(rightSize / (100 - leftSize)) * 100}
          minSize={(minSize / (100 - leftSize)) * 100}
          maxSize={(maxSize / (100 - leftSize)) * 100}
          resizable={resizable}
          onSizeChange={(size) => {
            const newRightSize = ((100 - leftSize) * size) / 100;
            setRightSize(newRightSize);
          }}
        />
      }
      defaultSize={leftSize}
      minSize={minSize}
      maxSize={maxSize}
      resizable={resizable}
      onSizeChange={setLeftSize}
    />
  );
};

// ============================================================================
// TAB PANEL (for split view tabs)
// ============================================================================

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  content: React.ReactNode;
  closable?: boolean;
}

export interface TabPanelProps {
  tabs: Tab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  className,
}) => {
  const ds = useDesignSystem();
  const [activeTab, setActiveTab] = useState(activeTabId || tabs[0]?.id);

  const handleTabChange = useCallback(
    (tabId: string) => {
      triggerHaptic('selection');
      setActiveTab(tabId);
      onTabChange?.(tabId);
    },
    [onTabChange]
  );

  const handleTabClose = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic('light');
      onTabClose?.(tabId);

      // Switch to another tab if closing active tab
      if (tabId === activeTab) {
        const index = tabs.findIndex((t) => t.id === tabId);
        const nextTab = tabs[index + 1] || tabs[index - 1];
        if (nextTab) {
          setActiveTab(nextTab.id);
        }
      }
    },
    [activeTab, tabs, onTabClose]
  );

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ds.spacing[1],
          padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
          backgroundColor: ds.colors.background.secondary,
          borderBottom: `1px solid ${ds.colors.separator.nonOpaque}`,
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <LazyMotionButton
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              whileTap={{ scale: 0.98 }}
              style={{
                ...ds.typography.textStyles.caption1,
                display: 'flex',
                alignItems: 'center',
                gap: ds.spacing[2],
                padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
                backgroundColor: isActive
                  ? ds.colors.background.primary
                  : 'transparent',
                color: isActive
                  ? ds.colors.text.primary
                  : ds.colors.text.secondary,
                border: 'none',
                borderRadius: ds.borderRadius.sm,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>

              {tab.closable && (
                <LazyMotionSpan
                  onClick={(e) => handleTabClose(tab.id, e)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    marginLeft: ds.spacing[1],
                    opacity: isActive ? 1 : 0.5,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </LazyMotionSpan>
              )}
            </LazyMotionButton>
          );
        })}
      </div>

      {/* Tab Content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {activeTabData?.content}
      </div>
    </div>
  );
};

// ============================================================================
// MULTI-EDITOR LAYOUT (Preset for code editors)
// ============================================================================

export interface EditorFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

export interface MultiEditorLayoutProps {
  files: EditorFile[];
  renderEditor: (file: EditorFile) => React.ReactNode;
  onFileClose?: (fileId: string) => void;
}

export const MultiEditorLayout: React.FC<MultiEditorLayoutProps> = ({
  files,
  renderEditor,
  onFileClose,
}) => {
  const ds = useDesignSystem();
  const [layout, setLayout] = useState<'single' | 'split'>('single');
  const [leftFiles, setLeftFiles] = useState<EditorFile[]>([files[0]].filter(Boolean));
  const [rightFiles, setRightFiles] = useState<EditorFile[]>([]);

  const toggleLayout = useCallback(() => {
    triggerHaptic('medium');
    if (layout === 'single') {
      // Split: move half files to right
      const mid = Math.ceil(files.length / 2);
      setLeftFiles(files.slice(0, mid));
      setRightFiles(files.slice(mid));
      setLayout('split');
    } else {
      // Merge: move all to left
      setLeftFiles(files);
      setRightFiles([]);
      setLayout('single');
    }
  }, [layout, files]);

  if (layout === 'single' || !ds.device.isTablet) {
    return (
      <TabPanel
        tabs={files.map((file) => ({
          id: file.id,
          label: file.name,
          content: renderEditor(file),
          closable: true,
        }))}
        onTabClose={onFileClose}
      />
    );
  }

  return (
    <SplitView
      left={
        <TabPanel
          tabs={leftFiles.map((file) => ({
            id: file.id,
            label: file.name,
            content: renderEditor(file),
            closable: true,
          }))}
          onTabClose={onFileClose}
        />
      }
      right={
        <TabPanel
          tabs={rightFiles.map((file) => ({
            id: file.id,
            label: file.name,
            content: renderEditor(file),
            closable: true,
          }))}
          onTabClose={onFileClose}
        />
      }
      defaultSize={50}
      minSize={30}
      maxSize={70}
    />
  );
};

export default SplitView;
