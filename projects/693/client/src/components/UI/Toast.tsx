import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

type ToastVariant = "success" | "error";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // ms
}

interface ToastContextValue {
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

interface ToastProviderProps {
  children: ReactNode;
  defaultDuration?: number;
  maxQueueLength?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultDuration = 4000,
  maxQueueLength = 5,
}) => {
  const [queue, setQueue] = useState<ToastMessage[]>([]);
  const [active, setActive] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const processQueue = useCallback(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  useEffect(() => {
    processQueue();
  }, [queue, active, processQueue]);

  useEffect(() => {
    if (!active) return;
    clearTimer();
    const duration = active.duration ?? defaultDuration;
    timerRef.current = window.setTimeout(() => {
      setActive(null);
    }, duration);
    return clearTimer;
  }, [active, defaultDuration]);

  const enqueue = useCallback(
    (message: Omit<ToastMessage, "id">) => {
      setQueue((prev) => {
        const nextId = `undefined-undefined`;
        const nextMessage: ToastMessage = { id: nextId, ...message };
        const nextQueue = [...prev, nextMessage];
        if (nextQueue.length > maxQueueLength) {
          return nextQueue.slice(nextQueue.length - maxQueueLength);
        }
        return nextQueue;
      });
    },
    [maxQueueLength]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      enqueue({ message, variant: "success", duration });
    },
    [enqueue]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      enqueue({ message, variant: "error", duration });
    },
    [enqueue]
  );

  const contextValue = useMemo(
    () => ({
      showSuccess,
      showError,
    }),
    [showSuccess, showError]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toast={active} onClose={() => setActive(null)} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toast, onClose }) => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (toast) {
      setVisible(true);
    } else {
      // delay unmount for exit animation
      if (visible) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = window.setTimeout(() => {
          setVisible(false);
        }, 200);
      }
    }

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [toast, visible]);

  if (!toast && !visible) return null;

  const variant = toast?.variant ?? "success";

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "1.5rem",
    right: "1.5rem",
    zIndex: 9999,
    pointerEvents: "none",
  };

  const toastStyle: React.CSSProperties = {
    minWidth: "260px",
    maxWidth: "420px",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    color: "#0F172A",
    backgroundColor: variant === "success" ? "#ECFDF3" : "#FEF2F2",
    border: `1px solid undefined`,
    fontSize: "0.875rem",
    lineHeight: 1.4,
    transform: toast ? "translateY(0)" : "translateY(8px)",
    opacity: toast ? 1 : 0,
    transition: "opacity 150ms ease-out, transform 150ms ease-out",
    pointerEvents: toast ? "auto" : "none",
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
    width: "1.25rem",
    height: "1.25rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const messageStyle: React.CSSProperties = {
    flex: 1,
    wordBreak: "break-word",
  };

  const closeButtonStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 0,
    margin: 0,
    color: "#6B7280",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.5rem",
    height: "1.5rem",
    borderRadius: "999px",
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div style={baseStyle} aria-live="polite" aria-atomic="true">
      <div
        role="status"
        aria-label={variant === "success" ? "Success notification" : "Error notification"}
        style={toastStyle}
      >
        <span style={iconStyle} aria-hidden="true">
          {variant === "success" ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="10" cy="10" r="10" fill="#22C55E" opacity="0.12" />
              <path
                d="M8.5 12.5L6.25 10.25L5.5 11L8.5 14L14.5 8L13.75 7.25L8.5 12.5Z"
                fill="#16A34A"
              />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="10" cy="10" r="10" fill="#EF4444" opacity="0.12" />
              <path
                d="M10 5.5C9.58579 5.5 9.25 5.83579 9.25 6.25V10.25C9.25 10.6642 9.58579 11 10 11C10.4142 11 10.75 10.6642 10.75 10.25V6.25C10.75 5.83579 10.4142 5.5 10 5.5Z"
                fill="#DC2626"
              />
              <circle cx="10" cy="13.25" r="0.9" fill="#DC2626" />
            </svg>
          )}
        </span>
        <div style={messageStyle}>{toast?.message}</div>
        <button
          type="button"
          onClick={handleClose}
          style={closeButtonStyle}
          aria-label="Dismiss notification"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            aria-hidden="true