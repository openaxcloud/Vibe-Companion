import { useEffect, useRef, useState } from "react";

type PresenceStatus = "online" | "away" | "offline" | "unknown";

export interface PresenceOptions {
  inactivityTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  initialStatus?: PresenceStatus;
  /**
   * Optional callback fired whenever presence status changes
   */
  onStatusChange?: (status: PresenceStatus) => void;
}

export interface PresenceState {
  status: PresenceStatus;
  lastActiveAt: Date | null;
  isTabVisible: boolean;
  isWindowFocused: boolean;
  isConnected: boolean;
}

export interface UsePresence {
  status: PresenceStatus;
  isOnline: boolean;
  isAway: boolean;
  isOffline: boolean;
  isUnknown: boolean;
  lastActiveAt: Date | null;
  isTabVisible: boolean;
  isWindowFocused: boolean;
  isConnected: boolean;
  markActive: () => void;
  setStatusManually: (status: PresenceStatus) => void;
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 60_000; // 1 minute
const DEFAULT_HEARTBEAT_INTERVAL_MS = 25_000; // 25 seconds

let globalActivityListenersAttached = false;
const globalPresenceSubscribers = new Set<() => void>();

let lastGlobalActivityAt = Date.now();

function attachGlobalActivityListeners() {
  if (globalActivityListenersAttached || typeof window === "undefined") return;

  const markActivity = () => {
    lastGlobalActivityAt = Date.now();
    globalPresenceSubscribers.forEach((cb) => cb());
  };

  const events: (keyof WindowEventMap)[] = [
    "mousemove",
    "mousedown",
    "mouseup",
    "keydown",
    "keyup",
    "touchstart",
    "touchmove",
    "scroll",
    "focus",
  ];

  events.forEach((event) => {
    window.addEventListener(event, markActivity, { passive: true });
  });

  document.addEventListener("visibilitychange", markActivity);

  globalActivityListenersAttached = true;
}

function subscribeToGlobalActivity(cb: () => void): () => void {
  globalPresenceSubscribers.add(cb);
  attachGlobalActivityListeners();
  return () => {
    globalPresenceSubscribers.delete(cb);
  };
}

function getInitialConnectionStatus(): boolean {
  if (typeof navigator === "undefined") return true;
  // navigator.onLine is not fully reliable but good enough as a hint
  return navigator.onLine !== false;
}

function getInitialVisibilityStatus(): { isTabVisible: boolean; isWindowFocused: boolean } {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      isTabVisible: true,
      isWindowFocused: true,
    };
  }

  const isTabVisible = document.visibilityState === "visible";
  const isWindowFocused = document.hasFocus();

  return { isTabVisible, isWindowFocused };
}

export function usePresence(options: PresenceOptions = {}): UsePresence {
  const {
    inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    initialStatus = "unknown",
    onStatusChange,
  } = options;

  const [state, setState] = useState<PresenceState>(() => {
    const { isTabVisible, isWindowFocused } = getInitialVisibilityStatus();
    return {
      status: initialStatus,
      lastActiveAt: null,
      isTabVisible,
      isWindowFocused,
      isConnected: getInitialConnectionStatus(),
    };
  });

  const statusRef = useRef<PresenceStatus>(state.status);
  const lastActiveAtRef = useRef<number | null>(state.lastActiveAt ? state.lastActiveAt.getTime() : null);
  const inactivityTimeoutRef = useRef<number>(inactivityTimeoutMs);
  const heartbeatIntervalRef = useRef<number>(heartbeatIntervalMs);

  useEffect(() => {
    inactivityTimeoutRef.current = inactivityTimeoutMs;
  }, [inactivityTimeoutMs]);

  useEffect(() => {
    heartbeatIntervalRef.current = heartbeatIntervalMs;
  }, [heartbeatIntervalMs]);

  const updateStatus = (nextStatus: PresenceStatus) => {
    if (statusRef.current === nextStatus) return;
    statusRef.current = nextStatus;
    setState((prev) => {
      const updated: PresenceState = {
        ...prev,
        status: nextStatus,
      };
      return updated;
    });
    if (onStatusChange) {
      onStatusChange(nextStatus);
    }
  };

  const markActive = () => {
    const now = Date.now();
    lastActiveAtRef.current = now;
    lastGlobalActivityAt = now;

    setState((prev) => ({
      ...prev,
      lastActiveAt: new Date(now),
    }));

    if (state.isConnected && state.isTabVisible && state.isWindowFocused) {
      updateStatus("online");
    }
  };

  const setStatusManually = (status: PresenceStatus) => {
    updateStatus(status);
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const { isTabVisible, isWindowFocused } = getInitialVisibilityStatus();
    setState((prev) => ({
      ...prev,
      isTabVisible,
      isWindowFocused,
      isConnected: getInitialConnectionStatus(),
    }));

    if (!lastActiveAtRef.current) {
      const now = Date.now();
      lastActiveAtRef.current = now;
      setState((prev) => ({
        ...prev,
        lastActiveAt: new Date(now),
      }));
    }

    // Visibility change
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      const now = Date.now();

      setState((prev) => ({
        ...prev,
        isTabVisible: visible,
        lastActiveAt: visible ? new Date(now) : prev.lastActiveAt,
      }));

      if (visible) {
        lastActiveAtRef.current = now;
        if (state.isConnected && state.isWindowFocused) {
          updateStatus("online");
        }
      } else if (!visible) {
        updateStatus("away");
      }
    };

    // Focus / blur
    const handleFocus = () => {
      const now = Date.now();
      lastActiveAtRef.current = now;
      setState((prev) => ({
        ...prev,
        isWindowFocused: true,
        lastActiveAt: new Date(now),
      }));
      if (state.isConnected && state.isTabVisible) {
        updateStatus("online");
      }
    };

    const handleBlur = () => {
      setState((prev) => ({
        ...prev,
        isWindowFocused: false,
      }));
      if (!state.isConnected || !state.isTabVisible) {
        updateStatus("away");
      }
    };

    // Connection changes
    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isConnected: true,
      }));
      if (state.isTabVisible && state.isWindowFocused) {
        updateStatus("online");
      }
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
      updateStatus("offline");
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const unsubscribeGlobal = subscribeToGlobalActivity(() => {
      const now = Date.now();
      lastActiveAtRef.current = now;
      setState((prev) => ({
        ...prev,
        lastActiveAt: new Date(now),
      }));
      if (state.isConnected && state.isTabVisible && state.isWindowFocused) {
        updateStatus("online");
      }
    });

    const inactivityIntervalId = window.setInterval(() => {
      const lastActive = lastActiveAtRef.current ?? lastGlobalActivityAt;
      const now = Date.now();
      const diff = now - lastActive;

      if (diff >= inactivityTimeoutRef.current) {
        if (statusRef.current === "online") {
          updateStatus("away");
        }
      } else {
        if (statusRef.current === "away" && state.isConnected && state.isTabVisible && state.isWindowFocused) {
          updateStatus("online");
        }
      }
    }, 1_000);

    const heartbeatIntervalId = window.setInterval(() => {
      if (!state.isConnected || statusRef.current === "offline") {
        return;
      }
      // Heartbeat side-effect can be added here (e.g., ping API or WebSocket)
      // For now, just ensure lastActive doesn't get stale for clients relying solely on heartbeats
      if (!lastActiveAtRef.current) {
        const now = Date.now();
        lastActiveAtRef.current = now;
        setState((prev) => ({
          ...prev,
          lastActiveAt: new Date(now),
        }));
      }
    }, heartbeatIntervalRef.current);

    return () => {
      window.clearInterval(inactivityIntervalId);
      window.clearInterval(heartbeatIntervalId);
      unsubscribeGlobal();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("online", handleOnline);