import { createLogger } from '../utils/logger';

const logger = createLogger('tavily-search');

export interface SearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyApiResponse {
  answer?: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export class TavilySearchService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
    if (!this.apiKey) {
      logger.warn('TAVILY_API_KEY is not set. Tavily search will return empty results.');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.isConfigured()) {
      console.warn('Tavily API key not configured. Returning empty results.');
      return [];
    }

    const maxResults = options?.maxResults ?? 10;
    const searchDepth = options?.searchDepth ?? 'basic';
    const includeAnswer = options?.includeAnswer ?? false;

    const requestBody = {
      api_key: this.apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: includeAnswer,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(TAVILY_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily API error (${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as TavilyApiResponse;

        const results: SearchResult[] = data.results.map((result) => ({
          title: result.title,
          url: result.url,
          content: result.content,
          score: result.score,
        }));

        logger.info(`Tavily search completed for "${query}" - ${results.length} results`);
        return results;

      } catch (error) {
        lastError = error as Error;
        logger.error(`Tavily search attempt ${attempt}/${MAX_RETRIES} failed:`, error);

        if (attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          logger.info(`Retrying in ${backoffMs}ms...`);
          await this.sleep(backoffMs);
        }
      }
    }

    logger.error(`All ${MAX_RETRIES} Tavily search attempts failed for query: "${query}"`);
    console.error('Tavily search failed after retries:', lastError?.message);
    return [];
  }

  async searchContext(query: string): Promise<string> {
    if (!this.isConfigured()) {
      console.warn('Tavily API key not configured. Returning empty context.');
      return `No search results available for "${query}" (Tavily API key not configured).`;
    }

    const results = await this.search(query, {
      maxResults: 5,
      searchDepth: 'advanced',
      includeAnswer: true,
    });

    if (results.length === 0) {
      return `No search results found for "${query}".`;
    }

    let formattedContext = `Web search results for "${query}":\n\n`;

    results.forEach((result, index) => {
      formattedContext += `[${index + 1}] ${result.title}\n`;
      formattedContext += `    URL: ${result.url}\n`;
      formattedContext += `    ${result.content}\n`;
      formattedContext += `    Relevance Score: ${(result.score * 100).toFixed(1)}%\n\n`;
    });

    return formattedContext.trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const tavilySearchService = new TavilySearchService();
