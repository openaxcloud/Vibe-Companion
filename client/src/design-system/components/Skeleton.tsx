/**
 * Skeleton Loading Components
 * Smooth loading states with shimmer effect
 */

import React from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';

// ============================================================================
// BASE SKELETON
// ============================================================================

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius,
  variant = 'rectangular',
  animated = true,
  className,
  style,
}) => {
  const ds = useDesignSystem();

  const getDefaultRadius = () => {
    switch (variant) {
      case 'text':
        return ds.borderRadius.sm;
      case 'circular':
        return '50%';
      case 'rectangular':
      default:
        return ds.borderRadius.md;
    }
  };

  const getDefaultHeight = () => {
    switch (variant) {
      case 'text':
        return '12px';
      case 'circular':
        return width;
      default:
        return height;
    }
  };

  return (
    <LazyMotionDiv
      className={className}
      style={{
        width,
        height: getDefaultHeight(),
        borderRadius: borderRadius || getDefaultRadius(),
        backgroundColor: ds.colors.fill.tertiary,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...(animated && {
        initial: { opacity: 0.6 },
        animate: { opacity: [0.6, 1, 0.6] },
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      })}
    >
      {animated && (
        <LazyMotionDiv
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, ${ds.colors.fill.primary}, transparent)`,
          }}
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </LazyMotionDiv>
  );
};

// ============================================================================
// TEXT SKELETON
// ============================================================================

export interface TextSkeletonProps {
  lines?: number;
  width?: string | number;
  lastLineWidth?: string | number;
  spacing?: string;
  animated?: boolean;
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 3,
  width = '100%',
  lastLineWidth = '60%',
  spacing,
  animated = true,
}) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing || ds.spacing[3],
      }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? lastLineWidth : width}
          animated={animated}
        />
      ))}
    </div>
  );
};

// ============================================================================
// FILE TREE SKELETON
// ============================================================================

export const FileTreeSkeleton: React.FC<{
  items?: number;
  animated?: boolean;
}> = ({ items = 8, animated = true }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: ds.spacing[3],
        padding: ds.spacing[4],
      }}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: ds.spacing[3],
            paddingLeft: Math.random() > 0.5 ? ds.spacing[5] : 0,
          }}
        >
          <Skeleton
            variant="circular"
            width="20px"
            height="20px"
            animated={animated}
          />
          <Skeleton
            variant="text"
            width={`${Math.floor(Math.random() * 60 + 40)}%`}
            height="14px"
            animated={animated}
          />
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// CODE EDITOR SKELETON
// ============================================================================

export const CodeEditorSkeleton: React.FC<{
  lines?: number;
  animated?: boolean;
}> = ({ lines = 20, animated = true }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        padding: ds.spacing[5],
        backgroundColor: ds.colors.background.secondary,
        borderRadius: ds.borderRadius.md,
        fontFamily: ds.typography.fontFamily.mono,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: ds.spacing[2],
        }}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: ds.spacing[4],
            }}
          >
            {/* Line number */}
            <Skeleton
              variant="text"
              width="24px"
              height="12px"
              animated={animated}
            />
            {/* Code line */}
            <Skeleton
              variant="text"
              width={`${Math.floor(Math.random() * 80 + 20)}%`}
              height="12px"
              animated={animated}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// TERMINAL SKELETON
// ============================================================================

export const TerminalSkeleton: React.FC<{
  lines?: number;
  animated?: boolean;
}> = ({ lines = 10, animated = true }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        padding: ds.spacing[5],
        backgroundColor: ds.isDark ? '#1E1E1E' : '#F5F5F5',
        borderRadius: ds.borderRadius.md,
        fontFamily: ds.typography.fontFamily.mono,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: ds.spacing[3],
        }}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: ds.spacing[3] }}>
            {/* Prompt */}
            {index % 3 === 0 && (
              <Skeleton
                variant="text"
                width="20px"
                height="12px"
                animated={animated}
              />
            )}
            {/* Command/Output */}
            <Skeleton
              variant="text"
              width={`${Math.floor(Math.random() * 70 + 30)}%`}
              height="12px"
              animated={animated}
            />
          </div>
        ))}
        {/* Cursor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: ds.spacing[3] }}>
          <Skeleton
            variant="text"
            width="20px"
            height="12px"
            animated={animated}
          />
          <LazyMotionDiv
            style={{
              width: '8px',
              height: '14px',
              backgroundColor: ds.colors.interactive.primary,
            }}
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CARD SKELETON
// ============================================================================

export interface CardSkeletonProps {
  hasImage?: boolean;
  hasAvatar?: boolean;
  lines?: number;
  animated?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  hasImage = false,
  hasAvatar = false,
  lines = 3,
  animated = true,
}) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        padding: ds.spacing[5],
        backgroundColor: ds.colors.background.secondary,
        borderRadius: ds.borderRadius.lg,
        boxShadow: ds.shadows.sm,
      }}
    >
      {/* Image */}
      {hasImage && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="200px"
          animated={animated}
          style={{ marginBottom: ds.spacing[5] }}
        />
      )}

      {/* Header with avatar */}
      {hasAvatar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: ds.spacing[4],
            marginBottom: ds.spacing[5],
          }}
        >
          <Skeleton
            variant="circular"
            width="40px"
            height="40px"
            animated={animated}
          />
          <div style={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width="120px"
              height="14px"
              animated={animated}
              style={{ marginBottom: ds.spacing[2] }}
            />
            <Skeleton
              variant="text"
              width="80px"
              height="12px"
              animated={animated}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <TextSkeleton lines={lines} animated={animated} />
    </div>
  );
};

// ============================================================================
// LIST SKELETON
// ============================================================================

export const ListSkeleton: React.FC<{
  items?: number;
  variant?: 'simple' | 'detailed';
  animated?: boolean;
}> = ({ items = 5, variant = 'simple', animated = true }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: ds.spacing[4],
      }}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: variant === 'simple' ? 'center' : 'flex-start',
            gap: ds.spacing[4],
            padding: ds.spacing[4],
            backgroundColor: ds.colors.background.secondary,
            borderRadius: ds.borderRadius.md,
          }}
        >
          <Skeleton
            variant="circular"
            width="40px"
            height="40px"
            animated={animated}
          />
          <div style={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width="60%"
              height="14px"
              animated={animated}
              style={{ marginBottom: variant === 'detailed' ? ds.spacing[2] : 0 }}
            />
            {variant === 'detailed' && (
              <Skeleton
                variant="text"
                width="40%"
                height="12px"
                animated={animated}
              />
            )}
          </div>
          {variant === 'detailed' && (
            <Skeleton
              variant="rectangular"
              width="60px"
              height="32px"
              animated={animated}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// TAB BAR SKELETON
// ============================================================================

export const TabBarSkeleton: React.FC<{
  tabs?: number;
  animated?: boolean;
}> = ({ tabs = 4, animated = true }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: `${ds.spacing[3]} ${ds.spacing[5]}`,
        backgroundColor: ds.colors.background.secondary,
        borderRadius: ds.borderRadius.lg,
        gap: ds.spacing[4],
      }}
    >
      {Array.from({ length: tabs }).map((_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: ds.spacing[2],
            flex: 1,
          }}
        >
          <Skeleton
            variant="circular"
            width="24px"
            height="24px"
            animated={animated}
          />
          <Skeleton
            variant="text"
            width="40px"
            height="10px"
            animated={animated}
          />
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// FULL PAGE SKELETON
// ============================================================================

export const IDELoadingSkeleton: React.FC<{
  animated?: boolean;
}> = ({ animated = true }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: ds.colors.background.primary,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: ds.spacing[4],
          borderBottom: `1px solid ${ds.colors.separator.nonOpaque}`,
        }}
      >
        <Skeleton
          variant="rectangular"
          width="100%"
          height="44px"
          animated={animated}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: ds.device.isMobile ? '1fr' : '250px 1fr',
          gap: ds.spacing[4],
          padding: ds.spacing[4],
        }}
      >
        {/* Sidebar */}
        {!ds.device.isMobile && (
          <div>
            <FileTreeSkeleton animated={animated} />
          </div>
        )}

        {/* Editor */}
        <div>
          <CodeEditorSkeleton animated={animated} />
        </div>
      </div>

      {/* Bottom tabs */}
      {ds.device.isMobile && (
        <div
          style={{
            padding: ds.spacing[4],
            borderTop: `1px solid ${ds.colors.separator.nonOpaque}`,
          }}
        >
          <TabBarSkeleton animated={animated} />
        </div>
      )}
    </div>
  );
};

export default Skeleton;
