import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Building2, TrendingUp, Clock, Users,
  Quote, CheckCircle, BarChart3, Rocket
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('case-studies');

const caseStudies = [
  {
    id: "techcorp-global",
    company: "TechCorp Global",
    industry: "Enterprise SaaS",
    logo: "TC",
    color: "blue",
    headline: "Reduced development time by 85% and saved $2M annually",
    description: "TechCorp Global transformed their development workflow with E-Code, enabling their team to ship features 10x faster.",
    metrics: [
      { label: "Development Time", value: "-85%", icon: <Clock className="h-4 w-4" /> },
      { label: "Annual Savings", value: "$2M", icon: <TrendingUp className="h-4 w-4" /> },
      { label: "Developer Productivity", value: "+400%", icon: <Users className="h-4 w-4" /> }
    ],
    quote: "E-Code transformed how we build software. What used to take months now takes days.",
    quotee: "Sarah Chen, CTO",
    featured: true
  },
  {
    id: "fintech-solutions",
    company: "FinTech Solutions",
    industry: "Financial Services",
    logo: "FS",
    color: "green",
    headline: "Built compliant banking platform in 3 months instead of 18",
    description: "FinTech Solutions leveraged E-Code's AI to accelerate their banking platform development while maintaining SOC 2 compliance.",
    metrics: [
      { label: "Time to Market", value: "-83%", icon: <Clock className="h-4 w-4" /> },
      { label: "Compliance", value: "100%", icon: <CheckCircle className="h-4 w-4" /> },
      { label: "Cost Reduction", value: "$1.5M", icon: <TrendingUp className="h-4 w-4" /> }
    ],
    quote: "The security features and audit logging made our compliance journey seamless.",
    quotee: "Michael Rodriguez, VP Engineering",
    featured: true
  },
  {
    id: "healthtech-inc",
    company: "HealthTech Inc",
    industry: "Healthcare",
    logo: "HT",
    color: "red",
    headline: "Deployed HIPAA-compliant patient portal in 6 weeks",
    description: "HealthTech Inc used E-Code to rapidly build a secure patient portal with full HIPAA compliance.",
    metrics: [
      { label: "Development Time", value: "6 weeks", icon: <Clock className="h-4 w-4" /> },
      { label: "Patient Satisfaction", value: "+45%", icon: <Users className="h-4 w-4" /> },
      { label: "Support Tickets", value: "-60%", icon: <TrendingUp className="h-4 w-4" /> }
    ],
    quote: "E-Code's enterprise security features gave us confidence in handling sensitive patient data.",
    quotee: "Dr. Emily Watson, Chief Medical Officer"
  },
  {
    id: "retail-dynamics",
    company: "Retail Dynamics",
    industry: "E-commerce",
    logo: "RD",
    color: "purple",
    headline: "Scaled from 0 to 1M users with zero infrastructure headaches",
    description: "Retail Dynamics built their entire e-commerce platform on E-Code and scaled to millions of users.",
    metrics: [
      { label: "Users Handled", value: "1M+", icon: <Users className="h-4 w-4" /> },
      { label: "Uptime", value: "99.99%", icon: <CheckCircle className="h-4 w-4" /> },
      { label: "Revenue Increase", value: "+200%", icon: <TrendingUp className="h-4 w-4" /> }
    ],
    quote: "We focused on our business while E-Code handled the infrastructure. It just works.",
    quotee: "James Park, Founder & CEO"
  },
  {
    id: "edulearn-global",
    company: "EduLearn Global",
    industry: "Education",
    logo: "EG",
    color: "orange",
    headline: "Enabled 500 schools to go digital during the pandemic",
    description: "EduLearn Global rapidly deployed virtual classrooms for hundreds of schools using E-Code.",
    metrics: [
      { label: "Schools Onboarded", value: "500+", icon: <Building2 className="h-4 w-4" /> },
      { label: "Students Served", value: "200K", icon: <Users className="h-4 w-4" /> },
      { label: "Deployment Time", value: "2 weeks", icon: <Clock className="h-4 w-4" /> }
    ],
    quote: "E-Code made it possible to help schools go digital in record time. Lives were changed.",
    quotee: "Maria Santos, Education Director"
  },
  {
    id: "startup-accelerator",
    company: "StartupX Accelerator",
    industry: "Venture Capital",
    logo: "SX",
    color: "cyan",
    headline: "Portfolio companies ship 5x faster with standardized dev platform",
    description: "StartupX Accelerator adopted E-Code across their portfolio, dramatically improving time-to-market for all startups.",
    metrics: [
      { label: "Portfolio Companies", value: "50+", icon: <Building2 className="h-4 w-4" /> },
      { label: "Average Ship Time", value: "-80%", icon: <Clock className="h-4 w-4" /> },
      { label: "Total Funding Raised", value: "$500M", icon: <TrendingUp className="h-4 w-4" /> }
    ],
    quote: "E-Code is now a mandatory tool for all our portfolio companies. The results speak for themselves.",
    quotee: "David Lee, Managing Partner"
  }
];

export default function CaseStudies() {
  const featuredStudies = caseStudies.filter(s => s.featured);
  const otherStudies = caseStudies.filter(s => !s.featured);

  return (
    <PublicLayout>
      <SEOHead {...seo} />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20" data-testid="page-case-studies">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
            Customer Success
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent" data-testid="heading-case-studies">
            Case Studies
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            See how leading companies build with E-Code. Real results from
            startups to Fortune 500 enterprises.
          </p>
        </div>

        {/* Featured Case Studies */}
        <div className="grid lg:grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {featuredStudies.map((study) => (
            <Card key={study.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 border-2 hover:border-emerald-500/20">
              <div className={`p-8 bg-gradient-to-r from-${study.color}-50 to-${study.color}-100 dark:from-${study.color}-950/30 dark:to-${study.color}-900/30`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-16 h-16 rounded-xl bg-${study.color}-600 flex items-center justify-center text-white font-bold text-xl`}>
                    {study.logo}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{study.company}</h3>
                    <Badge variant="outline">{study.industry}</Badge>
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-4">{study.headline}</h2>
                <p className="text-muted-foreground mb-6">{study.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {study.metrics.map((metric) => (
                    <div key={metric.label} className="text-center p-4 bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-lg">
                      <div className="flex justify-center mb-2">{metric.icon}</div>
                      <div className="text-2xl font-bold text-emerald-600">{metric.value}</div>
                      <div className="text-[11px] text-muted-foreground">{metric.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 p-4 rounded-lg">
                  <Quote className="h-6 w-6 text-emerald-500 mb-2" />
                  <p className="italic text-muted-foreground mb-2">"{study.quote}"</p>
                  <p className="text-[13px] font-semibold">— {study.quotee}</p>
                </div>
              </div>
              <div className="p-4 border-t">
                <Button variant="ghost" className="w-full gap-2" data-testid={`button-case-${study.id}`}>
                  Read Full Case Study
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Other Case Studies */}
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {otherStudies.map((study) => (
            <Card key={study.id} className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group">
              <div className={`w-12 h-12 rounded-lg bg-${study.color}-100 dark:bg-${study.color}-900/30 flex items-center justify-center mb-4`}>
                <span className={`font-bold text-${study.color}-600 dark:text-${study.color}-400`}>{study.logo}</span>
              </div>
              <Badge variant="outline" className="mb-3 text-[11px]">{study.industry}</Badge>
              <h3 className="font-semibold mb-2 group-hover:text-emerald-600 transition-colors">{study.company}</h3>
              <p className="text-[13px] text-muted-foreground line-clamp-2">{study.headline}</p>
              <div className="mt-4 pt-4 border-t">
                <div className="text-2xl font-bold text-emerald-600">{study.metrics?.[0]?.value}</div>
                <div className="text-[11px] text-muted-foreground">{study.metrics?.[0]?.label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Stats Summary */}
        <Card className="p-8 mb-16 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <h2 className="text-2xl font-bold text-center mb-8">Aggregate Customer Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600">85%</div>
              <div className="text-[13px] text-muted-foreground">Average Dev Time Reduction</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600">$10M+</div>
              <div className="text-[13px] text-muted-foreground">Combined Annual Savings</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600">500+</div>
              <div className="text-[13px] text-muted-foreground">Enterprise Customers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600">99.99%</div>
              <div className="text-[13px] text-muted-foreground">Average Uptime</div>
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <Card className="p-8 md:p-12 bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white">
          <div className="text-center max-w-3xl mx-auto">
            <BarChart3 className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Write Your Success Story?</h2>
            <p className="text-[15px] text-white/90 mb-8">
              Join hundreds of companies building faster with E-Code. Let's discuss your use case.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact-sales">
                <Button size="lg" className="gap-2 min-h-[48px] bg-white dark:bg-gray-900 text-emerald-600 hover:bg-emerald-50" data-testid="button-case-studies-talk-sales">
                  Talk to Sales
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="gap-2 min-h-[48px] border-white/30 text-white hover:bg-white dark:bg-gray-900/10" data-testid="button-case-studies-free-trial">
                  <Rocket className="h-5 w-5" />
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
