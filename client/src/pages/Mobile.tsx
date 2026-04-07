import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Code, Cloud, Users, Zap, Shield } from 'lucide-react';

export default function Mobile() {
  const features = [
    {
      icon: Code,
      title: 'Code on the Go',
      description: 'Write, run, and debug code from your phone or tablet',
    },
    {
      icon: Cloud,
      title: 'Cloud Sync',
      description: 'All your projects sync seamlessly across devices',
    },
    {
      icon: Users,
      title: 'Collaborate Anywhere',
      description: 'Work with your team in real-time from any location',
    },
    {
      icon: Zap,
      title: 'Instant Setup',
      description: 'No configuration needed - just open and code',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Enterprise-grade security for your code',
    },
    {
      icon: Smartphone,
      title: 'Native Experience',
      description: 'Optimized for touch with mobile-first design',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-responsive bg-gradient-to-b from-background to-muted">
          <div className="container-responsive">
            <div className="text-center max-w-3xl mx-auto">
              <Badge className="mb-4" variant="secondary">
                Available on iOS & Android
              </Badge>
              <h1 className="text-responsive-xl font-bold mb-6">
                Code Anywhere with E-Code Mobile
              </h1>
              <p className="text-responsive-base text-muted-foreground mb-8">
                The full power of E-Code in your pocket. Write, run, and deploy code from your mobile device with our native apps.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <a 
                  href="https://apps.apple.com/app/replit" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <img 
                    src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg" 
                    alt="Download on the App Store"
                    className="h-14"
                  />
                </a>
                <a 
                  href="https://play.google.com/store/apps/details?id=com.replit.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <img 
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                    alt="Get it on Google Play"
                    className="h-14"
                  />
                </a>
              </div>

              {/* Phone Mockup */}
              <div className="relative mx-auto w-full max-w-sm">
                <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px]">
                  <div className="h-[32px] w-[3px] bg-gray-800 dark:bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                  <div className="h-[46px] w-[3px] bg-gray-800 dark:bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                  <div className="h-[46px] w-[3px] bg-gray-800 dark:bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                  <div className="h-[64px] w-[3px] bg-gray-800 dark:bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                  <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white dark:bg-gray-800">
                    <img 
                      src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&h=600&fit=crop" 
                      alt="E-Code Mobile App"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-responsive">
          <div className="container-responsive">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Mobile-First Features</h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to code professionally from your mobile device
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title}>
                    <CardContent className="pt-6">
                      <Icon className="h-12 w-12 mb-4 text-primary" />
                      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Reviews Section */}
        <section className="py-responsive bg-muted">
          <div className="container-responsive">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Loved by Developers</h2>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-muted-foreground">4.8/5 (10K+ reviews)</span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm mb-4">"Perfect for coding on my commute. The mobile experience is incredibly smooth!"</p>
                  <p className="text-sm font-medium">- Alex K.</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm mb-4">"I can review and fix code from anywhere. Game changer for remote work!"</p>
                  <p className="text-sm font-medium">- Sarah M.</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm mb-4">"The best mobile IDE I've used. Syncs perfectly with desktop!"</p>
                  <p className="text-sm font-medium">- David L.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-responsive">
          <div className="container-responsive text-center">
            <h2 className="text-3xl font-bold mb-4">Start Coding on Mobile Today</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join millions of developers coding on the go
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="https://apps.apple.com/app/replit" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img 
                  src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg" 
                  alt="Download on the App Store"
                  className="h-14"
                />
              </a>
              <a 
                href="https://play.google.com/store/apps/details?id=com.replit.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img 
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                  alt="Get it on Google Play"
                  className="h-14"
                />
              </a>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}