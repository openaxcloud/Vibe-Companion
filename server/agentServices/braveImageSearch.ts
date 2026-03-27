export interface BraveImageResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  width: number;
  height: number;
}

interface BraveAPIImageProperties {
  url?: string;
  width?: number;
  height?: number;
}

interface BraveAPIThumbnail {
  src?: string;
}

interface BraveAPIImageResult {
  title?: string;
  url?: string;
  properties?: BraveAPIImageProperties;
  thumbnail?: BraveAPIThumbnail;
}

interface BraveAPIResponse {
  results?: BraveAPIImageResult[];
}

export const BRAVE_CREDIT_COST = 1;

export async function searchBraveImages(
  query: string,
  count: number = 8
): Promise<BraveImageResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("Brave Image Search is not configured. The BRAVE_SEARCH_API_KEY environment variable is required.");
  }

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 20)),
    safesearch: "moderate",
  });

  const response = await fetch(
    `https://api.search.brave.com/res/v1/images/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(`Brave Image Search API returned status ${response.status}`);
  }

  const data: BraveAPIResponse = await response.json();
  return (data.results || [])
    .slice(0, count)
    .map((r: BraveAPIImageResult) => ({
      title: r.title || "",
      imageUrl: r.properties?.url || r.url || "",
      thumbnailUrl: r.thumbnail?.src || r.properties?.url || r.url || "",
      sourceUrl: r.url || "",
      sourceDomain: extractDomain(r.url || ""),
      width: r.properties?.width || 0,
      height: r.properties?.height || 0,
    }));
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
