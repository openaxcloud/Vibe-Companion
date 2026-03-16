import { useState, useEffect, useCallback, useRef } from "react";

interface KeyboardLayoutMap {
  size: number;
}

interface NavigatorKeyboard {
  getLayoutMap(): Promise<KeyboardLayoutMap>;
}

function getNavigatorKeyboard(): NavigatorKeyboard | null {
  if ("keyboard" in navigator) {
    const kbd = (navigator as Navigator & { keyboard?: NavigatorKeyboard }).keyboard;
    if (kbd && typeof kbd.getLayoutMap === "function") {
      return kbd;
    }
  }
  return null;
}

export function useExternalKeyboardDetection() {
  const [hasExternalKeyboard, setHasExternalKeyboard] = useState(false);
  const keydownTimestamps = useRef<number[]>([]);
  const detectedRef = useRef(false);

  const isTabletDevice = useCallback(() => {
    const ua = navigator.userAgent;
    const isIPad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroidTablet = /Android/.test(ua) && !/Mobile/.test(ua);
    const hasTouchScreen = navigator.maxTouchPoints > 0;
    const isTabletWidth = window.innerWidth >= 640 && window.innerWidth < 1366;
    return (isIPad || isAndroidTablet || (hasTouchScreen && isTabletWidth));
  }, []);

  useEffect(() => {
    if (!isTabletDevice()) return;

    const detectViaNavigatorKeyboard = async () => {
      try {
        const kbd = getNavigatorKeyboard();
        if (kbd) {
          const layoutMap = await kbd.getLayoutMap();
          if (layoutMap && layoutMap.size > 0 && !detectedRef.current) {
            detectedRef.current = true;
            setHasExternalKeyboard(true);
          }
        }
      } catch {}
    };

    detectViaNavigatorKeyboard();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (detectedRef.current) return;
      if (e.key === "Process" || e.key === "Unidentified") return;

      const now = Date.now();
      keydownTimestamps.current.push(now);
      keydownTimestamps.current = keydownTimestamps.current.filter(t => now - t < 5000);

      if (keydownTimestamps.current.length >= 2) {
        detectedRef.current = true;
        setHasExternalKeyboard(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTabletDevice]);

  return { hasExternalKeyboard, isTabletDevice };
}
