import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Code, FileText, Package, Zap, Terminal, Database, Globe, 
  Cpu, GitBranch, Layers, Search, Plus, ExternalLink 
} from 'lucide-react';
import * as Icons from 'react-icons/si';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  icon: string;
  features: string[];
  dependencies: string[];
  setupTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const templates: Template[] = [
  {
    id: 'react-typescript',
    name: 'React + TypeScript',
    description: 'Modern React app with TypeScript, Vite, and Tailwind CSS',
    category: 'Frontend',
    language: 'TypeScript',
    icon: 'SiReact',
    features: ['Hot Module Replacement', 'TypeScript', 'Tailwind CSS', 'ESLint'],
    dependencies: ['react', 'vite', 'typescript', 'tailwindcss'],
    setupTime: '30s',
    difficulty: 'beginner'
  },
  {
    id: 'nextjs-app',
    name: 'Next.js App',
    description: 'Full-stack Next.js application with App Router',
    category: 'Full Stack',
    language: 'TypeScript',
    icon: 'SiNextdotjs',
    features: ['App Router', 'Server Components', 'API Routes', 'Tailwind CSS'],
    dependencies: ['next', 'react', 'typescript', 'tailwindcss'],
    setupTime: '45s',
    difficulty: 'intermediate'
  },
  {
    id: 'express-api',
    name: 'Express API',
    description: 'RESTful API with Express.js and MongoDB',
    category: 'Backend',
    language: 'JavaScript',
    icon: 'SiExpress',
    features: ['REST API', 'MongoDB', 'JWT Auth', 'Middleware'],
    dependencies: ['express', 'mongoose', 'jsonwebtoken', 'bcrypt'],
    setupTime: '20s',
    difficulty: 'intermediate'
  },
  {
    id: 'python-flask',
    name: 'Flask Web App',
    description: 'Python web application with Flask and SQLAlchemy',
    category: 'Backend',
    language: 'Python',
    icon: 'SiFlask',
    features: ['Flask', 'SQLAlchemy', 'Jinja2', 'Authentication'],
    dependencies: ['flask', 'sqlalchemy', 'flask-login', 'python-dotenv'],
    setupTime: '25s',
    difficulty: 'beginner'
  },
  {
    id: 'django-rest',
    name: 'Django REST API',
    description: 'Django REST framework with PostgreSQL',
    category: 'Backend',
    language: 'Python',
    icon: 'SiDjango',
    features: ['REST API', 'PostgreSQL', 'Authentication', 'Admin Panel'],
    dependencies: ['django', 'djangorestframework', 'psycopg2', 'django-cors-headers'],
    setupTime: '40s',
    difficulty: 'advanced'
  },
  {
    id: 'vue-composition',
    name: 'Vue 3 + Composition API',
    description: 'Vue 3 app with Composition API and Pinia',
    category: 'Frontend',
    language: 'TypeScript',
    icon: 'SiVuedotjs',
    features: ['Composition API', 'Pinia', 'Vue Router', 'TypeScript'],
    dependencies: ['vue', 'pinia', 'vue-router', 'typescript'],
    setupTime: '35s',
    difficulty: 'intermediate'
  },
  {
    id: 'svelte-kit',
    name: 'SvelteKit App',
    description: 'Full-stack SvelteKit application',
    category: 'Full Stack',
    language: 'JavaScript',
    icon: 'SiSvelte',
    features: ['SSR/SSG', 'File-based routing', 'Adapters', 'TypeScript'],
    dependencies: ['@sveltejs/kit', 'svelte', 'vite', '@sveltejs/adapter-auto'],
    setupTime: '30s',
    difficulty: 'intermediate'
  },
  {
    id: 'rust-actix',
    name: 'Rust Actix Web',
    description: 'High-performance web server with Actix',
    category: 'Backend',
    language: 'Rust',
    icon: 'SiRust',
    features: ['Async/Await', 'Type Safety', 'Performance', 'WebSockets'],
    dependencies: ['actix-web', 'tokio', 'serde', 'sqlx'],
    setupTime: '50s',
    difficulty: 'advanced'
  },
  {
    id: 'go-gin',
    name: 'Go Gin API',
    description: 'RESTful API with Gin framework',
    category: 'Backend',
    language: 'Go',
    icon: 'SiGo',
    features: ['Fast Router', 'Middleware', 'JSON Validation', 'GORM'],
    dependencies: ['gin', 'gorm', 'jwt-go', 'viper'],
    setupTime: '25s',
    difficulty: 'intermediate'
  },
  {
    id: 'ruby-rails',
    name: 'Ruby on Rails',
    description: 'Full-stack Rails application with PostgreSQL',
    category: 'Full Stack',
    language: 'Ruby',
    icon: 'SiRubyonrails',
    features: ['MVC', 'Active Record', 'Action Cable', 'Turbo'],
    dependencies: ['rails', 'pg', 'devise', 'redis'],
    setupTime: '60s',
    difficulty: 'intermediate'
  }
];

const categories = ['All', 'Frontend', 'Backend', 'Full Stack'];
const languages = ['All', 'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Ruby'];

export function LanguageTemplates({ onSelectTemplate }: { onSelectTemplate: (template: Template) => void }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesLanguage = selectedLanguage === 'All' || template.language === selectedLanguage;
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesLanguage && matchesSearch;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'default';
      case 'intermediate': return 'secondary';
      case 'advanced': return 'destructive';
      default: return 'outline';
    }
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-8 w-8" /> : <Code className="h-8 w-8" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Language Templates</h2>
        <p className="text-muted-foreground">
          Start your project with a pre-configured template
        </p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList>
            {categories.map(category => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-2 flex-wrap">
          {languages.map(language => (
            <Button
              key={language}
              size="sm"
              variant={selectedLanguage === language ? 'default' : 'outline'}
              onClick={() => setSelectedLanguage(language)}
            >
              {language}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <ScrollArea className="h-[600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-muted">
                    {getIcon(template.icon)}
                  </div>
                  <Badge variant={getDifficultyColor(template.difficulty)}>
                    {template.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-[15px] mt-3">{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Terminal className="h-4 w-4" />
                  <span>{template.language}</span>
                  <span>•</span>
                  <Zap className="h-4 w-4" />
                  <span>{template.setupTime}</span>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {template.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-[11px]">
                      {feature}
                    </Badge>
                  ))}
                  {template.features.length > 3 && (
                    <Badge variant="outline" className="text-[11px]">
                      +{template.features.length - 3}
                    </Badge>
                  )}
                </div>

                <Button className="w-full" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No templates found</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Try adjusting your filters or search query
          </p>
        </div>
      )}
    </div>
  );
}