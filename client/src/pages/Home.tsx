import { useState } from "react";
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
  Globe
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recent");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/projects', { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsCreateModalOpen(false);
      navigate(`/project/${data.id}`);
      toast({
        title: "Project created!",
        description: `${data.name} has been created successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreateProject = (name: string) => {
    createProjectMutation.mutate(name);
  };

  // Filter projects based on search query
  const filteredProjects = projects?.filter(
    (project) => project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort projects based on active tab
  const sortedProjects = filteredProjects?.sort((a, b) => {
    if (activeTab === "recent") {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Hero Section with Chat Input - Replit Style */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Let's build something amazing</h1>
            <p className="text-xl mb-6 text-blue-100">The collaborative, in-browser IDE that makes coding accessible</p>
            
            <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg border border-white/20 shadow-xl">
              <div className="flex items-center gap-2 bg-white dark:bg-black rounded-md p-1">
                <Input 
                  placeholder="Describe your project idea..."
                  className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  className="shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <span className="hidden sm:inline">Create Project</span>
                  <Plus className="h-4 w-4 sm:ml-2" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 px-2 pt-3 text-sm text-white/80">
                <span>Try:</span>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-100 hover:text-white"
                  onClick={() => {
                    setSearchQuery("Basic web app with HTML, CSS, and JavaScript");
                    setIsCreateModalOpen(true);
                  }}
                >
                  Basic web app
                </Button>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-100 hover:text-white"
                  onClick={() => {
                    setSearchQuery("Flask API with Python backend");
                    setIsCreateModalOpen(true);
                  }}
                >
                  Flask API
                </Button>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-100 hover:text-white"
                  onClick={() => {
                    setSearchQuery("React dashboard with UI components");
                    setIsCreateModalOpen(true);
                  }}
                >
                  React dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Home</h1>
            <Button onClick={() => setIsCreateModalOpen(true)}>
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
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={displayMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setDisplayMode("grid")}
                className="h-8 w-8"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={displayMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setDisplayMode("list")}
                className="h-8 w-8"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Tabs */}
          <Tabs defaultValue="recent" className="mt-2" onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="name">Name</TabsTrigger>
              <TabsTrigger value="my-repls">My Projects</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
          
        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading ? (
              <div className={`${displayMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-2"}`}>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="bg-card border border-border">
                    <CardHeader className="animate-pulse h-14 bg-muted"></CardHeader>
                    <CardContent className="animate-pulse h-20 bg-muted mt-2"></CardContent>
                    <CardFooter className="animate-pulse h-10 bg-muted mt-2"></CardFooter>
                  </Card>
                ))}
              </div>
            ) : sortedProjects && sortedProjects.length > 0 ? (
              displayMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedProjects.map((project) => (
                    <Card 
                      key={project.id} 
                      className="bg-card border border-border hover:border-primary transition-colors cursor-pointer"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-lg">
                          <div className="flex items-center gap-2 truncate">
                            <Code className="h-4 w-4 flex-shrink-0 text-primary" />
                            <span className="truncate">{project.name}</span>
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
                            <AvatarImage src={`https://avatar.vercel.sh/${user?.username || 'user'}.png`} />
                            <AvatarFallback className="text-[10px]">{user?.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">{user?.username || 'user'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="border-t border-border pt-3 flex justify-between">
                        <Badge variant="outline" className="text-xs flex items-center gap-1 h-5">
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
                        <div className="text-xs text-muted-foreground flex items-center">
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
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-primary" />
                          <span className="font-medium">{project.name}</span>
                          <Badge variant="outline" className="text-xs flex items-center gap-1 h-5">
                            {project.language || 'misc'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={`https://avatar.vercel.sh/${user?.username || 'user'}.png`} />
                            <AvatarFallback className="text-[8px]">{user?.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
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
                <Button onClick={() => setIsCreateModalOpen(true)}>
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
    </AppLayout>
  );
}
