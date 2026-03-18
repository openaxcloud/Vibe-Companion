import { cn } from '@/lib/utils';

interface ECodeLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export function ECodeLoading({ size = 'md', text, fullScreen, className }: ECodeLoadingProps) {
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('border-2 border-[#0079F2] border-t-transparent rounded-full animate-spin', sizeMap[size])} />
      {text && <p className="text-xs text-[var(--ide-text-muted)]">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ide-bg)]">
        {content}
      </div>
    );
  }

  return content;
}
