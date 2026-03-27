import { ReactNode, useEffect, useState } from "react";
import { LazyMotionDiv, LazyAnimatePresence, type Variants } from '@/lib/motion';
import { useLocation } from "wouter";

// Page transition variants
const pageVariants: Record<string, Variants> = {
  slideRight: {
    initial: { y: 30, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  },
  slideLeft: {
    initial: { y: 30, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
  },
  slideUp: {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "-20%", opacity: 0 },
  },
  slideDown: {
    initial: { y: "-100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "20%", opacity: 0 },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  scale: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.1, opacity: 0 },
  },
  spring: {
    initial: { scale: 0, rotate: -180, opacity: 0 },
    animate: { 
      scale: 1, 
      rotate: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
    exit: { scale: 0, rotate: 180, opacity: 0 },
  },
};

interface PageTransitionProps {
  children: ReactNode;
  variant?: keyof typeof pageVariants;
  duration?: number;
  className?: string;
}

export function PageTransition({ 
  children, 
  variant = "slideRight", 
  duration = 0.3,
  className = ""
}: PageTransitionProps) {
  const [location] = useLocation();
  
  return (
    <LazyAnimatePresence mode="wait">
      <LazyMotionDiv
        key={location}
        className={className}
        variants={pageVariants[variant]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration, ease: "easeInOut" }}
      >
        {children}
      </LazyMotionDiv>
    </LazyAnimatePresence>
  );
}

// Bottom sheet component
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: string;
  showHandle?: boolean;
  closeOnSwipeDown?: boolean;
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  children,
  height = "auto",
  showHandle = true,
  closeOnSwipeDown = true
}: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  const handleDragEnd = (_: any, info: any) => {
    if (closeOnSwipeDown && info.offset.y > 100) {
      onClose();
    } else {
      setDragY(0);
    }
    setIsDragging(false);
  };

  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <LazyMotionDiv
            className="fixed inset-0 bg-background z-[90]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Bottom Sheet */}
          <LazyMotionDiv
            className="fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-xl z-[95]"
            style={{ height, maxHeight: "90vh" }}
            initial={{ y: "100%" }}
            animate={{ y: dragY }}
            exit={{ y: "100%" }}
            drag={closeOnSwipeDown ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 40,
            }}
          >
            {showHandle && (
              <div className="flex justify-center py-2">
                <div className="w-12 h-1.5 bg-muted rounded-full" />
              </div>
            )}
            <div className="overflow-auto" style={{ maxHeight: "calc(90vh - 2rem)" }}>
              {children}
            </div>
          </LazyMotionDiv>
        </>
      )}
    </LazyAnimatePresence>
  );
}

// Modal with mobile-optimized animations
interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  variant?: "center" | "fullscreen";
}

export function MobileModal({ 
  isOpen, 
  onClose, 
  children,
  title,
  variant = "center"
}: MobileModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <LazyMotionDiv
            className="fixed inset-0 bg-background z-[90]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal */}
          {variant === "center" ? (
            <LazyMotionDiv
              className="fixed inset-4 m-auto max-w-lg max-h-[80vh] bg-background rounded-2xl shadow-xl z-[95] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            >
              {title && (
                <div className="px-4 py-3 border-b">
                  <h2 className="text-[15px] font-semibold">{title}</h2>
                </div>
              )}
              <div className="overflow-auto max-h-[calc(80vh-4rem)]">
                {children}
              </div>
            </LazyMotionDiv>
          ) : (
            <LazyMotionDiv
              className="fixed inset-0 bg-background z-[95]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 40,
              }}
            >
              {title && (
                <div className="px-4 py-3 border-b">
                  <h2 className="text-[15px] font-semibold">{title}</h2>
                </div>
              )}
              {children}
            </LazyMotionDiv>
          )}
        </>
      )}
    </LazyAnimatePresence>
  );
}

// Skeleton loader component
interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  animation?: "pulse" | "wave" | "none";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ 
  className = "",
  variant = "text",
  animation = "pulse",
  width,
  height
}: SkeletonProps) {
  const baseClasses = "bg-muted";
  const variantClasses = {
    text: "rounded h-4 w-full",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };
  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const style: React.CSSProperties = {
    width: width || (variant === "circular" ? 40 : "100%"),
    height: height || (variant === "circular" ? 40 : variant === "rectangular" ? 100 : 16),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

// Parallax scroll container
interface ParallaxProps {
  children: ReactNode;
  speed?: number;
  className?: string;
}

export function Parallax({ children, speed = 0.5, className = "" }: ParallaxProps) {
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setOffsetY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={className}
      style={{
        transform: `translateY(${offsetY * speed}px)`,
        transition: "transform 0.1s ease-out",
      }}
    >
      {children}
    </div>
  );
}

// Loading spinner with mobile optimization
interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

export function Spinner({ size = "md", color = "hsl(var(--primary))" }: SpinnerProps) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <LazyMotionDiv
        className={`${sizes[size]} border-2 border-t-transparent rounded-full`}
        style={{ borderColor: `${color}33`, borderTopColor: color }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// Pull indicator for pull-to-refresh
interface PullIndicatorProps {
  progress: number;
  isRefreshing: boolean;
}

export function PullIndicator({ progress, isRefreshing }: PullIndicatorProps) {
  return (
    <div className="flex justify-center py-4">
      <LazyMotionDiv
        animate={{
          rotate: isRefreshing ? 360 : progress * 180,
          scale: Math.min(progress, 1),
        }}
        transition={{
          rotate: isRefreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0 },
        }}
      >
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </LazyMotionDiv>
    </div>
  );
}