import { useRef, useEffect, type ReactNode } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';

export interface CM6EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onMount?: (view: EditorView) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  children?: ReactNode;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'python':
    case 'py':
      return python();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'markdown':
    case 'md':
      return markdown();
    case 'java':
      return java();
    case 'cpp':
    case 'c':
    case 'c++':
      return cpp();
    default:
      return javascript();
  }
}

export function CM6Editor({
  value = '',
  onChange,
  onMount,
  language = 'javascript',
  readOnly = false,
  height = '100%',
  className = '',
  children,
}: CM6EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      basicSetup,
      getLanguageExtension(language),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    onMount?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      className={`w-full ${className}`}
      style={{ height }}
      data-testid="cm6-editor"
    >
      <div ref={containerRef} className="h-full overflow-auto" />
      {children}
    </div>
  );
}
