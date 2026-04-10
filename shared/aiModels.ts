/**
 * Centralized AI Models Registry - January 2026 CONSOLIDATED
 * Single source of truth for all AI models across backend and frontend
 * 
 * CONSOLIDATION NOTICE (Jan 2026):
 * - gpt-4.1 → CURRENT flagship
 * - gpt-4.1-mini → Cost-optimized
 * - gpt-4.1-nano → High-throughput
 * 
 * Key Capabilities tracked:
 * 1. Extended Thinking - Raisonnement approfondi
 * 2. Tool Use (MCP) - Exécution d'outils natifs
 * 3. Context Window - Taille du contexte en tokens
 * 4. Code Generation - Optimisation pour le développement
 */

export interface AIModelCapabilities {
  extendedThinking: boolean;        // Raisonnement approfondi
  toolUse: boolean;                 // Support MCP/Tool calling
  contextWindow: number;            // Context window size in tokens
  codeGeneration: boolean;          // Optimisé pour le code
  multimodal?: boolean;             // Support vision/audio
  computerUse?: boolean;            // Support computer control (Claude)
}

export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'moonshot' | 'groq';
  description: string;
  capabilities: AIModelCapabilities;
  pricing: {
    input: number;    // USD per 1M tokens
    output: number;   // USD per 1M tokens
  };
  releaseDate: string;  // YYYY-MM-DD
  available: boolean;
}

/**
 * All available AI models - January 2026 CONSOLIDATED
 */
export const AI_MODELS_REGISTRY: Record<string, AIModel> = {
  // ========================================
  // OpenAI Models - GPT-4.1 family
  // Source: https://platform.openai.com/docs/models
  // ========================================
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Flagship model — best coding, instruction following, and long context (free via Replit ModelFarm)',
    capabilities: {
      extendedThinking: false,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 2.00, output: 8.00 },
    releaseDate: '2025-04-14',
    available: true
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Cost-optimized — balances speed, cost, and capability',
    capabilities: {
      extendedThinking: false,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 0.40, output: 1.60 },
    releaseDate: '2025-04-14',
    available: true
  },
  'gpt-4.1-nano': {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'High-throughput — simple instruction-following and classification',
    capabilities: {
      extendedThinking: false,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 0.10, output: 0.40 },
    releaseDate: '2025-04-14',
    available: true
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal flagship - text, vision, audio',
    capabilities: {
      extendedThinking: false,
      toolUse: true,
      contextWindow: 128000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 2.5, output: 10 },
    releaseDate: '2024-08-06',
    available: true
  },
  'o3': {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Advanced reasoning model - complex problem solving',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 128000,
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 15, output: 60 },  // Reasoning premium
    releaseDate: '2025-04-16',
    available: true
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'openai',
    description: 'Budget-friendly reasoning for STEM tasks',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 128000,
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 3, output: 12 },
    releaseDate: '2025-04-16',
    available: true
  },

  // ========================================
  // Anthropic Models (Sept-Oct 2025)
  // ========================================
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Best coding model in the world - strongest at agents & computer use',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 200000,
      codeGeneration: true,
      multimodal: true,
      computerUse: true
    },
    pricing: { input: 3, output: 15 },
    releaseDate: '2025-09-29',
    available: true
  },
  'claude-opus-4-5-20251124': {
    id: 'claude-opus-4-5-20251124',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    description: 'Most capable frontier model - >80% SWE-bench, vision, computer use & agents',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 200000,
      codeGeneration: true,
      multimodal: true,
      computerUse: true
    },
    pricing: { input: 15, output: 75 },
    releaseDate: '2025-11-24',
    available: true
  },
  'claude-haiku-4-5-20251015': {
    id: 'claude-haiku-4-5-20251015',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fastest - matches Sonnet 4 on coding at 1/3 cost',
    capabilities: {
      extendedThinking: false,
      toolUse: true,
      contextWindow: 200000,
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 1, output: 5 },
    releaseDate: '2025-10-15',
    available: true
  },

  // ========================================
  // Google Gemini Models - UPDATED JANUARY 2026
  // Source: https://ai.google.dev/gemini-api/docs/models
  // ========================================
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'gemini',
    description: 'Latest flagship - frontier-class, agentic coding, 90.4% GPQA Diamond (Jan 2026)',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 0.075, output: 0.3 },
    releaseDate: '2026-01-08',
    available: true
  },
  'gemini-3-pro': {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'gemini',
    description: 'State-of-the-art reasoning - best multimodal, vibe coding (Dec 2025)',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 1.25, output: 5 },
    releaseDate: '2025-12-01',
    available: true
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Stable with adaptive thinking - LMArena leader 6+ months',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 1.25, output: 5 },
    releaseDate: '2025-11-01',
    available: true
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Hybrid reasoning - thinks before it speaks with low latency',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 0.075, output: 0.3 },
    releaseDate: '2025-11-01',
    available: true
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Stable - 1M context, native tool use, superior speed',
    capabilities: {
      extendedThinking: false,
      toolUse: true,
      contextWindow: 1000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 0.075, output: 0.3 },
    releaseDate: '2025-06-01',
    available: true
  },

  // ========================================
  // xAI Models (July-Sept 2025)
  // ========================================
  'grok-4': {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'xai',
    description: 'Current flagship - post-graduate reasoning with 256K context',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 256000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 2, output: 6 },
    releaseDate: '2025-07-01',
    available: true
  },
  'grok-4-fast': {
    id: 'grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'xai',
    description: 'Enterprise - 40% fewer tokens, 2M context, 64× cheaper than o3',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 2000000,
      codeGeneration: true,
      multimodal: true
    },
    pricing: { input: 0.5, output: 1.5 },
    releaseDate: '2025-09-01',
    available: true
  },

  // ========================================
  // Moonshot AI Models (Nov 2025)
  // ========================================
  // ✅ 40-YEAR FIX: Corrected to kimi-k2-0711-preview (production-recommended ID)
  'kimi-k2-0711-preview': {
    id: 'kimi-k2-0711-preview',
    name: 'Kimi K2 (July 2025)',
    provider: 'moonshot',
    description: 'Production-recommended - 1T param MoE model optimized for agentic tasks, 10-100× cheaper than GPT-4',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 128000,  // 128K context
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 0.6, output: 2.5 },
    releaseDate: '2025-07-11',
    available: true
  },
  'kimi-k2-0904-preview': {
    id: 'kimi-k2-0904-preview',
    name: 'Kimi K2 (Sept 4, 2025)',
    provider: 'moonshot',
    description: 'Latest stable - improved coding performance with 256K context window',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 256000,  // 256K context
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 0.6, output: 2.5 },
    releaseDate: '2025-09-04',
    available: true
  },
  'kimi-k2-thinking': {
    id: 'kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    provider: 'moonshot',
    description: 'Advanced reasoning & agentic model - 256K context with 200-300 sequential tool calls',
    capabilities: {
      extendedThinking: true,
      toolUse: true,
      contextWindow: 256000,  // ✅ FIXED: 256K context (was 128K)
      codeGeneration: true,
      multimodal: false
    },
    pricing: { input: 0.6, output: 2.5 },  // ✅ FIXED: Same pricing as base model
    releaseDate: '2025-11-01',
    available: true
  }
};

/**
 * Get all available models
 */
export function getAllModels(): AIModel[] {
  return Object.values(AI_MODELS_REGISTRY);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: AIModel['provider']): AIModel[] {
  return getAllModels().filter(m => m.provider === provider);
}

/**
 * Get model by ID
 */
export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS_REGISTRY[id];
}

/**
 * Get all model IDs
 */
export function getAllModelIds(): string[] {
  return Object.keys(AI_MODELS_REGISTRY);
}

/**
 * Format context window for display
 */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${tokens / 1000000}M`;
  if (tokens >= 1000) return `${tokens / 1000}K`;
  return `${tokens}`;
}

/**
 * Get capability badges for a model
 */
export function getCapabilityBadges(modelId: string): string[] {
  const model = getModelById(modelId);
  if (!model) return [];
  
  const badges: string[] = [];
  if (model.capabilities.extendedThinking) badges.push('Extended Thinking');
  if (model.capabilities.toolUse) badges.push('Tool Use (MCP)');
  if (model.capabilities.codeGeneration) badges.push('Code Generation');
  if (model.capabilities.multimodal) badges.push('Multimodal');
  if (model.capabilities.computerUse) badges.push('Computer Use');
  
  return badges;
}
