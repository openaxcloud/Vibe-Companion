import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { SaveStatus } from '@/components/editor/ReplitStatusBar';

interface UseAutoSaveOptions {
  debounceMs?: number;
  onSave?: (content: string) => Promise<void>;
}

interface UseAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  markUnsaved: () => void;
  triggerSave: (content: string) => void;
  saveNow: (content: string) => Promise<void>;
  reset: () => void;
}

export function useAutoSave(options: UseAutoSaveOptions = {}): UseAutoSaveReturn {
  const { debounceMs = 1500, onSave } = options;
  
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);

  const performSave = useCallback(async (content: string) => {
    if (isSavingRef.current) {
      pendingContentRef.current = content;
      return;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      if (onSave) {
        await onSave(content);
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const savedTime = new Date();
      setLastSavedAt(savedTime);
      setSaveStatus('saved');

      if (pendingContentRef.current !== null && pendingContentRef.current !== content) {
        const nextContent = pendingContentRef.current;
        pendingContentRef.current = null;
        isSavingRef.current = false;
        await performSave(nextContent);
        return;
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('unsaved');
    } finally {
      isSavingRef.current = false;
      pendingContentRef.current = null;
    }
  }, [onSave]);

  const debouncedSave = useDebouncedCallback(
    (content: string) => {
      performSave(content);
    },
    debounceMs
  );

  const markUnsaved = useCallback(() => {
    if (saveStatus !== 'saving') {
      setSaveStatus('unsaved');
    }
  }, [saveStatus]);

  const triggerSave = useCallback((content: string) => {
    markUnsaved();
    debouncedSave(content);
  }, [markUnsaved, debouncedSave]);

  const saveNow = useCallback(async (content: string) => {
    debouncedSave.cancel();
    await performSave(content);
  }, [debouncedSave, performSave]);

  const reset = useCallback(() => {
    debouncedSave.cancel();
    setSaveStatus('saved');
    pendingContentRef.current = null;
    isSavingRef.current = false;
  }, [debouncedSave]);

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return {
    saveStatus,
    lastSavedAt,
    markUnsaved,
    triggerSave,
    saveNow,
    reset
  };
}
