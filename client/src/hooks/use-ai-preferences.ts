import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

export interface AIPreferences {
  enabled: boolean;
  model: string;
  autoTrigger: boolean;
  confidenceThreshold: number;
  triggerDelay: number;
  maxSuggestions: number;
  showExplanations: boolean;
  temperature: number;
}

const DEFAULT_PREFERENCES: AIPreferences = {
  enabled: true,
  model: 'Claude Sonnet 4',
  autoTrigger: true,
  confidenceThreshold: 0.7,
  triggerDelay: 300,
  maxSuggestions: 5,
  showExplanations: true,
  temperature: 0.2,
};

const STORAGE_KEY = 'ai-code-completion-preferences';

/**
 * Hook to manage AI code completion preferences
 */
export function useAIPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<AIPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const loadPreferences = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        }
      } catch (error) {
        console.error('Failed to load AI preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch (error) {
        console.error('Failed to save AI preferences:', error);
      }
    }
  }, [preferences, isLoading]);

  // Toggle AI completions on/off
  const toggleEnabled = useCallback(() => {
    setPreferences(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  // Set the AI model
  const setModel = useCallback((model: string) => {
    setPreferences(prev => ({ ...prev, model }));
  }, []);

  // Toggle auto-trigger
  const toggleAutoTrigger = useCallback(() => {
    setPreferences(prev => ({ ...prev, autoTrigger: !prev.autoTrigger }));
  }, []);

  // Set confidence threshold (0-1)
  const setConfidenceThreshold = useCallback((threshold: number) => {
    const clamped = Math.max(0, Math.min(1, threshold));
    setPreferences(prev => ({ ...prev, confidenceThreshold: clamped }));
  }, []);

  // Set trigger delay in milliseconds
  const setTriggerDelay = useCallback((delay: number) => {
    const clamped = Math.max(0, Math.min(2000, delay));
    setPreferences(prev => ({ ...prev, triggerDelay: clamped }));
  }, []);

  // Set max suggestions (1-10)
  const setMaxSuggestions = useCallback((max: number) => {
    const clamped = Math.max(1, Math.min(10, max));
    setPreferences(prev => ({ ...prev, maxSuggestions: clamped }));
  }, []);

  // Toggle showing explanations
  const toggleShowExplanations = useCallback(() => {
    setPreferences(prev => ({ ...prev, showExplanations: !prev.showExplanations }));
  }, []);

  // Set temperature (0-1, lower is more deterministic)
  const setTemperature = useCallback((temperature: number) => {
    const clamped = Math.max(0, Math.min(1, temperature));
    setPreferences(prev => ({ ...prev, temperature: clamped }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  // Update all preferences at once
  const updatePreferences = useCallback((updates: Partial<AIPreferences>) => {
    setPreferences(prev => ({
      ...prev,
      ...updates,
      // Clamp numeric values
      confidenceThreshold: updates.confidenceThreshold !== undefined
        ? Math.max(0, Math.min(1, updates.confidenceThreshold))
        : prev.confidenceThreshold,
      triggerDelay: updates.triggerDelay !== undefined
        ? Math.max(0, Math.min(2000, updates.triggerDelay))
        : prev.triggerDelay,
      maxSuggestions: updates.maxSuggestions !== undefined
        ? Math.max(1, Math.min(10, updates.maxSuggestions))
        : prev.maxSuggestions,
      temperature: updates.temperature !== undefined
        ? Math.max(0, Math.min(1, updates.temperature))
        : prev.temperature,
    }));
  }, []);

  // Get available AI models
  const getAvailableModels = useCallback(() => {
    return [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Best overall — top intelligence for coding and reasoning' },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4', description: 'Most powerful Claude — complex analysis and deep reasoning' },
      { value: 'gpt-4.1', label: 'GPT-4.1', description: 'OpenAI flagship — best coding and instruction following' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Fast and efficient — best price-to-performance ratio' },
      { value: 'o3', label: 'o3', description: 'Most powerful reasoning — frontier performance' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'State-of-the-art reasoning and 1M context' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast multimodal AI with thinking capabilities' },
    ];
  }, []);

  // Check if a specific model is available (could be extended to check API keys)
  const isModelAvailable = useCallback((model: string) => {
    // This could check for API keys or user permissions
    // For now, all models are considered available
    return true;
  }, []);

  return {
    preferences,
    isLoading,
    
    // Individual setters
    toggleEnabled,
    setModel,
    toggleAutoTrigger,
    setConfidenceThreshold,
    setTriggerDelay,
    setMaxSuggestions,
    toggleShowExplanations,
    setTemperature,
    
    // Bulk operations
    updatePreferences,
    resetToDefaults,
    
    // Model utilities
    getAvailableModels,
    isModelAvailable,
  };
}