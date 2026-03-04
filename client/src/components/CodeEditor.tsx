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
    background: "#0d1117",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-gutters": {
    background: "#0d1117",
    borderRight: "1px solid #30363d",
    color: "#484f58",
  },
  ".cm-activeLineGutter": {
    background: "#161b22",
  },
  ".cm-activeLine": {
    background: "#161b2280",
  },
  ".cm-cursor": {
    borderLeftColor: "#58a6ff",
  },
  ".cm-selectionBackground": {
    background: "#58a6ff33 !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "#58a6ff33 !important",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', monospace",
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
