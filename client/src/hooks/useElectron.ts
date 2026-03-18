import { useEffect } from 'react';

interface ElectronMenuHandlers {
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSave?: () => void;
  onSaveAll?: () => void;
  onPreferences?: () => void;
  onFind?: () => void;
  onFindReplace?: () => void;
  onNewTerminal?: () => void;
  onClearTerminal?: () => void;
  onToggleSidebar?: () => void;
  onToggleTerminal?: () => void;
  onToggleAI?: () => void;
  onQuickOpen?: () => void;
  onGoToLine?: () => void;
  onGoToSymbol?: () => void;
  onGoToDefinition?: () => void;
  onRunCode?: () => void;
  onStopExecution?: () => void;
  onShowShortcuts?: () => void;
}

export function useElectronMenuEvents(handlers: ElectronMenuHandlers) {
  useEffect(() => {
    // Only activate in electron environment
    if (typeof window === 'undefined' || !(window as any).electronAPI) return;

    const api = (window as any).electronAPI;
    const cleanups: (() => void)[] = [];

    const events: [string, (() => void) | undefined][] = [
      ['menu:new-project', handlers.onNewProject],
      ['menu:open-project', handlers.onOpenProject],
      ['menu:save', handlers.onSave],
      ['menu:save-all', handlers.onSaveAll],
      ['menu:preferences', handlers.onPreferences],
      ['menu:find', handlers.onFind],
      ['menu:find-replace', handlers.onFindReplace],
      ['menu:new-terminal', handlers.onNewTerminal],
      ['menu:clear-terminal', handlers.onClearTerminal],
      ['menu:toggle-sidebar', handlers.onToggleSidebar],
      ['menu:toggle-terminal', handlers.onToggleTerminal],
      ['menu:toggle-ai', handlers.onToggleAI],
      ['menu:quick-open', handlers.onQuickOpen],
      ['menu:go-to-line', handlers.onGoToLine],
      ['menu:go-to-symbol', handlers.onGoToSymbol],
      ['menu:go-to-definition', handlers.onGoToDefinition],
      ['menu:run-code', handlers.onRunCode],
      ['menu:stop-execution', handlers.onStopExecution],
      ['menu:show-shortcuts', handlers.onShowShortcuts],
    ];

    events.forEach(([event, handler]) => {
      if (handler && api.on) {
        const unsub = api.on(event, handler);
        if (typeof unsub === 'function') cleanups.push(unsub);
      }
    });

    return () => cleanups.forEach(fn => fn());
  }, [handlers]);
}
