import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
  keymap,
} from "@codemirror/view";
import { StateField, StateEffect, Prec } from "@codemirror/state";

const setSuggestion = StateEffect.define<string>();
const clearSuggestion = StateEffect.define<void>();

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.style.opacity = "0.35";
    span.style.fontStyle = "italic";
    span.style.pointerEvents = "none";
    span.textContent = this.text;
    return span;
  }
  ignoreEvent() {
    return true;
  }
}

const ghostField = StateField.define<{ text: string; pos: number } | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSuggestion)) {
        return { text: e.value, pos: tr.state.selection.main.head };
      }
      if (e.is(clearSuggestion)) return null;
    }
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
});

const ghostDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(_, tr) {
    const ghost = tr.state.field(ghostField);
    if (!ghost) return Decoration.none;
    const pos = ghost.pos;
    if (pos > tr.state.doc.length) return Decoration.none;
    return Decoration.set([
      Decoration.widget({ widget: new GhostTextWidget(ghost.text), side: 1 }).range(pos),
    ]);
  },
  provide: (f) => EditorView.decorations.from(f),
});

async function fetchCompletion(
  code: string,
  cursorOffset: number,
  language: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch("/api/ai/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, cursorOffset, language }),
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.completion || null;
  } catch {
    return null;
  }
}

function createCompletionPlugin(language: string) {
  return ViewPlugin.fromClass(
    class {
      private debounceTimer: ReturnType<typeof setTimeout> | null = null;
      private abortController: AbortController | null = null;

      constructor(readonly view: EditorView) {}

      update(update: any) {
        if (!update.docChanged && !update.selectionSet) return;

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.abortController) this.abortController.abort();

        this.view.dispatch({ effects: clearSuggestion.of(undefined) });

        const doc = update.state.doc.toString();
        const cursor = update.state.selection.main.head;

        if (doc.length < 5 || doc.length > 50000) return;

        this.debounceTimer = setTimeout(async () => {
          this.abortController = new AbortController();
          const completion = await fetchCompletion(doc, cursor, language, this.abortController.signal);
          if (completion && completion.trim()) {
            if (this.view.state.selection.main.head === cursor) {
              this.view.dispatch({ effects: setSuggestion.of(completion) });
            }
          }
        }, 800);
      }

      destroy() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.abortController) this.abortController.abort();
      }
    },
  );
}

const acceptKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run(view) {
        const ghost = view.state.field(ghostField);
        if (!ghost) return false;
        view.dispatch({
          changes: { from: ghost.pos, insert: ghost.text },
          selection: { anchor: ghost.pos + ghost.text.length },
          effects: clearSuggestion.of(undefined),
        });
        return true;
      },
    },
    {
      key: "Escape",
      run(view) {
        const ghost = view.state.field(ghostField);
        if (!ghost) return false;
        view.dispatch({ effects: clearSuggestion.of(undefined) });
        return true;
      },
    },
  ]),
);

export function inlineAICompletion(language: string) {
  return [ghostField, ghostDecorations, createCompletionPlugin(language), acceptKeymap];
}
