import EnvVarsPanel from '@/components/EnvVarsPanel';

export function ReplitSecretsPanel({ projectId }: { projectId: string }) {
  return <EnvVarsPanel projectId={projectId} onClose={() => {}} />;
}
