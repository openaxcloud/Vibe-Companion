import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Download, Zap, Code, Globe, Shield } from 'lucide-react';

export default function Desktop() {
  const features = [
    {
      icon: Code,
      title: 'Offline Development',
      description: 'Code without an internet connection and sync when you reconnect',
    },
    {
      icon: Zap,
      title: 'Native Performance',
      description: 'Blazing fast performance with native desktop application',
    },
    {
      icon: Globe,
      title: 'Seamless Sync',
      description: 'All your projects sync automatically with the cloud',
    },
    {
      icon: Shield,
      title: 'Local Security',
      description: 'Your code stays on your machine with optional cloud backup',
    },
  ];

  const platforms = [
    { name: 'Windows', version: '10/11', icon: '🪟' },
    { name: 'macOS', version: '11+', icon: '🍎' },
    { name: 'Linux', version: 'Ubuntu 20.04+', icon: '🐧' },
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
                <Monitor className="h-3 w-3 mr-1" />
                Desktop App
              </Badge>
              <h1 className="text-responsive-xl font-bold mb-6">
                E-Code Desktop
              </h1>
              <p className="text-responsive-base text-muted-foreground mb-8">
                The full power of E-Code on your desktop. Code offline, sync online, and enjoy native performance.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Button size="lg" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download for Windows
                </Button>
                <Button size="lg" variant="outline">
                  Other Platforms
                </Button>
              </div>

              {/* Desktop App Preview */}
              <div className="relative mx-auto max-w-4xl">
                <div className="rounded-lg overflow-hidden shadow-2xl bg-slate-900">
                  <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 text-center text-sm text-slate-400">
                      E-Code Desktop - project.py
                    </div>
                  </div>
                  <div className="p-6">
                    <img 
                      src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=450&fit=crop" 
                      alt="E-Code Desktop App"
                      className="w-full rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-responsive">
          <div className="container-responsive">
            <h2 className="text-3xl font-bold text-center mb-12">Desktop Features</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title}>
                    <CardContent className="pt-6 text-center">
                      <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section className="py-responsive bg-muted">
          <div className="container-responsive">
            <h2 className="text-3xl font-bold text-center mb-12">Available on All Platforms</h2>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              {platforms.map((platform) => (
                <Card key={platform.name}>
                  <CardContent className="pt-6 text-center">
                    <div className="text-5xl mb-4">{platform.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{platform.name}</h3>
                    <p className="text-muted-foreground">Version {platform.version}</p>
                    <Button className="mt-4 w-full">
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* System Requirements */}
        <section className="py-responsive">
          <div className="container-responsive">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">System Requirements</h2>
              
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    🪟 Windows
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Windows 10 version 1909 or higher</li>
                    <li>• 4GB RAM (8GB recommended)</li>
                    <li>• 2GB available disk space</li>
                    <li>• 64-bit processor</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    🍎 macOS
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• macOS 11.0 or later</li>
                    <li>• 4GB RAM (8GB recommended)</li>
                    <li>• 2GB available disk space</li>
                    <li>• Apple Silicon or Intel processor</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    🐧 Linux
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Ubuntu 20.04 or equivalent</li>
                    <li>• 4GB RAM (8GB recommended)</li>
                    <li>• 2GB available disk space</li>
                    <li>• 64-bit processor</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-responsive bg-primary text-primary-foreground">
          <div className="container-responsive text-center">
            <h2 className="text-3xl font-bold mb-4">Download E-Code Desktop</h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Code anywhere, anytime. Online or offline.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                className="gap-2"
                onClick={() => window.location.href = '/api/login'}
              >
                <Download className="h-4 w-4" />
                Download Now
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => window.location.href = '/docs'}
              >
                View Documentation
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}