import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Sparkles, Zap, Code, MessageSquare, Wand2, ArrowRight } from "lucide-react";

export default function AIAgent() {
  const capabilities = [
    { icon: Code, title: "Code Generation", description: "Generate production-ready code from natural language descriptions in any language." },
    { icon: MessageSquare, title: "Natural Language Prompts", description: "Describe what you want to build and watch the AI agent create it step by step." },
    { icon: Wand2, title: "Intelligent Refactoring", description: "Automatically optimize, refactor, and improve your existing codebase." },
    { icon: Zap, title: "Instant Deployment", description: "From prompt to production in minutes with automated testing and deployment." },
  ];

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <section className="py-20 sm:py-28" data-testid="section-ai-agent-hero">
          <div className="container-responsive text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-1.5 text-sm text-orange-700 dark:text-orange-300 mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Development
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ecode-text)] dark:text-white mb-6">
              Build apps with<br />
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">natural language</span>
            </h1>
            <p className="text-lg text-[var(--ecode-text-secondary)] dark:text-slate-300 max-w-2xl mx-auto mb-8" data-testid="text-ai-agent-description">
              E-Code's AI Agent transforms your ideas into production-ready applications.
              Describe what you want, and let AI handle the implementation.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white" data-testid="button-ai-agent-start">
                  Start Building <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" data-testid="button-ai-agent-docs">Documentation</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30" data-testid="section-ai-agent-capabilities">
          <div className="container-responsive">
            <h2 className="text-3xl font-bold text-center text-[var(--ecode-text)] dark:text-white mb-12">What the AI Agent can do</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {capabilities.map((cap) => (
                <Card key={cap.title} className="border-border">
                  <CardContent className="p-6 flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
                      <cap.icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ecode-text)] dark:text-white mb-1" data-testid={`text-capability-${cap.title.toLowerCase().replace(/\s/g, '-')}`}>{cap.title}</h3>
                      <p className="text-sm text-[var(--ecode-text-secondary)] dark:text-slate-300">{cap.description}</p>
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
