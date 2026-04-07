import { cn } from '@/lib/utils';

interface ECodeLoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

export function ECodeLoading({ 
  className, 
  size = 'md', 
  text = 'Loading...', 
  fullScreen = false 
}: ECodeLoadingProps) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const loadingContent = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className="relative">
        <svg
          className={cn(sizes[size], 'animate-spin')}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle with opacity */}
          <circle cx="20" cy="20" r="20" fill="url(#loading-gradient)" opacity="0.2" />
          
          {/* Spinning circle */}
          <circle 
            cx="20" 
            cy="20" 
            r="18" 
            fill="none"
            stroke="url(#loading-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="80 20"
            className="origin-center"
          />
          
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
            <linearGradient id="loading-gradient" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stopColor="#F26207" />
              <stop offset="100%" stopColor="#F99D25" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Pulsing effect */}
        <div className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-br from-[#F26207] to-[#F99D25] opacity-20 animate-pulse',
          sizes[size]
        )} />
      </div>
      
      {text && (
        <p className={cn('text-[var(--ecode-text-secondary)] animate-pulse', textSizes[size])}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-[var(--ecode-background)] z-50 flex items-center justify-center">
        {loadingContent}
      </div>
    );
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