import React, { useEffect, useState } from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface AnimatedChartWrapperProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  type?: 'fade' | 'slide' | 'scale' | 'draw';
}

export function AnimatedChartWrapper({
  children,
  className,
  delay = 0,
  duration = 0.8,
  type = 'fade'
}: AnimatedChartWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  const variants = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 }
    },
    slide: {
      hidden: { opacity: 0, x: -50 },
      visible: { opacity: 1, x: 0 }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 }
    },
    draw: {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 1 }
    }
  };

  return (
    <LazyMotionDiv
      className={cn('w-full h-full', className)}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={variants[type]}
      transition={{
        duration,
        ease: 'easeOut',
        ...(type === 'draw' && {
          pathLength: { duration: duration * 2, ease: 'easeInOut' }
        })
      }}
    >
      {children}
    </LazyMotionDiv>
  );
}

interface AnimatedValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
  duration?: number;
}

export function AnimatedValue({
  value,
  prefix = '',
  suffix = '',
  className,
  decimals = 0,
  duration = 1
}: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const difference = value - startValue;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + difference * easeOut;
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  className?: string;
}

export function AnimatedChartTooltip({
  active,
  payload,
  label,
  className
}: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-white dark:bg-gray-900 dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700',
        className
      )}
    >
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
          <AnimatedValue
            value={entry.value}
            className="font-medium"
            decimals={entry.unit === '%' ? 1 : 0}
            suffix={entry.unit || ''}
          />
        </div>
      ))}
    </LazyMotionDiv>
  );
}

export function ChartLoadingSkeleton({ type = 'line' }: { type?: 'line' | 'bar' | 'pie' }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full h-full animate-pulse">
        {type === 'pie' ? (
          <div className="w-48 h-48 mx-auto rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded" />
        )}
      </div>
    </div>
  );
}