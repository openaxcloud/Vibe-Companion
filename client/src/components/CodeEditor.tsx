import { useMemo, useCallback } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { go } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { EditorView, gutter, GutterMarker, keymap, Decoration, WidgetType, type DecorationSet, hoverTooltip, showTooltip, type Tooltip } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { useRef, useEffect } from "react";
import { StateField, StateEffect, RangeSetBuilder, RangeSet, type Range, type Extension } from "@codemirror/state";
import { autocompletion, type CompletionContext, type Completion } from "@codemirror/autocomplete";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { Prec } from "@codemirror/state";
import { inlineAICompletion } from "./AICompletions";
import { useTheme, type ThemeData } from "./ThemeProvider";
import type { SyntaxColors, GlobalColors } from "@shared/schema";
import type { AwarenessState } from "@/hooks/use-collaboration";
import { LSPClient } from "@/lib/lspClient";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";

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
  aiCompletions?: boolean;
  autoCloseBrackets?: boolean;
  indentationChar?: "spaces" | "tabs";
  minimap?: boolean;
  indentOnInput?: boolean;
  multiselectModifier?: "Alt" | "Ctrl" | "Meta";
  semanticTokens?: boolean;
  formatPastedText?: boolean;
  acceptSuggestionOnCommit?: boolean;
  editorRef?: React.MutableRefObject<ReactCodeMirrorRef | null>;
  ytext?: Y.Text | null;
  remoteAwareness?: Map<string, AwarenessState>;
  lspClient?: LSPClient | null;
  filename?: string;
  projectId?: string;
  onGoToDefinition?: (uri: string, line: number, character: number) => void;
  onFindReferences?: (uri: string, line: number, character: number) => void;
  onRenameSymbol?: (uri: string, line: number, character: number) => void;
}

function buildHighlightStyle(sc: SyntaxColors): HighlightStyle {
  return HighlightStyle.define([
    { tag: t.keyword, color: sc.keywords },
    { tag: [t.name, t.deleted, t.character, t.macroName], color: sc.variableNames },
    { tag: t.propertyName, color: sc.propertyNames },
    { tag: t.definition(t.propertyName), color: sc.propertyDefinitions },
    { tag: [t.function(t.variableName), t.labelName], color: sc.functionReferences },
    { tag: t.definition(t.function(t.variableName)), color: sc.functionDefinitions },
    { tag: t.function(t.propertyName), color: sc.functionProperties },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: sc.numbers },
    { tag: [t.definition(t.name), t.separator], color: sc.variableDefinitions },
    { tag: [t.typeName, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: sc.typeNames },
    { tag: t.className, color: sc.classNames },
    { tag: [t.number], color: sc.numbers },
    { tag: [t.operator, t.operatorKeyword], color: sc.operators },
    { tag: [t.bracket, t.paren, t.squareBracket, t.brace, t.angleBracket], color: sc.brackets },
    { tag: [t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: sc.regularExpressions },
    { tag: [t.meta, t.comment], color: sc.comments, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: sc.regularExpressions, textDecoration: "underline" },
    { tag: t.heading, fontWeight: "bold", color: sc.keywords },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: sc.booleans },
    { tag: [t.processingInstruction, t.string, t.inserted], color: sc.strings },
    { tag: t.invalid, color: "#F44747" },
    { tag: [t.tagName], color: sc.tagNames },
    { tag: [t.attributeName], color: sc.attributeNames },
  ]);
}

function buildEditorTheme(gc: GlobalColors, isDark: boolean): ReturnType<typeof EditorView.theme> {
  const bg = gc.background;
  const fg = gc.foreground;
  const outline = gc.outline;
  const primary = gc.primary;
  const negative = gc.negative;

  const panelBg = bg;
  const surfaceBg = blendHex(bg, fg, 0.06);
  const mutedText = blendHex(fg, bg, 0.55);
  const secondaryText = blendHex(fg, bg, 0.35);

  return EditorView.theme({
    "&": {
      height: "100%",
      background: surfaceBg,
      color: blendHex(fg, bg, 0.1),
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "13px",
      lineHeight: "1.65",
    },
    ".cm-gutters": {
      background: panelBg,
      borderRight: `1px solid ${outline}`,
      color: mutedText,
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
      background: surfaceBg,
      color: secondaryText,
    },
    ".cm-activeLine": {
      background: `${outline}40`,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: primary,
      borderLeftWidth: "2px",
    },
    ".cm-selectionBackground": {
      background: `${primary}40 !important`,
    },
    "&.cm-focused .cm-selectionBackground": {
      background: `${primary}47 !important`,
    },
    ".cm-content": {
      caretColor: primary,
      padding: "4px 0",
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      background: `${primary}26`,
      outline: `1px solid ${primary}4D`,
    },
    ".cm-foldGutter": {
      width: "14px",
    },
    ".cm-tooltip": {
      background: surfaceBg,
      border: `1px solid ${outline}`,
      borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "4px 8px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      background: `${primary}26`,
    },
    ".cm-panels": {
      background: panelBg,
      color: fg,
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: `1px solid ${outline}`,
    },
    ".cm-search": {
      padding: "8px 12px",
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      alignItems: "center",
      background: panelBg,
      fontSize: "12px",
    },
    ".cm-search input, .cm-search select": {
      background: surfaceBg,
      border: `1px solid ${outline}`,
      color: fg,
      borderRadius: "6px",
      padding: "4px 8px",
      fontSize: "12px",
      outline: "none",
    },
    ".cm-search input:focus": {
      borderColor: primary,
      boxShadow: `0 0 0 2px ${primary}26`,
    },
    ".cm-search button": {
      background: surfaceBg,
      border: `1px solid ${outline}`,
      color: secondaryText,
      borderRadius: "6px",
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: "11px",
    },
    ".cm-search button:hover": {
      background: outline,
      color: fg,
    },
    ".cm-search label": {
      color: secondaryText,
      fontSize: "11px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    ".cm-searchMatch": {
      background: "rgba(255,200,0,0.2)",
      outline: "1px solid rgba(255,200,0,0.4)",
    },
    ".cm-searchMatch-selected": {
      background: `${primary}4D`,
      outline: `1px solid ${primary}99`,
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: `1px solid ${outline}`,
    },
    ".cm-foldPlaceholder": {
      background: outline,
      border: "none",
      color: secondaryText,
      padding: "0 6px",
      borderRadius: "3px",
    },
    ".cm-diagnostic": {
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "'JetBrains Mono', monospace",
    },
    ".cm-diagnostic-error": {
      borderLeft: `3px solid ${negative}`,
    },
    ".cm-diagnostic-warning": {
      borderLeft: "3px solid #FF9940",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: `wavy underline ${negative}`,
      textUnderlineOffset: "3px",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      textDecoration: "wavy underline #FF9940",
      textUnderlineOffset: "3px",
    },
    ".cm-lint-marker-error": {
      content: "'●'",
      color: negative,
    },
    ".cm-lint-marker-warning": {
      content: "'●'",
      color: "#FF9940",
    },
    ".cm-blame-gutter": {
      width: "220px",
      background: panelBg,
      borderRight: `1px solid ${outline}`,
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
  }, { dark: isDark });
}

function blendHex(base: string, blend: string, amount: number): string {
  const parseHex = (h: string) => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parseHex(base);
  const [r2, g2, b2] = parseHex(blend);
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

export { buildHighlightStyle, buildEditorTheme };

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

const jsGlobals: Completion[] = [
  { label: "console", type: "variable", detail: "Console", boost: 10 },
  { label: "console.log", type: "function", detail: "Log to console", boost: 10 },
  { label: "console.error", type: "function", detail: "Log error" },
  { label: "console.warn", type: "function", detail: "Log warning" },
  { label: "console.info", type: "function", detail: "Log info" },
  { label: "console.table", type: "function", detail: "Display tabular data" },
  { label: "console.time", type: "function", detail: "Start timer" },
  { label: "console.timeEnd", type: "function", detail: "End timer" },
  { label: "console.clear", type: "function", detail: "Clear console" },
  { label: "document", type: "variable", detail: "Document" },
  { label: "document.getElementById", type: "function", detail: "Get element by ID" },
  { label: "document.querySelector", type: "function", detail: "Query selector" },
  { label: "document.querySelectorAll", type: "function", detail: "Query all matching" },
  { label: "document.createElement", type: "function", detail: "Create element" },
  { label: "document.addEventListener", type: "function", detail: "Add event listener" },
  { label: "document.body", type: "property", detail: "Body element" },
  { label: "document.head", type: "property", detail: "Head element" },
  { label: "window", type: "variable", detail: "Window" },
  { label: "window.location", type: "property", detail: "Location object" },
  { label: "window.localStorage", type: "property", detail: "Local storage" },
  { label: "window.sessionStorage", type: "property", detail: "Session storage" },
  { label: "window.setTimeout", type: "function", detail: "Set timeout" },
  { label: "window.setInterval", type: "function", detail: "Set interval" },
  { label: "window.fetch", type: "function", detail: "Fetch API" },
  { label: "setTimeout", type: "function", detail: "Set timeout" },
  { label: "setInterval", type: "function", detail: "Set interval" },
  { label: "clearTimeout", type: "function", detail: "Clear timeout" },
  { label: "clearInterval", type: "function", detail: "Clear interval" },
  { label: "fetch", type: "function", detail: "Fetch API" },
  { label: "Promise", type: "class", detail: "Promise" },
  { label: "Promise.all", type: "function", detail: "Wait for all promises" },
  { label: "Promise.race", type: "function", detail: "Race promises" },
  { label: "Promise.resolve", type: "function", detail: "Resolve promise" },
  { label: "Promise.reject", type: "function", detail: "Reject promise" },
  { label: "JSON.parse", type: "function", detail: "Parse JSON string" },
  { label: "JSON.stringify", type: "function", detail: "Stringify to JSON" },
  { label: "Math.floor", type: "function", detail: "Round down" },
  { label: "Math.ceil", type: "function", detail: "Round up" },
  { label: "Math.round", type: "function", detail: "Round" },
  { label: "Math.random", type: "function", detail: "Random number" },
  { label: "Math.max", type: "function", detail: "Maximum value" },
  { label: "Math.min", type: "function", detail: "Minimum value" },
  { label: "Math.abs", type: "function", detail: "Absolute value" },
  { label: "Math.PI", type: "constant", detail: "3.14159..." },
  { label: "Array.isArray", type: "function", detail: "Check if array" },
  { label: "Array.from", type: "function", detail: "Create array from iterable" },
  { label: "Object.keys", type: "function", detail: "Get object keys" },
  { label: "Object.values", type: "function", detail: "Get object values" },
  { label: "Object.entries", type: "function", detail: "Get object entries" },
  { label: "Object.assign", type: "function", detail: "Assign properties" },
  { label: "Object.freeze", type: "function", detail: "Freeze object" },
  { label: "parseInt", type: "function", detail: "Parse integer" },
  { label: "parseFloat", type: "function", detail: "Parse float" },
  { label: "isNaN", type: "function", detail: "Check if NaN" },
  { label: "isFinite", type: "function", detail: "Check if finite" },
  { label: "encodeURIComponent", type: "function", detail: "Encode URI component" },
  { label: "decodeURIComponent", type: "function", detail: "Decode URI component" },
  { label: "Map", type: "class", detail: "Map collection" },
  { label: "Set", type: "class", detail: "Set collection" },
  { label: "WeakMap", type: "class", detail: "WeakMap collection" },
  { label: "WeakSet", type: "class", detail: "WeakSet collection" },
  { label: "Symbol", type: "class", detail: "Symbol primitive" },
  { label: "RegExp", type: "class", detail: "Regular expression" },
  { label: "Date", type: "class", detail: "Date object" },
  { label: "Error", type: "class", detail: "Error object" },
  { label: "TypeError", type: "class", detail: "Type error" },
  { label: "RangeError", type: "class", detail: "Range error" },
  { label: "addEventListener", type: "function", detail: "Add event listener" },
  { label: "removeEventListener", type: "function", detail: "Remove event listener" },
  { label: "requestAnimationFrame", type: "function", detail: "Request animation frame" },
  { label: "cancelAnimationFrame", type: "function", detail: "Cancel animation frame" },
];

const jsMethodCompletions: Completion[] = [
  { label: "map", type: "method", detail: "Array.map()" },
  { label: "filter", type: "method", detail: "Array.filter()" },
  { label: "reduce", type: "method", detail: "Array.reduce()" },
  { label: "forEach", type: "method", detail: "Array.forEach()" },
  { label: "find", type: "method", detail: "Array.find()" },
  { label: "findIndex", type: "method", detail: "Array.findIndex()" },
  { label: "some", type: "method", detail: "Array.some()" },
  { label: "every", type: "method", detail: "Array.every()" },
  { label: "includes", type: "method", detail: "Array/String.includes()" },
  { label: "indexOf", type: "method", detail: "Array/String.indexOf()" },
  { label: "slice", type: "method", detail: "Array/String.slice()" },
  { label: "splice", type: "method", detail: "Array.splice()" },
  { label: "push", type: "method", detail: "Array.push()" },
  { label: "pop", type: "method", detail: "Array.pop()" },
  { label: "shift", type: "method", detail: "Array.shift()" },
  { label: "unshift", type: "method", detail: "Array.unshift()" },
  { label: "concat", type: "method", detail: "Array.concat()" },
  { label: "join", type: "method", detail: "Array.join()" },
  { label: "sort", type: "method", detail: "Array.sort()" },
  { label: "reverse", type: "method", detail: "Array.reverse()" },
  { label: "flat", type: "method", detail: "Array.flat()" },
  { label: "flatMap", type: "method", detail: "Array.flatMap()" },
  { label: "length", type: "property", detail: "Array/String.length" },
  { label: "toString", type: "method", detail: "Object.toString()" },
  { label: "valueOf", type: "method", detail: "Object.valueOf()" },
  { label: "hasOwnProperty", type: "method", detail: "Object.hasOwnProperty()" },
  { label: "split", type: "method", detail: "String.split()" },
  { label: "trim", type: "method", detail: "String.trim()" },
  { label: "trimStart", type: "method", detail: "String.trimStart()" },
  { label: "trimEnd", type: "method", detail: "String.trimEnd()" },
  { label: "toUpperCase", type: "method", detail: "String.toUpperCase()" },
  { label: "toLowerCase", type: "method", detail: "String.toLowerCase()" },
  { label: "replace", type: "method", detail: "String.replace()" },
  { label: "replaceAll", type: "method", detail: "String.replaceAll()" },
  { label: "match", type: "method", detail: "String.match()" },
  { label: "search", type: "method", detail: "String.search()" },
  { label: "startsWith", type: "method", detail: "String.startsWith()" },
  { label: "endsWith", type: "method", detail: "String.endsWith()" },
  { label: "padStart", type: "method", detail: "String.padStart()" },
  { label: "padEnd", type: "method", detail: "String.padEnd()" },
  { label: "charAt", type: "method", detail: "String.charAt()" },
  { label: "charCodeAt", type: "method", detail: "String.charCodeAt()" },
  { label: "repeat", type: "method", detail: "String.repeat()" },
  { label: "substring", type: "method", detail: "String.substring()" },
  { label: "then", type: "method", detail: "Promise.then()" },
  { label: "catch", type: "method", detail: "Promise.catch()" },
  { label: "finally", type: "method", detail: "Promise.finally()" },
];

const tsKeywords: Completion[] = [
  { label: "interface", type: "keyword", detail: "TypeScript interface" },
  { label: "type", type: "keyword", detail: "TypeScript type alias" },
  { label: "enum", type: "keyword", detail: "TypeScript enum" },
  { label: "namespace", type: "keyword", detail: "TypeScript namespace" },
  { label: "readonly", type: "keyword", detail: "Readonly modifier" },
  { label: "abstract", type: "keyword", detail: "Abstract class/method" },
  { label: "implements", type: "keyword", detail: "Implements interface" },
  { label: "declare", type: "keyword", detail: "Declare ambient" },
  { label: "as", type: "keyword", detail: "Type assertion" },
  { label: "keyof", type: "keyword", detail: "Key of type" },
  { label: "typeof", type: "keyword", detail: "Type of value" },
  { label: "Partial", type: "type", detail: "Make all props optional" },
  { label: "Required", type: "type", detail: "Make all props required" },
  { label: "Readonly", type: "type", detail: "Make all props readonly" },
  { label: "Record", type: "type", detail: "Record<Keys, Type>" },
  { label: "Pick", type: "type", detail: "Pick<Type, Keys>" },
  { label: "Omit", type: "type", detail: "Omit<Type, Keys>" },
  { label: "Exclude", type: "type", detail: "Exclude from union" },
  { label: "Extract", type: "type", detail: "Extract from union" },
  { label: "ReturnType", type: "type", detail: "Function return type" },
  { label: "Parameters", type: "type", detail: "Function parameters" },
];

const pythonBuiltins: Completion[] = [
  { label: "print", type: "function", detail: "Print to stdout", boost: 10 },
  { label: "len", type: "function", detail: "Length of object" },
  { label: "range", type: "function", detail: "Range of numbers" },
  { label: "int", type: "function", detail: "Convert to integer" },
  { label: "float", type: "function", detail: "Convert to float" },
  { label: "str", type: "function", detail: "Convert to string" },
  { label: "bool", type: "function", detail: "Convert to boolean" },
  { label: "list", type: "function", detail: "Create list" },
  { label: "dict", type: "function", detail: "Create dictionary" },
  { label: "tuple", type: "function", detail: "Create tuple" },
  { label: "set", type: "function", detail: "Create set" },
  { label: "type", type: "function", detail: "Get type of object" },
  { label: "isinstance", type: "function", detail: "Check instance type" },
  { label: "issubclass", type: "function", detail: "Check subclass" },
  { label: "input", type: "function", detail: "Read user input" },
  { label: "open", type: "function", detail: "Open file" },
  { label: "abs", type: "function", detail: "Absolute value" },
  { label: "max", type: "function", detail: "Maximum value" },
  { label: "min", type: "function", detail: "Minimum value" },
  { label: "sum", type: "function", detail: "Sum of iterable" },
  { label: "sorted", type: "function", detail: "Sorted iterable" },
  { label: "reversed", type: "function", detail: "Reversed iterator" },
  { label: "enumerate", type: "function", detail: "Enumerate iterable" },
  { label: "zip", type: "function", detail: "Zip iterables" },
  { label: "map", type: "function", detail: "Map function over iterable" },
  { label: "filter", type: "function", detail: "Filter iterable" },
  { label: "any", type: "function", detail: "Any element is true" },
  { label: "all", type: "function", detail: "All elements are true" },
  { label: "hasattr", type: "function", detail: "Has attribute" },
  { label: "getattr", type: "function", detail: "Get attribute" },
  { label: "setattr", type: "function", detail: "Set attribute" },
  { label: "delattr", type: "function", detail: "Delete attribute" },
  { label: "callable", type: "function", detail: "Check if callable" },
  { label: "chr", type: "function", detail: "Char from code point" },
  { label: "ord", type: "function", detail: "Code point from char" },
  { label: "hex", type: "function", detail: "Convert to hex string" },
  { label: "bin", type: "function", detail: "Convert to binary string" },
  { label: "oct", type: "function", detail: "Convert to octal string" },
  { label: "round", type: "function", detail: "Round number" },
  { label: "pow", type: "function", detail: "Power" },
  { label: "divmod", type: "function", detail: "Division and modulo" },
  { label: "hash", type: "function", detail: "Hash of object" },
  { label: "id", type: "function", detail: "Object identity" },
  { label: "repr", type: "function", detail: "Printable representation" },
  { label: "iter", type: "function", detail: "Get iterator" },
  { label: "next", type: "function", detail: "Next item from iterator" },
  { label: "super", type: "function", detail: "Parent class reference" },
  { label: "property", type: "function", detail: "Property decorator" },
  { label: "staticmethod", type: "function", detail: "Static method decorator" },
  { label: "classmethod", type: "function", detail: "Class method decorator" },
  { label: "Exception", type: "class", detail: "Base exception class" },
  { label: "ValueError", type: "class", detail: "Value error" },
  { label: "TypeError", type: "class", detail: "Type error" },
  { label: "KeyError", type: "class", detail: "Key error" },
  { label: "IndexError", type: "class", detail: "Index error" },
  { label: "AttributeError", type: "class", detail: "Attribute error" },
  { label: "ImportError", type: "class", detail: "Import error" },
  { label: "FileNotFoundError", type: "class", detail: "File not found" },
  { label: "RuntimeError", type: "class", detail: "Runtime error" },
  { label: "StopIteration", type: "class", detail: "Stop iteration" },
  { label: "True", type: "constant", detail: "Boolean true" },
  { label: "False", type: "constant", detail: "Boolean false" },
  { label: "None", type: "constant", detail: "None value" },
];

const pythonModules: Completion[] = [
  { label: "os", type: "namespace", detail: "Operating system interface" },
  { label: "sys", type: "namespace", detail: "System-specific parameters" },
  { label: "math", type: "namespace", detail: "Mathematical functions" },
  { label: "json", type: "namespace", detail: "JSON encoder/decoder" },
  { label: "re", type: "namespace", detail: "Regular expressions" },
  { label: "datetime", type: "namespace", detail: "Date and time" },
  { label: "collections", type: "namespace", detail: "Container datatypes" },
  { label: "itertools", type: "namespace", detail: "Iterator functions" },
  { label: "functools", type: "namespace", detail: "Higher-order functions" },
  { label: "pathlib", type: "namespace", detail: "Object-oriented paths" },
  { label: "typing", type: "namespace", detail: "Type hints" },
  { label: "random", type: "namespace", detail: "Random number generation" },
  { label: "string", type: "namespace", detail: "String operations" },
  { label: "time", type: "namespace", detail: "Time access and conversion" },
  { label: "copy", type: "namespace", detail: "Shallow and deep copy" },
  { label: "io", type: "namespace", detail: "I/O core tools" },
  { label: "csv", type: "namespace", detail: "CSV file reading/writing" },
  { label: "hashlib", type: "namespace", detail: "Secure hash algorithms" },
  { label: "urllib", type: "namespace", detail: "URL handling" },
  { label: "http", type: "namespace", detail: "HTTP modules" },
  { label: "subprocess", type: "namespace", detail: "Subprocess management" },
  { label: "threading", type: "namespace", detail: "Thread-based parallelism" },
  { label: "multiprocessing", type: "namespace", detail: "Process-based parallelism" },
  { label: "logging", type: "namespace", detail: "Logging facility" },
  { label: "unittest", type: "namespace", detail: "Unit testing framework" },
  { label: "argparse", type: "namespace", detail: "Command-line parsing" },
  { label: "dataclasses", type: "namespace", detail: "Data classes" },
  { label: "abc", type: "namespace", detail: "Abstract base classes" },
  { label: "enum", type: "namespace", detail: "Enumeration support" },
  { label: "contextlib", type: "namespace", detail: "Context managers" },
];

function jsAutocomplete(context: CompletionContext) {
  const before = context.matchBefore(/[\w.]+/);
  if (!before) return null;
  if (before.from === before.to && !context.explicit) return null;

  const text = before.text;

  if (text.includes(".")) {
    const parts = text.split(".");
    const prefix = parts.slice(0, -1).join(".");
    const partial = parts[parts.length - 1];

    const dotCompletions = jsGlobals
      .filter(c => c.label.startsWith(prefix + "."))
      .map(c => ({ ...c, label: c.label.slice(prefix.length + 1) }));

    const methodOptions = jsMethodCompletions.filter(c =>
      c.label.startsWith(partial)
    );

    const allOptions = [...dotCompletions, ...methodOptions];
    if (allOptions.length === 0) return null;

    return {
      from: before.from + prefix.length + 1,
      options: allOptions,
      validFor: /^[\w]*$/,
    };
  }

  return {
    from: before.from,
    options: jsGlobals,
    validFor: /^[\w]*$/,
  };
}

function tsAutocomplete(context: CompletionContext) {
  const jsResult = jsAutocomplete(context);
  const before = context.matchBefore(/[\w.]+/);
  if (!before) return jsResult;
  if (before.from === before.to && !context.explicit) return jsResult;

  if (!before.text.includes(".")) {
    return {
      from: before.from,
      options: [...jsGlobals, ...tsKeywords],
      validFor: /^[\w]*$/,
    };
  }

  return jsResult;
}

function pythonAutocomplete(context: CompletionContext) {
  const importMatch = context.matchBefore(/import\s+[\w.]*/);
  if (importMatch) {
    const modPart = importMatch.text.replace(/^import\s+/, "");
    return {
      from: importMatch.from + importMatch.text.indexOf(modPart),
      options: pythonModules,
      validFor: /^[\w.]*$/,
    };
  }

  const fromMatch = context.matchBefore(/from\s+[\w.]*/);
  if (fromMatch) {
    const modPart = fromMatch.text.replace(/^from\s+/, "");
    return {
      from: fromMatch.from + fromMatch.text.indexOf(modPart),
      options: pythonModules,
      validFor: /^[\w.]*$/,
    };
  }

  const before = context.matchBefore(/[\w.]+/);
  if (!before) return null;
  if (before.from === before.to && !context.explicit) return null;

  return {
    from: before.from,
    options: pythonBuiltins,
    validFor: /^[\w]*$/,
  };
}

function createJsLinter(isTypescript: boolean) {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const doc = view.state.doc;
    const text = doc.toString();

    const unclosedBrackets: { char: string; pos: number }[] = [];
    const bracketPairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
    const closingBrackets: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    let inString = false;
    let stringChar = "";
    let inLineComment = false;
    let inBlockComment = false;
    let inTemplate = false;
    let templateDepth = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inLineComment) {
        if (ch === "\n") inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (ch === "*" && next === "/") { inBlockComment = false; i++; }
        continue;
      }
      if (inString) {
        if (ch === "\\" ) { i++; continue; }
        if (ch === stringChar) inString = false;
        continue;
      }
      if (inTemplate) {
        if (ch === "\\") { i++; continue; }
        if (ch === "`") { inTemplate = false; continue; }
        if (ch === "$" && next === "{") { templateDepth++; i++; continue; }
        continue;
      }

      if (ch === "/" && next === "/") { inLineComment = true; i++; continue; }
      if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
      if (ch === "`") { inTemplate = true; continue; }

      if (bracketPairs[ch]) {
        unclosedBrackets.push({ char: ch, pos: i });
      } else if (closingBrackets[ch]) {
        const last = unclosedBrackets[unclosedBrackets.length - 1];
        if (last && last.char === closingBrackets[ch]) {
          unclosedBrackets.pop();
        } else if (last && last.char !== closingBrackets[ch]) {
          diagnostics.push({
            from: i,
            to: i + 1,
            severity: "error",
            message: `Mismatched bracket: expected '${bracketPairs[last.char]}' but found '${ch}'`,
          });
        } else {
          diagnostics.push({
            from: i,
            to: i + 1,
            severity: "error",
            message: `Unexpected closing bracket '${ch}'`,
          });
        }
      }
    }

    for (const bracket of unclosedBrackets) {
      diagnostics.push({
        from: bracket.pos,
        to: bracket.pos + 1,
        severity: "error",
        message: `Unclosed bracket '${bracket.char}'`,
      });
    }

    if (inBlockComment) {
      diagnostics.push({
        from: text.length - 1,
        to: text.length,
        severity: "error",
        message: "Unterminated block comment",
      });
    }

    return diagnostics;
  });
}

function createPythonLinter() {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const doc = view.state.doc;

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const lineText = line.text;
      const trimmed = lineText.trimStart();

      if (!trimmed || trimmed.startsWith("#")) continue;

      if (/\t/.test(lineText) && / /.test(lineText.substring(0, lineText.length - trimmed.length))) {
        diagnostics.push({
          from: line.from,
          to: line.from + (lineText.length - trimmed.length),
          severity: "warning",
          message: "Mixed tabs and spaces in indentation",
        });
      }

      const colonKeywords = ["def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally", "with"];
      for (const kw of colonKeywords) {
        const pattern = new RegExp(`^${kw}\\b`);
        if (pattern.test(trimmed) && !trimmed.endsWith(":") && !trimmed.endsWith(":\\") && !trimmed.includes("#")) {
          if (!trimmed.endsWith("\\")) {
            diagnostics.push({
              from: line.from,
              to: line.to,
              severity: "error",
              message: `'${kw}' statement should end with ':'`,
            });
          }
        }
      }
    }

    return diagnostics;
  });
}

const setLSPDiagnosticsEffect = StateEffect.define<Diagnostic[]>();

const lspDiagnosticsField = StateField.define<Diagnostic[]>({
  create() { return []; },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setLSPDiagnosticsEffect)) return e.value;
    }
    return value;
  },
});

function createLSPLinter() {
  return linter((view) => {
    return view.state.field(lspDiagnosticsField, false) || [];
  }, { delay: 100 });
}

function createLSPHoverExtension(lspClient: LSPClient, filename: string) {
  return hoverTooltip(async (view, pos) => {
    if (!lspClient.isReady()) return null;

    const line = view.state.doc.lineAt(pos);
    const lineNum = line.number - 1;
    const character = pos - line.from;
    const uri = lspClient.makeUri(filename);

    const result = await lspClient.hover(uri, lineNum, character);
    if (!result) return null;

    return {
      pos,
      end: pos,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-lsp-hover";
        dom.style.cssText = "max-width: 500px; max-height: 300px; overflow: auto; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;";

        const codeBlock = result.match(/```[\s\S]*?\n([\s\S]*?)```/);
        if (codeBlock) {
          const pre = document.createElement("pre");
          pre.style.cssText = "margin: 0; padding: 4px 0;";
          const code = document.createElement("code");
          code.textContent = codeBlock[1].trim();
          pre.appendChild(code);
          dom.appendChild(pre);

          const rest = result.replace(/```[\s\S]*?```/, "").trim();
          if (rest) {
            const p = document.createElement("div");
            p.style.cssText = "margin-top: 6px; opacity: 0.8; font-size: 11px;";
            p.textContent = rest;
            dom.appendChild(p);
          }
        } else {
          dom.textContent = result;
        }

        return { dom };
      },
    };
  }, { hideOnChange: true, hoverTime: 300 });
}

function createLSPCompletionSource(lspClient: LSPClient, filename: string) {
  return async (context: CompletionContext) => {
    if (!lspClient.isReady()) return null;

    const pos = context.pos;
    const line = context.state.doc.lineAt(pos);
    const lineNum = line.number - 1;
    const character = pos - line.from;
    const uri = lspClient.makeUri(filename);

    const before = context.matchBefore(/[\w.]+/);
    if (!before && !context.explicit) return null;

    try {
      const completions = await lspClient.completion(uri, lineNum, character);
      if (completions.length === 0) return null;

      return {
        from: before ? before.from : pos,
        options: completions,
        validFor: /^[\w]*$/,
      };
    } catch {
      return null;
    }
  };
}

function createLSPKeybindings(
  lspClient: LSPClient,
  filename: string,
  onGoToDefinition?: (uri: string, line: number, character: number) => void,
  onFindReferences?: (uri: string, line: number, character: number) => void,
  onRenameSymbol?: (uri: string, line: number, character: number) => void,
) {
  return Prec.high(keymap.of([
    {
      key: "F12",
      run(view) {
        if (!lspClient.isReady()) return false;
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const lineNum = line.number - 1;
        const character = pos - line.from;
        const uri = lspClient.makeUri(filename);

        lspClient.definition(uri, lineNum, character).then((locations) => {
          if (locations.length > 0 && onGoToDefinition) {
            const loc = locations[0];
            onGoToDefinition(loc.uri, loc.range.start.line, loc.range.start.character);
          }
        });
        return true;
      },
    },
    {
      key: "Shift-F12",
      run(view) {
        if (!lspClient.isReady()) return false;
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const lineNum = line.number - 1;
        const character = pos - line.from;
        const uri = lspClient.makeUri(filename);

        if (onFindReferences) {
          onFindReferences(uri, lineNum, character);
        }
        return true;
      },
    },
    {
      key: "F2",
      run(view) {
        if (!lspClient.isReady()) return false;
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const lineNum = line.number - 1;
        const character = pos - line.from;
        const uri = lspClient.makeUri(filename);

        if (onRenameSymbol) {
          onRenameSymbol(uri, lineNum, character);
        }
        return true;
      },
    },
  ]));
}

function createCtrlClickHandler(
  lspClient: LSPClient,
  filename: string,
  onGoToDefinition?: (uri: string, line: number, character: number) => void,
) {
  return EditorView.domEventHandlers({
    click(event: MouseEvent, view: EditorView) {
      if (!(event.ctrlKey || event.metaKey)) return false;
      if (!lspClient.isReady() || !onGoToDefinition) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const line = view.state.doc.lineAt(pos);
      const lineNum = line.number - 1;
      const character = pos - line.from;
      const uri = lspClient.makeUri(filename);

      event.preventDefault();
      lspClient.definition(uri, lineNum, character).then((locations) => {
        if (locations.length > 0) {
          const loc = locations[0];
          onGoToDefinition(loc.uri, loc.range.start.line, loc.range.start.character);
        }
      });

      return true;
    },
  });
}

const setSignatureTooltipEffect = StateEffect.define<Tooltip | null>();

const signatureHelpTooltipField = StateField.define<Tooltip | null>({
  create() { return null; },
  update(tooltip, tr) {
    for (const e of tr.effects) {
      if (e.is(setSignatureTooltipEffect)) return e.value;
    }
    if (tr.docChanged) return null;
    return tooltip;
  },
  provide: f => showTooltip.from(f),
});

function createSignatureHelpExtension(lspClient: LSPClient, filename: string) {
  const triggerSignatureHelp = EditorView.updateListener.of((update) => {
    if (!update.docChanged || !lspClient.isReady()) return;

    const pos = update.state.selection.main.head;
    const line = update.state.doc.lineAt(pos);
    const charBefore = pos > line.from ? update.state.doc.sliceString(pos - 1, pos) : "";

    if (charBefore === "(" || charBefore === ",") {
      const lineNum = line.number - 1;
      const character = pos - line.from;
      const uri = lspClient.makeUri(filename);

      lspClient.signatureHelp(uri, lineNum, character).then((result) => {
        if (!result || !result.signatures || result.signatures.length === 0) {
          update.view.dispatch({ effects: setSignatureTooltipEffect.of(null) });
          return;
        }

        const sig = result.signatures[result.activeSignature ?? 0];
        if (!sig) return;

        const tooltip: Tooltip = {
          pos,
          above: true,
          create() {
            const dom = document.createElement("div");
            dom.className = "cm-lsp-signature";
            dom.style.cssText = "max-width: 500px; padding: 6px 10px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5;";

            const label = document.createElement("div");
            label.style.cssText = "font-weight: 500;";
            label.textContent = sig.label;
            dom.appendChild(label);

            if (sig.documentation) {
              const docEl = document.createElement("div");
              docEl.style.cssText = "margin-top: 4px; opacity: 0.8; font-size: 11px;";
              docEl.textContent = typeof sig.documentation === "string"
                ? sig.documentation
                : sig.documentation.value || "";
              dom.appendChild(docEl);
            }

            return { dom };
          },
        };

        update.view.dispatch({
          effects: setSignatureTooltipEffect.of(tooltip),
        });
      }).catch(() => {});
    } else if (charBefore === ")") {
      update.view.dispatch({
        effects: setSignatureTooltipEffect.of(null),
      });
    }
  });

  return triggerSignatureHelp;
}

const COMMIT_CHARS = [".", "(", ")", ";", ",", "[", "]", "{", "}", "'", '"', "`"];

function wrapWithCommitChars(source: (ctx: CompletionContext) => any, acceptOnCommit: boolean) {
  return async (ctx: CompletionContext) => {
    const result = await source(ctx);
    if (!result) return result;
    if (acceptOnCommit) {
      return { ...result, commitCharacters: COMMIT_CHARS };
    }
    return { ...result, commitCharacters: [] };
  };
}

function getAutocompleteExtension(lang: string, acceptOnCommit: boolean) {
  switch (lang) {
    case "javascript":
      return [
        autocompletion({ override: [wrapWithCommitChars(jsAutocomplete, acceptOnCommit)] }),
        createJsLinter(false),
      ];
    case "typescript":
      return [
        autocompletion({ override: [wrapWithCommitChars(tsAutocomplete, acceptOnCommit)] }),
        createJsLinter(true),
      ];
    case "python":
      return [
        autocompletion({ override: [wrapWithCommitChars(pythonAutocomplete, acceptOnCommit)] }),
        createPythonLinter(),
      ];
    default:
      return [];
  }
}

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
    case "go":
      return go();
    case "java":
      return java();
    case "c":
    case "cpp":
      return cpp();
    case "rust":
      return rust();
    case "bash":
    case "shell":
      return javascript();
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
    case "go":
      return "go";
    case "rb":
      return "ruby";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "hxx":
      return "cpp";
    case "java":
      return "java";
    case "rs":
      return "rust";
    case "sh":
    case "bash":
      return "bash";
    default:
      return "javascript";
  }
}

export { detectLanguage };

function createPasteFormatterExtension() {
  return EditorView.domEventHandlers({
    paste(event: ClipboardEvent, view: EditorView) {
      const clipText = event.clipboardData?.getData("text/plain");
      if (!clipText || !clipText.includes("\n")) return false;

      event.preventDefault();

      const state = view.state;
      const { from } = state.selection.main;
      const currentLine = state.doc.lineAt(from);
      const leadingMatch = currentLine.text.match(/^(\s*)/);
      const baseIndent = leadingMatch ? leadingMatch[1] : "";

      const lines = clipText.split("\n");
      const pastedLeadingSpaces = lines.filter(l => l.trim().length > 0).map(l => {
        const m = l.match(/^(\s*)/);
        return m ? m[1].length : 0;
      });
      const minIndent = pastedLeadingSpaces.length > 0 ? Math.min(...pastedLeadingSpaces) : 0;

      const formatted = lines.map((line, i) => {
        if (i === 0) return line.trimStart();
        const stripped = line.length >= minIndent ? line.slice(minIndent) : line.trimStart();
        return baseIndent + stripped;
      }).join("\n");

      view.dispatch({
        changes: { from: state.selection.main.from, to: state.selection.main.to, insert: formatted },
        selection: { anchor: from + formatted.length },
      });
      return true;
    },
  });
}

class RemoteCursorWidget extends WidgetType {
  constructor(
    public displayName: string,
    public color: string,
  ) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-remote-cursor";
    wrapper.style.borderLeftColor = this.color;

    const label = document.createElement("span");
    label.className = "cm-remote-cursor-label";
    label.style.backgroundColor = this.color;
    label.textContent = this.displayName;
    wrapper.appendChild(label);

    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

interface AwarenessEntry {
  userId: string;
  displayName: string;
  color: string;
  cursor: { anchor: number; head: number } | null;
}

const setAwarenessEffect = StateEffect.define<Map<string, AwarenessEntry>>();

const awarenessField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setAwarenessEffect)) {
        const states = effect.value;
        const decos: Range<Decoration>[] = [];
        const doc = tr.state.doc;

        for (const [, state] of states) {
          try {
            if (!state.cursor) continue;
            const headPos = Math.min(Math.max(0, state.cursor.head), doc.length);

            decos.push(
              Decoration.widget({
                widget: new RemoteCursorWidget(state.displayName, state.color),
                side: 1,
              }).range(headPos)
            );

            const anchor = Math.min(Math.max(0, state.cursor.anchor), doc.length);
            const head = Math.min(Math.max(0, state.cursor.head), doc.length);
            const from = Math.min(anchor, head);
            const to = Math.max(anchor, head);
            if (from !== to) {
              decos.push(
                Decoration.mark({
                  class: "cm-remote-selection",
                  attributes: {
                    style: `background-color: ${state.color}22`,
                  },
                }).range(from, to)
              );
            }
          } catch {
          }
        }

        return Decoration.set(decos, true);
      }
    }

    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const remoteCursorTheme = EditorView.theme({
  ".cm-remote-cursor": {
    position: "relative",
    borderLeft: "2px solid",
    marginLeft: "-1px",
    marginRight: "-1px",
    pointerEvents: "none",
  },
  ".cm-remote-cursor-label": {
    position: "absolute",
    top: "-1.4em",
    left: "-1px",
    fontSize: "10px",
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', sans-serif",
    padding: "1px 5px",
    borderRadius: "3px 3px 3px 0",
    color: "#fff",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    lineHeight: "1.3",
    zIndex: "10",
    fontWeight: "500",
  },
  ".cm-remote-selection": {
    mixBlendMode: "multiply",
  },
  ".cm-ySelectionInfo": {
    position: "absolute",
    top: "-1.4em",
    left: "-1px",
    fontSize: "10px",
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', sans-serif",
    padding: "1px 5px",
    borderRadius: "3px 3px 3px 0",
    color: "#fff",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    lineHeight: "1.3",
    zIndex: "10",
    fontWeight: "500",
  },
});

export default function CodeEditor({ value, onChange, language, readOnly = false, onCursorChange, fontSize = 14, tabSize = 2, wordWrap = false, blameData, aiCompletions = false, autoCloseBrackets: autoCloseBracketsEnabled = true, indentationChar = "spaces", minimap: showMinimap = true, indentOnInput: indentOnInputProp = true, multiselectModifier = "Alt", semanticTokens = true, formatPastedText = true, acceptSuggestionOnCommit = true, editorRef: externalEditorRef, ytext, remoteAwareness, lspClient, filename, projectId, onGoToDefinition, onFindReferences, onRenameSymbol }: CodeEditorProps) {
  const internalEditorRef = useRef<ReactCodeMirrorRef>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const lspClientRef = useRef(lspClient);
  lspClientRef.current = lspClient;
  const docVersionRef = useRef(0);

  const cursorTracker = useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        onCursorChangeRef.current?.(line.number, pos - line.from + 1);
      }
    });
  }, []);

  const lspDocSync = useMemo(() => {
    if (!lspClient || !filename) return [];

    return [
      EditorView.updateListener.of((update) => {
        const client = lspClientRef.current;
        if (!client || !client.isReady() || !filename) return;

        if (update.docChanged) {
          docVersionRef.current++;
          const uri = client.makeUri(filename);
          const fullText = update.state.doc.toString();

          const contentChanges: Array<{
            range: { start: { line: number; character: number }; end: { line: number; character: number } };
            rangeLength: number;
            text: string;
          }> = [];

          update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            const startLine = update.startState.doc.lineAt(fromA);
            const endLine = update.startState.doc.lineAt(toA);
            contentChanges.push({
              range: {
                start: { line: startLine.number - 1, character: fromA - startLine.from },
                end: { line: endLine.number - 1, character: toA - endLine.from },
              },
              rangeLength: toA - fromA,
              text: inserted.toString(),
            });
          });

          client.didChange(uri, docVersionRef.current, fullText, contentChanges.length > 0 ? contentChanges : undefined);
        }
      }),
    ];
  }, [lspClient, filename]);

  useEffect(() => {
    if (!lspClient || !filename) return;

    const langId = language === "typescript" ? "typescript" :
      language === "javascript" ? "javascript" :
      language === "python" ? "python" :
      language === "go" ? "go" : "plaintext";

    const openDoc = () => {
      if (!lspClient.isReady()) return;
      const uri = lspClient.makeUri(filename);
      docVersionRef.current++;
      lspClient.didOpen(uri, langId, docVersionRef.current, editorRef.current?.view?.state.doc.toString() || value || "");
    };

    if (lspClient.isReady()) {
      openDoc();
    }

    const unsubReady = lspClient.onReady(() => {
      openDoc();
    });

    return () => {
      unsubReady();
      if (lspClient.isReady() && filename) {
        lspClient.didClose(lspClient.makeUri(filename));
      }
    };
  }, [lspClient, filename]);

  useEffect(() => {
    if (!lspClient || !filename) return;

    const unsubscribe = lspClient.onDiagnostics((uri, diagnostics) => {
      const view = editorRef.current?.view;
      if (!view) return;

      const expectedUri = lspClient.makeUri(filename);
      if (uri !== expectedUri) return;

      const cmDiagnostics = LSPClient.lspDiagnosticsToCodeMirror(diagnostics, view.state.doc);
      view.dispatch({ effects: setLSPDiagnosticsEffect.of(cmDiagnostics) });
    });

    return unsubscribe;
  }, [lspClient, filename]);

  const showBlame = blameData && blameData.length > 0;

  const { activeTheme } = useTheme();

  const editorTheme = useMemo(() =>
    buildEditorTheme(activeTheme.globalColors, activeTheme.baseScheme === "dark"),
    [activeTheme.globalColors, activeTheme.baseScheme]
  );

  const highlightStyle = useMemo(() =>
    buildHighlightStyle(activeTheme.syntaxColors),
    [activeTheme.syntaxColors]
  );

  const collabExtension = useMemo(() => {
    if (!ytext) return [];
    return [yCollab(ytext, null, { undoManager: false })];
  }, [ytext]);

  const hasLSP = !!(lspClient && filename);

  const lspExtensions = useMemo(() => {
    if (!lspClient || !filename) return [];

    const ext: Extension[] = [
      lspDiagnosticsField,
      createLSPLinter(),
      lintGutter(),
      createLSPHoverExtension(lspClient, filename),
      createLSPKeybindings(lspClient, filename, onGoToDefinition, onFindReferences, onRenameSymbol),
      createCtrlClickHandler(lspClient, filename, onGoToDefinition),
      signatureHelpTooltipField,
      createSignatureHelpExtension(lspClient, filename),
    ];

    return ext;
  }, [lspClient, filename, onGoToDefinition, onFindReferences, onRenameSymbol]);

  const extensions = useMemo(() => {
    const indentStr = indentationChar === "tabs" ? "\t" : " ".repeat(tabSize);

    const autocompleteSources: ((ctx: CompletionContext) => Promise<{ from: number; options: Completion[]; validFor?: RegExp } | null>)[] = [];
    if (hasLSP && lspClient && filename) {
      autocompleteSources.push(createLSPCompletionSource(lspClient, filename));
    }

    const staticAutoComplete = getAutocompleteExtension(language, acceptSuggestionOnCommit);

    const ext: Extension[] = [
      getLanguageExtension(language),
      ...(hasLSP && autocompleteSources.length > 0
        ? [autocompletion({ override: autocompleteSources })]
        : staticAutoComplete),
      replitTheme,
      ...(semanticTokens ? [syntaxHighlighting(replitHighlight)] : []),
      indentUnit.of(indentStr),
      cursorTracker,
      blameField,
      awarenessField,
      remoteCursorTheme,
      search({ top: true }),
      keymap.of(searchKeymap),
      ...collabExtension,
      ...lspExtensions,
      ...lspDocSync,
    ];
    if (showBlame) ext.push(blameGutter);
    if (wordWrap) ext.push(EditorView.lineWrapping);
    if (readOnly) ext.push(EditorView.editable.of(false));
    if (aiCompletions && !readOnly) ext.push(...inlineAICompletion(language));
    if (formatPastedText && !readOnly) ext.push(createPasteFormatterExtension());
    if (multiselectModifier !== "Alt") {
      ext.push(EditorView.mouseSelectionStyle.of(() => null));
    }
    return ext;
  }, [language, readOnly, cursorTracker, tabSize, wordWrap, showBlame, aiCompletions, indentationChar, multiselectModifier, semanticTokens, formatPastedText, acceptSuggestionOnCommit, collabExtension, lspExtensions, lspDocSync, hasLSP]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view && blameData) {
      view.dispatch({ effects: setBlameEffect.of(blameData) });
    }
  }, [blameData]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view && remoteAwareness) {
      view.dispatch({ effects: setAwarenessEffect.of(remoteAwareness) });
    }
  }, [remoteAwareness]);

  return (
    <CodeMirror
      ref={editorRef}
      value={ytext ? undefined : value}
      onChange={ytext ? undefined : onChange}
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers: true,
        bracketMatching: true,
        closeBrackets: autoCloseBracketsEnabled,
        autocompletion: false,
        highlightActiveLine: true,
        indentOnInput: indentOnInputProp,
        searchKeymap: true,
        foldGutter: true,
        tabSize,
      }}
      style={{ height: "100%", width: "100%", fontSize: `${fontSize}px` }}
      data-testid="code-editor"
    />
  );
}

export { setLSPDiagnosticsEffect, lspDiagnosticsField };

