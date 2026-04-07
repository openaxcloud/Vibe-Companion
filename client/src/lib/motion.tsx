import React, { forwardRef, type ComponentPropsWithRef } from 'react';

export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const staggerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const LazyMotionDiv = forwardRef<HTMLDivElement, ComponentPropsWithRef<'div'> & {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  variants?: any;
  whileHover?: any;
  whileTap?: any;
  whileInView?: any;
  viewport?: any;
  layout?: boolean | string;
  layoutId?: string;
  style?: React.CSSProperties;
  key?: React.Key;
}>(({ initial, animate, exit, transition, variants, whileHover, whileTap, whileInView, viewport, layout, layoutId, ...props }, ref) => {
  return <div ref={ref} {...props} />;
});
LazyMotionDiv.displayName = 'LazyMotionDiv';

export const LazyMotionButton = forwardRef<HTMLButtonElement, ComponentPropsWithRef<'button'> & {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  variants?: any;
  whileHover?: any;
  whileTap?: any;
  layout?: boolean | string;
}>(({ initial, animate, exit, transition, variants, whileHover, whileTap, layout, ...props }, ref) => {
  return <button ref={ref} {...props} />;
});
LazyMotionButton.displayName = 'LazyMotionButton';

export const LazyMotionSpan = forwardRef<HTMLSpanElement, ComponentPropsWithRef<'span'> & {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  variants?: any;
  whileHover?: any;
  whileTap?: any;
  layout?: boolean | string;
}>(({ initial, animate, exit, transition, variants, whileHover, whileTap, layout, ...props }, ref) => {
  return <span ref={ref} {...props} />;
});
LazyMotionSpan.displayName = 'LazyMotionSpan';

export function LazyAnimatePresence({ children, mode, initial, onExitComplete }: {
  children: React.ReactNode;
  mode?: 'sync' | 'wait' | 'popLayout';
  initial?: boolean;
  onExitComplete?: () => void;
}) {
  return <>{children}</>;
}

export const LazyMotionLi = forwardRef<HTMLLIElement, ComponentPropsWithRef<'li'> & {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  variants?: any;
  whileHover?: any;
  whileTap?: any;
  layout?: boolean | string;
}>(({ initial, animate, exit, transition, variants, whileHover, whileTap, layout, ...props }, ref) => {
  return <li ref={ref} {...props} />;
});
LazyMotionLi.displayName = 'LazyMotionLi';

export const LazyMotionUl = forwardRef<HTMLUListElement, ComponentPropsWithRef<'ul'> & {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  variants?: any;
  layout?: boolean | string;
}>(({ initial, animate, exit, transition, variants, layout, ...props }, ref) => {
  return <ul ref={ref} {...props} />;
});
LazyMotionUl.displayName = 'LazyMotionUl';

export function useReducedMotion() {
  return false;
}

export const m = {
  div: LazyMotionDiv,
  span: LazyMotionSpan,
  button: LazyMotionButton,
  li: LazyMotionLi,
  ul: LazyMotionUl,
};

export const slideVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const scaleVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export function useMotionReady() { return true; }
export function OptimizedMotionProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function cssTransition() { return {}; }
export function cssAnimation() { return {}; }
export function useInView() { return { ref: null, isInView: true }; }
export function AnimationMonitor({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function useAnimationPerformance() { return { fps: 60, dropped: 0 }; }
export function useDragControls() { return { start: () => {} }; }

export function CSSInViewFade({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) {
  return <div className={className} {...props}>{children}</div>;
}
export function CSSInViewSlide({ children, className, ...props }: { children: React.ReactNode; className?: string; direction?: string; [key: string]: any }) {
  return <div className={className} {...props}>{children}</div>;
}
export function CSSInViewScale({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) {
  return <div className={className} {...props}>{children}</div>;
}
export function CSSScale({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) {
  return <div className={className} {...props}>{children}</div>;
}
export function CSSSpring({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) {
  return <div className={className} {...props}>{children}</div>;
}

export function CSSFade({ children, className, delay, ...props }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  [key: string]: any;
}) {
  return <div className={className} {...props}>{children}</div>;
}

export function CSSSlide({ children, className, direction, delay, ...props }: {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  [key: string]: any;
}) {
  return <div className={className} {...props}>{children}</div>;
}
