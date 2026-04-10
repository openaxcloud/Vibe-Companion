/**
 * Context Menu Component
 * iOS-style context menu with blur effect and haptic feedback
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic, useLongPress } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface ContextMenuSection {
  items: ContextMenuItem[];
}

export interface ContextMenuProps {
  trigger: React.ReactNode;
  sections: ContextMenuSection[];
  longPressDelay?: number;
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

export const ContextMenu: React.FC<ContextMenuProps> = ({
  trigger,
  sections,
  longPressDelay = 500,
}) => {
  const ds = useDesignSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleItemPress = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;

      triggerHaptic(item.destructive ? 'warning' : 'selection');
      handleClose();
      item.onPress();
    },
    [handleClose]
  );

  const longPressHandlers = useLongPress({
    delay: longPressDelay,
    onLongPress: handleOpen,
    hapticFeedback: true,
  });

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen, handleClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { x, y } = position;

      // Adjust horizontal position
      if (x + menuRect.width / 2 > viewportWidth - 20) {
        x = viewportWidth - menuRect.width / 2 - 20;
      }
      if (x - menuRect.width / 2 < 20) {
        x = menuRect.width / 2 + 20;
      }

      // Adjust vertical position
      if (y + menuRect.height / 2 > viewportHeight - 20) {
        y = viewportHeight - menuRect.height / 2 - 20;
      }
      if (y - menuRect.height / 2 < 20) {
        y = menuRect.height / 2 + 20;
      }

      if (x !== position.x || y !== position.y) {
        setPosition({ x, y });
      }
    }
  }, [isOpen, position]);

  return (
    <>
      {/* Trigger */}
      <div ref={triggerRef} {...longPressHandlers} style={{ display: 'inline-block' }}>
        {trigger}
      </div>

      {/* Menu Portal */}
      <LazyAnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <LazyMotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleClose}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: ds.zIndex.popover,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />

            {/* Menu */}
            <LazyMotionDiv
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
              }}
              style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                zIndex: ds.zIndex.popover + 1,
                minWidth: '250px',
                maxWidth: '90vw',
                backgroundColor: ds.colors.background.elevated,
                borderRadius: ds.borderRadius.xl,
                boxShadow: ds.shadows.xl,
                overflow: 'hidden',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: ds.isDark
                  ? `0.5px solid ${ds.colors.separator.opaque}`
                  : 'none',
              }}
            >
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  {sectionIndex > 0 && (
                    <div
                      style={{
                        height: '1px',
                        backgroundColor: ds.colors.separator.nonOpaque,
                        margin: `${ds.spacing[2]} ${ds.spacing[4]}`,
                      }}
                    />
                  )}
                  {section.items.map((item) => (
                    <MenuItem
                      key={item.id}
                      item={item}
                      onPress={() => handleItemPress(item)}
                    />
                  ))}
                </div>
              ))}
            </LazyMotionDiv>
          </>
        )}
      </LazyAnimatePresence>
    </>
  );
};

// ============================================================================
// MENU ITEM COMPONENT
// ============================================================================

interface MenuItemProps {
  item: ContextMenuItem;
  onPress: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ item, onPress }) => {
  const ds = useDesignSystem();
  const [isPressed, setIsPressed] = useState(false);

  return (
    <LazyMotionButton
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onClick={onPress}
      disabled={item.disabled}
      whileTap={{ scale: item.disabled ? 1 : 0.98 }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: ds.spacing[4],
        padding: `${ds.spacing[4]} ${ds.spacing[5]}`,
        backgroundColor: isPressed
          ? ds.colors.fill.secondary
          : 'transparent',
        border: 'none',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.15s ease',
        textAlign: 'left',
        minHeight: ds.touchTargets.min,
        opacity: item.disabled ? 0.4 : 1,
      }}
    >
      {/* Icon */}
      {item.icon && (
        <div
          style={{
            fontSize: '20px',
            width: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: item.destructive
              ? ds.colors.feedback.error
              : ds.colors.text.primary,
          }}
        >
          {typeof item.icon === 'string' ? item.icon : item.icon}
        </div>
      )}

      {/* Label */}
      <div
        style={{
          ...ds.typography.textStyles.callout,
          color: item.destructive
            ? ds.colors.feedback.error
            : ds.colors.text.primary,
          flex: 1,
        }}
      >
        {item.label}
      </div>
    </LazyMotionButton>
  );
};

// ============================================================================
// REUSABLE CONTEXT MENU HOOK
// ============================================================================

export interface UseContextMenuReturn {
  ContextMenuComponent: React.FC;
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

export const useContextMenu = (
  sections: ContextMenuSection[]
): UseContextMenuReturn => {
  const [isOpen, setIsOpen] = useState(false);

  const ContextMenuComponent: React.FC = () => {
    return isOpen ? (
      <ContextMenu
        trigger={<></>}
        sections={sections}
        longPressDelay={0}
      />
    ) : null;
  };

  return {
    ContextMenuComponent,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    isOpen,
  };
};

// ============================================================================
// DROPDOWN VARIANT (Click instead of long press)
// ============================================================================

export const Dropdown: React.FC<{
  trigger: React.ReactNode;
  sections: ContextMenuSection[];
}> = ({ trigger, sections }) => {
  const ds = useDesignSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left,
        y: rect.bottom + 8,
      });
      triggerHaptic('selection');
    }
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleItemPress = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;

      triggerHaptic(item.destructive ? 'warning' : 'selection');
      handleClose();
      item.onPress();
    },
    [handleClose]
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        style={{ display: 'inline-block', cursor: 'pointer' }}
      >
        {trigger}
      </div>

      <LazyAnimatePresence>
        {isOpen && (
          <LazyMotionDiv
            ref={menuRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              zIndex: ds.zIndex.dropdown,
              minWidth: '200px',
              maxWidth: '90vw',
              backgroundColor: ds.colors.background.elevated,
              borderRadius: ds.borderRadius.lg,
              boxShadow: ds.shadows.lg,
              overflow: 'hidden',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: ds.isDark
                ? `0.5px solid ${ds.colors.separator.opaque}`
                : 'none',
            }}
          >
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {sectionIndex > 0 && (
                  <div
                    style={{
                      height: '1px',
                      backgroundColor: ds.colors.separator.nonOpaque,
                      margin: `${ds.spacing[2]} 0`,
                    }}
                  />
                )}
                {section.items.map((item) => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    onPress={() => handleItemPress(item)}
                  />
                ))}
              </div>
            ))}
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </>
  );
};

export default ContextMenu;
