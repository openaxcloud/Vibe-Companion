import PublicLayout from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Zap, Code, Cloud, Shield } from "lucide-react";

export default function Compare() {
  const competitors = [
    {
      name: "GitHub Codespaces",
      path: "/compare/vs-github-codespaces",
      icon: Code,
      description: "Cloud-based development environments"
    },
    {
      name: "Glitch",
      path: "/compare/vs-glitch",
      icon: Zap,
      description: "Collaborative coding platform"
    },
    {
      name: "Heroku",
      path: "/compare/vs-heroku",
      icon: Cloud,
      description: "Platform as a Service (PaaS)"
    },
    {
      name: "CodeSandbox",
      path: "/compare/vs-codesandbox",
      icon: Code,
      description: "Online code editor"
    },
    {
      name: "AWS Cloud9",
      path: "/compare/vs-aws-cloud9",
      icon: Shield,
      description: "Cloud IDE from Amazon"
    }
  ];

  const advantages = [
    "AI-powered code generation with GPT-5 and Claude",
    "Real-time collaboration with WebSocket",
    "One-click deployment to production",
    "Built-in database and authentication",
    "Fortune 500-grade infrastructure",
    "Custom AI prompts and templates"
  ];

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Compare E-Code Platform
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground max-w-3xl mx-auto px-4 sm:px-0">
            See how E-Code Platform stacks up against other development platforms
          </p>
        </div>

        {/* Key Advantages */}
        <Card className="mb-8 sm:mb-12" data-testid="card-advantages">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">Why Choose E-Code Platform?</CardTitle>
            <CardDescription className="text-[13px] sm:text-base">
              Our platform offers unique advantages that set us apart
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {advantages.map((advantage, index) => (
                <div key={index} className="flex items-start gap-2 sm:gap-3" data-testid={`advantage-${index}`}>
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] sm:text-[13px]">{advantage}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Competitor Comparisons */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">
            Detailed Comparisons
          </h2>
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {competitors.map((competitor, index) => {
              const Icon = competitor.icon;
              return (
                <Card key={competitor.path} className="hover:shadow-lg transition-shadow" data-testid={`card-competitor-${index}`}>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <CardTitle className="text-base sm:text-[15px]">{competitor.name}</CardTitle>
                    </div>
                    <CardDescription className="text-[11px] sm:text-[13px]">{competitor.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <Link href={competitor.path}>
                      <Button variant="outline" className="w-full min-h-[44px] text-[13px]" data-testid={`button-compare-${competitor.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        View Comparison
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Ready to Experience the Difference?</h2>
            <p className="text-[13px] sm:text-base text-muted-foreground mb-3 sm:mb-4">
              Start building faster with E-Code Platform today
            </p>
            <Link href="/register">
              <Button size="lg" className="min-h-[44px]" data-testid="button-get-started">
                Get Started Free
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
