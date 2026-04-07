import { useState, useEffect } from "react";
import { LazyMotionDiv, LazyAnimatePresence } from "@/lib/motion";
import {
  Plus,
  Search,
  MoreVertical,
  ExternalLink,
  Clock,
  Globe,
  Lock,
  Users,
  Trash2,
  Edit3,
  FolderOpen,
  Star,
  Grid3x3,
  List,
  ChevronDown,
  Filter,
  SortAsc,
  ArrowRight,
  Code2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface AppsViewProps {
  onOpenApp: (appId: number) => void;
  onBack: () => void;
}

export function AppsView({ onOpenApp, onBack }: AppsViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "private" | "public" | "unlisted">("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "created">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Create/Edit Project Dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "public" | "unlisted",
    language: "javascript" as any,
  });
  const [savingProject, setSavingProject] = useState(false);

  // Delete Confirmation
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  // Load projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof projectForm) => {
      return await apiRequest<Project>("POST", "/api/projects", data);
    },
    onSuccess: () => {
      toast({ title: "Project created successfully" });
      setShowCreateDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: `Error creating project: ${error.message}`, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof projectForm> }) => {
      return await apiRequest<Project>("PATCH", `/api/projects/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Project updated successfully" });
      setShowCreateDialog(false);
      setEditingProject(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: `Error updating project: ${error.message}`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Project deleted successfully" });
      setDeletingProject(null);
      setConfirmDelete("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: `Error deleting project: ${error.message}`, variant: "destructive" });
    },
  });

  const handleSaveProject = async () => {
    if (!projectForm.name.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: projectForm });
    } else {
      createMutation.mutate(projectForm);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject || confirmDelete !== deletingProject.name) {
      toast({ title: "Error", description: "Project name doesn't match", variant: "destructive" });
      return;
    }
    deleteMutation.mutate(deletingProject.id);
  };

  const resetForm = () => {
    setProjectForm({
      name: "",
      description: "",
      visibility: "private",
      language: "javascript",
    });
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || "",
      visibility: project.visibility,
      language: project.language || "javascript",
    });
    setShowCreateDialog(true);
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      // Filter by tab
      if (filterTab !== "all" && project.visibility !== filterTab) return false;

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "private":
        return <Lock className="w-4 h-4 text-muted-foreground" />;
      case "public":
        return <Globe className="w-4 h-4 text-blue-500" />;
      case "unlisted":
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Lock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-[13px] text-muted-foreground">
                Manage and deploy your projects
              </p>
            </div>
          </div>
          <Button onClick={() => {
            resetForm();
            setEditingProject(null);
            setShowCreateDialog(true);
          }} data-testid="button-create-project">
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="private">Private</TabsTrigger>
              <TabsTrigger value="public">Public</TabsTrigger>
              <TabsTrigger value="unlisted">Unlisted</TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SortAsc className="w-4 h-4 mr-2" />
                Sort: {sortBy === "recent" ? "Recent" : sortBy === "name" ? "Name" : "Created"}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy("recent")}>
                <Clock className="w-4 h-4 mr-2" />
                Recently Updated
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                <SortAsc className="w-4 h-4 mr-2" />
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("created")}>
                <Clock className="w-4 h-4 mr-2" />
                Created Date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              data-testid="button-grid-view"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              data-testid="button-list-view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Code2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-[15px] font-semibold mb-2">No projects found</h3>
            <p className="text-[13px] text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Create your first project to get started"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <LazyAnimatePresence mode="popLayout">
              {filteredProjects.map((project) => (
                <LazyMotionDiv
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="hover:shadow-lg transition-all cursor-pointer group" data-testid={`card-project-${project.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getVisibilityIcon(project.visibility)}
                          <CardTitle className="text-base">{project.name}</CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-menu-${project.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenApp(project.id)}>
                              <FolderOpen className="w-4 h-4 mr-2" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(project)}>
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingProject(project)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {project.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                        {project.language && (
                          <Badge variant="outline" className="text-[11px]">
                            {project.language}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onOpenApp(project.id)}
                        className="w-full"
                        data-testid={`button-open-${project.id}`}
                      >
                        Open
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </LazyMotionDiv>
              ))}
            </LazyAnimatePresence>
          </div>
        ) : (
          <div className="space-y-2">
            <LazyAnimatePresence mode="popLayout">
              {filteredProjects.map((project) => (
                <LazyMotionDiv
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer group" data-testid={`row-project-${project.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {getVisibilityIcon(project.visibility)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[13px] font-semibold truncate">{project.name}</h3>
                            {project.language && (
                              <Badge variant="outline" className="text-[11px]">
                                {project.language}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {project.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => onOpenApp(project.id)}
                            data-testid={`button-open-list-${project.id}`}
                          >
                            Open
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onOpenApp(project.id)}>
                                <FolderOpen className="w-4 h-4 mr-2" />
                                Open
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(project)}>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletingProject(project)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </LazyMotionDiv>
              ))}
            </LazyAnimatePresence>
          </div>
        )}
      </div>

      {/* Create/Edit Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update your project settings"
                : "Create a new project to start building"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="my-awesome-project"
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                data-testid="input-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What does your project do?"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={3}
                data-testid="textarea-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={projectForm.visibility}
                onValueChange={(v) => setProjectForm({ ...projectForm, visibility: v as any })}
              >
                <SelectTrigger data-testid="select-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Private - Only you
                    </div>
                  </SelectItem>
                  <SelectItem value="unlisted">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Unlisted - Anyone with link
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Public - Everyone
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language (optional)</Label>
              <Select
                value={projectForm.language}
                onValueChange={(v) => setProjectForm({ ...projectForm, language: v })}
              >
                <SelectTrigger data-testid="select-language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                  <SelectItem value="rust">Rust</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSaveProject} disabled={savingProject || createMutation.isPending || updateMutation.isPending} data-testid="button-save">
              {(savingProject || createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the project and all its data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-[13px]">
              Please type <span className="font-mono font-semibold">{deletingProject?.name}</span> to
              confirm deletion.
            </p>
            <Input
              placeholder="Type project name"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              data-testid="input-confirm-delete"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeletingProject(null);
              setConfirmDelete("");
            }} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={confirmDelete !== deletingProject?.name || deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
