import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Project, InsertProject } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn, getProjectUrl } from '@/lib/utils';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { useDebounce } from '@/hooks/use-debounce';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ECodeLoading, ECodeSpinner } from '@/components/ECodeLoading';
import { PageShell, PageHeader, PageShellLoading } from '@/components/layout/PageShell';
import { 
  Plus, Trash2, Edit, ExternalLink, Clock, Eye, EyeOff,
  Search, Grid3X3, List, Filter, ChevronDown, ArrowUpDown, Pin, GitFork, Heart,
  Play, Share2, Folder, MoreVertical, FileText, Copy, Star, Rocket,
  Globe, Calendar, Archive, Lock, X
} from 'lucide-react';
const codingImagePath = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop';
const modernDevImagePath = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop';

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required").max(64, "Project name must be less than 64 characters"),
  description: z.string().max(255, "Description must be less than 255 characters").optional(),
  language: z.string().min(1, "Language is required"),
  visibility: z.enum(["public", "private", "unlisted"]),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface ProjectWithOwner extends Project {
  owner?: {
    id: string;
    username: string | null;
    email: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
  };
}

const languageColors: Record<string, string> = {
  javascript: 'bg-yellow-500',
  typescript: 'bg-blue-600',
  python: 'bg-green-600',
  java: 'bg-red-600',
  cpp: 'bg-pink-600',
  c: 'bg-muted-foreground',
  csharp: 'bg-purple-600',
  go: 'bg-cyan-600',
  rust: 'bg-orange-600',
  php: 'bg-indigo-600',
  ruby: 'bg-red-500',
  swift: 'bg-orange-500',
  kotlin: 'bg-violet-600',
  html: 'bg-orange-400',
  css: 'bg-blue-400',
  sql: 'bg-blue-700',
  bash: 'bg-muted-foreground',
  other: 'bg-muted-foreground',
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }
};

const ProjectsPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name' | 'stars'>('updated');
  const [filterLanguage, setFilterLanguage] = useState<string[]>([]);
  const [filterVisibility, setFilterVisibility] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const [showFilters, setShowFilters] = useState(!isMobileView);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      language: "typescript",
      visibility: "private",
    },
  });

  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const { data: projectsData, isLoading, error } = useQuery<{ projects: ProjectWithOwner[], pagination: { total: number, limit: number, offset: number, hasMore: boolean } }>({
    queryKey: ['/api/projects', page, debouncedSearchQuery, filterLanguage, filterVisibility],
    queryFn: async () => {
      const offset = (page - 1) * itemsPerPage;
      let url = `/api/projects?limit=${itemsPerPage}&offset=${offset}`;
      if (debouncedSearchQuery) {
        url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
      }
      if (filterLanguage.length === 1) {
        url += `&language=${encodeURIComponent(filterLanguage[0])}`;
      }
      if (filterVisibility.length === 1) {
        url += `&visibility=${encodeURIComponent(filterVisibility[0])}`;
      }
      const res = await apiRequest('GET', url);
      if (!res.ok) {
        throw new Error('Failed to fetch projects');
      }
      return await res.json();
    },
    enabled: !!user,
  });

  const projectsArray = projectsData?.projects && Array.isArray(projectsData.projects) ? projectsData.projects : [];

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    projectsArray.forEach(p => {
      if (p.language) langs.add(p.language);
    });
    return Array.from(langs).sort();
  }, [projectsArray]);

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projectsArray];

    // Note: Search, language (if single), and visibility (if single) are handled server-side
    // We keep client-side filtering as a secondary layer for multiple selections or immediate feedback
    if (debouncedSearchQuery && projectsData?.pagination.total === undefined) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    if (filterLanguage.length > 1) {
      filtered = filtered.filter(p => {
        return p.language && filterLanguage.includes(p.language);
      });
    }

    if (filterVisibility.length > 1) {
      filtered = filtered.filter(p => filterVisibility.includes(p.visibility));
    }

    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(p => {
        const updatedAt = new Date(p.updatedAt);
        return updatedAt >= dateRange[0]! && updatedAt <= dateRange[1]!;
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'stars':
          return (b.likes || 0) - (a.likes || 0);
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return filtered;
  }, [projectsArray, debouncedSearchQuery, filterLanguage, filterVisibility, dateRange, sortBy]);

  const createProjectMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      return await apiRequest('POST', '/api/projects', values);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setNewProjectOpen(false);
      form.reset();
      const projectId = data?.id || data?.project?.id;
      if (projectId) {
        setLocation(`/ide/${projectId}`);
      } else {
        toast({ title: "Success", description: "Project created successfully", variant: "success" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest('DELETE', `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Success", description: "Project deleted successfully", variant: "success" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBulkAction = async (action: string) => {
    if (selectedProjects.length === 0) return;

    switch (action) {
      case 'delete':
        toast({ title: "Info", description: `Deleting ${selectedProjects.length} projects...` });
        break;
      case 'archive':
        toast({ title: "Info", description: `Archiving ${selectedProjects.length} projects...` });
        break;
      case 'export':
        toast({ title: "Info", description: `Exporting ${selectedProjects.length} projects...` });
        break;
    }
    
    setSelectedProjects([]);
  };

  const toggleProjectSelection = (projectId: number) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const selectAllProjects = () => {
    if (selectedProjects.length === filteredAndSortedProjects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(filteredAndSortedProjects.map(p => p.id));
    }
  };

  if (authLoading) {
    return <PageShellLoading text="Loading your projects..." size="lg" />;
  }

  if (!user) {
    return (
      <PageShell>
        <Card className="max-w-lg mx-auto text-center p-8 border border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
          <CardHeader>
            <CardTitle className="text-[var(--ecode-text)]">Sign in to view your projects</CardTitle>
            <CardDescription className="text-[var(--ecode-text-muted)]">
              You need to be authenticated to access your projects.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button 
              onClick={() => setLocation('/login')} 
              size="lg"
              className="bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
          </CardFooter>
        </Card>
      </PageShell>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[var(--ecode-background)] p-4 md:p-6 lg:p-8"
      style={{ fontFamily: 'var(--ecode-font-sans)' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header Section with E-Code Gradient */}
        <LazyMotionDiv 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="relative rounded-2xl overflow-hidden mb-8"
          style={{ 
            background: 'linear-gradient(135deg, var(--ecode-accent) 0%, var(--ecode-accent) 50%, var(--ecode-accent) 100%)',
            boxShadow: '0 8px 32px -8px rgba(242, 98, 7, 0.4)'
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          
          <div className="relative p-6 md:p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Folder className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Projects</h1>
                </div>
                <p className="text-white/90">
                  Manage and organize all your development projects in one place
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-white/15 border-white/25 text-white hover:bg-white/25 hover:border-white/40"
                  data-testid="button-toggle-filters"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button>
                <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-white text-[var(--ecode-accent)] hover:bg-white/95 font-semibold shadow-lg"
                      data-testid="button-new-project"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                    <DialogHeader>
                      <DialogTitle className="text-[var(--ecode-text)]">Create New Project</DialogTitle>
                      <DialogDescription className="text-[var(--ecode-text-muted)]">
                        Set up a new project with your preferred configuration
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(values => createProjectMutation.mutate(values))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[var(--ecode-text)]">Project Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="My Awesome Project" 
                                  {...field} 
                                  className="border-[var(--ecode-border)] bg-[var(--ecode-surface)] text-[var(--ecode-text)] focus:ring-[var(--ecode-accent)]/20 focus:border-[var(--ecode-accent)]/40"
                                  data-testid="input-project-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[var(--ecode-text)]">Description</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="A brief description..." 
                                  {...field}
                                  className="border-[var(--ecode-border)] bg-[var(--ecode-surface)] text-[var(--ecode-text)] focus:ring-[var(--ecode-accent)]/20 focus:border-[var(--ecode-accent)]/40"
                                  data-testid="input-project-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="language"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[var(--ecode-text)]">Primary Language</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="border-[var(--ecode-border)] bg-[var(--ecode-surface)] text-[var(--ecode-text)]"
                                    data-testid="select-language"
                                  >
                                    <SelectValue placeholder="Select a language" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                                  <SelectItem value="javascript">JavaScript</SelectItem>
                                  <SelectItem value="typescript">TypeScript</SelectItem>
                                  <SelectItem value="python">Python</SelectItem>
                                  <SelectItem value="go">Go</SelectItem>
                                  <SelectItem value="rust">Rust</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="visibility"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[var(--ecode-text)]">Visibility</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="border-[var(--ecode-border)] bg-[var(--ecode-surface)] text-[var(--ecode-text)]"
                                    data-testid="select-visibility"
                                  >
                                    <SelectValue placeholder="Select visibility" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                                  <SelectItem value="public">
                                    <div className="flex items-center gap-2">
                                      <Globe className="h-4 w-4" />
                                      Public
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="private">
                                    <div className="flex items-center gap-2">
                                      <Lock className="h-4 w-4" />
                                      Private
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="unlisted">
                                    <div className="flex items-center gap-2">
                                      <EyeOff className="h-4 w-4" />
                                      Unlisted
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button 
                            type="submit" 
                            disabled={createProjectMutation.isPending}
                            className="bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
                            data-testid="button-create-project"
                          >
                            {createProjectMutation.isPending ? (
                              <>
                                <ECodeSpinner className="mr-2" />
                                Creating...
                              </>
                            ) : (
                              'Create Project'
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </LazyMotionDiv>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Sidebar Filters - E-Code Styled - Hidden on mobile */}
          <LazyAnimatePresence>
            {showFilters && (
              <LazyMotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full lg:w-72 flex-shrink-0"
              >
                <Card className="sticky top-4 border border-[var(--ecode-border)] bg-[var(--ecode-surface)] shadow-sm">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-[13px] font-medium text-[var(--ecode-text)]">Filters</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ecode-text-muted)]" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-[13px] border-[var(--ecode-border)] bg-[var(--ecode-surface)] text-[var(--ecode-text)] focus:ring-[var(--ecode-accent)]/20 focus:border-[var(--ecode-accent)]/40"
                        data-testid="input-search-projects"
                      />
                    </div>

                    {/* Language/Framework Filter */}
                    <div>
                      <Label className="text-[11px] font-medium text-[var(--ecode-text-muted)]">Languages</Label>
                      <ScrollArea className="h-24 mt-1">
                        <div className="space-y-1">
                          {availableLanguages.map(lang => (
                            <div key={lang} className="flex items-center space-x-2">
                              <Checkbox
                                id={`lang-${lang}`}
                                checked={filterLanguage.includes(lang)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilterLanguage([...filterLanguage, lang]);
                                  } else {
                                    setFilterLanguage(filterLanguage.filter(l => l !== lang));
                                  }
                                }}
                                className="h-3.5 w-3.5 border-[var(--ecode-border)] data-[state=checked]:bg-[var(--ecode-accent)] data-[state=checked]:border-[var(--ecode-accent)]"
                                data-testid={`checkbox-lang-${lang}`}
                              />
                              <Label
                                htmlFor={`lang-${lang}`}
                                className="text-[11px] font-normal cursor-pointer text-[var(--ecode-text)]"
                              >
                                {lang}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Visibility Filter */}
                    <div>
                      <Label className="text-[11px] font-medium text-[var(--ecode-text-muted)]">Visibility</Label>
                      <div className="space-y-1 mt-1">
                        {['public', 'private', 'unlisted'].map(vis => (
                          <div key={vis} className="flex items-center space-x-2">
                            <Checkbox
                              id={`vis-${vis}`}
                              checked={filterVisibility.includes(vis)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilterVisibility([...filterVisibility, vis]);
                                } else {
                                  setFilterVisibility(filterVisibility.filter(v => v !== vis));
                                }
                              }}
                              className="h-3.5 w-3.5 border-[var(--ecode-border)] data-[state=checked]:bg-[var(--ecode-accent)] data-[state=checked]:border-[var(--ecode-accent)]"
                              data-testid={`checkbox-visibility-${vis}`}
                            />
                            <Label
                              htmlFor={`vis-${vis}`}
                              className="text-[11px] font-normal cursor-pointer capitalize text-[var(--ecode-text)]"
                            >
                              {vis}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Clear Filters */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-[11px] text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterLanguage([]);
                        setFilterVisibility([]);
                        setDateRange([null, null]);
                      }}
                      data-testid="button-clear-filters"
                    >
                      Clear Filters
                    </Button>
                  </CardContent>
                </Card>
              </LazyMotionDiv>
            )}
          </LazyAnimatePresence>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar - E-Code Styled */}
            <Card className="mb-4 md:mb-6 border border-[var(--ecode-border)] bg-[var(--ecode-surface)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)]">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 border border-[var(--ecode-border)] rounded-lg p-1 bg-[var(--ecode-surface)]">
                      <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          viewMode === 'grid' 
                            ? "bg-[var(--ecode-accent)]/10 text-[var(--ecode-accent)]" 
                            : "text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                        )}
                        onClick={() => setViewMode('grid')}
                        data-testid="button-view-grid"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          viewMode === 'list' 
                            ? "bg-[var(--ecode-accent)]/10 text-[var(--ecode-accent)]" 
                            : "text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                        )}
                        onClick={() => setViewMode('list')}
                        data-testid="button-view-list"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Sort Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 border-[var(--ecode-border)] text-[var(--ecode-text)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)] hover:border-[var(--ecode-accent)]/30"
                          data-testid="dropdown-sort"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                          Sort by {sortBy}
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                        <DropdownMenuLabel className="text-[var(--ecode-text)]">Sort By</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                        <DropdownMenuItem 
                          onClick={() => setSortBy('updated')}
                          className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]"
                          data-testid="sort-updated"
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Last Updated
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setSortBy('created')}
                          className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]"
                          data-testid="sort-created"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Created Date
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setSortBy('name')}
                          className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]"
                          data-testid="sort-name"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Name
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setSortBy('stars')}
                          className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]"
                          data-testid="sort-stars"
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Stars
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Bulk Actions */}
                    {selectedProjects.length > 0 && (
                      <div
                        className="flex items-center gap-2 animate-fadeIn"
                      >
                        <Badge className="bg-[var(--ecode-accent)]/10 text-[var(--ecode-accent)] border border-[var(--ecode-accent)]/30">
                          {selectedProjects.length} selected
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2 border-[var(--ecode-border)] text-[var(--ecode-text)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                              data-testid="dropdown-bulk-actions"
                            >
                              Bulk Actions
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                            <DropdownMenuItem 
                              onClick={() => handleBulkAction('archive')}
                              className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]"
                              data-testid="bulk-archive"
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive Selected
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                            <DropdownMenuItem
                              className="text-red-600 focus:bg-red-50 focus:text-red-600"
                              onClick={() => handleBulkAction('delete')}
                              data-testid="bulk-delete"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Selected
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedProjects([])}
                          className="h-8 w-8 text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                          data-testid="button-clear-selection"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Checkbox
                      id="select-all"
                      checked={selectedProjects.length === filteredAndSortedProjects.length && filteredAndSortedProjects.length > 0}
                      onCheckedChange={selectAllProjects}
                      className="border-[var(--ecode-border)] data-[state=checked]:bg-[var(--ecode-accent)] data-[state=checked]:border-[var(--ecode-accent)]"
                      data-testid="checkbox-select-all"
                    />
                    <Label htmlFor="select-all" className="text-[13px] cursor-pointer text-[var(--ecode-text)] whitespace-nowrap">
                      Select All
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Projects Grid/List */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="border border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                    <div className="aspect-video">
                      <Skeleton className="w-full h-full" />
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredAndSortedProjects.length === 0 ? (
              <Card className="p-16 text-center border border-dashed border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                <div className="max-w-md mx-auto">
                  <div className="p-4 rounded-full bg-[var(--ecode-accent)]/10 w-fit mx-auto mb-4">
                    <Folder className="h-12 w-12 text-[var(--ecode-accent)]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-[var(--ecode-text)]">No projects found</h3>
                  <p className="text-[var(--ecode-text-muted)] mb-6">
                    {searchQuery || filterLanguage.length > 0 || filterVisibility.length > 0
                      ? "Try adjusting your filters or search query"
                      : "Create your first project to get started"}
                  </p>
                  <Button 
                    onClick={() => setNewProjectOpen(true)}
                    className="bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
                    data-testid="button-create-first-project"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Project
                  </Button>
                </div>
              </Card>
            ) : viewMode === 'grid' ? (
              <div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
              >
                {filteredAndSortedProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="relative animate-slide-in-up opacity-0 hover:-translate-y-1 transition-transform"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                    data-testid={`project-card-${project.id}`}
                  >
                      <Card className="overflow-hidden border border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:border-[var(--ecode-accent)]/30 hover:shadow-[0_8px_24px_-8px_rgba(242,98,7,0.2)] transition-all duration-300 group">
                        {/* Selection Checkbox */}
                        <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Checkbox
                            checked={selectedProjects.includes(project.id)}
                            onCheckedChange={() => toggleProjectSelection(project.id)}
                            className="bg-background/90 backdrop-blur-sm border-[var(--ecode-border)] data-[state=checked]:bg-[var(--ecode-accent)] data-[state=checked]:border-[var(--ecode-accent)]"
                            data-testid={`checkbox-project-${project.id}`}
                          />
                        </div>

                        {/* Status Badges */}
                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                          {project.isPinned && (
                            <Badge className="bg-[var(--ecode-accent)] text-white shadow-lg">
                              <Pin className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>

                        {/* Project Thumbnail */}
                        <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-[var(--ecode-accent)]/10 to-[var(--ecode-accent)]/10">
                          <img 
                            src={index % 2 === 0 ? codingImagePath : modernDevImagePath}
                            alt={project.name}
                            className="absolute inset-0 w-full h-full object-cover opacity-20"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-4xl font-bold text-[var(--ecode-accent)]/30 select-none">
                              {project.name.substring(0, 2).toUpperCase()}
                            </div>
                          </div>

                          {/* Language Badge */}
                          {project.language && (
                            <div className="absolute bottom-2 left-2">
                              <Badge
                                variant="secondary"
                                className={`${languageColors[project.language] || languageColors.other} text-white text-[11px] shadow-md`}
                              >
                                {project.language}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Card Content */}
                        <CardContent className="p-4">
                          <div className="mb-3">
                            <h3 className="font-semibold text-[15px] truncate mb-1 text-[var(--ecode-text)]">{project.name}</h3>
                            <p className="text-[13px] text-[var(--ecode-text-muted)] line-clamp-2">
                              {project.description || 'No description available'}
                            </p>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center justify-between text-[11px] text-[var(--ecode-text-muted)] mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                <span>{project.likes || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <GitFork className="h-3 w-3" />
                                <span>{project.forks || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                <span>{project.views || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Play className="h-3 w-3" />
                                <span>{project.runs || 0}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[11px] border-[var(--ecode-border)] text-[var(--ecode-text-muted)]">
                              {project.visibility}
                            </Badge>
                          </div>

                          {/* Updated At */}
                          <div className="text-[11px] text-[var(--ecode-text-muted)] border-t border-[var(--ecode-border)] pt-3">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated
                              </span>
                              <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              className="flex-1 bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
                              onClick={() => {
                                setLocation(`/ide/${project.id}`);
                              }}
                              data-testid={`button-open-${project.id}`}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Open
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="px-2 text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                              data-testid={`button-edit-${project.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="px-2 text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                              data-testid={`button-deploy-${project.id}`}
                            >
                              <Rocket className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="px-2 text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                                  data-testid={`button-more-${project.id}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                                <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                  <GitFork className="h-4 w-4 mr-2" />
                                  Fork
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                                <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
              </div>
            ) : (
              // List View - E-Code Styled
              <div 
                className="space-y-4"
              >
                {filteredAndSortedProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="animate-slide-in-up opacity-0 hover:translate-x-1 transition-transform"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                    data-testid={`project-row-${project.id}`}
                  >
                      <Card className="border border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:border-[var(--ecode-accent)]/30 hover:shadow-[0_4px_16px_-4px_rgba(242,98,7,0.15)] transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            {/* Checkbox */}
                            <Checkbox
                              checked={selectedProjects.includes(project.id)}
                              onCheckedChange={() => toggleProjectSelection(project.id)}
                              className="border-[var(--ecode-border)] data-[state=checked]:bg-[var(--ecode-accent)] data-[state=checked]:border-[var(--ecode-accent)]"
                              data-testid={`checkbox-list-project-${project.id}`}
                            />

                            {/* Project Icon */}
                            <div 
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold bg-gradient-to-br from-[var(--ecode-accent)] to-[var(--ecode-accent)]/80 shadow-[0_4px_12px_-4px_rgba(var(--ecode-accent-rgb,242,98,7),0.3)]"
                            >
                              {project.name.substring(0, 2).toUpperCase()}
                            </div>

                            {/* Project Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-[15px] text-[var(--ecode-text)]">{project.name}</h3>
                                {project.isPinned && <Pin className="h-4 w-4 text-[var(--ecode-accent)]" />}
                              </div>
                              <p className="text-[13px] text-[var(--ecode-text-muted)] mb-2">
                                {project.description || 'No description available'}
                              </p>
                              <div className="flex items-center gap-4 text-[11px] text-[var(--ecode-text-muted)]">
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3 w-3" />
                                  {project.likes || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <GitFork className="h-3 w-3" />
                                  {project.forks || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {project.views || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Play className="h-3 w-3" />
                                  {project.runs || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(project.updatedAt).toLocaleDateString()}
                                </span>
                                <Badge variant="outline" className="border-[var(--ecode-border)] text-[var(--ecode-text-muted)]">
                                  {project.visibility}
                                </Badge>
                              </div>
                            </div>

                            {/* Language Badge */}
                            {project.language && (
                              <Badge 
                                variant="secondary"
                                className={`${languageColors[project.language] || languageColors.other} text-white`}
                              >
                                {project.language}
                              </Badge>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setLocation(`/ide/${project.id}`);
                                }}
                                className="text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                                data-testid={`button-quick-open-${project.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                                data-testid={`button-list-edit-${project.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                                data-testid={`button-list-deploy-${project.id}`}
                              >
                                <Rocket className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                                    data-testid={`button-list-more-${project.id}`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
                                  <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                    <GitFork className="h-4 w-4 mr-2" />
                                    Fork
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-[var(--ecode-text)] focus:bg-[var(--ecode-accent)]/10 focus:text-[var(--ecode-accent)]">
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                                  <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
              </div>
            )}

            {/* Pagination - E-Code Styled */}
            {projectsData && projectsData.pagination.total > itemsPerPage && (
              <div 
                className="mt-8 flex justify-center animate-fadeIn"
              >
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="border-[var(--ecode-border)] text-[var(--ecode-text)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                    data-testid="button-page-prev"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(projectsData.pagination.total / itemsPerPage) }).map((_, i) => {
                      const pageNum = i + 1;
                      if (
                        pageNum === 1 || 
                        pageNum === Math.ceil(projectsData.pagination.total / itemsPerPage) ||
                        (pageNum >= page - 1 && pageNum <= page + 1)
                      ) {
                        return (
                          <Button 
                            key={pageNum}
                            size="sm"
                            variant={page === pageNum ? "default" : "outline"}
                            className={page === pageNum 
                              ? "bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
                              : "border-[var(--ecode-border)] text-[var(--ecode-text)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                            }
                            onClick={() => setPage(pageNum)}
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      }
                      if (pageNum === page - 2 || pageNum === page + 2) {
                        return <span key={pageNum} className="px-2 text-[var(--ecode-text-muted)]">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!projectsData.pagination.hasMore}
                    onClick={() => setPage(p => p + 1)}
                    className="border-[var(--ecode-border)] text-[var(--ecode-text)] hover:bg-[var(--ecode-accent)]/10 hover:text-[var(--ecode-accent)]"
                    data-testid="button-page-next"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
