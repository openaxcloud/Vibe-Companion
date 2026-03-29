import { useState, useEffect, useCallback } from 'react';

/**
 * Extract the current browser location (pathname + search + hash).
 */
function currentLocation(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

/**
 * Custom wouter location hook that uses useState + useEffect instead of
 * useSyncExternalStore.
 *
 * WHY: wouter v3 uses useSyncExternalStore to track browser location.
 * When navigation occurs (history.pushState), useSyncExternalStore forces
 * a SYNCHRONOUS re-render. In React 19, if any lazy component suspends
 * during a synchronous render, React throws Error #310:
 * "A component suspended while responding to synchronous input."
 *
 * This hook subscribes to the same events wouter dispatches (wouter
 * monkey-patches history.pushState/replaceState to dispatch custom events),
 * but updates location via regular setState. Regular setState is async
 * and compatible with Suspense boundaries — React can pause the render
 * and show fallbacks instead of crashing.
 *
 * Usage in App.tsx:
 *   import { Router } from "wouter";
 *   import { useAsyncBrowserLocation } from "./hooks/use-async-location";
 *   <Router hook={useAsyncBrowserLocation}>...</Router>
 */
export function useAsyncBrowserLocation(
  opts: { base?: string; ssrPath?: string } = {}
): [string, (to: string, navOpts?: { replace?: boolean; state?: any }) => void] {
  const base = opts.base || '';

  const [location, setLocation] = useState(() => {
    const loc = currentLocation();
    // Strip base prefix if present (matches wouter behavior)
    if (base && loc.startsWith(base)) {
      return loc.slice(base.length) || '/';
    }
    return loc;
  });

  useEffect(() => {
    const handler = () => {
      const loc = currentLocation();
      if (base && loc.startsWith(base)) {
        setLocation(loc.slice(base.length) || '/');
      } else {
        setLocation(loc);
      }
    };

    // wouter monkey-patches history.pushState/replaceState to dispatch
    // custom "pushState" and "replaceState" events on the window.
    // We subscribe to those same events plus the native "popstate".
    window.addEventListener('popstate', handler);
    window.addEventListener('pushState', handler);
    window.addEventListener('replaceState', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('pushState', handler);
      window.removeEventListener('replaceState', handler);
    };
  }, [base]);

  const navigate = useCallback(
    (to: string, navOpts?: { replace?: boolean; state?: any }) => {
      const url = base ? base + to : to;
      const method = navOpts?.replace ? 'replaceState' : 'pushState';
      history[method](navOpts?.state ?? null, '', url);
    },
    [base]
  );

  return [location, navigate];
}
