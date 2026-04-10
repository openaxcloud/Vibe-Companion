/**
 * Responsive Design System for E-Code
 * Matching Replit's responsive breakpoints and design patterns
 */

// Breakpoints matching Replit's responsive design
export const breakpoints = {
  xs: '480px',   // Mobile portrait
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / Small desktop
  xl: '1280px',  // Desktop
  '2xl': '1536px' // Large desktop
} as const;

// Responsive text sizes with mobile-first approach
export const responsiveText = {
  xs: 'text-[11px] sm:text-[13px]',
  sm: 'text-[13px] sm:text-base',
  base: 'text-[13px] sm:text-base lg:text-base',
  lg: 'text-base sm:text-[15px] lg:text-[15px]',
  xl: 'text-[15px] sm:text-xl lg:text-xl',
  '2xl': 'text-xl sm:text-2xl lg:text-2xl',
  '3xl': 'text-2xl sm:text-3xl lg:text-3xl',
  '4xl': 'text-3xl sm:text-4xl lg:text-4xl',
  '5xl': 'text-3xl sm:text-4xl lg:text-5xl xl:text-5xl',
  '6xl': 'text-4xl sm:text-5xl lg:text-6xl xl:text-6xl',
  '7xl': 'text-4xl sm:text-5xl lg:text-6xl xl:text-7xl',
} as const;

// Responsive spacing with mobile-first approach
export const responsivePadding = {
  xs: 'p-2 sm:p-3 lg:p-4',
  sm: 'p-3 sm:p-4 lg:p-5',
  base: 'p-4 sm:p-5 lg:p-6',
  lg: 'p-5 sm:p-6 lg:p-8',
  xl: 'p-6 sm:p-8 lg:p-10',
  '2xl': 'p-8 sm:p-10 lg:p-12',
  none: 'p-0',
  
  // Directional padding
  x: {
    xs: 'px-2 sm:px-3 lg:px-4',
    sm: 'px-3 sm:px-4 lg:px-5',
    base: 'px-4 sm:px-5 lg:px-6',
    lg: 'px-5 sm:px-6 lg:px-8',
    xl: 'px-6 sm:px-8 lg:px-10',
    '2xl': 'px-8 sm:px-10 lg:px-12',
  },
  y: {
    xs: 'py-2 sm:py-3 lg:py-4',
    sm: 'py-3 sm:py-4 lg:py-5',
    base: 'py-4 sm:py-5 lg:py-6',
    lg: 'py-5 sm:py-6 lg:py-8',
    xl: 'py-6 sm:py-8 lg:py-10',
    '2xl': 'py-8 sm:py-10 lg:py-12',
  }
} as const;

// Responsive container widths
export const responsiveContainer = {
  sm: 'max-w-screen-sm mx-auto px-4 sm:px-6 lg:px-8',
  md: 'max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8',
  lg: 'max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8',
  xl: 'max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8',
  '2xl': 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8',
  full: 'w-full px-4 sm:px-6 lg:px-8',
  none: 'w-full',
} as const;

// Responsive grid systems
export const responsiveGrid = {
  cols1: 'grid grid-cols-1',
  cols2: 'grid grid-cols-1 sm:grid-cols-2',
  cols3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  cols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  cols6: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  cols12: 'grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12',
} as const;

// Responsive flex layouts
export const responsiveFlex = {
  row: 'flex flex-col sm:flex-row',
  rowReverse: 'flex flex-col-reverse sm:flex-row-reverse',
  col: 'flex flex-col',
  colReverse: 'flex flex-col-reverse',
  wrap: 'flex flex-wrap',
  nowrap: 'flex flex-nowrap',
} as const;

// Responsive gap sizes
export const responsiveGap = {
  xs: 'gap-1 sm:gap-2',
  sm: 'gap-2 sm:gap-3',
  base: 'gap-3 sm:gap-4',
  lg: 'gap-4 sm:gap-6',
  xl: 'gap-6 sm:gap-8',
  '2xl': 'gap-8 sm:gap-10',
} as const;

// Hide/Show utilities
export const responsiveVisibility = {
  hideMobile: 'hidden sm:block',
  hideTablet: 'hidden lg:block',
  hideDesktop: 'lg:hidden',
  showMobile: 'block sm:hidden',
  showTablet: 'block lg:hidden',
  showDesktop: 'hidden lg:block',
} as const;

// Button sizes responsive
export const responsiveButton = {
  sm: 'h-8 px-3 text-[11px] sm:h-9 sm:px-4 sm:text-[13px]',
  default: 'h-9 px-4 text-[13px] sm:h-10 sm:px-6',
  lg: 'h-10 px-6 text-[13px] sm:h-11 sm:px-8 sm:text-base',
  icon: 'h-9 w-9 sm:h-10 sm:w-10',
  iconSm: 'h-8 w-8 sm:h-9 sm:w-9',
  iconLg: 'h-10 w-10 sm:h-11 sm:w-11',
} as const;

// Responsive width utilities
export const responsiveWidth = {
  full: 'w-full',
  auto: 'w-auto',
  screen: 'w-screen',
  min: 'w-min',
  max: 'w-max',
  fit: 'w-fit',
  // Fractional widths
  '1/2': 'w-full sm:w-1/2',
  '1/3': 'w-full sm:w-1/2 lg:w-1/3',
  '2/3': 'w-full sm:w-2/3',
  '1/4': 'w-full sm:w-1/2 lg:w-1/4',
  '3/4': 'w-full sm:w-3/4',
} as const;

// Responsive height utilities
export const responsiveHeight = {
  full: 'h-full',
  screen: 'h-screen',
  auto: 'h-auto',
  fit: 'h-fit',
  // Fixed heights with responsive adjustments
  sm: 'h-32 sm:h-40 lg:h-48',
  md: 'h-48 sm:h-56 lg:h-64',
  lg: 'h-64 sm:h-72 lg:h-80',
} as const;

// Sidebar widths for different screens
export const sidebarWidth = {
  collapsed: 'w-16',
  mobile: 'w-full',
  tablet: 'w-64 sm:w-72',
  desktop: 'w-64 lg:w-80 xl:w-96',
} as const;

// Panel sizes for resizable panels
export const panelSizes = {
  mobile: {
    sidebar: 100, // Full width on mobile
    main: 100,
    terminal: 100,
  },
  tablet: {
    sidebar: 30,
    main: 70,
    terminal: 40,
  },
  desktop: {
    sidebar: 20,
    main: 60,
    terminal: 30,
    rightPanel: 20,
  }
} as const;

// Utility function to combine responsive classes
export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Media query hooks would be imported from use-media-query
export const mediaQueries = {
  isMobile: `(max-width: ${breakpoints.sm})`,
  isTablet: `(min-width: ${breakpoints.sm}) and (max-width: ${breakpoints.lg})`,
  isDesktop: `(min-width: ${breakpoints.lg})`,
  isLargeDesktop: `(min-width: ${breakpoints.xl})`,
} as const;