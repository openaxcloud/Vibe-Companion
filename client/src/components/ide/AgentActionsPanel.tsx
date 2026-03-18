import { Zap } from 'lucide-react';

interface AgentActionsPanelProps {
  projectId: string;
}

export function AgentActionsPanel({ projectId }: AgentActionsPanelProps) {
  return (
    <div className="h-full flex flex-col overflow-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-[#F5A623]" />
        <h2 className="text-[13px] font-semibold text-[var(--ide-text)]">Agent Actions</h2>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-[var(--ide-text-muted)]">Quick actions for the AI agent to perform on your project.</p>
        {[
          { label: 'Generate Tests', desc: 'Auto-generate unit tests for your code' },
          { label: 'Fix Errors', desc: 'Scan and fix issues in your project' },
          { label: 'Add Documentation', desc: 'Generate code documentation' },
          { label: 'Optimize Performance', desc: 'Identify and fix performance issues' },
          { label: 'Refactor Code', desc: 'Improve code quality and structure' },
        ].map(action => (
          <button
            key={action.label}
            className="w-full text-left p-3 rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] hover:bg-[var(--ide-surface)] transition-colors"
          >
            <p className="text-[11px] font-medium text-[var(--ide-text)]">{action.label}</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-0.5">{action.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
