import { useState, useCallback } from "react";
import { Code2, Braces } from "lucide-react";

type EditorEngine = "codemirror" | "monaco";

interface EditorEngineToggleProps {
  onChange?: (engine: EditorEngine) => void;
}

export default function EditorEngineToggle({ onChange }: EditorEngineToggleProps) {
  const [engine, setEngine] = useState<EditorEngine>(() => {
    try {
      return (localStorage.getItem("editor-engine") as EditorEngine) || "monaco";
    } catch {
      return "monaco";
    }
  });

  const toggle = useCallback(() => {
    const next: EditorEngine = engine === "monaco" ? "codemirror" : "monaco";
    setEngine(next);
    try {
      localStorage.setItem("editor-engine", next);
    } catch {}
    onChange?.(next);
  }, [engine, onChange]);

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors bg-[var(--ide-bg-secondary)] hover:bg-[var(--ide-bg-tertiary)] text-[var(--ide-text-secondary)] border border-[var(--ide-border)]"
      title={`Switch to ${engine === "monaco" ? "CodeMirror" : "Monaco"} editor`}
      data-testid="editor-engine-toggle"
    >
      {engine === "monaco" ? (
        <>
          <Code2 size={12} className="text-blue-400" />
          <span>Monaco</span>
        </>
      ) : (
        <>
          <Braces size={12} className="text-green-400" />
          <span>CodeMirror</span>
        </>
      )}
    </button>
  );
}
