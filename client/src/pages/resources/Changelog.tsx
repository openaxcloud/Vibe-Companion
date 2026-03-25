import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Sparkles, Zap, Bug, Shield,
  Rocket, Star, CheckCircle, Bell
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('changelog');

const releases = [
  {
    version: "2.5.0",
    date: "November 2024",
    title: "AI Agent Studio & Enterprise SSO",
    featured: true,
    changes: [
      { type: "feature", text: "AI Agent Studio - Create, train, and deploy custom AI agents" },
      { type: "feature", text: "Enterprise SSO with Okta, Azure AD, and SAML 2.0 support" },
      { type: "feature", text: "Real-time collaboration cursors with user presence" },
      { type: "improvement", text: "50% faster AI code generation response times" },
      { type: "improvement", text: "New Monaco Editor with improved autocomplete" },
      { type: "fix", text: "Fixed WebSocket reconnection issues in unstable networks" }
    ]
  },
  {
    version: "2.4.0",
    date: "October 2024",
    title: "Mobile IDE & Global Edge Deployment",
    changes: [
      { type: "feature", text: "Full-featured mobile IDE for iOS and Android" },
      { type: "feature", text: "Global edge deployment to 200+ locations" },
      { type: "feature", text: "Custom domain support with automatic SSL" },
      { type: "improvement", text: "Redesigned project dashboard with quick actions" },
      { type: "fix", text: "Fixed file sync issues in collaborative editing" },
      { type: "fix", text: "Resolved memory leak in long-running terminal sessions" }
    ]
  },
  {
    version: "2.3.0",
    date: "September 2024",
    title: "Database Management & Secrets Vault",
    changes: [
      { type: "feature", text: "Built-in PostgreSQL database management" },
      { type: "feature", text: "Secrets vault with environment-based encryption" },
      { type: "feature", text: "Database schema migrations with Drizzle ORM" },
      { type: "improvement", text: "Improved error messages with AI-suggested fixes" },
      { type: "improvement", text: "Faster project startup times (3x improvement)" },
      { type: "security", text: "Enhanced audit logging for enterprise customers" }
    ]
  },
  {
    version: "2.2.0",
    date: "August 2024",
    title: "AI-Powered Code Review",
    changes: [
      { type: "feature", text: "AI code review with security vulnerability detection" },
      { type: "feature", text: "Automated test generation from code" },
      { type: "feature", text: "Git integration with GitHub, GitLab, and Bitbucket" },
      { type: "improvement", text: "New dark theme with improved contrast" },
      { type: "fix", text: "Fixed keyboard shortcuts on Windows" }
    ]
  },
  {
    version: "2.1.0",
    date: "July 2024",
    title: "Template Marketplace",
    changes: [
      { type: "feature", text: "Template marketplace with 500+ curated templates" },
      { type: "feature", text: "One-click deploy from templates" },
      { type: "feature", text: "Community template submissions" },
      { type: "improvement", text: "Redesigned onboarding flow" },
      { type: "fix", text: "Fixed file upload issues for large projects" }
    ]
  },
  {
    version: "2.0.0",
    date: "June 2024",
    title: "E-Code 2.0 - Complete Platform Redesign",
    featured: true,
    changes: [
      { type: "feature", text: "Completely redesigned IDE with modern UI" },
      { type: "feature", text: "AI Agent for autonomous code generation" },
      { type: "feature", text: "Real-time multiplayer editing" },
      { type: "feature", text: "Integrated deployment pipeline" },
      { type: "feature", text: "40+ programming languages support" },
      { type: "improvement", text: "10x performance improvements across the platform" },
      { type: "security", text: "SOC 2 Type II certification achieved" }
    ]
  }
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature': return <Sparkles className="h-4 w-4 text-purple-500" />;
    case 'improvement': return <Zap className="h-4 w-4 text-blue-500" />;
    case 'fix': return <Bug className="h-4 w-4 text-orange-500" />;
    case 'security': return <Shield className="h-4 w-4 text-green-500" />;
    default: return <CheckCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'feature': return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">New</Badge>;
    case 'improvement': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Improved</Badge>;
    case 'fix': return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Fixed</Badge>;
    case 'security': return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Security</Badge>;
    default: return null;
  }
};

export default function Changelog() {
  return (
    <PublicLayout>
      <SEOHead {...seo} />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20" data-testid="page-changelog">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
            Product Updates
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent" data-testid="heading-changelog">
            Changelog
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Stay updated with the latest E-Code features, improvements, and fixes.
            We ship new features every week.
          </p>
          <Button size="lg" variant="outline" className="gap-2 min-h-[44px]" data-testid="button-changelog-subscribe">
            <Bell className="h-5 w-5" />
            Subscribe to Updates
          </Button>
        </div>

        {/* Releases Timeline */}
        <div className="max-w-4xl mx-auto">
          {releases.map((release, index) => (
            <div key={release.version} className="relative pl-8 pb-12 last:pb-0">
              {/* Timeline line */}
              {index < releases.length - 1 && (
                <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-pink-500/20" />
              )}

              {/* Timeline dot */}
              <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${
                release.featured
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}>
                {release.featured ? (
                  <Star className="h-3 w-3 text-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                )}
              </div>

              {/* Content */}
              <Card className={`p-6 ${release.featured ? 'border-2 border-purple-500/20 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20' : ''}`}>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Badge variant="secondary" className="font-mono">v{release.version}</Badge>
                  <span className="text-[13px] text-muted-foreground">{release.date}</span>
                  {release.featured && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                      Major Release
                    </Badge>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-bold mb-4">{release.title}</h2>

                <ul className="space-y-3">
                  {release.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-0.5">{getTypeIcon(change.type)}</div>
                      <div className="flex-1">
                        <span>{change.text}</span>
                      </div>
                      <div className="hidden sm:block">{getTypeBadge(change.type)}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="max-w-4xl mx-auto mt-12">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Legend</h3>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-[13px]">New Feature</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-[13px]">Improvement</span>
              </div>
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-orange-500" />
                <span className="text-[13px]">Bug Fix</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-[13px]">Security</span>
              </div>
            </div>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="max-w-4xl mx-auto mt-12 p-8 md:p-12 bg-gradient-to-r from-purple-500 to-pink-500 border-0 text-white">
          <div className="text-center">
            <Rocket className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Try the Latest Features</h2>
            <p className="text-[15px] text-white/90 mb-8">
              Experience the newest E-Code features. Start building today.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[48px] bg-white dark:bg-gray-900 text-purple-600 hover:bg-purple-50" data-testid="button-changelog-get-started">
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
