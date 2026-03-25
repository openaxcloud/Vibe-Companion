import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Users, Shield, BarChart3, Settings, ArrowRight, Sparkles } from "lucide-react";

export default function TeamsOverview() {
  const features = [
    { icon: Users, title: "Real-Time Collaboration", description: "Live multiplayer editing, shared terminals, and presence indicators." },
    { icon: Shield, title: "Enterprise Security", description: "SSO/SAML, audit logs, IP allowlisting, and role-based access controls." },
    { icon: BarChart3, title: "Team Analytics", description: "Track productivity, code quality metrics, and AI usage across your organization." },
    { icon: Settings, title: "Admin Controls", description: "Manage members, set permissions, enforce policies, and control spending." },
  ];

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <section className="py-20 sm:py-28" data-testid="section-teams-hero">
          <div className="container-responsive text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-1.5 text-sm text-blue-700 dark:text-blue-300 mb-6">
              <Sparkles className="h-4 w-4" />
              For Teams
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ecode-text)] dark:text-white mb-6">
              Built for<br />
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">team velocity</span>
            </h1>
            <p className="text-lg text-[var(--ecode-text-secondary)] dark:text-slate-300 max-w-2xl mx-auto mb-8" data-testid="text-teams-description">
              Enterprise controls, compliance, and collaboration tools that help your teams ship faster together.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/contact-sales">
                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white" data-testid="button-teams-contact">
                  Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" data-testid="button-teams-try">Try Free</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30" data-testid="section-teams-features">
          <div className="container-responsive">
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feat) => (
                <Card key={feat.title} className="border-border">
                  <CardContent className="p-6 flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                      <feat.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
