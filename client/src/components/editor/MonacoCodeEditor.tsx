import { useRef, useCallback, useEffect, useState } from "react";
import Editor, { type OnMount, type OnChange, loader } from "@monaco-editor/react";
import type * as monacoType from "monaco-editor";

loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs" },
});

interface MonacoCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
  onCursorChange?: (line: number, col: number) => void;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  filename?: string;
  projectId?: string;
}

const FILE_LANG_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  dockerfile: "dockerfile",
  graphql: "graphql",
  gql: "graphql",
  toml: "ini",
  ini: "ini",
  env: "plaintext",
  txt: "plaintext",
  lua: "lua",
  r: "r",
  dart: "dart",
  vue: "html",
  svelte: "html",
};

export function detectMonacoLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const base = filename.split("/").pop()?.toLowerCase() || "";
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "plaintext";
  if (base === ".gitignore") return "plaintext";
  return FILE_LANG_MAP[ext] || "plaintext";
}

const DARK_THEME_DATA: monacoType.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6A9955", fontStyle: "italic" },
    { token: "keyword", foreground: "C586C0" },
    { token: "string", foreground: "CE9178" },
    { token: "number", foreground: "B5CEA8" },
    { token: "type", foreground: "4EC9B0" },
    { token: "function", foreground: "DCDCAA" },
    { token: "variable", foreground: "9CDCFE" },
    { token: "constant", foreground: "4FC1FF" },
    { token: "operator", foreground: "D4D4D4" },
    { token: "delimiter", foreground: "D4D4D4" },
    { token: "tag", foreground: "569CD6" },
    { token: "attribute.name", foreground: "9CDCFE" },
    { token: "attribute.value", foreground: "CE9178" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#c9d1d9",
    "editor.lineHighlightBackground": "#161b22",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#264f7855",
    "editorCursor.foreground": "#58a6ff",
    "editorLineNumber.foreground": "#484f58",
    "editorLineNumber.activeForeground": "#c9d1d9",
    "editor.selectionHighlightBackground": "#264f7833",
    "editorIndentGuide.background": "#21262d",
    "editorIndentGuide.activeBackground": "#30363d",
    "editorBracketMatch.background": "#264f7844",
    "editorBracketMatch.border": "#58a6ff55",
    "editorWidget.background": "#161b22",
    "editorWidget.border": "#30363d",
    "editorSuggestWidget.background": "#161b22",
    "editorSuggestWidget.border": "#30363d",
    "editorSuggestWidget.selectedBackground": "#264f78",
    "editorHoverWidget.background": "#161b22",
    "editorHoverWidget.border": "#30363d",
    "minimap.background": "#0d1117",
    "scrollbarSlider.background": "#484f5833",
    "scrollbarSlider.hoverBackground": "#484f5866",
    "scrollbarSlider.activeBackground": "#484f5899",
  },
};

export default function MonacoCodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  onCursorChange,
  fontSize = 14,
  tabSize = 2,
  wordWrap = false,
  minimap = true,
  filename,
}: MonacoCodeEditorProps) {
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monacoType | null>(null);
  const [isReady, setIsReady] = useState(false);

  const resolvedLang = filename ? detectMonacoLanguage(filename) : language;

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      monaco.editor.defineTheme("ecode-dark", DARK_THEME_DATA);
      monaco.editor.setTheme("ecode-dark");

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        strict: true,
      });

      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true,
        allowNonTsExtensions: true,
      });

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {});
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {});

      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.(e.position.lineNumber, e.position.column);
      });

      setIsReady(true);
    },
    [onCursorChange],
  );

  const handleChange: OnChange = useCallback(
    (val) => {
      if (val !== undefined) onChange(val);
    },
    [onChange],
  );

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize, tabSize, wordWrap: wordWrap ? "on" : "off" });
    }
  }, [fontSize, tabSize, wordWrap]);

  return (
    <div className="h-full w-full" data-testid="monaco-editor-container">
      <Editor
        height="100%"
        language={resolvedLang}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        theme="ecode-dark"
        loading={
          <div className="h-full w-full flex items-center justify-center bg-[#0d1117] text-[#c9d1d9] text-sm">
            Loading editor...
          </div>
        }
        options={{
          fontSize,
          tabSize,
          readOnly,
          wordWrap: wordWrap ? "on" : "off",
          minimap: { enabled: minimap, scale: 1, showSlider: "mouseover" },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          parameterHints: { enabled: true },
          formatOnPaste: true,
          formatOnType: true,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoIndent: "full",
          folding: true,
          foldingStrategy: "indentation",
          showFoldingControls: "mouseover",
          links: true,
          colorDecorators: true,
          renderLineHighlight: "all",
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false,
          },
          padding: { top: 8 },
          lineNumbers: "on",
          glyphMargin: true,
          contextmenu: true,
          mouseWheelZoom: true,
          multiCursorModifier: "alt",
          snippetSuggestions: "top",
          inlineSuggest: { enabled: true },
          stickyScroll: { enabled: true },
        }}
      />
    </div>
  );
}
