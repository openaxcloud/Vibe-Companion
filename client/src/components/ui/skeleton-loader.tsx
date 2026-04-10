import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'shimmer';
  lines?: number;
  spacing?: number;
}

export function SkeletonLoader({
  className,
  variant = 'rectangular',
  width = '100%',
  height = '20px',
  animation = 'shimmer',
  lines = 1,
  spacing = 8,
}: SkeletonLoaderProps) {
  const baseClasses = cn(
    'relative overflow-hidden bg-muted/50',
    {
      'rounded-full': variant === 'circular',
      'rounded-md': variant === 'rounded',
      'rounded-sm': variant === 'text',
      'rounded-none': variant === 'rectangular',
    },
    className
  );

  const shimmerGradient = (
    <div
      className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
      style={{
        background: `linear-gradient(90deg, transparent, rgba(242, 98, 7, 0.15), transparent)`,
      }}
    />
  );

  const pulseAnimation = animation === 'pulse' ? 'animate-pulse' : '';
  const waveAnimation = animation === 'wave' ? 'animate-wave' : '';

  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(baseClasses, pulseAnimation)}
            style={{
              width: index === lines - 1 ? '80%' : width,
              height,
              marginTop: index > 0 ? spacing : 0,
            }}
          >
            {animation === 'shimmer' && shimmerGradient}
          </div>
        ))}
      </div>
    );
  }

  const skeletonElement = (
    <div
      className={cn(baseClasses, pulseAnimation, waveAnimation)}
      style={{ width, height }}
    >
      {animation === 'shimmer' && shimmerGradient}
    </div>
  );

  return skeletonElement;
}

// Pre-built skeleton components for common use cases
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 rounded-lg border bg-card', className)}>
      <SkeletonLoader variant="rounded" height={200} className="mb-4" />
      <SkeletonLoader variant="text" height={24} width="60%" className="mb-2" />
      <SkeletonLoader variant="text" height={16} lines={2} />
      <div className="flex gap-2 mt-4">
        <SkeletonLoader variant="rounded" height={32} width={80} />
        <SkeletonLoader variant="rounded" height={32} width={80} />
      </div>
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <SkeletonLoader 
      variant="circular" 
      width={size} 
      height={size}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <SkeletonLoader 
      variant="text" 
      lines={lines}
      className={className}
    />
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 pb-4 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLoader key={i} height={20} width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3 border-b">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLoader 
              key={colIndex} 
              height={16} 
              width={`${100 / columns}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonLoader
            key={i}
            variant="rectangular"
            width="12%"
            height={`${Math.random() * 80 + 20}%`}
            animation="wave"
          />
        ))}
      </div>
    </div>
  );
}