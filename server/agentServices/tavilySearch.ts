import { fetchWithRetry } from "../utils/fetch-with-retry";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
  responseTime: number;
}

export const TAVILY_CREDIT_COST = 1;

export async function searchTavily(
  query: string,
  options: {
    searchDepth?: "basic" | "advanced";
    maxResults?: number;
    includeAnswer?: boolean;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Tavily web search is not configured. The TAVILY_API_KEY environment variable is required.");
  }

  const startTime = Date.now();

  const response = await fetchWithRetry("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query.slice(0, 400),
      search_depth: options.searchDepth || "basic",
      max_results: Math.min(options.maxResults || 5, 10),
      include_answer: options.includeAnswer ?? true,
      include_domains: options.includeDomains || [],
      exclude_domains: options.excludeDomains || [],
    }),
    timeoutMs: 15000,
    retries: 3,
    onRetry: ({ attempt, status, delayMs }) =>
      console.warn(`[tavily] retry ${attempt} after ${delayMs}ms (status=${status ?? "network"})`),
  });

  if (!response.ok) {
    let message = `Tavily API returned status ${response.status}`;
    try {
      const errorBody = await response.text();
      const parsed = JSON.parse(errorBody);
      if (parsed.detail) message = `Tavily: ${parsed.detail}`;
      else if (parsed.message) message = `Tavily: ${parsed.message}`;
    } catch {}
    throw new Error(message);
  }

  const data = await response.json();
  const responseTime = Date.now() - startTime;

  return {
    query,
    results: (data.results || []).map((r: { title?: string; url?: string; content?: string; score?: number }) => ({
      title: r.title || "",
      url: r.url || "",
      content: r.content || "",
      score: r.score || 0,
    })),
    answer: data.answer || undefined,
    responseTime,
  };
}
