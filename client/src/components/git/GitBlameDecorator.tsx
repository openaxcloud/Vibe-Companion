/**
 * Git Blame Decorator - Inline blame annotations in CodeMirror 6 Editor
 * Shows commit info and author for each line using CM6 Decorations
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  gutter,
  GutterMarker,
} from '@codemirror/view';
import { StateField, StateEffect, Extension, RangeSetBuilder } from '@codemirror/state';
import { formatDistanceToNow } from 'date-fns';

interface BlameInfo {
  line: number;
  commit: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: Date;
  };
}

interface ApiBlameEntry {
  line: number;
  commit: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  };
}

interface BlameResponse {
  blame: ApiBlameEntry[];
}

interface GitBlameDecoratorProps {
  editor: EditorView | null;
  filePath: string;
  projectId: string | number;
  enabled?: boolean;
}

const setBlameDataEffect = StateEffect.define<BlameInfo[]>();
const clearBlameDataEffect = StateEffect.define<null>();

class BlameWidget extends WidgetType {
  constructor(
    readonly author: string,
    readonly timeAgo: string,
    readonly commitHash: string,
    readonly commitMessage: string,
    readonly fullDate: string
  ) {
    super();
  }

  eq(other: BlameWidget): boolean {
    return (
      this.author === other.author &&
      this.timeAgo === other.timeAgo &&
      this.commitHash === other.commitHash
    );
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-git-blame-widget';
    wrapper.textContent = ` ${this.author} • ${this.timeAgo} `;
    wrapper.title = `${this.commitHash} - ${this.commitMessage}\n\nAuthor: ${this.author}\nDate: ${this.fullDate}`;
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class BlameGutterMarker extends GutterMarker {
  constructor(
    readonly shortHash: string,
    readonly author: string,
    readonly message: string,
    readonly date: string
  ) {
    super();
  }

  eq(other: BlameGutterMarker): boolean {
    return this.shortHash === other.shortHash;
  }

  toDOM(): Text {
    return document.createTextNode(this.shortHash);
  }
}

function createBlameStateField(): StateField<BlameInfo[]> {
  return StateField.define<BlameInfo[]>({
    create() {
      return [];
    },
    update(blameData, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setBlameDataEffect)) {
          return effect.value;
        }
        if (effect.is(clearBlameDataEffect)) {
          return [];
        }
      }
      return blameData;
    },
  });
}

function createBlameDecorations(blameData: BlameInfo[], doc: { line: (n: number) => { from: number } }): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  const sortedBlame = [...blameData].sort((a, b) => a.line - b.line);

  for (const blame of sortedBlame) {
    try {
      const line = doc.line(blame.line);
      const timeAgo = formatDistanceToNow(blame.commit.date, { addSuffix: true });
      const fullDate = blame.commit.date.toLocaleString();

      const widget = Decoration.widget({
        widget: new BlameWidget(
          blame.commit.author,
          timeAgo,
          blame.commit.shortHash,
          blame.commit.message,
          fullDate
        ),
        side: -1,
      });

      builder.add(line.from, line.from, widget);
    } catch {
      continue;
    }
  }

  return builder.finish();
}

const blameDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      const blameData = view.state.field(blameStateField, false) || [];
      this.decorations = createBlameDecorations(blameData, view.state.doc);
    }

    update(update: ViewUpdate) {
      const blameData = update.state.field(blameStateField, false) || [];
      if (
        update.docChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setBlameDataEffect) || e.is(clearBlameDataEffect))
        )
      ) {
        this.decorations = createBlameDecorations(blameData, update.state.doc);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const blameStateField = createBlameStateField();

function createBlameGutter(blameData: BlameInfo[]): Extension {
  const blameMap = new Map(blameData.map((b) => [b.line, b]));

  return gutter({
    class: 'cm-git-blame-gutter',
    lineMarker: (view, line) => {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      const blame = blameMap.get(lineNumber);
      if (blame) {
        const timeAgo = formatDistanceToNow(blame.commit.date, { addSuffix: true });
        return new BlameGutterMarker(
          blame.commit.shortHash,
          blame.commit.author,
          blame.commit.message,
          timeAgo
        );
      }
      return null;
    },
    initialSpacer: () => new BlameGutterMarker('0000000', 'Author', 'Message', 'time'),
  });
}

const blameTheme = EditorView.theme({
  '.cm-git-blame-widget': {
    color: 'rgba(150, 150, 150, 0.7)',
    fontSize: '11px',
    fontFamily: "'IBM Plex Mono', 'SF Mono', Monaco, Consolas, monospace",
    fontStyle: 'italic',
    paddingRight: '12px',
    opacity: '0.6',
    transition: 'opacity 0.2s ease',
    cursor: 'help',
    whiteSpace: 'nowrap',
  },
  '.cm-git-blame-widget:hover': {
    opacity: '1',
  },
  '.cm-git-blame-gutter': {
    width: '70px',
    fontSize: '10px',
    color: 'rgba(150, 150, 150, 0.5)',
    fontFamily: "'IBM Plex Mono', 'SF Mono', Monaco, Consolas, monospace",
    textAlign: 'right',
    paddingRight: '8px',
    cursor: 'pointer',
  },
  '.cm-git-blame-gutter .cm-gutterElement': {
    paddingRight: '8px',
  },
  '.cm-line:hover .cm-git-blame-widget': {
    opacity: '1',
  },
  '&.dark .cm-git-blame-widget': {
    color: 'rgba(150, 150, 150, 0.6)',
  },
  '&.light .cm-git-blame-widget': {
    color: 'rgba(100, 100, 100, 0.7)',
  },
});

export function getBlameExtensions(blameData: BlameInfo[] = []): Extension[] {
  return [
    blameStateField,
    blameDecorationPlugin,
    blameTheme,
    ...(blameData.length > 0 ? [createBlameGutter(blameData)] : []),
  ];
}

export function updateBlameData(view: EditorView, blameData: BlameInfo[]): void {
  view.dispatch({
    effects: setBlameDataEffect.of(blameData),
  });
}

export function clearBlameData(view: EditorView): void {
  view.dispatch({
    effects: clearBlameDataEffect.of(null),
  });
}

export function GitBlameDecorator({
  editor,
  filePath,
  projectId,
  enabled = true
}: GitBlameDecoratorProps) {
  const [blameData, setBlameData] = useState<BlameInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const prevEnabledRef = useRef(enabled);

  useEffect(() => {
    if (!enabled || !filePath) {
      setBlameData([]);
      return;
    }

    const fetchBlameData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/git/blame/${encodeURIComponent(filePath)}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 400) {
            setBlameData([]);
            return;
          }
          throw new Error('Failed to fetch blame data');
        }

        const data: BlameResponse = await response.json();

        const parsedBlameData: BlameInfo[] = (data.blame || []).map(entry => ({
          line: entry.line,
          commit: {
            hash: entry.commit.hash,
            shortHash: entry.commit.shortHash,
            message: entry.commit.message,
            author: entry.commit.author,
            date: new Date(entry.commit.date)
          }
        }));

        setBlameData(parsedBlameData);
      } catch (error) {
        console.error('Failed to fetch blame data:', error);
        setBlameData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlameData();
  }, [filePath, projectId, enabled]);

  useEffect(() => {
    if (!editor) return;

    if (!enabled && prevEnabledRef.current) {
      clearBlameData(editor);
    } else if (enabled && blameData.length > 0) {
      updateBlameData(editor, blameData);
    }

    prevEnabledRef.current = enabled;
  }, [editor, blameData, enabled]);

  useEffect(() => {
    if (!enabled || blameData.length === 0) return;

    if (!document.getElementById('git-blame-cm6-styles')) {
      const style = document.createElement('style');
      style.id = 'git-blame-cm6-styles';
      style.textContent = `
        .cm-git-blame-widget {
          color: rgba(150, 150, 150, 0.7);
          font-size: 11px;
          font-family: 'IBM Plex Mono', 'SF Mono', Monaco, Consolas, monospace;
          font-style: italic;
          padding-right: 12px;
          opacity: 0.6;
          transition: opacity 0.2s ease;
          cursor: help;
          white-space: nowrap;
        }

        .cm-git-blame-widget:hover {
          opacity: 1;
        }

        .cm-git-blame-gutter {
          width: 70px;
          font-size: 10px;
          color: rgba(150, 150, 150, 0.5);
          font-family: 'IBM Plex Mono', 'SF Mono', Monaco, Consolas, monospace;
          text-align: right;
          padding-right: 8px;
        }

        .cm-line:hover .cm-git-blame-widget {
          opacity: 1;
        }

        .dark .cm-git-blame-widget {
          color: rgba(150, 150, 150, 0.6);
        }

        .light .cm-git-blame-widget {
          color: rgba(100, 100, 100, 0.7);
        }
      `;
      document.head.appendChild(style);
    }
  }, [enabled, blameData]);

  return null;
}

export function useGitBlame(
  editor: EditorView | null,
  filePath: string,
  projectId: string | number
) {
  const [enabled, setEnabled] = useState(true);

  const toggle = () => setEnabled(prev => !prev);
  const enable = () => setEnabled(true);
  const disable = () => setEnabled(false);

  const blameExtensions = useMemo(() => getBlameExtensions(), []);

  return {
    GitBlameDecorator: () => (
      <GitBlameDecorator
        editor={editor}
        filePath={filePath}
        projectId={projectId}
        enabled={enabled}
      />
    ),
    blameExtensions,
    enabled,
    toggle,
    enable,
    disable,
    updateBlameData: (data: BlameInfo[]) => editor && updateBlameData(editor, data),
    clearBlameData: () => editor && clearBlameData(editor),
  };
}
