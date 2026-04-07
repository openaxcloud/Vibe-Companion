import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { BuildModeSelector, BuildMode } from "@/components/ai/BuildModeSelector";
import { Project } from "@shared/schema";
import AppLayout from "@/components/layout/AppLayout";
import { 
  Plus, 
  Code, 
  FileText, 
  Clock, 
  Settings, 
  Grid, 
  List, 
  Search, 
  MoreVertical, 
  Trash, 
  Edit, 
  Copy, 
  Lock, 
  Globe,
  Sparkles,
  Bot,
  Timer,
  MessageSquare,
  Zap,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ECodeLoading } from '@/components/ECodeLoading';
import { AuthModal } from '@/components/AuthModal';
import { getProjectUrl } from '@/lib/utils';
import { AIModelSelector } from '@/components/ai/AIModelSelector';
import { SEOHead, structuredData } from '@/components/seo/SEOHead';

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBuildModeOpen, setIsBuildModeOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recent");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: projectsData, isLoading, error: projectsError } = useQuery<{ projects: Project[], pagination?: any }>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/projects');
      // res is expected to be { projects: [...], pagination: {...} }
      return res;
    },
    retry: 2,
  });

  const projects = Array.isArray(projectsData?.projects) ? projectsData.projects : [];

  // Show error toast if projects fail to load - use ref to avoid toast dependency causing loops
  const toastRef = useRef(toast);
  toastRef.current = toast;
  
  useEffect(() => {
    if (projectsError) {
      toastRef.current({
        title: "Error loading projects",
        description: "Failed to fetch your projects. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [projectsError]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user && !isLoading) {
      setIsAuthModalOpen(true);
    }
  }, [user, isLoading]);

  const createProjectMutation = useMutation({
    mutationFn: async ({ prompt, buildMode }: { prompt: string; buildMode: BuildMode }) => {
      if (!user) {
        setIsAuthModalOpen(true);
        throw new Error("Please log in to create projects");
      }
      
      // Determine if this is an AI prompt (longer descriptions suggest AI generation)
      const isAIPrompt = prompt.length > 20;
      
      // Use workspace bootstrap endpoint for AI prompts (Fortune 500-grade orchestration)
      if (isAIPrompt) {
        const response = await apiRequest('POST', '/api/workspace/bootstrap', {
          prompt,
          buildMode, // Pass the selected build mode to backend
          options: {
            language: 'typescript',
            framework: 'react',
            autoStart: true,
            visibility: 'private',
            designFirst: buildMode === 'design-first'
          }
        });
        return response;
      } else {
        // Simple project creation (no AI agent)
        const project = await apiRequest('POST', '/api/projects', { name: prompt });
        return { projectId: project.id, projectSlug: project.slug, isSimple: true, project };
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsCreateModalOpen(false);
      setIsBuildModeOpen(false);
      
      const isAIPrompt = variables.prompt.length > 20;
      const promptToUse = variables.prompt;
      
      // Handle redirect based on response type
      if (data.bootstrapToken) {
        // Store prompt for the IDE Agent panel to pick up
        sessionStorage.setItem(`agent-prompt-${data.projectId}`, promptToUse);
        
        window.location.href = `/ide/${data.projectId}?bootstrap=${data.bootstrapToken}`;
        
        toast({
          title: "Building your app with AI...",
          description: "The AI agent is generating your application in real-time.",
        });
      } else {
        // Simple project creation
        const projectUrl = getProjectUrl(data.project, user?.username);
        window.location.href = projectUrl;
        
        toast({
          title: "Project created!",
          description: `${data.project.name} has been created successfully.`,
        });
      }
      
      // Clear search query
      setSearchQuery('');
    },
    onError: (error: any) => {
      // Handle auth errors silently - redirect to login
      if (error?.status === 401 || error?.status === 403 || 
          error?.message?.includes('Unauthorized') || error?.message?.includes('403')) {
        setIsAuthModalOpen(true);
        return;
      }
      
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Show build mode selector when user enters a prompt
  const handleCreateProject = (prompt: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    // For AI prompts (longer descriptions), show the build mode selector
    if (prompt.length > 20) {
      setPendingPrompt(prompt);
      setIsBuildModeOpen(true);
    } else {
      // Short prompts go directly to simple project creation
      createProjectMutation.mutate({ prompt, buildMode: 'full-app' });
    }
  };

  // Handle build mode selection
  const handleSelectBuildMode = (mode: BuildMode) => {
    if (mode === 'continue-planning') {
      // User wants to refine more - close dialog and let them continue editing
      setIsBuildModeOpen(false);
      return;
    }
    
    // Proceed with the selected build mode
    createProjectMutation.mutate({ prompt: pendingPrompt, buildMode: mode });
  };

  // Filter projects based on search query
  const filteredProjects = (projects || []).filter(
    (project) => (project?.name || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  // Sort projects based on active tab
  const sortedProjects = (filteredProjects || []).sort((a, b) => {
    if (activeTab === "recent") {
      const dateA = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    }
    return (a?.name || "").localeCompare(b?.name || "");
  });

  const homeStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      structuredData.organization(),
      structuredData.website(),
      structuredData.softwareApplication(
        'E-Code AI IDE',
        'AI-powered cloud-based integrated development environment for rapid application development. Build, deploy, and scale applications with AI assistance.',
        'DeveloperApplication'
      )
    ]
  };

  return (
    <>
      <SEOHead
        title="E-Code - AI-Powered Cloud IDE for Enterprise Development"
        description="Build, deploy, and scale applications with AI assistance. E-Code is the Fortune 500-grade cloud IDE supporting 28 programming languages with real-time collaboration."
        keywords={['AI IDE', 'cloud development', 'enterprise IDE', 'AI coding assistant', 'collaborative IDE', 'web development platform', 'code editor', 'DevOps']}
        canonicalUrl="https://e-code.ai"
        ogType="website"
        structuredData={homeStructuredData}
        alternateLanguages={[
          { lang: 'en', url: 'https://e-code.ai' },
          { lang: 'fr', url: 'https://e-code.ai/fr' },
          { lang: 'de', url: 'https://e-code.ai/de' },
          { lang: 'es', url: 'https://e-code.ai/es' },
          { lang: 'it', url: 'https://e-code.ai/it' },
          { lang: 'x-default', url: 'https://e-code.ai' }
        ]}
      />
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Hero Section with Chat Input - E-Code Style */}
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-8 text-white">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold mb-4" data-testid="text-home-hero-title">Let's build something amazing</h1>
            <p className="text-xl mb-6 text-orange-50" data-testid="text-home-hero-subtitle">The collaborative, in-browser IDE that makes coding accessible</p>
            
            {/* AI Model Selection */}
            <div className="mb-6">
              <AIModelSelector variant="hero" />
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg border border-white/20 shadow-xl">
              <div className="flex items-center gap-2 bg-background rounded-md p-1">
                <Input 
                  placeholder="Décrivez votre idée d'application en langage naturel..."
                  className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      handleCreateProject(searchQuery);
                    }
                  }}
                  data-testid="input-ai-prompt"
                />
                <Button 
                  className="shrink-0 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold"
                  onClick={() => searchQuery.trim() ? handleCreateProject(searchQuery) : setIsCreateModalOpen(true)}
                  disabled={createProjectMutation.isPending}
                  data-testid="button-build-project"
                >
                  <span className="hidden sm:inline">{searchQuery.trim() ? 'Build' : 'Create Project'}</span>
                  {searchQuery.trim() ? <Sparkles className="h-4 w-4 sm:ml-2" /> : <Plus className="h-4 w-4 sm:ml-2" />}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 px-2 pt-3 text-[13px] text-white/80">
                <span>Examples:</span>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-orange-50 hover:text-white font-medium"
                  onClick={() => {
                    handleCreateProject("Build a full-stack e-commerce marketplace with Stripe payments, product catalog, shopping cart, user authentication, order management, and mobile-responsive design");
                  }}
                  data-testid="button-example-ecommerce"
                >
                  E-commerce
                </Button>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-orange-50 hover:text-white font-medium"
                  onClick={() => {
                    handleCreateProject("Create a Slack-like real-time messaging app with WebSocket connections, channels, direct messages, file sharing, reactions, and presence indicators");
                  }}
                  data-testid="button-example-chat"
                >
                  Chat App
                </Button>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-orange-50 hover:text-white font-medium"
                  onClick={() => {
                    handleCreateProject("Design a Fortune 500-grade analytics dashboard with real-time charts, KPI widgets, data tables with sorting/filtering, date range picker, and CSV/PDF export");
                  }}
                  data-testid="button-example-dashboard"
                >
                  Dashboard
                </Button>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-orange-50 hover:text-white font-medium"
                  onClick={() => {
                    handleCreateProject("Build an AI chatbot with OpenAI GPT-4 integration, conversation memory, document upload for RAG, streaming responses, and conversation history");
                  }}
                  data-testid="button-example-ai"
                >
                  AI Assistant
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Agents & Automations Section - Replit Agent 3 Parity */}
        <div className="border-b bg-muted/30 py-6 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h2 className="text-[15px] font-semibold">Agents & Automations</h2>
                <Badge variant="secondary" className="text-[10px]">New</Badge>
              </div>
              <Button variant="ghost" size="sm" className="text-[11px]" data-testid="view-all-agents">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card 
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => setSearchQuery("Create a Slack bot that answers questions about my codebase, searches documentation, and helps team members find information")}
                data-testid="agent-template-slack"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[13px]">Slack Agent</h3>
                      <p className="text-[11px] text-muted-foreground">Q&A, research, codebase help</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                    Click to build →
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => setSearchQuery("Build a Telegram bot for customer service with appointment scheduling, FAQ responses, and calendar integration")}
                data-testid="agent-template-telegram"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[13px]">Telegram Bot</h3>
                      <p className="text-[11px] text-muted-foreground">Support, scheduling, FAQs</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                    Click to build →
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => setSearchQuery("Create a timed automation that sends daily email summaries from Linear issues, with AI-powered analysis and priority recommendations")}
                data-testid="agent-template-automation"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[13px]">Timed Automation</h3>
                      <p className="text-[11px] text-muted-foreground">Scheduled workflows, reports</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                    Click to build →
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => setSearchQuery("Build a meeting prep automation that searches the web for attendee info, summarizes with AI, and saves notes to Google Drive before each meeting")}
                data-testid="agent-template-meeting"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[13px]">Meeting Prep</h3>
                      <p className="text-[11px] text-muted-foreground">Web research, AI summaries</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                    Click to build →
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold" data-testid="text-home-title">Home</h1>
            <Button onClick={() => setIsCreateModalOpen(true)} data-testid="button-create-project">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
          
          {/* Search and filters */}
          <div className="flex items-center gap-4 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-projects"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={displayMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setDisplayMode("grid")}
                className="h-8 w-8"
                data-testid="button-view-grid"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={displayMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setDisplayMode("list")}
                className="h-8 w-8"
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Tabs */}
          <Tabs defaultValue="recent" className="mt-2" onValueChange={setActiveTab}>
            <TabsList data-testid="tabs-projects">
              <TabsTrigger value="recent" data-testid="tab-recent">Recent</TabsTrigger>
              <TabsTrigger value="name" data-testid="tab-name">Name</TabsTrigger>
              <TabsTrigger value="my-repls" data-testid="tab-my-projects">My Projects</TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
          
        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading ? (
              <ECodeLoading centered size="lg" text="Loading projects..." />
            ) : sortedProjects && sortedProjects.length > 0 ? (
              displayMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="bg-card border border-border hover:border-primary transition-colors cursor-pointer"
                      onClick={() => navigate(getProjectUrl(project, user?.username))}
                      data-testid={`card-project-${project.id}`}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-[15px]">
                          <div className="flex items-center gap-2 truncate">
                            <Code className="h-4 w-4 flex-shrink-0 text-primary" />
                            <span className="truncate">{project?.name || 'Untitled Project'}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Fork</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Trash className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user?.avatarUrl || `https://avatar.vercel.sh/${user?.username || 'user'}.png`} />
                            <AvatarFallback className="text-[10px]">{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground truncate">{user?.username || 'user'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="border-t border-border pt-3 flex justify-between">
                        <Badge variant="outline" className="text-[11px] flex items-center gap-1 h-5">
                          {project.language ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-primary"></span>
                              {project.language}
                            </>
                          ) : (
                            <>
                              <span className="h-2 w-2 rounded-full bg-muted"></span>
                              misc
                            </>
                          )}
                        </Badge>
                        <div className="text-[11px] text-muted-foreground flex items-center">
                          {project.visibility === 'public' ? (
                            <Globe className="h-3 w-3 mr-1" />
                          ) : (
                            <Lock className="h-3 w-3 mr-1" />
                          )}
                          <span>{project.visibility || 'private'}</span>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center p-3 border rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => navigate(getProjectUrl(project, user?.username))}
                      data-testid={`row-project-${project.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-primary" />
                          <span className="font-medium">{project.name}</span>
                          <Badge variant="outline" className="text-[11px] flex items-center gap-1 h-5">
                            {project.language || 'misc'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={user?.avatarUrl || `https://avatar.vercel.sh/${user?.username || 'user'}.png`} />
                            <AvatarFallback className="text-[8px]">{user?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{user?.username}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span className="truncate">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="ml-4 flex items-center">
                        {project.visibility === 'public' ? (
                          <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                        ) : (
                          <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Fork</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12 bg-card rounded-lg border border-border">
                <h3 className="text-xl mb-2">Welcome, {user?.username || 'user'}!</h3>
                <p className="text-muted-foreground mb-6">Create your first project to get started with PLOT</p>
                <Button onClick={() => setIsCreateModalOpen(true)} data-testid="button-create-first-project">
                  <Plus className="h-4 w-4 mr-2" />
                  Create a Project
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <CreateProjectModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
        isLoading={createProjectMutation.isPending}
        initialDescription={searchQuery}
      />

      {/* Build Mode Selector - "Build full app vs Design only" */}
      <BuildModeSelector
        open={isBuildModeOpen}
        onOpenChange={setIsBuildModeOpen}
        onSelectMode={handleSelectBuildMode}
        projectName={pendingPrompt.slice(0, 50) + (pendingPrompt.length > 50 ? '...' : '')}
      />
      
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        }}
      />
    </AppLayout>
    </>
  );
}
