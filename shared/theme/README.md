# E-Code Platform Design Tokens

Centralized design tokens for consistent theming across web and mobile platforms.

## Overview

This directory contains the single source of truth for all design tokens used in the E-Code platform, ensuring a unified Replit-like aesthetic across all clients.

## Files

- **`tokens.ts`**: Core design tokens (colors, spacing, typography, etc.)
- **`css-variables.ts`**: CSS custom properties generator for web platform
- **`mobile-theme.ts`**: React Native-compatible theme objects for mobile
- **`tailwind-colors.ts`**: Tailwind color extensions
- **`index.ts`**: Public exports

## Usage

### Web Platform (CSS Variables)

The design tokens are automatically available as CSS variables:

```css
.my-component {
  background-color: var(--ecode-background);
  color: var(--ecode-text);
  padding: var(--ecode-space-4);
  border-radius: var(--ecode-radius-md);
}
```

### Web Platform (Tailwind Classes)

Use E-Code branded Tailwind classes:

```tsx
<div className="bg-ecode-orange text-white p-ecode-4 rounded-ecode-md">
  E-Code Branded Button
</div>
```

### Mobile Platform

Import the mobile theme object:

```tsx
import { mobileTheme } from '@/shared/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileTheme.colors.background,
    padding: mobileTheme.spacing.lg,
  },
});
```

Or import individual utilities:

```tsx
import { mobileColors, mobileSpacing } from '@/shared/theme';

// Use in Tailwind classes on mobile
<View className="bg-background p-4">
```

## Token Categories

### Colors

- **Brand**: E-Code Orange (#F26207), Yellow (#F99D25)
- **Neutral**: Background, surface, border, text (light & dark modes)
- **Semantic**: Danger, warning, info, success
- **Component**: Sidebar, editor, terminal, buttons

### Spacing

Follows Replit's 4px-based spacing scale:
- `1` = 4px
- `2` = 8px
- `3` = 12px
- `4` = 16px
- `6` = 24px
- `8` = 32px

### Typography

- **Fonts**: IBM Plex Sans (UI), IBM Plex Mono (code)
- **Sizes**: xs (12px) → 4xl (36px)
- **Weights**: normal, medium, semibold, bold

### Border Radius

- `sm` = 4px
- `md` = 8px
- `lg` = 12px

## Theme Consistency

Both web and mobile platforms use the same token values:

| Property | Web (CSS Var) | Mobile (Theme) | Value |
|----------|---------------|----------------|-------|
| Background | `var(--ecode-background)` | `mobileColors.background` | `#0e1525` |
| Primary | `var(--ecode-accent)` | `mobileColors.primary` | `#F26207` |
| Spacing 4 | `var(--ecode-space-4)` | `mobileSpacing.lg` | `16px` |

## Dark Mode

The platform uses dark mode by default (Replit-like aesthetic):

- **Web**: Automatically applied via CSS `:root` and `.dark` selectors
- **Mobile**: Dark colors are the default in `mobileTheme`

## Migration Guide

### Replace Hardcoded Colors

**Before:**
```tsx
<div className="bg-[#F26207]">...</div>
```

**After:**
```tsx
<div className="bg-ecode-orange">...</div>
```

### Replace Inline Styles

**Before:**
```tsx
<div style={{ backgroundColor: '#0e1525' }}>...</div>
```

**After:**
```tsx
import { mobileColors } from '@/shared/theme';
<div style={{ backgroundColor: mobileColors.background }}>...</div>
```

## Best Practices

1. **Always use tokens** - Never hardcode colors, spacing, or font values
2. **Use Tailwind classes** - Prefer `bg-ecode-orange` over custom CSS
3. **Respect dark mode** - Test both light and dark themes
4. **Maintain consistency** - Use the same token values across platforms

## Adding New Tokens

1. Add to `tokens.ts`
2. Update `css-variables.ts` for web
3. Update `mobile-theme.ts` for mobile
4. Update `tailwind-colors.ts` if needed
5. Document in this README
