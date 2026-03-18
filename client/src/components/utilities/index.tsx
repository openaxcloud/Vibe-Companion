import { useEffect, useState } from 'react';

export function ShortcutHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-12 right-4 z-50 px-3 py-2 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-lg text-xs text-[var(--ide-text-muted)] animate-fade-in">
      Press <kbd className="px-1.5 py-0.5 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[10px]">Ctrl+K</kbd> for commands
    </div>
  );
}

export function ShortcutTester() {
  const [lastKey, setLastKey] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      setLastKey(`${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="fixed top-2 right-2 z-[9999] px-2 py-1 bg-black/80 text-white text-xs rounded font-mono">
      {lastKey || 'Press a key...'}
    </div>
  );
}
