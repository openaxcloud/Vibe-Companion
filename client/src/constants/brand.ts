// E-Code Brand Constants
// Inspired by Replit's design but with unique E-Code identity

export const BRAND = {
  name: 'E-Code',
  tagline: 'Build software fast with AI',
  description: 'Code with AI. Deploy instantly. Share with the world. Build and ship software 10x faster.',
  
  // Primary brand colors (inspired by Replit's #F26207)
  colors: {
    primary: '#F26207',      // E-Code Orange
    primaryLight: '#FF6B35', // Lighter orange
    primaryDark: '#D84315',  // Darker orange
    accent: '#F77F00',       // Accent amber
    gradient: {
      primary: 'from-orange-500 to-amber-500',
      ai: 'from-violet-600 to-fuchsia-600',
      code: 'from-blue-500 to-purple-500'
    }
  },
  
  // Logo and visual assets
  assets: {
    logo: '/assets/logo.svg',
    heroImage: '/assets/hero-image.svg',
    aiAvatar: '/assets/ai-avatar.svg'
  },
  
  // Messaging themes
  messaging: {
    // Friendly, inclusive language for non-coders
    friendly: {
      title: 'Create Amazing Things',
      subtitle: 'No coding experience needed. Just ideas and creativity.',
      cta: 'Start your journey free'
    },
    // Professional messaging for developers
    technical: {
      title: 'Build software fast with AI',
      subtitle: 'Code with AI. Deploy instantly. Share with the world.',
      cta: 'Launch AI'
    }
  },
  
  // Feature highlights
  features: {
    instant: 'Start in seconds - no setup required',
    ai: 'AI-powered development and suggestions',
    collaborative: 'Real-time collaboration and sharing',
    deployment: 'One-click deployment to the world',
    inclusive: 'Perfect for beginners and experts alike'
  }
} as const;

// Quick suggestions for AI chat
export const QUICK_SUGGESTIONS = [
  'Todo app with dark mode',
  'Portfolio website',
  'Weather dashboard',
  'Recipe finder app',
  'Budget tracker',
  'Chat application',
  'Blog website',
  'E-commerce store'
] as const;