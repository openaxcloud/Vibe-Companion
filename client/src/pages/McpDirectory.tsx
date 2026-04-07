import { useState } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plug, Database, Globe, Cloud, Code, Bot, Shield,
  Mail, FileText, BarChart, Palette, ArrowRight, Star,
  Package, Terminal, Zap
} from 'lucide-react';
import { Link } from 'wouter';

interface McpServer {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  stars: number;
  official: boolean;
  tags: string[];
}

const mcpServers: McpServer[] = [
  { id: 'filesystem', name: 'Filesystem', description: 'Read, write, and manage files and directories on the local filesystem with comprehensive file operation support.', category: 'Core', icon: <FileText className="h-5 w-5" />, stars: 4200, official: true, tags: ['files', 'io', 'core'] },
  { id: 'postgres', name: 'PostgreSQL', description: 'Connect to PostgreSQL databases. Run queries, manage schemas, and inspect table structures.', category: 'Database', icon: <Database className="h-5 w-5" />, stars: 3800, official: true, tags: ['database', 'sql', 'postgres'] },
  { id: 'github', name: 'GitHub', description: 'Interact with GitHub repositories, issues, pull requests, and actions directly from your IDE.', category: 'DevTools', icon: <Code className="h-5 w-5" />, stars: 5100, official: true, tags: ['git', 'vcs', 'ci/cd'] },
  { id: 'web-search', name: 'Web Search', description: 'Search the web using multiple search engines. Get real-time results for documentation and research.', category: 'Web', icon: <Globe className="h-5 w-5" />, stars: 2900, official: true, tags: ['search', 'web', 'research'] },
  { id: 'slack', name: 'Slack', description: 'Send messages, manage channels, and interact with Slack workspaces programmatically.', category: 'Communication', icon: <Mail className="h-5 w-5" />, stars: 2100, official: false, tags: ['chat', 'messaging', 'team'] },
  { id: 'docker', name: 'Docker', description: 'Manage Docker containers, images, and compose stacks directly from the IDE environment.', category: 'DevOps', icon: <Package className="h-5 w-5" />, stars: 1800, official: false, tags: ['containers', 'devops', 'deploy'] },
  { id: 'openai', name: 'OpenAI', description: 'Access GPT models, DALL-E image generation, and embeddings through the OpenAI API.', category: 'AI', icon: <Bot className="h-5 w-5" />, stars: 4500, official: true, tags: ['ai', 'llm', 'gpt'] },
  { id: 'aws', name: 'AWS', description: 'Manage AWS services including S3, Lambda, EC2, and CloudFormation from your editor.', category: 'Cloud', icon: <Cloud className="h-5 w-5" />, stars: 2600, official: false, tags: ['cloud', 'aws', 'infrastructure'] },
  { id: 'sentry', name: 'Sentry', description: 'Monitor errors, track performance issues, and manage releases with Sentry integration.', category: 'Monitoring', icon: <Shield className="h-5 w-5" />, stars: 1500, official: false, tags: ['monitoring', 'errors', 'apm'] },
  { id: 'stripe', name: 'Stripe', description: 'Manage payments, subscriptions, and billing through the Stripe API for your applications.', category: 'Payments', icon: <BarChart className="h-5 w-5" />, stars: 1900, official: false, tags: ['payments', 'billing', 'saas'] },
  { id: 'figma', name: 'Figma', description: 'Access Figma designs, extract components, and sync design tokens with your codebase.', category: 'Design', icon: <Palette className="h-5 w-5" />, stars: 2200, official: true, tags: ['design', 'ui', 'tokens'] },
  { id: 'terminal', name: 'Terminal', description: 'Execute shell commands, manage processes, and interact with the system terminal.', category: 'Core', icon: <Terminal className="h-5 w-5" />, stars: 3200, official: true, tags: ['shell', 'cli', 'commands'] },
];

const categories = ['All', 'Core', 'Database', 'DevTools', 'Web', 'AI', 'Cloud', 'Communication', 'DevOps', 'Monitoring', 'Payments', 'Design'];

export default function McpDirectory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredServers = mcpServers.filter((server) => {
    const matchesSearch = !searchQuery ||
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.tags.some(t => t.includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || server.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-mcpdirectory">
      <PublicNavbar />

      <section className="py-16 px-4 border-b bg-gradient-to-b from-violet-50/50 to-background dark:from-violet-950/20">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge variant="outline" className="mb-4">
            <Plug className="h-3 w-3 mr-1" />
            MCP Protocol
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-mcp-title">
            MCP Server Directory
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Browse and install Model Context Protocol servers to extend your AI assistant's capabilities. Connect to databases, APIs, and tools seamlessly.
          </p>
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search MCP servers..."
              className="pl-10"
              data-testid="input-search-mcp"
            />
          </div>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                data-testid={`button-category-${cat.toLowerCase()}`}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServers.map((server) => (
              <Card key={server.id} className="hover:shadow-md transition-shadow" data-testid={`card-mcp-${server.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30">
                        {server.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {server.name}
                          {server.official && (
                            <Badge variant="secondary" className="text-xs">Official</Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {server.stars.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-3 line-clamp-2">{server.description}</CardDescription>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {server.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <Link href={`/mcp-install-link?server=${server.id}`}>
                      <Button size="sm" variant="ghost" className="text-xs" data-testid={`button-install-${server.id}`}>
                        Install <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredServers.length === 0 && (
            <div className="text-center py-16">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No servers found</h3>
              <p className="text-muted-foreground">Try adjusting your search or category filter.</p>
            </div>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
