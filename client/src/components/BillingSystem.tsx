import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  CreditCard, Zap, TrendingUp, Package, Shield, 
  Check, X, Loader2, AlertCircle, Info, ChevronRight,
  Sparkles, Crown, Star, Clock, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';

interface BillingSystemProps {
  userId: number;
  className?: string;
}

interface Subscription {
  id: number;
  plan: 'free' | 'hacker' | 'pro' | 'teams';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Usage {
  compute: { used: number; limit: number; unit: 'hours' };
  storage: { used: number; limit: number; unit: 'GB' };
  bandwidth: { used: number; limit: number; unit: 'GB' };
  privateRepls: { used: number; limit: number; unit: 'repls' };
  collaborators: { used: number; limit: number; unit: 'users' };
}

interface StripePlan {
  id: string;
  name: string;
  tier: 'free' | 'core' | 'teams' | 'enterprise';
  price: number;
  interval: 'month' | 'year';
  creditsMonthly: number;
  features: string[];
  limits: {
    projects: number;
    collaborators: number;
    storage: number;
    cpuHours: number;
    deployments: number;
  };
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

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    compute: number;
    storage: number;
    bandwidth: number;
    privateRepls: number;
    collaborators: number;
  };
  badge?: string;
  popular?: boolean;
  tier?: string;
  stripePriceId?: string;
}

const convertStripePlanToLegacy = (stripePlan: StripePlan): Plan => {
  const tierBadges: Record<string, string | undefined> = {
    free: undefined,
    core: 'Most Popular',
    teams: 'Enterprise',
    enterprise: 'Custom'
  };

  return {
    id: stripePlan.id,
    name: stripePlan.name,
    price: stripePlan.price,
    interval: stripePlan.interval,
    features: stripePlan.features,
    limits: {
      compute: stripePlan.allowances.developmentMinutes === -1 ? -1 : stripePlan.allowances.developmentMinutes / 60,
      storage: stripePlan.allowances.storageGb,
      bandwidth: stripePlan.allowances.bandwidthGb,
      privateRepls: stripePlan.allowances.privateApps,
      collaborators: stripePlan.allowances.collaborators
    },
    badge: tierBadges[stripePlan.tier],
    popular: stripePlan.tier === 'core',
    tier: stripePlan.tier,
    stripePriceId: stripePlan.id
  };
};

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Starter',
    price: 0,
    interval: 'month',
    features: ['Replit Agent trial included', '10 development apps', 'Public apps only', 'Limited build time'],
    limits: { compute: 20, storage: 1, bandwidth: 1, privateRepls: 0, collaborators: 1 }
  },
  {
    id: 'core',
    name: 'Core',
    price: 25,
    interval: 'month',
    features: ['Full Replit Agent access', '$25 of monthly credits', 'Private and public apps', 'Access to latest models'],
    limits: { compute: -1, storage: 50, bandwidth: 100, privateRepls: -1, collaborators: 3 },
    badge: 'Most Popular',
    popular: true
  },
  {
    id: 'teams',
    name: 'Teams',
    price: 40,
    interval: 'month',
    features: ['Everything in Core', 'Team collaboration', 'Priority support', 'SSO & SAML'],
    limits: { compute: -1, storage: 100, bandwidth: 500, privateRepls: -1, collaborators: -1 },
    badge: 'Enterprise'
  }
];

export function BillingSystem({ userId, className }: BillingSystemProps) {
  const [, navigate] = useLocation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [allStripePlans, setAllStripePlans] = useState<StripePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>('core');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const { toast } = useToast();

  const getPlansForDisplay = (): Plan[] => {
    if (allStripePlans.length === 0) return FALLBACK_PLANS;
    
    const tierOrder = ['free', 'core', 'teams', 'enterprise'];
    const displayPlans: Plan[] = [];
    
    for (const tier of tierOrder) {
      const planForTier = allStripePlans.find(p => 
        p.tier === tier && (p.tier === 'free' || p.interval === billingInterval)
      );
      if (planForTier) {
        displayPlans.push(convertStripePlanToLegacy(planForTier));
      }
    }
    
    return displayPlans.length > 0 ? displayPlans : FALLBACK_PLANS;
  };

  const getSelectedPlanId = (): string => {
    const plansForInterval = getPlansForDisplay();
    const selectedPlan = plansForInterval.find(p => p.tier === selectedTier);
    return selectedPlan?.id || plansForInterval[0]?.id || 'core';
  };

  useEffect(() => {
    loadAllPlans();
    loadSubscription();
    loadUsage();
  }, [userId]);

  const loadAllPlans = async () => {
    setPlansLoading(true);
    try {
      const response = await fetch('/api/payments/plans');
      if (response.ok) {
        const stripePlans: StripePlan[] = await response.json();
        setAllStripePlans(stripePlans);
      }
    } catch (error) {
      console.error('Failed to load plans from API:', error);
      setAllStripePlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const plans = getPlansForDisplay();
  const selectedPlan = getSelectedPlanId();

  const loadSubscription = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/subscription`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      // Set default free subscription
      setSubscription({
        id: 0,
        plan: 'free',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false
      });
    }
  };

  const loadUsage = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/usage`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
      // Set default usage
      setUsage({
        compute: { used: 5, limit: 10, unit: 'hours' },
        storage: { used: 0.2, limit: 0.5, unit: 'GB' },
        bandwidth: { used: 3, limit: 10, unit: 'GB' },
        privateRepls: { used: 0, limit: 0, unit: 'repls' },
        collaborators: { used: 0, limit: 0, unit: 'users' }
      });
    }
  };

  const handleUpgrade = async (tier: string) => {
    setSelectedTier(tier);
    setShowUpgradeDialog(true);
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    const stripePriceId = getSelectedPlanId();
    try {
      const response = await apiRequest('POST', '/api/billing/subscribe', {
        planId: stripePriceId,
        interval: billingInterval
      });

      if (response.ok) {
        const { checkoutUrl } = await response.json();
        window.location.href = checkoutUrl;
      } else {
        throw new Error('Failed to create subscription');
      }
    } catch (error) {
      toast({
        title: "Subscription Failed",
        description: "Failed to process subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', `/api/billing/cancel`, {});

      if (response.ok) {
        await loadSubscription();
        toast({
          title: "Subscription Canceled",
          description: "Your subscription will end at the end of the current billing period.",
        });
      }
    } catch (error) {
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getPlanPrice = (plan: Plan) => {
    return plan.price;
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Billing & Subscription
            </span>
            {subscription && subscription.plan !== 'free' && (
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.plan.toUpperCase()} - {subscription.status}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Manage your subscription and monitor usage
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Current Plan */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center">
                    <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                    Current Plan
                  </h3>
                  {subscription?.plan !== 'free' && subscription && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelSubscription}
                      disabled={isLoading || subscription.cancelAtPeriodEnd}
                    >
                      {subscription.cancelAtPeriodEnd ? 'Canceling' : 'Cancel Plan'}
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-2xl font-bold capitalize">{subscription?.plan || 'Free'}</p>
                  {subscription && subscription.plan !== 'free' && (
                    <p className="text-[13px] text-muted-foreground">
                      {subscription.cancelAtPeriodEnd 
                        ? `Ends on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      }
                    </p>
                  )}
                </div>

                {subscription?.plan === 'free' && (
                  <Button 
                    className="w-full mt-4"
                    onClick={() => setShowUpgradeDialog(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </Button>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/account')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Billing History
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/account')}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment Methods
                </Button>
              </div>

              {/* Usage Summary */}
              {usage && (
                <div className="space-y-3">
                  <h3 className="font-medium">Usage This Month</h3>
                  <div className="space-y-2">
                    {Object.entries(usage).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="capitalize">{key}</span>
                          <span className="text-muted-foreground">
                            {value.used} / {value.limit === -1 ? '∞' : value.limit} {value.unit}
                          </span>
                        </div>
                        <Progress 
                          value={getUsagePercentage(value.used, value.limit)} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="plans" className="space-y-4">
              {/* Billing Interval Toggle */}
              <div className="flex items-center justify-center space-x-4 mb-6">
                <span className={billingInterval === 'month' ? 'font-medium' : 'text-muted-foreground'}>
                  Monthly
                </span>
                <Switch
                  checked={billingInterval === 'year'}
                  onCheckedChange={(checked) => setBillingInterval(checked ? 'year' : 'month')}
                />
                <span className={billingInterval === 'year' ? 'font-medium' : 'text-muted-foreground'}>
                  Yearly
                  <Badge variant="secondary" className="ml-2">Save 20%</Badge>
                </span>
              </div>

              {/* Plans Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {plansLoading ? (
                  <div className="col-span-2 flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading plans...</span>
                  </div>
                ) : plans.map((plan) => (
                  <Card 
                    key={plan.id}
                    className={`relative ${plan.popular ? 'border-primary' : ''} ${
                      subscription?.plan === plan.id ? 'bg-accent' : ''
                    }`}
                  >
                    {plan.badge && (
                      <Badge className="absolute -top-2 right-4" variant="default">
                        {plan.badge}
                      </Badge>
                    )}
                    
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center justify-between">
                        <span>{plan.name}</span>
                        {subscription?.plan === plan.id && (
                          <Badge variant="outline">Current</Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold">
                          ${getPlanPrice(plan)}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          /{billingInterval}
                        </span>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start">
                            <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-[13px]">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Button
                        className="w-full"
                        variant={subscription?.plan === plan.tier ? 'outline' : 'default'}
                        disabled={subscription?.plan === plan.tier || plan.price === 0}
                        onClick={() => handleUpgrade(plan.tier || 'core')}
                        data-testid={`plan-select-${plan.tier}`}
                      >
                        {subscription?.plan === plan.tier 
                          ? 'Current Plan' 
                          : plan.price === 0 
                          ? 'Free Forever' 
                          : 'Choose Plan'
                        }
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="usage" className="space-y-4" data-testid="usage-tab">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Usage resets at the beginning of each billing cycle. Upgrade your plan for higher limits.
                </AlertDescription>
              </Alert>

              {usage && (
                <div className="space-y-4">
                  {Object.entries(usage).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {key === 'compute' && <Zap className="h-4 w-4" />}
                          {key === 'storage' && <Package className="h-4 w-4" />}
                          {key === 'bandwidth' && <TrendingUp className="h-4 w-4" />}
                          {key === 'privateRepls' && <Shield className="h-4 w-4" />}
                          {key === 'collaborators' && <Star className="h-4 w-4" />}
                          <span className="font-medium capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        <span className="text-[13px] text-muted-foreground">
                          {value.used} / {value.limit === -1 ? 'Unlimited' : value.limit} {value.unit}
                        </span>
                      </div>
                      <Progress 
                        value={getUsagePercentage(value.used, value.limit)} 
                        className="h-2"
                      />
                      {getUsagePercentage(value.used, value.limit) > 80 && (
                        <p className="text-[11px] text-yellow-600">
                          Approaching limit. Consider upgrading for more {key}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <h3 className="font-medium">Need More Resources?</h3>
                <p className="text-[13px] text-muted-foreground">
                  Upgrade your plan to get more compute power, storage, and features.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => setShowUpgradeDialog(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  View Upgrade Options
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose Your Plan</DialogTitle>
            <DialogDescription>
              Select a plan that best fits your development needs. You can change or cancel anytime.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-4">
              {plans.filter(p => p.price !== 0).map((plan) => (
                <Card 
                  key={plan.id}
                  className={`cursor-pointer transition-colors ${
                    selectedTier === plan.tier ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedTier(plan.tier || 'core')}
                  data-testid={`upgrade-plan-${plan.tier}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[15px]">{plan.name}</CardTitle>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${getPlanPrice(plan)}</p>
                        <p className="text-[11px] text-muted-foreground">per {billingInterval}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-[13px] space-y-1">
                      {plan.features.slice(0, 3).map((feature, i) => (
                        <li key={i} className="flex items-center">
                          <Check className="h-3 w-3 text-green-500 mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubscribe} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Subscribe
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}