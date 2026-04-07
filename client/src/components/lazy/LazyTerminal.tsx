// @ts-nocheck
import { Suspense, ComponentType } from 'react';
import { Loader2, Terminal as TerminalIcon } from 'lucide-react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

interface TerminalFallbackProps {
  height?: string | number;
}

function TerminalFallback({ height = '300px' }: TerminalFallbackProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center bg-zinc-900 rounded-md border border-zinc-800"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <TerminalIcon className="h-8 w-8 text-zinc-500 mb-2" />
      <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mb-2" />
      <span className="text-[13px] text-zinc-400">Loading terminal...</span>
    </div>
  );
}

export const LazyTerminal = instrumentedLazy(() => import('@/components/Terminal'), 'Terminal');

export const LazyReplitTerminal = instrumentedLazy(() => 
  import('@/components/terminal/ReplitTerminal').then(mod => ({ default: mod.ReplitTerminal })), 'ReplitTerminal'
);

export const LazyAdvancedTerminal = instrumentedLazy(() => 
  import('@/components/terminal/AdvancedTerminal').then(mod => ({ default: mod.AdvancedTerminal })), 'AdvancedTerminal'
);

export const LazyReplitTerminalPanel = instrumentedLazy(() => 
  import('@/components/editor/ReplitTerminalPanel').then(mod => ({ default: mod.ReplitTerminalPanel })), 'ReplitTerminalPanel'
);

export const LazyMobileTerminal = instrumentedLazy(() => 
  import('@/components/mobile/MobileTerminal').then(mod => ({ default: mod.MobileTerminal })), 'MobileTerminal'
);

interface LazyTerminalWrapperProps {
  Component: ComponentType<any>;
  fallbackHeight?: string | number;
  [key: string]: any;
}

export function LazyTerminalWrapper({ 
  Component, 
  fallbackHeight = '300px',
  ...props 
}: LazyTerminalWrapperProps) {
  return (
    <Suspense fallback={<TerminalFallback height={fallbackHeight} />}>
      <Component {...props} />
    </Suspense>
  );
}

export function withLazyTerminal<P extends Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallbackHeight?: string | number,
  moduleName?: string
) {
  const LazyComponent = instrumentedLazy(importFn, moduleName || 'TerminalComponent');
  
  return function LazyTerminalHOC(props: P) {
    return (
      <Suspense fallback={<TerminalFallback height={fallbackHeight} />}>
        <LazyComponent {...props as any} />
      </Suspense>
    );
  };
}
