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
  'gpt-4o', 'gpt-4o-mini',
  'o4-mini', 'o3', 'o3-mini',
]);

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'OpenAI legacy flagship — best coding, instruction following, and long context (free via Replit ModelFarm)',
    maxTokens: 1047576,
    supportsStreaming: true,
    costPer1kTokens: 0.002
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Fast and efficient legacy model — best price-to-performance (free via Replit ModelFarm)',
    maxTokens: 1047576,
    supportsStreaming: true,
    costPer1kTokens: 0.0004
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'Smallest fastest legacy model — for latency-sensitive tasks (free via Replit ModelFarm)',
    maxTokens: 1047576,
    supportsStreaming: true,
    costPer1kTokens: 0.0001
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal model — vision, audio, and text with 128K context (free via Replit ModelFarm)',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: 0.005
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Affordable multimodal model — vision + text at low cost (free via Replit ModelFarm)',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: 0.00015
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'openai',
    description: 'Best thinking model — fast reasoning for STEM and coding (free via Replit ModelFarm)',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.0011
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Most powerful reasoning — frontier performance on hard benchmarks (free via Replit ModelFarm)',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.01
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    description: 'Efficient reasoning — strong on math, science, and code (free via Replit ModelFarm)',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.0011
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    description: 'Advanced reasoning model for complex problem solving',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: 0.015
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Previous-generation flagship with broad knowledge',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: 0.01
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Best overall Claude — top intelligence for coding, reasoning & agentic tasks',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.003
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    description: 'Most powerful Claude — best for complex reasoning and analysis',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.015
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Extended thinking — advanced multi-step reasoning',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.003
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Proven coding and analysis model (Oct 2024)',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.003
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fastest Claude — near-instant responses for everyday tasks',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.0008
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Legacy flagship for complex reasoning (2024)',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.015
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fastest compact legacy model — high throughput, low latency',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: 0.00025
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
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Next-gen speed and multimodal features at low cost',
    maxTokens: 1000000,
    supportsStreaming: true,
    costPer1kTokens: 0.0000375
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    description: 'Lightest Gemini model — fastest and most cost-efficient',
    maxTokens: 1000000,
    supportsStreaming: true,
    costPer1kTokens: 0.000019
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Complex reasoning with industry-leading 2M token context',
    maxTokens: 2000000,
    supportsStreaming: true,
    costPer1kTokens: 0.00125
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Fast versatile multimodal model for diverse tasks',
    maxTokens: 1000000,
    supportsStreaming: true,
    costPer1kTokens: 0.000075
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xai',
    description: "xAI's flagship model — real-time knowledge, strong reasoning, 131K context",
    maxTokens: 131072,
    supportsStreaming: true,
    costPer1kTokens: 0.003
  },
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'xai',
    description: 'Efficient Grok model — fast reasoning at lower cost',
    maxTokens: 131072,
    supportsStreaming: true,
    costPer1kTokens: 0.0003
  },
  {
    id: 'grok-3-fast',
    name: 'Grok 3 Fast',
    provider: 'xai',
    description: 'Fastest Grok 3 variant — optimized for speed-critical workloads',
    maxTokens: 131072,
    supportsStreaming: true,
    costPer1kTokens: 0.005
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    provider: 'moonshot',
    description: 'Flagship Kimi model — advanced reasoning and multi-step problem solving',
    maxTokens: 131072,
    supportsStreaming: true,
    costPer1kTokens: 0.002
  },
  {
    id: 'moonshot-v1-8k',
    name: 'Kimi 8K',
    provider: 'moonshot',
    description: 'Fast inference for shorter contexts — ideal for quick tasks',
    maxTokens: 8192,
    supportsStreaming: true,
    costPer1kTokens: 0.0012
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Kimi 32K',
    provider: 'moonshot',
    description: 'Balanced performance with 32K context window',
    maxTokens: 32768,
    supportsStreaming: true,
    costPer1kTokens: 0.0024
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Kimi 128K',
    provider: 'moonshot',
    description: 'Long-context specialist — documents, codebases, long conversations',
    maxTokens: 131072,
    supportsStreaming: true,
    costPer1kTokens: 0.006
  },
];
