import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface Plan {
  id: 'free' | 'hacker' | 'pro' | 'teams';
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
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Unlimited public Repls',
      '500 MB storage',
      '10 GB bandwidth/month',
      'Basic compute power',
      'Community support'
    ],
    limits: {
      compute: 10,
      storage: 0.5,
      bandwidth: 10,
      privateRepls: 0,
      collaborators: 0
    }
  },
  {
    id: 'hacker',
    name: 'Hacker',
    price: 7,
    interval: 'month',
    features: [
      'Everything in Free',
      'Unlimited private Repls',
      '5 GB storage',
      '50 GB bandwidth/month',
      '2x compute power',
      'Email support',
      'Custom domains'
    ],
    limits: {
      compute: 20,
      storage: 5,
      bandwidth: 50,
      privateRepls: -1,
      collaborators: 5
    },
    badge: 'Most Popular',
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    interval: 'month',
    features: [
      'Everything in Hacker',
      '20 GB storage',
      '100 GB bandwidth/month',
      '4x compute power',
      'Priority support',
      'Advanced analytics',
      'Team collaboration'
    ],
    limits: {
      compute: 40,
      storage: 20,
      bandwidth: 100,
      privateRepls: -1,
      collaborators: 10
    }
  },
  {
    id: 'teams',
    name: 'Teams',
    price: 40,
    interval: 'month',
    features: [
      'Everything in Pro',
      '100 GB storage',
      '500 GB bandwidth/month',
      '8x compute power',
      'Dedicated support',
      'SSO & SAML',
      'Admin dashboard',
      'Unlimited collaborators'
    ],
    limits: {
      compute: 80,
      storage: 100,
      bandwidth: 500,
      privateRepls: -1,
      collaborators: -1
    },
    badge: 'Enterprise'
  }
];

export function BillingSystem({ userId, className }: BillingSystemProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan['id']>('hacker');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const { toast } = useToast();

  useEffect(() => {
    loadSubscription();
    loadUsage();
  }, [userId]);

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

  const handleUpgrade = async (planId: Plan['id']) => {
    setSelectedPlan(planId);
    setShowUpgradeDialog(true);
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId: selectedPlan,
          interval: billingInterval
        })
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
      const response = await fetch(`/api/billing/cancel`, {
        method: 'POST',
        credentials: 'include'
      });

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
    if (billingInterval === 'year') {
      return Math.floor(plan.price * 10); // 20% discount for annual
    }
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
                  {subscription?.plan !== 'free' && (
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
                    <p className="text-sm text-muted-foreground">
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
                <Button variant="outline" className="w-full">
                  <Clock className="h-4 w-4 mr-2" />
                  Billing History
                </Button>
                <Button variant="outline" className="w-full">
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
                        <div className="flex items-center justify-between text-sm">
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
                {PLANS.map((plan) => (
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
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Button
                        className="w-full"
                        variant={subscription?.plan === plan.id ? 'outline' : 'default'}
                        disabled={subscription?.plan === plan.id || plan.price === 0}
                        onClick={() => handleUpgrade(plan.id)}
                      >
                        {subscription?.plan === plan.id 
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

            <TabsContent value="usage" className="space-y-4">
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
                        <span className="text-sm text-muted-foreground">
                          {value.used} / {value.limit === -1 ? 'Unlimited' : value.limit} {value.unit}
                        </span>
                      </div>
                      <Progress 
                        value={getUsagePercentage(value.used, value.limit)} 
                        className="h-2"
                      />
                      {getUsagePercentage(value.used, value.limit) > 80 && (
                        <p className="text-xs text-yellow-600">
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
                <p className="text-sm text-muted-foreground">
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
          </DialogHeader>
          
          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-4">
              {PLANS.filter(p => p.id !== 'free').map((plan) => (
                <Card 
                  key={plan.id}
                  className={`cursor-pointer transition-colors ${
                    selectedPlan === plan.id ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${getPlanPrice(plan)}</p>
                        <p className="text-xs text-muted-foreground">per {billingInterval}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
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