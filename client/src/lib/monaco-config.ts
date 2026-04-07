// Monaco Editor Configuration and Worker Setup
// Use CDN for production-ready worker loading
const MONACO_VERSION = '0.52.2';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

// Configure Monaco environment to use CDN workers
(self as any).MonacoEnvironment = {
  getWorkerUrl: function(moduleId: string, label: string) {
    if (label === 'json') {
      return `${CDN_BASE}/language/json/json.worker.js`;
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return `${CDN_BASE}/language/css/css.worker.js`;
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return `${CDN_BASE}/language/html/html.worker.js`;
    }
    if (label === 'typescript' || label === 'javascript') {
      return `${CDN_BASE}/language/typescript/ts.worker.js`;
    }
    return `${CDN_BASE}/editor/editor.worker.js`;
  }
};

// Configure Monaco settings
export const configureMonaco = () => {
  // Additional Monaco configurations can be added here
};