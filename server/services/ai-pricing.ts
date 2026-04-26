/**
 * AI Model Pricing Service
 * Pricing per 1 million tokens (USD)
 * Updated: December 2025
 */

export const AI_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // ============================================
  // Legacy Models (backward compatibility)
  // ============================================
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'gemini-pro': { input: 0.50, output: 1.50 },
  'gemini-ultra': { input: 5.00, output: 15.00 },

  // ============================================
  // OpenAI — GPT-4.1 family (ModelFarm-supported)
  // ============================================
  'gpt-4.1':      { input: 2.00,  output: 8.00  },
  'gpt-4.1-mini': { input: 0.40,  output: 1.60  },
  'gpt-4.1-nano': { input: 0.10,  output: 0.40  },
  // OpenAI — GPT-4o family (ModelFarm-supported)
  'gpt-4o':       { input: 1.75,  output: 14.00 },
  'gpt-4o-mini':  { input: 0.10,  output: 0.40  },
  // OpenAI — Reasoning models (ModelFarm-supported)
  'o4-mini':      { input: 1.10,  output: 4.40  },
  'o3':           { input: 10.00, output: 40.00 },
  'o3-mini':      { input: 1.10,  output: 4.40  },

  // ============================================
  // Anthropic (Dec 2025) - 4 models
  // ============================================
  'claude-opus-4-7': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-1-20250805': { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },

  // ============================================
  // Google Gemini (Dec 2025) - 3 models
  // ============================================
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },

  // ============================================
  // xAI (Mar 2026) — grok-3 family (confirmed real)
  // ============================================
  'grok-3': { input: 3.00, output: 15.00 },
  'grok-3-mini': { input: 0.30, output: 0.50 },
  'grok-3-fast': { input: 5.00, output: 25.00 },

  // ============================================
  // Moonshot AI — moonshot-v1 series (confirmed real)
  // ============================================
  'moonshot-v1-8k': { input: 0.30, output: 1.20 },
  'moonshot-v1-32k': { input: 0.30, output: 1.20 },
  'moonshot-v1-128k': { input: 0.60, output: 2.40 },

  // ============================================
  // Groq (Dec 2025) - 2 models
  // ============================================
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  'llama3-70b-8192': { input: 0.59, output: 0.79 },
};

/**
 * Calculate the cost of AI usage in USD
 * @param model - The model identifier
 * @param inputTokens - Number of input/prompt tokens
 * @param outputTokens - Number of output/completion tokens
 * @returns Cost in USD
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = AI_MODEL_PRICING[model];
  
  if (!pricing) {
    console.warn(`[ai-pricing] Unknown model "${model}", using default pricing`);
    // Default fallback pricing
    return (inputTokens * 1.00 + outputTokens * 3.00) / 1_000_000;
  }
  
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * Get the list of all supported models
 */
export function getSupportedModels(): string[] {
  return Object.keys(AI_MODEL_PRICING);
}

/**
 * Check if a model is supported
 */
export function isModelSupported(model: string): boolean {
  return model in AI_MODEL_PRICING;
}
