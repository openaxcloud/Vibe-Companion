import UserSettingsPanel from '@/components/UserSettingsPanel';

export function ReplitSettingsPanel({ projectId }: { projectId: string }) {
  return <UserSettingsPanel prefs={{} as any} onPrefsChange={() => {}} onClose={() => {}} onOpenProjectSettings={() => {}} onOpenEnvVars={() => {}} />;
}
