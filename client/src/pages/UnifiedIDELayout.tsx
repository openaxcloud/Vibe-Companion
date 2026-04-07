import { lazy, Suspense } from "react";

const RealUnifiedIDELayout = lazy(() => import("@/components/ide/UnifiedIDELayout"));

export default function UnifiedIDELayout(props: any) {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--ecode-background,#0E1525)]" data-testid="page-unifiedidelayout">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--ecode-accent,#F26207)] to-[var(--ecode-accent-hover,#D04E00)] flex items-center justify-center shadow-lg shadow-[var(--ecode-accent,#F26207)]/20">
            <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <p className="text-[13px] text-[var(--ecode-text-muted,#9BA3B3)] font-medium">Loading workspace...</p>
        </div>
      </div>
    }>
      <RealUnifiedIDELayout {...props} />
    </Suspense>
  );
}
