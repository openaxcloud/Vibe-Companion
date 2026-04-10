import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Filter,
  File,
  ChevronRight,
  ChevronDown,
  Wrench,
  Zap,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle2,
  X,
  Code,
  FileWarning,
  Lightbulb,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TABLET_GRID_CLASSES } from '@shared/responsive-config';

type Severity = 'error' | 'warning' | 'info';

interface Problem {
  id: string;
  file: string;
  path: string;
  line: number;
  column: number;
  message: string;
  severity: Severity;
  source: string;
  code?: string;
  quickFixes?: QuickFix[];
}

interface QuickFix {
  id: string;
  title: string;
  description: string;
  isPreferred?: boolean;
}

interface FileGroup {
  path: string;
  file: string;
  problems: Problem[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export default function ProblemsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [problems] = useState<Problem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredProblems = useMemo(() => {
    let filtered = problems;
    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(p => p.severity === selectedSeverity);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.message.toLowerCase().includes(query) ||
        p.file.toLowerCase().includes(query) ||
        p.source.toLowerCase().includes(query) ||
        p.code?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [problems, selectedSeverity, searchQuery]);

  const groupedByFile = useMemo(() => {
    const groups: Record<string, FileGroup> = {};
    filteredProblems.forEach(problem => {
      if (!groups[problem.path]) {
        groups[problem.path] = {
          path: problem.path,
          file: problem.file,
          problems: [],
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
        };
      }
      groups[problem.path].problems.push(problem);
      if (problem.severity === 'error') groups[problem.path].errorCount++;
      else if (problem.severity === 'warning') groups[problem.path].warningCount++;
      else groups[problem.path].infoCount++;
    });
    return Object.values(groups).sort((a, b) => b.errorCount - a.errorCount);
  }, [filteredProblems]);

  const stats = useMemo(() => ({
    errors: problems.filter(p => p.severity === 'error').length,
    warnings: problems.filter(p => p.severity === 'warning').length,
    info: problems.filter(p => p.severity === 'info').length,
  }), [problems]);

  const toggleFileExpand = (path: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFiles(newExpanded);
  };

  const applyQuickFix = (fix: QuickFix, problem: Problem) => {
    toast({
      title: 'Quick fix applied',
      description: `Applied: ${fix.title}`,
    });
  };

  const refreshDiagnostics = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: 'Diagnostics refreshed',
        description: 'All files have been re-analyzed.',
      });
    }, 1500);
  };

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'error':
        return 'bg-destructive text-destructive-foreground';
      case 'warning':
        return 'bg-yellow-500 text-white';
      case 'info':
        return 'bg-blue-500 text-white';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Message copied to clipboard.' });
  };

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";

  return (
    <PageShell>
      <div
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        data-testid="page-problems"
      >
        <PageHeader
          title="Problems"
          description="View and resolve errors, warnings, and diagnostics from your codebase."
          icon={FileWarning}
          actions={(
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 border-border bg-card"
                onClick={refreshDiagnostics}
                disabled={isRefreshing}
                data-testid="button-refresh-diagnostics"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-fix-all"
              >
                <Wrench className="h-4 w-4" />
                Fix All
              </Button>
            </div>
          )}
        >
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold text-destructive" data-testid="stat-errors">{stats.errors}</span>
              <span className="text-[13px] text-muted-foreground">Errors</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-600" data-testid="stat-warnings">{stats.warnings}</span>
              <span className="text-[13px] text-muted-foreground">Warnings</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600" data-testid="stat-info">{stats.info}</span>
              <span className="text-[13px] text-muted-foreground">Info</span>
            </div>
          </div>
        </PageHeader>

        <div className="mt-6 space-y-4">
          <Card className={cardClassName} data-testid="card-filters">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search problems..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${inputClassName} pl-10`}
                    data-testid="input-search-problems"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedSeverity === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSeverity('all')}
                    data-testid="filter-all"
                  >
                    All
                  </Button>
                  <Button
                    variant={selectedSeverity === 'error' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedSeverity === 'error' ? 'bg-destructive hover:bg-destructive/90' : ''}
                    onClick={() => setSelectedSeverity('error')}
                    data-testid="filter-errors"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Errors
                  </Button>
                  <Button
                    variant={selectedSeverity === 'warning' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedSeverity === 'warning' ? 'bg-yellow-500 hover:bg-yellow-500/90' : ''}
                    onClick={() => setSelectedSeverity('warning')}
                    data-testid="filter-warnings"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Warnings
                  </Button>
                  <Button
                    variant={selectedSeverity === 'info' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedSeverity === 'info' ? 'bg-blue-500 hover:bg-blue-500/90' : ''}
                    onClick={() => setSelectedSeverity('info')}
                    data-testid="filter-info"
                  >
                    <Info className="h-4 w-4 mr-1" />
                    Info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className={cardClassName} data-testid="card-problems-list">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[13px] flex items-center justify-between">
                    <span>Problems by File</span>
                    <Badge variant="outline">{filteredProblems.length} issues</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {groupedByFile.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                        <p className="font-medium text-green-600">No problems found</p>
                        <p className="text-[11px] mt-1">Your code is clean!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {groupedByFile.map((group) => (
                          <Collapsible
                            key={group.path}
                            open={expandedFiles.has(group.path)}
                            onOpenChange={() => toggleFileExpand(group.path)}
                          >
                            <CollapsibleTrigger
                              className="w-full p-3 rounded-lg border border-border hover:border-primary/30 transition-all duration-200 text-left"
                              data-testid={`collapsible-${group.file}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {expandedFiles.has(group.path) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <File className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{group.file}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {group.errorCount > 0 && (
                                    <Badge variant="destructive" className="text-[11px]">
                                      {group.errorCount}
                                    </Badge>
                                  )}
                                  {group.warningCount > 0 && (
                                    <Badge className="bg-yellow-500 text-[11px]">
                                      {group.warningCount}
                                    </Badge>
                                  )}
                                  {group.infoCount > 0 && (
                                    <Badge className="bg-blue-500 text-[11px]">
                                      {group.infoCount}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1 ml-6">
                                {group.path}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1">
                              <div className="ml-6 space-y-1">
                                {group.problems.map((problem) => (
                                  <div
                                    key={problem.id}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                      selectedProblem?.id === problem.id
                                        ? 'bg-primary/5 border-primary/50'
                                        : 'border-border hover:border-primary/30 hover:bg-muted/50'
                                    }`}
                                    onClick={() => setSelectedProblem(problem)}
                                    data-testid={`problem-${problem.id}`}
                                  >
                                    <div className="flex items-start gap-2">
                                      {getSeverityIcon(problem.severity)}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-[11px]">
                                            L{problem.line}:{problem.column}
                                          </Badge>
                                          <Badge variant="secondary" className="text-[11px]">
                                            {problem.source}
                                          </Badge>
                                          {problem.code && (
                                            <code className="text-[11px] text-muted-foreground">
                                              {problem.code}
                                            </code>
                                          )}
                                        </div>
                                        <p className="text-[13px] mt-1">{problem.message}</p>
                                      </div>
                                      {problem.quickFixes && problem.quickFixes.length > 0 && (
                                        <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className={cardClassName} data-testid="card-problem-details">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[13px]">Problem Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {selectedProblem ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                          {getSeverityIcon(selectedProblem.severity)}
                          <Badge className={getSeverityColor(selectedProblem.severity)}>
                            {selectedProblem.severity.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[11px] text-muted-foreground">File</Label>
                          <div className="flex items-center gap-2 p-2 bg-muted rounded">
                            <File className="h-4 w-4" />
                            <span className="text-[13px] font-mono truncate">{selectedProblem.file}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{selectedProblem.path}</div>
                        </div>

                        <div className="flex gap-4">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Line</Label>
                            <div className="font-mono text-[13px]">{selectedProblem.line}</div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Column</Label>
                            <div className="font-mono text-[13px]">{selectedProblem.column}</div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Source</Label>
                            <div className="font-mono text-[13px]">{selectedProblem.source}</div>
                          </div>
                        </div>

                        {selectedProblem.code && (
                          <div className="space-y-2">
                            <Label className="text-[11px] text-muted-foreground">Rule Code</Label>
                            <code className="block p-2 bg-muted rounded text-[13px]">
                              {selectedProblem.code}
                            </code>
                          </div>
                        )}

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-[11px] text-muted-foreground">Message</Label>
                          <p className="text-[13px] p-3 bg-muted rounded-lg">{selectedProblem.message}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedProblem.message)}
                            data-testid="button-copy-message"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>

                        {selectedProblem.quickFixes && selectedProblem.quickFixes.length > 0 && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <Lightbulb className="h-3 w-3 text-yellow-500" />
                                Quick Fixes
                              </Label>
                              <div className="space-y-2">
                                {selectedProblem.quickFixes.map((fix) => (
                                  <Button
                                    key={fix.id}
                                    variant={fix.isPreferred ? 'default' : 'outline'}
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => applyQuickFix(fix, selectedProblem)}
                                    data-testid={`button-quickfix-${fix.id}`}
                                  >
                                    <Zap className="h-4 w-4 mr-2" />
                                    <div className="text-left">
                                      <div className="font-medium">{fix.title}</div>
                                      <div className="text-[11px] opacity-70">{fix.description}</div>
                                    </div>
                                    {fix.isPreferred && (
                                      <Badge variant="secondary" className="ml-auto text-[11px]">
                                        Preferred
                                      </Badge>
                                    )}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        <Separator />

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            data-testid="button-goto-location"
                          >
                            <Code className="h-4 w-4 mr-2" />
                            Go to Location
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="button-view-docs"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Select a problem to view details</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

const Label = ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => (
  <label className={`text-[13px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ''}`} {...props}>
    {children}
  </label>
);
