import { useMemo, useCallback } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { useRef, useEffect } from "react";
import { StateField, StateEffect, RangeSetBuilder, RangeSet } from "@codemirror/state";

export interface BlameEntry {
  line: number;
  commitId: string | null;
  message: string;
  author: string;
  date: string;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
  onCursorChange?: (line: number, col: number) => void;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
  blameData?: BlameEntry[];
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
  ".cm-blame-gutter": {
    width: "220px",
    background: "#0E1525",
    borderRight: "1px solid #2B3245",
  },
  ".cm-blame-gutter .cm-gutterElement": {
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
    fontSize: "11px",
    padding: "0 8px",
    display: "flex",
    alignItems: "center",
    cursor: "default",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}, { dark: true });

const BLAME_COLORS = [
  "#7C65CB",
  "#0079F2",
  "#0CCE6B",
  "#F26522",
  "#F5A623",
  "#FF6166",
  "#56B6C2",
  "#FFCB6B",
  "#9DA2B0",
  "#FF9940",
];

function getCommitColor(commitId: string | null, commitIds: string[]): string {
  if (!commitId) return "#676D7E";
  const idx = commitIds.indexOf(commitId);
  if (idx === -1) return "#676D7E";
  return BLAME_COLORS[idx % BLAME_COLORS.length];
}

function formatBlameDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

class BlameMarker extends GutterMarker {
  constructor(
    public entry: BlameEntry,
    public color: string,
    public showHeader: boolean
  ) {
    super();
  }

  toDOM() {
    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.gap = "6px";
    el.style.width = "100%";
    el.style.overflow = "hidden";

    if (this.showHeader) {
      const bar = document.createElement("span");
      bar.style.width = "2px";
      bar.style.height = "14px";
      bar.style.borderRadius = "1px";
      bar.style.backgroundColor = this.color;
      bar.style.flexShrink = "0";
      el.appendChild(bar);

      const msg = document.createElement("span");
      msg.style.color = this.color;
      msg.style.flex = "1";
      msg.style.overflow = "hidden";
      msg.style.textOverflow = "ellipsis";
      msg.style.whiteSpace = "nowrap";
      msg.style.fontSize = "11px";
      msg.textContent = this.entry.message.length > 20 ? this.entry.message.slice(0, 20) + "…" : this.entry.message;
      el.appendChild(msg);

      const date = document.createElement("span");
      date.style.color = "#676D7E";
      date.style.fontSize = "10px";
      date.style.flexShrink = "0";
      date.textContent = formatBlameDate(this.entry.date);
      el.appendChild(date);
    } else {
      const bar = document.createElement("span");
      bar.style.width = "2px";
      bar.style.height = "14px";
      bar.style.borderRadius = "1px";
      bar.style.backgroundColor = this.color;
      bar.style.opacity = "0.3";
      bar.style.flexShrink = "0";
      el.appendChild(bar);
    }

    el.title = `${this.entry.message}\n${this.entry.author} • ${new Date(this.entry.date).toLocaleString()}${this.entry.commitId ? "\n" + this.entry.commitId.slice(0, 8) : ""}`;

    return el;
  }
}

const setBlameEffect = StateEffect.define<BlameEntry[]>();

const blameField = StateField.define<BlameEntry[]>({
  create() { return []; },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setBlameEffect)) return e.value;
    }
    return value;
  },
});

const blameGutter = gutter({
  class: "cm-blame-gutter",
  markers(view) {
    const blameData = view.state.field(blameField);
    if (blameData.length === 0) return RangeSet.empty;

    const uniqueCommits = [...new Set(blameData.map(b => b.commitId).filter(Boolean) as string[])];

    const builder = new RangeSetBuilder<GutterMarker>();
    const doc = view.state.doc;

    for (let i = 1; i <= doc.lines && i <= blameData.length; i++) {
      const line = doc.line(i);
      const entry = blameData[i - 1];
      const color = getCommitColor(entry.commitId, uniqueCommits);
      const showHeader = i === 1 || blameData[i - 2].commitId !== entry.commitId;
      builder.add(line.from, line.from, new BlameMarker(entry, color, showHeader));
    }
    return builder.finish();
  },
  lineMarker: undefined,
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

export default function CodeEditor({ value, onChange, language, readOnly = false, onCursorChange, fontSize = 14, tabSize = 2, wordWrap = false, blameData }: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  const cursorTracker = useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        onCursorChangeRef.current?.(line.number, pos - line.from + 1);
      }
    });
  }, []);

  const showBlame = blameData && blameData.length > 0;

  const extensions = useMemo(() => {
    const ext = [
      getLanguageExtension(language),
      replitTheme,
      syntaxHighlighting(replitHighlight),
      indentUnit.of(" ".repeat(tabSize)),
      cursorTracker,
      blameField,
    ];
    if (showBlame) ext.push(blameGutter);
    if (wordWrap) ext.push(EditorView.lineWrapping);
    if (readOnly) ext.push(EditorView.editable.of(false));
    return ext;
  }, [language, readOnly, cursorTracker, tabSize, wordWrap, showBlame]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view && blameData) {
      view.dispatch({ effects: setBlameEffect.of(blameData) });
    }
  }, [blameData]);

  return (
    <CodeMirror
      ref={editorRef}
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
        tabSize,
      }}
      style={{ height: "100%", width: "100%", fontSize: `${fontSize}px` }}
      data-testid="code-editor"
    />
  );
}
