import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ECodeLoading } from "@/components/ECodeLoading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";

export default function ProjectPage() {
  const { toast } = useToast();
  const { isLoading: authLoading } = useAuth();

  const [, paramsProject] = useRoute("/project/:id");
  const [, paramsLegacyProject] = useRoute("/projects/:id");
  const [, paramsSlug] = useRoute("/@:username/:projectname");
  const [, paramsUserSlug] = useRoute("/u/:username/:projectname");

  const slugParams = paramsSlug ?? paramsUserSlug ?? null;
  const slug = slugParams?.projectname ?? null;
  const username = slugParams?.username ?? null;
  const directProjectId = paramsProject?.id ?? paramsLegacyProject?.id ?? null;

  const shouldFetchSlug = !!slug && !!username && !directProjectId;

  const {
    data: slugProject,
    isLoading: slugLoading,
    error: slugError,
  } = useQuery<Project>({
    queryKey: ["project-by-slug", username, slug],
    enabled: shouldFetchSlug && !authLoading,
    retry: false,
    queryFn: async () => {
      // apiRequest already handles response parsing and content-type checking
      const project = await apiRequest<Project>("GET", `/api/u/${username}/${slug}`);
      return project;
    },
  });

  useEffect(() => {
    if (slugError) {
      toast({
        title: "Unable to open project",
        description: slugError.message,
        variant: "destructive",
      });
    }
  }, [slugError, toast]);

  if (authLoading || (shouldFetchSlug && slugLoading)) {
    return <ECodeLoading fullScreen size="lg" text="Loading workspace..." />;
  }

  if (slugError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTitle>Workspace unavailable</AlertTitle>
          <AlertDescription>
            {slugError.message || "We couldn’t load this project. Check the project visibility or try again."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.history.back()} variant="outline" data-testid="button-go-back">
          Go back
        </Button>
      </div>
    );
  }

  const resolvedProjectId = directProjectId ?? slugProject?.id ?? null;

  if (!resolvedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Alert className="max-w-md">
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Choose a project from your dashboard to open it in the workspace.
          </AlertDescription>
        </Alert>
        <Button onClick={() => (window.location.href = "/projects")} data-testid="button-browse-projects">
          Browse projects
        </Button>
      </div>
    );
  }

  // Redirect to new IDE using SPA navigation to preserve client state
  // This ensures slug URLs also get the new IDE with Add Tab dropdown
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (resolvedProjectId) {
      setLocation(`/ide/${resolvedProjectId}`);
    }
  }, [resolvedProjectId, setLocation]);

  return <ECodeLoading fullScreen size="lg" text="Loading workspace..." />;
}
