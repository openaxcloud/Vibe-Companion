import { useState, useEffect, useCallback } from 'react';

interface SchemaWarmingState {
  isReady: boolean;
  isWarming: boolean;
}

let globalState: SchemaWarmingState = {
  isReady: true,
  isWarming: false,
};

const listeners = new Set<() => void>();

function setState(partial: Partial<SchemaWarmingState>) {
  globalState = { ...globalState, ...partial };
  listeners.forEach(l => l());
}

export function useSchemaWarmingStore() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    ...globalState,
    setReady: useCallback((ready: boolean) => setState({ isReady: ready }), []),
    setWarming: useCallback((warming: boolean) => setState({ isWarming: warming }), []),
  };
}
