/**
 * MultiTabEditor - Replit-Style Multi-Tab Code Editor (CodeMirror 6)
 * 
 * Maintains one CM6 EditorView instance per open tab to preserve:
 * - Undo/redo history per file
 * - Language mode per file
 * - Cursor position per file
 * - Editor state per file
 * 
 * Migrated from Monaco to CodeMirror 6 for smaller bundle size and better performance.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { File } from '@shared/schema';
import { EditorView } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { getBaseExtensions } from '@/lib/cm6/extensions';
import { getTheme } from '@/lib/cm6/theme';
import { loadLanguageForFile } from '@/lib/cm6/language-loader';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/../../shared/stores/layoutStore';
import { DraggableTabBar } from './DraggableTabBar';
import { EditorToolbar } from './EditorToolbar';
import { ReplitMinimap } from '@/components/replit/ReplitMinimap';

interface EditorInstance {
  view: EditorView;
  container: HTMLDivElement;
  languageCompartment: Compartment;
  themeCompartment: Compartment;
  savedSelection: { anchor: number; head: number } | null;
}

interface MultiTabEditorProps {
  files: File[];
  activeFileId?: number;
  onFileSelect?: (file: File) => void;
  onChange?: (fileId: number, content: string) => void;
  className?: string;
}

export function MultiTabEditor({
  files,
  activeFileId,
  onFileSelect,
  onChange,
  className,
}: MultiTabEditorProps) {
  const { 
    openTabs, 
    activeFileId: storeActiveFileId, 
    minimapEnabled,
    openFile, 
    closeFile, 
    reorderTabs,
    toggleMinimap,
  } = useLayoutStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editorsRef = useRef<Map<number, EditorInstance>>(new Map());
  const onChangeRef = useRef(onChange);
  const [minimapContent, setMinimapContent] = useState('');
  const [minimapLine, setMinimapLine] = useState(1);
  const [minimapVisibleRange, setMinimapVisibleRange] = useState<{ start: number; end: number } | undefined>();
  const minimapEnabledRef = useRef(minimapEnabled);
  minimapEnabledRef.current = minimapEnabled;
  
  const currentActiveFileId = activeFileId ?? storeActiveFileId;
  const activeFileIdRef = useRef(currentActiveFileId);
  activeFileIdRef.current = currentActiveFileId;

  onChangeRef.current = onChange;

  const createEditorInstance = useCallback(async (file: File, containerDiv: HTMLDivElement): Promise<EditorInstance | null> => {
    try {
      const languageCompartment = new Compartment();
      const themeCompartment = new Compartment();
      
      const languageSupport = await loadLanguageForFile(file.filename || file.name || '');

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newContent = update.state.doc.toString();
          if (onChangeRef.current && file.id) {
            onChangeRef.current(file.id, newContent);
          }
          if (minimapEnabledRef.current && file.id === activeFileIdRef.current) {
            setMinimapContent(newContent);
          }
        }
        if ((update.selectionSet || update.docChanged || update.geometryChanged) && minimapEnabledRef.current && file.id === activeFileIdRef.current) {
          const cursor = update.state.selection.main.head;
          setMinimapLine(update.state.doc.lineAt(cursor).number);
          const dom = update.view.dom;
          if (dom) {
            const rect = dom.getBoundingClientRect();
            const startBlock = update.view.lineBlockAtHeight(update.view.scrollDOM.scrollTop);
            const endBlock = update.view.lineBlockAtHeight(update.view.scrollDOM.scrollTop + rect.height);
            const startLine = update.state.doc.lineAt(startBlock.from).number;
            const endLine = update.state.doc.lineAt(endBlock.from).number;
            setMinimapVisibleRange({ start: startLine, end: endLine });
          }
        }
      });

      const saveKeymap = keymap.of([
        {
          key: 'Mod-s',
          run: (view) => {
            if (onChangeRef.current && file.id) {
              const currentContent = view.state.doc.toString();
              onChangeRef.current(file.id, currentContent);
            }
            return true;
          },
        },
      ]);

      const extensions = [
        ...getBaseExtensions(),
        themeCompartment.of(getTheme(true)),
        languageCompartment.of(languageSupport ? [languageSupport] : []),
        updateListener,
        saveKeymap,
        EditorView.theme({
          '&': {
            height: '100%',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
        }),
      ];

      const state = EditorState.create({
        doc: file.content || '',
        extensions,
      });

      const view = new EditorView({
        state,
        parent: containerDiv,
      });

      return {
        view,
        container: containerDiv,
        languageCompartment,
        themeCompartment,
        savedSelection: null,
      };
    } catch (error) {
      console.error('Failed to create CM6 editor instance for file:', file.filename || file.name, error);
      return null;
    }
  }, []);

  const getOrCreateEditor = useCallback(async (file: File): Promise<EditorInstance | null> => {
    if (!file.id || !containerRef.current) return null;

    if (editorsRef.current.has(file.id)) {
      return editorsRef.current.get(file.id) || null;
    }

    const editorDiv = document.createElement('div');
    editorDiv.id = `editor-${file.id}`;
    editorDiv.style.position = 'absolute';
    editorDiv.style.top = '0';
    editorDiv.style.left = '0';
    editorDiv.style.width = '100%';
    editorDiv.style.height = '100%';
    editorDiv.style.display = 'none';
    containerRef.current.appendChild(editorDiv);

    const instance = await createEditorInstance(file, editorDiv);
    if (instance) {
      editorsRef.current.set(file.id, instance);
      return instance;
    }

    editorDiv.remove();
    return null;
  }, [createEditorInstance]);

  useEffect(() => {
    if (!currentActiveFileId || !containerRef.current) return;

    const activeFile = files.find(f => f.id === currentActiveFileId);
    if (!activeFile) return;

    const switchEditor = async () => {
      const activeInstance = await getOrCreateEditor(activeFile);
      if (!activeInstance) return;

      editorsRef.current.forEach((instance, fileId) => {
        if (fileId !== currentActiveFileId) {
          instance.container.style.display = 'none';
          const selection = instance.view.state.selection.main;
          instance.savedSelection = { anchor: selection.anchor, head: selection.head };
        }
      });

      activeInstance.container.style.display = 'block';
      
      if (minimapEnabled) {
        setMinimapContent(activeInstance.view.state.doc.toString());
        const cursor = activeInstance.view.state.selection.main.head;
        setMinimapLine(activeInstance.view.state.doc.lineAt(cursor).number);
      }

      if (activeInstance.savedSelection) {
        const { anchor, head } = activeInstance.savedSelection;
        const docLength = activeInstance.view.state.doc.length;
        const safeAnchor = Math.min(anchor, docLength);
        const safeHead = Math.min(head, docLength);
        activeInstance.view.dispatch({
          selection: { anchor: safeAnchor, head: safeHead },
        });
      }

      requestAnimationFrame(() => {
        activeInstance.view.focus();
      });
    };

    switchEditor();
  }, [currentActiveFileId, files, getOrCreateEditor]);

  useEffect(() => {
    if (!minimapEnabled || !currentActiveFileId) return;
    const instance = editorsRef.current.get(currentActiveFileId);
    if (instance) {
      setMinimapContent(instance.view.state.doc.toString());
      const cursor = instance.view.state.selection.main.head;
      setMinimapLine(instance.view.state.doc.lineAt(cursor).number);
    }
  }, [minimapEnabled, currentActiveFileId]);

  useEffect(() => {
    files.forEach((file) => {
      if (!file.id) return;

      const instance = editorsRef.current.get(file.id);
      if (instance) {
        const currentValue = instance.view.state.doc.toString();
        if (currentValue !== file.content && file.content !== undefined) {
          instance.view.dispatch({
            changes: {
              from: 0,
              to: currentValue.length,
              insert: file.content || '',
            },
          });
        }
      }
    });
  }, [files]);

  useEffect(() => {
    const handleResize = () => {
      editorsRef.current.forEach((instance) => {
        instance.view.requestMeasure();
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      editorsRef.current.forEach((instance) => {
        instance.view.destroy();
      });
      editorsRef.current.clear();
    };
  }, []);

  const handleCloseTab = useCallback((fileId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const instance = editorsRef.current.get(fileId);
    if (instance) {
      instance.view.destroy();
      instance.container.remove();
      editorsRef.current.delete(fileId);
    }

    closeFile(fileId);

    if (currentActiveFileId === fileId && openTabs.length > 1) {
      const remainingTabs = openTabs.filter(id => id !== fileId);
      const nextFileId = remainingTabs[remainingTabs.length - 1];
      const nextFile = files.find(f => f.id === nextFileId);
      if (nextFile && onFileSelect) {
        onFileSelect(nextFile);
      }
    }
  }, [currentActiveFileId, openTabs, files, onFileSelect, closeFile]);

  const handleTabClick = useCallback((file: File) => {
    if (file.id) {
      openFile(file.id);
    }
    if (onFileSelect) {
      onFileSelect(file);
    }
  }, [openFile, onFileSelect]);

  return (
    <div className={cn("flex flex-col h-full w-full bg-[var(--ecode-editor-bg)]", className)}>
      <DraggableTabBar
        tabs={openTabs}
        files={files}
        activeFileId={currentActiveFileId}
        onTabSelect={(fileId) => {
          const file = files.find(f => f.id === fileId);
          if (file && onFileSelect) {
            onFileSelect(file);
          }
          openFile(fileId);
        }}
        onTabClose={(fileId) => {
          const instance = editorsRef.current.get(fileId);
          if (instance) {
            instance.view.destroy();
            instance.container.remove();
            editorsRef.current.delete(fileId);
          }
          closeFile(fileId);
        }}
        onTabsReorder={reorderTabs}
      />
      
      {currentActiveFileId && (
        <EditorToolbar
          filePath={files.find(f => f.id === currentActiveFileId)?.path}
          fileName={files.find(f => f.id === currentActiveFileId)?.name}
          minimapEnabled={minimapEnabled}
          onToggleMinimap={toggleMinimap}
          onBreadcrumbClick={(segment, index) => {
          }}
        />
      )}
      
      <div className="flex-1 flex overflow-hidden">
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[var(--ecode-editor-bg)]">
          {!currentActiveFileId && (
            <div className="flex items-center justify-center h-full text-[var(--ecode-text-muted)]">
              <p className="text-[13px] font-[family-name:var(--ecode-font-sans)]">Select a file to start editing</p>
            </div>
          )}
        </div>
        {minimapEnabled && currentActiveFileId && minimapContent && (
          <ReplitMinimap
            content={minimapContent}
            currentLine={minimapLine}
            visibleRange={minimapVisibleRange}
            onLineClick={(line) => {
              const instance = editorsRef.current.get(currentActiveFileId);
              if (instance) {
                const lineInfo = instance.view.state.doc.line(Math.min(line, instance.view.state.doc.lines));
                instance.view.dispatch({
                  selection: { anchor: lineInfo.from },
                  effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
                });
                instance.view.focus();
              }
            }}
            className="w-[60px] shrink-0 border-l border-[var(--ecode-border)]"
          />
        )}
      </div>
    </div>
  );
}
