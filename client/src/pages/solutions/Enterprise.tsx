import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Shield, Users, Lock, Building2,
  CheckCircle, Globe, Zap, BarChart3, Settings,
  HeadphonesIcon, FileText, Key, Server
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead, structuredData } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('solutions/enterprise');

export default function Enterprise() {
  const enterpriseFeatures = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "SOC 2 Type II Certified",
      description: "Bank-level security with continuous compliance monitoring and annual audits.",
      color: "blue"
    },
    {
      icon: <Lock className="h-6 w-6" />,
      title: "SSO & SAML Integration",
      description: "Seamless integration with Okta, Azure AD, OneLogin, and custom SAML providers.",
      color: "purple"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Role-Based Access Control",
      description: "Granular permissions with custom roles for developers, managers, and admins.",
      color: "green"
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Audit Logs & Compliance",
      description: "Complete audit trail for every action. GDPR, HIPAA, and SOX compliance ready.",
      color: "orange"
    },
    {
      icon: <Server className="h-6 w-6" />,
      title: "Dedicated Infrastructure",
      description: "Private cloud deployment options with dedicated resources and VPC isolation.",
      color: "cyan"
    },
    {
      icon: <HeadphonesIcon className="h-6 w-6" />,
      title: "24/7 Priority Support",
      description: "Dedicated success manager, 15-minute response SLA, and onboarding assistance.",
      color: "pink"
    }
  ];

  const stats = [
    { value: "99.99%", label: "Uptime SLA" },
    { value: "500+", label: "Enterprise Customers" },
    { value: "15min", label: "Support Response" },
    { value: "SOC 2", label: "Type II Certified" }
  ];

  const trustedBy = [
    "Fortune 500 Tech Co.",
    "Global Financial Services",
    "Healthcare Enterprise",
    "Government Agency",
    "Manufacturing Giant"
  ];

  return (
    <PublicLayout>
      <SEOHead
        {...seo}
        structuredData={{
          ...structuredData.organization(),
          ...structuredData.product('E-Code Enterprise', seo.description, '999', 'USD')
        }}
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-700 text-white border-0">
            Enterprise-Grade Platform
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Enterprise Solutions
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            The development platform trusted by Fortune 500 companies. Enterprise security,
            compliance, and support built for the world's largest organizations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact-sales">
              <Button size="lg" className="gap-2 min-h-[48px] w-full sm:w-auto px-8" data-testid="button-enterprise-contact">
                <Building2 className="h-5 w-5" />
                Contact Sales
              </Button>
            </Link>
            <Link href="/security">
              <Button size="lg" variant="outline" className="gap-2 min-h-[48px] w-full sm:w-auto px-8" data-testid="button-enterprise-security">
                <Shield className="h-5 w-5" />
                View Security
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 md:mb-20">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-6 text-center bg-muted/50">
              <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">{stat.value}</div>
              <div className="text-[13px] text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Enterprise Features */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Enterprise Features</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Built for organizations that demand the highest standards of security, compliance, and support.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enterpriseFeatures.map((feature) => (
              <Card key={feature.title} className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20">
                <div className={`p-3 bg-${feature.color}-100 dark:bg-${feature.color}-900/20 rounded-xl w-fit mb-4`}>
                  <div className={`text-${feature.color}-600 dark:text-${feature.color}-400`}>
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* What's Included */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">What's Included</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Security & Compliance
              </h3>
              <ul className="space-y-4">
                {[
                  "SOC 2 Type II certification",
                  "GDPR & CCPA compliance",
                  "HIPAA BAA available",
                  "End-to-end encryption",
                  "IP allowlisting",
                  "Custom data residency"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Administration
              </h3>
              <ul className="space-y-4">
                {[
                  "SSO/SAML integration",
                  "SCIM user provisioning",
                  "Custom role management",
                  "Complete audit logging",
                  "Usage analytics & insights",
                  "API access controls"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Infrastructure
              </h3>
              <ul className="space-y-4">
                {[
                  "99.99% uptime SLA",
                  "Dedicated resources option",
                  "VPC peering available",
                  "Custom domain & SSL",
                  "Global edge deployment",
                  "Disaster recovery included"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <HeadphonesIcon className="h-5 w-5 text-primary" />
                Support & Success
              </h3>
              <ul className="space-y-4">
                {[
                  "Dedicated success manager",
                  "24/7 priority support",
                  "15-minute response SLA",
                  "Custom onboarding",
                  "Training & workshops",
                  "Quarterly business reviews"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        {/* Trusted By */}
        <div className="mb-16 md:mb-20">
          <p className="text-center text-muted-foreground mb-8">Trusted by leading enterprises worldwide</p>
          <div className="flex flex-wrap justify-center gap-8 opacity-60">
            {trustedBy.map((company) => (
              <div key={company} className="text-[15px] font-semibold text-muted-foreground">
                {company}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-8 md:p-12 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 border-0 text-white">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready for Enterprise?</h2>
            <p className="text-[15px] text-slate-300 mb-8">
              Talk to our sales team about custom pricing, dedicated support, and tailored solutions for your organization.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact-sales">
                <Button size="lg" className="gap-2 min-h-[48px] bg-white text-slate-900 hover:bg-slate-100" data-testid="button-enterprise-cta-sales">
                  Schedule Demo
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="gap-2 min-h-[48px] border-white/30 text-white hover:bg-white/10" data-testid="button-enterprise-cta-pricing">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
