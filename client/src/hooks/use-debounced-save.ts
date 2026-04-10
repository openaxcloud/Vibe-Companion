import { useRef, useCallback, useEffect } from 'react';

interface DebouncedSaveOptions {
  delay?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useDebouncedSave<T>(
  saveFunction: (data: T) => Promise<void>,
  options: DebouncedSaveOptions = {}
) {
  const { delay = 1000, onError, onSuccess } = options;
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<T | null>(null);
  
  const debouncedSave = useCallback(async (data: T) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Set up new debounced save
    timeoutRef.current = setTimeout(async () => {
      // Check if another save is in progress
      if (isSavingRef.current) {
        pendingSaveRef.current = data;
        return;
      }
      
      isSavingRef.current = true;
      
      try {
        await saveFunction(data);
        onSuccess?.();
      } catch (error) {
        onError?.(error as Error);
      } finally {
        isSavingRef.current = false;
        
        // Process pending save if exists
        if (pendingSaveRef.current !== null) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          debouncedSave(pending);
        }
      }
    }, delay);
  }, [saveFunction, delay, onError, onSuccess]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);
  
  // Cancel function
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);
  
  return {
    debouncedSave,
    cancel,
    isSaving: () => isSavingRef.current,
  };
}