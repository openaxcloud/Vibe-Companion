# E-Code Mobile Design System 🎨

A comprehensive, Apple-quality design system for building world-class mobile IDE experiences. Inspired by iOS Human Interface Guidelines and Replit's design principles.

## ✨ Features

### 🎯 Design Tokens
- **Colors**: Dynamic light/dark mode with iOS-style semantic colors
- **Typography**: San Francisco Pro-inspired text styles with Dynamic Type
- **Spacing**: Consistent 8pt grid system
- **Animations**: Spring physics and Apple-quality easing curves
- **Shadows**: Depth and elevation system for both themes
- **Safe Areas**: Full support for iOS notch and Android navigation

### 🎮 Advanced Gestures
- **Swipe**: Left, right, up, down with velocity detection
- **Long Press**: Customizable delay with haptic feedback
- **Pull to Refresh**: iOS-style pull-to-refresh with threshold
- **Pinch to Zoom**: Multi-touch zoom for code editors
- **Swipe Back**: iOS-style navigation gesture
- **Double Tap**: Zoom and interaction patterns
- **Haptic Feedback**: Full vibration API support for all interactions

### 🧩 Components

#### Toast Notifications
```tsx
import { ToastProvider, useToast } from '@/design-system';

// In your root component
<ToastProvider>
  <App />
</ToastProvider>

// In any component
const toast = useToast();

toast.success('File saved successfully!');
toast.error('Failed to connect to server');
toast.warning('Unsaved changes', 'Save before closing?');
toast.info('New update available', {
  action: {
    label: 'Update Now',
    onPress: () => updateApp(),
  },
});
```

#### Empty States
```tsx
import { EmptyState, NoFilesEmptyState } from '@/design-system';

<NoFilesEmptyState
  onCreateFile={() => createFile()}
/>

<EmptyState
  icon="🔍"
  title="No Results Found"
  description="Try a different search term"
  action={{
    label: 'Clear Search',
    onPress: clearSearch,
  }}
/>
```

#### Loading Skeletons
```tsx
import {
  CodeEditorSkeleton,
  FileTreeSkeleton,
  TerminalSkeleton
} from '@/design-system';

// Show while loading
{isLoading ? <CodeEditorSkeleton lines={25} /> : <Editor />}
```

#### Onboarding Flow
```tsx
import { Onboarding, defaultOnboardingSteps } from '@/design-system';

<Onboarding
  steps={defaultOnboardingSteps}
  onComplete={() => {
    localStorage.setItem('onboarding-completed', 'true');
    router.push('/editor');
  }}
  onSkip={() => router.push('/editor')}
/>
```

#### Context Menu
```tsx
import { ContextMenu } from '@/design-system';

<ContextMenu
  trigger={<button>Long press me</button>}
  sections={[
    {
      items: [
        {
          id: 'rename',
          label: 'Rename',
          icon: '✏️',
          onPress: () => renameFile(),
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: '🗑️',
          destructive: true,
          onPress: () => deleteFile(),
        },
      ],
    },
  ]}
/>
```

#### Command Palette
```tsx
import { CommandPalette, useCommandPalette } from '@/design-system';

function App() {
  const palette = useCommandPalette(); // Auto-listens for Cmd+K

  const commands = [
    {
      id: 'new-file',
      label: 'Create New File',
      description: 'Create a new file in the current directory',
      icon: '📄',
      category: 'File',
      shortcut: '⌘N',
      keywords: ['new', 'create', 'file'],
      onExecute: async () => {
        await createFile();
      },
    },
    // ... more commands
  ];

  return (
    <>
      <YourApp />
      {palette.isOpen && (
        <CommandPalette
          commands={commands}
          onClose={palette.close}
        />
      )}
    </>
  );
}
```

#### Status Bar
```tsx
import { StatusBar, NetworkIndicator, BatteryIndicator } from '@/design-system';

<StatusBar
  connectionStatus="connected"
  branch="main"
  language="TypeScript"
  cursorPosition={{ line: 42, column: 18 }}
  encoding="UTF-8"
  lineEnding="LF"
  indentation="Spaces: 2"
  showPerformance
  customItems={
    <>
      <NetworkIndicator />
      <BatteryIndicator />
    </>
  }
/>
```

#### Settings Panel
```tsx
import { Settings } from '@/design-system';

const settingsSections = [
  {
    id: 'appearance',
    title: 'Appearance',
    icon: '🎨',
    items: [
      {
        type: 'select',
        id: 'theme',
        label: 'Theme',
        value: theme,
        options: [
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
          { label: 'Auto', value: 'auto' },
        ],
        onChange: setTheme,
      },
      {
        type: 'slider',
        id: 'font-size',
        label: 'Font Size',
        value: fontSize,
        min: 12,
        max: 24,
        step: 1,
        unit: 'px',
        onChange: setFontSize,
      },
      {
        type: 'toggle',
        id: 'haptics',
        label: 'Haptic Feedback',
        description: 'Vibrate on interactions',
        value: hapticsEnabled,
        onChange: setHapticsEnabled,
      },
    ],
  },
];

<Settings
  sections={settingsSections}
  onClose={() => setShowSettings(false)}
/>
```

#### Split View Editor
```tsx
import { SplitView, MultiEditorLayout } from '@/design-system';

// Simple split view
<SplitView
  left={<FileTree />}
  right={<CodeEditor />}
  defaultSize={30}
  minSize={20}
  maxSize={50}
/>

// Multi-editor with tabs
<MultiEditorLayout
  files={openFiles}
  renderEditor={(file) => (
    <MonacoEditor
      value={file.content}
      language={file.language}
    />
  )}
  onFileClose={handleFileClose}
/>
```

### 🎣 Hooks

#### useDesignSystem
```tsx
import { useDesignSystem } from '@/design-system';

function MyComponent() {
  const ds = useDesignSystem('auto'); // 'light' | 'dark' | 'auto'

  return (
    <div style={{
      backgroundColor: ds.colors.background.primary,
      padding: ds.spacing[5],
      borderRadius: ds.borderRadius.lg,
      boxShadow: ds.shadows.md,
    }}>
      <h1 style={{
        ...ds.typography.textStyles.largeTitle,
        color: ds.colors.text.primary,
      }}>
        Hello World
      </h1>

      {/* Check device type */}
      {ds.device.isMobile && <MobileView />}
      {ds.device.isTablet && <TabletView />}
      {ds.device.isTouch && <TouchOptimized />}
    </div>
  );
}
```

#### Gesture Hooks
```tsx
import {
  useSwipeGesture,
  useLongPress,
  usePullToRefresh
} from '@/design-system';

// Swipe gestures
const swipeProps = useSwipeGesture({
  onSwipeLeft: () => nextPage(),
  onSwipeRight: () => prevPage(),
  threshold: 50,
  hapticFeedback: true,
});

<motion.div {...swipeProps}>
  Swipe me!
</motion.div>

// Long press
const longPressProps = useLongPress({
  delay: 500,
  onLongPress: () => showContextMenu(),
  onPress: () => select(),
  hapticFeedback: true,
});

<button {...longPressProps}>
  Press and hold
</button>

// Pull to refresh
const pullToRefreshProps = usePullToRefresh({
  threshold: 80,
  onRefresh: async () => {
    await fetchNewData();
  },
  hapticFeedback: true,
});

<motion.div {...pullToRefreshProps}>
  Pull down to refresh
</motion.div>
```

## 🎨 Design Tokens

### Colors
The design system uses iOS-style semantic colors that automatically adapt to light/dark mode:

```tsx
const ds = useDesignSystem();

// Backgrounds (layered)
ds.colors.background.primary    // Main background
ds.colors.background.secondary  // Cards, panels
ds.colors.background.tertiary   // Nested elements
ds.colors.background.elevated   // Modals, popovers

// Text
ds.colors.text.primary          // Main text
ds.colors.text.secondary        // Subtitles, captions
ds.colors.text.tertiary         // Disabled, placeholders

// Interactive
ds.colors.interactive.primary   // Blue (iOS default)
ds.colors.interactive.secondary // Purple
ds.colors.interactive.tertiary  // Pink

// Feedback
ds.colors.feedback.success      // Green
ds.colors.feedback.warning      // Orange
ds.colors.feedback.error        // Red
ds.colors.feedback.info         // Blue
```

### Typography
Based on iOS Dynamic Type system:

```tsx
ds.typography.textStyles.largeTitle  // 34px, bold
ds.typography.textStyles.title1      // 28px, bold
ds.typography.textStyles.title2      // 22px, bold
ds.typography.textStyles.title3      // 20px, semibold
ds.typography.textStyles.headline    // 17px, semibold
ds.typography.textStyles.body        // 17px, regular
ds.typography.textStyles.callout     // 16px, regular
ds.typography.textStyles.subheadline // 15px, regular
ds.typography.textStyles.footnote    // 13px, regular
ds.typography.textStyles.caption1    // 12px, regular
ds.typography.textStyles.caption2    // 11px, regular
```

### Spacing
8pt grid system:

```tsx
ds.spacing[3]  // 8px
ds.spacing[4]  // 12px
ds.spacing[5]  // 16px
ds.spacing[6]  // 20px
ds.spacing[7]  // 24px
ds.spacing[8]  // 32px
// ... up to 128px
```

### Animations
Spring physics and easing curves:

```tsx
// Framer Motion springs
ds.animations.spring.responsive  // Snappy (400 stiffness, 30 damping)
ds.animations.spring.smooth      // Elegant (300 stiffness, 35 damping)
ds.animations.spring.bouncy      // Playful (500 stiffness, 20 damping)
ds.animations.spring.gentle      // Subtle (200 stiffness, 40 damping)

// Easing curves
ds.animations.easing.standard    // iOS standard
ds.animations.easing.decelerate  // Ease out
ds.animations.easing.accelerate  // Ease in
ds.animations.easing.spring      // Spring-like
ds.animations.easing.smooth      // Smooth iOS
```

## 📱 Responsive Design

The design system automatically adapts to different screen sizes:

```tsx
const ds = useDesignSystem();

// Check device type
ds.device.isMobile   // < 768px
ds.device.isTablet   // 768px - 1023px
ds.device.isDesktop  // >= 1024px
ds.device.isTouch    // Touch-capable device

// Responsive values
import { useResponsiveValue } from '@/design-system';

const columns = useResponsiveValue({
  mobile: 1,
  tablet: 2,
  desktop: 3,
});
```

## 🔧 Utilities

```tsx
import {
  formatFileSize,
  formatTimeAgo,
  truncate,
  debounce,
  throttle,
  isIOS,
  isAndroid,
  hasNotch,
} from '@/design-system';

formatFileSize(1024)           // "1 KB"
formatTimeAgo(new Date())      // "just now"
truncate("Long text...", 10)   // "Long te..."
debounce(fn, 300)              // Debounced function
throttle(fn, 100)              // Throttled function
isIOS()                        // true on iOS devices
hasNotch()                     // true on iPhone X+
```

## 🎯 Best Practices

### 1. Always use design tokens
```tsx
// ✅ Good
<div style={{ padding: ds.spacing[5], color: ds.colors.text.primary }}>

// ❌ Bad
<div style={{ padding: '16px', color: '#000000' }}>
```

### 2. Use semantic colors
```tsx
// ✅ Good
backgroundColor: ds.colors.feedback.error

// ❌ Bad
backgroundColor: '#FF0000'
```

### 3. Add haptic feedback to interactions
```tsx
// ✅ Good
onClick={() => {
  triggerHaptic('selection');
  handleClick();
}}

// ❌ Bad
onClick={handleClick}
```

### 4. Support safe areas
```tsx
// ✅ Good
paddingTop: `calc(${ds.spacing[5]} + env(safe-area-inset-top, 0px))`

// ❌ Bad
paddingTop: ds.spacing[5]
```

### 5. Use spring animations
```tsx
// ✅ Good
<motion.div
  animate={{ scale: 1 }}
  transition={ds.animations.spring.responsive}
>

// ❌ Bad
<motion.div
  animate={{ scale: 1 }}
  transition={{ duration: 0.3 }}
>
```

## 📚 Examples

See `/examples` directory for complete implementation examples:
- Mobile IDE integration
- Settings panel
- File browser
- Code editor with split view
- Terminal with pull-to-refresh

## 🚀 Migration Guide

### From existing styles to design system:

```tsx
// Before
<div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md">

// After
import { useDesignSystem } from '@/design-system';

const ds = useDesignSystem();

<div style={{
  padding: ds.spacing[5],
  backgroundColor: ds.colors.background.primary,
  borderRadius: ds.borderRadius.lg,
  boxShadow: ds.shadows.md,
}}>
```

## 🤝 Contributing

When adding new components:
1. Follow iOS Human Interface Guidelines
2. Support both light and dark modes
3. Add haptic feedback where appropriate
4. Support safe areas on mobile
5. Use spring animations
6. Include TypeScript types
7. Document with examples

## 📄 License

MIT License - See LICENSE file for details.
