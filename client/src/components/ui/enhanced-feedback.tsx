import React, { useEffect, useState } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FeedbackProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
  className?: string;
}

export function EnhancedToast({
  type = 'info',
  title,
  description,
  onClose,
  autoClose = true,
  duration = 5000,
  className
}: FeedbackProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 checkmark-animation" />,
    error: <XCircle className="w-5 h-5 text-red-500 error-shake" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500 pulse-animation" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const colors = {
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
  };

  return (
    <LazyAnimatePresence>
      {isVisible && (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
            colors[type],
            className
          )}
        >
          <div className="flex-shrink-0">{icons[type]}</div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{title}</h4>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => {
                setIsVisible(false);
                onClose();
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </LazyMotionDiv>
      )}
    </LazyAnimatePresence>
  );
}

export function LoadingSpinner({
  size = 'md',
  className,
  text
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative">
        <div
          className={cn(
            'spinner-ecode',
            sizeClasses[size]
          )}
        />
        <LazyMotionDiv
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className={cn(
              'rounded-full border-2 border-transparent border-t-secondary',
              sizeClasses[size]
            )}
          />
        </LazyMotionDiv>
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-fadeIn">
          {text}
        </p>
      )}
    </div>
  );
}

export function PulsingAlert({
  type = 'warning',
  children,
  className
}: {
  type?: 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const colors = {
    warning: 'border-primary bg-orange-50 dark:bg-orange-950/20',
    error: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    info: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
  };

  return (
    <LazyMotionDiv
      animate={{
        boxShadow: [
          '0 0 0 0 rgba(242, 98, 7, 0)',
          '0 0 0 8px rgba(242, 98, 7, 0.1)',
          '0 0 0 0 rgba(242, 98, 7, 0)'
        ]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
      className={cn(
        'p-4 rounded-lg border-2',
        colors[type],
        className
      )}
    >
      {children}
    </LazyMotionDiv>
  );
}

export function SuccessCheckmark({
  text = 'Success!',
  onComplete
}: {
  text?: string;
  onComplete?: () => void;
}) {
  return (
    <LazyMotionDiv
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      className="flex flex-col items-center gap-4"
    >
      <LazyMotionDiv
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ 
          duration: 0.5, 
          delay: 0.2,
          type: 'spring',
          stiffness: 200 
        }}
        className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
      >
        <CheckCircle className="w-10 h-10 text-green-500" />
      </LazyMotionDiv>
      <p className="text-lg font-semibold animate-fadeIn" style={{ animationDelay: '0.4s' }}>
        {text}
      </p>
    </LazyMotionDiv>
  );
}

export function ErrorShake({
  title,
  description,
  onRetry
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <LazyMotionDiv
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
        x: [0, -10, 10, -10, 10, 0]
      }}
      transition={{
        x: {
          duration: 0.5,
          delay: 0.2
        }
      }}
      className="flex flex-col items-center gap-4 p-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
    >
      <XCircle className="w-12 h-12 text-red-500" />
      <div className="text-center">
        <h3 className="font-semibold text-lg">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="destructive"
          className="btn-interactive"
        >
          Try Again
        </Button>
      )}
    </LazyMotionDiv>
  );
}

export function AnimatedProgress({
  value,
  max = 100,
  className,
  showLabel = true
}: {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const percentage = (value / max) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-transform duration-500 ease-out origin-left"
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
      </div>
      {showLabel && (
        <p className="text-sm text-muted-foreground mt-2 text-center animate-fadeIn" style={{ animationDelay: '0.3s' }}>
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
}