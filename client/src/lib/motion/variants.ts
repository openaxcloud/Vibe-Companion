/**
 * Animation Variants - Reusable animation presets
 * 
 * Optimized for 60fps with minimal reflows.
 * All animations use transform/opacity only (GPU accelerated).
 */

import type { Variants } from 'framer-motion';

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

export const slideVariants = {
  up: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  down: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  },
  left: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  right: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  }
} as const;

export const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

export const staggerVariants = {
  container: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    },
    exit: {
      transition: {
        staggerChildren: 0.03,
        staggerDirection: -1
      }
    }
  },
  item: {
    initial: { opacity: 0, y: 10 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      transition: {
        duration: 0.15
      }
    }
  }
} as const;

export const popoverVariants: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.96,
    y: -4
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.96,
    y: -4,
    transition: {
      duration: 0.1
    }
  }
};

export const modalVariants = {
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  content: {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      y: 10,
      transition: {
        duration: 0.15
      }
    }
  }
} as const;

export const pageTransitionVariants: Variants = {
  initial: { 
    opacity: 0,
    y: 8
  },
  animate: { 
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: { 
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15
    }
  }
};

export const springConfig = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  bouncy: { type: 'spring', stiffness: 300, damping: 10 },
  stiff: { type: 'spring', stiffness: 400, damping: 30 },
  slow: { type: 'spring', stiffness: 80, damping: 20 }
} as const;

export const easings = {
  easeOut: [0.4, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  sharp: [0.4, 0, 0.6, 1]
} as const;
