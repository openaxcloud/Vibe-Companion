import React, { CSSProperties, ReactNode, useMemo } from 'react';
import { createPortal } from 'react-dom';

export type LoaderVariant = 'spinner' | 'dots' | 'skeleton';
export type LoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LoaderProps {
  variant?: LoaderVariant;
  size?: LoaderSize;
  fullScreen?: boolean;
  inline?: boolean;
  message?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * For skeleton: specify width and height
   */
  width?: number | string;
  height?: number | string;
  /**
   * For accessibility: describe what is loading
   */
  ariaLabel?: string;
}

const sizeMap: Record<LoaderSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
};

const getRootPortal = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById('loader-root');
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = 'loader-root';
  document.body.appendChild(el);
  return el;
};

const baseSpinnerStyles: CSSProperties = {
  borderRadius: '9999px',
  borderStyle: 'solid',
  borderWidth: '2px',
  borderTopColor: 'transparent',
  animation: 'loader-spin 0.8s linear infinite',
};

const baseDotsContainerStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
};

const baseDotStyles: CSSProperties = {
  borderRadius: '9999px',
  animation: 'loader-bounce 1.4s infinite ease-in-out both',
};

const skeletonBaseStyles: CSSProperties = {
  borderRadius: 4,
  backgroundSize: '200% 100%',
  animation: 'loader-skeleton 1.4s ease-in-out infinite',
};

const getThemeAwareColors = (): {
  primary: string;
  muted: string;
  backdrop: string;
  text: string;
} => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      primary: '#3b82f6',
      muted: '#e5e7eb',
      backdrop: 'rgba(15, 23, 42, 0.55)',
      text: '#111827',
    };
  }

  const root = document.documentElement;
  const computed = window.getComputedStyle(root);

  const fromVar = (name: string, fallback: string) =>
    computed.getPropertyValue(name)?.trim() || fallback;

  const isDark =
    root.classList.contains('dark') ||
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return {
    primary: fromVar('--color-primary', isDark ? '#60a5fa' : '#2563eb'),
    muted: fromVar('--color-muted', isDark ? '#1f2937' : '#e5e7eb'),
    backdrop: fromVar('--color-backdrop', isDark ? 'rgba(15,23,42,0.80)' : 'rgba(15,23,42,0.55)'),
    text: fromVar('--color-text', isDark ? '#e5e7eb' : '#111827'),
  };
};

const ensureGlobalStyles = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const style = document.createElement('style');
    style.setAttribute('data-loader-styles', 'true');
    style.innerHTML = `
@keyframes loader-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes loader-bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

@keyframes loader-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
    document.head.appendChild(style);
  };
})();

const LoaderContent: React.FC<LoaderProps> = ({
  variant = 'spinner',
  size = 'md',
  inline,
  message,
  className,
  style,
  width,
  height,
  ariaLabel = 'Loading',
}) => {
  const { primary, muted, text } = useMemo(() => getThemeAwareColors(), []);

  const dimension = sizeMap[size];

  const containerStyle: CSSProperties = {
    display: inline ? 'inline-flex' : 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: message ? '0.5rem' : 0,
    color: text,
    ...style,
  };

  const renderSpinner = () => {
    const spinnerStyle: CSSProperties = {
      ...baseSpinnerStyles,
      width: dimension,
      height: dimension,
      borderColor: muted,
      borderTopColor: primary,
    };
    return <span style={spinnerStyle} aria-hidden="true" />;
  };

  const renderDots = () => {
    const baseSize = dimension / 4;
    const dotSize = Math.max(4, baseSize);
    const dotStyle: CSSProperties = {
      ...baseDotStyles,
      width: dotSize,
      height: dotSize,
      backgroundColor: primary,
    };
    return (
      <span style={baseDotsContainerStyles} aria-hidden="true">
        <span style={{ ...dotStyle, animationDelay: '-0.32s' }} />
        <span style={{ ...dotStyle, animationDelay: '-0.16s' }} />
        <span style={dotStyle} />
      </span>
    );
  };

  const renderSkeleton = () => {
    const skeletonStyle: CSSProperties = {
      ...skeletonBaseStyles,
      width: width ?? '100%',
      height: height ?? dimension,
      backgroundImage: `linear-gradient(90deg, undefined 0px, undefined 50%, undefined 100%)`,
      backgroundColor: muted,
    };
    return <span style={skeletonStyle} aria-hidden="true" />;
  };

  const visual = (() => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'skeleton':
        return renderSkeleton();
      case 'spinner':
      default:
        return renderSpinner();
    }
  })();

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-busy="true"
      className={className}
      style={containerStyle}
    >
      {visual}
      {message && (
        <span style={{ fontSize: 14, lineHeight: 1.25, opacity: 0.9 }}>{message}</span>
      )}
    </div>
  );
};

const FullScreenWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { backdrop } = useMemo(() => getThemeAwareColors(), []);
  const portalRoot = getRootPortal();

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: backdrop,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  };

  const contentStyle: CSSProperties = {
    pointerEvents: 'auto',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    backgroundColor: 'rgba(15,23,42,0.9)',
    backdropFilter: 'blur(4px)',
    boxShadow: '0 10px 40px rgba(15,23,42,0.5)',
  };

  const content = (
    <div style={overlayStyle}>
      <div style={contentStyle}>{children}</div>
    </div>
  );

  if (!portalRoot) {
    return content;
  }

  return createPortal(content, portalRoot);
};

export const Loader: React.FC<LoaderProps> = (props) => {
  ensureGlobalStyles();

  const { fullScreen = false, ...rest } = props;

  if (fullScreen) {
    return (
      <FullScreenWrapper>
        <LoaderContent {...rest} />
      </FullScreenWrapper>
    );
  }

  return <LoaderContent {...rest} />;
};

export default Loader;