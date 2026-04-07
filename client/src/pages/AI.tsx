import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Code, Sparkles, Zap, MessageSquare, FileCode, Rocket, Shield } from 'lucide-react';

export default function AI() {
  const features = [
    {
      icon: Brain,
      title: 'Smart Code Completion',
      description: 'AI-powered suggestions that understand your code context and patterns',
    },
    {
      icon: MessageSquare,
      title: 'Natural Language to Code',
      description: 'Describe what you want in plain English and watch it transform into code',
    },
    {
      icon: FileCode,
      title: 'Code Explanation',
      description: 'Get instant explanations for any code snippet in simple terms',
    },
    {
      icon: Sparkles,
      title: 'Bug Detection',
      description: 'AI automatically identifies and suggests fixes for potential bugs',
    },
    {
      icon: Zap,
      title: 'Refactoring Assistant',
      description: 'Optimize your code with AI-powered refactoring suggestions',
    },
    {
      icon: Shield,
      title: 'Security Analysis',
      description: 'Detect security vulnerabilities before they become problems',
    },
  ];

  const useCases = [
    {
      title: 'For Beginners',
      description: 'Learn to code faster with AI guidance and explanations',
      benefits: ['Step-by-step tutorials', 'Code explanations', 'Error help'],
    },
    {
      title: 'For Professionals',
      description: 'Boost productivity with advanced AI coding assistance',
      benefits: ['Complex refactoring', 'Architecture suggestions', 'Performance optimization'],
    },
    {
      title: 'For Teams',
      description: 'Maintain code quality and consistency across your team',
      benefits: ['Code review assistance', 'Style enforcement', 'Documentation generation'],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-responsive bg-gradient-to-b from-background to-muted">
          <div className="container-responsive">
            <div className="text-center max-w-4xl mx-auto">
              <Badge className="mb-4" variant="secondary">
                <Sparkles className="h-3 w-3 mr-1" />
                Powered by Advanced AI
              </Badge>
              <h1 className="text-responsive-xl font-bold mb-6">
                AI That Codes With You
              </h1>
              <p className="text-responsive-base text-muted-foreground mb-8">
                Experience the future of coding with E-Code AI. Get intelligent code suggestions, 
                explanations, and assistance that adapts to your coding style.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Button size="lg" onClick={() => window.location.href = '/auth'}>
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline">
                  Watch Demo
                </Button>
              </div>

              {/* AI Demo Preview */}
              <div className="relative rounded-lg overflow-hidden shadow-2xl">
                <div className="bg-slate-900 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="font-mono text-sm text-left">
                    <div className="text-green-400">// AI: What would you like to create?</div>
                    <div className="text-white mt-2">User: Create a function that calculates fibonacci numbers</div>
                    <div className="text-blue-400 mt-4">
                      <div>function fibonacci(n) {'{'}</div>
                      <div className="ml-4">if (n {'<='} 1) return n;</div>
                      <div className="ml-4">return fibonacci(n - 1) + fibonacci(n - 2);</div>
                      <div>{'}'}</div>
                    </div>
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
              <h2 className="text-3xl font-bold mb-4">AI-Powered Features</h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to code smarter, not harder
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

        {/* Use Cases */}
        <section className="py-responsive bg-muted">
          <div className="container-responsive">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Built for Everyone</h2>
              <p className="text-lg text-muted-foreground">
                Whether you're learning or building production apps
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {useCases.map((useCase) => (
                <Card key={useCase.title}>
                  <CardHeader>
                    <CardTitle>{useCase.title}</CardTitle>
                    <CardDescription>{useCase.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {useCase.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Code className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                          <span className="text-sm">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-responsive">
          <div className="container-responsive">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Trusted by Millions</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-primary">10M+</div>
                <div className="text-muted-foreground">Code completions daily</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">50K+</div>
                <div className="text-muted-foreground">Bugs prevented</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">99%</div>
                <div className="text-muted-foreground">Accuracy rate</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary">2M+</div>
                <div className="text-muted-foreground">Happy developers</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-responsive bg-primary text-primary-foreground">
          <div className="container-responsive text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Code with AI?</h2>
            <p className="text-lg mb-8 opacity-90">
              Start your free trial and experience the future of coding
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => window.location.href = '/auth'}
              >
                Start Free Trial
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => window.location.href = '/pricing'}
              >
                View Pricing
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}