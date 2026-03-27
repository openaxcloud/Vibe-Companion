import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Keyboard, Search } from 'lucide-react';

interface ShortcutEntry {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: ShortcutEntry[] = [
  // General
  { keys: ['Ctrl', 'Shift', 'P'], description: 'Open Command Palette', category: 'General' },
  { keys: ['Ctrl', 'P'], description: 'Quick File Search', category: 'General' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Global Search', category: 'General' },
  { keys: ['Ctrl', ','], description: 'Open Settings', category: 'General' },
  { keys: ['Ctrl', '\\'], description: 'Toggle Sidebar', category: 'General' },
  { keys: ['Ctrl', '`'], description: 'Toggle Terminal', category: 'General' },
  { keys: ['F11'], description: 'Toggle Fullscreen', category: 'General' },

  // Editor
  { keys: ['Ctrl', 'S'], description: 'Save File', category: 'Editor' },
  { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'Editor' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', category: 'Editor' },
  { keys: ['Ctrl', 'D'], description: 'Select Next Occurrence', category: 'Editor' },
  { keys: ['Ctrl', 'Shift', 'K'], description: 'Delete Line', category: 'Editor' },
  { keys: ['Alt', 'Up'], description: 'Move Line Up', category: 'Editor' },
  { keys: ['Alt', 'Down'], description: 'Move Line Down', category: 'Editor' },
  { keys: ['Ctrl', '/'], description: 'Toggle Comment', category: 'Editor' },
  { keys: ['Ctrl', 'Shift', 'A'], description: 'Toggle Block Comment', category: 'Editor' },
  { keys: ['Ctrl', 'F'], description: 'Find', category: 'Editor' },
  { keys: ['Ctrl', 'H'], description: 'Find and Replace', category: 'Editor' },
  { keys: ['Ctrl', 'G'], description: 'Go to Line', category: 'Editor' },
  { keys: ['Ctrl', 'Shift', 'L'], description: 'Select All Occurrences', category: 'Editor' },
  { keys: ['Tab'], description: 'Indent', category: 'Editor' },
  { keys: ['Shift', 'Tab'], description: 'Outdent', category: 'Editor' },

  // Tabs
  { keys: ['Ctrl', 'W'], description: 'Close Tab', category: 'Tabs' },
  { keys: ['Ctrl', 'Tab'], description: 'Next Tab', category: 'Tabs' },
  { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Previous Tab', category: 'Tabs' },
  { keys: ['Ctrl', '1-9'], description: 'Go to Tab N', category: 'Tabs' },
  { keys: ['Ctrl', 'Shift', 'T'], description: 'Reopen Closed Tab', category: 'Tabs' },

  // Run & Debug
  { keys: ['Ctrl', 'Enter'], description: 'Run Project', category: 'Run & Debug' },
  { keys: ['Ctrl', 'Shift', 'Enter'], description: 'Stop Running', category: 'Run & Debug' },
  { keys: ['F5'], description: 'Start Debugging', category: 'Run & Debug' },
  { keys: ['F9'], description: 'Toggle Breakpoint', category: 'Run & Debug' },
  { keys: ['F10'], description: 'Step Over', category: 'Run & Debug' },
  { keys: ['F11'], description: 'Step Into', category: 'Run & Debug' },

  // AI
  { keys: ['Ctrl', 'I'], description: 'Open AI Chat', category: 'AI' },
  { keys: ['Ctrl', 'Shift', 'I'], description: 'AI Generate Code', category: 'AI' },
  { keys: ['Ctrl', 'K'], description: 'AI Inline Edit', category: 'AI' },

  // Git
  { keys: ['Ctrl', 'Shift', 'G'], description: 'Open Git Panel', category: 'Git' },
  { keys: ['Ctrl', 'Shift', 'H'], description: 'View File History', category: 'Git' },
];

const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="text-[var(--ide-text-muted)] mx-0.5 text-[10px]">+</span>}
          <kbd
            className={cn(
              'inline-flex items-center justify-center px-1.5 py-0.5 rounded',
              'bg-[var(--ide-surface)] border border-[var(--ide-border)]',
              'text-[11px] font-mono text-[var(--ide-text-secondary)]',
              'min-w-[22px] text-center',
              'shadow-[0_1px_0_var(--ide-border)]'
            )}
          >
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredShortcuts = shortcuts.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedShortcuts = filteredShortcuts.reduce<Record<string, ShortcutEntry[]>>(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) acc[shortcut.category] = [];
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {}
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-[var(--ide-panel)] border-[var(--ide-border)] text-[var(--ide-text)] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--ide-text)]">
            <Keyboard className="w-5 h-5 text-[#0079F2]" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--ide-text-muted)]">
            Quick reference for all available keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)] text-sm text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0079F2] transition-colors"
          />
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              !activeCategory
                ? 'bg-[#0079F2]/15 text-[#0079F2]'
                : 'bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                cat === activeCategory
                  ? 'bg-[#0079F2]/15 text-[#0079F2]'
                  : 'bg-[var(--ide-surface)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto mt-3 -mx-1 px-1">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h3 className="text-xs font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2 px-1">
                {category}
              </h3>
              <div className="rounded-lg border border-[var(--ide-border)] overflow-hidden">
                {items.map((shortcut, i) => (
                  <div
                    key={`${shortcut.description}-${i}`}
                    className={cn(
                      'flex items-center justify-between px-3 py-2',
                      i > 0 && 'border-t border-[var(--ide-border)]',
                      'hover:bg-[var(--ide-hover)] transition-colors'
                    )}
                  >
                    <span className="text-sm text-[var(--ide-text-secondary)]">
                      {shortcut.description}
                    </span>
                    <KeyCombo keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredShortcuts.length === 0 && (
            <div className="flex flex-col items-center py-10 text-[var(--ide-text-muted)]">
              <Keyboard className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No shortcuts found</p>
              <p className="text-xs mt-1 opacity-70">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--ide-border)] text-[10px] text-[var(--ide-text-muted)]">
          <span>{filteredShortcuts.length} shortcuts</span>
          <span className="inline-flex items-center gap-1">
            Press
            <kbd className="px-1 py-0.5 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] font-mono">
              ?
            </kbd>
            anywhere to toggle this overlay
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
