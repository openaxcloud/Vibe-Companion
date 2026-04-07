/**
 * MultiEditorManager - Multi-Tab Editor Manager (CodeMirror 6)
 * 
 * Manages multiple CM6 EditorView instances for a multi-tab code editor.
 * Migrated from Monaco to CodeMirror 6 for smaller bundle size and better performance.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { getBaseExtensions, getMobileExtensions } from '@/lib/cm6/extensions';
import { getTheme } from '@/lib/cm6/theme';
import { loadLanguage } from '@/lib/cm6/language-loader';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';

interface EditorInstance {
  fileId: number;
  fileName: string;
  language: string;
  view: EditorView | null;
  container: HTMLDivElement | null;
  savedSelection: { anchor: number; head: number } | null;
  content: string;
  languageCompartment: Compartment;
  themeCompartment: Compartment;
}

interface MultiEditorManagerProps {
  tabs: Array<{
    fileId: number;
    fileName: string;
    content: string;
    language: string;
  }>;
  activeTabId: number | null;
  onContentChange: (fileId: number, content: string) => void;
  className?: string;
}

export function MultiEditorManager({
  tabs,
  activeTabId,
  onContentChange,
  className,
}: MultiEditorManagerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const editorInstancesRef = useRef<Map<number, EditorInstance>>(new Map());
  const onContentChangeRef = useRef(onContentChange);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  onContentChangeRef.current = onContentChange;

  const createEditorInstance = useCallback(
    async (tab: typeof tabs[0]): Promise<EditorInstance | null> => {
      if (!containerRef.current) return null;

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.right = '0';
      container.style.bottom = '0';
      container.style.display = 'none';
      containerRef.current.appendChild(container);

      const languageCompartment = new Compartment();
      const themeCompartment = new Compartment();

      try {
        const languageSupport = await loadLanguage(tab.language);

        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            onContentChangeRef.current(tab.fileId, content);
          }
        });

        const baseExtensions = isMobile ? getMobileExtensions() : getBaseExtensions();

        const extensions = [
          ...baseExtensions,
          themeCompartment.of(getTheme(true)),
          languageCompartment.of(languageSupport ? [languageSupport] : []),
          updateListener,
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: isMobile ? '12px' : '13px',
              fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            },
            '.cm-scroller': {
              overflow: 'auto',
            },
            '.cm-content': {
              padding: '8px 0',
            },
          }),
        ];

        const state = EditorState.create({
          doc: tab.content,
          extensions,
        });

        const view = new EditorView({
          state,
          parent: container,
        });

        const instance: EditorInstance = {
          fileId: tab.fileId,
          fileName: tab.fileName,
          language: tab.language,
          view,
          container,
          savedSelection: null,
          content: tab.content,
          languageCompartment,
          themeCompartment,
        };

        editorInstancesRef.current.set(tab.fileId, instance);
        return instance;
      } catch (error) {
        console.error('[MultiEditorManager] Failed to create editor:', error);
        container.remove();
        return null;
      }
    },
    [isMobile]
  );

  const switchToEditor = useCallback((fileId: number) => {
    editorInstancesRef.current.forEach((instance, id) => {
      if (instance.view && instance.container) {
        if (id === fileId) {
          instance.container.style.display = 'block';

          if (instance.savedSelection) {
            const { anchor, head } = instance.savedSelection;
            const docLength = instance.view.state.doc.length;
            const safeAnchor = Math.min(anchor, docLength);
            const safeHead = Math.min(head, docLength);
            instance.view.dispatch({
              selection: { anchor: safeAnchor, head: safeHead },
            });
          }

          instance.view.focus();
          instance.view.requestMeasure();
        } else {
          const selection = instance.view.state.selection.main;
          instance.savedSelection = { anchor: selection.anchor, head: selection.head };
          instance.container.style.display = 'none';
        }
      }
    });
  }, []);

  useEffect(() => {
    const initEditors = async () => {
      setIsLoading(true);
      
      for (const tab of tabs) {
        if (!editorInstancesRef.current.has(tab.fileId)) {
          await createEditorInstance(tab);
        }
      }

      const tabIds = new Set(tabs.map(t => t.fileId));
      editorInstancesRef.current.forEach((instance, fileId) => {
        if (!tabIds.has(fileId)) {
          if (instance.view) {
            instance.view.destroy();
          }
          if (instance.container) {
            instance.container.remove();
          }
          editorInstancesRef.current.delete(fileId);
        }
      });

      setIsLoading(false);
      setIsReady(true);
    };

    initEditors();
  }, [tabs, createEditorInstance]);

  useEffect(() => {
    if (activeTabId !== null && isReady) {
      switchToEditor(activeTabId);
    }
  }, [activeTabId, switchToEditor, isReady]);

  useEffect(() => {
    tabs.forEach(tab => {
      const instance = editorInstancesRef.current.get(tab.fileId);
      if (instance?.view && instance.content !== tab.content) {
        const currentValue = instance.view.state.doc.toString();
        if (currentValue !== tab.content) {
          instance.view.dispatch({
            changes: {
              from: 0,
              to: currentValue.length,
              insert: tab.content,
            },
          });
          instance.content = tab.content;
        }
      }
    });
  }, [tabs]);

  useEffect(() => {
    return () => {
      editorInstancesRef.current.forEach(instance => {
        if (instance.view) {
          instance.view.destroy();
        }
        if (instance.container) {
          instance.container.remove();
        }
      });
      editorInstancesRef.current.clear();
    };
  }, []);

  return (
    <div className={cn('relative h-full w-full', className)}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <p className="text-[13px] text-[var(--ecode-text-muted)]">
              Initializing editors...
            </p>
          </div>
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
