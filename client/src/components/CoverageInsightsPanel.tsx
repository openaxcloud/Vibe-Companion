import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  FileCode,
  Clock
} from 'lucide-react';

interface CoverageMetric {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface CoverageFile {
  path: string;
  lines: number;
  delta?: number;
}

interface CoverageInsightsPanelProps {
  projectId: number;
  className?: string;
}

const SAMPLE_FILES: CoverageFile[] = [
  { path: 'client/src/components/ReplitSidebar.tsx', lines: 92, delta: 3 },
  { path: 'client/src/components/Terminal.tsx', lines: 88, delta: -4 },
  { path: 'server/routes.ts', lines: 81, delta: 2 },
  { path: 'server/services/runtime-manager.ts', lines: 76, delta: -6 },
  { path: 'sdk/runtime/client.ts', lines: 73, delta: 1 },
  { path: 'client/src/components/ai/ReplitAgentPanelV3.tsx', lines: 70, delta: 5 },
  { path: 'client/src/components/DeploymentPanel.tsx', lines: 66, delta: 0 },
  { path: 'client/src/components/ReplitWorkflows.tsx', lines: 64, delta: -3 },
  { path: 'server/ai/advanced-ai-service.ts', lines: 62, delta: 4 },
  { path: 'client/src/components/GitPanel.tsx', lines: 58, delta: 0 }
];

export function CoverageInsightsPanel({ projectId, className }: CoverageInsightsPanelProps) {
  const coverage: CoverageMetric = useMemo(() => ({
    statements: 82,
    branches: 76,
    functions: 79,
    lines: 74
  }), [projectId]);

  const regressions = useMemo(() => SAMPLE_FILES.filter((file) => (file.delta ?? 0) < 0).slice(0, 3), []);

  return (
    <Card className={className}>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">Coverage Insights</CardTitle>
              <CardDescription>
                Track unit test health and catch regressions early.
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Updated moments ago
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex flex-col">
        <div className="grid grid-cols-1 gap-2 px-2.5 py-2 border-b border-[var(--ecode-border)] bg-[var(--ecode-sidebar-hover)] md:grid-cols-2">
          <CoverageSummaryCard
            title="Statements"
            value={coverage.statements}
            description="Statements executed during the last run"
            icon={TrendingUp}
          />
          <CoverageSummaryCard
            title="Branches"
            value={coverage.branches}
            description="Conditional branches evaluated"
            icon={ShieldCheck}
          />
          <CoverageSummaryCard
            title="Functions"
            value={coverage.functions}
            description="Functions protected by tests"
            icon={CheckCircle2}
          />
          <CoverageSummaryCard
            title="Lines"
            value={coverage.lines}
            description="Average line coverage across the repo"
            icon={FileCode}
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold">Coverage by file</h3>
                <Badge variant="outline">Top {SAMPLE_FILES.length}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">File</TableHead>
                    <TableHead className="w-1/4 text-right">Line coverage</TableHead>
                    <TableHead className="w-1/4 text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_FILES.map((file) => (
                    <TableRow key={file.path}>
                      <TableCell className="font-mono text-[11px]">{file.path}</TableCell>
                      <TableCell className="text-right text-[13px] font-medium">{file.lines}%</TableCell>
                      <TableCell className="text-right">
                        {typeof file.delta === 'number' ? (
                          <Badge variant={file.delta >= 0 ? 'secondary' : 'destructive'}>
                            {file.delta >= 0 ? '+' : ''}{file.delta}%
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {regressions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-[13px] font-semibold">Regressions to investigate</h3>
                </div>
                <div className="space-y-3">
                  {regressions.map((file) => (
                    <div key={file.path} className="rounded border border-amber-200 bg-amber-50/40 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px]">{file.path}</span>
                        <Badge variant="destructive">{file.delta}%</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Coverage dipped on the last run. Revisit tests touching this file.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert variant="secondary">
              <AlertTitle>Tip</AlertTitle>
              <AlertDescription>
                Kick off `npm run test -- --coverage` from the Testing tab to refresh this report for project {projectId}.
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface CoverageSummaryCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

function CoverageSummaryCard({ title, value, description, icon: Icon }: CoverageSummaryCardProps) {
  return (
    <div className="rounded-md border border-border/60 bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground tracking-wide">{title}</p>
          <p className="text-2xl font-semibold mt-1">{value}%</p>
        </div>
        <div className="rounded-full bg-muted p-2">
          <Icon className="h-5 w-5 text-[var(--ecode-accent)]" />
        </div>
      </div>
      <div className="mt-3">
        <Progress value={value} className="h-2" />
        <p className="text-[11px] text-muted-foreground mt-2">{description}</p>
      </div>
    </div>
  );
}
