import { StateEffect, StateField, Extension, Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  Diagnostic as CM6Diagnostic,
  setDiagnostics as cm6SetDiagnostics,
  linter,
  lintGutter,
  lintKeymap,
  openLintPanel,
  closeLintPanel,
  forceLinting,
} from '@codemirror/lint';
import { keymap } from '@codemirror/view';

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface ExternalDiagnostic {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  code?: string;
}

export interface DiagnosticAction {
  name: string;
  apply: (view: EditorView, from: number, to: number) => void;
}

export interface ExternalDiagnosticWithActions extends ExternalDiagnostic {
  actions?: DiagnosticAction[];
}

const updateDiagnosticsEffect = StateEffect.define<ExternalDiagnostic[]>();

const clearDiagnosticsEffect = StateEffect.define<void>();

export const diagnosticsField = StateField.define<ExternalDiagnostic[]>({
  create() {
    return [];
  },
  update(diagnostics, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateDiagnosticsEffect)) {
        return effect.value;
      }
      if (effect.is(clearDiagnosticsEffect)) {
        return [];
      }
    }
    if (tr.docChanged && diagnostics.length > 0) {
      return diagnostics.map((d) => {
        const oldLine = d.line;
        let newLine = oldLine;
        
        tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
          const doc = tr.startState.doc;
          if (fromA < doc.length) {
            const lineAtChange = doc.lineAt(fromA).number;
            if (lineAtChange <= oldLine) {
              const oldLineCount = tr.startState.doc.lines;
              const newLineCount = tr.newDoc.lines;
              const lineDiff = newLineCount - oldLineCount;
              
              if (lineAtChange < oldLine) {
                newLine = Math.max(1, oldLine + lineDiff);
              }
            }
          }
        });
        
        return {
          ...d,
          line: Math.min(newLine, tr.newDoc.lines),
        };
      });
    }
    return diagnostics;
  },
});

function toCM6Diagnostic(doc: Text, d: ExternalDiagnostic): CM6Diagnostic | null {
  if (d.line < 1 || d.line > doc.lines) {
    return null;
  }

  const line = doc.line(d.line);
  const column = Math.max(1, d.column ?? 1);
  const from = Math.min(line.from + column - 1, line.to);

  let to = from;
  if (d.endLine !== undefined && d.endLine >= 1 && d.endLine <= doc.lines) {
    const endLine = doc.line(d.endLine);
    const endColumn = Math.max(1, d.endColumn ?? 1);
    to = Math.min(endLine.from + endColumn - 1, endLine.to);
  } else if (d.endColumn !== undefined && d.column !== undefined) {
    to = Math.min(line.from + d.endColumn - 1, line.to);
  }

  if (from > to) {
    to = from;
  }

  if (from === to && from < line.to) {
    const lineText = doc.sliceString(line.from, line.to);
    const charAtPos = from - line.from;
    let wordEnd = charAtPos;
    while (wordEnd < lineText.length && /\w/.test(lineText[wordEnd])) {
      wordEnd++;
    }
    if (wordEnd > charAtPos) {
      to = line.from + wordEnd;
    } else {
      to = Math.min(from + 1, line.to);
    }
  }

  let severity: 'error' | 'warning' | 'info' = 'info';
  if (d.severity === 'error') {
    severity = 'error';
  } else if (d.severity === 'warning') {
    severity = 'warning';
  } else {
    severity = 'info';
  }

  let message = d.message;
  if (d.code) {
    message = `[${d.code}] ${message}`;
  }

  return {
    from,
    to,
    severity,
    message,
    source: d.source,
  };
}

function convertDiagnostics(doc: Text, diagnostics: ExternalDiagnostic[]): CM6Diagnostic[] {
  const result: CM6Diagnostic[] = [];
  for (const d of diagnostics) {
    const converted = toCM6Diagnostic(doc, d);
    if (converted) {
      result.push(converted);
    }
  }
  return result;
}

export function updateDiagnostics(diagnostics: ExternalDiagnostic[]): StateEffect<ExternalDiagnostic[]> {
  return updateDiagnosticsEffect.of(diagnostics);
}

export function setDiagnostics(view: EditorView, diagnostics: ExternalDiagnostic[]): void {
  const cm6Diagnostics = convertDiagnostics(view.state.doc, diagnostics);
  
  view.dispatch({
    effects: [
      updateDiagnosticsEffect.of(diagnostics),
    ],
  });
  
  view.dispatch(
    cm6SetDiagnostics(view.state, cm6Diagnostics)
  );
}

export function clearDiagnostics(view: EditorView): void {
  view.dispatch({
    effects: [clearDiagnosticsEffect.of()],
  });
  
  view.dispatch(
    cm6SetDiagnostics(view.state, [])
  );
}

export function getDiagnostics(view: EditorView): ExternalDiagnostic[] {
  return view.state.field(diagnosticsField, false) ?? [];
}

export function getDiagnosticsCount(view: EditorView): { errors: number; warnings: number; info: number } {
  const diagnostics = getDiagnostics(view);
  let errors = 0;
  let warnings = 0;
  let info = 0;
  
  for (const d of diagnostics) {
    if (d.severity === 'error') {
      errors++;
    } else if (d.severity === 'warning') {
      warnings++;
    } else {
      info++;
    }
  }
  
  return { errors, warnings, info };
}

export function getDiagnosticsAtLine(view: EditorView, line: number): ExternalDiagnostic[] {
  const diagnostics = getDiagnostics(view);
  return diagnostics.filter((d) => d.line === line);
}

export function getFirstError(view: EditorView): ExternalDiagnostic | null {
  const diagnostics = getDiagnostics(view);
  return diagnostics.find((d) => d.severity === 'error') ?? null;
}

function createExternalLintSource() {
  return linter((view) => {
    const externalDiagnostics = view.state.field(diagnosticsField, false) ?? [];
    return convertDiagnostics(view.state.doc, externalDiagnostics);
  }, {
    delay: 0,
  });
}

const diagnosticsTheme = EditorView.baseTheme({
  '.cm-lintRange': {
    backgroundImage: 'none',
  },
  '.cm-lintRange-error': {
    textDecoration: 'underline wavy #ef4444',
    textUnderlineOffset: '3px',
  },
  '.cm-lintRange-warning': {
    textDecoration: 'underline wavy #f59e0b',
    textUnderlineOffset: '3px',
  },
  '.cm-lintRange-info': {
    textDecoration: 'underline wavy #3b82f6',
    textUnderlineOffset: '3px',
  },
  '.cm-lintRange-hint': {
    textDecoration: 'underline wavy #6b7280',
    textUnderlineOffset: '3px',
  },
  '.cm-diagnostic': {
    padding: '4px 8px',
    marginLeft: '0',
    borderLeft: '3px solid',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  '.cm-diagnostic-error': {
    borderLeftColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  '.cm-diagnostic-warning': {
    borderLeftColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  '.cm-diagnostic-info': {
    borderLeftColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  '.cm-lint-marker': {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '.cm-lint-marker-error': {
    content: '"●"',
    color: '#ef4444',
  },
  '.cm-lint-marker-warning': {
    content: '"●"',
    color: '#f59e0b',
  },
  '.cm-lint-marker-info': {
    content: '"●"',
    color: '#3b82f6',
  },
  '.cm-gutter-lint': {
    width: '16px',
  },
  '.cm-lintPoint': {
    position: 'relative',
  },
  '.cm-lintPoint::after': {
    content: '""',
    position: 'absolute',
    bottom: '0',
    left: '0',
    width: '100%',
    height: '2px',
    backgroundColor: 'currentColor',
  },
  '.cm-tooltip.cm-tooltip-lint': {
    backgroundColor: 'var(--tooltip-bg, #1a1a2e)',
    color: 'var(--tooltip-fg, #e4e4e7)',
    border: '1px solid var(--tooltip-border, #2a2a4e)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    padding: '0',
    maxWidth: '400px',
    fontSize: '13px',
  },
  '.cm-panel.cm-panel-lint': {
    backgroundColor: 'var(--panel-bg, #0f0f1a)',
    borderTop: '1px solid var(--panel-border, #2a2a4e)',
    maxHeight: '200px',
    overflow: 'auto',
    padding: '8px 0',
  },
  '.cm-panel.cm-panel-lint ul': {
    margin: '0',
    padding: '0',
    listStyle: 'none',
  },
  '.cm-panel.cm-panel-lint li': {
    padding: '4px 12px',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background-color 0.15s',
  },
  '.cm-panel.cm-panel-lint li:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '.cm-panel.cm-panel-lint li[aria-selected]': {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  '.cm-panel.cm-panel-lint [name=close]': {
    position: 'absolute',
    right: '8px',
    top: '8px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
  },
  '.cm-panel.cm-panel-lint [name=close]:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const darkDiagnosticsTheme = EditorView.theme({
  '.cm-tooltip.cm-tooltip-lint': {
    '--tooltip-bg': '#1a1a2e',
    '--tooltip-fg': '#e4e4e7',
    '--tooltip-border': '#2a2a4e',
  },
  '.cm-panel.cm-panel-lint': {
    '--panel-bg': '#0f0f1a',
    '--panel-border': '#2a2a4e',
  },
}, { dark: true });

const lightDiagnosticsTheme = EditorView.theme({
  '.cm-tooltip.cm-tooltip-lint': {
    '--tooltip-bg': '#ffffff',
    '--tooltip-fg': '#1f2937',
    '--tooltip-border': '#e5e7eb',
  },
  '.cm-panel.cm-panel-lint': {
    '--panel-bg': '#f9fafb',
    '--panel-border': '#e5e7eb',
  },
}, { dark: false });

export interface DiagnosticsExtensionOptions {
  showGutter?: boolean;
  showPanel?: boolean;
  enableKeymap?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  tooltipFilter?: (diagnostics: readonly CM6Diagnostic[]) => readonly CM6Diagnostic[];
}

export function createDiagnosticsExtension(options: DiagnosticsExtensionOptions = {}): Extension {
  const {
    showGutter = true,
    enableKeymap = true,
    theme = 'dark',
  } = options;

  const extensions: Extension[] = [
    diagnosticsField,
    createExternalLintSource(),
    diagnosticsTheme,
  ];

  if (showGutter) {
    extensions.push(
      lintGutter({
        hoverTime: 300,
      })
    );
  }

  if (enableKeymap) {
    extensions.push(keymap.of(lintKeymap));
  }

  if (theme === 'dark') {
    extensions.push(darkDiagnosticsTheme);
  } else if (theme === 'light') {
    extensions.push(lightDiagnosticsTheme);
  }

  return extensions;
}

export function diagnosticsExtension(options?: DiagnosticsExtensionOptions): Extension {
  return createDiagnosticsExtension(options);
}

export function openDiagnosticsPanel(view: EditorView): boolean {
  return openLintPanel(view);
}

export function closeDiagnosticsPanel(view: EditorView): boolean {
  return closeLintPanel(view);
}

export function refreshDiagnostics(view: EditorView): void {
  forceLinting(view);
}

export function goToNextDiagnostic(view: EditorView): boolean {
  const diagnostics = getDiagnostics(view);
  if (diagnostics.length === 0) return false;

  const cursor = view.state.selection.main.head;
  const cursorLine = view.state.doc.lineAt(cursor).number;

  const sorted = [...diagnostics].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return (a.column ?? 1) - (b.column ?? 1);
  });

  let next = sorted.find((d) => {
    if (d.line > cursorLine) return true;
    if (d.line === cursorLine) {
      const lineStart = view.state.doc.line(d.line).from;
      const diagPos = lineStart + (d.column ?? 1) - 1;
      return diagPos > cursor;
    }
    return false;
  });

  if (!next) {
    next = sorted[0];
  }

  if (next) {
    const line = view.state.doc.line(next.line);
    const pos = line.from + (next.column ?? 1) - 1;
    view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

export function goToPreviousDiagnostic(view: EditorView): boolean {
  const diagnostics = getDiagnostics(view);
  if (diagnostics.length === 0) return false;

  const cursor = view.state.selection.main.head;
  const cursorLine = view.state.doc.lineAt(cursor).number;

  const sorted = [...diagnostics].sort((a, b) => {
    if (b.line !== a.line) return b.line - a.line;
    return (b.column ?? 1) - (a.column ?? 1);
  });

  let prev = sorted.find((d) => {
    if (d.line < cursorLine) return true;
    if (d.line === cursorLine) {
      const lineStart = view.state.doc.line(d.line).from;
      const diagPos = lineStart + (d.column ?? 1) - 1;
      return diagPos < cursor;
    }
    return false;
  });

  if (!prev) {
    prev = sorted[0];
  }

  if (prev) {
    const line = view.state.doc.line(prev.line);
    const pos = line.from + (prev.column ?? 1) - 1;
    view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

export function filterDiagnosticsBySeverity(
  diagnostics: ExternalDiagnostic[],
  severity: DiagnosticSeverity | DiagnosticSeverity[]
): ExternalDiagnostic[] {
  const severities = Array.isArray(severity) ? severity : [severity];
  return diagnostics.filter((d) => severities.includes(d.severity));
}

export function filterDiagnosticsBySource(
  diagnostics: ExternalDiagnostic[],
  source: string | string[]
): ExternalDiagnostic[] {
  const sources = Array.isArray(source) ? source : [source];
  return diagnostics.filter((d) => d.source && sources.includes(d.source));
}

export function mergeDiagnostics(...diagnosticArrays: ExternalDiagnostic[][]): ExternalDiagnostic[] {
  const merged: ExternalDiagnostic[] = [];
  const seen = new Set<string>();

  for (const arr of diagnosticArrays) {
    for (const d of arr) {
      const key = `${d.line}:${d.column ?? 0}:${d.message}:${d.source ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(d);
      }
    }
  }

  return merged.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return (a.column ?? 1) - (b.column ?? 1);
  });
}

export function createDiagnostic(
  line: number,
  message: string,
  severity: DiagnosticSeverity = 'error',
  options: Partial<ExternalDiagnostic> = {}
): ExternalDiagnostic {
  return {
    line,
    message,
    severity,
    ...options,
  };
}

export function createErrorDiagnostic(
  line: number,
  message: string,
  options: Partial<ExternalDiagnostic> = {}
): ExternalDiagnostic {
  return createDiagnostic(line, message, 'error', options);
}

export function createWarningDiagnostic(
  line: number,
  message: string,
  options: Partial<ExternalDiagnostic> = {}
): ExternalDiagnostic {
  return createDiagnostic(line, message, 'warning', options);
}

export function createInfoDiagnostic(
  line: number,
  message: string,
  options: Partial<ExternalDiagnostic> = {}
): ExternalDiagnostic {
  return createDiagnostic(line, message, 'info', options);
}

export {
  updateDiagnosticsEffect,
  clearDiagnosticsEffect,
  lintKeymap,
};
