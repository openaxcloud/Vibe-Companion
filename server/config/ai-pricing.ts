/**
 * Centralized AI Model Pricing Configuration
 *
 * All pricing is in USD per 1 million tokens.
 * Source: Official pricing pages — OpenAI, Anthropic, Google, xAI, Moonshot AI.
 * Only includes models that are RELEASED and accessible via their public APIs.
 */

export interface ModelPricing {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

export interface ModelPricingEntry extends ModelPricing {
  provider: string;
  name: string;
}

/**
 * RULE: Only real, released model IDs — no fake or future models.
 * Keep in sync with AI_MODELS in ai-provider-manager.ts and ai-models.router.ts.
 */
export const MODEL_PRICING: Record<string, ModelPricingEntry> = {
  // ── OpenAI ───────────────────────────────────────────────────────────────────
  'gpt-4.1':         { input: 2.0,   output: 8.0,   provider: 'openai', name: 'GPT-4.1' },
  'gpt-4.1-mini':    { input: 0.4,   output: 1.6,   provider: 'openai', name: 'GPT-4.1 Mini' },
  'gpt-4.1-nano':    { input: 0.1,   output: 0.4,   provider: 'openai', name: 'GPT-4.1 Nano' },
  'o4-mini':         { input: 1.1,   output: 4.4,   provider: 'openai', name: 'o4-mini' },
  'o3':              { input: 10.0,  output: 40.0,  provider: 'openai', name: 'o3' },

  // ── Anthropic ────────────────────────────────────────────────────────────────
  'claude-opus-4-7':           { input: 15.0,  output: 75.0,  provider: 'anthropic', name: 'Claude Opus 4.7' },
  'claude-sonnet-4-6':         { input: 3.0,   output: 15.0,  provider: 'anthropic', name: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5-20251001': { input: 1.0,   output: 5.0,   provider: 'anthropic', name: 'Claude Haiku 4.5' },

  // ── Google Gemini ─────────────────────────────────────────────────────────────
  'gemini-2.5-pro':   { input: 1.25,  output: 10.0,  provider: 'gemini', name: 'Gemini 2.5 Pro' },
  'gemini-2.5-flash': { input: 0.0375, output: 0.15,  provider: 'gemini', name: 'Gemini 2.5 Flash' },
};

/**
 * Default pricing for unknown models
 */
export const DEFAULT_PRICING: ModelPricing = {
  input: 2.0,   // Conservative default: $2 per 1M tokens
  output: 2.0
};

/**
 * Get pricing for a model with fallback to default
 */
export function getModelPricing(modelId: string): ModelPricing {
  const pricing = MODEL_PRICING[modelId];
  if (pricing) {
    return { input: pricing.input, output: pricing.output };
  }
  return DEFAULT_PRICING;
}

/**
 * Calculate cost for a request
 * @param modelId The model used
 * @param tokensInput Number of input tokens
 * @param tokensOutput Number of output tokens
 * @returns Cost in USD
 */
export function calculateRequestCost(
  modelId: string,
  tokensInput: number,
  tokensOutput: number
): number {
  const pricing = getModelPricing(modelId);
  const inputCost = (tokensInput / 1_000_000) * pricing.input;
  const outputCost = (tokensOutput / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Get all pricing entries grouped by provider
 */
export function getPricingByProvider(): Record<string, Record<string, ModelPricing>> {
  const result: Record<string, Record<string, ModelPricing>> = {};
  
  for (const [modelId, entry] of Object.entries(MODEL_PRICING)) {
    if (!result[entry.provider]) {
      result[entry.provider] = {};
    }
    result[entry.provider][modelId] = {
      input: entry.input,
      output: entry.output
    };
  }
  
  return result;
}
