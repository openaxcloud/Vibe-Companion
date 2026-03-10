import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Sparkles, Zap, Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for learning and personal projects",
    features: [
      "5 projects",
      "50 code executions / day",
      "20 AI calls / day",
      "50 MB storage",
      "JavaScript & Python",
      "Community support",
    ],
    cta: "Current Plan",
    popular: false,
    color: "#676D7E",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    period: "/ month",
    description: "For developers who need more power and flexibility",
    features: [
      "Unlimited projects",
      "500 code executions / day",
      "200 AI calls / day",
      "5 GB storage",
      "All languages (Go, Java, C++, Ruby, Bash)",
      "Priority AI (GPT-4o, Claude, Gemini)",
      "Custom domains",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    popular: true,
    color: "#0079F2",
  },
  {
    id: "team",
    name: "Team",
    price: "$25",
    period: "/ user / month",
    description: "For teams building together with shared workspaces",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Shared projects & workspaces",
      "Team admin dashboard",
      "SSO & SAML",
      "Audit logs",
      "99.9% uptime SLA",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    popular: false,
    color: "#7C65CB",
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") return;
    if (planId === "team") {
      toast({ title: "Contact us at team@replit-ide.com for Team plans" });
      return;
    }
    if (!user) {
      setLocation("/auth");
      return;
    }
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: planId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to start checkout");
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        toast({ title: "Stripe is not configured yet. Please check back soon." });
      }
    } catch (err: any) {
      toast({ title: err.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1525] text-[#F5F9FC]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-12">
          <Button
            variant="ghost"
            size="icon"
            className="text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]"
            onClick={() => setLocation("/")}
            data-testid="button-back-pricing"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-pricing-title">Choose your plan</h1>
            <p className="text-[#9DA2B0] mt-1">Scale your development with the right tools</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border ${plan.popular ? "border-[#0079F2] shadow-lg shadow-[#0079F2]/10" : "border-[#2B3245]"} bg-[#1C2333] p-6 flex flex-col`}
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
                <span className="text-[#676D7E] text-sm">{plan.period}</span>
              </div>
              <p className="text-[#9DA2B0] text-sm mb-6">{plan.description}</p>
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
                    : "bg-[#2B3245] hover:bg-[#3B4255] text-[#F5F9FC]"
                }`}
                onClick={() => handleUpgrade(plan.id)}
                disabled={plan.id === "free" || loading === plan.id}
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
              <div key={i} className="border border-[#2B3245] rounded-lg p-4 bg-[#1C2333]">
                <h4 className="font-medium text-sm text-[#F5F9FC] mb-1">{faq.q}</h4>
                <p className="text-sm text-[#9DA2B0]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
