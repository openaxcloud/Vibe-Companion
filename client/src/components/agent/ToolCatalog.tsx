import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search,
  FileCode,
  Terminal,
  Database,
  GitBranch,
  Package,
  TestTube,
  Cloud,
  Activity,
  Shield,
  Globe,
  Brain,
  Settings,
  ChevronDown,
  ChevronRight,
  Lock,
  Zap
} from 'lucide-react';

interface Tool {
  id: number;
  name: string;
  displayName: string;
  description: string;
  capability: string;
  version: string;
  isEnabled: boolean;
  requiresAuth: boolean;
  inputSchema: Record<string, any>;
  configuration: Record<string, any>;
}

interface ToolsResponse {
  tools: Tool[];
  grouped: Record<string, Tool[]>;
  categories: Record<string, { label: string; description: string }>;
  total: number;
}

const categoryIcons: Record<string, typeof FileCode> = {
  file_system: FileCode,
  command_execution: Terminal,
  database: Database,
  git_operations: GitBranch,
  package_management: Package,
  testing: TestTube,
  deployment: Cloud,
  monitoring: Activity,
  security: Shield,
  api_integration: Globe,
  ai_analysis: Brain,
  ide_integration: Settings
};

const categoryColors: Record<string, string> = {
  file_system: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  command_execution: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  database: 'bg-green-500/10 text-green-500 border-green-500/20',
  git_operations: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  package_management: 'bg-red-500/10 text-red-500 border-red-500/20',
  testing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  deployment: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  monitoring: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  security: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  api_integration: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  ai_analysis: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  ide_integration: 'bg-slate-500/10 text-slate-500 border-slate-500/20'
};

function ToolCard({ tool }: { tool: Tool }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = categoryIcons[tool.capability] || Settings;
  const colorClass = categoryColors[tool.capability] || 'bg-muted text-muted-foreground';
  
  const inputParams = useMemo(() => {
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') return [];
    const schema = tool.inputSchema as any;
    if (schema.properties) {
      return Object.entries(schema.properties).map(([key, value]: [string, any]) => ({
        name: key,
        type: value.type || 'any',
        description: value.description || '',
        required: schema.required?.includes(key) || false,
        default: value.default
      }));
    }
    return [];
  }, [tool.inputSchema]);
  
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="transition-all hover:shadow-md" data-testid={`card-tool-${tool.name}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-[13px] font-medium flex items-center gap-2">
                    {tool.displayName || tool.name}
                    {tool.requiresAuth && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-[11px] mt-0.5 line-clamp-1">
                    {tool.description}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">
                  v{tool.version || '1.0.0'}
                </Badge>
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">{tool.description}</p>
              
              {inputParams.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Parameters
                  </h4>
                  <div className="space-y-1.5">
                    {inputParams.map((param) => (
                      <div
                        key={param.name}
                        className="flex items-start gap-2 text-[11px] bg-muted/50 rounded-md p-2"
                        data-testid={`param-${tool.name}-${param.name}`}
                      >
                        <code className="font-mono text-primary font-medium">
                          {param.name}
                        </code>
                        <span className="text-muted-foreground">:</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {param.type}
                        </Badge>
                        {param.required && (
                          <Badge variant="destructive" className="text-[10px]">
                            required
                          </Badge>
                        )}
                        {param.description && (
                          <span className="text-muted-foreground flex-1">
                            - {param.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {tool.configuration?.rateLimit && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  <span>Rate limit: {tool.configuration.rateLimit} req/min</span>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CategorySection({ 
  category, 
  tools, 
  meta 
}: { 
  category: string; 
  tools: Tool[];
  meta?: { label: string; description: string };
}) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = categoryIcons[category] || Settings;
  const colorClass = categoryColors[category] || 'bg-muted text-muted-foreground';
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid={`category-${category}`}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between h-auto py-3 px-4 mb-2"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="font-medium">{meta?.label || category}</span>
              <p className="text-[11px] text-muted-foreground font-normal">
                {meta?.description} • {tools.length} tools
              </p>
            </div>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pl-2">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolCatalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const { data, isLoading, error } = useQuery<ToolsResponse>({
    queryKey: ['/api/agent/tools', { search: searchQuery, capability: selectedCategory }]
  });
  
  const filteredTools = useMemo(() => {
    if (!data?.tools) return [];
    let tools = data.tools;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tools = tools.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.displayName?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory) {
      tools = tools.filter(t => t.capability === selectedCategory);
    }
    
    return tools;
  }, [data?.tools, searchQuery, selectedCategory]);
  
  const groupedTools = useMemo(() => {
    const groups: Record<string, Tool[]> = {};
    for (const tool of filteredTools) {
      const cap = tool.capability || 'other';
      if (!groups[cap]) groups[cap] = [];
      groups[cap].push(tool);
    }
    return groups;
  }, [filteredTools]);
  
  const categories = Object.keys(categoryIcons);
  
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">Failed to load tools</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4" data-testid="tool-catalog">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-tools"
          />
        </div>
        <ScrollArea className="w-full sm:w-auto">
          <div className="flex gap-1.5 pb-2">
            <Button
              variant={selectedCategory === null ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="whitespace-nowrap"
              data-testid="button-filter-all"
            >
              All
            </Button>
            {categories.map(cat => {
              const Icon = categoryIcons[cat];
              return (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="whitespace-nowrap gap-1.5"
                  data-testid={`button-filter-${cat}`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden md:inline">
                    {data?.categories?.[cat]?.label || cat}
                  </span>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <div className="pl-4 space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted-foreground" data-testid="text-tool-count">
              {filteredTools.length} tools available
            </p>
          </div>
          
          {Object.entries(groupedTools).map(([category, tools]) => (
            <CategorySection
              key={category}
              category={category}
              tools={tools}
              meta={data?.categories?.[category]}
            />
          ))}
          
          {filteredTools.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No tools found matching your criteria</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCatalog;
