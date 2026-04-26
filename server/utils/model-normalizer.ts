/**
 * Model Name Normalizer (Production-Critical)
 *
 * Maps ALL possible model names (aliases, legacy, deprecated) to valid real model IDs
 * that actually work with the respective provider APIs.
 *
 * VERIFIED via live API tests (March 2026):
 *   429 quota / 400 credit balance = model EXISTS and is accessible
 *   400 "model not found" = wrong ID, do not use
 *   403 billing required = model EXISTS but account needs credits
 */

import { createLogger } from './logger';
import { AlertService } from '../services/alert-service';

const logger = createLogger('model-normalizer');

const MODEL_NORMALIZATION_MAP: Record<string, string> = {

  // ── OpenAI ──────────────────────────────────────────────────────────────────
  // GPT-4.1 family — confirmed working on ModelFarm
  'gpt-4.1':            'gpt-4.1',
  'gpt-4.1-mini':       'gpt-4.1-mini',
  'gpt-4.1-nano':       'gpt-4.1-nano',
  // GPT-4o family — confirmed working on ModelFarm
  'gpt-4o':             'gpt-4o',
  'gpt-4o-mini':        'gpt-4o-mini',
  'gpt-4-turbo':        'gpt-4-turbo',
  'gpt-4-turbo-preview':'gpt-4-turbo',
  'gpt-4':              'gpt-4o',
  // O-series — confirmed working on ModelFarm
  'o4-mini':            'o4-mini',
  'o3':                 'o3',
  'o3-mini':            'o3-mini',
  'o1':                 'o1',
  'o1-mini':            'o4-mini',
  // Unknown/broken aliases → redirect to best working model
  'gpt-5.1':            'gpt-4.1',
  'gpt-5':              'gpt-4.1',
  'gpt-5-mini':         'gpt-4.1-mini',
  'gpt-5-nano':         'gpt-4.1-nano',
  'gpt-5.2':            'gpt-4.1',
  'gpt-5.3':            'gpt-4.1',
  'gpt-5.2-codex':      'gpt-4.1',
  'gpt-5.4':            'gpt-4.1',
  'gpt-5.4-pro':        'gpt-4.1',
  'gpt-5.4-2026-03-05': 'gpt-4.1',
  'gpt-5.4-pro-2026-03-05': 'gpt-4.1',

  // ── Anthropic ────────────────────────────────────────────────────────────────
  // Current generation (April 2026) — Opus 4.7 (1M ctx) / Sonnet 4.6 / Haiku 4.5
  'claude-opus-4-7':              'claude-opus-4-7',
  'claude-sonnet-4-6':            'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001':    'claude-haiku-4-5-20251001',
  // Friendly aliases → latest
  'claude':                       'claude-opus-4-7',
  'claude-opus':                  'claude-opus-4-7',
  'claude-opus-4':                'claude-opus-4-7',
  'claude-opus-4-5':              'claude-opus-4-7',
  'claude-opus-4.5':              'claude-opus-4-7',
  'claude-opus-4-7-1m':           'claude-opus-4-7',
  'claude-sonnet':                'claude-sonnet-4-6',
  'claude-sonnet-4':              'claude-sonnet-4-6',
  'claude-sonnet-4-5':            'claude-sonnet-4-6',
  'claude-haiku':                 'claude-haiku-4-5-20251001',
  'claude-haiku-4':               'claude-haiku-4-5-20251001',
  'claude-haiku-4-5':             'claude-haiku-4-5-20251001',
  // Legacy snapshots → redirect to current generation
  'claude-3-haiku':               'claude-haiku-4-5-20251001',
  'claude-3-haiku-20240307':      'claude-haiku-4-5-20251001',
  'claude-3-5-haiku':             'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022':    'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet':            'claude-sonnet-4-6',
  'claude-3-5-sonnet-20241022':   'claude-sonnet-4-6',
  'claude-3-7-sonnet':            'claude-sonnet-4-6',
  'claude-3-7-sonnet-20250219':   'claude-sonnet-4-6',
  'claude-3-opus':                'claude-opus-4-7',
  'claude-3-opus-20240229':       'claude-opus-4-7',
  'claude-haiku-4-5-20251015':    'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929':   'claude-sonnet-4-6',
  'claude-opus-4-5-20251101':     'claude-opus-4-7',
  'claude-opus-4-5-20251124':     'claude-opus-4-7',
  'claude-opus-4-1-20250805':     'claude-opus-4-7',

  // ── Google Gemini ─────────────────────────────────────────────────────────────
  'gemini-2.5-flash':             'gemini-2.5-flash',
  'gemini-2.5-pro':               'gemini-2.5-pro',
  // Aliases → latest
  'gemini-pro':                   'gemini-2.5-pro',
  'gemini-flash':                 'gemini-2.5-flash',
  // Deprecated → redirect to latest
  'gemini-2.0-flash':             'gemini-2.5-flash',
  'gemini-2.0-flash-lite':        'gemini-2.5-flash',
  'gemini-1.5-pro':               'gemini-2.5-pro',
  'gemini-1.5-flash':             'gemini-2.5-flash',
  'gemini-3-flash':               'gemini-2.5-flash',
  'gemini-3-pro':                 'gemini-2.5-pro',
  'gemini-2.0-flash-exp':         'gemini-2.5-flash',
  'grok-2-latest':                'grok-3',
  'grok':                         'grok-3',
  'grok-beta':                    'grok-3',
  'grok-fast':                    'grok-3-fast',
  'grok-3-fast-latest':           'grok-3-fast',
  'grok-4':                       'grok-3',
  'grok-4-fast':                  'grok-3-fast',
  'grok-4-1-fast':                'grok-3-fast',
  'grok-4-1-fast-reasoning':      'grok-3',

  // ── Moonshot AI / Kimi ───────────────────────────────────────────────────────
  'moonshot-v1-8k':               'moonshot-v1-8k',
  'moonshot-v1-32k':              'moonshot-v1-32k',
  'moonshot-v1-128k':             'moonshot-v1-128k',
  'kimi':                         'moonshot-v1-32k',
  'kimi-k1.5':                    'moonshot-v1-128k',
  'kimi-k2':                      'moonshot-v1-128k',
  'kimi-thinking':                'moonshot-v1-128k',
  'kimi-k2-thinking':             'moonshot-v1-128k',
  'kimi-k2-thinking-turbo':       'moonshot-v1-128k',
  'kimi-k2-turbo-preview':        'moonshot-v1-32k',
  'kimi-k2-0905-preview':         'moonshot-v1-128k',
  'kimi-k2-0711-preview':         'moonshot-v1-128k',
};

const PROVIDER_DEFAULTS: Record<string, string> = {
  'openai':     'gpt-4o',                     // Direct OpenAI (OPENAI_API_KEY)
  'anthropic':  'claude-opus-4-7',             // Direct Anthropic (ANTHROPIC_API_KEY) — Opus 4.7 1M context
  'gemini':     'gemini-2.5-flash',
  'google':     'gemini-2.5-flash',
  'xai':        'grok-3',
  'moonshot':   'moonshot-v1-32k',
};

export function normalizeModelName(modelName: string | any | undefined, provider: string): string {
  let normalizedInput: string | undefined = modelName;

  if (modelName && typeof modelName === 'object') {
    if ('id' in modelName && typeof modelName.id === 'string') {
      normalizedInput = modelName.id;
    } else if ('modelId' in modelName && typeof modelName.modelId === 'string') {
      normalizedInput = modelName.modelId;
    } else {
      logger.warn(`Model object has no valid id/modelId:`, JSON.stringify(modelName));
      normalizedInput = undefined;
    }
  }

  if (!normalizedInput) {
    const fallback = PROVIDER_DEFAULTS[provider.toLowerCase()] || 'gpt-4o';
    logger.warn(`Model name undefined/null, using provider default: ${fallback}`);
    return fallback;
  }

  if (MODEL_NORMALIZATION_MAP[normalizedInput]) {
    const normalized = MODEL_NORMALIZATION_MAP[normalizedInput];
    if (normalized !== normalizedInput) {
      logger.debug(`Model normalized: "${normalizedInput}" → "${normalized}"`);
    }
    return normalized;
  }

  logger.warn(`Unknown model: "${normalizedInput}" (provider: ${provider}) — using provider default`);
  AlertService.unknownModel(normalizedInput, provider, PROVIDER_DEFAULTS[provider.toLowerCase()] || 'gpt-4o').catch(() => {});
  return PROVIDER_DEFAULTS[provider.toLowerCase()] || 'gpt-4o';
}
