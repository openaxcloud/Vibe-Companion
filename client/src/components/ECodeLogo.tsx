import { cn } from '@/lib/utils';

interface ECodeLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizeMap: Record<NonNullable<ECodeLogoProps['size']>, { icon: string; text: string }> = {
  xs: { icon: 'h-6 w-6', text: 'text-base' },
  sm: { icon: 'h-7 w-7', text: 'text-[15px]' },
  md: { icon: 'h-9 w-9', text: 'text-xl' },
  lg: { icon: 'h-11 w-11', text: 'text-2xl' }
};

export function ECodeLogo({ className, size = 'md', showText = true }: ECodeLogoProps) {
  const resolvedSize = sizeMap[size] ?? sizeMap.md;

  return (
    <div className={cn('flex flex-row items-center gap-2 flex-nowrap whitespace-nowrap', className)}>
      <svg
        className={cn(resolvedSize.icon, 'shrink-0')}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle */}
        <circle cx="20" cy="20" r="20" fill="url(#gradient)" />
        
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
          <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="#F26207" />
            <stop offset="100%" stopColor="#F99D25" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <span className={cn('font-bold', resolvedSize.text)}>
          E-Code
        </span>
      )}
    </div>
  );
}

// Favicon version - simplified for small size
export function ECodeFavicon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="url(#favicon-gradient)" />
      
      {/* Simplified E with code bracket */}
      <path
        d="M10 8 L10 16 L10 24 M10 8 L18 8 M10 16 L16 16 M10 24 L18 24"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M20 13 L23 16 L20 19"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <defs>
        <linearGradient id="favicon-gradient" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#F26207" />
          <stop offset="100%" stopColor="#F99D25" />
        </linearGradient>
      </defs>
    </svg>
  );
}