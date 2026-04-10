import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Shield,
  Zap,
  Bug,
  Code,
  Target,
  FileText,
  Brain,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  GitBranch,
  Clock,
  Database
} from 'lucide-react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface ReviewSettings {
  enabledChecks: {
    security: boolean;
    performance: boolean;
    style: boolean;
    bestPractices: boolean;
    complexity: boolean;
    duplication: boolean;
    documentation: boolean;
    accessibility: boolean;
    testing: boolean;
  };
  severityThresholds: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };
  aiProvider: 'anthropic' | 'openai' | 'gemini' | 'xai' | 'auto';
  confidenceThreshold: number;
  maxIssues: number;
  autoReviewEnabled: boolean;
  autoReviewTriggers: {
    onSave: boolean;
    onCommit: boolean;
    onPullRequest: boolean;
    onSchedule: boolean;
  };
  scheduleInterval?: string;
  customRules: Array<{
    id: string;
    name: string;
    pattern: string;
    message: string;
    severity: string;
    category: string;
    enabled: boolean;
  }>;
  ignoredPatterns: string[];
  ignoredFiles: string[];
  codeQualityThreshold: number;
  maxFileSize: number;
  maxComplexity: number;
  requireDocumentation: boolean;
  enforceNamingConventions: boolean;
  namingConventions?: {
    variables: string;
    functions: string;
    classes: string;
    files: string;
  };
}

interface CodeReviewSettingsProps {
  className?: string;
}

export default function CodeReviewSettings({ className }: CodeReviewSettingsProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    pattern: '',
    message: '',
    severity: 'medium',
    category: 'style'
  });
  const [newIgnorePattern, setNewIgnorePattern] = useState('');
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/code-review/settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/code-review/settings');
      return response.json();
    }
  });

  const [localSettings, setLocalSettings] = useState<ReviewSettings>(() => settings || {
    enabledChecks: {
      security: true,
      performance: true,
      style: true,
      bestPractices: true,
      complexity: true,
      duplication: true,
      documentation: true,
      accessibility: true,
      testing: true
    },
    severityThresholds: {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'info'
    },
    aiProvider: 'anthropic',
    confidenceThreshold: 0.7,
    maxIssues: 100,
    autoReviewEnabled: true,
    autoReviewTriggers: {
      onSave: false,
      onCommit: true,
      onPullRequest: true,
      onSchedule: false
    },
    scheduleInterval: '0 9 * * 1',
    customRules: [],
    ignoredPatterns: [],
    ignoredFiles: ['node_modules/**', 'dist/**', 'build/**', '*.min.js'],
    codeQualityThreshold: 70,
    maxFileSize: 500000,
    maxComplexity: 10,
    requireDocumentation: false,
    enforceNamingConventions: false
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings as ReviewSettings);
    }
  }, [settings]);

  const saveMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/code-review/settings', localSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings Saved',
        description: 'Your code review settings have been updated successfully.'
      });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/api/code-review/settings'] });
    },
    onError: () => {
      toast({
        title: 'Save Failed',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const updateSetting = (path: string, value: any) => {
    setLocalSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
    setIsDirty(true);
  };

  const addCustomRule = () => {
    if (!newRule.name || !newRule.pattern || !newRule.message) {
      toast({
        title: 'Invalid Rule',
        description: 'Please fill all required fields',
        variant: 'destructive'
      });
      return;
    }

    const rule = {
      id: Date.now().toString(),
      ...newRule,
      enabled: true
    };

    setLocalSettings(prev => ({
      ...prev,
      customRules: [...prev.customRules, rule]
    }));
    
    setNewRule({
      name: '',
      pattern: '',
      message: '',
      severity: 'medium',
      category: 'style'
    });
    setIsDirty(true);
  };

  const removeCustomRule = (ruleId: string) => {
    setLocalSettings(prev => ({
      ...prev,
      customRules: prev.customRules.filter(r => r.id !== ruleId)
    }));
    setIsDirty(true);
  };

  const addIgnorePattern = () => {
    if (!newIgnorePattern) return;
    
    setLocalSettings(prev => ({
      ...prev,
      ignoredPatterns: [...prev.ignoredPatterns, newIgnorePattern]
    }));
    setNewIgnorePattern('');
    setIsDirty(true);
  };

  const removeIgnorePattern = (pattern: string) => {
    setLocalSettings(prev => ({
      ...prev,
      ignoredPatterns: prev.ignoredPatterns.filter(p => p !== pattern)
    }));
    setIsDirty(true);
  };

  const getCheckIcon = (check: string) => {
    const icons: Record<string, JSX.Element> = {
      security: <Shield className="w-4 h-4" />,
      performance: <Zap className="w-4 h-4" />,
      style: <Code className="w-4 h-4" />,
      bestPractices: <Target className="w-4 h-4" />,
      complexity: <Brain className="w-4 h-4" />,
      duplication: <Database className="w-4 h-4" />,
      documentation: <FileText className="w-4 h-4" />,
      accessibility: <Info className="w-4 h-4" />,
      testing: <Bug className="w-4 h-4" />
    };
    return icons[check] || <Settings className="w-4 h-4" />;
  };

  const getCheckDescription = (check: string) => {
    const descriptions: Record<string, string> = {
      security: 'Check for security vulnerabilities and unsafe patterns',
      performance: 'Identify performance bottlenecks and optimizations',
      style: 'Ensure consistent code style and formatting',
      bestPractices: 'Verify adherence to best practices and patterns',
      complexity: 'Analyze code complexity and suggest simplifications',
      duplication: 'Find duplicated code that can be refactored',
      documentation: 'Check for missing or inadequate documentation',
      accessibility: 'Verify accessibility standards compliance',
      testing: 'Identify missing tests and untested code paths'
    };
    return descriptions[check] || 'Enable or disable this check';
  };

  const resetToDefaults = () => {
    const defaults: ReviewSettings = {
      enabledChecks: {
        security: true,
        performance: true,
        style: true,
        bestPractices: true,
        complexity: true,
        duplication: true,
        documentation: true,
        accessibility: true,
        testing: true
      },
      severityThresholds: {
        critical: 'error',
        high: 'error',
        medium: 'warning',
        low: 'info'
      },
      aiProvider: 'anthropic',
      confidenceThreshold: 0.7,
      maxIssues: 100,
      autoReviewEnabled: true,
      autoReviewTriggers: {
        onSave: false,
        onCommit: true,
        onPullRequest: true,
        onSchedule: false
      },
      customRules: [],
      ignoredPatterns: [],
      ignoredFiles: ['node_modules/**', 'dist/**', 'build/**', '*.min.js'],
      codeQualityThreshold: 70,
      maxFileSize: 500000,
      maxComplexity: 10,
      requireDocumentation: false,
      enforceNamingConventions: false
    };
    
    setLocalSettings(defaults);
    setIsDirty(true);
  };

  return (
    <Card className={cn('w-full bg-background/95 backdrop-blur', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Settings className="w-5 h-5 text-orange-500" />
              Code Review Settings
            </CardTitle>
            <CardDescription>
              Configure AI-powered code review preferences and rules
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="outline" className="text-orange-500">
                Unsaved Changes
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              data-testid="button-reset-defaults"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="checks">Checks</TabsTrigger>
            <TabsTrigger value="rules">Custom Rules</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-6">
            {/* AI Provider */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Provider
              </Label>
              <Select
                value={localSettings.aiProvider}
                onValueChange={(value) => updateSetting('aiProvider', value)}
              >
                <SelectTrigger data-testid="select-ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                  <SelectItem value="openai">GPT-4 (OpenAI)</SelectItem>
                  <SelectItem value="gemini">Gemini (Google)</SelectItem>
                  <SelectItem value="xai">Grok (xAI)</SelectItem>
                  <SelectItem value="auto">Auto-select best model</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Confidence Threshold</Label>
                <span className="text-[13px] text-muted-foreground">
                  {Math.round(localSettings.confidenceThreshold * 100)}%
                </span>
              </div>
              <Slider
                value={[localSettings.confidenceThreshold * 100]}
                onValueChange={([value]) => updateSetting('confidenceThreshold', value / 100)}
                min={50}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-confidence-threshold"
              />
              <p className="text-[11px] text-muted-foreground">
                Only show issues above this confidence level
              </p>
            </div>
            
            {/* Code Quality Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Minimum Code Quality Score</Label>
                <span className="text-[13px] text-muted-foreground">
                  {localSettings.codeQualityThreshold}%
                </span>
              </div>
              <Slider
                value={[localSettings.codeQualityThreshold]}
                onValueChange={([value]) => updateSetting('codeQualityThreshold', value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-quality-threshold"
              />
              <p className="text-[11px] text-muted-foreground">
                Warn when code quality falls below this threshold
              </p>
            </div>
            
            {/* Max Issues */}
            <div className="space-y-2">
              <Label>Maximum Issues to Report</Label>
              <Input
                type="number"
                value={localSettings.maxIssues}
                onChange={(e) => updateSetting('maxIssues', parseInt(e.target.value))}
                min={10}
                max={500}
                data-testid="input-max-issues"
              />
            </div>
            
            {/* Max File Size */}
            <div className="space-y-2">
              <Label>Maximum File Size (bytes)</Label>
              <Input
                type="number"
                value={localSettings.maxFileSize}
                onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value))}
                min={10000}
                max={10000000}
                data-testid="input-max-file-size"
              />
              <p className="text-[11px] text-muted-foreground">
                Skip review for files larger than this
              </p>
            </div>
            
            <Separator />
            
            {/* Severity Thresholds */}
            <div className="space-y-4">
              <Label>Severity Thresholds</Label>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(localSettings.severityThresholds).map(([severity, action]) => (
                  <div key={severity} className="flex items-center justify-between">
                    <Label className="text-[13px] capitalize">{severity}</Label>
                    <Select
                      value={action}
                      onValueChange={(value) => updateSetting(`severityThresholds.${severity}`, value)}
                    >
                      <SelectTrigger className="w-24" data-testid={`select-severity-${severity}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="checks" className="space-y-4">
            <p className="text-[13px] text-muted-foreground mb-4">
              Enable or disable specific code review checks
            </p>
            
            <div className="space-y-3">
              {Object.entries(localSettings.enabledChecks).map(([check, enabled]) => (
                <LazyMotionDiv
                  key={check}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {getCheckIcon(check)}
                    <div>
                      <Label className="capitalize cursor-pointer">
                        {check.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        {getCheckDescription(check)}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(value) => updateSetting(`enabledChecks.${check}`, value)}
                    data-testid={`switch-check-${check}`}
                  />
                </LazyMotionDiv>
              ))}
            </div>
            
            <Separator />
            
            {/* Additional Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Documentation</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Flag functions without documentation
                  </p>
                </div>
                <Switch
                  checked={localSettings.requireDocumentation}
                  onCheckedChange={(value) => updateSetting('requireDocumentation', value)}
                  data-testid="switch-require-documentation"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enforce Naming Conventions</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Check for consistent naming patterns
                  </p>
                </div>
                <Switch
                  checked={localSettings.enforceNamingConventions}
                  onCheckedChange={(value) => updateSetting('enforceNamingConventions', value)}
                  data-testid="switch-naming-conventions"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="rules" className="space-y-4">
            {/* Custom Rules */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom Rules</Label>
                <Badge variant="outline">{localSettings.customRules.length} rules</Badge>
              </div>
              
              <Card className="p-4">
                <div className="space-y-3">
                  <Input
                    placeholder="Rule name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    data-testid="input-rule-name"
                  />
                  <Input
                    placeholder="Pattern (regex)"
                    value={newRule.pattern}
                    onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                    data-testid="input-rule-pattern"
                  />
                  <Textarea
                    placeholder="Error message"
                    value={newRule.message}
                    onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
                    rows={2}
                    data-testid="textarea-rule-message"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={newRule.severity}
                      onValueChange={(value) => setNewRule({ ...newRule, severity: value })}
                    >
                      <SelectTrigger data-testid="select-rule-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={newRule.category}
                      onValueChange={(value) => setNewRule({ ...newRule, category: value })}
                    >
                      <SelectTrigger data-testid="select-rule-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="style">Style</SelectItem>
                        <SelectItem value="best-practice">Best Practice</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={addCustomRule} data-testid="button-add-rule">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Rule
                    </Button>
                  </div>
                </div>
              </Card>
              
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {localSettings.customRules.map(rule => (
                    <Card key={rule.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-[13px]">{rule.name}</span>
                            <Badge variant="outline" className="text-[11px]">
                              {rule.severity}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              {rule.category}
                            </Badge>
                          </div>
                          <code className="text-[11px] text-muted-foreground block mb-1">
                            {rule.pattern}
                          </code>
                          <p className="text-[11px]">{rule.message}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(value) => {
                              const updatedRules = localSettings.customRules.map(r =>
                                r.id === rule.id ? { ...r, enabled: value } : r
                              );
                              setLocalSettings(prev => ({ ...prev, customRules: updatedRules }));
                              setIsDirty(true);
                            }}
                            data-testid={`switch-rule-${rule.id}`}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCustomRule(rule.id)}
                            data-testid={`button-remove-rule-${rule.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <Separator />
            
            {/* Ignored Patterns */}
            <div className="space-y-4">
              <Label>Ignored Patterns</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Pattern to ignore (e.g., *.test.js)"
                  value={newIgnorePattern}
                  onChange={(e) => setNewIgnorePattern(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIgnorePattern()}
                  data-testid="input-ignore-pattern"
                />
                <Button onClick={addIgnorePattern} data-testid="button-add-ignore">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {localSettings.ignoredPatterns.map((pattern, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1"
                  >
                    {pattern}
                    <button
                      onClick={() => removeIgnorePattern(pattern)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-pattern-${index}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="automation" className="space-y-4">
            {/* Auto Review */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label className="text-base">Enable Auto Review</Label>
                <p className="text-[13px] text-muted-foreground">
                  Automatically review code based on triggers
                </p>
              </div>
              <Switch
                checked={localSettings.autoReviewEnabled}
                onCheckedChange={(value) => updateSetting('autoReviewEnabled', value)}
                data-testid="switch-auto-review"
              />
            </div>
            
            {localSettings.autoReviewEnabled && (
              <div className="space-y-4 pl-4">
                <Label>Review Triggers</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Save className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="text-[13px]">On File Save</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Review code when files are saved
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoReviewTriggers.onSave}
                      onCheckedChange={(value) => updateSetting('autoReviewTriggers.onSave', value)}
                      data-testid="switch-trigger-save"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="text-[13px]">On Commit</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Review code before commits
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoReviewTriggers.onCommit}
                      onCheckedChange={(value) => updateSetting('autoReviewTriggers.onCommit', value)}
                      data-testid="switch-trigger-commit"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="text-[13px]">On Pull Request</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Review code in pull requests
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoReviewTriggers.onPullRequest}
                      onCheckedChange={(value) => updateSetting('autoReviewTriggers.onPullRequest', value)}
                      data-testid="switch-trigger-pr"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Label className="text-[13px]">Scheduled Review</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Run reviews on a schedule
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoReviewTriggers.onSchedule}
                      onCheckedChange={(value) => updateSetting('autoReviewTriggers.onSchedule', value)}
                      data-testid="switch-trigger-schedule"
                    />
                  </div>
                  
                  {localSettings.autoReviewTriggers.onSchedule && (
                    <div className="pl-6">
                      <Label className="text-[13px]">Cron Schedule</Label>
                      <Input
                        value={localSettings.scheduleInterval}
                        onChange={(e) => updateSetting('scheduleInterval', e.target.value)}
                        placeholder="0 9 * * 1"
                        className="mt-2"
                        data-testid="input-cron-schedule"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Current: {parseCronExpression(localSettings.scheduleInterval || '0 9 * * 1')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function getCheckDescription(check: string): string {
  const descriptions: Record<string, string> = {
    security: 'Detect potential security vulnerabilities',
    performance: 'Identify performance bottlenecks',
    style: 'Check code style and formatting',
    bestPractices: 'Ensure best practices are followed',
    complexity: 'Analyze code complexity metrics',
    duplication: 'Find duplicate code blocks',
    documentation: 'Check for missing documentation',
    accessibility: 'Ensure accessibility standards',
    testing: 'Suggest test improvements'
  };
  return descriptions[check] || 'Enable this check';
}

function parseCronExpression(cron: string): string {
  // Simplified cron parser for display
  if (cron === '0 9 * * 1') return 'Every Monday at 9:00 AM';
  if (cron === '0 0 * * *') return 'Every day at midnight';
  if (cron === '0 12 * * *') return 'Every day at noon';
  return cron;
}