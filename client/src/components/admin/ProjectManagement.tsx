import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Eye, Edit, Trash2, Pin, PinOff, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  language: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  views: number;
  likes: number;
  forks: number;
  runs: number;
  isPinned: boolean;
  slug: string | null;
  owner?: {
    username: string;
    email: string;
  };
}

export function ProjectManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const pageSize = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/projects', { search, visibility: visibilityFilter, language: languageFilter, page }],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });
      if (search) params.append('search', search);
      if (visibilityFilter !== 'all') params.append('visibility', visibilityFilter);
      if (languageFilter !== 'all') params.append('language', languageFilter);
      
      return fetch(`/api/admin/projects?${params}`).then(res => res.json());
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ projectId, isPinned }: { projectId: string; isPinned: boolean }) => {
      const endpoint = isPinned ? 'unpin' : 'pin';
      return apiRequest('PATCH', `/api/admin/projects/${projectId}/${endpoint}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects'] });
      toast({ title: "Success", description: "Project pin status updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pin status", variant: "destructive" });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest('DELETE', `/api/admin/projects/${projectId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects'] });
      toast({ title: "Success", description: "Project deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ projectId, updates }: { projectId: string; updates: any }) => {
      return apiRequest('PATCH', `/api/admin/projects/${projectId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects'] });
      setEditDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Success", description: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update project", variant: "destructive" });
    }
  });

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setEditDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProject) return;

    const formData = new FormData(e.currentTarget);
    const updates = {
      name: formData.get('name'),
      description: formData.get('description'),
      visibility: formData.get('visibility'),
    };

    updateProjectMutation.mutate({ projectId: editingProject.id, updates });
  };

  const projects = data?.projects || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Management</CardTitle>
        <CardDescription>Monitor and manage platform projects</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-projects"
                  placeholder="Search by project name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={visibilityFilter} onValueChange={(value) => { setVisibilityFilter(value); setPage(0); }}>
              <SelectTrigger data-testid="select-filter-visibility" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value="public">Public Only</SelectItem>
                <SelectItem value="private">Private Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={languageFilter} onValueChange={(value) => { setLanguageFilter(value); setPage(0); }}>
              <SelectTrigger data-testid="select-filter-language" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="go">Go</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="java">Java</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="button-refresh" onClick={() => refetch()} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Stats</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No projects found
                        </TableCell>
                      </TableRow>
                    ) : (
                      projects.map((project: Project) => (
                        <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {project.isPinned && <Pin className="h-3 w-3 text-yellow-500" />}
                              <div>
                                <div className="font-medium">{project.name}</div>
                                {project.description && (
                                  <div className="text-[13px] text-muted-foreground line-clamp-1">
                                    {project.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[13px]">{project.owner?.username || 'Unknown'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={project.visibility === 'public' ? 'default' : 'secondary'}>
                              {project.visibility}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{project.language || 'None'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-[11px] space-y-1">
                              <div>👁️ {project.views} views</div>
                              <div>❤️ {project.likes} likes</div>
                              <div>🔀 {project.forks} forks</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[13px] text-muted-foreground">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                data-testid={`button-pin-${project.id}`}
                                onClick={() => togglePinMutation.mutate({ projectId: project.id, isPinned: project.isPinned })}
                                variant="ghost"
                                size="icon"
                                disabled={togglePinMutation.isPending}
                              >
                                {project.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                              </Button>
                              <Button
                                data-testid={`button-edit-${project.id}`}
                                onClick={() => handleEdit(project)}
                                variant="ghost"
                                size="icon"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    data-testid={`button-delete-${project.id}`}
                                    variant="ghost"
                                    size="icon"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{project.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      data-testid={`button-confirm-delete-${project.id}`}
                                      onClick={() => deleteProjectMutation.mutate(project.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-muted-foreground">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} projects
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      data-testid="button-prev-page"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <div className="text-[13px]">
                      Page {page + 1} of {totalPages}
                    </div>
                    <Button
                      data-testid="button-next-page"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project details</DialogDescription>
            </DialogHeader>
            {editingProject && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    data-testid="input-edit-name"
                    id="name"
                    name="name"
                    defaultValue={editingProject.name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    data-testid="input-edit-description"
                    id="description"
                    name="description"
                    defaultValue={editingProject.description || ''}
                  />
                </div>
                <div>
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select name="visibility" defaultValue={editingProject.visibility}>
                    <SelectTrigger data-testid="select-edit-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    data-testid="button-save-project"
                    type="submit"
                    disabled={updateProjectMutation.isPending}
                  >
                    {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
