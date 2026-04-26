/**
 * Base design rules — minimal, framework-agnostic.
 *
 * The full opinionated 2026-grade rule set lives in `MODERN_DESIGN_PROMPT`
 * (`./modern-design-system.ts`). This file used to hold a legacy 2023 rule
 * set with hardcoded `#667eea` gradients, `shadow-xl` defaults, and
 * mandatory glassmorphism — patterns that directly contradict the modern
 * prompt. It was the root cause of generated apps looking dated, so it has
 * been replaced with a thin compatibility shim that defers to MODERN_DESIGN_PROMPT.
 */

import { MODERN_DESIGN_PROMPT } from './modern-design-system';

// Re-export so legacy callers keep working without churn. The actual content
// is now the modern rule set.
export const DESIGN_SYSTEM_PROMPT = MODERN_DESIGN_PROMPT;

/**
 * Minimal `<head>` snippet for plain HTML scaffolds (used by autonomous-builder
 * templates). For React projects the model should configure Tailwind locally
 * via PostCSS, not the CDN — the CDN is a dev convenience that breaks tree
 * shaking and dark-mode `class` strategy in production.
 */
export const TAILWIND_CDN_HEAD = `<script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'sans-serif'] },
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
            muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
            accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
            card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
          },
        },
      },
    };
  </script>
  <style>
    :root {
      --background: 0 0% 100%;
      --foreground: 240 10% 3.9%;
      --card: 0 0% 100%;
      --card-foreground: 240 10% 3.9%;
      --primary: 240 5.9% 10%;
      --primary-foreground: 0 0% 98%;
      --muted: 240 4.8% 95.9%;
      --muted-foreground: 240 3.8% 46.1%;
      --accent: 240 4.8% 95.9%;
      --accent-foreground: 240 5.9% 10%;
      --border: 240 5.9% 90%;
      --input: 240 5.9% 90%;
      --ring: 240 5% 64.9%;
    }
    .dark {
      --background: 240 10% 3.9%;
      --foreground: 0 0% 98%;
      --card: 240 10% 3.9%;
      --card-foreground: 0 0% 98%;
      --primary: 0 0% 98%;
      --primary-foreground: 240 5.9% 10%;
      --muted: 240 3.7% 15.9%;
      --muted-foreground: 240 5% 64.9%;
      --accent: 240 3.7% 15.9%;
      --accent-foreground: 0 0% 98%;
      --border: 240 3.7% 15.9%;
      --input: 240 3.7% 15.9%;
      --ring: 240 4.9% 83.9%;
    }
    body { font-family: 'Inter', sans-serif; }
  </style>`;
