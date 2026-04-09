import OpenAI from 'openai';
import { createLogger } from '../../utils/logger';

const logger = createLogger('rag-embedding');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100;
const MAX_INPUT_TOKENS = 8191;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getClient();
  if (!client) {
    logger.warn('OpenAI API key not configured - embeddings disabled');
    return null;
  }

  try {
    const truncated = truncateToTokenLimit(text);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncated,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data[0].embedding;
  } catch (error: any) {
    logger.error(`Embedding generation failed: ${error.message}`);
    return null;
  }
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const client = getClient();
  if (!client) {
    return texts.map(() => null);
  }

  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const truncated = batch.map(t => truncateToTokenLimit(t));

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      for (let j = 0; j < response.data.length; j++) {
        results[i + j] = response.data[j].embedding;
      }
    } catch (error: any) {
      logger.error(`Batch embedding failed (batch ${Math.floor(i / MAX_BATCH_SIZE)}): ${error.message}`);
      for (let j = 0; j < batch.length; j++) {
        try {
          const single = await generateEmbedding(batch[j]);
          results[i + j] = single;
        } catch { /* skip */ }
      }
    }
  }

  return results;
}

function truncateToTokenLimit(text: string): string {
  const approxTokens = Math.ceil(text.length / 4);
  if (approxTokens <= MAX_INPUT_TOKENS) return text;
  return text.slice(0, MAX_INPUT_TOKENS * 4);
}

export function isEmbeddingAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
