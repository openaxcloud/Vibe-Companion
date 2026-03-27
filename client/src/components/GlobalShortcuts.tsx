import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import ShortcutsCLUI from "./ShortcutsCLUI";

export default function GlobalShortcuts() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [location] = useLocation();

  const isWorkspace = location.startsWith("/project/");

  useEffect(() => {
    if (isWorkspace) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      }
      if (e.key === "Escape" && shortcutsOpen) {
        setShortcutsOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isWorkspace, shortcutsOpen]);

  if (isWorkspace) return null;

  return (
    <ShortcutsCLUI
      open={shortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
    />
  );
}
