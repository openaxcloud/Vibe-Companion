// @ts-nocheck
/**
 * Empty State Component
 * Beautiful empty states for various scenarios
 */

import React from 'react';
import { LazyMotionDiv, LazyMotionButton } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';

// ============================================================================
// TYPES
// ============================================================================

export interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary';
  };
  illustration?: 'files' | 'search' | 'error' | 'network' | 'custom';
  animated?: boolean;
}

// ============================================================================
// ILLUSTRATIONS
// ============================================================================

const Illustrations = {
  files: (color: string) => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-fadeIn">
      <rect
        x="30"
        y="20"
        width="50"
        height="70"
        rx="4"
        fill={color}
        opacity="0.1"
        className="animate-slide-in-up"
        style={{ animationDelay: '0.1s' }}
      />
      <rect
        x="40"
        y="30"
        width="50"
        height="70"
        rx="4"
        fill={color}
        opacity="0.15"
        className="animate-slide-in-up"
        style={{ animationDelay: '0.2s' }}
      />
      <rect
        x="50"
        y="40"
        width="50"
        height="70"
        rx="4"
        fill={color}
        opacity="0.2"
        className="animate-slide-in-up"
        style={{ animationDelay: '0.3s' }}
      />
    </svg>
  ),

  search: (color: string) => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-fadeIn">
      <circle
        cx="50"
        cy="50"
        r="25"
        stroke={color}
        strokeWidth="4"
        opacity="0.2"
        fill="none"
        className="animate-scale-in"
      />
      <line
        x1="70"
        y1="70"
        x2="85"
        y2="85"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.2"
        className="animate-fadeIn"
        style={{ animationDelay: '0.3s' }}
      />
    </svg>
  ),

  error: (color: string) => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-fadeIn">
      <circle
        cx="60"
        cy="60"
        r="30"
        stroke={color}
        strokeWidth="4"
        opacity="0.2"
        fill="none"
        className="animate-scale-in"
      />
      <path
        d="M45 45 L75 75 M75 45 L45 75"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.3"
        className="animate-fadeIn"
        style={{ animationDelay: '0.3s' }}
      />
    </svg>
  ),

  network: (color: string) => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-fadeIn">
      <path
        d="M30 60 Q45 40, 60 60 T90 60"
        stroke={color}
        strokeWidth="3"
        fill="none"
        opacity="0.2"
        className="animate-pulse"
      />
      <circle
        cx="60"
        cy="60"
        r="5"
        fill={color}
        opacity="0.3"
        className="animate-scale-in"
        style={{ animationDelay: '0.5s' }}
      />
    </svg>
  ),
};

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  illustration = 'files',
  animated = true,
}) => {
  const ds = useDesignSystem();

  const illustrationColor = ds.colors.text.tertiary;

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  const Container = animated ? LazyMotionDiv : 'div';
  const Item = animated ? LazyMotionDiv : 'div';

  return (
    <Container
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${ds.spacing[12]} ${ds.spacing[5]}`,
        textAlign: 'center',
        minHeight: '400px',
      }}
      {...(animated && {
        variants: containerVariants,
        initial: 'hidden',
        animate: 'visible',
      })}
    >
      {/* Illustration or Icon */}
      <Item {...(animated && { variants: itemVariants })}>
        {icon ? (
          typeof icon === 'string' ? (
            <div
              style={{
                fontSize: '64px',
                marginBottom: ds.spacing[5],
                opacity: 0.6,
              }}
            >
              {icon}
            </div>
          ) : (
            <div style={{ marginBottom: ds.spacing[5] }}>{icon}</div>
          )
        ) : (
          <div style={{ marginBottom: ds.spacing[5] }}>
            {Illustrations[illustration](illustrationColor)}
          </div>
        )}
      </Item>

      {/* Title */}
      <Item {...(animated && { variants: itemVariants })}>
        <h3
          style={{
            ...ds.typography.textStyles.title2,
            color: ds.colors.text.primary,
            marginBottom: ds.spacing[3],
            margin: 0,
          }}
        >
          {title}
        </h3>
      </Item>

      {/* Description */}
      {description && (
        <Item {...(animated && { variants: itemVariants })}>
          <p
            style={{
              ...ds.typography.textStyles.body,
              color: ds.colors.text.secondary,
              maxWidth: '400px',
              marginBottom: action ? ds.spacing[7] : 0,
              margin: action ? `0 0 ${ds.spacing[7]} 0` : 0,
            }}
          >
            {description}
          </p>
        </Item>
      )}

      {/* Action Button */}
      {action && (
        <Item {...(animated && { variants: itemVariants })}>
          <LazyMotionButton
            onClick={action.onPress}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            style={{
              ...ds.typography.textStyles.callout,
              fontWeight: 600,
              padding: `${ds.spacing[4]} ${ds.spacing[7]}`,
              backgroundColor:
                action.variant === 'secondary'
                  ? ds.colors.fill.secondary
                  : ds.colors.interactive.primary,
              color:
                action.variant === 'secondary'
                  ? ds.colors.text.primary
                  : '#FFFFFF',
              border: 'none',
              borderRadius: ds.borderRadius.lg,
              cursor: 'pointer',
              minHeight: ds.touchTargets.min,
              boxShadow: action.variant === 'primary' ? ds.shadows.sm : 'none',
            }}
          >
            {action.label}
          </LazyMotionButton>
        </Item>
      )}
    </Container>
  );
};

// ============================================================================
// PRESET EMPTY STATES
// ============================================================================

export const NoFilesEmptyState: React.FC<{
  onCreateFile?: () => void;
}> = ({ onCreateFile }) => (
  <EmptyState
    illustration="files"
    title="No Files Yet"
    description="Create your first file to get started with your project."
    action={
      onCreateFile
        ? {
            label: 'Create File',
            onPress: onCreateFile,
          }
        : undefined
    }
  />
);

export const SearchEmptyState: React.FC<{
  query?: string;
}> = ({ query }) => (
  <EmptyState
    illustration="search"
    title="No Results Found"
    description={
      query
        ? `We couldn't find anything matching "${query}". Try a different search term.`
        : 'Try searching for files, folders, or code snippets.'
    }
  />
);

export const ErrorEmptyState: React.FC<{
  onRetry?: () => void;
  message?: string;
}> = ({ onRetry, message }) => (
  <EmptyState
    illustration="error"
    title="Something Went Wrong"
    description={message || 'An error occurred while loading the content. Please try again.'}
    action={
      onRetry
        ? {
            label: 'Try Again',
            onPress: onRetry,
          }
        : undefined
    }
  />
);

export const NetworkEmptyState: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <EmptyState
    illustration="network"
    title="No Connection"
    description="Please check your internet connection and try again."
    action={
      onRetry
        ? {
            label: 'Retry',
            onPress: onRetry,
          }
        : undefined
    }
  />
);

export default EmptyState;
