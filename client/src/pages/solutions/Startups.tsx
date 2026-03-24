import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Rocket, Zap, Clock, DollarSign,
  CheckCircle, TrendingUp, Users, Sparkles, Code,
  Globe, Shield
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead, structuredData } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('solutions/startups');

export default function Startups() {
  const benefits = [
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Ship 10x Faster",
      description: "Build your MVP in days, not months. AI generates production code from natural language.",
      stat: "10x",
      statLabel: "faster development"
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: "Reduce Engineering Costs",
      description: "One developer can do the work of a team. Reduce burn rate and extend your runway.",
      stat: "$50K+",
      statLabel: "saved per hire"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Scale Automatically",
      description: "Start free, pay as you grow. Infrastructure that scales from 0 to millions of users.",
      stat: "0 to ∞",
      statLabel: "auto-scaling"
    }
  ];

  const features = [
    "AI-powered code generation",
    "Instant cloud deployment",
    "Real-time collaboration",
    "Git integration built-in",
    "Database provisioning",
    "Custom domain & SSL",
    "API development tools",
    "Analytics dashboard"
  ];

  const successStories = [
    {
      company: "TechFlow",
      description: "Built their entire SaaS product in 2 weeks",
      result: "$2M ARR in first year",
      stage: "Series A"
    },
    {
      company: "DataSync",
      description: "Pivoted and relaunched in 3 days",
      result: "500K users in 6 months",
      stage: "Seed"
    },
    {
      company: "AIAssist",
      description: "Solo founder built enterprise product",
      result: "Acquired for $15M",
      stage: "Bootstrapped"
    }
  ];

  return (
    <PublicLayout>
      <SEOHead
        {...seo}
        structuredData={structuredData.softwareApplication(
          'E-Code for Startups',
          seo.description,
          'DeveloperApplication'
        )}
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
            For Startups & Founders
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
            Ship Your MVP in Days
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Stop waiting months to launch. Build production-ready products with AI in days.
            Join 10,000+ startups shipping faster with E-Code.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[48px] w-full sm:w-auto px-8 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" data-testid="button-startups-start">
                <Rocket className="h-5 w-5" />
                Start Building Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="gap-2 min-h-[48px] w-full sm:w-auto px-8" data-testid="button-startups-pricing">
                View Startup Pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            No credit card required • Free tier forever • Cancel anytime
          </p>
        </div>

        {/* Key Benefits */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 md:mb-20">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="p-8 text-center hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-500/20">
              <div className="p-4 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl w-fit mx-auto mb-6">
                <div className="text-orange-600 dark:text-orange-400">
                  {benefit.icon}
                </div>
              </div>
              <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                {benefit.stat}
              </div>
              <div className="text-[13px] text-muted-foreground mb-4">{benefit.statLabel}</div>
              <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </Card>
          ))}
        </div>

        {/* Features List */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Everything You Need to Launch</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Stop stitching together tools. E-Code is your complete development platform.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <Card key={feature} className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="font-medium">{feature}</span>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Build Your MVP in 3 Steps</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600 dark:text-orange-400 font-bold text-xl">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Describe Your Idea</h3>
              <p className="text-muted-foreground">
                Tell our AI what you want to build in plain English. Be as detailed or brief as you want.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600 dark:text-orange-400 font-bold text-xl">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Builds It</h3>
              <p className="text-muted-foreground">
                Watch as AI generates your frontend, backend, database, and API in real-time.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600 dark:text-orange-400 font-bold text-xl">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Deploy & Iterate</h3>
              <p className="text-muted-foreground">
                Get a live URL instantly. Collect feedback, iterate, and ship updates in minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Success Stories */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Startup Success Stories</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Join thousands of founders who shipped faster and raised more with E-Code.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {successStories.map((story) => (
              <Card key={story.company} className="p-6 hover:shadow-lg transition-shadow">
                <Badge variant="outline" className="mb-4">{story.stage}</Badge>
                <h3 className="text-xl font-bold mb-2">{story.company}</h3>
                <p className="text-muted-foreground mb-4">{story.description}</p>
                <div className="text-[15px] font-semibold text-orange-600 dark:text-orange-400">
                  {story.result}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Startup Program */}
        <Card className="p-8 md:p-12 mb-16 md:mb-20 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-2 border-orange-200 dark:border-orange-800">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-orange-500 text-white">Startup Program</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">90% Off for Eligible Startups</h2>
              <p className="text-muted-foreground mb-6">
                Early-stage startups get 90% off E-Code for the first year. Plus credits,
                mentorship, and a community of founders.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Must be under $1M in funding",
                  "Less than 10 employees",
                  "Building a tech product"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-[13px]">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/contact-sales">
                <Button size="lg" className="gap-2 bg-orange-500 hover:bg-orange-600" data-testid="button-startup-program">
                  Apply Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 text-center bg-white dark:bg-slate-900">
                <div className="text-3xl font-bold text-orange-600">90%</div>
                <div className="text-[13px] text-muted-foreground">Discount</div>
              </Card>
              <Card className="p-6 text-center bg-white dark:bg-slate-900">
                <div className="text-3xl font-bold text-orange-600">$10K</div>
                <div className="text-[13px] text-muted-foreground">Credits</div>
              </Card>
              <Card className="p-6 text-center bg-white dark:bg-slate-900">
                <div className="text-3xl font-bold text-orange-600">1:1</div>
                <div className="text-[13px] text-muted-foreground">Mentorship</div>
              </Card>
              <Card className="p-6 text-center bg-white dark:bg-slate-900">
                <div className="text-3xl font-bold text-orange-600">VIP</div>
                <div className="text-[13px] text-muted-foreground">Support</div>
              </Card>
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <Card className="p-8 md:p-12 bg-gradient-to-r from-orange-500 to-red-500 border-0 text-white">
          <div className="text-center max-w-3xl mx-auto">
            <Sparkles className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Ship Faster?</h2>
            <p className="text-[15px] text-white/90 mb-8">
              Join 10,000+ startups building the future. Start free today.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[48px] bg-white text-orange-600 hover:bg-orange-50" data-testid="button-startups-cta">
                Start Building Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
