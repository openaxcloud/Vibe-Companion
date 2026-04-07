import { useRef, useEffect, useCallback, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { placeholder as placeholderExtension } from '@codemirror/view';
import { getTheme } from '@/lib/cm6/theme';
import { getBaseExtensions, getReadOnlyExtensions } from '@/lib/cm6/extensions';
import { loadLanguage } from '@/lib/cm6/language-loader';
import { cn } from '@/lib/utils';

export interface CM6EditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onMount?: (view: EditorView) => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  theme?: 'dark' | 'light';
  tabSize?: number;
  lineWrapping?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CM6Editor({
  value,
  language,
  onChange,
  onMount,
  readOnly = false,
  height = '100%',
  className,
  theme = 'dark',
  tabSize = 2,
  lineWrapping = false,
  placeholder,
  autoFocus = false,
}: CM6EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isExternalUpdate = useRef(false);
  
  const themeCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());
  const tabSizeCompartment = useRef(new Compartment());
  const lineWrappingCompartment = useRef(new Compartment());
  const placeholderCompartment = useRef(new Compartment());

  const [isLoading, setIsLoading] = useState(true);

  onChangeRef.current = onChange;

  const getHeightStyle = useCallback(() => {
    if (typeof height === 'number') {
      return `${height}px`;
    }
    return height;
  }, [height]);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const initEditor = async () => {
      if (!containerRef.current || !mounted) return;

      const languageSupport = await loadLanguage(language);

      if (!mounted) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && !isExternalUpdate.current) {
          const newValue = update.state.doc.toString();
          onChangeRef.current?.(newValue);
        }
      });

      const extensions = [
        ...(readOnly ? getReadOnlyExtensions() : getBaseExtensions()),
        themeCompartment.current.of(getTheme(theme === 'dark')),
        languageCompartment.current.of(languageSupport ? [languageSupport] : []),
        readOnlyCompartment.current.of(
          readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []
        ),
        tabSizeCompartment.current.of(EditorState.tabSize.of(tabSize)),
        lineWrappingCompartment.current.of(lineWrapping ? EditorView.lineWrapping : []),
        placeholderCompartment.current.of(placeholder ? placeholderExtension(placeholder) : []),
        updateListener,
      ];

      const state = EditorState.create({
        doc: value,
        extensions,
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
      setIsLoading(false);

      if (autoFocus) {
        view.focus();
      }

      onMount?.(view);
    };

    initEditor();

    return () => {
      mounted = false;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [value, isLoading]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    const updateLanguage = async () => {
      const languageSupport = await loadLanguage(language);
      view.dispatch({
        effects: languageCompartment.current.reconfigure(
          languageSupport ? [languageSupport] : []
        ),
      });
    };

    updateLanguage();
  }, [language, isLoading]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    view.dispatch({
      effects: themeCompartment.current.reconfigure(getTheme(theme === 'dark')),
    });
  }, [theme, isLoading]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []
      ),
    });
  }, [readOnly, isLoading]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    view.dispatch({
      effects: tabSizeCompartment.current.reconfigure(EditorState.tabSize.of(tabSize)),
    });
  }, [tabSize, isLoading]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    view.dispatch({
      effects: lineWrappingCompartment.current.reconfigure(
        lineWrapping ? EditorView.lineWrapping : []
      ),
    });
  }, [lineWrapping, isLoading]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isLoading) return;

    view.dispatch({
      effects: placeholderCompartment.current.reconfigure(
        placeholder ? placeholderExtension(placeholder) : []
      ),
    });
  }, [placeholder, isLoading]);

  return (
    <div
      ref={containerRef}
      data-testid="cm6-editor"
      className={cn(
        'cm6-editor-container',
        'relative w-full overflow-hidden',
        'rounded-lg border',
        theme === 'dark'
          ? 'border-border bg-background'
          : 'border-border bg-white',
        className
      )}
      style={{
        height: getHeightStyle(),
      }}
    />
  );
}

export default CM6Editor;
