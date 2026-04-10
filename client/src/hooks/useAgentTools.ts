import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useMemo, useState } from "react";
import type { AiModel } from "@shared/schema";

export interface AgentToolsSettings {
  maxAutonomy: boolean;
  appTesting: boolean;
  extendedThinking: boolean;
  highPowerModels: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
}

export interface AgentPreferences {
  extendedThinking: boolean;
  highPowerMode: boolean;
  autoWebSearch: boolean;
  preferredModel: AiModel;
  customInstructions: string | null;
  improvePromptEnabled: boolean;
  progressTabEnabled: boolean;
  pauseResumeEnabled: boolean;
  autoCheckpoints: boolean;
}

export interface ModelInfo {
  id: AiModel;
  name: string;
  description: string;
  category: 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot';
  tier: 'standard' | 'high-power';
  capabilities: {
    extendedThinking: boolean;
    codeGeneration: boolean;
    maxTokens: number;
    speed: 'fast' | 'medium' | 'slow';
    cost: 'low' | 'medium' | 'high';
  };
}

interface ModelsResponse {
  models: ModelInfo[];
  highPowerModels: AiModel[];
  extendedThinkingModels: AiModel[];
}

interface EffectiveModelResponse {
  effectiveModel: AiModel;
  modelInfo: ModelInfo | null;
  settings: {
    extendedThinking: boolean;
    highPowerMode: boolean;
    autoWebSearch: boolean;
  };
}

interface VideoReplay {
  id: string;
  testSessionId: string;
  projectId: number;
  filename: string;
  url: string;
  duration: number;
  status: 'recording' | 'processing' | 'ready' | 'failed';
  createdAt: string;
  thumbnailUrl?: string;
}

interface VideoReplaysResponse {
  replays: VideoReplay[];
  count: number;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
}

interface TestSession {
  id: string;
  projectId: number;
  status: 'pending' | 'running' | 'passed' | 'failed';
  testPlan: string;
  testName?: string;
  results?: any;
  duration?: number;
  videoUrl?: string;
  createdAt: string;
  completedAt?: string;
}

interface ToolsStatusResponse {
  webSearch: { enabled: boolean; status: string; provider: string };
  appTesting: { enabled: boolean; status: string; videoRecording: boolean; provider: string };
  extendedThinking: { enabled: boolean; status: string; models: string[] };
  highPowerModels: { enabled: boolean; status: string; models: string[] };
  maxAutonomy: { enabled: boolean; status: string; maxDuration: number };
}

const DEFAULT_SETTINGS: AgentToolsSettings = {
  maxAutonomy: false,
  appTesting: true,
  extendedThinking: false,
  highPowerModels: false,
  webSearch: true,
  imageGeneration: true,
};

/**
 * Comprehensive hook for Agent Tools with full backend integration
 * Manages all 5 toggles: Max Autonomy, App Testing, Extended Thinking, High Power Models, Web Search
 */
export function useAgentTools(projectId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Local state for session-based toggles (not persisted to DB)
  const [localMaxAutonomy, setLocalMaxAutonomy] = useState(false);
  const [localAppTesting, setLocalAppTesting] = useState(true);

  // Fetch user preferences from backend
  // RATE LIMIT FIX: Increased staleTime from 30s to 2min to reduce API calls
  const preferencesQuery = useQuery<AgentPreferences>({
    queryKey: ['/api/agent/preferences'],
    staleTime: 120000,
  });

  // Fetch available models
  // RATE LIMIT FIX: Increased staleTime from 60s to 5min (models rarely change)
  const modelsQuery = useQuery<ModelsResponse>({
    queryKey: ['/api/agent/models'],
    staleTime: 300000,
  });

  // Fetch effective model based on current settings
  // RATE LIMIT FIX: Increased staleTime from 10s to 2min
  const effectiveModelQuery = useQuery<EffectiveModelResponse>({
    queryKey: ['/api/agent/effective-model', { complexity: 'medium' }],
    enabled: !!preferencesQuery.data,
    staleTime: 120000,
  });

  // Fetch tools status
  // RATE LIMIT FIX: Increased staleTime from 60s to 5min (tools status rarely changes)
  const toolsStatusQuery = useQuery<ToolsStatusResponse>({
    queryKey: ['/api/agent/tools/status'],
    staleTime: 300000,
  });

  // Fetch video replays for project - using /tools/ path
  // RATE LIMIT FIX: Increased staleTime from 30s to 2min
  const videoReplaysQuery = useQuery<VideoReplaysResponse>({
    queryKey: ['/api/agent/tools/testing/replays', projectId],
    queryFn: async () => {
      if (!projectId) return { replays: [], count: 0 };
      return apiRequest<VideoReplaysResponse>("GET", `/api/agent/tools/testing/replays?projectId=${projectId}`);
    },
    enabled: !!projectId,
    staleTime: 120000,
  });

  // Fetch test sessions
  // RATE LIMIT FIX: Increased staleTime from 10s to 2min
  const testSessionsQuery = useQuery<{ sessions: TestSession[]; count: number }>({
    queryKey: ['/api/agent/testing/sessions', projectId],
    queryFn: async () => {
      if (!projectId) return { sessions: [], count: 0 };
      return apiRequest<{ sessions: TestSession[]; count: number }>("GET", `/api/agent/testing/sessions?projectId=${projectId}`);
    },
    enabled: !!projectId,
    staleTime: 120000,
  });

  // Convert backend preferences to AgentToolsSettings
  const settings = useMemo((): AgentToolsSettings => {
    const prefs = preferencesQuery.data;
    if (!prefs) {
      return {
        ...DEFAULT_SETTINGS,
        maxAutonomy: localMaxAutonomy,
        appTesting: localAppTesting,
      };
    }

    return {
      maxAutonomy: localMaxAutonomy,
      appTesting: localAppTesting,
      extendedThinking: prefs.extendedThinking || false,
      highPowerModels: prefs.highPowerMode || false,
      webSearch: prefs.autoWebSearch ?? true,
      imageGeneration: true,
    };
  }, [preferencesQuery.data, localMaxAutonomy, localAppTesting]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<AgentPreferences>) => {
      return apiRequest<AgentPreferences>("PUT", "/api/agent/preferences", updates);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/effective-model'] });
      
      // Show success toast for specific settings
      const changedSetting = Object.keys(variables)[0];
      if (changedSetting) {
        const settingNames: Record<string, string> = {
          extendedThinking: 'Extended Thinking',
          highPowerMode: 'High Power Models',
          autoWebSearch: 'Web Search',
        };
        const name = settingNames[changedSetting] || changedSetting;
        const value = variables[changedSetting as keyof typeof variables];
        toast({
          title: `${name} ${value ? 'enabled' : 'disabled'}`,
          description: `Setting updated successfully`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Web search mutation
  const webSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest<WebSearchResponse>("POST", "/api/agent/tools/web-search", { query });
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start test mutation
  const startTestMutation = useMutation({
    mutationFn: async (params: { projectId: number; testPlan: string; testName?: string; recordVideo?: boolean }) => {
      return apiRequest<{ sessionId: string; recordingId: number; status: string; message: string }>(
        "POST", 
        "/api/agent/tools/testing/start", 
        params
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/testing/sessions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/tools/testing/replays', projectId] });
      toast({
        title: "Test started",
        description: "Browser test is now running",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle settings changes
  const updateSettings = useCallback((newSettings: AgentToolsSettings) => {
    // Handle local toggles
    if (newSettings.maxAutonomy !== settings.maxAutonomy) {
      setLocalMaxAutonomy(newSettings.maxAutonomy);
    }
    if (newSettings.appTesting !== settings.appTesting) {
      setLocalAppTesting(newSettings.appTesting);
    }

    // Handle backend-persisted toggles
    const updates: Partial<AgentPreferences> = {};

    if (newSettings.extendedThinking !== settings.extendedThinking) {
      updates.extendedThinking = newSettings.extendedThinking;
    }
    if (newSettings.highPowerModels !== settings.highPowerModels) {
      updates.highPowerMode = newSettings.highPowerModels;
    }
    if (newSettings.webSearch !== settings.webSearch) {
      updates.autoWebSearch = newSettings.webSearch;
    }

    if (Object.keys(updates).length > 0) {
      updatePreferencesMutation.mutate(updates);
    }
  }, [settings, updatePreferencesMutation]);

  // Toggle individual setting
  const toggleSetting = useCallback((key: keyof AgentToolsSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    updateSettings(newSettings);
    return newSettings;
  }, [settings, updateSettings]);

  // Set preferred model
  const setPreferredModel = useCallback((model: AiModel) => {
    updatePreferencesMutation.mutate({ preferredModel: model });
  }, [updatePreferencesMutation]);

  // Get model by id
  const getModelInfo = useCallback((modelId: AiModel): ModelInfo | undefined => {
    return modelsQuery.data?.models.find(m => m.id === modelId);
  }, [modelsQuery.data]);

  // Get models by tier
  const getModelsByTier = useCallback((tier: 'standard' | 'high-power'): ModelInfo[] => {
    return modelsQuery.data?.models.filter(m => m.tier === tier) || [];
  }, [modelsQuery.data]);

  // Get models by category
  const getModelsByCategory = useCallback((category: ModelInfo['category']): ModelInfo[] => {
    return modelsQuery.data?.models.filter(m => m.category === category) || [];
  }, [modelsQuery.data]);

  // Perform web search
  const performWebSearch = useCallback((query: string) => {
    return webSearchMutation.mutateAsync(query);
  }, [webSearchMutation]);

  // Start a test
  const startTest = useCallback((testPlan: string, testName?: string) => {
    if (!projectId) {
      toast({
        title: "Cannot start test",
        description: "No project selected",
        variant: "destructive",
      });
      return Promise.reject(new Error("No project selected"));
    }
    return startTestMutation.mutateAsync({ 
      projectId, 
      testPlan, 
      testName,
      recordVideo: localAppTesting 
    });
  }, [projectId, startTestMutation, localAppTesting, toast]);

  return {
    // Settings
    settings,
    updateSettings,
    toggleSetting,
    isUpdating: updatePreferencesMutation.isPending,
    
    // Preferences
    preferences: preferencesQuery.data,
    isLoadingPreferences: preferencesQuery.isLoading,
    preferencesError: preferencesQuery.error,
    
    // Models
    models: modelsQuery.data?.models || [],
    highPowerModels: modelsQuery.data?.highPowerModels || [],
    extendedThinkingModels: modelsQuery.data?.extendedThinkingModels || [],
    isLoadingModels: modelsQuery.isLoading,
    
    // Effective model
    effectiveModel: effectiveModelQuery.data?.effectiveModel,
    effectiveModelInfo: effectiveModelQuery.data?.modelInfo,
    
    // Tools status
    toolsStatus: toolsStatusQuery.data,
    isLoadingToolsStatus: toolsStatusQuery.isLoading,
    
    // Model helpers
    setPreferredModel,
    getModelInfo,
    getModelsByTier,
    getModelsByCategory,
    
    // Video replays
    videoReplays: videoReplaysQuery.data?.replays || [],
    videoReplayCount: videoReplaysQuery.data?.count || 0,
    isLoadingVideoReplays: videoReplaysQuery.isLoading,
    
    // Test sessions
    testSessions: testSessionsQuery.data?.sessions || [],
    testSessionCount: testSessionsQuery.data?.count || 0,
    isLoadingTestSessions: testSessionsQuery.isLoading,
    
    // Actions
    performWebSearch,
    isSearching: webSearchMutation.isPending,
    searchResults: webSearchMutation.data?.results || [],
    lastSearchQuery: webSearchMutation.data?.query,
    
    startTest,
    isStartingTest: startTestMutation.isPending,
    
    // Refetch
    refetchPreferences: preferencesQuery.refetch,
    refetchModels: modelsQuery.refetch,
    refetchVideoReplays: videoReplaysQuery.refetch,
    refetchTestSessions: testSessionsQuery.refetch,
    refetchToolsStatus: toolsStatusQuery.refetch,
  };
}

/**
 * Hook for extended thinking streaming
 */
export function useExtendedThinking(conversationId?: number) {
  // Fetch thinking steps for a conversation - using /tools/ path
  const thinkingQuery = useQuery({
    queryKey: ['/api/agent/tools/thinking', conversationId],
    queryFn: async () => {
      if (!conversationId) return { steps: [], isThinking: false };
      return apiRequest<{
        steps: Array<{
          id: string;
          type: 'reasoning' | 'analysis' | 'planning';
          title: string;
          content: string;
          status: 'active' | 'completed' | 'error';
          timestamp: string;
          duration?: number;
        }>;
        isThinking: boolean;
      }>("GET", `/api/agent/tools/thinking/${conversationId}`);
    },
    enabled: !!conversationId,
    refetchInterval: (_data, _query) => {
      return _data?.isThinking ? 1000 : false;
    },
    staleTime: 500,
  });

  return {
    steps: thinkingQuery.data?.steps || [],
    isThinking: thinkingQuery.data?.isThinking || false,
    isLoading: thinkingQuery.isLoading,
    error: thinkingQuery.error,
    refetch: thinkingQuery.refetch,
  };
}

/**
 * Standalone hook for web search functionality
 */
export function useWebSearch() {
  const { toast } = useToast();
  
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest<WebSearchResponse>("POST", "/api/agent/tools/web-search", { query });
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch search history
  const historyQuery = useQuery({
    queryKey: ['/api/agent/tools/web-search'],
    staleTime: 60000,
  });

  return {
    search: searchMutation.mutate,
    searchAsync: searchMutation.mutateAsync,
    results: searchMutation.data?.results || [],
    isSearching: searchMutation.isPending,
    error: searchMutation.error,
    history: historyQuery.data,
    isLoadingHistory: historyQuery.isLoading,
  };
}

/**
 * Standalone hook for app testing functionality
 */
export function useAppTesting(projectId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch test sessions for project
  const testSessionsQuery = useQuery({
    queryKey: ['/api/agent/testing/sessions', projectId],
    queryFn: async () => {
      if (!projectId) return { sessions: [], count: 0 };
      return apiRequest<{
        sessions: TestSession[];
        count: number;
      }>("GET", `/api/agent/testing/sessions?projectId=${projectId}`);
    },
    enabled: !!projectId,
    staleTime: 10000,
  });

  // Fetch video replays
  const replaysQuery = useQuery<VideoReplaysResponse>({
    queryKey: ['/api/agent/tools/testing/replays', projectId],
    queryFn: async () => {
      if (!projectId) return { replays: [], count: 0 };
      return apiRequest<VideoReplaysResponse>("GET", `/api/agent/tools/testing/replays?projectId=${projectId}`);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  // Start a new test
  const startTestMutation = useMutation({
    mutationFn: async (params: { projectId: number; testPlan: string; testName?: string; recordVideo?: boolean }) => {
      return apiRequest<{
        sessionId: string;
        recordingId: number;
        status: string;
        message: string;
      }>("POST", "/api/agent/tools/testing/start", params);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/testing/sessions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/tools/testing/replays', projectId] });
      toast({
        title: "Test started",
        description: `Test session ${response.sessionId} is running`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    sessions: testSessionsQuery.data?.sessions || [],
    sessionCount: testSessionsQuery.data?.count || 0,
    isLoading: testSessionsQuery.isLoading,
    
    replays: replaysQuery.data?.replays || [],
    replayCount: replaysQuery.data?.count || 0,
    isLoadingReplays: replaysQuery.isLoading,
    
    startTest: startTestMutation.mutate,
    startTestAsync: startTestMutation.mutateAsync,
    isStartingTest: startTestMutation.isPending,
    
    refetch: testSessionsQuery.refetch,
    refetchReplays: replaysQuery.refetch,
  };
}
