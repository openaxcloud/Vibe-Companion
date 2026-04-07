import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTypingOptions {
  /**
   * Time in ms after user starts typing before emitting "started typing" event.
   * Helps avoid spamming on every key stroke.
   */
  emitDebounceMs?: number;
  /**
   * Time in ms of inactivity after which we emit "stopped typing".
   */
  stopDelayMs?: number;
  /**
   * Time in ms to continue showing the incoming "user is typing" indicator
   * after the last received typing event.
   */
  displayDurationMs?: number;
}

export interface UseTypingParams {
  /**
   * Callback invoked when local user typing status changes.
   * Typically emits to server or context: onTypingChange(isTyping: boolean)
   */
  onTypingChange?: (isTyping: boolean) => void;
  /**
   * External "remote is typing" flag updates, e.g. from WebSocket messages.
   * You call `setRemoteTyping(true)` when others are typing, `false` when not.
   */
  remoteTyping?: boolean;
  /**
   * Optional configuration overrides.
   */
  options?: UseTypingOptions;
}

export interface UseTypingReturn {
  /**
   * Call this on each local input change / key press.
   */
  handleTyping: () => void;
  /**
   * Whether the local user is currently considered "typing".
   */
  isTyping: boolean;
  /**
   * Whether remote user(s) are currently considered "typing".
   * Debounced with a display timeout for smoother UX.
   */
  isRemoteTyping: boolean;
}

const DEFAULT_EMIT_DEBOUNCE_MS = 300;
const DEFAULT_STOP_DELAY_MS = 2000;
const DEFAULT_DISPLAY_DURATION_MS = 3000;

export function useTyping({
  onTypingChange,
  remoteTyping,
  options,
}: UseTypingParams = {}): UseTypingReturn {
  const {
    emitDebounceMs = DEFAULT_EMIT_DEBOUNCE_MS,
    stopDelayMs = DEFAULT_STOP_DELAY_MS,
    displayDurationMs = DEFAULT_DISPLAY_DURATION_MS,
  } = options || {};

  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isRemoteTyping, setIsRemoteTyping] = useState<boolean>(false);

  const lastInputTimeRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingEmittedRef = useRef<boolean>(false);

  const clearStopTimeout = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  };

  const clearEmitTimeout = () => {
    if (emitTimeoutRef.current) {
      clearTimeout(emitTimeoutRef.current);
      emitTimeoutRef.current = null;
    }
  };

  const clearDisplayTimeout = () => {
    if (displayTimeoutRef.current) {
      clearTimeout(displayTimeoutRef.current);
      displayTimeoutRef.current = null;
    }
  };

  const emitTypingChange = useCallback(
    (typing: boolean) => {
      if (isTypingEmittedRef.current === typing) return;
      isTypingEmittedRef.current = typing;
      onTypingChange?.(typing);
    },
    [onTypingChange]
  );

  const scheduleStopTyping = useCallback(() => {
    clearStopTimeout();
    stopTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      if (lastInputTimeRef.current && now - lastInputTimeRef.current >= stopDelayMs) {
        setIsTyping(false);
        emitTypingChange(false);
      }
    }, stopDelayMs);
  }, [emitTypingChange, stopDelayMs]);

  const handleTyping = useCallback(() => {
    const now = Date.now();
    lastInputTimeRef.current = now;

    if (!isTyping) {
      setIsTyping(true);
    }

    if (!isTypingEmittedRef.current) {
      clearEmitTimeout();
      emitTimeoutRef.current = setTimeout(() => {
        emitTypingChange(true);
      }, emitDebounceMs);
    }

    scheduleStopTyping();
  }, [emitDebounceMs, emitTypingChange, isTyping, scheduleStopTyping]);

  // Manage remote typing indicator with display timeout
  useEffect(() => {
    if (remoteTyping) {
      setIsRemoteTyping(true);
      clearDisplayTimeout();
      displayTimeoutRef.current = setTimeout(() => {
        setIsRemoteTyping(false);
      }, displayDurationMs);
    } else {
      // If explicitly false, immediately hide
      clearDisplayTimeout();
      setIsRemoteTyping(false);
    }
  }, [remoteTyping, displayDurationMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearStopTimeout();
      clearEmitTimeout();
      clearDisplayTimeout();
      if (isTypingEmittedRef.current) {
        onTypingChange?.(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    handleTyping,
    isTyping,
    isRemoteTyping,
  };
}