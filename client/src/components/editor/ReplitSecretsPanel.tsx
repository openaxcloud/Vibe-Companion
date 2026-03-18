import EnvVarsPanel from '@/components/EnvVarsPanel';

interface ReplitSecretsPanelProps {
  projectId: string;
  onClose?: () => void;
}

export function ReplitSecretsPanel({ projectId, onClose }: ReplitSecretsPanelProps) {
  return <EnvVarsPanel projectId={projectId} onClose={onClose || (() => {})} />;
}
