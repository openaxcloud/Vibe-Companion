import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileCode,
  Download,
  Filter,
  RefreshCw,
  ChevronRight,
  Shield,
  Zap,
  Bug,
  Code,
  Target,
  Settings,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  GitBranch,
  CheckSquare,
  XCircle
} from 'lucide-react';
import { LazyMotionDiv } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Review {
  id: number;
  projectId: string;
  fileId?: string;
  reviewType: string;
  status: string;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  codeQualityScore: number;
  summary: string;
  createdAt: string;
  completedAt?: string;
}

interface Issue {
  id: number;
  reviewId: number;
  fileId?: string;
  severity: string;
  type: string;
  line: number;
  message: string;
  explanation?: string;
  suggestion?: string;
  fixCode?: string;
  category: string;
  isFixed: boolean;
  fixedAt?: string;
}

interface CodeReviewPanelProps {
  projectId: string;
  className?: string;
  onIssueSelect?: (issue: Issue) => void;
  onFileOpen?: (fileId: string) => void;
}

export default function CodeReviewPanel({
  projectId,
  className,
  onIssueSelect,
  onFileOpen
}: CodeReviewPanelProps) {
  const [selectedReview, setSelectedReview] = useState<number | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('unfixed');
  const [viewMode, setViewMode] = useState<'list' | 'metrics' | 'history'>('list');
  const { toast } = useToast();

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['/api/code-review/issues', projectId],
    queryFn: async () => {
      return await apiRequest('GET', `/api/code-review/issues/${projectId}?limit=50`);
    }
  });

  const exportReportMutation = useMutation({
    mutationFn: async (format: 'json' | 'html' | 'markdown') => {
      const data = await apiRequest('GET', `/api/code-review/report/${projectId}?format=${format}`);
      
      // Create download
      const blob = new Blob([JSON.stringify(data)], { 
        type: format === 'json' ? 'application/json' : format === 'html' ? 'text/html' : 'text/markdown' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code-review-${projectId}-${format}.${format === 'markdown' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: 'Report Exported',
        description: 'The code review report has been downloaded successfully.'
      });
    }
  });

  const batchFixMutation = useMutation({
    mutationFn: async (issueIds: number[]) => {
      const promises = issueIds.map(async id => {
        return await apiRequest('POST', `/api/code-review/fix/${id}`, { fixCode: '' });
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: 'Fixes Applied',
        description: `${selectedIssues.size} issues have been fixed successfully.`
      });
      setSelectedIssues(new Set());
      queryClient.invalidateQueries({
        queryKey: ['/api/code-review/issues', projectId]
      });
    }
  });

  const reviews: Review[] = reviewsData?.reviews || [];
  const allIssues: Issue[] = reviewsData?.issues || [];
  
  // Filter issues
  const filteredIssues = allIssues.filter(issue => {
    if (selectedReview && issue.reviewId !== selectedReview) return false;
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterStatus === 'fixed' && !issue.isFixed) return false;
    if (filterStatus === 'unfixed' && issue.isFixed) return false;
    return true;
  });

  // Calculate metrics
  const totalIssues = allIssues.length;
  const fixedIssues = allIssues.filter(i => i.isFixed).length;
  const fixRate = totalIssues > 0 ? Math.round((fixedIssues / totalIssues) * 100) : 0;
  
  const severityData = [
    { name: 'Critical', value: reviews.reduce((sum, r) => sum + r.criticalIssues, 0), fill: '#ef4444' },
    { name: 'High', value: reviews.reduce((sum, r) => sum + r.highIssues, 0), fill: '#f97316' },
    { name: 'Medium', value: reviews.reduce((sum, r) => sum + r.mediumIssues, 0), fill: '#f59e0b' },
    { name: 'Low', value: reviews.reduce((sum, r) => sum + r.lowIssues, 0), fill: '#3b82f6' }
  ];

  const qualityTrend = reviews
    .slice(-10)
    .map(r => ({
      date: format(new Date(r.createdAt), 'MM/dd'),
      score: r.codeQualityScore
    }));

  const categories = Array.from(new Set(allIssues.map(i => i.category)));

  const toggleIssueSelection = (issueId: number) => {
    setSelectedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(issueId)) {
        newSet.delete(issueId);
      } else {
        newSet.add(issueId);
      }
      return newSet;
    });
  };

  const selectAllIssues = () => {
    if (selectedIssues.size === filteredIssues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(filteredIssues.map(i => i.id)));
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <AlertTriangle className="w-4 h-4" />;
      case 'low': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-status-critical';
      case 'high': return 'bg-status-critical';
      case 'medium': return 'bg-status-warning';
      case 'low': return 'bg-status-info';
      default: return 'bg-muted text-foreground';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return <Shield className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'bug': return <Bug className="w-4 h-4" />;
      case 'style': return <Code className="w-4 h-4" />;
      case 'best-practice': return <Target className="w-4 h-4" />;
      default: return <FileCode className="w-4 h-4" />;
    }
  };

  return (
    <div className={cn('h-full flex flex-col bg-[var(--ecode-surface)]', className)}>
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Review</span>
        </div>
        
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/code-review/issues', projectId] })}
            data-testid="button-refresh-reviews"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" data-testid="button-export-menu">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportReportMutation.mutate('json')}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReportMutation.mutate('html')}>
                Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReportMutation.mutate('markdown')}>
                Export as Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
        
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg bg-gradient-to-r from-status-info/10 to-blue-600/10 border border-status-info/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Total Reviews</p>
                <p className="text-xl font-bold">{reviews.length}</p>
              </div>
              <GitBranch className="w-5 h-5 text-status-info" />
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-r from-status-warning/10 to-orange-600/10 border border-status-warning/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Open Issues</p>
                <p className="text-xl font-bold">{totalIssues - fixedIssues}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-status-warning" />
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-r from-status-success/10 to-green-600/10 border border-status-success/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Fix Rate</p>
                <p className="text-xl font-bold">{fixRate}%</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-status-success" />
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-border/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Avg Quality</p>
                <p className="text-xl font-bold">
                  {reviews.length > 0 
                    ? Math.round(reviews.reduce((sum, r) => sum + r.codeQualityScore, 0) / reviews.length)
                    : 0}%
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="flex-1 flex flex-col">
          <TabsList className="h-8 w-full justify-start rounded-none bg-[var(--ecode-sidebar-hover)] p-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <TabsTrigger value="list">Issues List</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={String(selectedReview || 'all')} onValueChange={(v) => setSelectedReview(v === 'all' ? null : Number(v))}>
                <SelectTrigger className="w-[180px]" data-testid="select-review-filter">
                  <SelectValue placeholder="All Reviews" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  {reviews.map(review => (
                    <SelectItem key={review.id} value={String(review.id)}>
                      Review #{review.id} ({format(new Date(review.createdAt), 'MM/dd')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unfixed">Unfixed</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Batch Actions */}
            {selectedIssues.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-status-warning/10 rounded-lg border border-status-warning/20">
                <span className="text-[13px]">
                  {selectedIssues.size} issue{selectedIssues.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedIssues(new Set())}
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="bg-status-success hover:bg-status-success"
                    onClick={() => batchFixMutation.mutate(Array.from(selectedIssues))}
                    disabled={batchFixMutation.isPending}
                    data-testid="button-batch-fix"
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Apply Fixes
                  </Button>
                </div>
              </div>
            )}
            
            {/* Issues List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredIssues.length > 0 ? (
                  <>
                    {/* Select All */}
                    <div className="flex items-center gap-2 p-2 border-b">
                      <Checkbox
                        checked={selectedIssues.size === filteredIssues.length && filteredIssues.length > 0}
                        onCheckedChange={selectAllIssues}
                        data-testid="checkbox-select-all"
                      />
                      <span className="text-[13px] text-muted-foreground">Select all</span>
                    </div>
                    
                    {filteredIssues.map(issue => (
                      <LazyMotionDiv
                        key={issue.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border transition-all',
                          'hover:shadow-md hover:border-status-warning/50',
                          issue.isFixed && 'opacity-60'
                        )}
                      >
                        <Checkbox
                          checked={selectedIssues.has(issue.id)}
                          onCheckedChange={() => toggleIssueSelection(issue.id)}
                          disabled={issue.isFixed}
                          data-testid={`checkbox-issue-${issue.id}`}
                        />
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(issue.severity)}>
                              {getSeverityIcon(issue.severity)}
                              <span className="ml-1">{issue.severity}</span>
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              {getCategoryIcon(issue.category)}
                              {issue.category}
                            </Badge>
                            {issue.isFixed && (
                              <Badge className="bg-status-success">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Fixed
                              </Badge>
                            )}
                            <code className="text-[11px] text-muted-foreground">
                              Line {issue.line}
                            </code>
                          </div>
                          
                          <p className="text-[13px]">{issue.message}</p>
                          
                          {issue.suggestion && (
                            <p className="text-[11px] text-muted-foreground">
                              💡 {issue.suggestion}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {issue.fileId && onFileOpen && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onFileOpen(issue.fileId!)}
                              data-testid={`button-open-file-${issue.id}`}
                            >
                              <FileCode className="w-4 h-4" />
                            </Button>
                          )}
                          {onIssueSelect && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onIssueSelect(issue)}
                              data-testid={`button-select-issue-${issue.id}`}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </LazyMotionDiv>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-status-success mb-4" />
                    <h3 className="text-[15px] font-semibold mb-2">No Issues Found</h3>
                    <p className="text-muted-foreground">
                      {filterStatus !== 'all' || filterSeverity !== 'all' || filterCategory !== 'all'
                        ? 'No issues match the current filters.'
                        : 'Great! Your code is clean and follows best practices.'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="metrics" className="space-y-4">
            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Quality Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Code Quality Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={qualityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#f97316"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issues by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.map(category => {
                    const count = allIssues.filter(i => i.category === category).length;
                    const percentage = totalIssues > 0 ? (count / totalIssues) * 100 : 0;
                    
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category)}
                            <span className="capitalize">{category}</span>
                          </div>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {reviews.map(review => (
                  <Card key={review.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            Review #{review.id}
                          </Badge>
                          <Badge className={review.status === 'completed' ? 'bg-status-success' : 'bg-status-info'}>
                            {review.status}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(review.createdAt), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-[13px]">
                          <div className="flex items-center gap-1">
                            <Activity className="w-4 h-4 text-status-warning" />
                            <span>Quality: {review.codeQualityScore}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-status-critical" />
                            <span>{review.totalIssues} issues</span>
                          </div>
                        </div>
                        
                        <p className="text-[13px] text-muted-foreground">
                          {review.summary}
                        </p>
                        
                        <div className="flex gap-2 text-[11px]">
                          <span className="text-status-critical">
                            {review.criticalIssues} critical
                          </span>
                          <span className="text-status-warning">
                            {review.highIssues} high
                          </span>
                          <span className="text-status-warning">
                            {review.mediumIssues} medium
                          </span>
                          <span className="text-status-info">
                            {review.lowIssues} low
                          </span>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedReview(review.id)}
                        data-testid={`button-view-review-${review.id}`}
                      >
                        View Issues
                      </Button>
                    </div>
                  </Card>
                ))}
                
                {reviews.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-[15px] font-semibold mb-2">No Review History</h3>
                    <p className="text-muted-foreground">
                      Run your first code review to see the history here.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}