export const BRAVE_CREDIT_COST = 1;
export const TTS_CREDIT_COST = 2;
export const NANOBANANA_CREDIT_COST = 5;
export const DALLE_CREDIT_COST = 10;
export const TAVILY_CREDIT_COST = 1;

export const AVAILABLE_VOICES = [
  "alloy", "echo", "fable", "onyx", "nova", "shimmer",
];

export async function searchBraveImages(query: string, count: number = 5): Promise<any[]> {
  console.warn("[agent-services] Brave image search not configured");
  return [];
}

export async function generateSpeech(text: string, voice: string = "alloy"): Promise<Buffer | null> {
  console.warn("[agent-services] TTS not configured");
  return null;
}

export async function generateNanoBananaImage(prompt: string): Promise<string | null> {
  console.warn("[agent-services] NanoBanana image generation not configured");
  return null;
}

export async function generateDalleImage(prompt: string, size: string = "1024x1024"): Promise<string | null> {
  console.warn("[agent-services] DALL-E image generation not configured");
  return null;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
  responseTime?: number;
}

export async function searchTavily(
  query: string,
  options?: { searchDepth?: string; maxResults?: number; includeAnswer?: boolean }
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[agent-services] TAVILY_API_KEY not set");
    return { results: [], answer: undefined, responseTime: 0 };
  }

  try {
    const startTime = Date.now();
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: options?.searchDepth || "basic",
        max_results: options?.maxResults || 5,
        include_answer: options?.includeAnswer ?? true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[agent-services] Tavily error:", response.status, errText);
      return { results: [], answer: undefined, responseTime: Date.now() - startTime };
    }

    const data = await response.json() as any;
    return {
      results: (data.results || []).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
        score: r.score || 0,
      })),
      answer: data.answer || undefined,
      responseTime: Date.now() - startTime,
    };
  } catch (err: any) {
    console.error("[agent-services] Tavily search failed:", err.message);
    return { results: [], answer: undefined, responseTime: 0 };
  }
}
