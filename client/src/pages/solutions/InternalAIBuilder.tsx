import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Users, Workflow, Lock, Cpu, Rocket } from 'lucide-react';

const capabilities = [
  {
    icon: ShieldCheck,
    title: 'Enterprise-grade security',
    description: 'SOC2 Type II controls, granular RBAC, and private networking for regulated workloads.',
  },
  {
    icon: Users,
    title: 'Team-aware automation',
    description: 'Contextual agents that understand org structures, permissions, and project history.',
  },
  {
    icon: Workflow,
    title: 'Workflow orchestration',
    description: 'Trigger complex build, review, and deployment sequences tailored to your SDLC.',
  },
  {
    icon: Lock,
    title: 'Policy guardrails',
    description: 'Ensure every action respects security policies with real-time observability and approvals.',
  },
  {
    icon: Cpu,
    title: 'Model flexibility',
    description: 'Bring your own models or leverage E-Code tuned models with governance baked in.',
  },
  {
    icon: Rocket,
    title: 'Faster delivery',
    description: 'Reduce cycle times with reusable templates, automation kits, and instant deployments.',
  },
];

export default function InternalAIBuilder() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden py-12 sm:py-16">
        <div className="container-responsive max-w-5xl text-center px-4 sm:px-6">
          <Badge className="mx-auto mb-4 sm:mb-6 bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border-slate-900/20 dark:border-white/20">Internal AI Builder</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Private AI agents for every team
          </h1>
          <p className="mt-3 sm:mt-4 text-[13px] sm:text-base md:text-[15px] text-slate-600 dark:text-slate-200 px-2 sm:px-0">
            Deploy governed AI agents that work across engineering, design, and operations—without compromising compliance or control.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Button 
              className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white min-h-[44px] w-full sm:w-auto" 
              onClick={() => (window.location.href = '/contact-sales')}
              data-testid="button-internalai-contact"
            >
              Talk to an enterprise specialist
            </Button>
            <Button 
              variant="outline" 
              className="border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white min-h-[44px] w-full sm:w-auto" 
              onClick={() => (window.location.href = '/pricing')}
              data-testid="button-internalai-pricing"
            >
              View pricing options
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container-responsive max-w-6xl grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4 sm:px-6">
          {capabilities.map((capability, index) => (
            <Card key={capability.title} className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" data-testid={`card-capability-${index}`}>
              <CardHeader className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                <div className="inline-flex rounded-full bg-sky-100 dark:bg-white/10 p-2 sm:p-3 text-sky-600 dark:text-sky-200">
                  <capability.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-base sm:text-[15px] text-slate-900 dark:text-white">{capability.title}</CardTitle>
                <CardDescription className="text-[13px] sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{capability.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="pb-16 sm:pb-20">
        <div className="container-responsive max-w-5xl px-4 sm:px-6">
          <Card className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-slate-200 dark:border-white/10">
            <CardContent className="grid gap-6 sm:gap-8 py-8 sm:py-12 text-center sm:text-left grid-cols-1 sm:grid-cols-[1.5fr_1fr] p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">Launch an internal AI center of excellence</h2>
                <p className="text-[13px] sm:text-base text-slate-600 dark:text-slate-300">
                  E-Code provides playbooks, governance frameworks, and dedicated solution architects to help you operationalize AI responsibly across your organization.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button 
                  className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white min-h-[44px]" 
                  onClick={() => (window.location.href = '/contact-sales')}
                  data-testid="button-internalai-briefing"
                >
                  Schedule an executive briefing
                </Button>
                <Button 
                  variant="outline" 
                  className="border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white min-h-[44px]" 
                  onClick={() => (window.location.href = '/docs')}
                  data-testid="button-internalai-docs"
                >
                  Explore documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
