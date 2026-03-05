import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
}

const customTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "#1C2333",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-gutters": {
    background: "#0E1525",
    borderRight: "1px solid #2B3245",
    color: "#676D7E",
  },
  ".cm-activeLineGutter": {
    background: "#1C2333",
    color: "#9DA2B0",
  },
  ".cm-activeLine": {
    background: "rgba(43, 50, 69, 0.4)",
  },
  ".cm-cursor": {
    borderLeftColor: "#0079F2",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    background: "rgba(0, 121, 242, 0.2) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "rgba(0, 121, 242, 0.28) !important",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    lineHeight: "1.65",
  },
  ".cm-matchingBracket": {
    background: "rgba(0, 121, 242, 0.15)",
    outline: "1px solid rgba(0, 121, 242, 0.3)",
  },
});

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "javascript":
      return javascript({ jsx: true });
    case "typescript":
      return javascript({ jsx: true, typescript: true });
    case "python":
      return python();
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
      return markdown();
    default:
      return javascript();
  }
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    default:
      return "javascript";
  }
}

export { detectLanguage };

export default function CodeEditor({ value, onChange, language, readOnly = false }: CodeEditorProps) {
  const extensions = useMemo(() => {
    const ext = [
      getLanguageExtension(language),
      customTheme,
      indentUnit.of("  "),
      EditorView.lineWrapping,
    ];
    if (readOnly) {
      ext.push(EditorView.editable.of(false));
    }
    return ext;
  }, [language, readOnly]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={oneDark}
      basicSetup={{
        lineNumbers: true,
        bracketMatching: true,
        highlightActiveLine: true,
        searchKeymap: true,
        foldGutter: true,
        tabSize: 2,
      }}
      style={{ height: "100%", width: "100%" }}
      data-testid="code-editor"
    />
  );
}
