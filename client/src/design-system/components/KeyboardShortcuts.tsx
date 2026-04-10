/**
 * Keyboard Shortcuts Overlay
 * Display and customize keyboard shortcuts
 */

import React, { useState, useCallback, useMemo } from 'react';
import { LazyMotionDiv, LazyMotionButton } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export interface Shortcut {
  id: string;
  label: string;
  description?: string;
  keys: string[];
  category?: string;
  action?: () => void;
  customizable?: boolean;
}

export interface KeyboardShortcutsProps {
  shortcuts: Shortcut[];
  isOpen: boolean;
  onClose: () => void;
  onShortcutChange?: (id: string, newKeys: string[]) => void;
}

// ============================================================================
// KEYBOARD SHORTCUTS COMPONENT
// ============================================================================

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts,
  isOpen,
  onClose,
  onShortcutChange,
}) => {
  const ds = useDesignSystem();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups = new Map<string, Shortcut[]>();

    shortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'General';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(shortcut);
    });

    return Array.from(groups.entries());
  }, [shortcuts]);

  // Filter shortcuts by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedShortcuts;

    const query = searchQuery.toLowerCase();
    return groupedShortcuts
      .map(([category, items]) => {
        const filtered = items.filter(
          (shortcut) =>
            shortcut.label.toLowerCase().includes(query) ||
            shortcut.description?.toLowerCase().includes(query) ||
            shortcut.keys.some((key) => key.toLowerCase().includes(query))
        );
        return [category, filtered] as [string, Shortcut[]];
      })
      .filter(([, items]) => items.length > 0);
  }, [groupedShortcuts, searchQuery]);

  const handleClose = useCallback(() => {
    triggerHaptic('selection');
    setEditingShortcut(null);
    setRecordingKeys([]);
    onClose();
  }, [onClose]);

  const handleStartEdit = useCallback((shortcutId: string) => {
    triggerHaptic('selection');
    setEditingShortcut(shortcutId);
    setRecordingKeys([]);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingShortcut && recordingKeys.length > 0 && onShortcutChange) {
      triggerHaptic('success');
      onShortcutChange(editingShortcut, recordingKeys);
    }
    setEditingShortcut(null);
    setRecordingKeys([]);
  }, [editingShortcut, recordingKeys, onShortcutChange]);

  const handleCancelEdit = useCallback(() => {
    triggerHaptic('light');
    setEditingShortcut(null);
    setRecordingKeys([]);
  }, []);

  // Record keys while editing
  React.useEffect(() => {
    if (!editingShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      const keys: string[] = [];
      if (e.metaKey) keys.push('⌘');
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');

      const key = e.key;
      if (
        !['Meta', 'Control', 'Alt', 'Shift'].includes(key) &&
        key.length === 1
      ) {
        keys.push(key.toUpperCase());
      } else if (['Enter', 'Escape', 'Space', 'Tab'].includes(key)) {
        keys.push(key);
      }

      if (keys.length > 0) {
        setRecordingKeys(keys);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingShortcut]);

  if (!isOpen) return null;

  return (
    <LazyMotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: ds.zIndex.modal,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: ds.spacing[5],
      }}
    >
      <LazyMotionDiv
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '700px',
          maxHeight: '80vh',
          backgroundColor: ds.colors.background.elevated,
          borderRadius: ds.borderRadius.xl,
          boxShadow: ds.shadows.xl,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: ds.isDark
            ? `1px solid ${ds.colors.separator.opaque}`
            : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: ds.spacing[5],
            borderBottom: `1px solid ${ds.colors.separator.nonOpaque}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: ds.spacing[4],
            }}
          >
            <h2
              style={{
                ...ds.typography.textStyles.title2,
                color: ds.colors.text.primary,
                margin: 0,
              }}
            >
              Keyboard Shortcuts
            </h2>

            <LazyMotionButton
              onClick={handleClose}
              whileTap={{ scale: 0.95 }}
              style={{
                ...ds.typography.textStyles.callout,
                padding: `${ds.spacing[2]} ${ds.spacing[4]}`,
                backgroundColor: 'transparent',
                color: ds.colors.text.secondary,
                border: 'none',
                cursor: 'pointer',
                fontSize: '24px',
              }}
            >
              ✕
            </LazyMotionButton>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            style={{
              ...ds.typography.textStyles.callout,
              width: '100%',
              padding: `${ds.spacing[3]} ${ds.spacing[4]}`,
              backgroundColor: ds.colors.fill.tertiary,
              border: 'none',
              borderRadius: ds.borderRadius.md,
              color: ds.colors.text.primary,
              outline: 'none',
            }}
          />
        </div>

        {/* Shortcuts List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: ds.spacing[5],
          }}
        >
          {filteredGroups.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: ds.spacing[10],
                color: ds.colors.text.secondary,
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: ds.spacing[4] }}>
                🔍
              </div>
              <div style={{ ...ds.typography.textStyles.callout }}>
                No shortcuts found
              </div>
            </div>
          ) : (
            filteredGroups.map(([category, items]) => (
              <div key={category} style={{ marginBottom: ds.spacing[7] }}>
                <h3
                  style={{
                    ...ds.typography.textStyles.caption1,
                    fontWeight: 600,
                    color: ds.colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: ds.spacing[4],
                    margin: `0 0 ${ds.spacing[4]} 0`,
                  }}
                >
                  {category}
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: ds.spacing[3],
                  }}
                >
                  {items.map((shortcut) => (
                    <ShortcutItem
                      key={shortcut.id}
                      shortcut={shortcut}
                      isEditing={editingShortcut === shortcut.id}
                      recordingKeys={recordingKeys}
                      onStartEdit={() => handleStartEdit(shortcut.id)}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: ds.spacing[4],
            borderTop: `1px solid ${ds.colors.separator.nonOpaque}`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              ...ds.typography.textStyles.caption1,
              color: ds.colors.text.tertiary,
            }}
          >
            Press{' '}
            <kbd
              style={{
                padding: `${ds.spacing[1]} ${ds.spacing[2]}`,
                backgroundColor: ds.colors.fill.tertiary,
                borderRadius: ds.borderRadius.sm,
                fontFamily: ds.typography.fontFamily.mono,
              }}
            >
              ?
            </kbd>{' '}
            to toggle this panel
          </div>
        </div>
      </LazyMotionDiv>
    </LazyMotionDiv>
  );
};

// ============================================================================
// SHORTCUT ITEM
// ============================================================================

interface ShortcutItemProps {
  shortcut: Shortcut;
  isEditing: boolean;
  recordingKeys: string[];
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({
  shortcut,
  isEditing,
  recordingKeys,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ds.spacing[4],
        padding: ds.spacing[4],
        backgroundColor: isEditing
          ? ds.colors.fill.secondary
          : ds.colors.background.secondary,
        borderRadius: ds.borderRadius.md,
        transition: 'background-color 0.15s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...ds.typography.textStyles.callout,
            color: ds.colors.text.primary,
            marginBottom: shortcut.description ? ds.spacing[1] : 0,
          }}
        >
          {shortcut.label}
        </div>
        {shortcut.description && (
          <div
            style={{
              ...ds.typography.textStyles.caption1,
              color: ds.colors.text.secondary,
            }}
          >
            {shortcut.description}
          </div>
        )}
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: ds.spacing[3] }}>
          <div
            style={{
              ...ds.typography.textStyles.caption1,
              fontFamily: ds.typography.fontFamily.mono,
              padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
              backgroundColor: ds.colors.interactive.primary,
              color: '#FFFFFF',
              borderRadius: ds.borderRadius.sm,
              minWidth: '80px',
              textAlign: 'center',
            }}
          >
            {recordingKeys.length > 0
              ? recordingKeys.join(' + ')
              : 'Press keys...'}
          </div>

          <LazyMotionButton
            onClick={onSaveEdit}
            whileTap={{ scale: 0.95 }}
            disabled={recordingKeys.length === 0}
            style={{
              ...ds.typography.textStyles.caption1,
              padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
              backgroundColor: ds.colors.feedback.success,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: ds.borderRadius.sm,
              cursor: recordingKeys.length === 0 ? 'not-allowed' : 'pointer',
              opacity: recordingKeys.length === 0 ? 0.5 : 1,
            }}
          >
            ✓
          </LazyMotionButton>

          <LazyMotionButton
            onClick={onCancelEdit}
            whileTap={{ scale: 0.95 }}
            style={{
              ...ds.typography.textStyles.caption1,
              padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
              backgroundColor: ds.colors.fill.tertiary,
              color: ds.colors.text.primary,
              border: 'none',
              borderRadius: ds.borderRadius.sm,
              cursor: 'pointer',
            }}
          >
            ✕
          </LazyMotionButton>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: ds.spacing[2] }}>
          {shortcut.keys.map((key, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <span
                  style={{
                    ...ds.typography.textStyles.caption1,
                    color: ds.colors.text.tertiary,
                  }}
                >
                  +
                </span>
              )}
              <kbd
                style={{
                  ...ds.typography.textStyles.caption1,
                  fontFamily: ds.typography.fontFamily.mono,
                  padding: `${ds.spacing[1]} ${ds.spacing[2]}`,
                  backgroundColor: ds.colors.fill.tertiary,
                  borderRadius: ds.borderRadius.sm,
                  border: `1px solid ${ds.colors.separator.nonOpaque}`,
                  boxShadow: `0 1px 0 ${ds.colors.separator.nonOpaque}`,
                  color: ds.colors.text.primary,
                  minWidth: '24px',
                  textAlign: 'center',
                }}
              >
                {key}
              </kbd>
            </React.Fragment>
          ))}

          {shortcut.customizable && (
            <LazyMotionButton
              onClick={onStartEdit}
              whileTap={{ scale: 0.95 }}
              style={{
                ...ds.typography.textStyles.caption1,
                padding: `${ds.spacing[1]} ${ds.spacing[2]}`,
                backgroundColor: 'transparent',
                color: ds.colors.text.tertiary,
                border: 'none',
                cursor: 'pointer',
                marginLeft: ds.spacing[2],
              }}
            >
              ✏️
            </LazyMotionButton>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HOOK FOR KEYBOARD SHORTCUTS
// ============================================================================

export const useKeyboardShortcuts = () => {
  const [isOpen, setIsOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press '?' to toggle shortcuts panel
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if typing in input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
};

// ============================================================================
// DEFAULT SHORTCUTS FOR E-CODE IDE
// ============================================================================

export const defaultIDEShortcuts: Shortcut[] = [
  // File Operations
  {
    id: 'new-file',
    label: 'New File',
    description: 'Create a new file',
    keys: ['⌘', 'N'],
    category: 'File',
    customizable: true,
  },
  {
    id: 'save-file',
    label: 'Save File',
    description: 'Save the current file',
    keys: ['⌘', 'S'],
    category: 'File',
    customizable: true,
  },
  {
    id: 'open-file',
    label: 'Open File',
    description: 'Open file picker',
    keys: ['⌘', 'O'],
    category: 'File',
    customizable: true,
  },

  // Editor
  {
    id: 'find',
    label: 'Find',
    description: 'Search in current file',
    keys: ['⌘', 'F'],
    category: 'Editor',
    customizable: true,
  },
  {
    id: 'replace',
    label: 'Replace',
    description: 'Search and replace',
    keys: ['⌘', 'H'],
    category: 'Editor',
    customizable: true,
  },
  {
    id: 'command-palette',
    label: 'Command Palette',
    description: 'Open command palette',
    keys: ['⌘', 'K'],
    category: 'Editor',
    customizable: true,
  },

  // Navigation
  {
    id: 'go-to-file',
    label: 'Go to File',
    description: 'Quick file navigation',
    keys: ['⌘', 'P'],
    category: 'Navigation',
    customizable: true,
  },
  {
    id: 'go-to-line',
    label: 'Go to Line',
    description: 'Jump to specific line',
    keys: ['⌘', 'G'],
    category: 'Navigation',
    customizable: true,
  },

  // View
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    description: 'Show/hide file explorer',
    keys: ['⌘', 'B'],
    category: 'View',
    customizable: true,
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal',
    description: 'Show/hide terminal panel',
    keys: ['⌘', '`'],
    category: 'View',
    customizable: true,
  },

  // Terminal
  {
    id: 'clear-terminal',
    label: 'Clear Terminal',
    description: 'Clear terminal output',
    keys: ['⌘', 'K'],
    category: 'Terminal',
    customizable: true,
  },
];

export default KeyboardShortcuts;
