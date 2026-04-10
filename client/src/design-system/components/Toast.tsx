/**
 * Toast Notification System
 * iOS/Android-inspired notification banners with haptic feedback
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  position?: ToastPosition;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void;
  hide: (id: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// ============================================================================
// TOAST ITEM COMPONENT
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const ds = useDesignSystem();
  const { type, message, description, position = 'top', action } = toast;

  // Icon for each type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  // Colors for each type
  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: ds.colors.feedback.success,
          text: '#FFFFFF',
        };
      case 'error':
        return {
          bg: ds.colors.feedback.error,
          text: '#FFFFFF',
        };
      case 'warning':
        return {
          bg: ds.colors.feedback.warning,
          text: '#FFFFFF',
        };
      case 'info':
        return {
          bg: ds.colors.interactive.primary,
          text: '#FFFFFF',
        };
    }
  };

  const colors = getColors();

  const handleDismiss = () => {
    triggerHaptic('selection');
    onDismiss();
  };

  return (
    <LazyMotionDiv
      layout
      initial={{
        opacity: 0,
        y: position === 'top' ? -100 : 100,
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.2 },
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 100) {
          handleDismiss();
        }
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: ds.spacing[4],
        padding: `${ds.spacing[4]} ${ds.spacing[5]}`,
        backgroundColor: colors.bg,
        borderRadius: ds.borderRadius.lg,
        boxShadow: ds.shadows.lg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        maxWidth: '90vw',
        width: '100%',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={handleDismiss}
    >
      {/* Icon */}
      <div
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: colors.text,
          flexShrink: 0,
        }}
      >
        {icons[type]}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...ds.typography.textStyles.callout,
            fontWeight: 600,
            color: colors.text,
            marginBottom: description ? ds.spacing[1] : 0,
          }}
        >
          {message}
        </div>
        {description && (
          <div
            style={{
              ...ds.typography.textStyles.footnote,
              color: colors.text,
              opacity: 0.9,
            }}
          >
            {description}
          </div>
        )}
        {action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('selection');
              action.onPress();
              handleDismiss();
            }}
            style={{
              ...ds.typography.textStyles.footnote,
              fontWeight: 600,
              color: colors.text,
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: ds.borderRadius.sm,
              padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
              marginTop: ds.spacing[3],
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.text,
          fontSize: '18px',
          cursor: 'pointer',
          padding: ds.spacing[1],
          opacity: 0.6,
          transition: 'opacity 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.6';
        }}
      >
        ✕
      </button>
    </LazyMotionDiv>
  );
};

// ============================================================================
// TOAST CONTAINER
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position: ToastPosition;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position,
}) => {
  const ds = useDesignSystem();
  const safeArea = position === 'top' ? 'env(safe-area-inset-top, 0px)' : 'env(safe-area-inset-bottom, 0px)';

  return (
    <div
      style={{
        position: 'fixed',
        [position]: `calc(${ds.spacing[5]} + ${safeArea})`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: ds.zIndex.notification,
        display: 'flex',
        flexDirection: 'column',
        gap: ds.spacing[3],
        pointerEvents: 'none',
        maxWidth: '500px',
        width: 'calc(100% - 32px)',
      }}
    >
      <LazyAnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{ pointerEvents: 'auto' }}
          >
            <ToastItem toast={toast} onDismiss={() => onDismiss(toast.id)} />
          </div>
        ))}
      </LazyAnimatePresence>
    </div>
  );
};

// ============================================================================
// TOAST PROVIDER
// ============================================================================

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Define hide FIRST since show depends on it
  const hide = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const duration = toast.duration ?? 4000;
    const position = toast.position ?? 'top';

    const newToast: Toast = {
      ...toast,
      id,
      position,
    };

    // Trigger haptic based on type (safe call)
    try {
      switch (toast.type) {
        case 'success':
          triggerHaptic('success');
          break;
        case 'error':
          triggerHaptic('error');
          break;
        case 'warning':
          triggerHaptic('warning');
          break;
        default:
          triggerHaptic('light');
      }
    } catch (e) {
      // Haptic feedback not available, ignore
    }

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        hide(id);
      }, duration);
    }
  }, [hide]);

  const success = useCallback(
    (message: string, description?: string) => {
      show({ type: 'success', message, description });
    },
    [show]
  );

  const error = useCallback(
    (message: string, description?: string) => {
      show({ type: 'error', message, description });
    },
    [show]
  );

  const warning = useCallback(
    (message: string, description?: string) => {
      show({ type: 'warning', message, description });
    },
    [show]
  );

  const info = useCallback(
    (message: string, description?: string) => {
      show({ type: 'info', message, description });
    },
    [show]
  );

  const contextValue = React.useMemo(
    () => ({ show, hide, success, error, warning, info }),
    [show, hide, success, error, warning, info]
  );

  const topToasts = toasts.filter((t) => t.position === 'top');
  const bottomToasts = toasts.filter((t) => t.position === 'bottom');

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={topToasts} onDismiss={hide} position="top" />
      <ToastContainer toasts={bottomToasts} onDismiss={hide} position="bottom" />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
