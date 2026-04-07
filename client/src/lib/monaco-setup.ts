import * as monaco from 'monaco-editor';

export interface EditorOptions {
  theme?: string;
  fontSize?: number;
  lineHeight?: number;
  tabSize?: number;
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap?: boolean;
  bracketPairColorization?: boolean;
  formatOnPaste?: boolean;
  formatOnType?: boolean;
  autoIndent?: 'none' | 'keep' | 'brackets' | 'advanced' | 'full';
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
  renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
  autoClosingBrackets?: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
  matchBrackets?: 'never' | 'always' | 'near';
  suggest?: boolean;
}

const defaultEditorOptions: EditorOptions = {
  theme: 'replitDark',
  fontSize: 14,
  lineHeight: 21,
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  bracketPairColorization: true,
  formatOnPaste: true,
  formatOnType: true,
  autoIndent: 'full',
  lineNumbers: 'on',
  renderWhitespace: 'selection',
  autoClosingBrackets: 'always',
  matchBrackets: 'always',
  suggest: true,
};

export function getMonacoEditorOptions(options?: Partial<EditorOptions>): monaco.editor.IStandaloneEditorConstructionOptions {
  const mergedOptions = { ...defaultEditorOptions, ...options };

  return {
    value: '',
    language: 'javascript',
    theme: mergedOptions.theme,
    automaticLayout: true,
    minimap: {
      enabled: mergedOptions.minimap,
    },
    fontSize: mergedOptions.fontSize,
    lineHeight: mergedOptions.lineHeight,
    tabSize: mergedOptions.tabSize,
    insertSpaces: true,
    wordWrap: mergedOptions.wordWrap,
    scrollBeyondLastLine: false,
    padding: {
      top: 10,
      bottom: 10,
    },
    bracketPairColorization: {
      enabled: mergedOptions.bracketPairColorization,
    },
    formatOnPaste: mergedOptions.formatOnPaste,
    formatOnType: mergedOptions.formatOnType,
    autoIndent: mergedOptions.autoIndent,
    lineNumbers: mergedOptions.lineNumbers,
    renderWhitespace: mergedOptions.renderWhitespace,
    autoClosingBrackets: mergedOptions.autoClosingBrackets,
    matchBrackets: mergedOptions.matchBrackets,
    quickSuggestions: mergedOptions.suggest,
    suggestOnTriggerCharacters: mergedOptions.suggest,
    folding: true,
    find: {
      addExtraSpaceOnTop: false,
      autoFindInSelection: 'always',
      seedSearchStringFromSelection: 'always'
    },
    renderLineHighlight: 'all',
    occurrencesHighlight: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    guides: {
      indentation: true,
      bracketPairsHorizontal: 'active',
      highlightActiveIndentation: true,
    },
  };
}

// Define snippets for different languages
export function registerSnippets() {
  // JavaScript/TypeScript snippets
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model, position) => {
      const suggestions = [
        {
          label: 'console.log',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'console.log($1);',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Console log statement',
          documentation: 'Log output to the console'
        },
        {
          label: 'function',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Function declaration',
          documentation: 'Creates a function declaration'
        },
        {
          label: 'arrow',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '(${1:params}) => {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Arrow function',
          documentation: 'Creates an arrow function'
        },
        {
          label: 'ifelse',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'If-Else statement',
          documentation: 'Creates an if-else statement'
        },
        {
          label: 'forloop',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'For loop',
          documentation: 'Creates a for loop'
        },
        {
          label: 'import',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'import { $2 } from "$1";',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Import statement',
          documentation: 'ES6 import statement'
        },
      ];
      return { suggestions };
    }
  });
  
  // Register snippets for TypeScript
  monaco.languages.registerCompletionItemProvider('typescript', {
    provideCompletionItems: (model, position) => {
      const suggestions = [
        {
          label: 'interface',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'interface ${1:Name} {\n\t${2:property}: ${3:type};\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Interface declaration',
          documentation: 'Creates a TypeScript interface'
        },
        {
          label: 'type',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'type ${1:Name} = {\n\t${2:property}: ${3:type};\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Type declaration',
          documentation: 'Creates a TypeScript type alias'
        },
        {
          label: 'enum',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'enum ${1:Name} {\n\t${2:Member1},\n\t${3:Member2},\n\t$0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Enum declaration',
          documentation: 'Creates a TypeScript enum'
        },
      ];
      return { suggestions };
    }
  });
  
  // HTML snippets
  monaco.languages.registerCompletionItemProvider('html', {
    provideCompletionItems: (model, position) => {
      const suggestions = [
        {
          label: 'div',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '<div class="$1">\n\t$0\n</div>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Div element',
          documentation: 'Creates a div element with a class'
        },
        {
          label: 'html5',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>$1</title>\n</head>\n<body>\n\t$0\n</body>\n</html>',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'HTML5 boilerplate',
          documentation: 'Creates a basic HTML5 document structure'
        },
      ];
      return { suggestions };
    }
  });
}

export function setupMonacoTheme() {
  // Define the Replit dark theme
  monaco.editor.defineTheme('replitDark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'operator', foreground: 'D4D4D4' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#2D2D30',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorCursor.foreground': '#AEAFAD',
      'editorWhitespace.foreground': '#404040',
      'editorIndentGuide.background': '#404040',
      'editor.selectionHighlightBorder': '#222222',
      'editorError.foreground': '#F14C4C',
      'editorWarning.foreground': '#CCA700',
      'editorInfo.foreground': '#3794FF',
      'editorHint.foreground': '#6C9EFF',
    }
  });

  // Define the Replit light theme
  monaco.editor.defineTheme('replitLight', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
      { token: 'operator', foreground: '000000' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F7F7F7',
      'editor.selectionBackground': '#ADD6FF',
      'editor.inactiveSelectionBackground': '#E5EBF1',
      'editorCursor.foreground': '#000000',
      'editorWhitespace.foreground': '#BFBFBF',
      'editorIndentGuide.background': '#D3D3D3',
      'editor.selectionHighlightBorder': '#EEEEEE',
      'editorError.foreground': '#E51400',
      'editorWarning.foreground': '#E9A700',
      'editorInfo.foreground': '#75BEFF',
      'editorHint.foreground': '#6C9EFF',
    }
  });
  
  // Register code snippets
  registerSnippets();
}