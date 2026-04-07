export interface ShortcutDefinition {
  id: string;
  label: string;
  defaultKey: string;
  category: string;
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  { id: "save", label: "Save File", defaultKey: "Ctrl+S", category: "editor" },
  { id: "open", label: "Open File", defaultKey: "Ctrl+O", category: "editor" },
  { id: "close", label: "Close Tab", defaultKey: "Ctrl+W", category: "editor" },
  { id: "find", label: "Find", defaultKey: "Ctrl+F", category: "editor" },
  { id: "replace", label: "Find & Replace", defaultKey: "Ctrl+H", category: "editor" },
  { id: "commandPalette", label: "Command Palette", defaultKey: "Ctrl+Shift+P", category: "general" },
  { id: "terminal", label: "Toggle Terminal", defaultKey: "Ctrl+`", category: "general" },
  { id: "run", label: "Run Project", defaultKey: "Ctrl+Enter", category: "general" },
  { id: "undo", label: "Undo", defaultKey: "Ctrl+Z", category: "editor" },
  { id: "redo", label: "Redo", defaultKey: "Ctrl+Shift+Z", category: "editor" },
  { id: "format", label: "Format Document", defaultKey: "Ctrl+Shift+F", category: "editor" },
  { id: "goToLine", label: "Go to Line", defaultKey: "Ctrl+G", category: "editor" },
  { id: "toggleSidebar", label: "Toggle Sidebar", defaultKey: "Ctrl+B", category: "general" },
  { id: "newFile", label: "New File", defaultKey: "Ctrl+N", category: "general" },
  { id: "search", label: "Global Search", defaultKey: "Ctrl+Shift+F", category: "general" },
];

export function isValidShortcutValue(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const parts = value.split("+").map((p) => p.trim());
  if (parts.length === 0) return false;
  const modifiers = ["Ctrl", "Alt", "Shift", "Meta", "Cmd"];
  const key = parts[parts.length - 1];
  return key.length > 0 && parts.slice(0, -1).every((p) => modifiers.includes(p));
}

export function findConflict(
  shortcuts: Record<string, string>,
  newId: string,
  newValue: string,
): { conflictId: string; conflictLabel: string } | null {
  for (const [id, value] of Object.entries(shortcuts)) {
    if (id !== newId && value.toLowerCase() === newValue.toLowerCase()) {
      const def = DEFAULT_SHORTCUTS.find((s) => s.id === id);
      return { conflictId: id, conflictLabel: def?.label || id };
    }
  }
  return null;
}

export function mergeWithDefaults(
  customShortcuts: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const shortcut of DEFAULT_SHORTCUTS) {
    result[shortcut.id] = customShortcuts[shortcut.id] || shortcut.defaultKey;
  }
  return result;
}
