import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsExtendedThinking?: boolean;
  costPer1kTokens?: number;
}

interface AgentModelPreference {
  modelId: string | null;
  provider: string | null;
  supportsExtendedThinking: boolean;
  model: AIModel | null;
  availableModels: AIModel[];
  isLoading: boolean;
  setPreferredModel: (modelId: string) => Promise<void>;
}

/**
 * Hook for managing AI Agent model preferences
 * Loads available models and user's preferred model
 * Maps modelId to provider and capabilities for streaming endpoints
 */
export function useAgentModelPreference(): AgentModelPreference {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Fetch available models
  const { data: modelsData, isLoading: modelsLoading } = useQuery<{ models: AIModel[] }>({
    queryKey: ['/api/models'],
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch user's preferred model
  const { data: preferredData, isLoading: preferredLoading, isSuccess: preferredSuccess } = useQuery<{ 
    preferredModel: string | null; 
    availableModels: number 
  }>({
    queryKey: ['/api/models/preferred'],
    staleTime: 30000, // Cache for 30s
    retry: false, // Don't retry on auth failures
    placeholderData: (prev) => prev, // Keep previous data during refetches to avoid undefined
  });

  // Mutation to save preferred model
  const savePreferredModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest('POST', '/api/models/preferred', { modelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/models/preferred'] });
    },
  });

  const availableModels = useMemo(() => modelsData?.models || [], [modelsData?.models]);
  const currentModelId = selectedModelId || preferredData?.preferredModel || null;
  
  // Find the full model object
  const currentModel = availableModels.find(m => m.id === currentModelId) || null;

  // Fallback to first available model if nothing is selected
  // CRITICAL: Only apply fallback when:
  // 1. Both queries successfully completed (isSuccess ensures we have real data, not undefined during refetch)
  // 2. User has NO saved preference (explicit null check)
  // 3. No model is currently selected
  useEffect(() => {
    const hasSavedPreference = preferredData?.preferredModel !== null && preferredData?.preferredModel !== undefined;
    const shouldApplyFallback = !currentModelId && 
                                 availableModels.length > 0 && 
                                 !modelsLoading && 
                                 preferredSuccess &&  // Use isSuccess instead of !isLoading to avoid refetch edge case
                                 !hasSavedPreference;
    
    if (shouldApplyFallback) {
      const defaultModel = availableModels.find(m => m.provider === 'openai') || availableModels[0];
      setSelectedModelId(defaultModel.id);
    }
  }, [currentModelId, availableModels, modelsLoading, preferredSuccess, preferredData]);

  const setPreferredModel = useCallback(async (modelId: string) => {
    setSelectedModelId(modelId);
    await savePreferredModelMutation.mutateAsync(modelId);
  }, [savePreferredModelMutation]);

  // Extract provider from model ID if model not found
  // e.g., "gpt-4.1" → "openai", "claude-sonnet-4-5" → "anthropic"
  const getProviderFromModelId = (modelId: string): string => {
    if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) return 'openai';
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('gemini')) return 'gemini';
    if (modelId.startsWith('grok')) return 'xai';
    if (modelId.startsWith('groq')) return 'groq';
    if (modelId.startsWith('moonshot') || modelId.startsWith('kimi')) return 'moonshot';
    return 'openai'; // default fallback
  };

  return {
    modelId: currentModel?.id || null,
    provider: currentModel?.provider || (currentModelId ? getProviderFromModelId(currentModelId) : null),
    supportsExtendedThinking: currentModel?.supportsExtendedThinking || false,
    model: currentModel,
    availableModels,
    isLoading: modelsLoading || preferredLoading,
    setPreferredModel,
  };
}
