import * as monaco from 'monaco-editor';

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
    }
  });
}