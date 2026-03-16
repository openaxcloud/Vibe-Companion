import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Sparkles, Zap, Building2, Loader2, CreditCard, CheckCircle2, ListChecks, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const steps = [
  { id: 1, label: "Choose Plan", icon: ListChecks },
  { id: 2, label: "Payment", icon: CreditCard },
  { id: 3, label: "Confirmation", icon: CheckCircle2 },
];

const PLAN_UI: Record<string, { period: string; cta: string; popular: boolean; color: string }> = {
  free: { period: "forever", cta: "Current Plan", popular: false, color: "var(--ide-text-muted)" },
  pro: { period: "/ month", cta: "Upgrade to Pro", popular: true, color: "#0079F2" },
  team: { period: "/ user / month", cta: "Contact Sales", popular: false, color: "#7C65CB" },
};

const fallbackPlans = [
  { id: "free", name: "Free", price: "$0", period: "forever", description: "Perfect for learning and personal projects", features: ["5 projects", "50 code executions / day", "100 AI credits / day", "Economy & Power modes", "50 MB storage", "JavaScript & Python", "Community support"], cta: "Current Plan", popular: false, color: "var(--ide-text-muted)" },
  { id: "pro", name: "Pro", price: "$12", period: "/ month", description: "For developers who need more power and flexibility", features: ["Unlimited projects", "500 code executions / day", "1,000 AI credits / day", "All modes incl. Turbo", "Code Optimizations", "5 GB storage", "All languages (Go, Java, C++, Ruby, Bash)", "Priority AI (GPT-4o, Claude, Gemini)", "Custom domains", "Priority support"], cta: "Upgrade to Pro", popular: true, color: "#0079F2" },
  { id: "team", name: "Team", price: "$25", period: "/ user / month", description: "For teams building together with shared workspaces", features: ["Everything in Pro", "5,000 AI credits / day", "Unlimited team members", "Shared projects & workspaces", "Team admin dashboard", "SSO & SAML", "Audit logs", "99.9% uptime SLA", "Dedicated support"], cta: "Contact Sales", popular: false, color: "#7C65CB" },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ configured: boolean; proConfigured: boolean; teamConfigured: boolean; hasWebhookSecret: boolean } | null>(null);

  const stripeReady = stripeStatus ? stripeStatus.configured && stripeStatus.hasWebhookSecret : null;

  useEffect(() => {
    fetch("/api/config/status")
      .then((r) => r.json())
      .then((data) => setStripeStatus(data.stripe || { configured: false, proConfigured: false, teamConfigured: false, hasWebhookSecret: false }))
      .catch(() => setStripeStatus({ configured: false, proConfigured: false, teamConfigured: false, hasWebhookSecret: false }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("billing") === "cancelled") {
      toast({ title: "Checkout was cancelled. You can try again anytime." });
    }
  }, [search]);

  const planConfigsQuery = useQuery<{ plan: string; description: string | null; features: string[] | null; price: number }[]>({
    queryKey: ["/api/plan-configs"],
    staleTime: 60000,
  });

  const plans = useMemo(() => {
    if (!planConfigsQuery.data || planConfigsQuery.data.length === 0) return fallbackPlans;
    return planConfigsQuery.data.map(config => {
      const ui = PLAN_UI[config.plan] || { period: "", cta: "Select", popular: false, color: "var(--ide-text-muted)" };
      const priceStr = config.price === 0 ? "$0" : `$${Math.floor(config.price / 100)}`;
      return {
        id: config.plan,
        name: config.plan.charAt(0).toUpperCase() + config.plan.slice(1),
        price: priceStr,
        period: ui.period,
        description: config.description || "",
        features: config.features || [],
        cta: ui.cta,
        popular: ui.popular,
        color: ui.color,
      };
    });
  }, [planConfigsQuery.data]);

  const currentStep = useMemo(() => {
    const params = new URLSearchParams(search);
    if (params.get("billing") === "success") return 3;
    if (loading) return 2;
    return 1;
  }, [search, loading]);

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") return;
    if (planId === "team") {
      toast({ title: "Contact us at team@replit-ide.com for Team plans" });
      return;
    }
    if (!user) {
      setLocation("/login");
      return;
    }
    if (stripeReady === false || (stripeStatus && planId === "pro" && !stripeStatus.proConfigured)) {
      toast({ title: "Payments are not available yet. Please check back soon.", variant: "destructive" });
      return;
    }
    setLoading(planId);
    try {
      const res = await apiRequest("POST", "/api/billing/checkout", { plan: planId });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: data.message || "Unable to start checkout. Please try again later.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: err.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-12">
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
            <h1 className="text-3xl font-bold" data-testid="text-pricing-title">Choose your plan</h1>
            <p className="text-[var(--ide-text-secondary)] mt-1">Scale your development with the right tools</p>
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

        <div className="max-w-lg mx-auto mb-12" data-testid="progress-bar-container">
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
              className="bg-[#0079F2] hover:bg-[#006AD8] text-white px-8 h-11 rounded-lg"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-go-dashboard"
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
        <>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border ${plan.popular ? "border-[#0079F2] shadow-lg shadow-[#0079F2]/10" : "border-[var(--ide-border)]"} bg-[var(--ide-panel)] p-6 flex flex-col`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0079F2] text-white text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-4">
                {plan.id === "free" && <Sparkles className="w-5 h-5" style={{ color: plan.color }} />}
                {plan.id === "pro" && <Zap className="w-5 h-5" style={{ color: plan.color }} />}
                {plan.id === "team" && <Building2 className="w-5 h-5" style={{ color: plan.color }} />}
                <h2 className="text-xl font-semibold" style={{ color: plan.color }}>{plan.name}</h2>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-[var(--ide-text-muted)] text-sm">{plan.period}</span>
              </div>
              <p className="text-[var(--ide-text-secondary)] text-sm mb-6">{plan.description}</p>
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
                onClick={() => handleUpgrade(plan.id)}
                disabled={plan.id === "free" || loading === plan.id || (plan.id === "pro" && (stripeReady === false || (stripeStatus && !stripeStatus.proConfigured)))}
                data-testid={`button-upgrade-${plan.id}`}
              >
                {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-lg font-semibold mb-3">Frequently Asked Questions</h3>
          <div className="max-w-2xl mx-auto space-y-4 text-left">
            {[
              { q: "Can I switch plans anytime?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect immediately." },
              { q: "What happens when I hit my daily limit?", a: "You'll need to wait until the next day or upgrade your plan for higher limits." },
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
  );
}
