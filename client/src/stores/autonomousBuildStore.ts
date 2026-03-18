import { useState, useEffect, useCallback } from 'react';

interface AutonomousBuildState {
  inlineMode: boolean;
  isBuilding: boolean;
  progress: number;
}

let globalState: AutonomousBuildState = {
  inlineMode: true,
  isBuilding: false,
  progress: 0,
};

const listeners = new Set<() => void>();

function setState(partial: Partial<AutonomousBuildState>) {
  globalState = { ...globalState, ...partial };
  listeners.forEach(l => l());
}

export function useAutonomousBuildStore() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    ...globalState,
    setInlineMode: useCallback((mode: boolean) => setState({ inlineMode: mode }), []),
    setIsBuilding: useCallback((building: boolean) => setState({ isBuilding: building }), []),
    setProgress: useCallback((progress: number) => setState({ progress }), []),
  };
}
