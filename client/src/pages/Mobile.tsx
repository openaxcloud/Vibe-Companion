import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Smartphone, Wifi, Code, Terminal, ArrowRight, Sparkles } from "lucide-react";

export default function Mobile() {
  const features = [
    { icon: Code, title: "Full IDE on Mobile", description: "Syntax highlighting, autocomplete, and multi-file editing from your phone or tablet." },
    { icon: Terminal, title: "Integrated Terminal", description: "Run commands, install packages, and manage your project from a mobile terminal." },
    { icon: Wifi, title: "Work Offline", description: "Start coding anywhere — changes sync automatically when you're back online." },
    { icon: Smartphone, title: "Touch-Optimized", description: "Custom gestures, adaptive layouts, and haptic feedback designed for touch screens." },
  ];

  return (
    <PublicLayout>
      <div className="min-h-screen">
        <section className="py-20 sm:py-28" data-testid="section-mobile-hero">
          <div className="container-responsive text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-4 py-1.5 text-sm text-sky-700 dark:text-sky-300 mb-6">
              <Sparkles className="h-4 w-4" />
              Code Anywhere
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ecode-text)] dark:text-white mb-6">
              Ship from<br />
              <span className="bg-gradient-to-r from-sky-500 to-blue-500 bg-clip-text text-transparent">anywhere</span>
            </h1>
            <p className="text-lg text-[var(--ecode-text-secondary)] dark:text-slate-300 max-w-2xl mx-auto mb-8" data-testid="text-mobile-description">
              A fully-featured mobile IDE that lets you build, test, and deploy production applications from any device.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-sky-500 to-blue-500 text-white" data-testid="button-mobile-start">
                Get the App <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-muted/30" data-testid="section-mobile-features">
          <div className="container-responsive">
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feat) => (
                <Card key={feat.title} className="border-border">
                  <CardContent className="p-6 flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950/30 flex items-center justify-center">
                      <feat.icon className="h-5 w-5 text-sky-600 dark:text-sky-400" />
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
