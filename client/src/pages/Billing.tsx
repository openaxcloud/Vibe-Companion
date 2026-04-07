// @ts-nocheck
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  CreditCard, Download, ExternalLink, Zap, HardDrive, Globe, Clock,
  CheckCircle, XCircle, AlertCircle, RefreshCw, TrendingUp, ArrowRight,
  Cpu, Database, Activity, Crown, Sparkles
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from "wouter";

interface SubscriptionStatus {
  hasSubscription: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
}

interface CreditsStatus {
  balance: number;
  monthlyAllowance: number;
  usedThisMonth: number;
  tier: string;
  lastRefill: string | null;
}

interface UsageData {
  compute_hours: number;
  storage: number;
  bandwidth: number;
  deployments: number;
  ai_tokens: number;
}

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  price: number;
  interval: string;
  creditsMonthly: number;
  features: string[];
  allowances: {
    vcpus: number;
    ramGb: number;
    storageGb: number;
    bandwidthGb: number;
    developmentMinutes: number;
    publicApps: number;
    privateApps: number;
    collaborators: number;
  };
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Billing() {
  const [, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: subscriptionStatus, isLoading: subLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/payments/subscription-status'],
    queryFn: async () => {
      try {
        return await apiRequest('GET', '/api/payments/subscription-status');
      } catch (err) {
        return {
          hasSubscription: false,
          subscriptionId: null,
          subscriptionStatus: null,
          stripePriceId: null,
          currentPeriodEnd: null
        };
      }
    },
    enabled: !!user,
  });

  const { data: creditsStatus, isLoading: creditsLoading } = useQuery<CreditsStatus>({
    queryKey: ['/api/payments/credits-status'],
    queryFn: async () => {
      try {
        return await apiRequest('GET', '/api/payments/credits-status');
      } catch (err) {
        return {
          balance: 0,
          monthlyAllowance: 0,
          usedThisMonth: 0,
          tier: 'free',
          lastRefill: null
        };
      }
    },
    enabled: !!user,
  });

  const { data: billingHistory, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['/api/payments/billing-history'],
    queryFn: async () => {
      try {
        return await apiRequest('GET', '/api/payments/billing-history');
      } catch (err) {
        return { invoices: [] };
      }
    },
    enabled: !!user,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['/api/payments/plans'],
    queryFn: async () => {
      try {
        return await apiRequest('GET', '/api/payments/plans');
      } catch (err) {
        return [];
      }
    },
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<UsageData>({
    queryKey: ['/api/usage/current'],
    queryFn: async () => {
      try {
        return await apiRequest('GET', '/api/usage/current');
      } catch (err) {
        return {
          compute_hours: 0,
          storage: 0,
          bandwidth: 0,
          deployments: 0,
          ai_tokens: 0
        };
      }
    },
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/payments/cancel-subscription'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments/subscription-status'] });
      toast({ title: "Subscription cancelled", description: "Your subscription will end at the current period." });
    },
    onError: () => {
      toast({ title: "Failed to cancel subscription", variant: "destructive" });
    }
  });

  const upgradeMutation = useMutation({
    mutationFn: (planId: string) => apiRequest('POST', '/api/payments/update-subscription', { newPlanId: planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments/subscription-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/credits-status'] });
      toast({ title: "Subscription updated", description: "Your plan has been changed successfully." });
    },
    onError: () => {
      toast({ title: "Failed to update subscription", variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'canceled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      default:
        return <Badge variant="outline">{status || 'Free'}</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'open':
        return <Badge className="bg-blue-500">Open</Badge>;
      case 'void':
        return <Badge variant="outline">Void</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const currentTier = creditsStatus?.tier || 'free';
  const creditsBalance = creditsStatus?.balance || 0;
  const creditsAllowance = creditsStatus?.monthlyAllowance || 0;
  const creditsUsed = creditsStatus?.usedThisMonth || 0;
  const creditsPercentage = creditsAllowance > 0 ? Math.min((creditsBalance / creditsAllowance) * 100, 100) : 0;

  const usageChartData = usageData ? [
    { name: 'AI Tokens', value: usageData.ai_tokens / 1000, unit: 'K' },
    { name: 'Compute', value: usageData.compute_hours, unit: 'hrs' },
    { name: 'Storage', value: usageData.storage, unit: 'GB' },
    { name: 'Bandwidth', value: usageData.bandwidth, unit: 'GB' },
    { name: 'Deploys', value: usageData.deployments, unit: '' },
  ] : [];

  const invoices = billingHistory?.invoices || [];
  const isLoading = subLoading || creditsLoading || plansLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Billing & Usage</h1>
          <p className="text-muted-foreground">Manage your subscription, usage, and invoices</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" /> Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{currentTier}</div>
            <p className="text-[11px] text-muted-foreground">
              {subscriptionStatus?.subscriptionStatus === 'active' ? 'Active subscription' : 'Free tier'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" /> Credits Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${creditsBalance.toFixed(2)}</div>
            <Progress value={creditsPercentage} className="mt-2 h-2" />
            <p className="text-[11px] text-muted-foreground mt-1">
              ${creditsUsed.toFixed(2)} used of ${creditsAllowance.toFixed(2)} allowance
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(subscriptionStatus?.subscriptionStatus || null)}
            {subscriptionStatus?.currentPeriodEnd && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Renews: {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" /> Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-[11px] text-muted-foreground">Total invoices</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Your Subscription
                </CardTitle>
                <CardDescription>Current plan details and management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscriptionStatus?.hasSubscription ? (
                  <>
                      <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium capitalize">{currentTier} Plan</p>
                          <p className="text-[13px] text-muted-foreground">
                            ${creditsAllowance}/month in credits included
                          </p>
                        </div>
                        {getStatusBadge(subscriptionStatus?.subscriptionStatus || null)}
                      </div>
                    {subscriptionStatus.subscriptionStatus === 'active' && (
                      <div className="flex gap-2">
                        <Button variant="outline" asChild>
                          <Link href="/plans">Change Plan</Link>
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => cancelMutation.mutate()}
                          disabled={cancelMutation.isPending}
                        >
                          Cancel Subscription
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <Crown className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
                      <p className="font-medium">You're on the Free tier</p>
                      <p className="text-[13px] text-muted-foreground">
                        Upgrade to unlock more features and credits
                      </p>
                    </div>
                    <Button asChild>
                      <Link href="/subscribe">
                        Upgrade Now <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" /> Usage Overview
                </CardTitle>
                <CardDescription>Current billing period usage</CardDescription>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : usageChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={usageChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        formatter={(value: number, _name: string, props: any) => 
                          [`${value.toFixed(2)} ${props.payload.unit}`, 'Usage']
                        }
                      />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No usage data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Usage</CardTitle>
              <CardDescription>Resource consumption breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">AI Tokens</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {usageData?.ai_tokens ? (usageData.ai_tokens / 1000).toFixed(1) : 0}K
                  </p>
                  <p className="text-[13px] text-muted-foreground">tokens used</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Compute</span>
                  </div>
                  <p className="text-2xl font-bold">{usageData?.compute_hours?.toFixed(2) || 0}</p>
                  <p className="text-[13px] text-muted-foreground">hours</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Storage</span>
                  </div>
                  <p className="text-2xl font-bold">{usageData?.storage?.toFixed(2) || 0}</p>
                  <p className="text-[13px] text-muted-foreground">GB</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">Bandwidth</span>
                  </div>
                  <p className="text-2xl font-bold">{usageData?.bandwidth?.toFixed(2) || 0}</p>
                  <p className="text-[13px] text-muted-foreground">GB</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Deployments</span>
                  </div>
                  <p className="text-2xl font-bold">{usageData?.deployments || 0}</p>
                  <p className="text-[13px] text-muted-foreground">this month</p>
                </div>
              </div>

                  <div className="mt-8">
                <h3 className="font-semibold mb-4">Usage Limits</h3>
                {plans?.find(p => p.tier === currentTier) && (
                  <div className="space-y-4">
                    {(() => {
                      const plan = plans?.find(p => p.tier === currentTier);
                      if (!plan) return null;
                      const limitItems = [
                        { label: 'Storage', current: usageData?.storage || 0, limit: plan.allowances?.storageGb || 0, unit: 'GB' },
                        { label: 'Bandwidth', current: usageData?.bandwidth || 0, limit: plan.allowances?.bandwidthGb || 0, unit: 'GB' },
                        { label: 'Collaborators', current: 1, limit: plan.allowances?.collaborators || 0, unit: 'users' },
                      ];
                      return limitItems.map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-[13px]">
                            <span>{item.label}</span>
                            <span className="text-muted-foreground">
                              {item.current.toFixed(2)} / {item.limit === -1 ? 'Unlimited' : item.limit} {item.unit}
                            </span>
                          </div>
                          <Progress 
                            value={item.limit === -1 ? 0 : (item.current / Math.max(1, item.limit)) * 100} 
                            className="h-2" 
                          />
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Invoices
              </CardTitle>
              <CardDescription>Your billing history</CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv?.id || Math.random()}>
                        <TableCell className="font-mono text-[13px]">
                          {inv?.number || (inv?.id || '').slice(0, 12) || 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {(inv?.currency || 'usd').toUpperCase()} ${((inv?.amount || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{getInvoiceStatusBadge(inv?.status || 'unknown')}</TableCell>
                        <TableCell>
                          {inv?.created ? new Date(inv.created * 1000).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {inv?.invoice_pdf && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {inv?.hosted_invoice_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invoices yet</p>
                  <p className="text-[13px] text-muted-foreground">
                    Invoices will appear here after you subscribe to a paid plan
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrentPlan = plan.tier === currentTier;
              const isUpgrade = ['core', 'teams', 'enterprise'].indexOf(plan.tier) > ['core', 'teams', 'enterprise'].indexOf(currentTier);
              
              return (
                <Card key={plan.id} className={`relative ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary">Current Plan</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {plan.name}
                      {plan.tier === 'enterprise' && <Crown className="h-5 w-5 text-yellow-500" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold">
                        ${plan.price}
                        <span className="text-[13px] font-normal text-muted-foreground">/{plan.interval}</span>
                      </p>
                      <p className="text-[13px] text-green-500 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> ${plan.creditsMonthly} credits/month
                      </p>
                    </div>
                    <ul className="space-y-2 text-[13px]">
                      {(plan.features || []).slice(0, 5).map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {!isCurrentPlan && plan.tier !== 'free' && (
                      <Button 
                        className="w-full" 
                        variant={isUpgrade ? 'default' : 'outline'}
                        onClick={() => {
                          if (subscriptionStatus?.hasSubscription) {
                            upgradeMutation.mutate(plan.id);
                          } else {
                            navigate(`/subscribe?tier=${plan.tier}`);
                          }
                        }}
                        disabled={upgradeMutation.isPending}
                      >
                        {isUpgrade ? 'Upgrade' : 'Switch'} to {plan.name}
                      </Button>
                    )}
                    {plan.tier === 'free' && !isCurrentPlan && (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => cancelMutation.mutate()}
                        disabled={cancelMutation.isPending}
                      >
                        Downgrade to Free
                      </Button>
                    )}
                    {isCurrentPlan && (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
