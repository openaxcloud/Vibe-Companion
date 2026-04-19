/**
 * Modern Design System — 2026 patterns for "last-gen" generated apps
 *
 * This prompt layers on top of the base DESIGN_SYSTEM_PROMPT. It targets
 * the look & feel of shadcn.com, Linear, Vercel, Arc — not the default
 * Tailwind gray look we see in 2023-era scaffolds.
 *
 * Injected when generating UI code (React/Next.js/HTML/CSS).
 */
export const MODERN_DESIGN_PROMPT = `
## Modern Design Excellence (2026-grade UI)

You are generating apps that must feel like shadcn.com / Linear / Vercel — not bootstrap-era Tailwind.

### Stack (for React/Next.js apps)
- **shadcn/ui** components (Radix primitives + CVA + lucide-react) — NEVER reinvent Button/Dialog/Input
- **Tailwind CSS** with CSS variables (hsl) so dark mode "just works"
- **Framer Motion** for micro-interactions (NEVER heavy entrance animations)
- **next-themes** for theme switching with smooth transitions
- **lucide-react** for icons (NEVER emoji, NEVER font-awesome)
- **Inter** font via \`next/font/google\` or CDN, with \`variable: '--font-sans'\`

### Palette (use CSS variables, not hardcoded)
\`\`\`css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --ring: 240 5% 64.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --accent: 240 4.8% 95.9%;
}
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --border: 240 3.7% 15.9%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
}
\`\`\`

### Layout
- **Container** : \`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8\`
- **Sections** : \`py-16 sm:py-24\` — generous vertical whitespace
- **Grid** : \`grid gap-6 sm:grid-cols-2 lg:grid-cols-3\` for feature cards
- **Responsive mobile-first** : start mobile, add breakpoints

### Typography
- **H1** : \`text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl\` + \`text-balance\`
- **H2** : \`text-3xl font-semibold tracking-tight sm:text-4xl\`
- **H3** : \`text-xl font-semibold\`
- **Body** : \`text-base leading-7 text-muted-foreground\`
- **Small/meta** : \`text-sm text-muted-foreground\`
- NEVER use \`text-gray-500\` — use \`text-muted-foreground\`

### Components — use shadcn-style imports
\`\`\`tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
\`\`\`

### Interactions (subtle, not flashy)
- Hover on cards : \`hover:border-foreground/20 transition-colors duration-150\`
- Focus rings : \`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2\`
- Buttons : \`hover:bg-primary/90 active:scale-[0.98] transition-all\`
- Links : \`underline-offset-4 hover:underline\`
- NEVER use \`hover:scale-110\` — it feels cheap. Max \`scale-[1.02]\` on cards only.

### Animations (Framer Motion for React apps)
\`\`\`tsx
import { motion } from "framer-motion";

// Fade + rise on mount (subtle)
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
>
  ...
</motion.div>

// Stagger children
<motion.div
  initial="hidden"
  animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
>
  {items.map((item, i) => (
    <motion.div key={i} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
      ...
    </motion.div>
  ))}
</motion.div>
\`\`\`

### Dark Mode — first-class, not afterthought
- Add \`<ThemeProvider attribute="class" defaultTheme="system" enableSystem>\` at root (next-themes)
- Add a **theme toggle** component in the nav (sun/moon icons from lucide-react)
- Test every screen in dark mode before considering it done
- Images / illustrations : use \`dark:brightness-90\` or provide dark variants

### Depth (subtle, not Bootstrap 2015)
- Cards : \`border border-border/40 bg-card\` — border FIRST, shadow SECOND
- Shadow scale : \`shadow-sm\` default, \`shadow-md\` on hover only
- NEVER \`shadow-2xl\` unless it's a modal/popover
- Glassmorphism (for heroes only) : \`bg-background/60 backdrop-blur-xl border border-border/40\`

### Hero section pattern
\`\`\`tsx
<section className="relative overflow-hidden py-24 sm:py-32">
  {/* Subtle gradient mesh (not in-your-face) */}
  <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.1),transparent_50%)]" />

  <div className="container mx-auto max-w-4xl text-center">
    <Badge variant="outline" className="mb-4">New · v2.0</Badge>
    <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
      <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
        Build faster with modern tools
      </span>
    </h1>
    <p className="mt-6 text-lg leading-8 text-muted-foreground text-balance">
      Ship production-grade apps in minutes, not weeks.
    </p>
    <div className="mt-10 flex items-center justify-center gap-4">
      <Button size="lg">Get started</Button>
      <Button size="lg" variant="outline">Documentation</Button>
    </div>
  </div>
</section>
\`\`\`

### Forbidden patterns (signs of 2023-era code)
❌ \`bg-gradient-to-r from-purple-500 to-pink-500\` on everything
❌ Centered hero with "Welcome to [App Name]" — no useful info
❌ Emoji as feature icons (🚀 🎯 ⚡) — use lucide-react instead
❌ \`shadow-xl\` or \`shadow-2xl\` everywhere
❌ \`rounded-full\` on buttons (feels dated — prefer \`rounded-md\`)
❌ \`bg-white\` / \`text-black\` / \`bg-gray-900\` hardcoded — ALWAYS use tokens
❌ Lorem ipsum in demos — use realistic, product-specific copy
❌ Skipping accessibility (missing labels, no focus rings, low contrast)

### Required patterns (2026-grade)
✅ Semantic tokens : \`bg-background\`, \`text-foreground\`, \`text-muted-foreground\`, \`border-border\`
✅ Radix primitives via shadcn/ui — never custom-built
✅ Mobile menu using \`<Sheet>\` from shadcn
✅ Dark mode toggle as first-class feature
✅ Focus states WCAG-AAA (ring-2 ring-ring ring-offset-2)
✅ \`text-balance\` on all headings
✅ Loading states with skeleton (\`<Skeleton>\` from shadcn) — never plain spinners
✅ Empty states with illustration + clear CTA
✅ Error boundaries with retry action
`;

/**
 * Short version (for token-tight contexts). Use full version by default.
 */
export const MODERN_DESIGN_PROMPT_COMPACT = `
## Modern Design Rules
- Stack: Tailwind + shadcn/ui + Framer Motion + lucide-react + next-themes
- Dark mode FIRST-CLASS with CSS variables (hsl), toggle in nav
- Palette via semantic tokens: bg-background, text-foreground, text-muted-foreground, border-border (NEVER hardcoded gray)
- Typography: Inter, tracking-tight on headings, text-balance on h1
- Depth: border-border/40 first, shadow-sm default, shadow-md on hover only
- Animations: subtle fade+translate 4-8px, duration 200-300ms, ease-out
- Icons: lucide-react ONLY (no emoji)
- Buttons: rounded-md, NEVER rounded-full
- Container: mx-auto max-w-6xl, py-16 sm:py-24 for sections
- FORBIDDEN: purple→pink gradients everywhere, shadow-xl default, emoji icons, hardcoded gray-500
`;
