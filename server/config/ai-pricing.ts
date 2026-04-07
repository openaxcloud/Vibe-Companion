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
  'gpt-4o':          { input: 2.5,   output: 10.0,  provider: 'openai', name: 'GPT-4o' },
  'gpt-4o-mini':     { input: 0.15,  output: 0.6,   provider: 'openai', name: 'GPT-4o Mini' },
  'o1':              { input: 15.0,  output: 60.0,  provider: 'openai', name: 'o1' },
  'o1-mini':         { input: 3.0,   output: 12.0,  provider: 'openai', name: 'o1 Mini' },
  'o3':              { input: 10.0,  output: 40.0,  provider: 'openai', name: 'o3' },
  'gpt-4-turbo':     { input: 10.0,  output: 30.0,  provider: 'openai', name: 'GPT-4 Turbo' },
  'gpt-4':           { input: 30.0,  output: 60.0,  provider: 'openai', name: 'GPT-4' },

  // ── Anthropic ────────────────────────────────────────────────────────────────
  'claude-3-5-sonnet-20241022': { input: 3.0,   output: 15.0,  provider: 'anthropic', name: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku-20241022':  { input: 0.8,   output: 4.0,   provider: 'anthropic', name: 'Claude 3.5 Haiku' },
  'claude-3-opus-20240229':     { input: 15.0,  output: 75.0,  provider: 'anthropic', name: 'Claude 3 Opus' },
  'claude-3-haiku-20240307':    { input: 0.25,  output: 1.25,  provider: 'anthropic', name: 'Claude 3 Haiku' },

  // ── Google Gemini ─────────────────────────────────────────────────────────────
  'gemini-2.5-flash': { input: 0.075, output: 0.3,  provider: 'gemini', name: 'Gemini 2.5 Flash' },
  'gemini-2.0-flash': { input: 0.075, output: 0.3,  provider: 'gemini', name: 'Gemini 2.0 Flash' },
  'gemini-1.5-pro':   { input: 1.25,  output: 5.0,  provider: 'gemini', name: 'Gemini 1.5 Pro' },
  'gemini-1.5-flash': { input: 0.075, output: 0.3,  provider: 'gemini', name: 'Gemini 1.5 Flash' },

  // ── xAI — grok-3 family (confirmed real, Mar 2026) ───────────────────────────
  'grok-3':      { input: 3.0,  output: 15.0, provider: 'xai', name: 'Grok 3' },
  'grok-3-mini': { input: 0.3,  output: 0.5,  provider: 'xai', name: 'Grok 3 Mini' },
  'grok-3-fast': { input: 5.0,  output: 25.0, provider: 'xai', name: 'Grok 3 Fast' },

  // ── Moonshot AI ───────────────────────────────────────────────────────────────
  'moonshot-v1-8k':   { input: 0.12, output: 0.12, provider: 'moonshot', name: 'Moonshot v1 8K' },
  'moonshot-v1-32k':  { input: 0.24, output: 0.24, provider: 'moonshot', name: 'Moonshot v1 32K' },
  'moonshot-v1-128k': { input: 0.96, output: 0.96, provider: 'moonshot', name: 'Moonshot v1 128K' },
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
