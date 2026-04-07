import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Shield, CheckCircle, Globe, Server, Database, Cloud, Lock, FileText } from 'lucide-react';
import { Link } from 'wouter';

const subprocessorCategories = [
  {
    category: "Infrastructure Providers",
    description: "Core infrastructure and hosting services",
    providers: [
      {
        name: "Amazon Web Services (AWS)",
        location: "United States",
        services: ["Cloud Infrastructure", "Storage", "Computing"],
        compliance: ["SOC 2", "ISO 27001", "PCI DSS"],
        purpose: "Application hosting and data storage"
      },
      {
        name: "Google Cloud Platform",
        location: "United States",
        services: ["Cloud Infrastructure", "AI/ML Services", "Analytics"],
        compliance: ["SOC 2", "ISO 27001", "GDPR"],
        purpose: "Compute resources and machine learning"
      },
      {
        name: "Cloudflare",
        location: "United States",
        services: ["CDN", "DDoS Protection", "DNS"],
        compliance: ["SOC 2", "ISO 27001", "PCI DSS"],
        purpose: "Content delivery and security"
      }
    ]
  },
  {
    category: "Developer Tools",
    description: "Code execution and development services",
    providers: [
      {
        name: "GitHub",
        location: "United States",
        services: ["Version Control", "Code Storage", "CI/CD"],
        compliance: ["SOC 2", "ISO 27001"],
        purpose: "Source code management and collaboration"
      },
      {
        name: "Docker Hub",
        location: "United States",
        services: ["Container Registry", "Image Storage"],
        compliance: ["SOC 2"],
        purpose: "Container image distribution"
      },
      {
        name: "npm Registry",
        location: "United States",
        services: ["Package Registry", "Dependency Management"],
        compliance: ["SOC 2"],
        purpose: "JavaScript package distribution"
      }
    ]
  },
  {
    category: "Security & Monitoring",
    description: "Security, monitoring, and compliance services",
    providers: [
      {
        name: "Sentry",
        location: "United States",
        services: ["Error Tracking", "Performance Monitoring"],
        compliance: ["SOC 2", "GDPR"],
        purpose: "Application monitoring and debugging"
      },
      {
        name: "Auth0",
        location: "United States",
        services: ["Authentication", "Identity Management"],
        compliance: ["SOC 2", "ISO 27001", "GDPR"],
        purpose: "User authentication and authorization"
      },
      {
        name: "Stripe",
        location: "United States",
        services: ["Payment Processing", "Billing"],
        compliance: ["PCI DSS", "SOC 2", "ISO 27001"],
        purpose: "Payment and subscription management"
      }
    ]
  },
  {
    category: "Communication Services",
    description: "Email and notification services",
    providers: [
      {
        name: "SendGrid",
        location: "United States",
        services: ["Email Delivery", "Marketing Automation"],
        compliance: ["SOC 2", "GDPR"],
        purpose: "Transactional and marketing emails"
      },
      {
        name: "Twilio",
        location: "United States",
        services: ["SMS", "Voice", "Video"],
        compliance: ["SOC 2", "ISO 27001", "GDPR"],
        purpose: "SMS notifications and communications"
      }
    ]
  }
];

export default function Subprocessors() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="py-responsive bg-gradient-subtle">
        <div className="container-responsive">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <Badge variant="secondary">Last Updated: January 2025</Badge>
          </div>
          
          <h1 className="text-responsive-2xl font-bold tracking-tight mb-4">
            E-Code Subprocessors
          </h1>
          
          <p className="text-responsive-base text-muted-foreground max-w-3xl">
            To provide you with the best possible service, E-Code partners with trusted third-party 
            service providers. This page lists all subprocessors that may process your data as part 
            of our service delivery.
          </p>
        </div>
      </section>

      {/* Data Processing Notice */}
      <section className="py-responsive border-b">
        <div className="container-responsive">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Data Processing & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All subprocessors listed below are carefully vetted and bound by data processing 
                agreements that ensure your data is handled in accordance with our{' '}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and 
                applicable data protection laws.
              </p>
              
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Contractual Safeguards</p>
                    <p className="text-xs text-muted-foreground">
                      All providers sign data processing agreements
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Regular Audits</p>
                    <p className="text-xs text-muted-foreground">
                      Annual security and compliance reviews
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Minimal Access</p>
                    <p className="text-xs text-muted-foreground">
                      Providers access only necessary data
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Subprocessors List */}
      <section className="py-responsive">
        <div className="container-responsive">
          <div className="space-y-12">
            {subprocessorCategories.map((category) => (
              <div key={category.category}>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">{category.category}</h2>
                  <p className="text-muted-foreground">{category.description}</p>
                </div>

                <div className="grid gap-6">
                  {category.providers.map((provider) => (
                    <Card key={provider.name}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{provider.name}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Globe className="h-3 w-3" />
                              {provider.location}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {provider.compliance.map((cert) => (
                              <Badge key={cert} variant="outline" className="text-xs">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Purpose</p>
                          <p className="text-sm text-muted-foreground">{provider.purpose}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-1">Services Used</p>
                          <div className="flex flex-wrap gap-2">
                            {provider.services.map((service) => (
                              <Badge key={service} variant="secondary" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Updates Section */}
      <section className="py-responsive bg-muted/30">
        <div className="container-responsive">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Subprocessor Updates
              </CardTitle>
              <CardDescription>
                How we notify you of changes to our subprocessors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Notification Process</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>We provide at least 30 days notice before adding new subprocessors</li>
                  <li>Notifications are sent to your registered email address</li>
                  <li>This page is updated with any changes to our subprocessor list</li>
                  <li>You may object to new subprocessors within the notice period</li>
                </ul>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h3 className="font-medium">Your Rights</h3>
                <p className="text-sm text-muted-foreground">
                  If you have concerns about any of our subprocessors or wish to receive 
                  notifications about changes, please contact our Data Protection Officer at{' '}
                  <a href="mailto:privacy@ecode.dev" className="text-primary hover:underline">
                    privacy@ecode.dev
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-responsive border-t">
        <div className="container-responsive text-center">
          <h2 className="text-2xl font-semibold mb-4">Questions About Our Subprocessors?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            We're committed to transparency about how your data is processed. If you have any 
            questions about our subprocessors or data handling practices, we're here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link href="/contact">Contact Privacy Team</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/privacy">View Privacy Policy</Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}