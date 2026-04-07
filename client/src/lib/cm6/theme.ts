import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const replitColors = {
  dark: {
    background: '#0E1525',
    foreground: '#F5F9FC',
    gutterBackground: '#0A0F1A',
    gutterForeground: '#5C6370',
    lineNumbers: '#636D83',
    selection: '#264F78',
    selectionMatch: '#264F7850',
    cursor: '#FFFFFF',
    activeLine: '#1A2235',
    activeLineGutter: '#141C2E',
    matchingBracket: '#3A4556',
    border: '#1E293B',
    tooltip: '#1A2235',
    tooltipBorder: '#2D3748',
    foldPlaceholder: '#4B5563',
    searchMatch: '#FFC107',
    searchMatchSelected: '#FF9800',
  },
  light: {
    background: '#FFFFFF',
    foreground: '#1C2333',
    gutterBackground: '#F8FAFC',
    gutterForeground: '#94A3B8',
    lineNumbers: '#94A3B8',
    selection: '#ACCEF7',
    selectionMatch: '#ACCEF750',
    cursor: '#1C2333',
    activeLine: '#F1F5F9',
    activeLineGutter: '#EEF2F6',
    matchingBracket: '#D1E3F6',
    border: '#E2E8F0',
    tooltip: '#FFFFFF',
    tooltipBorder: '#E2E8F0',
    foldPlaceholder: '#94A3B8',
    searchMatch: '#FFC107',
    searchMatchSelected: '#FF9800',
  },
};

const syntaxColors = {
  dark: {
    keyword: '#FF6D6D',
    string: '#87D37C',
    comment: '#5C6370',
    function: '#61AFEF',
    number: '#D19A66',
    type: '#E5C07B',
    operator: '#56B6C2',
    variable: '#E06C75',
    property: '#ABB2BF',
    className: '#E5C07B',
    constant: '#D19A66',
    regexp: '#87D37C',
    punctuation: '#ABB2BF',
    tag: '#E06C75',
    attribute: '#D19A66',
    meta: '#61AFEF',
    invalid: '#FF5555',
    link: '#61AFEF',
    heading: '#E06C75',
    strong: '#D19A66',
    emphasis: '#C678DD',
  },
  light: {
    keyword: '#D73A49',
    string: '#22863A',
    comment: '#6A737D',
    function: '#005CC5',
    number: '#E36209',
    type: '#B08800',
    operator: '#0550AE',
    variable: '#E36209',
    property: '#24292E',
    className: '#B08800',
    constant: '#005CC5',
    regexp: '#22863A',
    punctuation: '#24292E',
    tag: '#22863A',
    attribute: '#E36209',
    meta: '#005CC5',
    invalid: '#D73A49',
    link: '#005CC5',
    heading: '#005CC5',
    strong: '#24292E',
    emphasis: '#6F42C1',
  },
};

const fontFamily = '"IBM Plex Mono", "Fira Code", "Consolas", "Monaco", monospace';

export const replitDarkTheme = EditorView.theme(
  {
    '&': {
      color: replitColors.dark.foreground,
      backgroundColor: replitColors.dark.background,
      fontFamily,
      fontSize: '14px',
      lineHeight: '1.6',
    },
    '.cm-content': {
      caretColor: replitColors.dark.cursor,
      fontFamily,
      padding: '8px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: replitColors.dark.cursor,
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: replitColors.dark.cursor,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: replitColors.dark.selection,
      },
    '.cm-selectionMatch': {
      backgroundColor: replitColors.dark.selectionMatch,
    },
    '.cm-activeLine': {
      backgroundColor: replitColors.dark.activeLine,
    },
    '.cm-activeLineGutter': {
      backgroundColor: replitColors.dark.activeLineGutter,
    },
    '.cm-gutters': {
      backgroundColor: replitColors.dark.gutterBackground,
      color: replitColors.dark.gutterForeground,
      border: 'none',
      borderRight: `1px solid ${replitColors.dark.border}`,
      paddingRight: '4px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: replitColors.dark.lineNumbers,
      padding: '0 8px 0 12px',
      minWidth: '40px',
      fontFamily,
      fontSize: '12px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
      cursor: 'pointer',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      color: replitColors.dark.foldPlaceholder,
      border: `1px dashed ${replitColors.dark.border}`,
      borderRadius: '4px',
      padding: '0 4px',
      margin: '0 4px',
    },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: replitColors.dark.matchingBracket,
      outline: `1px solid ${replitColors.dark.selection}`,
      borderRadius: '2px',
    },
    '&.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#FF555550',
      outline: '1px solid #FF5555',
      borderRadius: '2px',
    },
    '.cm-searchMatch': {
      backgroundColor: `${replitColors.dark.searchMatch}40`,
      outline: `1px solid ${replitColors.dark.searchMatch}`,
      borderRadius: '2px',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: `${replitColors.dark.searchMatchSelected}60`,
      outline: `1px solid ${replitColors.dark.searchMatchSelected}`,
    },
    '.cm-tooltip': {
      backgroundColor: replitColors.dark.tooltip,
      border: `1px solid ${replitColors.dark.tooltipBorder}`,
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      '& > ul': {
        fontFamily,
        fontSize: '13px',
        maxHeight: '300px',
      },
      '& > ul > li': {
        padding: '4px 12px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: replitColors.dark.selection,
        color: replitColors.dark.foreground,
      },
    },
    '.cm-tooltip-hover': {
      padding: '8px 12px',
    },
    '.cm-panels': {
      backgroundColor: replitColors.dark.gutterBackground,
      color: replitColors.dark.foreground,
      borderTop: `1px solid ${replitColors.dark.border}`,
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${replitColors.dark.border}`,
      borderTop: 'none',
    },
    '.cm-panel.cm-search': {
      padding: '8px 12px',
    },
    '.cm-panel.cm-search input, .cm-panel.cm-search button': {
      fontFamily,
      fontSize: '13px',
      padding: '4px 8px',
      borderRadius: '4px',
      border: `1px solid ${replitColors.dark.border}`,
      backgroundColor: replitColors.dark.background,
      color: replitColors.dark.foreground,
    },
    '.cm-panel.cm-search button:hover': {
      backgroundColor: replitColors.dark.activeLine,
    },
    '.cm-panel.cm-search [name=close]': {
      position: 'absolute',
      right: '8px',
      top: '8px',
    },
    '.cm-scroller': {
      fontFamily,
      overflow: 'auto',
    },
    '.cm-line': {
      padding: '0 8px',
    },
    '.cm-placeholder': {
      color: replitColors.dark.gutterForeground,
      fontStyle: 'italic',
    },
  },
  { dark: true }
);

export const replitLightTheme = EditorView.theme(
  {
    '&': {
      color: replitColors.light.foreground,
      backgroundColor: replitColors.light.background,
      fontFamily,
      fontSize: '14px',
      lineHeight: '1.6',
    },
    '.cm-content': {
      caretColor: replitColors.light.cursor,
      fontFamily,
      padding: '8px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: replitColors.light.cursor,
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: replitColors.light.cursor,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: replitColors.light.selection,
      },
    '.cm-selectionMatch': {
      backgroundColor: replitColors.light.selectionMatch,
    },
    '.cm-activeLine': {
      backgroundColor: replitColors.light.activeLine,
    },
    '.cm-activeLineGutter': {
      backgroundColor: replitColors.light.activeLineGutter,
    },
    '.cm-gutters': {
      backgroundColor: replitColors.light.gutterBackground,
      color: replitColors.light.gutterForeground,
      border: 'none',
      borderRight: `1px solid ${replitColors.light.border}`,
      paddingRight: '4px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: replitColors.light.lineNumbers,
      padding: '0 8px 0 12px',
      minWidth: '40px',
      fontFamily,
      fontSize: '12px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
      cursor: 'pointer',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      color: replitColors.light.foldPlaceholder,
      border: `1px dashed ${replitColors.light.border}`,
      borderRadius: '4px',
      padding: '0 4px',
      margin: '0 4px',
    },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: replitColors.light.matchingBracket,
      outline: `1px solid ${replitColors.light.selection}`,
      borderRadius: '2px',
    },
    '&.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#D73A4950',
      outline: '1px solid #D73A49',
      borderRadius: '2px',
    },
    '.cm-searchMatch': {
      backgroundColor: `${replitColors.light.searchMatch}40`,
      outline: `1px solid ${replitColors.light.searchMatch}`,
      borderRadius: '2px',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: `${replitColors.light.searchMatchSelected}60`,
      outline: `1px solid ${replitColors.light.searchMatchSelected}`,
    },
    '.cm-tooltip': {
      backgroundColor: replitColors.light.tooltip,
      border: `1px solid ${replitColors.light.tooltipBorder}`,
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      '& > ul': {
        fontFamily,
        fontSize: '13px',
        maxHeight: '300px',
      },
      '& > ul > li': {
        padding: '4px 12px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: replitColors.light.selection,
        color: replitColors.light.foreground,
      },
    },
    '.cm-tooltip-hover': {
      padding: '8px 12px',
    },
    '.cm-panels': {
      backgroundColor: replitColors.light.gutterBackground,
      color: replitColors.light.foreground,
      borderTop: `1px solid ${replitColors.light.border}`,
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${replitColors.light.border}`,
      borderTop: 'none',
    },
    '.cm-panel.cm-search': {
      padding: '8px 12px',
    },
    '.cm-panel.cm-search input, .cm-panel.cm-search button': {
      fontFamily,
      fontSize: '13px',
      padding: '4px 8px',
      borderRadius: '4px',
      border: `1px solid ${replitColors.light.border}`,
      backgroundColor: replitColors.light.background,
      color: replitColors.light.foreground,
    },
    '.cm-panel.cm-search button:hover': {
      backgroundColor: replitColors.light.activeLine,
    },
    '.cm-panel.cm-search [name=close]': {
      position: 'absolute',
      right: '8px',
      top: '8px',
    },
    '.cm-scroller': {
      fontFamily,
      overflow: 'auto',
    },
    '.cm-line': {
      padding: '0 8px',
    },
    '.cm-placeholder': {
      color: replitColors.light.gutterForeground,
      fontStyle: 'italic',
    },
  },
  { dark: false }
);

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: syntaxColors.dark.keyword, fontWeight: '500' },
  { tag: tags.controlKeyword, color: syntaxColors.dark.keyword, fontWeight: '500' },
  { tag: tags.operatorKeyword, color: syntaxColors.dark.keyword },
  { tag: tags.definitionKeyword, color: syntaxColors.dark.keyword },
  { tag: tags.moduleKeyword, color: syntaxColors.dark.keyword },
  { tag: tags.string, color: syntaxColors.dark.string },
  { tag: tags.special(tags.string), color: syntaxColors.dark.regexp },
  { tag: tags.regexp, color: syntaxColors.dark.regexp },
  { tag: tags.escape, color: syntaxColors.dark.operator },
  { tag: tags.comment, color: syntaxColors.dark.comment, fontStyle: 'italic' },
  { tag: tags.lineComment, color: syntaxColors.dark.comment, fontStyle: 'italic' },
  { tag: tags.blockComment, color: syntaxColors.dark.comment, fontStyle: 'italic' },
  { tag: tags.docComment, color: syntaxColors.dark.comment, fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: syntaxColors.dark.function },
  { tag: tags.function(tags.propertyName), color: syntaxColors.dark.function },
  { tag: tags.definition(tags.function(tags.variableName)), color: syntaxColors.dark.function },
  { tag: tags.number, color: syntaxColors.dark.number },
  { tag: tags.integer, color: syntaxColors.dark.number },
  { tag: tags.float, color: syntaxColors.dark.number },
  { tag: tags.typeName, color: syntaxColors.dark.type },
  { tag: tags.typeOperator, color: syntaxColors.dark.operator },
  { tag: tags.namespace, color: syntaxColors.dark.type },
  { tag: tags.className, color: syntaxColors.dark.className },
  { tag: tags.operator, color: syntaxColors.dark.operator },
  { tag: tags.arithmeticOperator, color: syntaxColors.dark.operator },
  { tag: tags.logicOperator, color: syntaxColors.dark.operator },
  { tag: tags.bitwiseOperator, color: syntaxColors.dark.operator },
  { tag: tags.compareOperator, color: syntaxColors.dark.operator },
  { tag: tags.updateOperator, color: syntaxColors.dark.operator },
  { tag: tags.variableName, color: syntaxColors.dark.variable },
  { tag: tags.definition(tags.variableName), color: syntaxColors.dark.variable },
  { tag: tags.propertyName, color: syntaxColors.dark.property },
  { tag: tags.definition(tags.propertyName), color: syntaxColors.dark.property },
  { tag: tags.constant(tags.variableName), color: syntaxColors.dark.constant },
  { tag: tags.bool, color: syntaxColors.dark.constant },
  { tag: tags.null, color: syntaxColors.dark.constant },
  { tag: tags.self, color: syntaxColors.dark.keyword },
  { tag: tags.atom, color: syntaxColors.dark.constant },
  { tag: tags.punctuation, color: syntaxColors.dark.punctuation },
  { tag: tags.separator, color: syntaxColors.dark.punctuation },
  { tag: tags.bracket, color: syntaxColors.dark.punctuation },
  { tag: tags.angleBracket, color: syntaxColors.dark.punctuation },
  { tag: tags.squareBracket, color: syntaxColors.dark.punctuation },
  { tag: tags.paren, color: syntaxColors.dark.punctuation },
  { tag: tags.brace, color: syntaxColors.dark.punctuation },
  { tag: tags.tagName, color: syntaxColors.dark.tag },
  { tag: tags.attributeName, color: syntaxColors.dark.attribute },
  { tag: tags.attributeValue, color: syntaxColors.dark.string },
  { tag: tags.meta, color: syntaxColors.dark.meta },
  { tag: tags.processingInstruction, color: syntaxColors.dark.meta },
  { tag: tags.invalid, color: syntaxColors.dark.invalid, textDecoration: 'underline wavy' },
  { tag: tags.link, color: syntaxColors.dark.link, textDecoration: 'underline' },
  { tag: tags.url, color: syntaxColors.dark.link, textDecoration: 'underline' },
  { tag: tags.heading, color: syntaxColors.dark.heading, fontWeight: 'bold' },
  { tag: tags.heading1, color: syntaxColors.dark.heading, fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading2, color: syntaxColors.dark.heading, fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading3, color: syntaxColors.dark.heading, fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.strong, color: syntaxColors.dark.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, color: syntaxColors.dark.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.labelName, color: syntaxColors.dark.function },
  { tag: tags.macroName, color: syntaxColors.dark.function },
  { tag: tags.inserted, color: syntaxColors.dark.string, backgroundColor: '#22863A20' },
  { tag: tags.deleted, color: syntaxColors.dark.keyword, backgroundColor: '#D73A4920' },
  { tag: tags.changed, color: syntaxColors.dark.type, backgroundColor: '#B0880020' },
]);

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: syntaxColors.light.keyword, fontWeight: '500' },
  { tag: tags.controlKeyword, color: syntaxColors.light.keyword, fontWeight: '500' },
  { tag: tags.operatorKeyword, color: syntaxColors.light.keyword },
  { tag: tags.definitionKeyword, color: syntaxColors.light.keyword },
  { tag: tags.moduleKeyword, color: syntaxColors.light.keyword },
  { tag: tags.string, color: syntaxColors.light.string },
  { tag: tags.special(tags.string), color: syntaxColors.light.regexp },
  { tag: tags.regexp, color: syntaxColors.light.regexp },
  { tag: tags.escape, color: syntaxColors.light.operator },
  { tag: tags.comment, color: syntaxColors.light.comment, fontStyle: 'italic' },
  { tag: tags.lineComment, color: syntaxColors.light.comment, fontStyle: 'italic' },
  { tag: tags.blockComment, color: syntaxColors.light.comment, fontStyle: 'italic' },
  { tag: tags.docComment, color: syntaxColors.light.comment, fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: syntaxColors.light.function },
  { tag: tags.function(tags.propertyName), color: syntaxColors.light.function },
  { tag: tags.definition(tags.function(tags.variableName)), color: syntaxColors.light.function },
  { tag: tags.number, color: syntaxColors.light.number },
  { tag: tags.integer, color: syntaxColors.light.number },
  { tag: tags.float, color: syntaxColors.light.number },
  { tag: tags.typeName, color: syntaxColors.light.type },
  { tag: tags.typeOperator, color: syntaxColors.light.operator },
  { tag: tags.namespace, color: syntaxColors.light.type },
  { tag: tags.className, color: syntaxColors.light.className },
  { tag: tags.operator, color: syntaxColors.light.operator },
  { tag: tags.arithmeticOperator, color: syntaxColors.light.operator },
  { tag: tags.logicOperator, color: syntaxColors.light.operator },
  { tag: tags.bitwiseOperator, color: syntaxColors.light.operator },
  { tag: tags.compareOperator, color: syntaxColors.light.operator },
  { tag: tags.updateOperator, color: syntaxColors.light.operator },
  { tag: tags.variableName, color: syntaxColors.light.variable },
  { tag: tags.definition(tags.variableName), color: syntaxColors.light.variable },
  { tag: tags.propertyName, color: syntaxColors.light.property },
  { tag: tags.definition(tags.propertyName), color: syntaxColors.light.property },
  { tag: tags.constant(tags.variableName), color: syntaxColors.light.constant },
  { tag: tags.bool, color: syntaxColors.light.constant },
  { tag: tags.null, color: syntaxColors.light.constant },
  { tag: tags.self, color: syntaxColors.light.keyword },
  { tag: tags.atom, color: syntaxColors.light.constant },
  { tag: tags.punctuation, color: syntaxColors.light.punctuation },
  { tag: tags.separator, color: syntaxColors.light.punctuation },
  { tag: tags.bracket, color: syntaxColors.light.punctuation },
  { tag: tags.angleBracket, color: syntaxColors.light.punctuation },
  { tag: tags.squareBracket, color: syntaxColors.light.punctuation },
  { tag: tags.paren, color: syntaxColors.light.punctuation },
  { tag: tags.brace, color: syntaxColors.light.punctuation },
  { tag: tags.tagName, color: syntaxColors.light.tag },
  { tag: tags.attributeName, color: syntaxColors.light.attribute },
  { tag: tags.attributeValue, color: syntaxColors.light.string },
  { tag: tags.meta, color: syntaxColors.light.meta },
  { tag: tags.processingInstruction, color: syntaxColors.light.meta },
  { tag: tags.invalid, color: syntaxColors.light.invalid, textDecoration: 'underline wavy' },
  { tag: tags.link, color: syntaxColors.light.link, textDecoration: 'underline' },
  { tag: tags.url, color: syntaxColors.light.link, textDecoration: 'underline' },
  { tag: tags.heading, color: syntaxColors.light.heading, fontWeight: 'bold' },
  { tag: tags.heading1, color: syntaxColors.light.heading, fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading2, color: syntaxColors.light.heading, fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading3, color: syntaxColors.light.heading, fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.strong, color: syntaxColors.light.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, color: syntaxColors.light.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.labelName, color: syntaxColors.light.function },
  { tag: tags.macroName, color: syntaxColors.light.function },
  { tag: tags.inserted, color: syntaxColors.light.string, backgroundColor: '#22863A20' },
  { tag: tags.deleted, color: syntaxColors.light.keyword, backgroundColor: '#D73A4920' },
  { tag: tags.changed, color: syntaxColors.light.type, backgroundColor: '#B0880020' },
]);

export const replitDarkHighlighting = syntaxHighlighting(darkHighlightStyle);
export const replitLightHighlighting = syntaxHighlighting(lightHighlightStyle);

export function getTheme(isDark: boolean): Extension[] {
  if (isDark) {
    return [replitDarkTheme, replitDarkHighlighting];
  }
  return [replitLightTheme, replitLightHighlighting];
}

export { replitColors, syntaxColors, fontFamily };
