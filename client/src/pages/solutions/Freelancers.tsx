import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Briefcase, Clock, DollarSign, Star,
  CheckCircle, Users, Sparkles, Code, Globe,
  Laptop, Palette, Share2, Trophy
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead, structuredData } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('solutions/freelancers');

export default function Freelancers() {
  const benefits = [
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Deliver 5x Faster",
      description: "AI helps you code faster. Complete projects in days instead of weeks.",
      color: "violet"
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: "Increase Your Rates",
      description: "Deliver better quality, faster. Justify premium pricing with professional results.",
      color: "green"
    },
    {
      icon: <Star className="h-6 w-6" />,
      title: "5-Star Deliverables",
      description: "AI-assisted code quality. Built-in best practices for every project.",
      color: "yellow"
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Professional Hosting",
      description: "Deploy client projects with custom domains. No separate hosting needed.",
      color: "blue"
    },
    {
      icon: <Share2 className="h-6 w-6" />,
      title: "Portfolio Showcase",
      description: "Beautiful portfolio hosting included. Impress potential clients.",
      color: "pink"
    },
    {
      icon: <Laptop className="h-6 w-6" />,
      title: "Work From Anywhere",
      description: "Browser-based IDE. Code on any device, anywhere in the world.",
      color: "cyan"
    }
  ];

  const projectTypes = [
    "Landing Pages",
    "E-commerce Sites",
    "Web Applications",
    "Mobile Apps",
    "API Development",
    "Dashboard/Admin",
    "Portfolio Sites",
    "SaaS Products"
  ];

  const testimonials = [
    {
      name: "Alex Chen",
      role: "Full-Stack Freelancer",
      quote: "I went from 2 projects/month to 8. E-Code's AI lets me deliver faster without sacrificing quality.",
      rating: 5,
      income: "3x income increase"
    },
    {
      name: "Maria Santos",
      role: "Web Developer",
      quote: "Clients love the fast turnaround. I can prototype in hours and iterate instantly.",
      rating: 5,
      income: "Doubled my rates"
    },
    {
      name: "James Wilson",
      role: "App Developer",
      quote: "The AI understands what I need. It's like having a senior developer as a pair programmer.",
      rating: 5,
      income: "4 simultaneous projects"
    }
  ];

  return (
    <PublicLayout>
      <SEOHead
        {...seo}
        structuredData={structuredData.softwareApplication(
          'E-Code for Freelancers',
          seo.description,
          'DeveloperApplication'
        )}
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0">
            For Freelancers & Contractors
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            Deliver Projects Faster
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Win more clients. Deliver faster. Charge more. Join 50,000+ freelancers
            using AI to supercharge their development workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[48px] w-full sm:w-auto px-4 md:px-6 lg:px-8 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600" data-testid="button-freelancers-start">
                <Briefcase className="h-5 w-5" />
                Start Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="gap-2 min-h-[48px] w-full sm:w-auto px-4 md:px-6 lg:px-8" data-testid="button-freelancers-pricing">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            Free forever tier • No credit card required
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16 md:mb-20">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-violet-500/20">
              <div className={`p-3 bg-${benefit.color}-100 dark:bg-${benefit.color}-900/20 rounded-xl w-fit mb-4`}>
                <div className={`text-${benefit.color}-600 dark:text-${benefit.color}-400`}>
                  {benefit.icon}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </Card>
          ))}
        </div>

        {/* Project Types */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Build Any Project Type</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            From simple landing pages to complex web applications. E-Code handles it all.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projectTypes.map((type) => (
              <Card key={type} className="p-4 text-center hover:shadow-md transition-shadow hover:border-violet-500/20">
                <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
                <span className="font-medium">{type}</span>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-16 md:mb-20 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Your New Workflow</h2>
          <div className="grid md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Get Client Brief", desc: "Receive project requirements from your client" },
              { step: "2", title: "Prompt AI", desc: "Describe the project to E-Code's AI agent" },
              { step: "3", title: "Review & Refine", desc: "AI generates code, you refine the details" },
              { step: "4", title: "Deploy & Deliver", desc: "One-click deploy with custom domain" }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-violet-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-[13px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">What Freelancers Say</h2>
          <p className="text-center text-muted-foreground mb-12">Real results from real freelancers</p>
          <div className="grid md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-[13px] text-muted-foreground">{testimonial.role}</div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {testimonial.income}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Pricing Highlight */}
        <Card className="p-8 md:p-12 mb-16 md:mb-20 border-2 border-violet-200 dark:border-violet-800">
          <div className="grid md:grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-violet-500 text-white">Freelancer-Friendly Pricing</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Start Free, Grow as You Earn</h2>
              <p className="text-muted-foreground mb-6">
                Our pricing scales with your success. Start with our generous free tier,
                upgrade when you need more power.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Unlimited projects on free tier",
                  "Custom domains included",
                  "Portfolio hosting free",
                  "Pay only for what you use"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/pricing">
                <Button size="lg" className="gap-2 bg-violet-500 hover:bg-violet-600" data-testid="button-freelancer-pricing-cta">
                  See All Plans
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-violet-600">$0</div>
                <div className="text-[13px] text-muted-foreground">Free Forever</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-violet-600">∞</div>
                <div className="text-[13px] text-muted-foreground">Projects</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-violet-600">SSL</div>
                <div className="text-[13px] text-muted-foreground">Included</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-violet-600">24/7</div>
                <div className="text-[13px] text-muted-foreground">Support</div>
              </Card>
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <Card className="p-8 md:p-12 bg-gradient-to-r from-violet-500 to-purple-500 border-0 text-white">
          <div className="text-center max-w-3xl mx-auto">
            <Trophy className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Win More Clients Today</h2>
            <p className="text-[15px] text-white/90 mb-8">
              Join 50,000+ freelancers delivering better projects, faster. Start free now.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2 min-h-[48px] bg-white dark:bg-gray-900 text-violet-600 hover:bg-violet-50" data-testid="button-freelancers-cta">
                  Start Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/templates">
                <Button size="lg" variant="outline" className="gap-2 min-h-[48px] border-white/30 text-white hover:bg-white dark:bg-gray-900/10" data-testid="button-freelancers-templates">
                  <Palette className="h-5 w-5" />
                  View Templates
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
