export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'xai' | 'groq' | 'perplexity' | 'mixtral' | 'llama' | 'cohere' | 'deepseek' | 'mistral' | 'moonshot';
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  costPer1kTokens?: number;
  available?: boolean;
}

export const MODELFARM_MODELS = new Set([
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'o4-mini', 'o3',
]);

export const AI_MODELS: AIModel[] = [
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    description: 'Anthropic flagship (1M context) — best for complex agentic coding, design & multi-step reasoning',
    maxTokens: 1000000,
    supportsStreaming: true,
    costPer1kTokens: 0.015
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'Best price-performance Claude — top-tier coding & reasoning at lower cost than Opus',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.003
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast & cheap Claude — ideal for short tasks, autocompletion, and high-volume operations',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.001
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'OpenAI flagship — best coding, instruction following, and long context',
    maxTokens: 1047576,
    supportsStreaming: true,
    costPer1kTokens: 0.002
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Fast and efficient — best price-to-performance ratio',
    maxTokens: 1047576,
    supportsStreaming: true,
    costPer1kTokens: 0.0004
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'Smallest fastest model — for latency-sensitive tasks',
    maxTokens: 1047576,
    supportsStreaming: true,
    costPer1kTokens: 0.0001
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'openai',
    description: 'Best thinking model — fast reasoning for STEM and coding',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.0011
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Most powerful reasoning — frontier performance on hard benchmarks',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.01
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Most powerful Gemini — state-of-the-art reasoning and 1M context window',
    maxTokens: 1000000,
    supportsStreaming: true,
    costPer1kTokens: 0.00125
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Best price-performance — fast multimodal AI with thinking capabilities',
    maxTokens: 1000000,
    supportsStreaming: true,
    costPer1kTokens: 0.0000375
  },
];

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === id);
}

export function getModelsByProvider(provider: string): AIModel[] {
  return AI_MODELS.filter(m => m.provider === provider);
}
