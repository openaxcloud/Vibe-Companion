import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => removeToast(toasts[0].id), 5000); // Auto-dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[100] space-y-3">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const bgColorClass = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  }[toast.type];

  const Icon = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  }[toast.type];

  return (
    <div
      className={`${bgColorClass} text-white px-5 py-3 rounded-lg shadow-xl flex items-center justify-between gap-4 w-full max-w-sm transform translate-x-0 opacity-100 transition-all duration-300 ease-out animate-slide-in-right`}
      style={{
        // Define custom keyframe for slide-in-right
        animation: 'slideInRight 0.3s ease-out forwards',
        '--tw-animate-slide-in-right': 'translateX(100%)',
      } as React.CSSProperties} // Type assertion for custom property
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span className="font-medium text-sm">{toast.message}</span>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-white/80 hover:text-white transition-colors">
        <X size={18} />
      </button>
      {/* Add a progress bar or dismiss timer visual here if desired */}
    </div>
  );
};

// Custom hook to use the toast functionality
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// A utility object to directly call toast methods outside React components
// This allows imperative calls like `toast.success("Message")`
const createImperativeToast = () => {
  let savedShowToast: ((type: ToastType, message: string) => void) | undefined;

  const setRef = (showToastFn: (type: ToastType, message: string) => void) => {
    savedShowToast = showToastFn;
  };

  const show = (type: ToastType, message: string) => {
    if (savedShowToast) {
      savedShowToast(type, message);
    } else {
      console.warn("Toast called before provider is mounted.", { type, message });
    }
  };

  return {
    setRef,
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
    info: (message: string) => show('info', message),
    warning: (message: string) => show('warning', message),
  };
};

export const toast = createImperativeToast();

export const Toaster: React.FC = () => {
  const { showToast } = useToast();
  useEffect(() => {
    toast.setRef(showToast);
  }, [showToast]);
  return null;
};
