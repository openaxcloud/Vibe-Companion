import React from 'react';

if (typeof (React as any).useSyncExternalStore !== 'function') {
  (React as any).useSyncExternalStore = function useSyncExternalStore(
    subscribe: (callback: () => void) => () => void,
    getSnapshot: () => any,
    getServerSnapshot?: () => any
  ) {
    const [state, setState] = React.useState(getSnapshot);
    React.useEffect(() => {
      return subscribe(() => {
        setState(getSnapshot());
      });
    }, [subscribe, getSnapshot]);
    return state;
  };
}
