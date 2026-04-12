import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Brain, Shield, BarChart3, Settings, ArrowRight, Sparkles } from "lucide-react";

export default function AIPlatform() {
  const features = [
    { icon: Brain, title: "Multi-Model Support", description: "Access GPT-4.1, Claude Sonnet 4, Gemini 2.5 Pro, and more from a single platform." },
    { icon: Shield, title: "AI Governance", description: "Enterprise controls for AI usage, data privacy, and compliance requirements." },
    { icon: BarChart3, title: "Usage Analytics", description: "Track AI token consumption, costs, and team usage with real-time dashboards." },
    { icon: Settings, title: "Custom Configuration", description: "Fine-tune model parameters, set team quotas, and configure BYOK credentials." },
  ];

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <section className="py-20 sm:py-28" data-testid="section-ai-platform-hero">
          <div className="container-responsive text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-1.5 text-sm text-violet-700 dark:text-violet-300 mb-6">
              <Sparkles className="h-4 w-4" />
              Enterprise AI
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ecode-text)] dark:text-white mb-6">
              AI Platform for<br />
              <span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">enterprise teams</span>
            </h1>
            <p className="text-lg text-[var(--ecode-text-secondary)] dark:text-slate-300 max-w-2xl mx-auto mb-8" data-testid="text-ai-platform-description">
              Governance, observability, and orchestration for AI workloads across your entire organization.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white" data-testid="button-ai-platform-start">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-muted/30" data-testid="section-ai-platform-features">
          <div className="container-responsive">
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feat) => (
                <Card key={feat.title} className="border-border">
                  <CardContent className="p-6 flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
                      <feat.icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ecode-text)] dark:text-white mb-1" data-testid={`text-feature-${feat.title.toLowerCase().replace(/\s/g, '-')}`}>{feat.title}</h3>
                      <p className="text-sm text-[var(--ecode-text-secondary)] dark:text-slate-300">{feat.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
