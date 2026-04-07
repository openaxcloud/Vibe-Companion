/**
 * IDEPage - Web IDE entry point
 * 
 * Loads project data and renders the UnifiedIDELayout component
 * which handles all responsive layouts (desktop/tablet/mobile).
 */

import { useCallback, Suspense, useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Project } from '@shared/schema';
import { ECodeLoading } from '@/components/ECodeLoading';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import UnifiedIDELayout from '@/components/ide/UnifiedIDELayout';

import('@/lib/monaco-config');

export default function IDEPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const projectId = (params.projectId || params.id) as string;

  // ✅ FIX (Dec 11, 2025): Persist bootstrap token in state to survive URL changes
  // Extract token from URL only once on mount or when projectId changes
  const initialTokenRef = useRef<string | null>(null);
  const [stableBootstrapToken, setStableBootstrapToken] = useState<string | null>(null);
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get('bootstrap');
    
    // Only set if we have a token and haven't already captured one for this project
    if (urlToken && initialTokenRef.current !== urlToken) {
      initialTokenRef.current = urlToken;
      setStableBootstrapToken(urlToken);
    }
  }, [projectId]);
  
  // For query purposes, still extract from URL each time
  const searchParams = new URLSearchParams(window.location.search);
  const urlBootstrapToken = searchParams.get('bootstrap');
  
  // Use stable token for AutonomousWorkspaceViewer, URL token for queries
  const bootstrapToken = stableBootstrapToken;
  
  const handleWorkspaceComplete = useCallback(() => {
    // Clear the stable bootstrap token - workspace creation is complete
    setStableBootstrapToken(null);
    initialTokenRef.current = null;
    
    const url = new URL(window.location.href);
    url.searchParams.delete('bootstrap');
    window.history.replaceState({}, '', url);

    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });

    toast({
      title: "Workspace Ready!",
      description: "Your AI-powered workspace has been created successfully.",
    });
  }, [projectId, queryClient, toast]);

  const handleWorkspaceError = useCallback((error: string) => {
    toast({
      title: "Workspace Creation Failed",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  // ✅ FIX (Dec 25, 2025): Handle agent bootstrap failure by clearing the token
  // This allows the agent panel to exit "Initializing Agent" state and enable chat
  const handleBootstrapFailure = useCallback(() => {
    // Clear the stable bootstrap token so isBootstrapping becomes false
    setStableBootstrapToken(null);
    initialTokenRef.current = null;
    
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('bootstrap');
    window.history.replaceState({}, '', url);
  }, []);

  // Determine if we can fetch the project
  // Either user is authenticated OR we have a bootstrap token for autonomous workspace
  const canFetchProject = !!projectId && !isAuthLoading && (!!user || !!bootstrapToken);
  
  // ✅ FIX (Dec 25, 2025): Use stable query key without bootstrap flag
  // The bootstrap token is only needed for the initial fetch - once we have the project,
  // we don't want clearing the token to invalidate the cache and cause "Project not found"
  const { data: project, isLoading: isLoadingProject, fetchStatus } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      // Use the current bootstrapToken value for the fetch, but it's not in the query key
      // This ensures the cache persists even after the token is cleared
      const url = `/api/projects/${projectId}${bootstrapToken ? `?bootstrap=${bootstrapToken}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to fetch project: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    enabled: canFetchProject,
    // Keep stale data when the query is disabled to prevent "Project not found" flash
    staleTime: Infinity,
  });

  // Show loading while auth is loading OR project is actually being fetched
  // In TanStack Query v5, isLoading can be true even when query is disabled,
  // so we check fetchStatus === 'fetching' to know if we're actually loading
  if (isAuthLoading || (canFetchProject && fetchStatus === 'fetching' && !project)) {
    return <div data-testid="ide-loading-auth"><ECodeLoading fullScreen size="lg" text="Loading..." /></div>;
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Project not found</h2>
          <Button onClick={() => navigate('/projects')} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const normalizedProjectId = String(project?.id ?? projectId);

  return (
    <>
      <Toaster />
      <ErrorBoundary>
        <Suspense fallback={<div data-testid="ide-loading-layout"><ECodeLoading fullScreen size="lg" text="Loading IDE..." /></div>}>
          <UnifiedIDELayout 
            projectId={normalizedProjectId}
            bootstrapToken={bootstrapToken}
            onWorkspaceComplete={handleWorkspaceComplete}
            onWorkspaceError={handleWorkspaceError}
            onBootstrapFailure={handleBootstrapFailure}
          />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}