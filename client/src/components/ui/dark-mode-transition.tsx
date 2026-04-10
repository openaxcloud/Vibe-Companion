import React, { useEffect, useState } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeTransitionWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ThemeTransitionWrapper({
  children,
  className
}: ThemeTransitionWrapperProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check initial theme
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme);

    // Create observer for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
          if (newTheme !== theme) {
            setIsTransitioning(true);
            setTheme(newTheme);
            setTimeout(() => setIsTransitioning(false), 500);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [theme]);

  return (
    <div className={cn('relative', className)}>
      <LazyAnimatePresence>
        {isTransitioning && (
          <LazyMotionDiv
            className="fixed inset-0 z-[100] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LazyMotionDiv
              className="absolute inset-0 bg-gradient-to-br from-orange-100 to-yellow-100 dark:from-gray-900 dark:to-black"
              initial={{ scale: 0, borderRadius: '100%' }}
              animate={{ scale: 2, borderRadius: '0%' }}
              exit={{ scale: 0, borderRadius: '100%' }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{
                transformOrigin: 'top right'
              }}
            />
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
      
      <div className="transition-colors duration-500">
        {children}
      </div>
    </div>
  );
}

interface AnimatedThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedThemeToggle({
  className,
  size = 'md'
}: AnimatedThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const currentTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setTheme(currentTheme);
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Add transition class
    document.documentElement.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Toggle theme
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    
    // Cleanup
    setTimeout(() => {
      document.documentElement.style.transition = '';
      setIsAnimating(false);
    }, 500);
  };

  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const buttonSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <LazyMotionButton
      className={cn(
        'relative rounded-full bg-gray-200 dark:bg-gray-800 p-2 transition-colors duration-300',
        buttonSize,
        className
      )}
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={{ rotate: isAnimating ? 360 : 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <LazyAnimatePresence mode="wait">
        {theme === 'light' ? (
          <LazyMotionDiv
            key="sun"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Sun className={cn(iconSize, 'text-yellow-500')} />
          </LazyMotionDiv>
        ) : (
          <LazyMotionDiv
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Moon className={cn(iconSize, 'text-blue-500')} />
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </LazyMotionButton>
  );
}

interface ColorTransitionProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export function ColorTransition({
  children,
  className,
  duration = 500
}: ColorTransitionProps) {
  return (
    <div
      className={cn(
        'transition-all',
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {children}
    </div>
  );
}

// Global styles for smooth theme transitions
export const themeTransitionStyles = `
  * {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 0ms;
  }
  
  html.transitioning * {
    transition-duration: 500ms !important;
  }
  
  /* Prevent transition on page load */
  html:not(.transitioning) * {
    transition-duration: 0ms !important;
  }
  
  /* Elements that should always transition smoothly */
  .theme-transition {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 500ms !important;
  }
  
  /* Respect prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    * {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
`;

// Hook for theme management
export function useThemeTransition() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const currentTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    setIsTransitioning(true);
    document.documentElement.classList.add('transitioning');
    
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    
    setTimeout(() => {
      document.documentElement.classList.remove('transitioning');
      setIsTransitioning(false);
    }, 500);
  };

  return { theme, toggleTheme, isTransitioning };
}