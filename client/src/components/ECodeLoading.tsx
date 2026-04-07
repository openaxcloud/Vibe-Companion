import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertCircle } from 'lucide-react';

const LOADING_TIMEOUT_MS = 15000;

interface ECodeLoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
  centered?: boolean;
  containerClassName?: string;
  timeoutMs?: number;
}

export function ECodeLoading({ 
  className, 
  size = 'md', 
  text = 'Loading...', 
  fullScreen = false,
  centered = false,
  containerClassName,
  timeoutMs = LOADING_TIMEOUT_MS
}: ECodeLoadingProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!fullScreen && !centered) return;
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [fullScreen, centered, timeoutMs]);
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  const textSizes = {
    sm: 'text-[13px]',
    md: 'text-base',
    lg: 'text-[15px]',
    xl: 'text-xl'
  };

  const loadingContent = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('relative', sizes[size])}>
        {/* Spinning ring around the logo */}
        <svg
          className="animate-spin absolute inset-0 w-full h-full"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle 
            cx="20" 
            cy="20" 
            r="18" 
            fill="none"
            stroke="url(#loading-ring-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="70 30"
            opacity="0.8"
          />
          <defs>
            <linearGradient id="loading-ring-gradient" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stopColor="#F26207" />
              <stop offset="100%" stopColor="#F99D25" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Static E-Code logo in center */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle */}
          <circle cx="20" cy="20" r="14" fill="url(#loading-logo-gradient)" />
          
          {/* Letter E stylized as code brackets */}
          <path
            d="M14 12 L14 20 L14 28 M14 12 L22 12 M14 20 L20 20 M14 28 L22 28"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Code symbols < > */}
          <path
            d="M26 16 L30 20 L26 24"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="loading-logo-gradient" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stopColor="#F26207" />
              <stop offset="100%" stopColor="#F99D25" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Pulsing effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F26207] to-[#F99D25] opacity-20 animate-pulse" />
      </div>
      
      {text && (
        <p className={cn('text-[var(--ecode-text-secondary)] animate-pulse', textSizes[size])}>
          {text}
        </p>
      )}
    </div>
  );

  const timedOutContent = (
    <div className="flex flex-col items-center justify-center gap-4 max-w-md px-6 text-center">
      <div className="p-3 rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Taking longer than expected</h3>
      <p className="text-sm text-muted-foreground">
        The page is taking longer than usual to load. This might be a temporary issue.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        data-testid="loading-timeout-refresh"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh Page
      </button>
    </div>
  );

  if (fullScreen) {
    const content = (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center" data-testid="ecode-loading-fullscreen">
        {timedOut ? timedOutContent : loadingContent}
      </div>
    );
    if (typeof document !== 'undefined') {
      return createPortal(content, document.body);
    }
    return content;
  }

  if (centered) {
    const content = (
      <div className={cn('fixed inset-0 flex items-center justify-center w-full h-full bg-background/80 backdrop-blur-sm z-40', containerClassName)}>
        {timedOut ? timedOutContent : loadingContent}
      </div>
    );
    if (typeof document !== 'undefined') {
      return createPortal(content, document.body);
    }
    return content;
  }

  return loadingContent;
}

// Inline loading spinner for buttons and small spaces
export function ECodeSpinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="12" fill="url(#spinner-gradient)" opacity="0.2" />
      <circle 
        cx="12" 
        cy="12" 
        r="10" 
        fill="none"
        stroke="url(#spinner-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="60 10"
      />
      <path
        d="M8 7 L8 12 L8 17 M8 7 L13 7 M8 12 L11 12 M8 17 L13 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <defs>
        <linearGradient id="spinner-gradient" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#F26207" />
          <stop offset="100%" stopColor="#F99D25" />
        </linearGradient>
      </defs>
    </svg>
  );
}