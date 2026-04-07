// @ts-nocheck
import React, { useState, useRef, useMemo, useCallback, memo, Suspense } from 'react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Project } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { CreditBalance } from '@/components/CreditBalance';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ECodeLoading } from '@/components/ECodeLoading';
import { Progress } from '@/components/ui/progress';
import { getProjectUrl, cn } from '@/lib/utils';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { useDebounce, usePrefersReducedMotion } from '@/lib/performance';
import { optimizedMemo, useStableCallback } from '@/lib/memoization-helpers';
import { OptimizedImage } from '@/components/OptimizedImage';
import { prefetchQuery } from '@/lib/queryClient';
import {
  Clock, Eye, Users, Share2, Code2, Folder, GitBranch, Star, 
  Grid3x3, List, Plus, Search, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
const analyticsImagePath = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop';

// Lazy load heavy components
const LazyCharts = instrumentedLazy(() => import('./DashboardCharts'), 'DashboardCharts');
const LazyActivityFeed = instrumentedLazy(() => import('./ActivityFeed'), 'ActivityFeed');

// Memoized project card component
const ProjectCard = optimizedMemo(({ 
  project, 
  onNavigate,
  onOptionsClick 
}: { 
  project: Project; 
  onNavigate: (url: string) => void;
  onOptionsClick: (project: Project) => void;
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const colors = useMemo(() => [
    'bg-gradient-to-br from-orange-500 to-yellow-500',
    'bg-gradient-to-br from-orange-600 to-red-500',
    'bg-gradient-to-br from-yellow-500 to-orange-600',
    'bg-gradient-to-br from-green-500 to-emerald-600',
  ], []);
  
  const bgColor = colors[project.id % colors.length];
  const firstLetter = project.name.charAt(0).toUpperCase();
  
  const handleClick = useCallback(() => {
    onNavigate(getProjectUrl(project));
  }, [project, onNavigate]);
  
  const handleOptionsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOptionsClick(project);
  }, [project, onOptionsClick]);
  
  return (
    <LazyMotionDiv
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? false : { opacity: 0, y: -20 }}
      whileHover={prefersReducedMotion ? {} : { y: -4 }}
      transition={{ duration: 0.2 }}
      className="gpu-accelerated"
    >
      <Card 
        className="group cursor-pointer hover-lift transition-gpu contain-paint"
        onClick={handleClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={`${bgColor} w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold shadow-md gpu-transform`}>
                {firstLetter}
              </div>
              <div>
                <h3 className="font-semibold text-foreground line-clamp-1">
                  {project.name}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {project.language || 'JavaScript'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOptionsClick}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {project.description && (
            <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
              {project.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-[11px] text-muted-foreground">
              <span className="flex items-center">
                <Eye className="h-3 w-3 mr-1" />
                {project.views ?? 0}
              </span>
              <span className="flex items-center">
                <GitBranch className="h-3 w-3 mr-1" />
                {project.forks ?? 0}
              </span>
              <span className="flex items-center">
                <Star className="h-3 w-3 mr-1" />
                {project.likes ?? 0}
              </span>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );
});

export default function OptimizedDashboard() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  // Use debounced search for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Optimized query with staleTime and cacheTime
  const { 
    data: projects = [], 
    isLoading,
    error,
  } = useQuery<Project[]>({
    queryKey: ['/api/projects', debouncedSearchQuery],
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Prefetch project details on hover
  const handleProjectHover = useCallback((project: Project) => {
    prefetchQuery(['/api/projects', project.id]);
  }, []);
  
  // Memoized filtered projects
  const filteredProjects = useMemo(() => {
    if (!debouncedSearchQuery) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [projects, debouncedSearchQuery]);
  
  // Stable callbacks
  const handleNavigate = useStableCallback((url: string) => {
    setLocation(url);
  }, [setLocation]);
  
  const handleOptionsClick = useStableCallback((project: Project) => {
    setSelectedProject(project);
    toast({
      title: "Project Options",
      description: `Options for ${project.name}`,
    });
  }, [toast]);
  
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  
  if (isLoading) {
    return <ECodeLoading />;
  }
  
  if (error) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Failed to load projects. Please try again.
              </p>
              <Button 
                className="w-full mt-4"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }
  
  return (
    <PageShell>
      <PageHeader
        title={`${greeting}, ${user?.username || 'Developer'}!`}
        description="Welcome back to your development workspace"
      />
      
      <div className="space-y-6">
        {/* Search and Controls */}
        <Card className="contain-layout">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-gpu"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={cn(viewMode === 'grid' && 'bg-accent')}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={cn(viewMode === 'list' && 'bg-accent')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setIsCreatingProject(true)}
                  className="gpu-accelerated"
                  disabled={isCreatingProject}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Projects Grid/List */}
        <div className={cn(
          "grid gap-6 contain-layout",
          viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        )}>
          <LazyAnimatePresence mode="popLayout">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onNavigate={handleNavigate}
                onOptionsClick={handleOptionsClick}
              />
            ))}
          </LazyAnimatePresence>
        </div>
        
        {/* Lazy Load Charts */}
        <React.Suspense fallback={<Skeleton className="h-96" />}>
          <LazyCharts projects={projects} />
        </React.Suspense>
        
        {/* Lazy Load Activity Feed */}
        <React.Suspense fallback={<Skeleton className="h-64" />}>
          <LazyActivityFeed />
        </React.Suspense>
        
        {/* Hero Image with Optimization */}
        <Card className="overflow-hidden contain-paint">
          <OptimizedImage
            src={analyticsImagePath}
            alt="Analytics Dashboard"
            width={800}
            height={400}
            className="w-full h-48 object-cover"
            priority={false}
          />
        </Card>
      </div>
    </PageShell>
  );
}