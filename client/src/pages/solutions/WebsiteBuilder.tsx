import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Globe, Palette, Layout, CheckCircle, Zap, Sparkles, Monitor } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";

export default function WebsiteBuilder() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-[13px] font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
            Professional Websites in Seconds
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            Website Builder
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground mb-6 sm:mb-8 px-4 sm:px-0">
            Create stunning, responsive websites instantly with AI. No design skills required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-websitebuilder-start">
                Build Your Website
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/showcase">
              <Button size="lg" variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-websitebuilder-examples">
                <Monitor className="h-4 w-4" />
                View Examples
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-responsive">
            <div className="p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Fully Responsive</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Every website automatically adapts to desktop, tablet, and mobile devices perfectly.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-design">
            <div className="p-2 sm:p-3 bg-teal-100 dark:bg-teal-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Palette className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Beautiful Designs</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              AI generates modern, professional designs tailored to your brand and industry.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" data-testid="card-feature-speed">
            <div className="p-2 sm:p-3 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Lightning Fast</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Optimized for speed with automatic image optimization and CDN delivery.
            </p>
          </Card>
        </div>

        {/* Website Types */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Perfect For Any Business</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[
              "Portfolio Sites",
              "Business Websites",
              "Landing Pages",
              "Blogs",
              "Online Stores",
              "Restaurant Sites",
              "Event Pages",
              "Documentation"
            ].map((type, index) => (
              <Card key={type} className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow" data-testid={`card-type-${index}`}>
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="font-medium text-[11px] sm:text-[13px] md:text-base">{type}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h2>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center" data-testid="step-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-bold">1</span>
              </div>
              <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Describe Your Website</h3>
              <p className="text-[13px] sm:text-base text-muted-foreground">
                Tell our AI what kind of website you need and your preferences.
              </p>
            </div>
            <div className="text-center" data-testid="step-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-bold">2</span>
              </div>
              <h3 className="text-[15px] sm:text-xl font-semibold mb-2">AI Builds It</h3>
              <p className="text-[13px] sm:text-base text-muted-foreground">
                Watch as your website is created in real-time with all features.
              </p>
            </div>
            <div className="text-center" data-testid="step-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-xl sm:text-2xl font-bold">3</span>
              </div>
              <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Publish Instantly</h3>
              <p className="text-[13px] sm:text-base text-muted-foreground">
                Your website goes live immediately with a custom domain.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-6 sm:p-8 md:p-12 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border-2 border-primary/20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Create Your Website Today</h2>
            <p className="text-[13px] sm:text-base md:text-[15px] text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              No coding, no design skills, no hassle. Just describe what you want and watch it come to life.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px]" data-testid="button-websitebuilder-cta">
                Start Building Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}