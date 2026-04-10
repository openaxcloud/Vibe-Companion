import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Lightbulb, Play, BarChart3,
  CheckCircle2, Loader2, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionCard, type ActionCardProps } from './ActionCard';
import { ExecutionTimeline, type TimelineItem } from './ExecutionTimeline';
import type { ThinkingStep } from '@/components/ai/ThinkingDisplay';
import type { ToolExecutionProps } from '@/components/ai/ToolExecutionDisplay';

type NormalizedStatus = 'pending' | 'running' | 'complete' | 'error';

function normalizeStatus(status: string): NormalizedStatus {
  if (status === 'active') return 'running';
  if (status === 'completed') return 'complete';
  if (status === 'pending' || status === 'running' || status === 'complete' || status === 'error') {
    return status as NormalizedStatus;
  }
  return 'pending';
}

export type WallPhase = 'plan' | 'execution' | 'results';

export interface AgentWallProps {
  thinkingSteps?: ThinkingStep[];
  toolExecutions?: ToolExecutionProps[];
  result?: {
    summary?: string;
    filesCreated?: string[];
    filesModified?: string[];
    commandsRun?: number;
    errors?: string[];
  };
  isActive?: boolean;
  className?: string;
}

interface PhaseConfig {
  id: WallPhase;
  label: string;
  icon: typeof Lightbulb;
  emptyText: string;
  accentColor: string;
  dotColor: string;
}

const PHASES: PhaseConfig[] = [
  {
    id: 'plan',
    label: 'Plan',
    icon: Lightbulb,
    emptyText: 'No planning steps yet',
    accentColor: 'text-violet-400',
    dotColor: 'bg-violet-500',
  },
  {
    id: 'execution',
    label: 'Execution',
    icon: Play,
    emptyText: 'No actions executed yet',
    accentColor: 'text-blue-400',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'results',
    label: 'Results',
    icon: BarChart3,
    emptyText: 'Awaiting results',
    accentColor: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
];

function getPhaseStatus(
  phase: WallPhase,
  thinkingSteps: ThinkingStep[],
  toolExecutions: ToolExecutionProps[],
  result: AgentWallProps['result']
): 'pending' | 'running' | 'complete' | 'error' {
  if (phase === 'plan') {
    if (thinkingSteps.length === 0) return 'pending';
    if (thinkingSteps.some(s => normalizeStatus(s.status) === 'running')) return 'running';
    if (thinkingSteps.some(s => normalizeStatus(s.status) === 'error')) return 'error';
    if (thinkingSteps.every(s => normalizeStatus(s.status) === 'complete')) return 'complete';
    return 'running';
  }
  if (phase === 'execution') {
    if (toolExecutions.length === 0) return 'pending';
    if (toolExecutions.some(t => t.status === 'running')) return 'running';
    if (toolExecutions.some(t => t.status === 'error' || (t.status === 'complete' && t.success === false))) return 'error';
    if (toolExecutions.every(t => t.status === 'complete')) return 'complete';
    return 'running';
  }
  if (!result) return 'pending';
  if (result.errors && result.errors.length > 0) return 'error';
  return 'complete';
}

function PhaseSection({
  config,
  status,
  count,
  defaultOpen,
  children,
}: {
  config: PhaseConfig;
  status: 'pending' | 'running' | 'complete' | 'error';
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = config.icon;

  const statusLabel = status === 'running' ? 'In progress' : status === 'complete' ? 'Done' : status === 'error' ? 'Failed' : 'Pending';

  return (
    <div className="relative" data-testid={`wall-phase-${config.id}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
        data-testid={`wall-phase-toggle-${config.id}`}
      >
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', config.dotColor)} />
        <Icon className={cn('h-4 w-4 flex-shrink-0', config.accentColor)} />
        <span className="text-[13px] font-semibold text-foreground flex-1 text-left">
          {config.label}
        </span>
        {count > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        )}
        <StatusBadge status={status} label={statusLabel} />
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="pl-5 pr-1 pb-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const base = 'text-[9px] font-medium px-1.5 py-0.5 rounded-full';
  switch (status) {
    case 'running':
      return (
        <span className={cn(base, 'bg-blue-900/40 text-blue-400 border border-blue-800/40')}>
          <Loader2 className="inline h-2.5 w-2.5 mr-0.5 animate-spin" />
          {label}
        </span>
      );
    case 'complete':
      return (
        <span className={cn(base, 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/40')}>
          <CheckCircle2 className="inline h-2.5 w-2.5 mr-0.5" />
          {label}
        </span>
      );
    case 'error':
      return (
        <span className={cn(base, 'bg-red-900/40 text-red-400 border border-red-800/40')}>
          {label}
        </span>
      );
    default:
      return (
        <span className={cn(base, 'bg-muted text-muted-foreground')}>
          <Clock className="inline h-2.5 w-2.5 mr-0.5" />
          {label}
        </span>
      );
  }
}

export function AgentWall({
  thinkingSteps = [],
  toolExecutions = [],
  result,
  isActive = false,
  className,
}: AgentWallProps) {
  const planStatus = getPhaseStatus('plan', thinkingSteps, toolExecutions, result);
  const execStatus = getPhaseStatus('execution', thinkingSteps, toolExecutions, result);
  const resultStatus = getPhaseStatus('results', thinkingSteps, toolExecutions, result);

  const planItems: TimelineItem[] = useMemo(
    () =>
      thinkingSteps.map((step, i) => ({
        id: step.id,
        status: normalizeStatus(step.status),
        content: (
          <ActionCard
            id={`plan-${step.id}`}
            iconName="reasoning"
            title={step.title}
            subtitle={step.type}
            status={normalizeStatus(step.status)}
            duration={step.duration}
          >
            {step.content && (
              <p className="text-[12px] text-muted-foreground whitespace-pre-wrap">
                {step.content}
              </p>
            )}
          </ActionCard>
        ),
      })),
    [thinkingSteps]
  );

  const execItems: TimelineItem[] = useMemo(
    () =>
      toolExecutions.map((exec) => {
        const toolLabels: Record<string, string> = {
          create_file: 'Created File',
          edit_file: 'Edited File',
          read_file: 'Read File',
          delete_file: 'Deleted File',
          list_directory: 'Listed Directory',
          run_command: 'Executed Command',
          install_package: 'Installed Package',
          web_search: 'Web Search',
          search_code: 'Code Search',
          get_project_structure: 'Analyzed Project',
          get_diagnostics: 'Ran Diagnostics',
        };
        const label = toolLabels[exec.tool] || exec.tool;
        const target =
          exec.parameters?.path ||
          exec.parameters?.command?.slice(0, 60) ||
          exec.parameters?.query ||
          exec.parameters?.package_name ||
          undefined;

        return {
          id: exec.id,
          status: exec.status,
          content: (
            <ActionCard
              id={`exec-${exec.id}`}
              iconName={exec.tool}
              title={label}
              subtitle={target}
              status={exec.status}
              duration={exec.metadata?.executionTime}
            >
              {exec.result?.stdout && (
                <pre className="bg-muted p-2 rounded-md text-[11px] font-mono overflow-x-auto max-h-32 overflow-y-auto mt-1">
                  {exec.result.stdout}
                </pre>
              )}
              {exec.result?.description && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {exec.result.description}
                </p>
              )}
              {exec.error && (
                <p className="text-[11px] text-red-400 mt-1">{exec.error}</p>
              )}
            </ActionCard>
          ),
        };
      }),
    [toolExecutions]
  );

  const hasPlan = thinkingSteps.length > 0;
  const hasExec = toolExecutions.length > 0;
  const hasResults = !!result;
  const hasAnyContent = hasPlan || hasExec || hasResults;

  if (!hasAnyContent && !isActive) return null;

  return (
    <div
      className={cn('rounded-xl border border-border bg-card/50 overflow-hidden', className)}
      data-testid="agent-wall"
    >
      <div className="divide-y divide-border/50">
        {(hasPlan || isActive) && (
          <PhaseSection
            config={PHASES[0]}
            status={planStatus}
            count={thinkingSteps.length}
            defaultOpen={planStatus === 'running' || (planStatus === 'complete' && !hasExec)}
          >
            {planItems.length > 0 ? (
              <ExecutionTimeline items={planItems} />
            ) : isActive ? (
              <div className="flex items-center gap-2 py-3 pl-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <span className="text-[12px] text-muted-foreground">Agent is analyzing...</span>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground py-2 pl-3">{PHASES[0].emptyText}</p>
            )}
          </PhaseSection>
        )}

        {(hasExec || (isActive && hasPlan)) && (
          <PhaseSection
            config={PHASES[1]}
            status={execStatus}
            count={toolExecutions.length}
            defaultOpen={execStatus === 'running' || execStatus === 'complete'}
          >
            {execItems.length > 0 ? (
              <ExecutionTimeline items={execItems} />
            ) : (
              <p className="text-[12px] text-muted-foreground py-2 pl-3">{PHASES[1].emptyText}</p>
            )}
          </PhaseSection>
        )}

        {(hasResults || (hasExec && execStatus === 'complete')) && (
          <PhaseSection
            config={PHASES[2]}
            status={resultStatus}
            count={
              (result?.filesCreated?.length || 0) +
              (result?.filesModified?.length || 0) +
              (result?.commandsRun || 0)
            }
            defaultOpen={true}
          >
            {result ? (
              <div className="space-y-2 py-1">
                {result.summary && (
                  <p className="text-[12px] text-foreground">{result.summary}</p>
                )}
                {result.filesCreated && result.filesCreated.length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground font-medium">Files created:</span>
                    <ul className="mt-1 space-y-0.5">
                      {result.filesCreated.map((f, i) => (
                        <li key={i} className="text-[11px]">
                          <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-emerald-400">{f}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.filesModified && result.filesModified.length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground font-medium">Files modified:</span>
                    <ul className="mt-1 space-y-0.5">
                      {result.filesModified.map((f, i) => (
                        <li key={i} className="text-[11px]">
                          <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-blue-400">{f}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div>
                    <span className="text-[11px] text-red-400 font-medium">Errors:</span>
                    <ul className="mt-1 space-y-0.5">
                      {result.errors.map((e, i) => (
                        <li key={i} className="text-[11px] text-red-400">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground py-2 pl-3">{PHASES[2].emptyText}</p>
            )}
          </PhaseSection>
        )}
      </div>
    </div>
  );
}
