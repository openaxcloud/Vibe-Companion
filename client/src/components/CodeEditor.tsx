import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
}

const replitHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#FF6166" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#F5F9FC" },
  { tag: [t.propertyName], color: "#56B6C2" },
  { tag: [t.function(t.variableName), t.labelName], color: "#56B6C2" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#FF9940" },
  { tag: [t.definition(t.name), t.separator], color: "#CFD7E6" },
  { tag: [t.typeName, t.className, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: "#FFCB6B" },
  { tag: [t.number], color: "#FF9940" },
  { tag: [t.operator, t.operatorKeyword], color: "#FF6166" },
  { tag: [t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#56B6C2" },
  { tag: [t.meta, t.comment], color: "#676D7E", fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#56B6C2", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#FF6166" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#FF9940" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#0CCE6B" },
  { tag: t.invalid, color: "#F44747" },
  { tag: [t.tagName], color: "#FF6166" },
  { tag: [t.attributeName], color: "#FFCB6B" },
]);

const replitTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "#1C2333",
    color: "#CFD7E6",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    lineHeight: "1.65",
  },
  ".cm-gutters": {
    background: "#0E1525",
    borderRight: "1px solid #2B3245",
    color: "#676D7E",
    minWidth: "52px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
    fontSize: "12px",
    padding: "0 12px 0 8px",
    minWidth: "32px",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    background: "#1C2333",
    color: "#9DA2B0",
  },
  ".cm-activeLine": {
    background: "rgba(43, 50, 69, 0.4)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#0079F2",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    background: "rgba(0, 121, 242, 0.25) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "rgba(0, 121, 242, 0.28) !important",
  },
  ".cm-content": {
    caretColor: "#0079F2",
    padding: "4px 0",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    background: "rgba(0, 121, 242, 0.15)",
    outline: "1px solid rgba(0, 121, 242, 0.3)",
  },
  ".cm-foldGutter": {
    width: "14px",
  },
  ".cm-tooltip": {
    background: "#1C2333",
    border: "1px solid #2B3245",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "4px 8px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "rgba(0, 121, 242, 0.15)",
  },
  ".cm-panels": {
    background: "#0E1525",
    color: "#F5F9FC",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid #2B3245",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid #2B3245",
  },
  ".cm-searchMatch": {
    background: "rgba(229, 192, 123, 0.3)",
    outline: "1px solid rgba(229, 192, 123, 0.5)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    background: "rgba(0, 121, 242, 0.3)",
  },
  ".cm-foldPlaceholder": {
    background: "#2B3245",
    border: "none",
    color: "#9DA2B0",
    padding: "0 6px",
    borderRadius: "3px",
  },
}, { dark: true });

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
      replitTheme,
      syntaxHighlighting(replitHighlight),
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
      theme="none"
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
