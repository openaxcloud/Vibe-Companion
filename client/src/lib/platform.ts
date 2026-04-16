export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function platformShortcut(keys: string): string {
  if (!isMac) return keys;
  return keys.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧');
}

export function platformKey(key: string): string {
  if (!isMac) return key;
  if (key === 'Ctrl') return '⌘';
  if (key === 'Alt') return '⌥';
  if (key === 'Shift') return '⇧';
  return key;
}
