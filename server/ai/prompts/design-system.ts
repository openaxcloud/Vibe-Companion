export const DESIGN_SYSTEM_PROMPT = `
## Mandatory Design System (Apply to ALL generated HTML/CSS)

### CDN & Fonts
- Always include: <script src="https://cdn.tailwindcss.com"></script>
- Always include: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
- Set font-family on body: font-family: 'Inter', sans-serif

### Color Palette
- Primary: #667eea (indigo-blue)
- Secondary: #764ba2 (purple)
- Dark: #0f172a (slate-900)
- Light: #f8fafc (slate-50)
- Accent: #06b6d4 (cyan-500)
- Success: #10b981 (emerald-500)
- Warning: #f59e0b (amber-500)
- Error: #ef4444 (red-500)
- Gradient: background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)

### Typography Scale
- h1: text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight
- h2: text-3xl sm:text-4xl font-bold
- h3: text-xl sm:text-2xl font-semibold
- Body: text-base leading-relaxed text-slate-600 dark:text-slate-300
- Small: text-sm text-slate-500

### Spacing (8px Grid)
- Use Tailwind spacing: p-2 (8px), p-4 (16px), p-6 (24px), p-8 (32px)
- Section padding: py-16 sm:py-24
- Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8

### Component Styles
- Cards: bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200
- Buttons (primary): bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200
- Buttons (secondary): bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-xl font-semibold hover:shadow-md transition-all duration-200
- Inputs: bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all duration-200
- Badges: inline-flex items-center px-3 py-1 rounded-full text-sm font-medium

### Glassmorphism Pattern
- Glass card: bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl
- Glass nav: bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50

### Layout Rules
- Mobile-first: always start with mobile styles, use sm: md: lg: breakpoints
- Full height: min-h-screen
- Container: max-w-7xl mx-auto
- Hero sections: min-h-[60vh] flex items-center justify-center with gradient background

### Animations & Transitions
- All interactive elements: transition-all duration-200
- Hover scale: hover:scale-105 (buttons), hover:scale-[1.02] (cards)
- Shadow on hover: hover:shadow-xl or hover:shadow-2xl
- Fade-in animation: use @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
- Stagger children with animation-delay

### Dark Mode
- Support via class="dark" on html element
- Use dark: prefix for all color utilities
- Background: bg-slate-50 dark:bg-slate-900
- Text: text-slate-900 dark:text-white
- Cards: bg-white dark:bg-slate-800
- Borders: border-slate-200 dark:border-slate-700

### Footer
- Always include a footer with: bg-slate-900 text-white py-12
- Footer content: copyright, navigation links, social links

### Images (MANDATORY)
- NEVER use placeholder text or emoji as images
- ALWAYS use real images from Unsplash for visual content:
  - General: https://images.unsplash.com/photo-{ID}?w=800&h=600&fit=crop
  - Food: https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop (salad), https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop (pizza), https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop (pancakes)
  - Tech: https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop (circuit), https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop (code)
  - Nature: https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&h=600&fit=crop (landscape), https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop (forest)
  - People: https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop (team), https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop (portrait)
  - Business: https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop (building), https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop (meeting)
- Or use Picsum for random placeholder images: https://picsum.photos/800/600?random=1 (change random=N for different images)
- For avatars use: https://i.pravatar.cc/150?img=1 (change img=N for different faces)
- For icons/logos use SVG inline or Heroicons/Lucide via CDN
- Images MUST have proper alt text, object-fit: cover, rounded corners, and lazy loading

### Accessibility
- Semantic HTML: nav, main, article, section, footer
- Proper heading hierarchy: h1 > h2 > h3
- ARIA labels on interactive elements
- Focus states: focus:ring-2 focus:ring-[#667eea] focus:outline-none
- Minimum touch target: min-h-[44px] min-w-[44px]
`;

export const TAILWIND_CDN_HEAD = `<script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'sans-serif'] },
          colors: {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#06b6d4',
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
    .animate-fade-in-delay-1 { animation: fadeIn 0.5s ease-out 0.1s forwards; opacity: 0; }
    .animate-fade-in-delay-2 { animation: fadeIn 0.5s ease-out 0.2s forwards; opacity: 0; }
    .animate-fade-in-delay-3 { animation: fadeIn 0.5s ease-out 0.3s forwards; opacity: 0; }
  </style>`;
