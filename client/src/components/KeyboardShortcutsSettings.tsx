import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, RotateCcw, AlertTriangle, Keyboard, Search } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  DEFAULT_SHORTCUTS,
  CATEGORY_LABELS,
  formatShortcutDisplay,
  eventToShortcutString,
  findConflict,
} from "@shared/keyboardShortcuts";
import { useToast } from "@/hooks/use-toast";

export default function KeyboardShortcutsSettings() {
  const { shortcuts, userOverrides, updateShortcut, resetShortcut, resetAll, removeShortcut, forceAssignShortcut } = useKeyboardShortcuts();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{ commandId: string; conflictCommandId: string; conflictLabel: string; newKeys: string } | null>(null);

  useEffect(() => {
    if (!recordingId) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingId(null);
        return;
      }

      const shortcutStr = eventToShortcutString(e);
      if (!shortcutStr) return;

      const conflict = findConflict(recordingId, shortcutStr, shortcuts);
      if (conflict) {
        setConflictWarning({
          commandId: recordingId,
          conflictCommandId: conflict.conflictCommandId,
          conflictLabel: conflict.conflictLabel,
          newKeys: shortcutStr,
        });
        setRecordingId(null);
        return;
      }

      updateShortcut(recordingId, shortcutStr);
      setRecordingId(null);
      toast({ title: "Shortcut updated", description: `Set to ${shortcutStr}` });
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingId, shortcuts, updateShortcut, toast]);

  const handleForceAssign = useCallback(() => {
    if (!conflictWarning) return;
    forceAssignShortcut(conflictWarning.commandId, conflictWarning.newKeys, conflictWarning.conflictCommandId);
    toast({ title: "Shortcut updated", description: `Set to ${conflictWarning.newKeys}` });
    setConflictWarning(null);
  }, [conflictWarning, forceAssignShortcut, toast]);

  const categories = ["general", "editor", "panels", "navigation"] as const;

  const filteredShortcuts = DEFAULT_SHORTCUTS.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.label.toLowerCase().includes(q) || (shortcuts[s.id] || "").toLowerCase().includes(q);
  });

  const isModified = (commandId: string) => commandId in userOverrides;

  return (
    <div className="space-y-4" data-testid="section-keyboard-shortcuts">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[11px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider px-1 flex items-center gap-1.5">
          <Keyboard className="w-3 h-3" /> Keyboard Shortcuts
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-3 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
          onClick={() => { resetAll(); toast({ title: "All shortcuts reset to defaults" }); }}
          data-testid="button-reset-all-shortcuts"
        >
          <RotateCcw className="w-3 h-3 mr-1" /> Reset All
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
        <Input
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-[var(--ide-bg)] border-[var(--ide-border)] h-8 rounded-lg text-[var(--ide-text)] text-xs placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40"
          data-testid="input-search-shortcuts"
        />
      </div>

      {conflictWarning && (
        <div className="rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/30 p-3 flex items-start gap-2" data-testid="conflict-warning">
          <AlertTriangle className="w-4 h-4 text-[#F5A623] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--ide-text)]">
              <span className="font-medium">{conflictWarning.newKeys}</span> is already assigned to <span className="font-medium">{conflictWarning.conflictLabel}</span>.
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="h-6 px-3 text-[10px] bg-[#F5A623] hover:bg-[#E09500] text-white rounded"
                onClick={handleForceAssign}
                data-testid="button-force-assign"
              >
                Assign Anyway
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-3 text-[10px] text-[var(--ide-text-secondary)]"
                onClick={() => setConflictWarning(null)}
                data-testid="button-cancel-conflict"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] divide-y divide-[var(--ide-border)] overflow-hidden">
        {categories.map(category => {
          const catShortcuts = filteredShortcuts.filter(s => s.category === category);
          if (catShortcuts.length === 0) return null;

          return (
            <div key={category}>
              <div className="px-4 py-2 bg-[var(--ide-surface)]/30">
                <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
              <div className="divide-y divide-[var(--ide-border)]/50">
                {catShortcuts.map(shortcut => {
                  const currentKeys = shortcuts[shortcut.id];
                  const isRecording = recordingId === shortcut.id;
                  const modified = isModified(shortcut.id);
                  const keyParts = formatShortcutDisplay(currentKeys);

                  return (
                    <div
                      key={shortcut.id}
                      className={`flex items-center justify-between px-4 py-2.5 gap-2 transition-colors ${isRecording ? "bg-[#0079F2]/5" : "hover:bg-[var(--ide-surface)]/30"}`}
                      data-testid={`shortcut-row-${shortcut.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-[var(--ide-text-secondary)] truncate">{shortcut.label}</span>
                        {modified && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0079F2] shrink-0" title="Modified" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isRecording ? (
                          <span className="text-[10px] text-[#0079F2] font-medium animate-pulse px-2 py-1 rounded bg-[#0079F2]/10 whitespace-nowrap" data-testid="recording-indicator">
                            Recording... (Esc to cancel)
                          </span>
                        ) : currentKeys ? (
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {keyParts.map((k, j) => (
                              <kbd
                                key={j}
                                className="px-1.5 py-0.5 rounded bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[10px] text-[var(--ide-text)] font-mono min-w-[22px] text-center"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--ide-text-muted)] italic">unassigned</span>
                        )}

                        {!isRecording && (
                          <div className="flex items-center gap-0.5 ml-1">
                            {currentKeys ? (
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#0079F2] hover:bg-[#0079F2]/10 transition-colors"
                                onClick={() => setRecordingId(shortcut.id)}
                                title="Edit shortcut"
                                data-testid={`button-edit-shortcut-${shortcut.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[#0CCE6B]/10 transition-colors"
                                onClick={() => setRecordingId(shortcut.id)}
                                title="Add shortcut"
                                data-testid={`button-add-shortcut-${shortcut.id}`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                            {currentKeys && (
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                onClick={() => { removeShortcut(shortcut.id); toast({ title: "Shortcut removed" }); }}
                                title="Remove shortcut"
                                data-testid={`button-remove-shortcut-${shortcut.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {modified && (
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[#F5A623] hover:bg-[#F5A623]/10 transition-colors"
                                onClick={() => { resetShortcut(shortcut.id); toast({ title: "Shortcut reset to default" }); }}
                                title="Reset to default"
                                data-testid={`button-reset-shortcut-${shortcut.id}`}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--ide-text-muted)] px-1">
        Click the pencil icon to edit a shortcut, or the plus icon to add one. Press Escape to cancel recording.
      </p>
    </div>
  );
}
