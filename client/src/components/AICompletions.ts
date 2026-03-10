import { ViewPlugin, Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { StateField, StateEffect, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

const setGhostText = StateEffect.define<{ pos: number; text: string } | null>();

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.style.cssText = "color: #676D7E; opacity: 0.6; font-style: italic; pointer-events: none;";
    span.textContent = this.text;
    return span;
  }
  eq(other: GhostTextWidget) { return this.text === other.text; }
}

const ghostField = StateField.define<{ pos: number; text: string } | null>({
  create() { return null; },
  update(val, tr) {
    for (const e of tr.effects) {
      if (e.is(setGhostText)) return e.value;
    }
    if (tr.docChanged && val) return null;
    return val;
  },
});

const ghostDecoration = EditorView.decorations.compute([ghostField], (state) => {
  const ghost = state.field(ghostField);
  if (!ghost) return Decoration.none;
  const firstLine = ghost.text.split("\n")[0];
  if (!firstLine) return Decoration.none;
  return Decoration.set([
    Decoration.widget({ widget: new GhostTextWidget(firstLine), side: 1 }).range(ghost.pos),
  ]);
});

let abortController: AbortController | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchCompletion(code: string, cursorOffset: number, language: string): Promise<string> {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  try {
    const res = await fetch("/api/ai/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, cursorOffset, language }),
      signal: abortController.signal,
      credentials: "include",
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.completion || "";
  } catch {
    return "";
  }
}

const completionPlugin = (language: string) => ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {}

    update(update: any) {
      if (!update.docChanged) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const state = this.view.state;
        const cursor = state.selection.main.head;
        const doc = state.doc.toString();
        if (doc.length < 5) return;
        const lineAt = state.doc.lineAt(cursor);
        const textAfterCursor = lineAt.text.slice(cursor - lineAt.from);
        if (textAfterCursor.trim().length > 0) return;

        fetchCompletion(doc, cursor, language).then((text) => {
          if (!text || text.length < 2) return;
          if (this.view.state.doc.toString() !== doc) return;
          this.view.dispatch({ effects: setGhostText.of({ pos: cursor, text }) });
        });
      }, 800);
    }

    destroy() {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (abortController) abortController.abort();
    }
  }
);

const acceptGhostKeymap = Prec.highest(keymap.of([
  {
    key: "Tab",
    run(view) {
      const ghost = view.state.field(ghostField);
      if (!ghost) return false;
      view.dispatch({
        changes: { from: ghost.pos, insert: ghost.text },
        effects: setGhostText.of(null),
        selection: { anchor: ghost.pos + ghost.text.length },
      });
      return true;
    },
  },
  {
    key: "Escape",
    run(view) {
      const ghost = view.state.field(ghostField);
      if (!ghost) return false;
      view.dispatch({ effects: setGhostText.of(null) });
      return true;
    },
  },
]));

export function inlineAICompletion(language: string): Extension[] {
  return [
    ghostField,
    ghostDecoration,
    completionPlugin(language),
    acceptGhostKeymap,
  ];
}
