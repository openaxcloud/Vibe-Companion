import { ReactNode } from "react";

export const useSwipeGesture = () => ({});

export function PullToRefresh({ children, onRefresh }: { children: ReactNode; onRefresh: () => Promise<void> }) {
  return <>{children}</>;
}

export default function MobileGestures({ children }: any) { return children; }
