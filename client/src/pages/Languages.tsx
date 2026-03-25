import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { 
  Code, 
  Search, 
  Zap, 
  Package, 
  Terminal, 
  Globe,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Coffee,
  Cpu,
  Database,
  Smartphone,
  Cloud,
  Gamepad2,
  BarChart
} from 'lucide-react';
import { Link } from 'wouter';

const languages = [
  {
    name: 'JavaScript',
    icon: <Globe className="h-8 w-8 text-yellow-500" />,
    category: 'web',
    popularity: 'Most Popular',
    description: 'Dynamic language for web development',
    features: ['Frontend & Backend', 'Node.js', 'React', 'NPM packages'],
    templates: 12,
    version: 'ES2023',
    color: 'bg-yellow-500'
  },
  {
    name: 'Python',
    icon: <Code className="h-8 w-8 text-blue-500" />,
    category: 'general',
    popularity: 'Most Popular',
    description: 'Versatile language for AI, data science, and web',
    features: ['Machine Learning', 'Data Analysis', 'Web Apps', 'Automation'],
    templates: 15,
    version: '3.11',
    color: 'bg-blue-500'
  },
  {
    name: 'TypeScript',
    icon: <Code className="h-8 w-8 text-blue-600" />,
    category: 'web',
    popularity: 'Popular',
    description: 'JavaScript with static typing',
    features: ['Type Safety', 'Modern JS', 'Better IDE Support', 'React/Angular'],
    templates: 10,
    version: '5.3',
    color: 'bg-blue-600'
  },
  {
    name: 'Java',
    icon: <Coffee className="h-8 w-8 text-red-600" />,
    category: 'general',
    popularity: 'Popular',
    description: 'Enterprise and Android development',
    features: ['Spring Boot', 'Android', 'Enterprise', 'Cross-platform'],
    templates: 8,
    version: 'Java 21',
    color: 'bg-red-600'
  },
  {
    name: 'Go',
    icon: <Zap className="h-8 w-8 text-cyan-500" />,
    category: 'backend',
    popularity: 'Popular',
    description: 'Fast and efficient systems programming',
    features: ['Cloud Native', 'Microservices', 'CLI Tools', 'High Performance'],
    templates: 7,
    version: '1.21',
    color: 'bg-cyan-500'
  },
  {
    name: 'Rust',
    icon: <Cpu className="h-8 w-8 text-orange-600" />,
    category: 'systems',
    popularity: 'Growing',
    description: 'Memory-safe systems programming',
    features: ['Memory Safety', 'WebAssembly', 'Systems', 'Performance'],
    templates: 6,
    version: '1.75',
    color: 'bg-orange-600'
  },
  {
    name: 'C++',
    icon: <Cpu className="h-8 w-8 text-blue-700" />,
    category: 'systems',
    popularity: 'Popular',
    description: 'High-performance systems and game development',
    features: ['Game Dev', 'Systems', 'Performance', 'Graphics'],
    templates: 5,
    version: 'C++23',
    color: 'bg-blue-700'
  },
  {
    name: 'Ruby',
    icon: <Sparkles className="h-8 w-8 text-red-500" />,
    category: 'web',
    popularity: 'Stable',
    description: 'Elegant language for web development',
    features: ['Ruby on Rails', 'Web Apps', 'Scripting', 'Developer Friendly'],
    templates: 6,
    version: '3.3',
    color: 'bg-red-500'
  },
  {
    name: 'PHP',
    icon: <Globe className="h-8 w-8 text-purple-600" />,
    category: 'web',
    popularity: 'Popular',
    description: 'Server-side web development',
    features: ['WordPress', 'Laravel', 'Web Apps', 'CMS'],
    templates: 7,
    version: '8.3',
    color: 'bg-purple-600'
  },
  {
    name: 'C#',
    icon: <Terminal className="h-8 w-8 text-purple-700" />,
    category: 'general',
    popularity: 'Popular',
    description: '.NET ecosystem and game development',
    features: ['Unity', '.NET', 'Web APIs', 'Desktop Apps'],
    templates: 8,
    version: '12.0',
    color: 'bg-purple-700'
  },
  {
    name: 'Swift',
    icon: <Smartphone className="h-8 w-8 text-orange-500" />,
    category: 'mobile',
    popularity: 'Popular',
    description: 'iOS and macOS development',
    features: ['iOS Apps', 'macOS', 'SwiftUI', 'Server-side'],
    templates: 5,
    version: '5.9',
    color: 'bg-orange-500'
  },
  {
    name: 'Kotlin',
    icon: <Smartphone className="h-8 w-8 text-purple-500" />,
    category: 'mobile',
    popularity: 'Growing',
    description: 'Modern Android development',
    features: ['Android', 'Multiplatform', 'Server-side', 'Coroutines'],
    templates: 5,
    version: '1.9',
    color: 'bg-purple-500'
  },
  {
    name: 'Dart',
    icon: <Smartphone className="h-8 w-8 text-blue-400" />,
    category: 'mobile',
    popularity: 'Growing',
    description: 'Flutter for cross-platform apps',
    features: ['Flutter', 'Cross-platform', 'Web Apps', 'Hot Reload'],
    templates: 4,
    version: '3.2',
    color: 'bg-blue-400'
  },
  {
    name: 'R',
    icon: <BarChart className="h-8 w-8 text-blue-500" />,
    category: 'data',
    popularity: 'Specialized',
    description: 'Statistical computing and graphics',
    features: ['Data Analysis', 'Statistics', 'Visualization', 'Machine Learning'],
    templates: 3,
    version: '4.3',
    color: 'bg-blue-500'
  },
  {
    name: 'SQL',
    icon: <Database className="h-8 w-8 text-green-600" />,
    category: 'data',
    popularity: 'Essential',
    description: 'Database query language',
    features: ['PostgreSQL', 'MySQL', 'SQLite', 'Data Analysis'],
    templates: 4,
    version: 'SQL:2023',
    color: 'bg-green-600'
  },
  {
    name: 'HTML/CSS',
    icon: <Globe className="h-8 w-8 text-orange-400" />,
    category: 'web',
    popularity: 'Essential',
    description: 'Web structure and styling',
    features: ['Websites', 'Responsive Design', 'CSS3', 'HTML5'],
    templates: 8,
    version: 'HTML5/CSS3',
    color: 'bg-orange-400'
  },
  {
    name: 'Bash',
    icon: <Terminal className="h-8 w-8 text-gray-600 dark:text-gray-400" />,
    category: 'scripting',
    popularity: 'Essential',
    description: 'Shell scripting and automation',
    features: ['Automation', 'System Admin', 'DevOps', 'CLI Tools'],
    templates: 3,
    version: '5.2',
    color: 'bg-gray-600'
  },
  {
    name: 'Lua',
    icon: <Gamepad2 className="h-8 w-8 text-blue-600" />,
    category: 'scripting',
    popularity: 'Specialized',
    description: 'Embedded scripting and game development',
    features: ['Game Scripting', 'Embedded', 'Roblox', 'Configuration'],
    templates: 2,
    version: '5.4',
    color: 'bg-blue-600'
  },
  {
    name: 'Haskell',
    icon: <Code className="h-8 w-8 text-purple-800" />,
    category: 'functional',
    popularity: 'Niche',
    description: 'Pure functional programming',
    features: ['Functional', 'Type Safety', 'Academic', 'Compiler'],
    templates: 2,
    version: 'GHC 9.8',
    color: 'bg-purple-800'
  },
  {
    name: 'Elixir',
    icon: <Cloud className="h-8 w-8 text-purple-600" />,
    category: 'backend',
    popularity: 'Growing',
    description: 'Scalable and fault-tolerant applications',
    features: ['Phoenix', 'Concurrent', 'Real-time', 'Fault-tolerant'],
    templates: 3,
    version: '1.15',
    color: 'bg-purple-600'
  },
  {
    name: 'C',
    icon: <Cpu className="h-8 w-8 text-gray-700 dark:text-gray-300" />,
    category: 'systems',
    popularity: 'Essential',
    description: 'Low-level systems programming',
    features: ['Operating Systems', 'Embedded', 'Performance', 'Hardware'],
    templates: 4,
    version: 'C23',
    color: 'bg-gray-700'
  },
  {
    name: 'Scala',
    icon: <Code className="h-8 w-8 text-red-700" />,
    category: 'general',
    popularity: 'Stable',
    description: 'JVM language for scalable applications',
    features: ['Spark', 'Functional', 'Big Data', 'Akka'],
    templates: 3,
    version: '3.3',
    color: 'bg-red-700'
  },
  {
    name: 'Julia',
    icon: <BarChart className="h-8 w-8 text-purple-500" />,
    category: 'data',
    popularity: 'Growing',
    description: 'High-performance scientific computing',
    features: ['Scientific Computing', 'Machine Learning', 'Data Science', 'Performance'],
    templates: 3,
    version: '1.10',
    color: 'bg-purple-500'
  },
  {
    name: 'Perl',
    icon: <Terminal className="h-8 w-8 text-blue-800" />,
    category: 'scripting',
    popularity: 'Stable',
    description: 'Text processing and system administration',
    features: ['Text Processing', 'System Admin', 'Web Dev', 'Bioinformatics'],
    templates: 2,
    version: '5.38',
    color: 'bg-blue-800'
  },
  {
    name: 'Clojure',
    icon: <Code className="h-8 w-8 text-green-700" />,
    category: 'functional',
    popularity: 'Niche',
    description: 'Functional programming on the JVM',
    features: ['JVM', 'Functional', 'LISP', 'Concurrent'],
    templates: 2,
    version: '1.11',
    color: 'bg-green-700'
  },
  {
    name: 'F#',
    icon: <Code className="h-8 w-8 text-blue-900" />,
    category: 'functional',
    popularity: 'Niche',
    description: 'Functional-first .NET language',
    features: ['.NET', 'Functional', 'Type Inference', 'Data Science'],
    templates: 2,
    version: '8.0',
    color: 'bg-blue-900'
  },
  {
    name: 'OCaml',
    icon: <Code className="h-8 w-8 text-orange-700" />,
    category: 'functional',
    popularity: 'Niche',
    description: 'Industrial-strength functional language',
    features: ['Functional', 'Type Safety', 'Performance', 'Compiler'],
    templates: 2,
    version: '5.1',
    color: 'bg-orange-700'
  },
  {
    name: 'Assembly',
    icon: <Cpu className="h-8 w-8 text-red-900" />,
    category: 'systems',
    popularity: 'Specialized',
    description: 'Machine-level programming',
    features: ['Low Level', 'Hardware', 'Optimization', 'Reverse Engineering'],
    templates: 1,
    version: 'x86-64',
    color: 'bg-red-900'
  },
  {
    name: 'MATLAB',
    icon: <BarChart className="h-8 w-8 text-orange-600" />,
    category: 'data',
    popularity: 'Specialized',
    description: 'Numerical computing and engineering',
    features: ['Engineering', 'Simulation', 'Signal Processing', 'Control Systems'],
    templates: 2,
    version: 'R2024a',
    color: 'bg-orange-600'
  },
  {
    name: 'Processing',
    icon: <Gamepad2 className="h-8 w-8 text-teal-600" />,
    category: 'creative',
    popularity: 'Specialized',
    description: 'Creative coding and visual arts',
    features: ['Graphics', 'Animation', 'Interactive Art', 'Education'],
    templates: 3,
    version: '4.3',
    color: 'bg-teal-600'
  },
  {
    name: 'Fortran',
    icon: <Cpu className="h-8 w-8 text-blue-700" />,
    category: 'scientific',
    popularity: 'Specialized',
    description: 'High-performance scientific computing',
    features: ['Scientific', 'HPC', 'Numerical', 'Engineering'],
    templates: 2,
    version: 'Fortran 2023',
    color: 'bg-blue-700'
  },
  {
    name: 'COBOL',
    icon: <Database className="h-8 w-8 text-green-800" />,
    category: 'legacy',
    popularity: 'Legacy',
    description: 'Business and financial systems',
    features: ['Banking', 'Enterprise', 'Mainframe', 'Legacy Systems'],
    templates: 1,
    version: 'COBOL 2023',
    color: 'bg-green-800'
  },
  {
    name: 'Erlang',
    icon: <Cloud className="h-8 w-8 text-red-600" />,
    category: 'backend',
    popularity: 'Specialized',
    description: 'Concurrent and distributed systems',
    features: ['Telecom', 'WhatsApp', 'Fault-tolerant', 'Distributed'],
    templates: 2,
    version: 'OTP 26',
    color: 'bg-red-600'
  },
  {
    name: 'Nim',
    icon: <Zap className="h-8 w-8 text-yellow-600" />,
    category: 'systems',
    popularity: 'Growing',
    description: 'Efficient and expressive systems language',
    features: ['Compiled', 'Python-like', 'Performance', 'Metaprogramming'],
    templates: 2,
    version: '2.0',
    color: 'bg-yellow-600'
  },
  {
    name: 'Crystal',
    icon: <Sparkles className="h-8 w-8 text-black" />,
    category: 'web',
    popularity: 'Growing',
    description: 'Ruby-like syntax with C performance',
    features: ['Ruby-like', 'Compiled', 'Type Safe', 'Web Apps'],
    templates: 2,
    version: '1.11',
    color: 'bg-black'
  },
  {
    name: 'Zig',
    icon: <Cpu className="h-8 w-8 text-orange-500" />,
    category: 'systems',
    popularity: 'Growing',
    description: 'Modern systems programming',
    features: ['No Hidden Control Flow', 'Comptime', 'C Interop', 'Performance'],
    templates: 2,
    version: '0.12',
    color: 'bg-orange-500'
  }
];

const categories = [
  { id: 'all', name: 'All Languages', count: languages.length },
  { id: 'web', name: 'Web Development', count: languages.filter(l => l.category === 'web').length },
  { id: 'backend', name: 'Backend', count: languages.filter(l => l.category === 'backend').length },
  { id: 'mobile', name: 'Mobile', count: languages.filter(l => l.category === 'mobile').length },
  { id: 'data', name: 'Data Science', count: languages.filter(l => l.category === 'data').length },
  { id: 'systems', name: 'Systems', count: languages.filter(l => l.category === 'systems').length },
  { id: 'scripting', name: 'Scripting', count: languages.filter(l => l.category === 'scripting').length },
  { id: 'functional', name: 'Functional', count: languages.filter(l => l.category === 'functional').length },
  { id: 'general', name: 'General Purpose', count: languages.filter(l => l.category === 'general').length },
  { id: 'creative', name: 'Creative Coding', count: languages.filter(l => l.category === 'creative').length },
  { id: 'scientific', name: 'Scientific', count: languages.filter(l => l.category === 'scientific').length },
  { id: 'legacy', name: 'Legacy', count: languages.filter(l => l.category === 'legacy').length }
];

export default function Languages() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = languages.filter(lang => {
    const matchesCategory = selectedCategory === 'all' || lang.category === selectedCategory;
    const matchesSearch = lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lang.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lang.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-languages">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="py-responsive bg-gradient-subtle">
        <div className="container-responsive">
          <div className="flex items-center gap-2 mb-4">
            <Code className="h-5 w-5 text-primary" />
            <Badge variant="secondary" data-testid="badge-languages-count">{languages.length}+ Languages</Badge>
          </div>
          
          <h1 className="text-responsive-2xl font-bold tracking-tight mb-4" data-testid="text-languages-title">
            Programming Languages on E-Code
          </h1>
          
          <p className="text-responsive-base text-muted-foreground max-w-3xl mb-6" data-testid="text-languages-description">
            Code in your favorite language with zero setup. E-Code supports all major programming 
            languages with pre-configured environments, package managers, and debugging tools.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" data-testid="button-browse-templates">
              <Link href="/templates">Browse Templates</Link>
            </Button>
            <Button variant="outline" asChild size="lg" data-testid="button-view-docs">
              <Link href="/docs">View Documentation</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-responsive border-b">
        <div className="container-responsive">
          <div className="space-y-6">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search languages, features, or frameworks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-language-search"
              />
            </div>

            {/* Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="flex-wrap h-auto p-1">
                {categories.map(cat => (
                  <TabsTrigger key={cat.id} value={cat.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid={`tab-category-${cat.id}`}>
                    {cat.name} ({cat.count})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Languages Grid */}
      <section className="py-responsive">
        <div className="container-responsive">
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredLanguages.map((language, langIndex) => (
              <Card key={language.name} className="group hover:shadow-lg transition-all hover:-translate-y-1" data-testid={`card-language-${language.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-3 rounded-lg ${language.color} bg-opacity-10`}>
                      {language.icon}
                    </div>
                    <Badge variant="secondary" className="text-[11px]" data-testid={`badge-language-version-${langIndex}`}>
                      {language.version}
                    </Badge>
                  </div>
                  <CardTitle className="text-[15px] flex items-center justify-between" data-testid={`text-language-name-${langIndex}`}>
                    {language.name}
                    <Badge 
                      variant={language.popularity === 'Most Popular' ? 'default' : 'outline'}
                      className="text-[11px]"
                      data-testid={`badge-language-popularity-${langIndex}`}
                    >
                      {language.popularity}
                    </Badge>
                  </CardTitle>
                  <CardDescription data-testid={`text-language-description-${langIndex}`}>{language.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {language.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[13px]">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground" data-testid={`text-language-templates-${langIndex}`}>
                      {language.templates} templates
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      asChild
                      className="group-hover:bg-primary group-hover:text-primary-foreground"
                      data-testid={`button-start-coding-${language.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    >
                      <Link href={`/templates?language=${language.name.toLowerCase()}`}>
                        Start coding
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredLanguages.length === 0 && (
            <div className="text-center py-12" data-testid="text-no-languages-found">
              <p className="text-muted-foreground">No languages found matching your search.</p>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-responsive bg-muted/30">
        <div className="container-responsive">
          <h2 className="text-2xl font-semibold mb-8 text-center">
            Every Language Comes With
          </h2>
          
          <div className="grid md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Package className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-[15px]">Package Managers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted-foreground">
                  npm, pip, cargo, gem, and more. Install any package with one click.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-[15px]">Instant Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted-foreground">
                  No installation needed. Start coding immediately in your browser.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Terminal className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-[15px]">Full Terminal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted-foreground">
                  Complete shell access with all the tools you need for development.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Sparkles className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-[15px]">AI Assistance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted-foreground">
                  Get intelligent code completion and debugging help in any language.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-responsive border-t">
        <div className="container-responsive text-center">
          <h2 className="text-2xl font-semibold mb-4">Can't Find Your Language?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            We're always adding support for new languages and frameworks. Let us know what you need, 
            or use our Nix integration to install any language or tool.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link href="/community">Request a Language</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">Learn About Nix</Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}