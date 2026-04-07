/**
 * LazyMotionComponents - Code-split motion components with CSS fallback
 * 
 * These components lazy-load framer-motion only when needed,
 * preventing the 40KB bundle from blocking initial page load.
 * 
 * When AnimationMonitor detects frame drops, components automatically
 * fall back to CSS transitions for better performance.
 */

import { Suspense, ReactNode, forwardRef, Children, cloneElement, isValidElement } from 'react';
import type { HTMLMotionProps, AnimatePresenceProps } from 'framer-motion';
import { useAnimationPerformance } from './AnimationMonitor';
import { CSSFade, CSSInViewFade, CSSInViewSlide, CSSInViewScale } from './CSSAnimations';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

type VariantObject = Record<string, unknown>;
type Variants = Record<string, VariantObject>;

function resolveVariant(
  value: string | VariantObject | undefined,
  variants: Variants | undefined
): VariantObject | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    return variants?.[value] as VariantObject | undefined;
  }
  return value;
}

function detectInViewAnimationType(
  whileInView: string | VariantObject | undefined,
  variants?: Variants
): 'fade' | 'slide' | 'scale' | null {
  const resolved = resolveVariant(whileInView, variants);
  if (!resolved) return null;
  if ('scale' in resolved) return 'scale';
  if ('y' in resolved) return 'slide';
  if ('x' in resolved) return 'slide';
  if ('opacity' in resolved) return 'fade';
  return null;
}

function getSlideDirection(
  initial: string | VariantObject | undefined,
  variants?: Variants
): 'up' | 'down' | 'left' | 'right' {
  const resolved = resolveVariant(initial, variants);
  if (!resolved) return 'up';
  const y = resolved.y as number | undefined;
  const x = resolved.x as number | undefined;
  if (typeof y === 'number') return y > 0 ? 'up' : 'down';
  if (typeof x === 'number') return x > 0 ? 'left' : 'right';
  return 'up';
}

function getSlideDistance(
  initial: string | VariantObject | undefined,
  variants?: Variants
): number {
  const resolved = resolveVariant(initial, variants);
  if (!resolved) return 20;
  const y = resolved.y as number | undefined;
  const x = resolved.x as number | undefined;
  if (typeof y === 'number') return Math.abs(y);
  if (typeof x === 'number') return Math.abs(x);
  return 20;
}

function getStaggerDelay(
  transition: Record<string, unknown> | undefined,
  childIndex?: number
): number {
  if (!transition || childIndex === undefined) return 0;
  const staggerChildren = transition.staggerChildren as number | undefined;
  const delayChildren = (transition.delayChildren as number) || 0;
  if (typeof staggerChildren === 'number') {
    return (delayChildren + staggerChildren * childIndex) * 1000;
  }
  return 0;
}

function applyStaggerToChildren(
  children: ReactNode,
  transition: Record<string, unknown> | undefined
): ReactNode {
  const staggerChildren = transition?.staggerChildren as number | undefined;
  if (!staggerChildren) return children;
  
  const delayChildren = ((transition?.delayChildren as number) || 0) * 1000;
  const staggerMs = staggerChildren * 1000;
  
  return Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    
    const childDelay = delayChildren + staggerMs * index;
    const existingStyle = (child.props as { style?: Record<string, unknown> }).style || {};
    
    return cloneElement(child, {
      style: {
        ...existingStyle,
        '--stagger-delay': `${staggerMs}ms`,
        '--child-index': index,
        transitionDelay: `${childDelay}ms`,
        animationDelay: `${childDelay}ms`,
      },
    } as Record<string, unknown>);
  });
}

type MotionDivProps = HTMLMotionProps<'div'>;
type MotionButtonProps = HTMLMotionProps<'button'>;
type MotionSpanProps = HTMLMotionProps<'span'>;
type MotionUlProps = HTMLMotionProps<'ul'>;
type MotionLiProps = HTMLMotionProps<'li'>;

const LazyMotionDivInner = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: forwardRef<HTMLDivElement, MotionDivProps>((props, ref) => (
      <mod.m.div ref={ref} {...props} />
    ))
  })), 'MotionDivInner'
);

export const LazyMotionDiv = forwardRef<HTMLDivElement, MotionDivProps>(({ className, children, ...props }, ref) => {
  // SIMPLIFIED: Always render content visible immediately
  // This ensures content is never hidden due to animation loading issues
  // Animations are a progressive enhancement, not a requirement
  
  let shouldUseCSS = true; // Default to CSS for reliability
  try {
    const perf = useAnimationPerformance();
    shouldUseCSS = perf.shouldUseCSS;
  } catch {
    // Context not available, default to simple rendering
    shouldUseCSS = true;
  }
  
  // Always use simple visible div for maximum compatibility
  // This prioritizes content visibility over animations
  if (shouldUseCSS) {
    return (
      <div className={className} ref={ref}>
        {children as ReactNode}
      </div>
    );
  }
  
  // Fallback to framer-motion only when performance context is available
  // and explicitly says CSS is not needed
  return (
    <Suspense fallback={<div className={className}>{children as ReactNode}</div>}>
      <LazyMotionDivInner className={className} {...props} ref={ref}>
        {children}
      </LazyMotionDivInner>
    </Suspense>
  );
});
LazyMotionDiv.displayName = 'LazyMotionDiv';

const LazyMotionButtonInner = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: forwardRef<HTMLButtonElement, MotionButtonProps>((props, ref) => (
      <mod.m.button ref={ref} {...props} />
    ))
  })), 'MotionButtonInner'
);

export const LazyMotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(({ className, children, ...props }, ref) => {
  // SIMPLIFIED: Default to visible content for reliability
  let shouldUseCSS = true;
  try {
    const perf = useAnimationPerformance();
    shouldUseCSS = perf.shouldUseCSS;
  } catch {
    // Context not available, default to simple rendering
    shouldUseCSS = true;
  }
  
  // Extract native button props for fallback rendering (onClick, disabled, type, etc.)
  const { onClick, onMouseDown, onMouseUp, onTouchStart, onTouchEnd, disabled, type, 'data-testid': dataTestId } = props as any;
  const nativeButtonProps = { onClick, onMouseDown, onMouseUp, onTouchStart, onTouchEnd, disabled, type, 'data-testid': dataTestId };
  
  if (shouldUseCSS) {
    return (
      <button className={className} ref={ref} {...nativeButtonProps}>
        {children as ReactNode}
      </button>
    );
  }
  
  return (
    <Suspense fallback={<button className={className} {...nativeButtonProps}>{children as ReactNode}</button>}>
      <LazyMotionButtonInner className={className} {...props} ref={ref}>
        {children}
      </LazyMotionButtonInner>
    </Suspense>
  );
});
LazyMotionButton.displayName = 'LazyMotionButton';

const LazyMotionSpanInner = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: forwardRef<HTMLSpanElement, MotionSpanProps>((props, ref) => (
      <mod.m.span ref={ref} {...props} />
    ))
  })), 'MotionSpanInner'
);

export const LazyMotionSpan = forwardRef<HTMLSpanElement, MotionSpanProps>(({ className, children, ...props }, ref) => {
  // SIMPLIFIED: Default to visible content for reliability
  let shouldUseCSS = true;
  try {
    const perf = useAnimationPerformance();
    shouldUseCSS = perf.shouldUseCSS;
  } catch {
    // Context not available, default to simple rendering
    shouldUseCSS = true;
  }
  
  if (shouldUseCSS) {
    return (
      <span className={className} ref={ref}>
        {children as ReactNode}
      </span>
    );
  }
  
  return (
    <Suspense fallback={<span className={className}>{children as ReactNode}</span>}>
      <LazyMotionSpanInner className={className} {...props} ref={ref}>
        {children}
      </LazyMotionSpanInner>
    </Suspense>
  );
});
LazyMotionSpan.displayName = 'LazyMotionSpan';

const LazyMotionUlInner = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: forwardRef<HTMLUListElement, MotionUlProps>((props, ref) => (
      <mod.m.ul ref={ref} {...props} />
    ))
  })), 'MotionUlInner'
);

export const LazyMotionUl = forwardRef<HTMLUListElement, MotionUlProps>(({ className, children, ...props }, ref) => {
  // SIMPLIFIED: Default to visible content for reliability
  let shouldUseCSS = true;
  try {
    const perf = useAnimationPerformance();
    shouldUseCSS = perf.shouldUseCSS;
  } catch {
    // Context not available, default to simple rendering
    shouldUseCSS = true;
  }
  
  if (shouldUseCSS) {
    return (
      <ul className={className} ref={ref}>
        {children as ReactNode}
      </ul>
    );
  }
  
  return (
    <Suspense fallback={<ul className={className}>{children as ReactNode}</ul>}>
      <LazyMotionUlInner className={className} {...props} ref={ref}>
        {children}
      </LazyMotionUlInner>
    </Suspense>
  );
});
LazyMotionUl.displayName = 'LazyMotionUl';

const LazyMotionLiInner = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: forwardRef<HTMLLIElement, MotionLiProps>((props, ref) => (
      <mod.m.li ref={ref} {...props} />
    ))
  })), 'MotionLiInner'
);

export const LazyMotionLi = forwardRef<HTMLLIElement, MotionLiProps>(({ className, children, ...props }, ref) => {
  // SIMPLIFIED: Default to visible content for reliability
  let shouldUseCSS = true;
  try {
    const perf = useAnimationPerformance();
    shouldUseCSS = perf.shouldUseCSS;
  } catch {
    // Context not available, default to simple rendering
    shouldUseCSS = true;
  }
  
  if (shouldUseCSS) {
    return (
      <li className={className} ref={ref}>
        {children as ReactNode}
      </li>
    );
  }
  
  return (
    <Suspense fallback={<li className={className}>{children as ReactNode}</li>}>
      <LazyMotionLiInner className={className} {...props} ref={ref}>
        {children}
      </LazyMotionLiInner>
    </Suspense>
  );
});
LazyMotionLi.displayName = 'LazyMotionLi';

const LazyAnimatePresenceComponent = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: mod.AnimatePresence
  })), 'AnimatePresence'
);

export function LazyAnimatePresence({ children, ...props }: AnimatePresenceProps & { children: ReactNode }) {
  // SIMPLIFIED: Default to visible content for reliability
  let shouldUseCSS = true;
  try {
    const perf = useAnimationPerformance();
    shouldUseCSS = perf.shouldUseCSS;
  } catch {
    // Context not available, default to simple rendering
    shouldUseCSS = true;
  }
  
  if (shouldUseCSS) {
    return <>{children}</>;
  }
  
  return (
    <Suspense fallback={<>{children}</>}>
      <LazyAnimatePresenceComponent {...props}>
        {children}
      </LazyAnimatePresenceComponent>
    </Suspense>
  );
}

const LazyM = instrumentedLazy(() =>
  import('framer-motion').then(mod => ({
    default: mod.m
  })), 'framer-motion-m'
);

export { LazyM as m };
