import { useState, useEffect, useRef, useMemo } from 'react';

// Image optimization configuration
interface ImageConfig {
  enableLazyLoading: boolean;
  enableWebP: boolean;
  enableProgressive: boolean;
  enablePlaceholder: boolean;
  placeholderType: 'blur' | 'lqip' | 'solid' | 'skeleton';
  rootMargin: string;
  threshold: number | number[];
  fadeInDuration: number;
  retryAttempts: number;
  retryDelay: number;
}

// Image source set for responsive loading
interface ImageSrcSet {
  src: string;
  width?: number;
  descriptor?: string;
}

// Picture source for different formats
interface PictureSource {
  srcSet: string;
  type: string;
  media?: string;
  sizes?: string;
}

// Default configuration
const defaultConfig: ImageConfig = {
  enableLazyLoading: true,
  enableWebP: true,
  enableProgressive: true,
  enablePlaceholder: true,
  placeholderType: 'blur',
  rootMargin: '50px 0px',
  threshold: 0.01,
  fadeInDuration: 300,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Generate placeholder for images
function generatePlaceholder(type: ImageConfig['placeholderType'], width = 400, height = 300): string {
  switch (type) {
    case 'blur':
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23e5e7eb' filter='url(%23b)'/%3E%3C/svg%3E`;
    case 'solid':
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Crect width='100%25' height='100%25' fill='%23e5e7eb'/%3E%3C/svg%3E`;
    case 'skeleton':
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Cdefs%3E%3ClinearGradient id='g'%3E%3Cstop offset='0%25' stop-color='%23e5e7eb'/%3E%3Cstop offset='50%25' stop-color='%23f3f4f6'/%3E%3Cstop offset='100%25' stop-color='%23e5e7eb'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'%3E%3Canimate attributeName='x' from='-100%25' to='100%25' dur='1.5s' repeatCount='indefinite'/%3E%3C/rect%3E%3C/svg%3E`;
    case 'lqip':
    default:
      return `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=`;
  }
}

// Generate responsive image srcset
function generateSrcSet(src: string, sizes: number[]): string {
  const ext = src.split('.').pop();
  const basePath = src.replace(`.${ext}`, '');
  
  return sizes
    .map(size => `${basePath}-${size}w.${ext} ${size}w`)
    .join(', ');
}

// Generate WebP source
function generateWebPSource(src: string): string {
  return src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

// Hook for lazy loading images
export function useLazyImage(
  src: string,
  options: Partial<ImageConfig> = {}
): {
  imageSrc: string;
  isLoading: boolean;
  isError: boolean;
  isIntersecting: boolean;
  retry: () => void;
} {
  const config = { ...defaultConfig, ...options };
  const [imageSrc, setImageSrc] = useState(
    config.enablePlaceholder ? generatePlaceholder(config.placeholderType) : ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!config.enableLazyLoading) {
      loadImage();
      return;
    }

    const element = imgRef.current;
    if (!element || !('IntersectionObserver' in window)) {
      loadImage();
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          loadImage();
          observerRef.current?.unobserve(element);
        }
      },
      {
        rootMargin: config.rootMargin,
        threshold: config.threshold,
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, retryCount]);

  const loadImage = () => {
    if (isLoading || imageSrc === src) return;

    setIsLoading(true);
    setIsError(false);

    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setIsError(true);
      setIsLoading(false);
      
      if (retryCount < config.retryAttempts) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, config.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      }
    };

    img.src = src;
  };

  const retry = () => {
    setRetryCount(0);
    setIsError(false);
    loadImage();
  };

  return {
    imageSrc,
    isLoading,
    isError,
    isIntersecting,
    retry,
  };
}

// Optimized image component
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  srcSet?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'sync' | 'async' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
  config?: Partial<ImageConfig>;
}

export function OptimizedImage({
  src,
  alt,
  placeholder,
  srcSet,
  sizes,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  onLoad,
  onError,
  config = {},
  className = '',
  ...props
}: OptimizedImageProps) {
  const imgConfig = { ...defaultConfig, ...config };
  const imgRef = useRef<HTMLImageElement>(null);
  const { imageSrc, isLoading, isError, retry } = useLazyImage(src, imgConfig);
  
  const handleLoad = () => {
    onLoad?.();
  };

  const handleError = () => {
    onError?.();
  };

  const imageClasses = useMemo(() => {
    const classes = [className];
    
    if (isLoading) {
      classes.push('opacity-50');
    }
    
    if (imgConfig.fadeInDuration > 0 && !isLoading) {
      classes.push(`transition-opacity duration-${imgConfig.fadeInDuration}`);
    }
    
    return classes.join(' ');
  }, [className, isLoading, imgConfig.fadeInDuration]);

  if (isError) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 ${className}`}
        {...props}
      >
        <div className="text-center p-4">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[13px] text-gray-600">Failed to load image</p>
          <button
            onClick={retry}
            className="mt-2 text-[13px] text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      srcSet={srcSet}
      sizes={sizes}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onLoad={handleLoad}
      onError={handleError}
      className={imageClasses}
      {...props}
    />
  );
}

// Picture component for responsive images with format fallbacks
interface ResponsivePictureProps {
  src: string;
  alt: string;
  sources?: PictureSource[];
  sizes?: string;
  className?: string;
  config?: Partial<ImageConfig>;
  onLoad?: () => void;
  onError?: () => void;
}

export function ResponsivePicture({
  src,
  alt,
  sources = [],
  sizes,
  className = '',
  config = {},
  onLoad,
  onError,
}: ResponsivePictureProps) {
  const imgConfig = { ...defaultConfig, ...config };
  
  // Generate WebP sources if enabled
  const allSources = useMemo(() => {
    const result: PictureSource[] = [...sources];
    
    if (imgConfig.enableWebP && !sources.some(s => s.type === 'image/webp')) {
      // Add WebP version for each existing source
      sources.forEach(source => {
        if (source.type !== 'image/webp') {
          result.unshift({
            ...source,
            srcSet: source.srcSet.replace(/\.(jpg|jpeg|png)/gi, '.webp'),
            type: 'image/webp',
          });
        }
      });
      
      // Add WebP version of main image
      result.unshift({
        srcSet: generateWebPSource(src),
        type: 'image/webp',
      });
    }
    
    return result;
  }, [sources, src, imgConfig.enableWebP]);

  return (
    <picture>
      {allSources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          type={source.type}
          media={source.media}
          sizes={source.sizes || sizes}
        />
      ))}
      <OptimizedImage
        src={src}
        alt={alt}
        sizes={sizes}
        className={className}
        config={config}
        onLoad={onLoad}
        onError={onError}
      />
    </picture>
  );
}

// Background image optimization hook
export function useOptimizedBackgroundImage(
  src: string,
  options: Partial<ImageConfig> = {}
): {
  backgroundImage: string;
  isLoading: boolean;
  isError: boolean;
} {
  const config = { ...defaultConfig, ...options };
  const { imageSrc, isLoading, isError } = useLazyImage(src, config);
  
  const backgroundImage = useMemo(() => {
    if (!imageSrc) return '';
    return `url(${imageSrc})`;
  }, [imageSrc]);

  return {
    backgroundImage,
    isLoading,
    isError,
  };
}

// Preload critical images
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      url =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to preload ${url}`));
          img.src = url;
        })
    )
  );
}

// Add link preload tags for critical images
export function addImagePreloadLinks(urls: string[]): void {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    
    // Add type for WebP images
    if (url.endsWith('.webp')) {
      link.type = 'image/webp';
    }
    
    document.head.appendChild(link);
  });
}

// Clean up preload links
export function removeImagePreloadLinks(urls: string[]): void {
  const links = document.querySelectorAll('link[rel="preload"][as="image"]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && urls.includes(href)) {
      link.remove();
    }
  });
}

// Export utilities
export default {
  useLazyImage,
  OptimizedImage,
  ResponsivePicture,
  useOptimizedBackgroundImage,
  preloadImages,
  addImagePreloadLinks,
  removeImagePreloadLinks,
  generatePlaceholder,
  generateSrcSet,
  generateWebPSource,
};