/**
 * Native Motion Library - Fortune 500-grade framer-motion replacement
 * 
 * Zero-dependency animation utilities that:
 * - Use requestAnimationFrame for smooth 60fps updates
 * - Leverage Web Animations API (WAAPI) for GPU acceleration
 * - Respect prefers-reduced-motion accessibility preference
 * - Run on compositor thread without main thread blocking
 */

export { 
  useNativeMotionValue,
  useDerivedMotionValue,
  createMotionValue,
  type NativeMotionValue
} from './useNativeMotionValue';

export {
  useSpringValue,
  useSpring
} from './useSpringValue';

export {
  usePanGesture,
  createPanHandlers,
  type PanInfo
} from './usePanGesture';

export {
  useAnimationControls,
  createAnimationControls
} from './useAnimationControls';
