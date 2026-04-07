// @ts-nocheck
import React from 'react';
import { SplitsEditorLayout } from './SplitsEditorLayout';
import { File } from '@shared/schema';

// Demo files for testing
const demoFiles: File[] = [
  { id: 1, name: 'index.tsx', path: 'src/index.tsx', content: '// Main file', isDirectory: false, parentId: null, projectId: 1 },
  { id: 2, name: 'App.tsx', path: 'src/App.tsx', content: '// App component', isDirectory: false, parentId: null, projectId: 1 },
  { id: 3, name: 'components', path: 'src/components', content: '', isDirectory: true, parentId: null, projectId: 1 },
  { id: 4, name: 'Button.tsx', path: 'src/components/Button.tsx', content: '// Button component', isDirectory: false, parentId: 3, projectId: 1 },
];

export function SplitsDemoPage() {
  const handleFileSelect = (file: File) => {
  };

  const handleFileCreate = (name: string, isFolder: boolean, parentId?: number) => {
  };

  const handleFileDelete = (fileId: number) => {
  };

  const handleFileRename = (fileId: number, newName: string) => {
  };

  // Demo content for panels
  const editorContent = (
    <div className="w-full h-full bg-gray-900 text-gray-100 p-4 font-mono">
      <pre>{`// Welcome to the Splits Editor!
// Try dragging tabs between panes
// Right-click panes for more options
// Drag files from the file tree to open them

function App() {
  return (
    <div>
      <h1>Hello, Splits!</h1>
      <p>This is a demo of the Replit-style Splits layout system.</p>
    </div>
  );
}`}</pre>
    </div>
  );

  const terminalContent = (
    <div className="w-full h-full bg-black text-green-400 p-4 font-mono">
      <div>$ npm run dev</div>
      <div>Server running at https://your-project.e-code.ai</div>
      <div>✓ Ready in 2.3s</div>
      <div className="animate-pulse">▊</div>
    </div>
  );

  const previewContent = (
    <div className="w-full h-full bg-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Preview</h1>
        <p className="text-gray-600 mb-4">
          This is the preview pane. Your application would render here.
        </p>
        <div className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Features:</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Drag and drop tabs between panes</li>
            <li>Split panes horizontally or vertically</li>
            <li>Float panes outside the layout</li>
            <li>Resize panes with draggable handles</li>
            <li>Persist layout to localStorage</li>
            <li>Smooth animations and transitions</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const consoleContent = (
    <div className="w-full h-full bg-gray-900 text-gray-100 p-4 font-mono">
      <div className="text-blue-400">[Info] Application started</div>
      <div className="text-yellow-400">[Warning] Using development build</div>
      <div className="text-gray-400">[Debug] Layout initialized</div>
      <div className="text-green-400">[Success] Connected to server</div>
    </div>
  );

  return (
    <div className="w-full h-screen">
      <SplitsEditorLayout
        files={demoFiles}
        activeFileId={1}
        onFileSelect={handleFileSelect}
        onFileCreate={handleFileCreate}
        onFileDelete={handleFileDelete}
        onFileRename={handleFileRename}
        projectName="Demo Project"
        projectId="demo-1"
        editorContent={editorContent}
        terminalContent={terminalContent}
        previewContent={previewContent}
        consoleContent={consoleContent}
      />
    </div>
  );
}