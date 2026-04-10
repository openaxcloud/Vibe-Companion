import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useMemo } from "react";

export type RiskThreshold = 'low' | 'medium' | 'high' | 'critical';
export type SessionStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface MaxAutonomySession {
  id: string;
  status: SessionStatus;
  goal: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentTaskId: string | null;
  checkpointsCreated: number;
  rollbacksPerformed: number;
  testsRun: number;
  testsPassed: number;
  totalTokensUsed: number;
  totalCostUsd: string;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MaxAutonomyTask {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: TaskPriority;
  status: TaskStatus;
  order: number;
  dependencies: string[];
  retryCount: number;
  estimatedDurationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface CurrentTaskDelegation {
  tier: 'fast' | 'balanced' | 'quality';
  model: string;
  provider: string;
  reason?: string;
  taskComplexity?: number;
  estimatedTokens?: number;
}

export interface SessionProgress {
  sessionId: string;
  status: SessionStatus;
  goal: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  tasksPending: number;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  checkpointsCreated: number;
  rollbacksPerformed: number;
  testsRun: number;
  testsPassed: number;
  totalTokensUsed: number;
  totalCostUsd: string;
  elapsedTimeMs: number;
  estimatedRemainingMs: number;
  etaConfidence: number;
  etaBasedOnSamples: number;
  startedAt: string | null;
  pausedAt: string | null;
  // Orchestrator delegation info for current task
  currentTaskDelegation?: CurrentTaskDelegation;
}

export interface StartSessionParams {
  projectId: number;
  goal: string;
  model?: string;
  maxDurationMinutes?: number;
  executionIntervalMs?: number;
  autoCheckpoint?: boolean;
  autoTest?: boolean;
  autoRollback?: boolean;
  riskThreshold?: RiskThreshold;
}

interface SessionResponse {
  success: boolean;
  session: MaxAutonomySession;
}

interface TasksResponse {
  success: boolean;
  sessionId: string;
  count: number;
  tasks: MaxAutonomyTask[];
}

interface ProgressResponse {
  success: boolean;
  progress: SessionProgress;
}

interface SessionActionResponse {
  success: boolean;
  sessionId: string;
  status: SessionStatus;
  message: string;
}

interface SessionsListResponse {
  success: boolean;
  count: number;
  sessions: MaxAutonomySession[];
}

const POLLING_INTERVAL_MS = 2000;
const TERMINAL_STATUSES: SessionStatus[] = ['completed', 'failed', 'cancelled'];
const ACTIVE_STATUSES: SessionStatus[] = ['active', 'pending'];

function shouldPollSession(session: MaxAutonomySession | undefined | null): number | false {
  if (!session) return false;
  if (TERMINAL_STATUSES.includes(session.status)) return false;
  if (ACTIVE_STATUSES.includes(session.status)) return POLLING_INTERVAL_MS;
  return false;
}

export function useMaxAutonomy(sessionId: string | null, projectId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isSessionEnabled = !!sessionId;

  const sessionQuery = useQuery<SessionResponse>({
    queryKey: ['/api/autonomy/sessions', sessionId],
    queryFn: async () => {
      return apiRequest<SessionResponse>("GET", `/api/autonomy/sessions/${sessionId}`);
    },
    enabled: isSessionEnabled,
    refetchInterval: (_data, _query) => shouldPollSession(_data?.session),
    staleTime: 1000,
  });

  const progressQuery = useQuery<ProgressResponse>({
    queryKey: ['/api/autonomy/sessions', sessionId, 'progress'],
    queryFn: async () => {
      return apiRequest<ProgressResponse>("GET", `/api/autonomy/sessions/${sessionId}/progress`);
    },
    enabled: isSessionEnabled,
    refetchInterval: (_data, _query) => {
      const session = sessionQuery.data?.session;
      if (!session || TERMINAL_STATUSES.includes(session.status)) return false;
      return ACTIVE_STATUSES.includes(session.status) ? POLLING_INTERVAL_MS : false;
    },
    staleTime: 1000,
  });

  const tasksQuery = useQuery<TasksResponse>({
    queryKey: ['/api/autonomy/sessions', sessionId, 'tasks'],
    queryFn: async () => {
      return apiRequest<TasksResponse>("GET", `/api/autonomy/sessions/${sessionId}/tasks`);
    },
    enabled: isSessionEnabled,
    refetchInterval: (_data, _query) => {
      const session = sessionQuery.data?.session;
      if (!session || TERMINAL_STATUSES.includes(session.status)) return false;
      return ACTIVE_STATUSES.includes(session.status) ? POLLING_INTERVAL_MS : false;
    },
    staleTime: 1000,
  });

  const sessionsListQuery = useQuery<SessionsListResponse>({
    queryKey: ['/api/autonomy/sessions'],
    queryFn: async () => {
      return apiRequest<SessionsListResponse>("GET", `/api/autonomy/sessions?limit=10`);
    },
    enabled: !!projectId,
    staleTime: 10000,
  });

  const isPolling = useMemo(() => {
    const session = sessionQuery.data?.session;
    return session ? ACTIVE_STATUSES.includes(session.status) : false;
  }, [sessionQuery.data?.session]);

  const invalidateAll = useCallback(() => {
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: ['/api/autonomy/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/autonomy/sessions', sessionId, 'progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/autonomy/sessions', sessionId, 'tasks'] });
    }
    queryClient.invalidateQueries({ queryKey: ['/api/autonomy/sessions'] });
  }, [queryClient, sessionId]);

  const startSessionMutation = useMutation<SessionResponse, Error, StartSessionParams>({
    mutationFn: async (params: StartSessionParams) => {
      return apiRequest<SessionResponse>("POST", "/api/autonomy/sessions", params);
    },
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast({
          title: "Session Started",
          description: `Autonomous session "${response.session.goal.substring(0, 50)}..." has begun`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pauseSessionMutation = useMutation<SessionActionResponse, Error, void>({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Session ID is required");
      if (!projectId) throw new Error("Project ID is required");
      return apiRequest<SessionActionResponse>("POST", `/api/autonomy/sessions/${sessionId}/pause`);
    },
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast({
          title: "Session Paused",
          description: response.message || "Autonomous execution has been paused",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to pause session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resumeSessionMutation = useMutation<SessionActionResponse, Error, void>({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Session ID is required");
      if (!projectId) throw new Error("Project ID is required");
      return apiRequest<SessionActionResponse>("POST", `/api/autonomy/sessions/${sessionId}/resume`);
    },
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast({
          title: "Session Resumed",
          description: response.message || "Autonomous execution has resumed",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resume session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stopSessionMutation = useMutation<SessionActionResponse, Error, void>({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Session ID is required");
      if (!projectId) throw new Error("Project ID is required");
      return apiRequest<SessionActionResponse>("POST", `/api/autonomy/sessions/${sessionId}/stop`);
    },
    onSuccess: (response) => {
      if (response.success) {
        invalidateAll();
        toast({
          title: "Session Stopped",
          description: response.message || "Autonomous execution has been stopped",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    session: sessionQuery.data?.session ?? null,
    isLoadingSession: sessionQuery.isLoading,
    sessionError: sessionQuery.error,

    progress: progressQuery.data?.progress ?? null,
    isLoadingProgress: progressQuery.isLoading,
    progressError: progressQuery.error,

    tasks: tasksQuery.data?.tasks ?? [],
    taskCount: tasksQuery.data?.count ?? 0,
    isLoadingTasks: tasksQuery.isLoading,
    tasksError: tasksQuery.error,

    sessions: sessionsListQuery.data?.sessions ?? [],
    isLoadingSessions: sessionsListQuery.isLoading,

    isPolling,

    startSession: startSessionMutation.mutate,
    startSessionAsync: startSessionMutation.mutateAsync,
    isStartingSession: startSessionMutation.isPending,

    pauseSession: pauseSessionMutation.mutate,
    pauseSessionAsync: pauseSessionMutation.mutateAsync,
    isPausingSession: pauseSessionMutation.isPending,

    resumeSession: resumeSessionMutation.mutate,
    resumeSessionAsync: resumeSessionMutation.mutateAsync,
    isResumingSession: resumeSessionMutation.isPending,

    stopSession: stopSessionMutation.mutate,
    stopSessionAsync: stopSessionMutation.mutateAsync,
    isStoppingSession: stopSessionMutation.isPending,

    refetchSession: sessionQuery.refetch,
    refetchProgress: progressQuery.refetch,
    refetchTasks: tasksQuery.refetch,
    invalidateAll,
  };
}

export function useMaxAutonomyHealth() {
  return useQuery({
    queryKey: ['/api/autonomy/health'],
    queryFn: async () => {
      return apiRequest<{
        status: string;
        service: string;
        timestamp: string;
        features: {
          sessionManagement: boolean;
          taskQueue: boolean;
          autoCheckpoint: boolean;
          autoTest: boolean;
          autoRollback: boolean;
        };
      }>("GET", "/api/autonomy/health");
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
