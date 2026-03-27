import React, { type ReactNode } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Users, Trophy, Star, Globe, Zap, Shield, Heart } from 'lucide-react';

type PartnerTier = 'Premier' | 'Strategic' | 'Technology';

interface PartnerLogo {
  name: string;
  logo: {
    src: string;
    alt: string;
  };
  tier: PartnerTier;
}

interface PartnershipType {
  icon: ReactNode;
  title: string;
  description: string;
  benefits: string[];
}

interface PartnerBenefit {
  icon: ReactNode;
  title: string;
  description: string;
}

interface SuccessStory {
  partner: string;
  logo: {
    src: string;
    alt: string;
  };
  title: string;
  description: string;
  metrics: string;
  quote: string;
}

const partnerLogos: PartnerLogo[] = [
  { name: 'Microsoft', logo: { src: '/partners/microsoft.svg', alt: 'Microsoft logo' }, tier: 'Premier' },
  { name: 'Google', logo: { src: '/partners/google.svg', alt: 'Google logo' }, tier: 'Premier' },
  { name: 'Amazon', logo: { src: '/partners/amazon.svg', alt: 'Amazon Web Services logo' }, tier: 'Premier' },
  { name: 'GitHub', logo: { src: '/partners/github.svg', alt: 'GitHub logo' }, tier: 'Strategic' },
  { name: 'OpenAI', logo: { src: '/partners/openai.svg', alt: 'OpenAI logo' }, tier: 'Strategic' },
  { name: 'MongoDB', logo: { src: '/partners/mongodb.svg', alt: 'MongoDB logo' }, tier: 'Technology' },
  { name: 'Docker', logo: { src: '/partners/docker.svg', alt: 'Docker logo' }, tier: 'Technology' },
  { name: 'Stripe', logo: { src: '/partners/stripe.svg', alt: 'Stripe logo' }, tier: 'Technology' },
  { name: 'Vercel', logo: { src: '/partners/vercel.svg', alt: 'Vercel logo' }, tier: 'Technology' },
  { name: 'Firebase', logo: { src: '/partners/firebase.svg', alt: 'Firebase logo' }, tier: 'Technology' },
  { name: 'Cloudflare', logo: { src: '/partners/cloudflare.svg', alt: 'Cloudflare logo' }, tier: 'Technology' },
  { name: 'Redis', logo: { src: '/partners/redis.svg', alt: 'Redis logo' }, tier: 'Technology' }
];

const partnershipTypes: PartnershipType[] = [
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Technology Partners',
    description: 'Integrate your services with E-Code to reach millions of developers worldwide.',
    benefits: [
      'Technical integration support',
      'Co-marketing opportunities',
      'Joint go-to-market strategies',
      'Developer advocacy programs'
    ]
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    title: 'Solution Partners',
    description: 'Help organizations implement E-Code with your expertise and services.',
    benefits: [
      'Partner certification programs',
      'Sales enablement resources',
      'Technical training and support',
      'Partner portal access'
    ]
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: 'Channel Partners',
    description: 'Resell E-Code solutions and expand your portfolio with cutting-edge development tools.',
    benefits: [
      'Competitive margins and incentives',
      'Dedicated partner support',
      'Marketing development funds',
      'Lead sharing programs'
    ]
  }
];

const partnerBenefits: PartnerBenefit[] = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Accelerated Growth',
    description: 'Tap into our global developer community and accelerate your business growth.'
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Enterprise Security',
    description: 'Benefit from enterprise-grade security and compliance standards.'
  },
  {
    icon: <Star className="h-5 w-5" />,
    title: 'Co-innovation',
    description: 'Collaborate on innovative solutions that shape the future of development.'
  },
  {
    icon: <Heart className="h-5 w-5" />,
    title: 'Dedicated Support',
    description: 'Get dedicated partner success management and technical support.'
  }
];

const successStories: SuccessStory[] = [
  {
    partner: 'MongoDB',
    logo: { src: '/partners/mongodb.svg', alt: 'MongoDB logo' },
    title: 'Seamless Database Integration',
    description: 'MongoDB Atlas integration allows developers to spin up databases in seconds, resulting in 40% faster project deployment.',
    metrics: '40% faster deployment',
    quote: 'E-Code has transformed how developers interact with MongoDB, making database setup effortless.'
  },
  {
    partner: 'Redis',
    logo: { src: '/partners/redis.svg', alt: 'Redis logo' },
    title: 'Predictable, Low-Latency Caching',
    description: 'Redis Enterprise on E-Code provides real-time data access with enterprise-grade resiliency for mission-critical workloads.',
    metrics: '99.999% uptime achieved',
    quote: 'Partnering with E-Code helps our joint customers deliver instant, reliable experiences backed by Redis performance.'
  },
  {
    partner: 'Docker',
    logo: { src: '/partners/docker.svg', alt: 'Docker logo' },
    title: 'Cloud-Native Delivery at Scale',
    description: 'Docker and E-Code streamline secure container delivery pipelines so teams can ship updates multiple times a day.',
    metrics: '5x faster release cadence',
    quote: 'With Docker images orchestrated on E-Code, teams modernize their delivery workflows without sacrificing compliance.'
  }
];

export default function Partners() {
  return (
    <div className="min-h-screen flex flex-col" data-testid="page-partners">
      <PublicNavbar />

      <main className="flex-1 bg-background">
        {/* Hero Section */}
        <section className="py-24 sm:py-28 bg-gradient-to-b from-background via-muted/40 to-background">
          <div className="container mx-auto px-6 lg:px-4 md:px-6 lg:px-8">
            <div className="text-center max-w-3xl lg:max-w-4xl mx-auto space-y-8">
              <Badge variant="secondary" className="mx-auto w-fit">
                <Users className="h-3 w-3 mr-1" />
                Partner Ecosystem
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent" data-testid="heading-partners">
                Build the future together
              </h1>
              <p className="text-[15px] md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Join our thriving partner ecosystem and help developers build, ship, and scale their ideas faster than ever before.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="min-h-[44px]" data-testid="button-partners-become">
                  Become a Partner
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="min-h-[44px]" data-testid="button-partners-portal">
                  Partner Portal
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Partner Logos Section */}
        <section className="py-20 bg-muted/20 dark:bg-muted/30">
          <div className="container mx-auto px-6 lg:px-4 md:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Trusted by industry leaders</h2>
              <p className="text-muted-foreground text-base md:text-[15px]">
                We're proud to partner with the world's most innovative companies to deliver exceptional developer experiences.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 lg:grid-cols-6 gap-8 max-w-6xl mx-auto">
              {partnerLogos.map((partner, index) => (
                <div key={index} className="flex flex-col items-center group">
                  <div className="w-20 h-20 bg-white dark:bg-gray-900 dark:bg-card border border-border/40 rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:shadow-md group-hover:border-border transition-all">
                    <img
                      src={partner.logo.src}
                      alt={partner.logo.alt}
                      className="max-h-12 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <span className="text-[13px] font-medium text-center">{partner.name}</span>
                  <Badge variant="outline" className="text-[11px] mt-1">
                    {partner.tier}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Partnership Types Section */}
        <section className="py-20">
          <div className="container mx-auto px-6 lg:px-4 md:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Partnership opportunities</h2>
              <p className="text-muted-foreground text-base md:text-[15px]">
                Whether you're a technology provider, solution implementer, or channel partner, we have programs designed for your success.
              </p>
            </div>

            <div className="grid md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {partnershipTypes.map((type, index) => (
                <Card
                  key={index}
                  className="border border-border/50 shadow-sm hover:shadow-lg transition-shadow bg-white dark:bg-gray-900/90 dark:bg-card/90 backdrop-blur"
                >
                  <CardHeader>
                    <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                      {type.icon}
                    </div>
                    <CardTitle className="text-xl">{type.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-6">{type.description}</p>
                    <ul className="space-y-2">
                      {type.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[13px]">
                          <Star className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Partner Benefits Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-6 lg:px-4 md:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Why partner with E-Code?</h2>
              <p className="text-muted-foreground text-base md:text-[15px]">
                Join a thriving ecosystem that's transforming how software is built and deployed worldwide.
              </p>
            </div>

            <div className="grid md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {partnerBenefits.map((benefit, index) => (
                <Card key={index} className="border border-border/50 shadow-sm text-center bg-white dark:bg-gray-900/90 dark:bg-card/90 backdrop-blur">
                  <CardContent className="pt-6 space-y-3">
                    <div className="p-3 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                      {benefit.icon}
                    </div>
                    <h3 className="font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-[13px] text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Success Stories Section */}
        <section className="py-20">
          <div className="container mx-auto px-6 lg:px-4 md:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Partner success stories</h2>
              <p className="text-muted-foreground text-base md:text-[15px]">
                See how our partners are achieving remarkable results and driving innovation with E-Code.
              </p>
            </div>

            <div className="grid md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {successStories.map((story, index) => (
                <Card key={index} className="border border-border/50 shadow-sm hover:shadow-lg transition-shadow bg-white dark:bg-gray-900 dark:bg-card/95">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 bg-white dark:bg-gray-900 dark:bg-background/80 border border-border/40 rounded-xl shadow-sm flex items-center justify-center">
                        <img
                          src={story.logo.src}
                          alt={story.logo.alt}
                          className="max-h-10 w-auto object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">{story.partner}</h3>
                        <Badge variant="outline" className="text-[11px]">
                          {story.metrics}
                        </Badge>
                      </div>
                    </div>
                    <CardTitle className="text-[15px]">{story.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{story.description}</p>
                    <blockquote className="text-[13px] italic border-l-4 border-primary/20 pl-4">
                      "{story.quote}"
                    </blockquote>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-6 lg:px-4 md:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to partner with us?</h2>
              <p className="text-[15px] md:text-xl opacity-90 mb-8">
                Join thousands of partners who are already transforming the developer experience. Let's build something amazing together.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" className="min-h-[44px]" data-testid="button-partners-apply">
                  Apply Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 min-h-[44px]" data-testid="button-partners-contact">
                  Contact Us
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}