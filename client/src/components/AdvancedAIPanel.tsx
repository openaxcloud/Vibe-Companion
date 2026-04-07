import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Brain, 
  Bug, 
  TestTube, 
  Wand2, 
  FileText, 
  MessageSquareCode,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AdvancedAIPanelProps {
  projectId: string;
  selectedCode?: string;
  selectedLanguage?: string;
}

interface BugReport {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface RefactoringItem {
  type: string;
  description: string;
  before: string;
  after: string;
}

interface ReviewItem {
  category: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  line?: number;
}

export default function AdvancedAIPanel({ projectId, selectedCode = '', selectedLanguage = 'javascript' }: AdvancedAIPanelProps) {
  const [code, setCode] = useState(selectedCode);
  const [language, setLanguage] = useState(selectedLanguage);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('explain');
  const [results, setResults] = useState<any>({});
  const { toast } = useToast();

  const languages = [
    'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp',
    'go', 'rust', 'ruby', 'php', 'swift', 'kotlin'
  ];

  const testFrameworks: Record<string, string[]> = {
    javascript: ['jest', 'mocha', 'jasmine', 'vitest'],
    typescript: ['jest', 'mocha', 'jasmine', 'vitest'],
    python: ['pytest', 'unittest', 'nose'],
    java: ['junit', 'testng'],
    cpp: ['gtest', 'catch2'],
    csharp: ['nunit', 'xunit', 'mstest'],
  };

  const docFormats: Record<string, string[]> = {
    javascript: ['jsdoc', 'markdown'],
    typescript: ['tsdoc', 'markdown'],
    python: ['docstring', 'sphinx', 'markdown'],
    java: ['javadoc', 'markdown'],
    cpp: ['doxygen', 'markdown'],
    csharp: ['xmldoc', 'markdown'],
  };

  const handleAnalysis = async (endpoint: string, extraParams = {}) => {
    if (!code.trim()) {
      toast({
        title: "No code provided",
        description: "Please enter some code to analyze",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', `/api/ai/${projectId}/${endpoint}`, {
        code,
        language,
        ...extraParams
      });

      if (!response.ok) {
        throw new Error('Failed to analyze code');
      }

      const data = await response.json();
      setResults((prev: any) => ({ ...prev, [activeTab]: data }));
      
      toast({
        title: "Analysis complete",
        description: `${endpoint.replace('-', ' ')} analysis completed successfully`
      });
    } catch (error) {
      console.error(`${endpoint} error:`, error);
      toast({
        title: "Analysis failed",
        description: `Failed to perform ${endpoint.replace('-', ' ')} analysis`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code copied to clipboard"
    });
  };

  const renderBugReport = (bugs: BugReport[]) => {
    if (!bugs || bugs.length === 0) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>No bugs detected!</AlertTitle>
          <AlertDescription>Your code looks clean. Great job!</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-2">
        {bugs.map((bug, index) => (
          <Alert key={index} variant={bug.severity === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Line {bug.line}: {bug.severity.toUpperCase()}</AlertTitle>
            <AlertDescription>
              {bug.message}
              {bug.suggestion && (
                <div className="mt-2 text-[13px] text-muted-foreground">
                  <strong>Suggestion:</strong> {bug.suggestion}
                </div>
              )}
            </AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  const renderRefactoring = (suggestions: RefactoringItem[]) => {
    if (!suggestions || suggestions.length === 0) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Code looks good!</AlertTitle>
          <AlertDescription>No major refactoring suggestions at this time.</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        {suggestions.map((item, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-base">{item.type}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium">Before:</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(item.before)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
                  <code>{item.before}</code>
                </pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium">After:</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(item.after)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
                  <code>{item.after}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderReview = (review: { items: ReviewItem[], summary: string }) => {
    if (!review || !review.items || review.items.length === 0) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Excellent code!</AlertTitle>
          <AlertDescription>No major issues found in the code review.</AlertDescription>
        </Alert>
      );
    }

    const severityColors = {
      high: 'destructive',
      medium: 'secondary',
      low: 'outline'
    };

    return (
      <div className="space-y-4">
        {review.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-muted-foreground">{review.summary}</p>
            </CardContent>
          </Card>
        )}
        <div className="space-y-2">
          {review.items.map((item, index) => (
            <Card key={index}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={severityColors[item.severity] as any}>
                        {item.severity}
                      </Badge>
                      <span className="text-[13px] font-medium">{item.category}</span>
                      {item.line && (
                        <span className="text-[11px] text-muted-foreground">Line {item.line}</span>
                      )}
                    </div>
                    <p className="text-[13px] text-muted-foreground">{item.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Advanced AI Features
          </CardTitle>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <CardDescription>
          Powerful AI tools to help you write better code
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        <div className="space-y-2">
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your code here or select code in the editor..."
            className="min-h-[100px] font-mono text-[13px]"
          />
          <div className="flex gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
            <TabsTrigger value="explain" className="text-[11px]">
              <Brain className="h-3 w-3 mr-1" />
              Explain
            </TabsTrigger>
            <TabsTrigger value="bugs" className="text-[11px]">
              <Bug className="h-3 w-3 mr-1" />
              Bugs
            </TabsTrigger>
            <TabsTrigger value="tests" className="text-[11px]">
              <TestTube className="h-3 w-3 mr-1" />
              Tests
            </TabsTrigger>
            <TabsTrigger value="refactor" className="text-[11px]">
              <Wand2 className="h-3 w-3 mr-1" />
              Refactor
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-[11px]">
              <FileText className="h-3 w-3 mr-1" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="review" className="text-[11px]">
              <MessageSquareCode className="h-3 w-3 mr-1" />
              Review
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 mt-4">
            <TabsContent value="explain" className="h-full">
              <div className="space-y-4">
                <Button 
                  onClick={() => handleAnalysis('explain')} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
                  Explain This Code
                </Button>
                {results.explain && (
                  <ScrollArea className="h-[300px] rounded border p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{results.explain.explanation}</p>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bugs" className="h-full">
              <div className="space-y-4">
                <Button 
                  onClick={() => handleAnalysis('detect-bugs')} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bug className="h-4 w-4 mr-2" />}
                  Detect Bugs
                </Button>
                {results.bugs && (
                  <ScrollArea className="h-[300px]">
                    {renderBugReport(results.bugs.bugs)}
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tests" className="h-full">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Select defaultValue="jest">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(testFrameworks[language] || ['jest']).map(framework => (
                        <SelectItem key={framework} value={framework}>{framework}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => handleAnalysis('generate-tests', { framework: 'jest' })} 
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                    Generate Tests
                  </Button>
                </div>
                {results.tests && (
                  <ScrollArea className="h-[300px] rounded border">
                    <pre className="p-4 text-[13px]">
                      <code>{results.tests.tests}</code>
                    </pre>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="refactor" className="h-full">
              <div className="space-y-4">
                <Button 
                  onClick={() => handleAnalysis('refactor')} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Suggest Refactoring
                </Button>
                {results.refactor && (
                  <ScrollArea className="h-[300px]">
                    {renderRefactoring(results.refactor.suggestions)}
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="docs" className="h-full">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Select defaultValue="jsdoc">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(docFormats[language] || ['markdown']).map(format => (
                        <SelectItem key={format} value={format}>{format}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => handleAnalysis('generate-docs', { format: 'jsdoc' })} 
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Generate Docs
                  </Button>
                </div>
                {results.docs && (
                  <ScrollArea className="h-[300px] rounded border">
                    <pre className="p-4 text-[13px]">
                      <code>{results.docs.documentation}</code>
                    </pre>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            <TabsContent value="review" className="h-full">
              <div className="space-y-4">
                <Button 
                  onClick={() => handleAnalysis('review')} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquareCode className="h-4 w-4 mr-2" />}
                  Review Code
                </Button>
                {results.review && (
                  <ScrollArea className="h-[300px]">
                    {renderReview(results.review.review)}
                  </ScrollArea>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}