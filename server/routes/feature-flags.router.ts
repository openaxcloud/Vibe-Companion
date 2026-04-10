/**
 * Feature Flags Router
 * Provides runtime feature toggles for AI Agent functionality
 * Reads from environment variables for production configuration
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { tierRateLimiters } from '../middleware/tier-rate-limiter';

const logger = createLogger('FeatureFlagsRouter');
const router = Router();

/**
 * Helper to read boolean from environment variable
 */
const envBool = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true';
};

/**
 * GET /api/feature-flags
 * Returns enabled feature flags for the current session
 * 
 * Note: These are runtime flags for gradual rollout of experimental features.
 * Reads from FEATURE_AI_UX_* environment variables.
 * Rate limited to prevent abuse on this public endpoint.
 */
router.get('/', tierRateLimiters.api, async (req: Request, res: Response) => {
  try {
    // Read AI UX features from environment variables
    const flags = {
      // AI UX Features (read from env vars)
      aiUx: {
        improvePrompt: envBool('FEATURE_AI_UX_IMPROVE_PROMPT', false),
        extendedThinking: envBool('FEATURE_AI_UX_EXTENDED_THINKING', false),
        highPowerMode: envBool('FEATURE_AI_UX_HIGH_POWER_MODE', false),
        progressTab: envBool('FEATURE_AI_UX_PROGRESS_TAB', false),
        pauseResume: envBool('FEATURE_AI_UX_PAUSE_RESUME', false),
      },
      
      // Legacy format (for backward compatibility)
      extendedThinkingEnabled: envBool('FEATURE_AI_UX_EXTENDED_THINKING', false),
      highPowerModeEnabled: envBool('FEATURE_AI_UX_HIGH_POWER_MODE', false),
      improvePromptEnabled: envBool('FEATURE_AI_UX_IMPROVE_PROMPT', false),
      progressTabEnabled: envBool('FEATURE_AI_UX_PROGRESS_TAB', false),
      pauseResumeEnabled: envBool('FEATURE_AI_UX_PAUSE_RESUME', false),
      
      // Auto features
      autoCheckpointsEnabled: true,
      autoApprovePlansEnabled: false,
      
      // Integration Features
      webImportEnabled: true,
      screenshotToolEnabled: true,
      
      // Experimental Features
      voiceInputEnabled: envBool('FEATURE_VOICE_INPUT', true),
      collaborationEnabled: false,
      aiModelSwitchingEnabled: true,
      
      // Performance Features
      streamingResponsesEnabled: true,
      parallelTasksEnabled: false,
    };

    logger.info('Feature flags requested', { 
      aiUx: flags.aiUx 
    });

    res.json(flags);
  } catch (error: any) {
    logger.error('Error fetching feature flags', { error: error.message });
    
    // Return safe defaults even on error
    res.json({
      aiUx: {
        improvePrompt: false,
        extendedThinking: false,
        highPowerMode: false,
        progressTab: false,
        pauseResume: false,
      },
      extendedThinkingEnabled: false,
      highPowerModeEnabled: false,
      autoCheckpointsEnabled: true,
      streamingResponsesEnabled: true,
    });
  }
});

export default router;
