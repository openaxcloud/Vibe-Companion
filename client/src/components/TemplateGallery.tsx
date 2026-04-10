import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Code2, 
  Sparkles, 
  TrendingUp,
  Clock,
  Users,
  Star,
  GitFork,
  Zap,
  Globe,
  Database,
  Lock,
  Palette,
  ShoppingCart,
  MessageSquare,
  BarChart,
  Gamepad2,
  Music,
  Video,
  Map
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  popularity: number;
  tags: string[];
  icon: JSX.Element;
  prompt: string;
  preview?: string;
}

const TEMPLATES: Template[] = [
  // Web Development
  {
    id: 'portfolio-website',
    name: 'Portfolio Website',
    description: 'Professional portfolio with projects showcase, about section, and contact form',
    category: 'web',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 20,
    popularity: 95,
    tags: ['Portfolio', 'Responsive', 'Modern'],
    icon: <Globe className="h-5 w-5" />,
    prompt: 'Create a modern portfolio website with hero section, projects grid, about me, skills, and contact form with dark mode support'
  },
  {
    id: 'ecommerce-store',
    name: 'E-Commerce Store',
    description: 'Full-featured online store with cart, checkout, and payment integration',
    category: 'web',
    language: 'react',
    difficulty: 'advanced',
    estimatedTime: 45,
    popularity: 88,
    tags: ['E-commerce', 'Payments', 'Cart'],
    icon: <ShoppingCart className="h-5 w-5" />,
    prompt: 'Build an e-commerce store with product catalog, search, filters, shopping cart, checkout process, and Stripe payment integration'
  },
  {
    id: 'blog-platform',
    name: 'Blog Platform',
    description: 'Content management system with markdown support and commenting',
    category: 'web',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 30,
    popularity: 82,
    tags: ['Blog', 'CMS', 'Markdown'],
    icon: <MessageSquare className="h-5 w-5" />,
    prompt: 'Create a blog platform with markdown editor, categories, tags, search, comments, and user authentication'
  },
  
  // Data & Analytics
  {
    id: 'dashboard-analytics',
    name: 'Analytics Dashboard',
    description: 'Real-time data visualization dashboard with charts and metrics',
    category: 'data',
    language: 'react',
    difficulty: 'advanced',
    estimatedTime: 35,
    popularity: 91,
    tags: ['Dashboard', 'Charts', 'Real-time'],
    icon: <BarChart className="h-5 w-5" />,
    prompt: 'Build an analytics dashboard with real-time charts, KPI cards, data filters, export functionality, and responsive grid layout'
  },
  {
    id: 'crypto-tracker',
    name: 'Crypto Price Tracker',
    description: 'Cryptocurrency price tracker with portfolio management',
    category: 'data',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 25,
    popularity: 79,
    tags: ['Crypto', 'API', 'Real-time'],
    icon: <TrendingUp className="h-5 w-5" />,
    prompt: 'Create a cryptocurrency tracker with live prices, price charts, portfolio tracking, alerts, and news integration'
  },
  
  // AI & Automation
  {
    id: 'ai-chatbot',
    name: 'AI Chatbot Interface',
    description: 'Chat interface with AI integration and conversation history',
    category: 'ai',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 20,
    popularity: 94,
    tags: ['AI', 'Chat', 'OpenAI'],
    icon: <Sparkles className="h-5 w-5" />,
    prompt: 'Build an AI chatbot interface with message history, typing indicators, code highlighting, and OpenAI integration'
  },
  {
    id: 'image-generator',
    name: 'AI Image Generator',
    description: 'Text-to-image generator with gallery and download features',
    category: 'ai',
    language: 'react',
    difficulty: 'advanced',
    estimatedTime: 30,
    popularity: 87,
    tags: ['AI', 'Images', 'DALL-E'],
    icon: <Palette className="h-5 w-5" />,
    prompt: 'Create an AI image generator with prompt input, style options, image gallery, download functionality, and sharing features'
  },
  
  // Games & Entertainment
  {
    id: 'puzzle-game',
    name: '2048 Puzzle Game',
    description: 'Classic 2048 game with animations and high scores',
    category: 'games',
    language: 'javascript',
    difficulty: 'intermediate',
    estimatedTime: 25,
    popularity: 76,
    tags: ['Game', 'Puzzle', 'Animation'],
    icon: <Gamepad2 className="h-5 w-5" />,
    prompt: 'Build a 2048 puzzle game with smooth animations, score tracking, best score, undo functionality, and responsive controls'
  },
  {
    id: 'music-player',
    name: 'Music Player',
    description: 'Web-based music player with playlists and visualizer',
    category: 'entertainment',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 30,
    popularity: 83,
    tags: ['Music', 'Audio', 'Player'],
    icon: <Music className="h-5 w-5" />,
    prompt: 'Create a music player with playlist management, audio visualizer, shuffle, repeat, and keyboard controls'
  },
  
  // Productivity
  {
    id: 'task-manager',
    name: 'Task Management App',
    description: 'Kanban board with drag-and-drop and project organization',
    category: 'productivity',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 25,
    popularity: 89,
    tags: ['Kanban', 'Tasks', 'Drag-Drop'],
    icon: <Clock className="h-5 w-5" />,
    prompt: 'Build a task management app with Kanban board, drag-and-drop, priorities, due dates, labels, and project organization'
  },
  {
    id: 'note-taking',
    name: 'Note Taking App',
    description: 'Rich text editor with folders, tags, and search',
    category: 'productivity',
    language: 'react',
    difficulty: 'intermediate',
    estimatedTime: 20,
    popularity: 85,
    tags: ['Notes', 'Editor', 'Organization'],
    icon: <Database className="h-5 w-5" />,
    prompt: 'Create a note-taking app with rich text editor, folders, tags, search, markdown support, and export options'
  }
];

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: <Code2 className="h-4 w-4" /> },
  { id: 'web', name: 'Web Development', icon: <Globe className="h-4 w-4" /> },
  { id: 'data', name: 'Data & Analytics', icon: <BarChart className="h-4 w-4" /> },
  { id: 'ai', name: 'AI & Automation', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'games', name: 'Games', icon: <Gamepad2 className="h-4 w-4" /> },
  { id: 'entertainment', name: 'Entertainment', icon: <Music className="h-4 w-4" /> },
  { id: 'productivity', name: 'Productivity', icon: <Clock className="h-4 w-4" /> }
];

interface TemplateGalleryProps {
  onSelectTemplate: (template: Template) => void;
  className?: string;
}

export function TemplateGallery({ onSelectTemplate, className }: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  const filteredTemplates = TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-500';
      case 'intermediate': return 'text-yellow-500';
      case 'advanced': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Template Gallery</CardTitle>
        <CardDescription>
          Start with a pre-built template or customize your own
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-3 py-2 border rounded-md text-[13px]"
            aria-label="Filter by difficulty level"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {CATEGORIES.map(category => (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                className="flex items-center gap-2"
              >
                {category.icon}
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Template Grid */}
        <ScrollArea className="h-[600px]">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map(template => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => onSelectTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {template.icon}
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className={getDifficultyColor(template.difficulty)}>
                      {template.difficulty}
                    </Badge>
                  </div>
                  <CardDescription className="text-[13px] mt-1">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[11px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {template.estimatedTime} min
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {template.popularity}% popular
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No templates found matching your criteria.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}