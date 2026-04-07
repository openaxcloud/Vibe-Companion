import { useState, useEffect, ReactNode } from "react";
import { LazyMotionDiv, LazyAnimatePresence } from "@/lib/motion";

export function ShortcutHint() {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);

  const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const newKeys = new Set(pressedKeys);
      
      if (e.metaKey) newKeys.add("Meta");
      if (e.ctrlKey) newKeys.add("Ctrl");
      if (e.shiftKey) newKeys.add("Shift");
      if (e.altKey) newKeys.add("Alt");

      setPressedKeys(newKeys);
      
      // Show hint when modifier keys are pressed
      if (e.metaKey || e.ctrlKey) {
        setShowHint(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const newKeys = new Set(pressedKeys);
      
      if (!e.metaKey) newKeys.delete("Meta");
      if (!e.ctrlKey) newKeys.delete("Ctrl");
      if (!e.shiftKey) newKeys.delete("Shift");
      if (!e.altKey) newKeys.delete("Alt");

      setPressedKeys(newKeys);
      
      // Hide hint when no modifier keys are pressed
      if (newKeys.size === 0) {
        setShowHint(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pressedKeys]);

  const cmdKey = isMac ? "Meta" : "Ctrl";
  const isCommandPressed = pressedKeys.has(cmdKey);
  const isShiftPressed = pressedKeys.has("Shift");

  const getShortcuts = () => {
    if (isCommandPressed && isShiftPressed) {
      return [
        { key: "F", action: "Find in all files" },
        { key: "H", action: "Replace in all files" },
        { key: "P", action: "Show all commands" },
        { key: "L", action: "Toggle theme" },
        { key: "G", action: "Open Git" },
        { key: "C", action: "Open console" },
      ];
    } else if (isCommandPressed) {
      return [
        { key: "K", action: "Command palette" },
        { key: "P", action: "Quick file search" },
        { key: "S", action: "Save all" },
        { key: "W", action: "Close tab" },
        { key: "B", action: "Toggle file explorer" },
        { key: "/", action: "Show shortcuts" },
        { key: "↵", action: "Run/Stop project" },
      ];
    }
    return [];
  };

  const shortcuts = getShortcuts();

  return (
    <LazyAnimatePresence>
      {showHint && shortcuts.length > 0 && (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-background/95 backdrop-blur-lg border border-border rounded-lg shadow-2xl p-4 max-w-md">
            <div className="text-[11px] text-muted-foreground mb-2">
              Available shortcuts:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <kbd className="px-2 py-1 text-[11px] bg-muted border border-border rounded min-w-[24px] text-center">
                    {shortcut.key}
                  </kbd>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {shortcut.action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </LazyMotionDiv>
      )}
    </LazyAnimatePresence>
  );
}
