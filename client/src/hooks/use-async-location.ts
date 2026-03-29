import { useState, useEffect, useCallback } from 'react';

// All browser events that wouter dispatches on navigation.
// wouter monkey-patches history.pushState/replaceState to fire custom events.
const NAV_EVENTS = ['popstate', 'pushState', 'replaceState', 'hashchange'] as const;

/**
 * Extract the current browser location (pathname + search + hash).
 */
function currentLocation(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

/**
 * Async search hook for wouter — replaces the default useSearch which uses
 * useSyncExternalStore (and causes React 19 Error #310).
 *
 * Wouter's Router picks this up automatically via `props.hook?.searchHook`
 * (see wouter/src/index.js line 165).
 */
function useAsyncSearch(
  _opts: { ssrSearch?: string } = {}
): string {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const handler = () => {
      setSearch(window.location.search);
    };

    for (const event of NAV_EVENTS) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const event of NAV_EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }, []);

  return search;
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
 * This hook subscribes to the same events wouter dispatches, but updates
 * location via regular setState. Regular setState is async and compatible
 * with Suspense boundaries — React can pause the render and show fallbacks
 * instead of crashing.
 *
 * IMPORTANT: This function also exposes a `searchHook` property. Wouter's
 * Router automatically inherits it (line 165 of wouter/src/index.js):
 *   props.searchHook = props.searchHook ?? props.hook?.searchHook
 * This ensures BOTH location AND search tracking avoid useSyncExternalStore.
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

    for (const event of NAV_EVENTS) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const event of NAV_EVENTS) {
        window.removeEventListener(event, handler);
      }
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

// Attach the async search hook so wouter's Router inherits it automatically.
// This is the critical piece that was MISSING in the previous fix attempt —
// without this, wouter falls back to its default useSearch which uses
// useSyncExternalStore, causing synchronous re-renders that trigger Error #310.
(useAsyncBrowserLocation as any).searchHook = useAsyncSearch;
