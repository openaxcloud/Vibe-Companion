import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { useLocation } from 'wouter';

const PLAN_DETAILS: Record<string, {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  badge?: string;
}> = {
  core: {
    name: 'E-Code Core',
    description: 'Essential tools for productive development',
    monthlyPrice: 25,
    yearlyPrice: 20,
    features: [
      '100 compute hours / month',
      '10 GB storage',
      '100 GB bandwidth',
      'Unlimited private projects',
      '10 deployments / month',
      '3 team collaborators',
      '500 AI requests / month',
      'Email support',
    ],
  },
  teams: {
    name: 'E-Code Teams',
    description: 'Advanced features for professional teams',
    monthlyPrice: 40,
    yearlyPrice: 35,
    badge: 'Most Popular',
    features: [
      '500 compute hours / month',
      '50 GB storage',
      '500 GB bandwidth',
      'Unlimited private projects',
      'Unlimited deployments',
      '10 team collaborators',
      '2000 AI requests / month',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'E-Code Enterprise',
    description: 'Full power for large organisations',
    monthlyPrice: 99,
    yearlyPrice: 79,
    features: [
      'Unlimited compute hours',
      '500 GB storage',
      'Unlimited bandwidth',
      'Unlimited projects & deployments',
      'Unlimited collaborators',
      '10 000 AI requests / month',
      'Dedicated support',
      'SSO & audit logs',
    ],
  },
};

export default function Subscribe() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('core');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tierParam = urlParams.get('tier') || urlParams.get('plan') || 'core';
    const intervalParam = urlParams.get('interval') as 'month' | 'year' || 'month';
    setSelectedTier(tierParam);
    setBillingInterval(intervalParam);
  }, []);

  const plan = PLAN_DETAILS[selectedTier] || PLAN_DETAILS['core'];
  const price = billingInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;

  const handleCheckout = async () => {
    setIsRedirecting(true);
    try {
      const data = await apiRequest<{ url: string; sessionId: string }>(
        "POST",
        "/api/payments/create-checkout-session",
        { tier: selectedTier, interval: billingInterval }
      );
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error?.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Upgrade to {plan.name}</h1>
          <p className="text-muted-foreground">{plan.description}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="relative">
            {plan.badge && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                {plan.badge}
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-2">
                <span className="text-4xl font-bold">€{price}</span>
                <span className="text-muted-foreground text-sm ml-1">
                  {billingInterval === 'year' ? '/mo · billed annually' : '/month'}
                </span>
                {billingInterval === 'year' && (
                  <Badge variant="secondary" className="ml-2 text-green-700 bg-green-100">
                    Save €{(plan.monthlyPrice - plan.yearlyPrice) * 12}/yr
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-sm">{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>Billing Interval</CardTitle>
              <CardDescription>Choose how you'd like to be billed</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex rounded-lg border p-1 gap-1">
                <button
                  onClick={() => setBillingInterval('month')}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    billingInterval === 'month'
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval('year')}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    billingInterval === 'year'
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Yearly · save 20%
                </button>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium capitalize">{billingInterval}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>€{billingInterval === 'year' ? price * 12 : price}/{billingInterval === 'year' ? 'year' : 'month'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleCheckout}
                  disabled={isRedirecting}
                  className="w-full"
                  size="lg"
                  data-testid="button-checkout"
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting to checkout…
                    </>
                  ) : (
                    <>
                      Continue to payment
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setLocation('/billing')}
                  disabled={isRedirecting}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Secure payment powered by Stripe. Cancel anytime.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
