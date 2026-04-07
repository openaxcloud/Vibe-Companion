/**
 * Enhanced Tablet IDE View with Design System Integration
 * This wrapper adds IDEProvider, Command Palette, and global features
 */

import { TabletIDEView } from './TabletIDEView';
import { IDEProvider } from '@/components/providers/IDEProvider';

interface EnhancedTabletIDEViewProps {
  projectId: string;
  className?: string;
  bootstrapToken?: string | null;
  onWorkspaceComplete?: () => void;
  onWorkspaceError?: (error: string) => void;
}

/**
 * Enhanced Tablet IDE View with Design System Integration
 *
 * Wraps the base TabletIDEView with IDEProvider to add:
 * - Toast notifications (useToast hook)
 * - Command Palette (Cmd+K or Ctrl+K)
 * - Keyboard Shortcuts (Press '?')
 * - Settings Panel (Cmd+, or Ctrl+,)
 * - Theme management (light/dark/auto)
 * - Global IDE event system
 *
 * @example
 * ```tsx
 * <EnhancedTabletIDEView projectId="123" />
 * ```
 */
export function EnhancedTabletIDEView(props: EnhancedTabletIDEViewProps) {
  return (
    <IDEProvider projectId={String(props.projectId)}>
      <TabletIDEView {...props} />
    </IDEProvider>
  );
}

export default EnhancedTabletIDEView;
