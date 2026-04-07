/**
 * Theme Validation Page
 * Demonstrates consistent design tokens across web and mobile platforms
 */

import { Card } from "@/components/ui/card";
import { tokens } from "../../../shared/theme/tokens";

export default function ThemeValidation() {
  const colorGroups = [
    {
      title: "Brand Colors",
      colors: [
        { name: "E-Code Orange", value: tokens.colors.orange.primary, cssVar: "--ecode-accent" },
        { name: "E-Code Yellow", value: tokens.colors.yellow.primary, cssVar: "--ecode-yellow" },
      ],
    },
    {
      title: "Dark Mode Colors",
      colors: [
        { name: "Background", value: tokens.colors.dark.background, cssVar: "--ecode-background" },
        { name: "Surface", value: tokens.colors.dark.surface, cssVar: "--ecode-surface" },
        { name: "Border", value: tokens.colors.dark.border, cssVar: "--ecode-border" },
        { name: "Text", value: tokens.colors.dark.text, cssVar: "--ecode-text" },
      ],
    },
    {
      title: "Light Mode Colors",
      colors: [
        { name: "Background", value: tokens.colors.light.background, cssVar: "--ecode-background" },
        { name: "Surface", value: tokens.colors.light.surface, cssVar: "--ecode-surface" },
        { name: "Border", value: tokens.colors.light.border, cssVar: "--ecode-border" },
        { name: "Text", value: tokens.colors.light.text, cssVar: "--ecode-text" },
      ],
    },
  ];

  const spacingExamples = Object.entries(tokens.spacing).filter(([key]) => 
    ['1', '2', '3', '4', '6', '8'].includes(key)
  );

  return (
    <div className="min-h-screen bg-background p-8" data-testid="page-theme-validation">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground" data-testid="text-page-title">
            Theme Validation
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Centralized design tokens ensuring consistent Replit-like theme across web and mobile
          </p>
        </div>

        {/* Color Palettes */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Color Tokens</h2>
          {colorGroups.map((group) => (
            <Card key={group.title} className="p-6">
              <h3 className="text-[15px] font-medium mb-4">{group.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.colors.map((color) => (
                  <div key={color.name} className="space-y-2">
                    <div
                      className="h-20 rounded-ecode-md border"
                      style={{ backgroundColor: color.value }}
                      data-testid={`color-swatch-${color.name.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <div className="space-y-1 text-[13px]">
                      <p className="font-medium">{color.name}</p>
                      <p className="text-muted-foreground font-mono">{color.value}</p>
                      <p className="text-[11px] text-muted-foreground">var({color.cssVar})</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Spacing Scale */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Spacing Scale</h2>
          <Card className="p-6">
            <div className="space-y-4">
              {spacingExamples.map(([key, value]) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-24 text-[13px] font-medium">
                    space-{key}
                  </div>
                  <div
                    className="bg-ecode-orange h-8 rounded-ecode-sm"
                    style={{ width: value }}
                    data-testid={`spacing-${key}`}
                  />
                  <div className="text-[13px] text-muted-foreground font-mono">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Typography */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Typography</h2>
          <Card className="p-6 space-y-4">
            <div>
              <p className="text-[13px] text-muted-foreground mb-2">Sans Serif (IBM Plex Sans)</p>
              <p className="font-sans text-[15px]" data-testid="text-sample-sans">
                The quick brown fox jumps over the lazy dog
              </p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground mb-2">Monospace (IBM Plex Mono)</p>
              <p className="font-mono text-[15px]" data-testid="text-sample-mono">
                const greeting = "Hello, World!";
              </p>
            </div>
          </Card>
        </div>

        {/* Border Radius */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Border Radius</h2>
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(tokens.borderRadius).filter(([key]) => key !== 'full').map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div
                    className="h-24 bg-ecode-orange flex items-center justify-center text-white font-medium"
                    style={{ borderRadius: value }}
                    data-testid={`radius-${key}`}
                  >
                    {key}
                  </div>
                  <p className="text-[13px] text-center text-muted-foreground font-mono">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Component Examples */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Component Examples</h2>
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Button */}
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Primary Button</p>
                <button
                  className="replit-button-primary"
                  data-testid="button-primary"
                >
                  Click Me
                </button>
              </div>
              
              {/* Secondary Button */}
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Secondary Button</p>
                <button
                  className="replit-button-secondary"
                  data-testid="button-secondary"
                >
                  Click Me
                </button>
              </div>

              {/* Card with Surface Colors */}
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Surface Card</p>
                <div className="replit-card" data-testid="card-surface">
                  <p className="text-[13px]">Card with surface background</p>
                </div>
              </div>

              {/* Sidebar-like Element */}
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Sidebar Item</p>
                <div
                  className="p-ecode-3 rounded-ecode-md replit-hover cursor-pointer"
                  style={{ backgroundColor: 'var(--ecode-sidebar-bg)' }}
                  data-testid="sidebar-item"
                >
                  <p className="text-[13px]">Hover me</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Cross-Platform Consistency */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Cross-Platform Consistency</h2>
          <Card className="p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Token</th>
                    <th className="text-left py-2">Web (CSS Var)</th>
                    <th className="text-left py-2">Mobile (Theme)</th>
                    <th className="text-left py-2">Value</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px]">
                  <tr className="border-b">
                    <td className="py-2">Background</td>
                    <td className="text-muted-foreground">var(--ecode-background)</td>
                    <td className="text-muted-foreground">mobileColors.background</td>
                    <td className="text-ecode-orange">{tokens.colors.dark.background}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Primary</td>
                    <td className="text-muted-foreground">var(--ecode-accent)</td>
                    <td className="text-muted-foreground">mobileColors.primary</td>
                    <td className="text-ecode-orange">{tokens.colors.orange.primary}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Spacing 4</td>
                    <td className="text-muted-foreground">var(--ecode-space-4)</td>
                    <td className="text-muted-foreground">mobileSpacing.lg</td>
                    <td className="text-ecode-orange">{tokens.spacing[4]}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Border Radius</td>
                    <td className="text-muted-foreground">var(--ecode-radius-md)</td>
                    <td className="text-muted-foreground">mobileBorderRadius.md</td>
                    <td className="text-ecode-orange">{tokens.borderRadius.md}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-muted p-4 rounded-ecode-md">
              <p className="text-[13px]">
                ✅ All design tokens are centralized in <code className="text-ecode-orange">shared/theme/tokens.ts</code>
              </p>
              <p className="text-[13px] mt-2">
                ✅ Web platform uses CSS variables generated from tokens
              </p>
              <p className="text-[13px] mt-2">
                ✅ Mobile platform imports theme objects from the same source
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
