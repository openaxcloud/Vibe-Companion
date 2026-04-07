// @ts-nocheck
import { Extension } from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
  EditorView,
  placeholder,
} from '@codemirror/view';
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language';
import {
  history,
  defaultKeymap,
  historyKeymap,
} from '@codemirror/commands';
import {
  highlightSelectionMatches,
  searchKeymap,
} from '@codemirror/search';
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';

const getLineNumberExtension = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  if (isMobile) {
    return []; // No line numbers on mobile
  }
  return lineNumbers();
};

export function getBaseExtensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
  ];
}

export function getReadOnlyExtensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    foldGutter(),
    drawSelection(),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...searchKeymap,
      ...foldKeymap,
    ]),
  ];
}

export function getMobileExtensions(): Extension[] {
  return [
    ...getLineNumberExtension(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter({
      markerDOM: (open) => {
        const marker = document.createElement('span');
        marker.className = 'cm-foldGutter-marker';
        marker.textContent = open ? '▼' : '▶';
        marker.style.padding = '0 8px';
        marker.style.fontSize = '12px';
        marker.style.cursor = 'pointer';
        return marker;
      },
    }),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 5,
    }),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorView.theme({
      '&': {
        fontSize: '16px',
        touchAction: 'manipulation',
      },
      '.cm-content': {
        minHeight: '100%',
        padding: '12px 0',
      },
      '.cm-gutters': {
        minWidth: '48px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 12px',
        minWidth: '48px',
      },
      '.cm-foldGutter .cm-gutterElement': {
        padding: '0 8px',
        minWidth: '32px',
      },
      '.cm-line': {
        padding: '2px 12px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      },
      '.cm-tooltip': {
        fontSize: '14px',
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        maxHeight: '200px',
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
        padding: '8px 16px',
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
      },
    }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
  ];
}

export function getMinimalExtensions(): Extension[] {
  return [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
    ]),
  ];
}

export interface EditorExtensionOptions {
  readOnly?: boolean;
  mobile?: boolean;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  tabSize?: number;
  placeholder?: string;
}

export function getConfigurableExtensions(options: EditorExtensionOptions = {}): Extension[] {
  const extensions: Extension[] = [];

  if (options.readOnly) {
    return getReadOnlyExtensions();
  }

  if (options.mobile) {
    return getMobileExtensions();
  }

  if (options.lineNumbers !== false) {
    extensions.push(lineNumbers());
    extensions.push(highlightActiveLineGutter());
  }

  extensions.push(
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
  );

  if (options.lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  if (options.tabSize !== undefined) {
    extensions.push(EditorState.tabSize.of(options.tabSize));
  }

  if (options.placeholder) {
    extensions.push(placeholder(options.placeholder));
  }

  extensions.push(
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
  );

  return extensions;
}
