import { useCallback, useMemo } from 'react';
import UserSettingsPanel from '@/components/UserSettingsPanel';
import { useTheme } from '@/components/ThemeProvider';
import type { UserPreferences } from '@shared/schema';
import { DEFAULT_PREFERENCES } from '@shared/schema';

interface ReplitSettingsPanelProps {
  projectId: string;
  userPrefs?: UserPreferences;
  savePrefs?: (partial: Partial<UserPreferences>) => void;
}

export function ReplitSettingsPanel({ projectId, userPrefs, savePrefs }: ReplitSettingsPanelProps) {
  const { theme, setTheme, activeTheme, toggleTheme } = useTheme();

  const prefs = useMemo(() => ({
    ...DEFAULT_PREFERENCES,
    ...(userPrefs || {}),
    theme: theme as string,
  }), [userPrefs, theme]);

  const handlePrefsChange = useCallback((partial: Record<string, any>) => {
    // Sync theme changes with ThemeProvider for immediate visual effect
    if (partial.theme === 'dark' || partial.theme === 'light') {
      setTheme(partial.theme as 'dark' | 'light');
    }
    // Persist to backend
    if (savePrefs) {
      savePrefs(partial as any);
    }
  }, [setTheme, savePrefs]);

  return (
    <UserSettingsPanel
      prefs={prefs as any}
      onPrefsChange={handlePrefsChange}
      onClose={() => {}}
      onOpenProjectSettings={() => {}}
      onOpenEnvVars={() => {}}
    />
  );
}
