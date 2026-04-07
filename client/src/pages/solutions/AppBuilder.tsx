import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Code, Sparkles, Rocket, CheckCircle, Layers, Globe, Zap } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";

export default function AppBuilder() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-[13px] font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
            AI-Powered Development
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            App Builder
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground mb-6 sm:mb-8 px-4 sm:px-0">
            Build full-stack applications with AI. From idea to deployment in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-appbuilder-start">
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/templates">
              <Button size="lg" variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-appbuilder-templates">
                <Layers className="h-4 w-4" />
                View Templates
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-fullstack">
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Code className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Full-Stack Development</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Build complete applications with frontend, backend, and database - all from a single prompt.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-ai">
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">AI-Powered Generation</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Our AI understands your requirements and generates production-ready code instantly.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" data-testid="card-feature-deploy">
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Instant Deployment</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Deploy your application to the cloud with one click. Get a live URL immediately.
            </p>
          </Card>
        </div>

        {/* Use Cases */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">What You Can Build</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[
              "SaaS Applications",
              "E-commerce Platforms",
              "Social Networks",
              "Productivity Tools",
              "CRM Systems",
              "Analytics Dashboards",
              "API Services",
              "Mobile Apps"
            ].map((useCase, index) => (
              <Card key={useCase} className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow" data-testid={`card-usecase-${index}`}>
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="font-medium text-[11px] sm:text-[13px] md:text-base">{useCase}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-6 sm:p-8 md:p-12 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-2 border-primary/20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Ready to Build Your App?</h2>
            <p className="text-[13px] sm:text-base md:text-[15px] text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              Build amazing applications with E-Code's AI-powered platform. Start for free today.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px]" data-testid="button-appbuilder-cta">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}