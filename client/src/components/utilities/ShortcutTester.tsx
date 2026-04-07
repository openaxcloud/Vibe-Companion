import { useState, useEffect } from "react";
import { LazyMotionDiv } from "@/lib/motion";
import { Zap, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ShortcutTester() {
  const [lastShortcut, setLastShortcut] = useState<string>("");
  const [showTester, setShowTester] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const modifiers: string[] = [];
      
      if (e.metaKey) modifiers.push("⌘");
      if (e.ctrlKey) modifiers.push("Ctrl");
      if (e.shiftKey) modifiers.push("⇧");
      if (e.altKey) modifiers.push("⌥");

      if (modifiers.length > 0) {
        const key = e.key === " " ? "Space" : e.key;
        const shortcut = [...modifiers, key].join("+");
        setLastShortcut(shortcut);
        setShowTester(true);

        // Clear the timeout if it exists
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Hide after 1.5 seconds
        timeoutId = setTimeout(() => {
          setShowTester(false);
        }, 1500);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!showTester || !lastShortcut) return null;

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none"
    >
      <div className="bg-background/95 backdrop-blur-lg border border-border rounded-full shadow-2xl px-6 py-3 flex items-center gap-3">
        <Zap className="w-4 h-4 text-yellow-500" />
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">Shortcut:</span>
          <Badge variant="outline" className="font-mono">
            {lastShortcut}
          </Badge>
        </div>
        <Check className="w-4 h-4 text-green-500" />
      </div>
    </LazyMotionDiv>
  );
}
