import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LazyMotionDiv } from '@/lib/motion';
import { 
  Monitor, 
  Download, 
  Apple, 
  Chrome,
  Zap,
  Shield,
  Globe,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Code2,
  Terminal,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Package,
  Lock,
  RefreshCw,
  Command
} from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';

interface OSInfo {
  name: string;
  icon: React.ElementType;
  version: string;
  size: string;
  downloadUrl: string;
  beta?: boolean;
}

export default function Desktop() {
  const [selectedOS, setSelectedOS] = useState<'mac' | 'windows' | 'linux'>('mac');

  const osOptions: Record<string, OSInfo> = {
    mac: {
      name: 'macOS',
      icon: Apple,
      version: '2.0.1',
      size: '124 MB',
      downloadUrl: '#',
      beta: false
    },
    windows: {
      name: 'Windows',
      icon: Monitor,
      version: '2.0.1',
      size: '156 MB',
      downloadUrl: '#',
      beta: false
    },
    linux: {
      name: 'Linux',
      icon: Terminal,
      version: '2.0.1',
      size: '112 MB',
      downloadUrl: '#',
      beta: false
    }
  };

  const features = [
    {
      icon: WifiOff,
      title: 'Offline Development',
      description: 'Code without internet. All your projects sync when you reconnect.'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Native performance with instant file operations and zero latency.'
    },
    {
      icon: Shield,
      title: 'Enhanced Security',
      description: 'Your code stays on your machine with enterprise-grade encryption.'
    },
    {
      icon: Package,
      title: 'Local Packages',
      description: 'Install and manage packages locally with cached dependencies.'
    },
    {
      icon: Globe,
      title: 'Cloud Sync',
      description: 'Seamlessly sync projects between desktop and web.'
    },
    {
      icon: Cpu,
      title: 'Full System Access',
      description: 'Access local files, run system commands, and use native APIs.'
    }
  ];

  const requirements = {
    mac: [
      'macOS 10.15 (Catalina) or later',
      'Apple Silicon or Intel processor',
      '4GB RAM minimum (8GB recommended)',
      '500MB available disk space'
    ],
    windows: [
      'Windows 10 version 1909 or later',
      '64-bit processor',
      '4GB RAM minimum (8GB recommended)',
      '500MB available disk space'
    ],
    linux: [
      'Ubuntu 20.04, Fedora 33, Debian 10, or later',
      'x64 architecture',
      '4GB RAM minimum (8GB recommended)',
      '500MB available disk space'
    ]
  };

  const shortcuts = [
    { keys: ['⌘', 'K'], description: 'Open command palette' },
    { keys: ['⌘', 'P'], description: 'Quick file open' },
    { keys: ['⌘', 'Shift', 'P'], description: 'Create new project' },
    { keys: ['⌘', 'B'], description: 'Toggle sidebar' },
    { keys: ['⌘', 'J'], description: 'Toggle terminal' },
    { keys: ['⌘', 'S'], description: 'Save file' },
    { keys: ['⌘', 'Shift', 'S'], description: 'Save all files' },
    { keys: ['⌘', 'R'], description: 'Run project' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="container-responsive relative">
          <div className="text-center max-w-4xl mx-auto">
            <LazyMotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="default" className="mb-4 text-[13px] px-4 py-1">
                <Sparkles className="h-4 w-4 mr-1" />
                NOW AVAILABLE
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                E-Code for
                <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Desktop
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
                The power of E-Code, now native on your machine. Code offline, 
                sync everywhere, with all the features you love.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-[15px] px-8" data-testid="button-download-hero" onClick={() => {
                  const os = osOptions[selectedOS];
                  window.location.href = os.downloadUrl;
                }}>
                  <Download className="mr-2 h-5 w-5" />
                  Download for {osOptions[selectedOS].name}
                </Button>
                <Button size="lg" variant="outline" asChild className="text-[15px] px-8" data-testid="button-learn-more">
                  <Link href="#features">
                    Learn More
                  </Link>
                </Button>
              </div>

              <p className="text-[13px] text-muted-foreground mt-4">
                Version {osOptions[selectedOS].version} • {osOptions[selectedOS].size}
                {osOptions[selectedOS].beta && (
                  <Badge variant="secondary" className="ml-2">Beta</Badge>
                )}
              </p>
            </LazyMotionDiv>
          </div>

          {/* OS Selector */}
          <div className="mt-12 flex justify-center gap-4">
            {Object.entries(osOptions).map(([key, os]) => {
              const Icon = os.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedOS(key as any)}
                  data-testid={`button-os-${key}`}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedOS === key
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-muted-foreground'
                  }`}
                >
                  <Icon className="h-8 w-8" />
                  <p className="text-[13px] mt-2">{os.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Screenshot */}
      <section className="py-20 bg-muted/30">
        <div className="container-responsive">
          <LazyMotionDiv
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative rounded-xl overflow-hidden shadow-2xl"
          >
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-1">
              <div className="bg-background rounded-lg">
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 text-center text-[13px] text-muted-foreground">
                    E-Code Desktop - my-awesome-project
                  </div>
                </div>
                <div className="aspect-[16/10] bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                  <Code2 className="h-24 w-24 text-gray-600" />
                </div>
              </div>
            </div>
          </LazyMotionDiv>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Desktop-Powered Features
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-2xl mx-auto">
              Everything you need for professional development, now with native performance
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="animate-slide-in-up opacity-0"
                  style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-muted/30">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Desktop vs Web
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Choose the experience that fits your workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="h-8 w-8 text-primary" />
                  <CardTitle className="text-2xl">Desktop App</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Work offline with full functionality</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Native file system access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>System-level integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Local package caching</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>No browser limitations</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <Chrome className="h-8 w-8 text-primary" />
                  <CardTitle className="text-2xl">Web App</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Access from any device</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>No installation required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Always up to date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Real-time collaboration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Cloud-based computing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Badge variant="outline" className="text-base px-4 py-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Projects sync seamlessly between desktop and web
            </Badge>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Keyboard First
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Navigate at the speed of thought with powerful shortcuts
            </p>
          </div>

          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Essential Shortcuts</CardTitle>
              <CardDescription>
                {selectedOS === 'mac' ? 'macOS' : selectedOS === 'windows' ? 'Windows (Ctrl)' : 'Linux (Ctrl)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.description} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="text-[13px]">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, index) => (
                        <kbd
                          key={index}
                          className="px-2 py-1 text-[11px] bg-background border rounded"
                        >
                          {selectedOS !== 'mac' && key === '⌘' ? 'Ctrl' : key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* System Requirements */}
      <section className="py-20 bg-muted/30">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              System Requirements
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {Object.entries(requirements).map(([os, reqs]) => {
              const Icon = osOptions[os].icon;
              return (
                <Card key={os} className={selectedOS === os ? 'ring-2 ring-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6" />
                      <CardTitle>{osOptions[os].name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reqs.map((req, index) => (
                        <li key={index} className="text-[13px] text-muted-foreground">
                          • {req}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20">
        <div className="container-responsive">
          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-2">
              <CardContent className="p-8 md:p-12">
                <Lock className="h-12 w-12 text-primary mb-6" />
                <h2 className="text-3xl font-bold mb-4">
                  Enterprise-Grade Security
                </h2>
                <p className="text-muted-foreground mb-6">
                  Your code and data are protected with industry-leading security standards.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>End-to-end encryption for all data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Code signing and integrity verification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Secure credential storage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Regular security updates</span>
                  </li>
                </ul>
              </CardContent>
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 p-8 md:p-12 flex items-center justify-center">
                <Shield className="h-32 w-32 text-gray-400" />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Code Natively?
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8">
              Download E-Code Desktop and experience the future of development
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" data-testid="button-download-cta" onClick={() => {
                const os = osOptions[selectedOS];
                window.location.href = os.downloadUrl;
              }}>
                <Download className="mr-2 h-5 w-5" />
                Download for {osOptions[selectedOS].name}
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-view-docs">
                <Link href="/docs/desktop">
                  View Documentation
                </Link>
              </Button>
            </div>
            <p className="text-[13px] text-muted-foreground mt-6">
              Free to use • No credit card required • Syncs with your E-Code account
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}