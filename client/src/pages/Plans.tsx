import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, X, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

const PRICING_PLANS = {
  starter: {
    name: "E-Code Starter",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfect for learning and personal projects",
    features: [
      { text: "3 public projects", included: true },
      { text: "500 MB storage", included: true },
      { text: "Basic code editor", included: true },
      { text: "Community support", included: true },
      { text: "1 AI request per day", included: true },
      { text: "Private projects", included: false },
      { text: "Deployments", included: false },
      { text: "Custom domains", included: false },
    ],
    cta: "Get Started",
    popular: false,
  },
  core: {
    name: "E-Code Core",
    monthlyPrice: 25,
    yearlyPrice: 20,
    description: "For individual developers and small teams",
    features: [
      { text: "Unlimited projects", included: true },
      { text: "10 GB storage", included: true },
      { text: "100 hours compute/month", included: true },
      { text: "500 AI requests/month", included: true },
      { text: "10 deployments/month", included: true },
      { text: "3 team collaborators", included: true },
      { text: "Email support", included: true },
      { text: "Private projects", included: true },
    ],
    cta: "Upgrade to Core",
    popular: true,
  },
  pro: {
    name: "E-Code Pro",
    monthlyPrice: 40,
    yearlyPrice: 35,
    description: "Advanced features for professional development",
    features: [
      { text: "Everything in Core", included: true },
      { text: "50 GB storage", included: true },
      { text: "500 hours compute/month", included: true },
      { text: "2000 AI requests/month", included: true },
      { text: "Unlimited deployments", included: true },
      { text: "10 team collaborators", included: true },
      { text: "Priority support", included: true },
      { text: "Custom domains", included: true },
      { text: "Advanced AI models", included: true },
    ],
    cta: "Upgrade to Pro",
    popular: false,
  },
  enterprise: {
    name: "E-Code Enterprise",
    monthlyPrice: -1,
    yearlyPrice: -1,
    description: "Custom solutions for large teams",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Unlimited storage", included: true },
      { text: "Unlimited compute", included: true },
      { text: "Unlimited AI requests", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Dedicated support", included: true },
      { text: "SSO/SAML", included: true },
      { text: "SLA guarantee", included: true },
      { text: "Custom integrations", included: true },
    ],
    cta: "Contact Sales",
    popular: false,
  },
};

const USAGE_BASED_PRICING = [
  { name: "AI Agent Edits", price: "$0.05", unit: "per request" },
  { name: "Compute Hours", price: "€0.02", unit: "per hour" },
  { name: "Storage", price: "€0.10", unit: "per GB/month" },
  { name: "Bandwidth", price: "€0.08", unit: "per GB" },
  { name: "Deployments", price: "€0.50", unit: "per deployment" },
  { name: "Databases", price: "€10", unit: "per database/month" },
];

export default function Plans() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: billingData } = useQuery({
    queryKey: ['/api/user/billing'],
    enabled: !!user,
  });

  const currentPlan = billingData?.subscription_tier || 'starter';

  const handleSelectPlan = (planId: string) => {
    if (planId === 'starter') {
      // Free plan - no action needed
      return;
    }
    if (planId === 'enterprise') {
      window.open('mailto:sales@e-code.ai?subject=Enterprise%20Plan%20Inquiry', '_blank');
      return;
    }
    // Navigate to subscribe page with selected tier and billing interval
    setLocation(`/subscribe?tier=${planId}&interval=${billingInterval === "monthly" ? "month" : "year"}`);
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Start free and scale as you grow. All plans include usage-based billing.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={billingInterval === "monthly" ? "font-semibold" : "text-muted-foreground"}>
            Monthly
          </span>
          <Switch
            checked={billingInterval === "yearly"}
            onCheckedChange={(checked) => setBillingInterval(checked ? "yearly" : "monthly")}
            data-testid="switch-billing-interval"
          />
          <span className={billingInterval === "yearly" ? "font-semibold" : "text-muted-foreground"}>
            Yearly
            <Badge variant="secondary" className="ml-2">Save 20%</Badge>
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {Object.entries(PRICING_PLANS).map(([planId, plan]) => {
          const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const isCurrentPlan = currentPlan === planId;
          
          return (
            <Card
              key={planId}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""} ${
                isCurrentPlan ? "bg-accent" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  {price === -1 ? (
                    <div className="text-3xl font-bold">Custom</div>
                  ) : (
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold">
                        {price === 0 ? "Free" : `€${price}`}
                      </span>
                      {price !== 0 && (
                        <span className="text-muted-foreground ml-1">
                          /{billingInterval === "monthly" ? "month" : "year"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                      )}
                      <span
                        className={`text-[13px] ${
                          feature.included ? "" : "text-muted-foreground/50"
                        }`}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "outline"}
                  disabled={isCurrentPlan && planId !== 'enterprise'}
                  onClick={() => handleSelectPlan(planId)}
                  data-testid={`button-select-plan-${planId}`}
                >
                  {isCurrentPlan ? "Current Plan" : plan.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage-Based Pricing Section */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Pay As You Go</h2>
          <p className="text-muted-foreground">
            Additional usage beyond your plan limits is billed at these rates
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Usage-Based Pricing
            </CardTitle>
            <CardDescription>
              Only pay for what you use beyond your plan's included resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {USAGE_BASED_PRICING.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-[13px]">
                    <span className="font-semibold">{item.price}</span>
                    <span className="text-muted-foreground"> {item.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="mt-8 text-center text-[13px] text-muted-foreground">
          <p>All prices exclude VAT where applicable.</p>
          <p className="mt-2">
            Need more? <Button variant="link" className="px-1" onClick={() => window.open('mailto:sales@e-code.ai', '_blank')} data-testid="button-contact-sales">Contact us</Button> for volume discounts.
          </p>
        </div>
      </div>
    </div>
  );
}