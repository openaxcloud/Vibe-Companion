export interface ShortcutDefinition {
  id: string;
  label: string;
  category: "general" | "editor" | "panels" | "navigation";
  defaultKeys: string | null;
}

export type KeyboardShortcutsMap = Record<string, string | null>;

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  { id: "command-palette", label: "Command Palette", category: "general", defaultKeys: "Ctrl+P" },
  { id: "command-palette-alt", label: "Command Palette (Alt)", category: "general", defaultKeys: "Ctrl+K" },
  { id: "command-palette-shift", label: "Command Palette (Shift)", category: "general", defaultKeys: "Ctrl+Shift+P" },
  { id: "toggle-sidebar", label: "Toggle Sidebar", category: "general", defaultKeys: "Ctrl+B" },
  { id: "keyboard-shortcuts", label: "Keyboard Shortcuts", category: "general", defaultKeys: "Ctrl+/" },
  { id: "run", label: "Run / Stop", category: "general", defaultKeys: "F5" },
  { id: "run-alt", label: "Run Code", category: "general", defaultKeys: "Ctrl+Enter" },

  { id: "save-file", label: "Save File", category: "editor", defaultKeys: "Ctrl+S" },
  { id: "new-file", label: "New File", category: "editor", defaultKeys: "Ctrl+N" },
  { id: "new-folder", label: "New Folder", category: "editor", defaultKeys: null },
  { id: "close-tab", label: "Close Tab", category: "editor", defaultKeys: "Ctrl+W" },
  { id: "split-editor", label: "Split Editor Right", category: "editor", defaultKeys: null },
  { id: "toggle-minimap", label: "Toggle Minimap", category: "editor", defaultKeys: null },

  { id: "toggle-terminal", label: "Toggle Terminal", category: "panels", defaultKeys: "Ctrl+J" },
  { id: "toggle-terminal-alt", label: "Toggle Terminal (Alt)", category: "panels", defaultKeys: "Ctrl+`" },
  { id: "toggle-preview", label: "Toggle Preview", category: "panels", defaultKeys: "Ctrl+\\" },
  { id: "toggle-ai", label: "Toggle AI Panel", category: "panels", defaultKeys: null },
  { id: "search-files", label: "Search in Files", category: "panels", defaultKeys: "Ctrl+Shift+F" },
  { id: "search-replace", label: "Search & Replace", category: "panels", defaultKeys: "Ctrl+H" },
  { id: "version-control", label: "Version Control", category: "panels", defaultKeys: "Ctrl+Shift+G" },

  { id: "project-settings", label: "Project Settings", category: "navigation", defaultKeys: null },
  { id: "publish", label: "Publish", category: "navigation", defaultKeys: null },
  { id: "go-dashboard", label: "Go to Dashboard", category: "navigation", defaultKeys: null },
  { id: "fork-project", label: "Fork Project", category: "navigation", defaultKeys: null },
];

export const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  editor: "Editor",
  panels: "Panels",
  navigation: "Navigation",
};

export function getDefaultShortcutsMap(): KeyboardShortcutsMap {
  const map: KeyboardShortcutsMap = {};
  for (const s of DEFAULT_SHORTCUTS) {
    map[s.id] = s.defaultKeys;
  }
  return map;
}

export function mergeWithDefaults(overrides: KeyboardShortcutsMap): KeyboardShortcutsMap {
  const defaults = getDefaultShortcutsMap();
  return { ...defaults, ...overrides };
}

export function formatShortcutDisplay(keys: string | null): string[] {
  if (!keys) return [];
  return keys.split("+");
}

export function normalizeShortcutParts(shortcutKeys: string): { needsCtrl: boolean; needsShift: boolean; needsAlt: boolean; keyPart: string | null } {
  const parts = shortcutKeys.toLowerCase().split("+");
  const needsCtrl = parts.includes("ctrl");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");
  const keyPart = parts.filter(p => !["ctrl", "shift", "alt", "meta"].includes(p))[0] || null;
  return { needsCtrl, needsShift, needsAlt, keyPart };
}

export function shortcutMatchesEvent(shortcutKeys: string | null, e: KeyboardEvent): boolean {
  if (!shortcutKeys) return false;

  const { needsCtrl, needsShift, needsAlt, keyPart } = normalizeShortcutParts(shortcutKeys);
  if (!keyPart) return false;

  const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

  if (needsCtrl !== hasCtrlOrMeta) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;

  const eventKey = e.key.toLowerCase();

  if (keyPart === "enter") return eventKey === "enter";
  if (keyPart === "escape") return eventKey === "escape";
  if (keyPart === "tab") return eventKey === "tab";
  if (keyPart === "space") return eventKey === " " || eventKey === "space";
  if (keyPart === "backspace") return eventKey === "backspace";
  if (keyPart === "delete") return eventKey === "delete";
  if (keyPart === "arrowup") return eventKey === "arrowup";
  if (keyPart === "arrowdown") return eventKey === "arrowdown";
  if (keyPart === "arrowleft") return eventKey === "arrowleft";
  if (keyPart === "arrowright") return eventKey === "arrowright";
  if (/^f\d+$/.test(keyPart)) return eventKey === keyPart;
  if (keyPart === "`") return eventKey === "`";
  if (keyPart === "\\") return eventKey === "\\";
  if (keyPart === "/") return eventKey === "/";
  if (keyPart === "[") return eventKey === "[";
  if (keyPart === "]") return eventKey === "]";
  if (keyPart === "-") return eventKey === "-";
  if (keyPart === "=") return eventKey === "=";
  if (keyPart === ",") return eventKey === ",";
  if (keyPart === ".") return eventKey === ".";
  if (keyPart === ";") return eventKey === ";";
  if (keyPart === "'") return eventKey === "'";

  return eventKey === keyPart;
}

export function eventToShortcutString(e: KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  let keyName = key;
  if (key === " ") keyName = "Space";
  else if (key === "Escape") keyName = "Escape";
  else if (key === "Enter") keyName = "Enter";
  else if (key === "Backspace") keyName = "Backspace";
  else if (key === "Delete") keyName = "Delete";
  else if (key === "Tab") keyName = "Tab";
  else if (key === "ArrowUp") keyName = "ArrowUp";
  else if (key === "ArrowDown") keyName = "ArrowDown";
  else if (key === "ArrowLeft") keyName = "ArrowLeft";
  else if (key === "ArrowRight") keyName = "ArrowRight";
  else if (/^F\d+$/.test(key)) keyName = key;
  else if (key.length === 1) keyName = key.toUpperCase();
  else return null;

  if (parts.length === 0 && !/^F\d+$/.test(keyName) && !["Escape", "Tab", "Space"].includes(keyName)) return null;

  parts.push(keyName);
  return parts.join("+");
}

export function findConflict(
  commandId: string,
  newKeys: string,
  currentMap: KeyboardShortcutsMap
): { conflictCommandId: string; conflictLabel: string } | null {
  const normalized = newKeys.toLowerCase();
  for (const [id, keys] of Object.entries(currentMap)) {
    if (id === commandId) continue;
    if (keys && keys.toLowerCase() === normalized) {
      const def = DEFAULT_SHORTCUTS.find(s => s.id === id);
      return { conflictCommandId: id, conflictLabel: def?.label || id };
    }
  }
  return null;
}

export function isValidShortcutValue(value: string): boolean {
  if (value.length > 50) return false;
  const parts = value.split("+");
  const modifiers = ["Ctrl", "Shift", "Alt"];
  const keyParts: string[] = [];
  for (const p of parts) {
    if (modifiers.includes(p)) continue;
    keyParts.push(p);
  }
  if (keyParts.length !== 1) return false;
  const key = keyParts[0];
  const validKeys = [
    "Enter", "Escape", "Tab", "Space", "Backspace", "Delete",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "`", "\\", "/", "[", "]", "-", "=", ",", ".", ";", "'",
  ];
  if (validKeys.includes(key)) return true;
  if (/^F\d+$/.test(key)) return true;
  if (/^[A-Z0-9]$/.test(key)) return true;
  return false;
}
