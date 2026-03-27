import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Globe, Zap, Shield, BarChart3, ArrowRight, Sparkles } from "lucide-react";

export default function Deployments() {
  const features = [
    { icon: Globe, title: "Global Edge Network", description: "Deploy to 30+ regions worldwide with automatic geo-routing and CDN caching." },
    { icon: Zap, title: "One-Click Deploy", description: "Push to production instantly with zero-downtime rolling deployments." },
    { icon: Shield, title: "SSL & Security", description: "Automatic TLS certificates, DDoS protection, and SOC 2 compliance built in." },
    { icon: BarChart3, title: "Observability", description: "Real-time logs, performance metrics, and alerting for every deployment." },
  ];

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <section className="py-20 sm:py-28" data-testid="section-deployments-hero">
          <div className="container-responsive text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-1.5 text-sm text-green-700 dark:text-green-300 mb-6">
              <Sparkles className="h-4 w-4" />
              Infrastructure
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ecode-text)] dark:text-white mb-6">
              Deploy globally in<br />
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">seconds</span>
            </h1>
            <p className="text-lg text-[var(--ecode-text-secondary)] dark:text-slate-300 max-w-2xl mx-auto mb-8" data-testid="text-deployments-description">
              Enterprise-grade deployment infrastructure with Fortune 500 reliability. 99.99% uptime SLA included.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white" data-testid="button-deployments-start">
                Start Deploying <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-muted/30" data-testid="section-deployments-features">
          <div className="container-responsive">
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feat) => (
                <Card key={feat.title} className="border-border">
                  <CardContent className="p-6 flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                      <feat.icon className="h-5 w-5 text-green-600 dark:text-green-400" />
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
