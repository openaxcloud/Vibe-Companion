// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Bell,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  Activity,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Plus,
  Settings,
  Calendar,
  Clock,
} from 'lucide-react';

interface UsageAlert {
  id: number;
  name: string;
  type: 'threshold' | 'budget' | 'anomaly';
  metric: string;
  threshold: number;
  currentValue: number;
  isActive: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  recipients: string[];
  lastTriggered?: string;
}

interface Budget {
  id: number;
  name: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'weekly' | 'daily';
  categories: string[];
  isActive: boolean;
  resetDate: string;
}

interface UsageData {
  date: string;
  compute: number;
  storage: number;
  bandwidth: number;
  ai: number;
  database: number;
  total: number;
}

export function UsageAlerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);

  // Fetch usage data - REAL BACKEND
  const { data: usageData = [] } = useQuery({
    queryKey: ['/api/usage/history', selectedPeriod],
  });

  // Fetch alerts - REAL BACKEND
  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/usage/alerts'],
  });

  // Fetch budgets - REAL BACKEND
  const { data: budgets = [] } = useQuery({
    queryKey: ['/api/usage/budgets'],
  });

  // Fetch current usage
  const { data: currentUsage, isLoading: isLoadingUsage, isError: isUsageError } = useQuery({
    queryKey: ['/api/usage/current'],
  });

  // Create alert mutation
  const createAlertMutation = useMutation({
    mutationFn: (alertData: Partial<UsageAlert>) => 
      apiRequest('POST', '/api/usage/alerts', alertData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/usage/alerts'] });
      toast({
        title: "Alert Created",
        description: "You'll be notified when the threshold is reached.",
      });
      setIsAlertDialogOpen(false);
    },
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: (budgetData: Partial<Budget>) => 
      apiRequest('POST', '/api/usage/budgets', budgetData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/usage/budgets'] });
      toast({
        title: "Budget Created",
        description: "Your spending limit has been set.",
      });
      setIsBudgetDialogOpen(false);
    },
  });

  // Toggle alert mutation
  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest('PATCH', `/api/usage/alerts/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/usage/alerts'] });
    },
  });

  // Use real data from backend
  const chartData = (usageData as UsageData[]) || [];

  const AlertForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      type: 'threshold',
      metric: 'total_cost',
      threshold: 50,
      frequency: 'immediate',
      recipients: [''],
    });

    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        createAlertMutation.mutate(formData);
      }}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="alert-name">Alert Name</Label>
            <Input
              id="alert-name"
              placeholder="e.g., High compute usage"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="metric">Metric to Monitor</Label>
            <Select value={formData.metric} onValueChange={(v) => setFormData({ ...formData, metric: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_cost">Total Cost</SelectItem>
                <SelectItem value="compute">Compute Usage</SelectItem>
                <SelectItem value="ai_tokens">AI Tokens</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="bandwidth">Bandwidth</SelectItem>
                <SelectItem value="database">Database</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="threshold">Alert Threshold ($)</Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              step="0.01"
              value={formData.threshold}
              onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div>
            <Label htmlFor="frequency">Notification Frequency</Label>
            <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily Summary</SelectItem>
                <SelectItem value="weekly">Weekly Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button type="submit">Create Alert</Button>
        </DialogFooter>
      </form>
    );
  };

  const BudgetForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      amount: 100,
      period: 'monthly',
      categories: ['total'],
    });

    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        createBudgetMutation.mutate(formData);
      }}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="budget-name">Budget Name</Label>
            <Input
              id="budget-name"
              placeholder="e.g., Monthly development budget"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="amount">Budget Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div>
            <Label htmlFor="period">Budget Period</Label>
            <Select value={formData.period} onValueChange={(v) => setFormData({ ...formData, period: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button type="submit">Create Budget</Button>
        </DialogFooter>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      {/* Current Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Month Usage</CardTitle>
          <CardDescription>
            Track your resource consumption and costs in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsage ? (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-muted rounded w-20" />
                    <div className="h-8 bg-muted rounded w-16" />
                    <div className="h-2 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : isUsageError ? (
            <div className="text-center py-4 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2" />
              <p>Unable to load usage data. Please try again later.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Cpu className="w-4 h-4" />
                    Compute
                  </div>
                  <div className="text-2xl font-bold">${((currentUsage as any)?.compute ?? 0).toFixed(2)}</div>
                  <Progress value={((currentUsage as any)?.computePercent ?? 0)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Zap className="w-4 h-4" />
                    AI Usage
                  </div>
                  <div className="text-2xl font-bold">${((currentUsage as any)?.ai ?? 0).toFixed(2)}</div>
                  <Progress value={((currentUsage as any)?.aiPercent ?? 0)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Database className="w-4 h-4" />
                    Database
                  </div>
                  <div className="text-2xl font-bold">${((currentUsage as any)?.database ?? 0).toFixed(2)}</div>
                  <Progress value={((currentUsage as any)?.databasePercent ?? 0)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Wifi className="w-4 h-4" />
                    Bandwidth
                  </div>
                  <div className="text-2xl font-bold">${((currentUsage as any)?.bandwidth ?? 0).toFixed(2)}</div>
                  <Progress value={((currentUsage as any)?.bandwidthPercent ?? 0)} className="h-2" />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-muted-foreground">Total Spent</div>
                  <div className="text-3xl font-bold">${((currentUsage as any)?.totalSpent ?? 0).toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] text-muted-foreground">Monthly Credits Remaining</div>
                  <div className="text-xl font-semibold text-green-600">${((currentUsage as any)?.creditsRemaining ?? 0).toFixed(2)}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>
                Monitor your resource consumption over time
              </CardDescription>
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="compute" stackId="1" stroke="#8884d8" fill="#8884d8" />
                <Area type="monotone" dataKey="ai" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                <Area type="monotone" dataKey="database" stackId="1" stroke="#ffc658" fill="#ffc658" />
                <Area type="monotone" dataKey="bandwidth" stackId="1" stroke="#ff7c7c" fill="#ff7c7c" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Usage Alerts
              </CardTitle>
              <CardDescription>
                Get notified when usage exceeds your thresholds
              </CardDescription>
            </div>
            <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-alert">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Usage Alert</DialogTitle>
                  <DialogDescription>
                    Set up notifications for usage thresholds
                  </DialogDescription>
                </DialogHeader>
                <AlertForm />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(alerts as UsageAlert[]).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${
                    alert.currentValue / alert.threshold > 0.9 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium">{alert.name}</div>
                    <div className="text-[13px] text-muted-foreground">
                      {alert.metric} • {alert.frequency} notifications
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <Progress 
                        value={(alert.currentValue / alert.threshold) * 100} 
                        className="w-32 h-2"
                      />
                      <span className="text-[13px]">
                        ${alert.currentValue.toFixed(2)} / ${alert.threshold.toFixed(2)}
                      </span>
                    </div>
                    {alert.lastTriggered && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Last triggered: {new Date(alert.lastTriggered).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <Switch
                  checked={alert.isActive}
                  onCheckedChange={(checked) => 
                    toggleAlertMutation.mutate({ id: alert.id, isActive: checked })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budgets Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Budgets
              </CardTitle>
              <CardDescription>
                Set spending limits to control costs
              </CardDescription>
            </div>
            <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-budget">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Budget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Budget</DialogTitle>
                  <DialogDescription>
                    Set a spending limit for your resources
                  </DialogDescription>
                </DialogHeader>
                <BudgetForm />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(budgets as Budget[]).map((budget) => (
              <div key={budget.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{budget.name}</div>
                    <div className="text-[13px] text-muted-foreground">
                      {budget.period} budget • Resets {new Date(budget.resetDate).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={budget.spent / budget.amount > 0.9 ? 'destructive' : 'secondary'}>
                    {((budget.spent / budget.amount) * 100).toFixed(0)}% used
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span>Spent: ${budget.spent.toFixed(2)}</span>
                    <span>Budget: ${budget.amount.toFixed(2)}</span>
                  </div>
                  <Progress value={(budget.spent / budget.amount) * 100} />
                </div>
                <div className="flex gap-2">
                  {budget.categories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-[11px]">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}