import { Suspense } from "react";
import { instrumentedLazy } from '@/utils/instrumented-lazy';

const SpotlightSearch = instrumentedLazy(() => import("@/components/SpotlightSearch").then(mod => ({ default: mod.SpotlightSearch })), 'SpotlightSearch');
const CommandPalette = instrumentedLazy(() => import("@/components/CommandPalette").then(mod => ({ default: mod.CommandPalette })), 'CommandPalette');

export function LazyShellWidgets() {
  return (
    <Suspense fallback={null}>
      <SpotlightSearch />
      <CommandPalette />
    </Suspense>
  );
}
