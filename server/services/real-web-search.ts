// @ts-nocheck
/**
 * Real Web Search Service
 * Provides actual web search capabilities for AI agents
 */

import fetch from 'node-fetch';
import { createLogger } from '../utils/logger';
import * as cheerio from 'cheerio';
import { tavilySearchService } from './tavily-search';

const logger = createLogger('real-web-search');

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
  source?: string;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  error?: string;
  searchEngine: string;
}

export class RealWebSearchService {
  private searchEngines: Map<string, (query: string) => Promise<SearchResult[]>>;

  constructor() {
    this.searchEngines = new Map();
    this.setupSearchEngines();
  }

  private setupSearchEngines() {
    // Google Custom Search API
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      this.searchEngines.set('google', this.searchGoogle.bind(this));
    }

    // Bing Search API
    if (process.env.BING_SEARCH_API_KEY) {
      this.searchEngines.set('bing', this.searchBing.bind(this));
    }

    // DuckDuckGo (no API key required)
    this.searchEngines.set('duckduckgo', this.searchDuckDuckGo.bind(this));

    // Serper API (good for developers)
    if (process.env.SERPER_API_KEY) {
      this.searchEngines.set('serper', this.searchSerper.bind(this));
    }

    // Perplexity API
    if (process.env.PERPLEXITY_API_KEY) {
      this.searchEngines.set('perplexity', this.searchPerplexity.bind(this));
    }

    // Tavily API (preferred for AI agents)
    if (tavilySearchService.isConfigured()) {
      this.searchEngines.set('tavily', this.searchTavily.bind(this));
    }
  }

  async search(query: string, options?: {
    engine?: string;
    maxResults?: number;
    includeContent?: boolean;
  }): Promise<SearchResponse> {
    const maxResults = options?.maxResults || 10;
    const includeContent = options?.includeContent || false;
    let engine = options?.engine;

    // Select search engine
    if (!engine || !this.searchEngines.has(engine)) {
      // Use first available engine
      engine = Array.from(this.searchEngines.keys())[0];
    }

    if (!engine) {
      return {
        success: false,
        results: [],
        error: 'No search engines configured. Please set API keys.',
        searchEngine: 'none'
      };
    }

    try {
      logger.info(`Searching with ${engine}: ${query}`);
      
      const searchFunc = this.searchEngines.get(engine)!;
      let results = await searchFunc(query);
      
      // Limit results
      results = results.slice(0, maxResults);

      // Fetch content if requested
      if (includeContent) {
        results = await this.enrichWithContent(results);
      }

      return {
        success: true,
        results,
        searchEngine: engine
      };

    } catch (error) {
      logger.error(`Search failed: ${error}`);
      return {
        success: false,
        results: [],
        error: error.message,
        searchEngine: engine
      };
    }
  }

  private async searchGoogle(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'],
      source: new URL(item.link).hostname
    }));
  }

  private async searchBing(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.BING_SEARCH_API_KEY;
    
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey!
      }
    });
    
    const data = await response.json();
    
    if (!data.webPages?.value) {
      return [];
    }

    return data.webPages.value.map((item: any) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      publishedDate: item.dateLastCrawled,
      source: new URL(item.url).hostname
    }));
  }

  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    // DuckDuckGo doesn't have an official API, but we can use their instant answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    const results: SearchResult[] = [];
    
    // Add instant answer if available
    if (data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText || data.Abstract,
        source: data.AbstractSource
      });
    }

    // Add related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.FirstURL) {
          results.push({
            title: topic.Text?.split(' - ')[0] || '',
            url: topic.FirstURL,
            snippet: topic.Text || '',
            source: 'DuckDuckGo'
          });
        }
      }
    }

    return results;
  }

  private async searchSerper(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query })
    });
    
    const data = await response.json();
    
    if (!data.organic) {
      return [];
    }

    return data.organic.map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      publishedDate: item.date,
      source: new URL(item.link).hostname
    }));
  }

  private async searchPerplexity(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    const response = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        search_type: 'web'
      })
    });
    
    const data = await response.json();
    
    if (!data.results) {
      return [];
    }

    return data.results.map((item: any) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      content: item.text,
      source: item.source
    }));
  }

  private async searchTavily(query: string): Promise<SearchResult[]> {
    const results = await tavilySearchService.search(query, {
      maxResults: 10,
      searchDepth: 'basic',
    });

    return results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content,
      content: item.content,
      source: new URL(item.url).hostname
    }));
  }

  private async enrichWithContent(results: SearchResult[]): Promise<SearchResult[]> {
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        try {
          const content = await this.fetchPageContent(result.url);
          return {
            ...result,
            content: content.substring(0, 1000) // Limit content length
          };
        } catch (error) {
          logger.warn(`Failed to fetch content for ${result.url}: ${error}`);
          return result;
        }
      })
    );

    return enrichedResults;
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; E-Code-Bot/1.0)'
        },
        timeout: 5000
      });

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove scripts and styles
      $('script').remove();
      $('style').remove();

      // Get main content
      const content = $('main, article, .content, #content, body').first().text();
      
      // Clean up whitespace
      return content.replace(/\s+/g, ' ').trim();

    } catch (error) {
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
  }

  async searchCode(query: string, language?: string): Promise<SearchResult[]> {
    // Search specifically for code examples
    const codeQuery = `${query} ${language || ''} example code site:github.com OR site:stackoverflow.com OR site:gitlab.com`;
    
    const response = await this.search(codeQuery, {
      maxResults: 20,
      includeContent: true
    });

    return response.results;
  }

  async searchDocumentation(query: string, technology?: string): Promise<SearchResult[]> {
    // Search for documentation
    const docQuery = `${query} ${technology || ''} documentation official docs`;
    
    const response = await this.search(docQuery, {
      maxResults: 10
    });

    // Prioritize official documentation
    return response.results.sort((a, b) => {
      const aOfficial = a.url.includes('docs.') || a.url.includes('documentation');
      const bOfficial = b.url.includes('docs.') || b.url.includes('documentation');
      
      if (aOfficial && !bOfficial) return -1;
      if (!aOfficial && bOfficial) return 1;
      return 0;
    });
  }

  async searchError(error: string, context?: string): Promise<SearchResult[]> {
    // Search for error solutions
    const errorQuery = `${error} ${context || ''} solution fix`;
    
    const response = await this.search(errorQuery, {
      maxResults: 15,
      engine: 'google' // Google tends to be best for error messages
    });

    return response.results;
  }

  getAvailableEngines(): string[] {
    return Array.from(this.searchEngines.keys());
  }
}

export const realWebSearchService = new RealWebSearchService();