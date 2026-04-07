import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderSrc?: string;
  blurUp?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className,
  placeholderSrc,
  blurUp = true,
  onLoad,
  onError
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [imageSrc, setImageSrc] = useState(placeholderSrc || '');

  useEffect(() => {
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      onLoad?.();
    };
    
    img.onerror = () => {
      setIsError(true);
      setIsLoading(false);
      onError?.();
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);

  if (isError) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100 dark:bg-gray-800', className)}>
        <span className="text-gray-400">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && (
        <Skeleton className="absolute inset-0 z-10" />
      )}
      
      <img
        src={imageSrc}
        alt={alt}
        className={cn(
          'w-full h-full object-cover transition-all duration-700',
          blurUp && isLoading && 'blur-lg scale-105',
          !isLoading && 'blur-0 scale-100',
          isLoading ? 'opacity-50' : 'opacity-100'
        )}
      />
    </div>
  );
}

interface ProgressiveImageProps extends LazyImageProps {
  lowQualitySrc: string;
}

export function ProgressiveImage({
  src,
  lowQualitySrc,
  alt,
  className,
  onLoad,
  onError,
  ...props
}: ProgressiveImageProps) {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsHighResLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      onError?.();
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={cn(
        'transition-all duration-1000 animate-fadeIn',
        !isHighResLoaded && 'filter blur-sm',
        className
      )}
      {...props}
    />
  );
}