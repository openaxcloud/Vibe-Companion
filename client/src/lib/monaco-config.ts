// Monaco Editor Configuration and Worker Setup
self.MonacoEnvironment = {
  getWorker: function (_: any, label: string) {
    if (label === 'json') {
      return new Worker(
        new URL(
          'monaco-editor/esm/vs/language/json/json.worker?worker',
          import.meta.url
        ),
        { type: 'module' }
      );
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(
        new URL(
          'monaco-editor/esm/vs/language/css/css.worker?worker',
          import.meta.url
        ),
        { type: 'module' }
      );
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(
        new URL(
          'monaco-editor/esm/vs/language/html/html.worker?worker',
          import.meta.url
        ),
        { type: 'module' }
      );
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(
        new URL(
          'monaco-editor/esm/vs/language/typescript/ts.worker?worker',
          import.meta.url
        ),
        { type: 'module' }
      );
    }
    return new Worker(
      new URL(
        'monaco-editor/esm/vs/editor/editor.worker?worker',
        import.meta.url
      ),
      { type: 'module' }
    );
  }
};

// Configure Monaco settings
export const configureMonaco = () => {
  // Additional Monaco configurations can be added here
  console.log('Monaco Editor configured');
};