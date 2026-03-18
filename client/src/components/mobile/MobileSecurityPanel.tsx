import { Shield } from 'lucide-react';

interface MobileSecurityPanelProps {
  projectId: string;
}

export function MobileSecurityPanel({ projectId }: MobileSecurityPanelProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 bg-[var(--ide-panel)]">
      <Shield className="w-10 h-10 text-[var(--ide-text-muted)]" />
      <h3 className="text-sm font-semibold text-[var(--ide-text)]">Security Scanner</h3>
      <p className="text-xs text-[var(--ide-text-muted)] text-center max-w-[200px]">Scan your project for vulnerabilities</p>
    </div>
  );
}
