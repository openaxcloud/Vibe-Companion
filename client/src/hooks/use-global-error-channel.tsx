import { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useToast } from './use-toast';

type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

interface GlobalError {
  id: string;
  message: string;
  description?: string;
  severity: ErrorSeverity;
  code?: string;
  retryAction?: () => void;
  dismissable?: boolean;
  timestamp: number;
}

interface GlobalErrorChannelContextValue {
  reportError: (error: Omit<GlobalError, 'id' | 'timestamp'>) => string;
  reportNetworkError: (message?: string, retryAction?: () => void) => string;
  reportAuthError: (message?: string) => string;
  reportValidationError: (message: string, field?: string) => string;
  clearError: (id: string) => void;
  clearAllErrors: () => void;
}

const GlobalErrorChannelContext = createContext<GlobalErrorChannelContextValue | null>(null);

const ERROR_DEDUP_WINDOW_MS = 3000;

export function GlobalErrorChannelProvider({ children }: { children: ReactNode }) {
  const { toast, dismiss } = useToast();
  const recentErrorsRef = useRef<Map<string, number>>(new Map());
  const idToToastRef = useRef<Map<string, string>>(new Map());
  const dedupToIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      recentErrorsRef.current.forEach((timestamp, key) => {
        if (now - timestamp > ERROR_DEDUP_WINDOW_MS) {
          recentErrorsRef.current.delete(key);
        }
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  const generateId = useCallback(() => {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const getDedupKey = useCallback((error: Omit<GlobalError, 'id' | 'timestamp'>) => {
    return `${error.severity}-${error.code || ''}-${error.message}`;
  }, []);

  const reportError = useCallback((error: Omit<GlobalError, 'id' | 'timestamp'>): string => {
    const dedupKey = getDedupKey(error);
    const now = Date.now();
    
    const lastShown = recentErrorsRef.current.get(dedupKey);
    if (lastShown && now - lastShown < ERROR_DEDUP_WINDOW_MS) {
      return dedupToIdRef.current.get(dedupKey) || '';
    }

    const id = generateId();
    recentErrorsRef.current.set(dedupKey, now);
    dedupToIdRef.current.set(dedupKey, id);

    const variant = error.severity === 'critical' || error.severity === 'error' 
      ? 'destructive' 
      : 'default';

    const { id: toastId } = toast({
      title: error.message,
      description: error.description,
      variant,
      duration: error.severity === 'critical' ? undefined : 5000,
    });

    idToToastRef.current.set(id, toastId);

    return id;
  }, [toast, generateId, getDedupKey]);

  const reportNetworkError = useCallback((
    message = 'Network error occurred', 
    retryAction?: () => void
  ): string => {
    return reportError({
      message,
      description: retryAction 
        ? 'Check your connection and try again.' 
        : 'Please check your internet connection.',
      severity: 'error',
      code: 'NETWORK_ERROR',
      retryAction,
      dismissable: true,
    });
  }, [reportError]);

  const reportAuthError = useCallback((message = 'Authentication required'): string => {
    return reportError({
      message,
      description: 'Please sign in to continue.',
      severity: 'warning',
      code: 'AUTH_ERROR',
      dismissable: true,
    });
  }, [reportError]);

  const reportValidationError = useCallback((message: string, field?: string): string => {
    return reportError({
      message,
      description: field ? `Please check the ${field} field.` : undefined,
      severity: 'warning',
      code: 'VALIDATION_ERROR',
      dismissable: true,
    });
  }, [reportError]);

  const clearError = useCallback((id: string) => {
    const toastId = idToToastRef.current.get(id);
    if (toastId) {
      dismiss(toastId);
      idToToastRef.current.delete(id);
    }
  }, [dismiss]);

  const clearAllErrors = useCallback(() => {
    idToToastRef.current.forEach((toastId) => {
      dismiss(toastId);
    });
    idToToastRef.current.clear();
    dedupToIdRef.current.clear();
    recentErrorsRef.current.clear();
  }, [dismiss]);

  const value: GlobalErrorChannelContextValue = {
    reportError,
    reportNetworkError,
    reportAuthError,
    reportValidationError,
    clearError,
    clearAllErrors,
  };

  return (
    <GlobalErrorChannelContext.Provider value={value}>
      {children}
    </GlobalErrorChannelContext.Provider>
  );
}

export function useGlobalErrorChannel() {
  const context = useContext(GlobalErrorChannelContext);
  
  if (!context) {
    return {
      reportError: () => '',
      reportNetworkError: () => '',
      reportAuthError: () => '',
      reportValidationError: () => '',
      clearError: () => {},
      clearAllErrors: () => {},
    };
  }
  
  return context;
}

export function useQueryErrorHandler() {
  const { reportError, reportNetworkError, reportAuthError } = useGlobalErrorChannel();

  return useCallback((error: unknown) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('fetch')) {
        reportNetworkError();
        return;
      }
      
      if (message.includes('401') || message.includes('unauthorized')) {
        reportAuthError();
        return;
      }
      
      reportError({
        message: 'Something went wrong',
        description: error.message,
        severity: 'error',
      });
    } else {
      reportError({
        message: 'An unexpected error occurred',
        severity: 'error',
      });
    }
  }, [reportError, reportNetworkError, reportAuthError]);
}
