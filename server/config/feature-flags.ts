/**
 * Feature flags configuration for AI UX features
 * Controls which AI UX features are enabled/disabled
 */

export interface FeatureFlags {
  aiUx: {
    improvePrompt: boolean;
    extendedThinking: boolean;
    highPowerMode: boolean;
    progressTab: boolean;
    pauseResume: boolean;
  };
}

// Default feature flags - all AI UX features disabled by default as per requirements
export const defaultFeatureFlags: FeatureFlags = {
  aiUx: {
    improvePrompt: false,  // Disabled by default
    extendedThinking: false,  // Disabled by default
    highPowerMode: false,  // Disabled by default
    progressTab: false,  // Disabled by default
    pauseResume: false   // Disabled by default
  }
};

// Environment-based overrides
export const getFeatureFlags = (): FeatureFlags => {
  return {
    aiUx: {
      improvePrompt: process.env.FEATURE_AI_UX_IMPROVE_PROMPT === 'true' || false,
      extendedThinking: process.env.FEATURE_AI_UX_EXTENDED_THINKING === 'true' || false,
      highPowerMode: process.env.FEATURE_AI_UX_HIGH_POWER_MODE === 'true' || false,
      progressTab: process.env.FEATURE_AI_UX_PROGRESS_TAB === 'true' || false,
      pauseResume: process.env.FEATURE_AI_UX_PAUSE_RESUME === 'true' || false
    }
  };
};

export const featureFlags = getFeatureFlags();
