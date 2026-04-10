import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Database, Globe, Users, Shield, Activity, TrendingUp,
  AlertTriangle, Check, X, Info, Clock, Cpu, HardDrive, BarChart3
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ECodeLoading } from "@/components/ECodeLoading";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AIUsageDashboard } from "@/components/AIUsageDashboard";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function Usage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ai');
  
  // Fetch real usage data
  const { data: usageData, isLoading } = useQuery({
    queryKey: ['/api/user/usage'],
    enabled: !!user
  });

  // Fetch billing info
  const { data: billingData } = useQuery<{
    currentCycle: {
      start: Date;
      end: Date;
      daysRemaining: number;
    };
    plan: string;
    previousCycles: Array<{
      month: string;
      period: string;
      amount: string;
      plan: string;
    }>;
  }>({
    queryKey: ['/api/user/billing'],
    enabled: !!user
  });

  // Fetch credits status (balance, allowance, usage)
  const { data: creditsData } = useQuery<{
    creditsBalance: number;
    creditsMonthlyAllowance: number;
    lastRefill: Date | null;
  }>({
    queryKey: ['/api/payments/credits-status'],
    enabled: !!user
  });

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Usage overview"
          description="Collecting your latest consumption metrics."
          icon={BarChart3}
        />
        <div className="flex justify-center py-24">
          <ECodeLoading text="Loading usage data..." />
        </div>
      </PageShell>
    );
  }

  // Define usage metric type
  interface UsageMetric {
    used: number;
    limit: number;
    unit: string;
    percentage: number;
  }

  interface UsageData {
    compute: UsageMetric;
    storage: UsageMetric;
    bandwidth: UsageMetric;
    privateProjects: UsageMetric;
    deployments: UsageMetric;
    collaborators: UsageMetric;
  }

  // Use real data from API or fallback to zero values (no mock data)
  const usage: UsageData = (usageData as UsageData) || {
    compute: {
      used: 0,
      limit: 0,
      unit: 'hours',
      percentage: 0
    },
    storage: {
      used: 0,
      limit: 0,
      unit: 'GB',
      percentage: 0
    },
    bandwidth: {
      used: 0,
      limit: 0,
      unit: 'GB',
      percentage: 0
    },
    privateProjects: {
      used: 0,
      limit: 0,
      unit: 'projects',
      percentage: 0
    },
    deployments: {
      used: 0,
      limit: 0,
      unit: 'deployments',
      percentage: 0
    },
    collaborators: {
      used: 0,
      limit: 0,
      unit: 'users',
      percentage: 0
    }
  };

  const getUsageIcon = (type: string) => {
    switch (type) {
      case 'compute':
      case 'cpu': return <Cpu className="h-4 w-4" />;
      case 'storage': return <HardDrive className="h-4 w-4" />;
      case 'bandwidth': return <Globe className="h-4 w-4" />;
      case 'privateProjects': return <Shield className="h-4 w-4" />;
      case 'deployments': return <Activity className="h-4 w-4" />;
      case 'collaborators': return <Users className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getUsageLabel = (type: string) => {
    switch (type) {
      case 'compute':
      case 'cpu': return 'Compute Time';
      case 'storage': return 'Storage';
      case 'bandwidth': return 'Bandwidth';
      case 'privateProjects': return 'Private Projects';
      case 'deployments': return 'Active Deployments';
      case 'collaborators': return 'Team Members';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Calculate real billing cycle
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysInMonth = endOfMonth.getDate();
  const currentDay = today.getDate();
  const daysRemaining = daysInMonth - currentDay + 1;
  
  const billingCycle = billingData?.currentCycle ? {
    start: new Date(billingData.currentCycle.start),
    end: new Date(billingData.currentCycle.end),
    daysRemaining: billingData.currentCycle.daysRemaining
  } : {
    start: startOfMonth,
    end: endOfMonth,
    daysRemaining
  };
  
  // Action handlers
  const handleUpgradePlan = () => {
    navigate('/pricing');
  };
  
  const handleBuyPowerUps = () => {
    navigate('/powerups');
  };
  
  const handleManageStorage = () => {
    navigate('/settings');
  };
  
  const handleComparePlans = () => {
    navigate('/pricing');
  };
  
  const handleContactSales = () => {
    navigate('/support?topic=sales');
  };

  const handleUpgradeNow = () => {
    // Navigate to subscription page
    navigate('/subscribe');
  };

  return (
    <PageShell>
      <PageHeader
        title="Usage analytics"
        description="Monitor your resource consumption, plan limits, and billing insights."
        icon={BarChart3}
        actions={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="gap-2" onClick={handleUpgradePlan} data-testid="button-upgrade-plan">
              <TrendingUp className="h-4 w-4" />
              Upgrade plan
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleContactSales} data-testid="button-contact-sales">
              <Info className="h-4 w-4" />
              Talk to sales
            </Button>
          </div>
        )}
      />
      <div className="space-y-6">

      {/* Action Required Alert */}
      <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          <strong>Action required:</strong> You're approaching your compute time limit. 
          Consider upgrading your plan to avoid service interruptions.
        </AlertDescription>
      </Alert>

      {/* Billing Cycle & Credits Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[15px]">Current Billing Cycle</CardTitle>
                <CardDescription>
                  {billingCycle.start.toLocaleDateString()} - {billingCycle.end.toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{billingCycle.daysRemaining} days remaining</span>
                </div>
                <Badge variant="outline" className="mt-1">{billingData?.plan || 'Free'} Plan</Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Credits Balance Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[15px]">Credits Balance</CardTitle>
                <CardDescription>
                  Monthly allowance: ${creditsData?.creditsMonthlyAllowance?.toFixed(2) || '0.00'}
                </CardDescription>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold">
                ${creditsData?.creditsBalance?.toFixed(2) || '0.00'}
                <span className="text-[13px] font-normal text-muted-foreground ml-2">remaining</span>
              </div>
              <Progress 
                value={
                  creditsData?.creditsMonthlyAllowance 
                    ? (creditsData.creditsBalance / creditsData.creditsMonthlyAllowance) * 100 
                    : 0
                } 
                className="h-2" 
              />
              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>
                  ${((creditsData?.creditsMonthlyAllowance || 0) - (creditsData?.creditsBalance || 0)).toFixed(2)} used
                </span>
                <span>
                  {creditsData?.creditsMonthlyAllowance 
                    ? Math.round((creditsData.creditsBalance / creditsData.creditsMonthlyAllowance) * 100) 
                    : 0}% available
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pay-as-you-go Alert (shown when credits exhausted) */}
      {creditsData && creditsData.creditsBalance <= 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Pay-as-you-go mode active!</strong> Your monthly credits are exhausted. 
            Additional usage will be billed at standard rates. 
            <Button variant="link" className="h-auto p-0 ml-1" onClick={handleUpgradePlan}>
              Upgrade plan
            </Button> to increase your monthly allowance.
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Tabs */}
      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai" data-testid="tab-ai-usage">AI Usage</TabsTrigger>
          <TabsTrigger value="overview" data-testid="tab-resources">Resources</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        {/* AI Usage Tab */}
        <TabsContent value="ai" className="space-y-4">
          <AIUsageDashboard />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(usage).map(([key, value]) => (
                <Card key={key} data-testid={`card-usage-${key}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getUsageIcon(key)}
                        <CardTitle className="text-[13px] font-medium">
                          {getUsageLabel(key)}
                        </CardTitle>
                      </div>
                      <Badge 
                        variant={value.percentage >= 90 ? "destructive" : 
                                value.percentage >= 75 ? "secondary" : "outline"}
                        className="text-[11px]"
                        data-testid={`badge-usage-percentage-${key}`}
                      >
                        {value.percentage}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress 
                        value={value.percentage} 
                        className="h-2" 
                        data-testid={`progress-usage-${key}`}
                      />
                      <div className="flex justify-between text-[13px]">
                        <span className={getUsageColor(value.percentage)} data-testid={`text-used-${key}`}>
                          {value.used} {value.unit}
                        </span>
                        <span className="text-muted-foreground" data-testid={`text-limit-${key}`}>
                          of {value.limit} {value.unit}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Manage your usage and upgrade your limits
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={handleUpgradePlan} data-testid="button-quick-upgrade">
                <TrendingUp className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
              <Button variant="outline" onClick={handleBuyPowerUps} data-testid="button-buy-powerups">
                <Zap className="mr-2 h-4 w-4" />
                Buy Power Ups
              </Button>
              <Button variant="outline" onClick={handleManageStorage} data-testid="button-manage-storage">
                <Database className="mr-2 h-4 w-4" />
                Manage Storage
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Usage Breakdown</CardTitle>
              <CardDescription>
                Comprehensive view of your resource consumption
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Compute Details */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Compute Time Details
                  </h3>
                  <div className="pl-6 space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Development VMs</span>
                      <span>45 hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deployments</span>
                      <span>27 hours</span>
                    </div>
                  </div>
                </div>

                {/* Storage Details */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Storage Breakdown
                  </h3>
                  <div className="pl-6 space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Project Files</span>
                      <span>2.8 GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Database</span>
                      <span>1.2 GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Backups</span>
                      <span>0.2 GB</span>
                    </div>
                  </div>
                </div>

                {/* Bandwidth Details */}
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Bandwidth Usage
                  </h3>
                  <div className="pl-6 space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deployments</span>
                      <span>12.5 GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Development</span>
                      <span>3.3 GB</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Limits Info */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Limits</CardTitle>
              <CardDescription>
                Your current plan includes the following limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>100 hours of compute time per month</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>10 GB storage</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>100 GB bandwidth</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>5 private projects</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>10 active deployments</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>3 team members</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>
                Track your usage patterns over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 rounded-lg flex items-center justify-center">
                {usageData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(usage).map(([key, val]) => ({ name: getUsageLabel(key), value: val.percentage }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#F26207" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Usage chart visualization would go here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Previous Billing Cycles */}
          <Card>
            <CardHeader>
              <CardTitle>Previous Billing Cycles</CardTitle>
              <CardDescription>
                Review your past usage and billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {billingData?.previousCycles && billingData.previousCycles.length > 0 ? (
                  billingData.previousCycles.map((cycle, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{cycle.month}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {cycle.period}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{cycle.amount}</p>
                        <p className="text-[13px] text-muted-foreground">{cycle.plan}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No previous billing cycles available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Section */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Usage resets at the beginning of each billing cycle. Need more resources? 
          <Button variant="link" className="px-1 h-auto" onClick={handleComparePlans}>
            Compare plans
          </Button>
          or
          <Button variant="link" className="px-1 h-auto" onClick={handleContactSales}>
            contact sales
          </Button>
          for custom enterprise limits.
        </AlertDescription>
      </Alert>
      </div>
    </PageShell>
  );
}