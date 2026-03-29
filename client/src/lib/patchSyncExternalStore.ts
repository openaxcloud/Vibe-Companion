import * as React from 'react';
import { startTransition } from 'react';

const originalUseSyncExternalStore = React.useSyncExternalStore;

// @ts-ignore - monkey-patching React to fix Error #310
React.useSyncExternalStore = function patchedUseSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T {
  const wrappedSubscribe = (onStoreChange: () => void) => {
    return subscribe(() => {
      startTransition(() => {
        onStoreChange();
      });
    });
  };
  return originalUseSyncExternalStore(wrappedSubscribe, getSnapshot, getServerSnapshot);
};

export {};
