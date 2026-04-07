import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  TrendingUp,
  Star,
  GitFork,
  Clock,
  Filter,
  Globe,
  Code2,
  Gamepad2,
  Palette,
  Database,
  Cpu,
  BookOpen,
  Music,
  Video,
  Shield,
} from 'lucide-react';

// Language categories and icons
const categories = [
  { id: 'all', name: 'All', icon: Globe },
  { id: 'web', name: 'Web', icon: Globe },
  { id: 'games', name: 'Games', icon: Gamepad2 },
  { id: 'art', name: 'Art', icon: Palette },
  { id: 'data', name: 'Data Science', icon: Database },
  { id: 'ai', name: 'AI/ML', icon: Cpu },
  { id: 'education', name: 'Education', icon: BookOpen },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'video', name: 'Video', icon: Video },
  { id: 'security', name: 'Security', icon: Shield },
];

// Mock data for public repls
const publicRepls = [
  {
    id: 1,
    name: 'AI Chat Assistant',
    author: 'ai_master',
    avatar: null,
    description: 'GPT-powered chat assistant with streaming responses and memory',
    language: 'Python',
    category: 'ai',
    stars: 1234,
    forks: 234,
    runs: 45678,
    lastUpdated: '2 hours ago',
    tags: ['openai', 'chatgpt', 'streaming'],
  },
  {
    id: 2,
    name: '3D Physics Sandbox',
    author: 'game_dev_pro',
    avatar: null,
    description: 'Interactive 3D physics simulation with Three.js',
    language: 'JavaScript',
    category: 'games',
    stars: 890,
    forks: 156,
    runs: 23456,
    lastUpdated: '5 hours ago',
    tags: ['threejs', 'physics', 'webgl'],
  },
  {
    id: 3,
    name: 'Real-time Collaborative Whiteboard',
    author: 'collab_king',
    avatar: null,
    description: 'Multi-user whiteboard with WebRTC and Socket.io',
    language: 'TypeScript',
    category: 'web',
    stars: 567,
    forks: 89,
    runs: 12345,
    lastUpdated: '1 day ago',
    tags: ['webrtc', 'socketio', 'collaboration'],
  },
  {
    id: 4,
    name: 'Stock Market Analyzer',
    author: 'data_wizard',
    avatar: null,
    description: 'Real-time stock analysis with predictive models',
    language: 'Python',
    category: 'data',
    stars: 789,
    forks: 167,
    runs: 34567,
    lastUpdated: '3 hours ago',
    tags: ['pandas', 'matplotlib', 'finance'],
  },
  {
    id: 5,
    name: 'Music Visualizer',
    author: 'sound_artist',
    avatar: null,
    description: 'Audio-reactive visualizations with Web Audio API',
    language: 'JavaScript',
    category: 'music',
    stars: 456,
    forks: 78,
    runs: 8901,
    lastUpdated: '12 hours ago',
    tags: ['webaudio', 'canvas', 'visualization'],
  },
  {
    id: 6,
    name: 'Neural Style Transfer',
    author: 'ml_enthusiast',
    avatar: null,
    description: 'Transform images with artistic style transfer',
    language: 'Python',
    category: 'art',
    stars: 678,
    forks: 123,
    runs: 15678,
    lastUpdated: '6 hours ago',
    tags: ['tensorflow', 'neural-networks', 'art'],
  },
];

export default function Explore() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      'JavaScript': 'bg-yellow-500',
      'TypeScript': 'bg-blue-500',
      'Python': 'bg-green-500',
      'Java': 'bg-orange-500',
      'Go': 'bg-cyan-500',
      'Rust': 'bg-red-500',
      'C++': 'bg-purple-500',
      'Ruby': 'bg-pink-500',
    };
    return colors[language] || 'bg-gray-500';
  };

  const filteredRepls = publicRepls.filter(repl => {
    const matchesSearch = repl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         repl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         repl.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || repl.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedRepls = [...filteredRepls].sort((a, b) => {
    switch (sortBy) {
      case 'trending':
        return b.runs - a.runs;
      case 'popular':
        return b.stars - a.stars;
      case 'recent':
        return 0; // Would use actual date comparison
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Explore Community</h1>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search repls, tags, or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="recent">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-4 overflow-x-auto">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Repls</p>
                  <p className="text-2xl font-bold">12,345</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">3,456</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Runs</p>
                  <p className="text-2xl font-bold">456K</p>
                </div>
                <Globe className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Languages</p>
                  <p className="text-2xl font-bold">50+</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Repls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRepls.map((repl) => {
            const CategoryIcon = categories.find(c => c.id === repl.category)?.icon || Globe;
            return (
              <Card 
                key={repl.id} 
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/repl/${repl.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={repl.avatar || undefined} />
                        <AvatarFallback>{repl.author[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{repl.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">by {repl.author}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`${getLanguageColor(repl.language)}`}>
                      {repl.language}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {repl.description}
                  </p>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {repl.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repl.stars}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {repl.forks}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {repl.runs}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {repl.lastUpdated}
                    </span>
                  </div>
                  
                  {/* Category */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {categories.find(c => c.id === repl.category)?.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {sortedRepls.length === 0 && (
          <div className="text-center py-12">
            <Code2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No repls found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}