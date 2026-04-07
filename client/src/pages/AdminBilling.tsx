import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "./admin/AdminLayout";
import { 
  CreditCard, Edit, DollarSign, TrendingUp, Users, FileText,
  Download, ExternalLink, Zap, HardDrive, Globe, Clock, BarChart3,
  CheckCircle, XCircle, AlertCircle, RefreshCw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface ResourceLimit {
  id: number;
  planId: string;
  resourceType: string;
  limit: number;
  unit: string;
  overage_rate?: number | null;
}

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  creditsMonthly: number;
  features: string[];
  limits: ResourceLimit[];
}

interface BillingSettings {
  stripeWebhookEndpoint: string;
  taxRate: number;
  currency: string;
  invoicePrefix: string;
  gracePeriodDays: number;
}

interface Subscriber {
  id: number;
  username: string;
  email: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  creditsBalance: string | null;
}

interface Invoice {
  id: string;
  number: string | null;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  dueDate: string | null;
  paidAt: string | null;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
}

interface UsageSummary {
  billingPeriod: string;
  usageByMetric: Array<{
    metric: string;
    totalBilled: string | null;
    totalCreditsUsed: string | null;
    totalPayAsYouGo: string | null;
    eventCount: number;
  }>;
  totalUsers: number;
}

interface RevenueData {
  month: string;
  amount: number;
}

export default function AdminBilling() {
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [editingLimit, setEditingLimit] = useState<ResourceLimit | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [localSettings, setLocalSettings] = useState<BillingSettings | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Admin privileges required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: pricingPlans = [], isLoading: plansLoading } = useQuery<PricingPlan[]>({
    queryKey: ['/api/admin/billing/plans'],
  });

  const { data: billingSettings, isLoading: settingsLoading } = useQuery<BillingSettings>({
    queryKey: ['/api/admin/billing/settings'],
  });

  const { data: subscribersData, isLoading: subscribersLoading } = useQuery<any>({
    queryKey: ['/api/admin/billing/subscriptions'],
  });

  const subscribers: Subscriber[] = subscribersData?.subscribers || subscribersData || [];

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['/api/admin/billing/invoices'],
  });

  const { data: usageSummary, isLoading: usageLoading } = useQuery<UsageSummary>({
    queryKey: ['/api/admin/billing/usage-summary'],
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<{ revenue: RevenueData[] }>({
    queryKey: ['/api/admin/billing/revenue'],
  });

  const updatePlanMutation = useMutation({
    mutationFn: (plan: PricingPlan) => 
      apiRequest('PUT', `/api/admin/billing/plans/${plan.id}`, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/plans'] });
      toast({ title: "Plan updated successfully" });
      setShowPlanDialog(false);
      setEditingPlan(null);
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
    }
  });

  const updateLimitMutation = useMutation({
    mutationFn: (data: { planId: string; limit: ResourceLimit }) => 
      apiRequest('PUT', `/api/admin/billing/plans/${data.planId}/limits/${data.limit.id}`, data.limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/plans'] });
      toast({ title: "Resource limit updated successfully" });
      setShowLimitDialog(false);
      setEditingLimit(null);
    },
    onError: () => {
      toast({ title: "Failed to update resource limit", variant: "destructive" });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: BillingSettings) => 
      apiRequest('PUT', '/api/admin/billing/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/billing/settings'] });
      toast({ title: "Billing settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update billing settings", variant: "destructive" });
    }
  });

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updatePlanMutation.mutate(editingPlan);
    }
  };

  const handleLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLimit && editingPlan) {
      updateLimitMutation.mutate({ planId: editingPlan.id, limit: editingLimit });
    }
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSettings) {
      updateSettingsMutation.mutate(localSettings);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'canceled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
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
      case 'uncollectible':
        return <Badge variant="destructive">Uncollectible</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalRevenue = revenueData?.revenue?.reduce((sum, r) => sum + r.amount, 0) || 0;
  const activeSubscribers = subscribers.filter(s => s.subscriptionStatus === 'active').length;
  const invoices = invoicesData?.invoices || [];

  if (plansLoading || settingsLoading) {
    return (
      <AdminLayout>
        <div className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-400">Loading billing configuration...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="heading-billing-management">Billing Management</h1>
            <p className="text-zinc-400" data-testid="text-billing-description">Configure pricing plans, view subscriptions, and manage billing</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-zinc-400">Total Revenue (12mo)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</div>
              <p className="text-[11px] text-green-500 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> From Stripe charges
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-zinc-400">Active Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activeSubscribers}</div>
              <p className="text-[11px] text-zinc-500">of {subscribers.length} total</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-zinc-400">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{usageSummary?.totalUsers ?? 0}</div>
              <p className="text-[11px] text-zinc-500">Platform-wide</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-zinc-400">Billing Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{usageSummary?.billingPeriod ?? 'N/A'}</div>
              <p className="text-[11px] text-zinc-500">Current cycle</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList data-testid="tabs-billing" className="bg-zinc-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-zinc-800 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" /> Revenue Trend
                  </CardTitle>
                  <CardDescription className="text-zinc-400">Monthly revenue over the past year</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={revenueData?.revenue || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                        <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                          labelStyle={{ color: '#F9FAFB' }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-zinc-800 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="h-5 w-5" /> Usage by Metric
                  </CardTitle>
                  <CardDescription className="text-zinc-400">Billing period: {usageSummary?.billingPeriod}</CardDescription>
                </CardHeader>
                <CardContent>
                  {usageLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {usageSummary?.usageByMetric?.map((metric) => (
                        <div key={metric.metric} className="space-y-2">
                          <div className="flex justify-between text-[13px]">
                            <span className="text-zinc-300 capitalize">{(metric.metric || 'unknown').replace('_', ' ')}</span>
                            <span className="text-zinc-400">{metric.eventCount || 0} events</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="bg-zinc-900 rounded p-2">
                              <p className="text-zinc-500">Billed</p>
                              <p className="text-white font-medium">${parseFloat(metric.totalBilled || '0').toFixed(2)}</p>
                            </div>
                            <div className="bg-zinc-900 rounded p-2">
                              <p className="text-zinc-500">Credits</p>
                              <p className="text-green-500 font-medium">${parseFloat(metric.totalCreditsUsed || '0').toFixed(2)}</p>
                            </div>
                            <div className="bg-zinc-900 rounded p-2">
                              <p className="text-zinc-500">Pay-as-you-go</p>
                              <p className="text-yellow-500 font-medium">${parseFloat(metric.totalPayAsYouGo || '0').toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!usageSummary?.usageByMetric || usageSummary.usageByMetric.length === 0) && (
                        <p className="text-zinc-500 text-center py-8">No usage data for this period</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card className="bg-zinc-800 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5" /> Active Subscriptions
                </CardTitle>
                <CardDescription className="text-zinc-400">Users with Stripe subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                {subscribersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700">
                        <TableHead className="text-zinc-400">User</TableHead>
                        <TableHead className="text-zinc-400">Plan</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400">Credits</TableHead>
                        <TableHead className="text-zinc-400">Period End</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(subscribers) && subscribers.map((sub) => (
                        <TableRow key={sub?.id} className="border-zinc-700">
                          <TableCell className="text-white">
                            <div>
                              <p className="font-medium">{sub?.username || 'Unknown'}</p>
                              <p className="text-[11px] text-zinc-500">{sub?.email || 'No email'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-300 capitalize">{sub?.subscriptionTier || 'free'}</TableCell>
                          <TableCell>{getStatusBadge(sub?.subscriptionStatus)}</TableCell>
                          <TableCell className="text-green-500 font-medium">
                            ${parseFloat(sub?.creditsBalance || '0').toFixed(2)}
                          </TableCell>
                          <TableCell className="text-zinc-400">
                            {sub?.subscriptionCurrentPeriodEnd 
                              ? new Date(sub.subscriptionCurrentPeriodEnd).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!subscribers || (Array.isArray(subscribers) && subscribers.length === 0)) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                            No active subscribers
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card className="bg-zinc-800 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Invoices
                </CardTitle>
                <CardDescription className="text-zinc-400">Recent invoices from Stripe</CardDescription>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700">
                        <TableHead className="text-zinc-400">Invoice</TableHead>
                        <TableHead className="text-zinc-400">Amount</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400">Date</TableHead>
                        <TableHead className="text-zinc-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(invoices) && invoices.map((inv) => (
                        <TableRow key={inv?.id} className="border-zinc-700">
                          <TableCell className="text-white font-mono text-[13px]">
                            {inv?.number || (inv?.id ? String(inv.id).slice(0, 12) : 'N/A')}
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {inv?.currency || 'USD'} ${inv?.amount ? (typeof inv.amount === 'number' ? inv.amount : parseFloat(String(inv.amount))).toFixed(2) : '0.00'}
                          </TableCell>
                          <TableCell>{getInvoiceStatusBadge(inv?.status || 'unknown')}</TableCell>
                          <TableCell className="text-zinc-400">
                            {inv?.created ? new Date(inv.created).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {inv?.invoicePdf && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {inv?.hostedInvoiceUrl && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!invoices || (Array.isArray(invoices) && invoices.length === 0)) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                            No invoices found. Configure Stripe to see invoices.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <Card className="bg-zinc-800 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-white">Platform Usage Summary</CardTitle>
                <CardDescription className="text-zinc-400">
                  Aggregate usage across all users for billing period {usageSummary?.billingPeriod}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={usageSummary?.usageByMetric || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="metric" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                        labelStyle={{ color: '#F9FAFB' }}
                      />
                      <Bar dataKey="eventCount" fill="#3B82F6" name="Events" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans">
            <Card className="bg-zinc-800 border-zinc-700" data-testid="card-pricing-plans">
              <CardHeader>
                <CardTitle className="text-white">Pricing Plans</CardTitle>
                <CardDescription className="text-zinc-400">Manage subscription tiers and pricing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {pricingPlans.map((plan) => (
                    <Card key={plan.id} className="relative bg-zinc-900 border-zinc-700" data-testid={`card-plan-${plan.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[15px] text-white">{plan.name}</CardTitle>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingPlan(plan);
                              setShowPlanDialog(true);
                            }}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <p className="text-2xl font-bold text-white">${plan.monthlyPrice}</p>
                            <p className="text-[13px] text-zinc-400">per month</p>
                          </div>
                          <div>
                            <p className="text-[13px] text-zinc-300">Yearly: ${plan.yearlyPrice}</p>
                            <p className="text-[11px] text-green-500">
                              Save ${(plan.monthlyPrice * 12 - plan.yearlyPrice).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-[13px] text-zinc-400">
                            <Zap className="h-4 w-4 inline mr-1 text-yellow-500" />
                            ${plan.creditsMonthly} credits/mo
                          </div>
                          <div className="space-y-1">
                            <p className="text-[13px] font-medium text-white">Features:</p>
                            <ul className="text-[13px] text-zinc-400 space-y-1">
                              {(plan.features || []).slice(0, 3).map((feature, i) => (
                                <li key={i} className="truncate">• {feature}</li>
                              ))}
                              {(plan.features || []).length > 3 && (
                                <li className="text-[11px]">+{(plan.features || []).length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-8">
                  <h3 className="text-[15px] font-semibold text-white mb-4">Resource Limits by Plan</h3>
                  {pricingPlans.map((plan) => (
                    <div key={plan.id} className="mb-6" data-testid={`limits-plan-${plan.id}`}>
                      <h4 className="text-md font-medium mb-3 text-zinc-300">{plan.name}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-zinc-700">
                            <TableHead className="text-zinc-400">Resource</TableHead>
                            <TableHead className="text-zinc-400">Limit</TableHead>
                            <TableHead className="text-zinc-400">Unit</TableHead>
                            <TableHead className="text-zinc-400">Overage Rate</TableHead>
                            <TableHead className="text-zinc-400">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plan.limits.map((limit) => (
                            <TableRow key={limit.id} className="border-zinc-700" data-testid={`row-limit-${limit.id}`}>
                              <TableCell className="capitalize text-white">
                                {limit.resourceType.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell className="text-zinc-300">
                                {limit.limit === -1 ? 'Unlimited' : limit.limit}
                              </TableCell>
                              <TableCell className="text-zinc-300">{limit.unit}</TableCell>
                              <TableCell className="text-zinc-300">
                                {limit.overage_rate ? `$${limit.overage_rate}/${limit.unit}` : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingPlan(plan);
                                    setEditingLimit(limit);
                                    setShowLimitDialog(true);
                                  }}
                                  data-testid={`button-edit-limit-${limit.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="bg-zinc-800 border-zinc-700" data-testid="card-billing-settings">
              <CardHeader>
                <CardTitle className="text-white">Billing Settings</CardTitle>
                <CardDescription className="text-zinc-400">Configure global billing parameters</CardDescription>
              </CardHeader>
              <CardContent>
                {billingSettings && (
                  <form onSubmit={handleSettingsSubmit} className="space-y-4" data-testid="form-billing-settings">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="stripe-webhook" className="text-zinc-300">Stripe Webhook Endpoint</Label>
                        <Input
                          id="stripe-webhook"
                          defaultValue={billingSettings.stripeWebhookEndpoint}
                          onChange={(e) => setLocalSettings(prev => ({ ...(prev || billingSettings), stripeWebhookEndpoint: e.target.value }))}
                          placeholder="/api/payments/webhook"
                          className="bg-zinc-900 border-zinc-700 text-white"
                          data-testid="input-stripe-webhook"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tax-rate" className="text-zinc-300">Tax Rate (%)</Label>
                        <Input
                          id="tax-rate"
                          type="number"
                          step="0.01"
                          defaultValue={billingSettings.taxRate}
                          onChange={(e) => setLocalSettings(prev => ({ ...(prev || billingSettings), taxRate: parseFloat(e.target.value) }))}
                          className="bg-zinc-900 border-zinc-700 text-white"
                          data-testid="input-tax-rate"
                        />
                      </div>
                      <div>
                        <Label htmlFor="currency" className="text-zinc-300">Currency</Label>
                        <Select 
                          defaultValue={billingSettings.currency}
                          onValueChange={(value) => setLocalSettings(prev => ({ ...(prev || billingSettings), currency: value }))}
                        >
                          <SelectTrigger id="currency" className="bg-zinc-900 border-zinc-700 text-white" data-testid="select-currency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="invoice-prefix" className="text-zinc-300">Invoice Prefix</Label>
                        <Input
                          id="invoice-prefix"
                          defaultValue={billingSettings.invoicePrefix}
                          onChange={(e) => setLocalSettings(prev => ({ ...(prev || billingSettings), invoicePrefix: e.target.value }))}
                          placeholder="INV-"
                          className="bg-zinc-900 border-zinc-700 text-white"
                          data-testid="input-invoice-prefix"
                        />
                      </div>
                      <div>
                        <Label htmlFor="grace-period" className="text-zinc-300">Grace Period (days)</Label>
                        <Input
                          id="grace-period"
                          type="number"
                          defaultValue={billingSettings.gracePeriodDays}
                          onChange={(e) => setLocalSettings(prev => ({ ...(prev || billingSettings), gracePeriodDays: parseInt(e.target.value) }))}
                          className="bg-zinc-900 border-zinc-700 text-white"
                          data-testid="input-grace-period"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={updateSettingsMutation.isPending} data-testid="button-save-settings">
                      Save Settings
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Pricing Plan</DialogTitle>
              <DialogDescription>
                Update pricing and features for {editingPlan?.name}
              </DialogDescription>
            </DialogHeader>
            {editingPlan && (
              <form onSubmit={handlePlanSubmit}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="plan-name">Plan Name</Label>
                    <Input
                      id="plan-name"
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="monthly-price">Monthly Price ($)</Label>
                      <Input
                        id="monthly-price"
                        type="number"
                        step="0.01"
                        value={editingPlan.monthlyPrice}
                        onChange={(e) => setEditingPlan({...editingPlan, monthlyPrice: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="yearly-price">Yearly Price ($)</Label>
                      <Input
                        id="yearly-price"
                        type="number"
                        step="0.01"
                        value={editingPlan.yearlyPrice}
                        onChange={(e) => setEditingPlan({...editingPlan, yearlyPrice: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="credits-monthly">Monthly Credits ($)</Label>
                    <Input
                      id="credits-monthly"
                      type="number"
                      step="0.01"
                      value={editingPlan.creditsMonthly}
                      onChange={(e) => setEditingPlan({...editingPlan, creditsMonthly: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowPlanDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updatePlanMutation.isPending}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Resource Limit</DialogTitle>
              <DialogDescription>
                Update limit for {editingLimit?.resourceType.replace(/_/g, ' ')}
              </DialogDescription>
            </DialogHeader>
            {editingLimit && (
              <form onSubmit={handleLimitSubmit}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="limit-value">Limit Value</Label>
                    <Input
                      id="limit-value"
                      type="number"
                      value={editingLimit.limit}
                      onChange={(e) => setEditingLimit({...editingLimit, limit: parseInt(e.target.value)})}
                      placeholder="-1 for unlimited"
                    />
                    <p className="text-[13px] text-muted-foreground mt-1">Use -1 for unlimited</p>
                  </div>
                  <div>
                    <Label htmlFor="overage-rate">Overage Rate ($ per {editingLimit.unit})</Label>
                    <Input
                      id="overage-rate"
                      type="number"
                      step="0.01"
                      value={editingLimit.overage_rate || 0}
                      onChange={(e) => setEditingLimit({...editingLimit, overage_rate: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowLimitDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateLimitMutation.isPending}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
