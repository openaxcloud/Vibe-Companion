import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Code, 
  Bug,
  Shield,
  Zap,
  FileCode,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Sparkles,
  PlayCircle,
  XCircle,
  Target,
  Lightbulb,
  Clock
} from 'lucide-react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface CodeIssue {
  id: number;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  message: string;
  explanation?: string;
  suggestion?: string;
  fixCode?: string;
  category: string;
  rule?: string;
  confidence: number;
  isFixed?: boolean;
}

interface ReviewResult {
  issues: CodeIssue[];
  metrics: {
    codeQualityScore: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    infoIssues: number;
  };
  summary: string;
}

interface AICodeReviewProps {
  projectId: string;
  fileId?: string;
  filePath: string;
  code: string;
  onIssueFix?: (issue: CodeIssue, fixCode: string) => void;
  onIssueClick?: (issue: CodeIssue) => void;
  inline?: boolean;
  className?: string;
}

export default function AICodeReview({
  projectId,
  fileId,
  filePath,
  code,
  onIssueFix,
  onIssueClick,
  inline = false,
  className
}: AICodeReviewProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isReviewing, setIsReviewing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const reviewMutation = useMutation<ReviewResult, Error, void>({
    mutationFn: async () => {
      setIsReviewing(true);
      setProgress(0);
      
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      try {
        const response = await apiRequest('POST', '/api/code-review/analyze', {
          projectId,
          fileId,
          filePath,
          code,
          options: {
            checkSecurity: true,
            checkPerformance: true,
            checkStyle: true,
            checkBestPractices: true,
            checkComplexity: true,
            checkDuplication: true,
            checkDocumentation: true,
            reviewType: 'manual'
          }
        });

        clearInterval(progressInterval);
        setProgress(100);
        
        const data = await response.json();
        return data.review as ReviewResult;
      } finally {
        clearInterval(progressInterval);
        setIsReviewing(false);
        setTimeout(() => setProgress(0), 500);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/code-review/current', projectId, filePath], data);
      toast({
        title: 'Code Review Complete',
        description: `Found ${data.issues.length} issues. Code quality: ${data.metrics.codeQualityScore}%`
      });
    },
    onError: (error) => {
      toast({
        title: 'Review Failed',
        description: 'Failed to analyze code. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const { data: reviewData } = useQuery({
    queryKey: ['/api/code-review/current', projectId, filePath],
    enabled: false
  });

  const applyFixMutation = useMutation({
    mutationFn: async ({ issueId, fixCode }: { issueId: number; fixCode: string }) => {
      const response = await apiRequest('POST', `/api/code-review/fix/${issueId}`, { fixCode });
      return response.json();
    },
    onSuccess: (_, { issueId }) => {
      toast({
        title: 'Fix Applied',
        description: 'The suggested fix has been applied successfully.'
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/code-review/current', projectId, filePath]
      });
    }
  });

  const startReview = useCallback(() => {
    reviewMutation.mutate();
  }, [reviewMutation]);

  const toggleIssueExpanded = (issueId: number) => {
    setExpandedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(issueId)) {
        newSet.delete(issueId);
      } else {
        newSet.add(issueId);
      }
      return newSet;
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4" />;
      case 'high':
        return <AlertCircle className="w-4 h-4" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4" />;
      case 'low':
        return <Info className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-status-critical hover:bg-status-critical';
      case 'high':
        return 'bg-status-critical hover:bg-status-critical';
      case 'medium':
        return 'bg-status-warning hover:bg-status-warning';
      case 'low':
        return 'bg-status-info hover:bg-status-info';
      default:
        return 'bg-muted text-foreground hover:bg-muted';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return <Shield className="w-4 h-4" />;
      case 'performance':
        return <Zap className="w-4 h-4" />;
      case 'bug':
        return <Bug className="w-4 h-4" />;
      case 'style':
        return <Code className="w-4 h-4" />;
      case 'best-practice':
        return <Target className="w-4 h-4" />;
      default:
        return <FileCode className="w-4 h-4" />;
    }
  };

  const filteredIssues = reviewData?.issues?.filter((issue: CodeIssue) => {
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    return !issue.isFixed;
  }) || [];

  const categories: string[] = Array.from(new Set(reviewData?.issues?.map((i: CodeIssue) => i.category) || []));

  if (inline) {
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <Button
          size="sm"
          variant="outline"
          onClick={startReview}
          disabled={isReviewing}
          className="gap-2"
          data-testid="button-start-review-inline"
        >
          {isReviewing ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              Reviewing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Review Code
            </>
          )}
        </Button>
        {reviewData && (
          <div className="flex items-center gap-1">
            {reviewData.metrics.criticalIssues > 0 && (
              <Badge variant="destructive" className="text-[11px]">
                {reviewData.metrics.criticalIssues} Critical
              </Badge>
            )}
            {reviewData.metrics.highIssues > 0 && (
              <Badge variant="destructive" className="text-[11px] opacity-80">
                {reviewData.metrics.highIssues} High
              </Badge>
            )}
            {reviewData.metrics.mediumIssues > 0 && (
              <Badge className="bg-status-warning text-[11px]">
                {reviewData.metrics.mediumIssues} Medium
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('w-full bg-background/95 backdrop-blur', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Sparkles className="w-5 h-5 text-status-warning" />
            AI Code Review
          </CardTitle>
          <Button
            onClick={startReview}
            disabled={isReviewing}
            className="bg-status-warning hover:bg-status-warning"
            data-testid="button-start-review"
          >
            {isReviewing ? (
              <>
                <Clock className="mr-2 w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 w-4 h-4" />
                Start Review
              </>
            )}
          </Button>
        </div>
        
        {isReviewing && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span>Analyzing code...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {reviewData && !isReviewing && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-status-success/10 to-green-600/10 border border-status-success/20">
              <CheckCircle2 className="w-5 h-5 text-status-success" />
              <div>
                <p className="text-[11px] text-muted-foreground">Quality Score</p>
                <p className="text-[15px] font-bold text-status-success">
                  {reviewData.metrics.codeQualityScore}%
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-status-critical/10 to-red-600/10 border border-status-critical/20">
              <XCircle className="w-5 h-5 text-status-critical" />
              <div>
                <p className="text-[11px] text-muted-foreground">Critical</p>
                <p className="text-[15px] font-bold text-status-critical">
                  {reviewData.metrics.criticalIssues}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-status-warning/10 to-orange-600/10 border border-status-warning/20">
              <AlertTriangle className="w-5 h-5 text-status-warning" />
              <div>
                <p className="text-[11px] text-muted-foreground">Medium</p>
                <p className="text-[15px] font-bold text-status-warning">
                  {reviewData.metrics.mediumIssues}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-status-info/10 to-blue-600/10 border border-status-info/20">
              <Info className="w-5 h-5 text-status-info" />
              <div>
                <p className="text-[11px] text-muted-foreground">Low</p>
                <p className="text-[15px] font-bold text-status-info">
                  {reviewData.metrics.lowIssues}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {reviewData && reviewData.issues.length > 0 && (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <Tabs value={filterSeverity} onValueChange={setFilterSeverity} className="flex-1">
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="critical">Critical</TabsTrigger>
                  <TabsTrigger value="high">High</TabsTrigger>
                  <TabsTrigger value="medium">Medium</TabsTrigger>
                  <TabsTrigger value="low">Low</TabsTrigger>
                  <TabsTrigger value="info">Info</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1 border rounded-md bg-background"
                data-testid="select-category-filter"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <LazyAnimatePresence>
                  {filteredIssues.map((issue: CodeIssue) => (
                    <LazyMotionDiv
                      key={issue.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={cn(
                        'p-4 rounded-lg border transition-all',
                        'hover:shadow-md hover:border-status-warning/50',
                        'bg-card'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              onClick={() => toggleIssueExpanded(issue.id)}
                              className="p-0.5"
                              data-testid={`button-toggle-issue-${issue.id}`}
                            >
                              {expandedIssues.has(issue.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {getSeverityIcon(issue.severity)}
                              <span className="ml-1">{issue.severity}</span>
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              {getCategoryIcon(issue.category)}
                              {issue.category}
                            </Badge>
                            <code className="text-[11px] text-muted-foreground">
                              Line {issue.line}
                              {issue.column && `:${issue.column}`}
                            </code>
                            {issue.confidence < 0.8 && (
                              <Badge variant="secondary" className="text-[11px]">
                                {Math.round(issue.confidence * 100)}% confidence
                              </Badge>
                            )}
                          </div>
                          
                          <p className="font-medium text-[13px]">{issue.message}</p>
                          
                          <div className={cn("collapsible-content", expandedIssues.has(issue.id) && "expanded")}>
                            <div className="mt-3 space-y-2 overflow-hidden">
                                {issue.explanation && (
                                  <div className="p-3 rounded bg-muted/50 text-[13px]">
                                    <p className="font-medium mb-1">Explanation:</p>
                                    <p className="text-muted-foreground">{issue.explanation}</p>
                                  </div>
                                )}
                                
                                {issue.suggestion && (
                                  <div className="p-3 rounded bg-status-info/10 border border-status-info/20 text-[13px]">
                                    <p className="font-medium mb-1 text-status-info">Suggestion:</p>
                                    <p>{issue.suggestion}</p>
                                  </div>
                                )}
                                
                                {issue.fixCode && (
                                  <div className="p-3 rounded bg-status-success/10 border border-status-success/20">
                                    <p className="font-medium mb-1 text-status-success text-[13px]">Suggested Fix:</p>
                                    <pre className="text-[11px] overflow-x-auto">
                                      <code>{issue.fixCode}</code>
                                    </pre>
                                  </div>
                                )}
                                
                                {issue.rule && (
                                  <p className="text-[11px] text-muted-foreground">
                                    Rule: {issue.rule}
                                  </p>
                                )}
                              </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {issue.fixCode && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (onIssueFix) {
                                  onIssueFix(issue, issue.fixCode!);
                                }
                                applyFixMutation.mutate({
                                  issueId: issue.id,
                                  fixCode: issue.fixCode!
                                });
                              }}
                              className="text-status-success hover:bg-status-success/10"
                              data-testid={`button-apply-fix-${issue.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Apply Fix
                            </Button>
                          )}
                          {onIssueClick && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onIssueClick(issue)}
                              data-testid={`button-view-issue-${issue.id}`}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    </LazyMotionDiv>
                  ))}
                </LazyAnimatePresence>
              </div>
            </ScrollArea>
          </>
        )}
        
        {reviewData && reviewData.issues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-status-success mb-4" />
            <h3 className="text-[15px] font-semibold mb-2">Perfect Code!</h3>
            <p className="text-muted-foreground">
              No issues found. Your code follows all best practices.
            </p>
          </div>
        )}
        
        {!reviewData && !isReviewing && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="w-12 h-12 text-status-warning mb-4" />
            <h3 className="text-[15px] font-semibold mb-2">Ready to Review</h3>
            <p className="text-muted-foreground mb-4">
              Click "Start Review" to analyze your code for issues and improvements.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}