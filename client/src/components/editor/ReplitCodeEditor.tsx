import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { File } from '@shared/schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';

interface EditorTab {
  fileId: number;
  fileName: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface ReplitCodeEditorProps {
  files: File[];
  activeFile?: File;
  onFileUpdate: (fileId: number, content: string) => void;
  className?: string;
}

function getLanguageFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    r: 'r',
    m: 'matlab',
    lua: 'lua',
    sh: 'shell',
    bash: 'shell',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    gitignore: 'gitignore',
  };
  
  return languageMap[extension || ''] || 'plaintext';
}

export function ReplitCodeEditor({ 
  files, 
  activeFile, 
  onFileUpdate,
  className 
}: ReplitCodeEditorProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const editorRef = useRef<any>(null);

  // Open file in new tab or activate existing tab
  useEffect(() => {
    if (activeFile && !activeFile.isFolder) {
      const existingTab = tabs.find(tab => tab.fileId === activeFile.id);
      
      if (existingTab) {
        setActiveTabId(activeFile.id);
      } else {
        const newTab: EditorTab = {
          fileId: activeFile.id,
          fileName: activeFile.name,
          content: activeFile.content || '',
          language: getLanguageFromFileName(activeFile.name),
          isDirty: false,
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(activeFile.id);
      }
    }
  }, [activeFile]);

  // Update editor content when active tab changes
  useEffect(() => {
    const activeTab = tabs.find(tab => tab.fileId === activeTabId);
    if (activeTab) {
      setEditorContent(activeTab.content);
    } else {
      setEditorContent('');
    }
  }, [activeTabId, tabs]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeTabId !== null) {
      setTabs(tabs.map(tab => 
        tab.fileId === activeTabId 
          ? { ...tab, content: value, isDirty: true }
          : tab
      ));
      
      // Debounced save
      const timeoutId = setTimeout(() => {
        onFileUpdate(activeTabId, value);
        setTabs(tabs.map(tab => 
          tab.fileId === activeTabId 
            ? { ...tab, isDirty: false }
            : tab
        ));
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const closeTab = (fileId: number) => {
    const newTabs = tabs.filter(tab => tab.fileId !== fileId);
    setTabs(newTabs);
    
    if (activeTabId === fileId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].fileId : null);
    }
  };

  const activeTab = tabs.find(tab => tab.fileId === activeTabId);

  if (tabs.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-[var(--ecode-background)]", className)}>
        <div className="text-center">
          <p className="text-lg text-[var(--ecode-text-muted)]">No files open</p>
          <p className="text-sm text-[var(--ecode-text-muted)] mt-2">
            Select a file from the sidebar to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-[var(--ecode-background)]", className)}>
      {/* Tabs */}
      <div className="h-9 flex items-center bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] overflow-x-auto">
        <div className="flex items-center">
          {tabs.map((tab) => (
            <div
              key={tab.fileId}
              className={cn(
                "group flex items-center h-full px-3 border-r border-[var(--ecode-border)] cursor-pointer hover:bg-[var(--ecode-sidebar-hover)]",
                activeTabId === tab.fileId && "bg-[var(--ecode-background)] border-b-0"
              )}
              onClick={() => setActiveTabId(tab.fileId)}
            >
              <span className="text-sm whitespace-nowrap">
                {tab.isDirty && <span className="text-[var(--ecode-accent)] mr-1">•</span>}
                {tab.fileName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.fileId);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* Tab menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-full w-9 rounded-none">
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setTabs(tabs.filter(tab => tab.fileId === activeTabId));
            }}>
              Close Other Tabs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setTabs([]);
              setActiveTabId(null);
            }}>
              Close All Tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={activeTab?.language || 'plaintext'}
          value={editorContent}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            fontSize: isMobile ? 12 : 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            minimap: { enabled: !isMobile },
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            tabSize: 2,
            wordWrap: 'on',
            automaticLayout: true,
            fixedOverflowWidgets: true,
            lineNumbers: isMobile ? 'off' : 'on',
            folding: !isMobile,
            glyphMargin: !isMobile,
            suggest: {
              showMethods: true,
              showFunctions: true,
              showConstructors: true,
              showFields: true,
              showVariables: true,
              showClasses: true,
              showStructs: true,
              showInterfaces: true,
              showModules: true,
              showProperties: true,
              showEvents: true,
              showOperators: true,
              showUnits: true,
              showValues: true,
              showConstants: true,
              showEnums: true,
              showEnumMembers: true,
              showKeywords: true,
              showWords: true,
              showColors: true,
              showFiles: true,
              showReferences: true,
              showSnippets: true,
            },
          }}
          onMount={(editor: any) => {
            editorRef.current = editor;
          }}
        />
      </div>
    </div>
  );
}