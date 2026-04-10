import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Checkpoint } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export interface NavigationOptions {
  canRollback: boolean;
  canRollforward: boolean;
  currentCheckpoint: Checkpoint | null;
  previousCheckpoint: Checkpoint | null;
  nextCheckpoint: Checkpoint | null;
  history: Checkpoint[];
}

export interface CreateCheckpointData {
  projectId: number;
  name: string;
  description?: string;
  type?: "manual" | "automatic" | "before_action" | "error_recovery";
  userId: number;
  includeDatabase?: boolean;
  includeEnvironment?: boolean;
  conversationSnapshot?: any;
  conversationId?: string;
  userPrompt?: string;
  changedFiles?: string[];
  testResults?: any;
  parentCheckpointId?: number;
  environment?: "development" | "production";
}

export interface RollbackData {
  projectId: number;
  checkpointId: number;
  userId: number;
  restoreConversation?: boolean;
}

export interface CheckpointResponse {
  success: boolean;
  checkpoint?: Checkpoint;
  message?: string;
  error?: string;
}

export interface CheckpointsListResponse {
  success: boolean;
  checkpoints: Checkpoint[];
  count: number;
}

export interface NavigationResponse {
  success: boolean;
  navigation: NavigationOptions;
}

export interface RollbackResponse {
  success: boolean;
  result: {
    success: boolean;
    error?: string;
    restoredCheckpoint?: Checkpoint;
  };
  message?: string;
}

export function useCheckpoints(projectId: number | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const checkpointsQuery = useQuery<CheckpointsListResponse>({
    queryKey: ["/api/projects", projectId, "checkpoints"],
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID is required");
      return apiRequest<CheckpointsListResponse>(
        "GET",
        `/api/projects/${projectId}/checkpoints`
      );
    },
    enabled: !!projectId,
  });

  const navigationQuery = useQuery<NavigationResponse>({
    queryKey: ["/api/projects", projectId, "checkpoints", "navigation"],
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID is required");
      return apiRequest<NavigationResponse>(
        "GET",
        `/api/projects/${projectId}/checkpoints/navigation`
      );
    },
    enabled: !!projectId,
  });

  const createCheckpointMutation = useMutation<CheckpointResponse, Error, CreateCheckpointData>({
    mutationFn: async (data: CreateCheckpointData) => {
      return apiRequest<CheckpointResponse>("POST", "/api/checkpoints", data);
    },
    onSuccess: (response) => {
      if (response.success && projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints", "navigation"] });
        toast({
          title: "Checkpoint created",
          description: response.message || `Checkpoint "${response.checkpoint?.name}" created successfully`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create checkpoint",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rollbackMutation = useMutation<RollbackResponse, Error, RollbackData>({
    mutationFn: async (data: RollbackData) => {
      return apiRequest<RollbackResponse>("POST", "/api/checkpoints/rollback", data);
    },
    onSuccess: (response) => {
      if (response.success && projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints", "navigation"] });
        toast({
          title: "Rollback successful",
          description: response.message || "Successfully rolled back to previous checkpoint",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Rollback failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rollforwardMutation = useMutation<RollbackResponse, Error, RollbackData>({
    mutationFn: async (data: RollbackData) => {
      return apiRequest<RollbackResponse>("POST", "/api/checkpoints/rollforward", data);
    },
    onSuccess: (response) => {
      if (response.success && projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints", "navigation"] });
        toast({
          title: "Rollforward successful",
          description: response.message || "Successfully rolled forward to next checkpoint",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Rollforward failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCheckpointMutation = useMutation<{ success: boolean; message?: string }, Error, number>({
    mutationFn: async (checkpointId: number) => {
      return apiRequest<{ success: boolean; message?: string }>(
        "DELETE",
        `/api/checkpoints/${checkpointId}`
      );
    },
    onSuccess: (response) => {
      if (response.success && projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "checkpoints", "navigation"] });
        toast({
          title: "Checkpoint deleted",
          description: response.message || "Checkpoint deleted successfully",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete checkpoint",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    checkpoints: checkpointsQuery.data?.checkpoints ?? [],
    checkpointsCount: checkpointsQuery.data?.count ?? 0,
    isLoadingCheckpoints: checkpointsQuery.isLoading,
    checkpointsError: checkpointsQuery.error,

    navigation: navigationQuery.data?.navigation ?? null,
    isLoadingNavigation: navigationQuery.isLoading,
    navigationError: navigationQuery.error,

    createCheckpoint: createCheckpointMutation.mutate,
    createCheckpointAsync: createCheckpointMutation.mutateAsync,
    isCreatingCheckpoint: createCheckpointMutation.isPending,

    rollback: rollbackMutation.mutate,
    rollbackAsync: rollbackMutation.mutateAsync,
    isRollingBack: rollbackMutation.isPending,

    rollforward: rollforwardMutation.mutate,
    rollforwardAsync: rollforwardMutation.mutateAsync,
    isRollingForward: rollforwardMutation.isPending,

    deleteCheckpoint: deleteCheckpointMutation.mutate,
    deleteCheckpointAsync: deleteCheckpointMutation.mutateAsync,
    isDeletingCheckpoint: deleteCheckpointMutation.isPending,

    refetchCheckpoints: checkpointsQuery.refetch,
    refetchNavigation: navigationQuery.refetch,
  };
}

export function useCheckpointById(checkpointId: number | undefined) {
  return useQuery<CheckpointResponse>({
    queryKey: ["/api/checkpoints", checkpointId],
    queryFn: async () => {
      if (!checkpointId) throw new Error("Checkpoint ID is required");
      return apiRequest<CheckpointResponse>("GET", `/api/checkpoints/${checkpointId}`);
    },
    enabled: !!checkpointId,
  });
}
