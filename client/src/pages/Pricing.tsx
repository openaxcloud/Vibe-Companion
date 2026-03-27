import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Sparkles, Zap, Building2, Loader2, CreditCard, CheckCircle2, ListChecks, AlertCircle, Cpu, Search, Image, Mic, Film } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MarketingLayout } from "@/components/layout/MarketingLayout";

const steps = [
  { id: 1, label: "Choose Plan", icon: ListChecks },
  { id: 2, label: "Payment", icon: CreditCard },
  { id: 3, label: "Confirmation", icon: CheckCircle2 },
];

const PLAN_UI: Record<string, { period: string; cta: string; popular: boolean; color: string; icon: typeof Sparkles }> = {
  free: { period: "forever", cta: "Current Plan", popular: false, color: "var(--ide-text-muted)", icon: Sparkles },
  pro: { period: "/ month", cta: "Upgrade to Pro", popular: true, color: "#0079F2", icon: Zap },
  team: { period: "/ user / month", cta: "Upgrade to Team", popular: false, color: "#7C65CB", icon: Building2 },
};

const FREE_PLAN = {
  id: "free",
  name: "Free",
  price: "$0",
  period: "forever",
  description: "Perfect for learning and personal projects",
  features: ["5 projects", "50 code executions / day", "20 AI calls / day", "No monthly credits", "50 MB storage", "JavaScript & Python", "Community support"],
  cta: "Current Plan",
  popular: false,
  color: "var(--ide-text-muted)",
  priceId: null as string | null,
};

const PLAN_CREDIT_INFO: Record<string, { monthlyCredits: number; overageRate: string }> = {
  free: { monthlyCredits: 0, overageRate: "N/A" },
  pro: { monthlyCredits: 2000, overageRate: "$0.01 / credit" },
  team: { monthlyCredits: 5000, overageRate: "$0.008 / credit" },
};


interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string> | null;
  prices: {
    id: string;
    unitAmount: number;
    currency: string;
    recurring: { interval: string } | null;
    active: boolean;
    metadata: Record<string, string> | null;
  }[];
}

export default function Pricing() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<Record<string, string>>({});
  const [stripeStatus, setStripeStatus] = useState<{ configured: boolean; proConfigured: boolean; teamConfigured: boolean; hasWebhookSecret: boolean } | null>(null);

  const stripeReady = stripeStatus ? stripeStatus.configured && stripeStatus.hasWebhookSecret : null;

  useEffect(() => {
    fetch("/api/config/status")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((data) => setStripeStatus(data.stripe || { configured: false, proConfigured: false, teamConfigured: false, hasWebhookSecret: false }))
      .catch(() => setStripeStatus({ configured: false, proConfigured: false, teamConfigured: false, hasWebhookSecret: false }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("billing") === "cancelled") {
      toast({ title: "Checkout was cancelled. You can try again anytime." });
    }
  }, [search]);

  const stripeProductsQuery = useQuery<{ data: StripeProduct[] }>({
    queryKey: ["/api/stripe/products"],
    staleTime: 60000,
  });

  interface PriceOption {
    id: string;
    label: string;
    amount: string;
    period: string;
    isRecurring: boolean;
  }

  interface PlanConfig {
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: string;
    popular: boolean;
    color: string;
    priceId: string | null;
    priceOptions: PriceOption[];
  }

  const plans = useMemo((): PlanConfig[] => {
    const stripeProducts = stripeProductsQuery.data?.data || [];
    const result: PlanConfig[] = [{
      ...FREE_PLAN,
      priceOptions: [],
    }];

    for (const product of stripeProducts) {
      const planKey = product.metadata?.plan || product.name.toLowerCase().replace(" plan", "");
      const ui = PLAN_UI[planKey] || { period: "", cta: `Get ${product.name}`, popular: false, color: "var(--ide-text-muted)", icon: Sparkles };
      let features: string[] = [];
      try {
        features = product.metadata?.features ? JSON.parse(product.metadata.features) : [];
      } catch {
        features = [];
      }

      const priceOptions: PriceOption[] = product.prices
        .filter(p => p.active)
        .sort((a, b) => (a.unitAmount || 0) - (b.unitAmount || 0))
        .map(p => {
          const amt = `$${(p.unitAmount / 100).toFixed(p.unitAmount % 100 === 0 ? 0 : 2)}`;
          if (p.recurring) {
            return {
              id: p.id,
              label: `${amt} / ${p.recurring.interval}`,
              amount: amt,
              period: `/ ${p.recurring.interval}`,
              isRecurring: true,
            };
          }
          return {
            id: p.id,
            label: `${amt} one-time`,
            amount: amt,
            period: "one-time",
            isRecurring: false,
          };
        });

      const defaultPrice = priceOptions.find(p => p.isRecurring) || priceOptions[0];

      result.push({
        id: planKey,
        name: product.name.replace(" Plan", ""),
        price: defaultPrice?.amount || "$0",
        period: defaultPrice?.period || ui.period,
        description: product.description || "",
        features,
        cta: ui.cta,
        popular: ui.popular,
        color: ui.color,
        priceId: defaultPrice?.id || null,
        priceOptions,
      });
    }

    return result;
  }, [stripeProductsQuery.data]);

  const currentStep = useMemo(() => {
    const params = new URLSearchParams(search);
    if (params.get("billing") === "success") return 3;
    if (loading) return 2;
    return 1;
  }, [search, loading]);

  const getSelectedPriceId = (plan: PlanConfig): string | null => {
    if (selectedPrices[plan.id]) return selectedPrices[plan.id];
    return plan.priceId;
  };

  const handleUpgrade = async (planId: string, priceId?: string | null) => {
    if (planId === "free") return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (stripeReady === false) {
      toast({ title: "Payments are not available yet. Please check back soon.", variant: "destructive" });
      return;
    }
    setLoading(planId);
    try {
      const body: Record<string, string> = { plan: planId };
      if (priceId) body.priceId = priceId;
      const res = await apiRequest("POST", "/api/billing/checkout", body);
      const data = await res.json();
      if (data.url) {
        // Validate redirect URL is a trusted Stripe domain
        try {
          const redirectUrl = new URL(data.url);
          if (redirectUrl.hostname !== "checkout.stripe.com" && redirectUrl.hostname !== "billing.stripe.com") {
            throw new Error("Invalid checkout URL");
          }
          window.location.href = data.url;
        } catch {
          toast({ title: "Invalid checkout URL received. Please try again.", variant: "destructive" });
        }
      } else {
        toast({ title: data.message || "Unable to start checkout. Please try again later.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <MarketingLayout>
    <div className="min-h-screen text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-4 mb-8 sm:mb-12">
          <Button
            variant="ghost"
            size="icon"
            className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={() => setLocation("/")}
            data-testid="button-back-pricing"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-pricing-title">Choose your plan</h1>
            <p className="text-[var(--ide-text-secondary)] mt-1 text-sm sm:text-base">Scale your development with the right tools</p>
          </div>
        </div>

        {stripeReady === false && (
          <div className="max-w-2xl mx-auto mb-8 flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--ide-surface)] border border-[var(--ide-border)]" data-testid="stripe-not-configured-banner">
            <AlertCircle className="w-5 h-5 text-[var(--ide-text-muted)] shrink-0" />
            <p className="text-sm text-[var(--ide-text-secondary)]">
              Payments are not available yet. You can browse plans but checkout is currently disabled.
            </p>
          </div>
        )}

        <div className="max-w-lg mx-auto mb-8 sm:mb-12" data-testid="progress-bar-container">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-[calc(16.67%)] right-[calc(16.67%)] h-[2px] bg-[var(--ide-surface)]" />
            <div
              className="absolute top-5 left-[calc(16.67%)] h-[2px] bg-[#0079F2] transition-all duration-500 ease-out"
              style={{ width: currentStep === 1 ? "0%" : currentStep === 2 ? "calc(50% - 0px)" : "calc(100% - 0px)", maxWidth: "66.66%" }}
              data-testid="progress-bar-fill"
            />
            {steps.map((step) => {
              const StepIcon = step.icon;
              const isComplete = currentStep > step.id;
              const isActive = currentStep === step.id;
              return (
                <div key={step.id} className="flex flex-col items-center z-10 flex-1" data-testid={`progress-step-${step.id}`}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isComplete
                        ? "bg-[#0079F2] border-[#0079F2] text-white"
                        : isActive
                        ? "bg-[var(--ide-bg)] border-[#0079F2] text-[#0079F2]"
                        : "bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text-muted)]"
                    }`}
                  >
                    {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${isComplete || isActive ? "text-[var(--ide-text)]" : "text-[var(--ide-text-muted)]"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {currentStep === 3 ? (
          <div className="max-w-md mx-auto text-center py-16" data-testid="billing-success">
            <div className="w-16 h-16 rounded-full bg-[#0CCE6B]/10 border-2 border-[#0CCE6B] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#0CCE6B]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
            <p className="text-[var(--ide-text-secondary)] mb-8">Your plan has been upgraded successfully. Enjoy your new features.</p>
            <Button
              className="bg-[#0079F2] hover:bg-[#006AD8] text-white px-4 md:px-6 lg:px-8 h-11 rounded-lg"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-go-dashboard"
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {plans.map((plan) => {
            const PlanIcon = PLAN_UI[plan.id]?.icon || Sparkles;
            return (
            <div
              key={plan.id}
              className={`relative rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 ${plan.popular ? "border-[#0079F2] shadow-lg shadow-[#0079F2]/10" : "border-[var(--ide-border)]"} bg-[var(--ide-panel)] p-5 sm:p-6 flex flex-col`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0079F2] text-white text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-4">
                <PlanIcon className="w-5 h-5" style={{ color: plan.color }} />
                <h2 className="text-xl font-semibold" style={{ color: plan.color }}>{plan.name}</h2>
              </div>
              {(() => {
                const activePriceId = getSelectedPriceId(plan);
                const activeOption = plan.priceOptions.find(p => p.id === activePriceId) || plan.priceOptions[0];
                const displayPrice = activeOption?.amount || plan.price;
                const displayPeriod = activeOption?.period || plan.period;
                return (
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl sm:text-4xl font-bold">{displayPrice}</span>
                    <span className="text-[var(--ide-text-muted)] text-sm">{displayPeriod}</span>
                  </div>
                );
              })()}
              {plan.priceOptions.length > 1 && (
                <div className="flex gap-1.5 mb-4" data-testid={`price-selector-${plan.id}`}>
                  {plan.priceOptions.map(option => {
                    const isSelected = (selectedPrices[plan.id] || plan.priceId) === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setSelectedPrices(prev => ({ ...prev, [plan.id]: option.id }))}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-[var(--ide-surface)] text-[var(--ide-text)] border border-[var(--ide-text-muted)]"
                            : "text-[var(--ide-text-muted)] border border-transparent hover:border-[var(--ide-border)]"
                        }`}
                        data-testid={`price-option-${option.id}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[var(--ide-text-secondary)] text-sm mb-4">{plan.description}</p>
              {PLAN_CREDIT_INFO[plan.id] && PLAN_CREDIT_INFO[plan.id].monthlyCredits > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--ide-surface)]/50 border border-[var(--ide-border)]/50" data-testid={`credits-info-${plan.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-[var(--ide-text)]">Monthly Credits</span>
                    <span className="text-[11px] font-semibold" style={{ color: plan.color }}>
                      {PLAN_CREDIT_INFO[plan.id].monthlyCredits.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[9px] text-[var(--ide-text-muted)]">
                    Overage: {PLAN_CREDIT_INFO[plan.id].overageRate} with payment method on file
                  </p>
                </div>
              )}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-[#E0E3E8]">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full h-11 rounded-lg font-medium text-sm ${
                  plan.popular
                    ? "bg-[#0079F2] hover:bg-[#006AD8] text-white"
                    : plan.id === "team"
                    ? "bg-[#7C65CB] hover:bg-[#6B56B5] text-white"
                    : "bg-[var(--ide-surface)] hover:bg-[#3B4255] text-[var(--ide-text)]"
                }`}
                onClick={() => handleUpgrade(plan.id, getSelectedPriceId(plan))}
                disabled={plan.id === "free" || loading === plan.id || stripeReady === false}
                data-testid={`button-upgrade-${plan.id}`}
              >
                {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.cta}
              </Button>
            </div>
            );
          })}
        </div>

        <div className="mt-12 sm:mt-16">
          <h3 className="text-xl font-semibold text-center mb-2">Usage-Based AI Pricing</h3>
          <p className="text-center text-sm text-[var(--ide-text-secondary)] mb-6">
            You only pay for what you use. Credits are deducted based on actual token consumption.
          </p>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-[var(--ide-border)] rounded-xl bg-[var(--ide-panel)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-[#0079F2]" />
                <h4 className="font-semibold text-sm">AI Models</h4>
              </div>
              <div className="space-y-2" data-testid="pricing-models-table">
                {[
                  { name: "GPT-4o Mini", credits: "~1 credit/request", tier: "Economy" },
                  { name: "Gemini Flash", credits: "~1 credit/request", tier: "Economy" },
                  { name: "GPT-4o", credits: "~3-5 credits/request", tier: "Power" },
                  { name: "Claude Sonnet 4", credits: "~3-8 credits/request", tier: "Power" },
                  { name: "Mistral Large", credits: "~2-4 credits/request", tier: "Power" },
                  { name: "Perplexity Sonar Pro", credits: "~3-5 credits/request", tier: "Power" },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--ide-border)]/40 last:border-0">
                    <div>
                      <span className="text-sm font-medium text-[var(--ide-text)]">{m.name}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${m.tier === "Economy" ? "bg-[#0CCE6B]/10 text-[#0CCE6B]" : "bg-[#0079F2]/10 text-[#0079F2]"}`}>
                        {m.tier}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--ide-text-muted)]">{m.credits}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--ide-text-muted)] mt-3">
                Actual cost depends on input/output tokens. Longer conversations use more credits.
              </p>
            </div>

            <div className="border border-[var(--ide-border)] rounded-xl bg-[var(--ide-panel)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-[#F5A623]" />
                <h4 className="font-semibold text-sm">Services & Tools</h4>
              </div>
              <div className="space-y-2" data-testid="pricing-services-table">
                {[
                  { name: "Code Execution", credits: "1 credit", icon: Cpu },
                  { name: "Web Search (Tavily)", credits: "2 credits", icon: Search },
                  { name: "Image Search", credits: "3 credits", icon: Search },
                  { name: "Text-to-Speech", credits: "10 credits", icon: Mic },
                  { name: "Video Generation", credits: "15 credits", icon: Film },
                  { name: "AI Image Generation (DALL-E 3)", credits: "20 credits", icon: Image },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--ide-border)]/40 last:border-0">
                    <div className="flex items-center gap-2">
                      <s.icon className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                      <span className="text-sm font-medium text-[var(--ide-text)]">{s.name}</span>
                    </div>
                    <span className="text-xs text-[var(--ide-text-muted)]">{s.credits}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-[var(--ide-surface)]/50 border border-[var(--ide-border)]/50">
                <p className="text-[11px] text-[var(--ide-text-secondary)]">
                  <strong>Overage billing:</strong> When your monthly credits run out, add a payment method to continue at <span className="text-[#0079F2] font-semibold">$0.01/credit</span>.
                  Usage is metered and billed at the end of your billing cycle.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 text-center">
          <h3 className="text-lg font-semibold mb-3">Frequently Asked Questions</h3>
          <div className="max-w-2xl mx-auto space-y-4 text-left">
            {[
              { q: "Can I switch plans anytime?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect immediately." },
              { q: "What are monthly credits?", a: "Monthly credits are included with Pro and Team plans. They're consumed by AI calls, code executions, and deployments. Credits refresh each billing cycle." },
              { q: "What happens when I run out of credits?", a: "If you have a payment method on file, you can continue with overage billing. Otherwise, you'll see a prompt to add a payment method or upgrade your plan." },
              { q: "How does overage billing work?", a: "Add a payment method to enable overage billing. Usage beyond your included credits is metered and billed at the end of your billing cycle." },
              { q: "Is there a student discount?", a: "Yes! Students get 50% off Pro with a valid .edu email. Contact support to apply." },
              { q: "Can I cancel my subscription?", a: "Absolutely. Cancel anytime from your account settings. No questions asked." },
            ].map((faq, i) => (
              <div key={i} className="border border-[var(--ide-border)] rounded-lg p-4 bg-[var(--ide-panel)]">
                <h4 className="font-medium text-sm text-[var(--ide-text)] mb-1">{faq.q}</h4>
                <p className="text-sm text-[var(--ide-text-secondary)]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
    </MarketingLayout>
  );
}
