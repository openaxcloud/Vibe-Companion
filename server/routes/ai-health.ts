/**
 * AI Health Check Router
 * Fortune 500-grade health checks for all 21 AI models across 5 providers
 * Features: 60-second cache, latency metrics, lightweight ping requests
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_MODELS } from '../ai/ai-provider-manager';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';

const router = Router();

interface ProviderHealth {
  status: 'healthy' | 'unhealthy' | 'missing';
  latency: number;
  lastCheck: string;
  models: number;
  error?: string;
}

interface HealthCache {
  timestamp: number;
  data: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    providers: Record<string, ProviderHealth>;
    summary: {
      healthy: number;
      unhealthy: number;
      missing: number;
      totalModels: number;
    };
  };
}

const CACHE_TTL_MS = 60000;
let healthCache: HealthCache | null = null;

const PROVIDER_CONFIGS = [
  { name: 'openai', envKey: 'OPENAI_API_KEY' },
  { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { name: 'gemini', envKey: 'GEMINI_API_KEY' },
  { name: 'xai', envKey: 'XAI_API_KEY' },
  { name: 'moonshot', envKey: 'MOONSHOT_API_KEY' }
] as const;

function countModelsForProvider(provider: string): number {
  return AI_MODELS.filter(m => m.provider === provider).length;
}

async function pingProvider(
  provider: string, 
  apiKey: string | undefined, 
  timeout: number = 5000
): Promise<ProviderHealth> {
  const startTime = Date.now();
  const models = countModelsForProvider(provider);
  
  if (!apiKey || apiKey.trim() === '') {
    return {
      status: 'missing',
      latency: 0,
      lastCheck: new Date().toISOString(),
      models,
      error: 'API key not configured'
    };
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    );

    let testPromise: Promise<any>;

    switch (provider) {
      case 'openai': {
        const client = new OpenAI({ apiKey, timeout: timeout - 500 });
        testPromise = client.models.list().then(res => res.data.length > 0);
        break;
      }
      case 'anthropic': {
        const client = new Anthropic({ apiKey, timeout: timeout - 500 });
        testPromise = client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        });
        break;
      }
      case 'gemini': {
        const client = new GoogleGenerativeAI(apiKey);
        // Gemini 3 → 2.5 → 2.0 fallback chain for maximum compatibility
        const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        testPromise = (async () => {
          for (const modelName of geminiModels) {
            try {
              const model = client.getGenerativeModel({ model: modelName });
              await model.generateContent('ping');
              return true;
            } catch (e: any) {
              if (e.message?.includes('not found') || e.status === 404) {
                continue; // Try next model
              }
              throw e; // Re-throw other errors
            }
          }
          throw new Error('No Gemini models available');
        })();
        break;
      }
      case 'xai': {
        const client = new OpenAI({
          apiKey,
          baseURL: 'https://api.x.ai/v1',
          timeout: timeout - 500
        });
        testPromise = client.models.list().then(res => res.data.length > 0);
        break;
      }
      case 'moonshot': {
        const client = new OpenAI({
          apiKey,
          baseURL: 'https://api.moonshot.ai/v1',
          timeout: timeout - 500
        });
        testPromise = client.models.list().then(res => res.data.length > 0);
        break;
      }
      default:
        return {
          status: 'unhealthy',
          latency: 0,
          lastCheck: new Date().toISOString(),
          models,
          error: 'Unknown provider'
        };
    }

    await Promise.race([testPromise, timeoutPromise]);
    const latency = Date.now() - startTime;

    return {
      status: 'healthy',
      latency,
      lastCheck: new Date().toISOString(),
      models
    };

  } catch (error: any) {
    const latency = Date.now() - startTime;
    let errorMsg = error.message || 'Unknown error';
    
    if (error.message === 'timeout') {
      errorMsg = 'Request timeout';
    } else if (error.status === 401 || error.message?.includes('API key')) {
      errorMsg = 'Invalid API key';
    } else if (error.message?.includes('Insufficient credits')) {
      errorMsg = 'Insufficient credits';
    }

    return {
      status: 'unhealthy',
      latency,
      lastCheck: new Date().toISOString(),
      models,
      error: errorMsg
    };
  }
}

async function checkAllProviders(): Promise<HealthCache['data']> {
  const results = await Promise.all(
    PROVIDER_CONFIGS.map(async ({ name, envKey }) => {
      const health = await pingProvider(name, process.env[envKey]);
      return { name, health };
    })
  );

  const providers: Record<string, ProviderHealth> = {};
  let healthy = 0;
  let unhealthy = 0;
  let missing = 0;

  for (const { name, health } of results) {
    providers[name] = health;
    if (health.status === 'healthy') healthy++;
    else if (health.status === 'missing') missing++;
    else unhealthy++;
  }

  const totalModels = AI_MODELS.length;
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (unhealthy === PROVIDER_CONFIGS.length) {
    status = 'unhealthy';
  } else if (healthy === PROVIDER_CONFIGS.length - missing) {
    status = 'healthy';
  } else {
    status = 'degraded';
  }

  return {
    status,
    providers,
    summary: { healthy, unhealthy, missing, totalModels }
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    if (healthCache && (now - healthCache.timestamp) < CACHE_TTL_MS) {
      return res.json({
        ...healthCache.data,
        cached: true,
        cacheAge: Math.floor((now - healthCache.timestamp) / 1000)
      });
    }

    const data = await checkAllProviders();
    healthCache = { timestamp: now, data };

    res.json({ ...data, cached: false });
  } catch (error) {
    console.error('[AI Health] Error checking providers:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Failed to check AI providers',
      providers: {},
      summary: { healthy: 0, unhealthy: 0, missing: 0, totalModels: AI_MODELS.length }
    });
  }
});

router.get('/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;
  const config = PROVIDER_CONFIGS.find(p => p.name === provider);

  if (!config) {
    return res.status(404).json({
      error: 'Provider not found',
      availableProviders: PROVIDER_CONFIGS.map(p => p.name)
    });
  }

  try {
    const health = await pingProvider(provider, process.env[config.envKey]);
    res.json({
      provider,
      ...health,
      availableModels: AI_MODELS.filter(m => m.provider === provider).map(m => ({
        id: m.id,
        name: m.name,
        maxTokens: m.maxTokens
      }))
    });
  } catch (error) {
    console.error(`[AI Health] Error checking ${provider}:`, error);
    res.status(503).json({
      provider,
      status: 'unhealthy',
      error: 'Failed to check provider'
    });
  }
});

router.post('/clear-cache', ensureAuthenticated, ensureAdmin, (req: Request, res: Response) => {
  healthCache = null;
  res.json({ message: 'Cache cleared', timestamp: new Date().toISOString() });
});

export default router;
