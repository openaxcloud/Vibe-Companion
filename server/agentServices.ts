import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const BRAVE_CREDIT_COST = 1;
export const TTS_CREDIT_COST = 2;
export const NANOBANANA_CREDIT_COST = 5;
export const DALLE_CREDIT_COST = 10;
export const TAVILY_CREDIT_COST = 1;
export const IMAGE_GEN_CREDIT_COST = 8;

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

export interface ImageGenerationResult {
  url: string;
  filePath: string | null;
  revisedPrompt?: string;
  size: string;
}

export async function generateDalleImage(
  prompt: string,
  options?: {
    size?: "1024x1024" | "1792x1024" | "1024x1792";
    quality?: "standard" | "hd";
    style?: "vivid" | "natural";
    projectId?: string | number;
    outputPath?: string;
    negativePrompt?: string;
  }
): Promise<ImageGenerationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[agent-services] OPENAI_API_KEY not set — image generation unavailable");
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const size = options?.size || "1024x1024";
    const quality = options?.quality || "standard";
    const style = options?.style || "vivid";

    let fullPrompt = prompt.trim();
    if (options?.negativePrompt) {
      fullPrompt += `\n\nAvoid: ${options.negativePrompt}`;
    }

    console.log(`[agent-services] Generating DALL-E 3 image: "${fullPrompt.substring(0, 60)}..."`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size,
      quality,
      style,
      response_format: "url",
    });

    const imageUrl = response.data?.[0]?.url;
    const revisedPrompt = response.data?.[0]?.revised_prompt;

    if (!imageUrl) {
      console.error("[agent-services] DALL-E returned no image");
      return null;
    }

    let savedPath: string | null = null;

    if (options?.projectId) {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error("Failed to download generated image");
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const projectDir = path.resolve("projects", String(options.projectId));
      const assetsDir = path.join(projectDir, "assets", "images");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      let targetPath: string;
      if (options.outputPath) {
        const cleanPath = options.outputPath.replace(/\.\./g, "").replace(/^\/+/, "");
        targetPath = path.resolve(projectDir, cleanPath);
        if (!targetPath.startsWith(path.resolve(projectDir) + path.sep)) {
          console.error("[agent-services] Path traversal blocked:", options.outputPath);
          return null;
        }
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      } else {
        const slug = prompt
          .trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 40)
          .replace(/-$/, "");
        targetPath = path.join(assetsDir, `${slug}-${randomUUID().slice(0, 8)}.png`);
      }

      fs.writeFileSync(targetPath, imageBuffer);
      savedPath = path.relative(projectDir, targetPath);
      console.log(`[agent-services] Image saved: ${savedPath}`);
    }

    return {
      url: imageUrl,
      filePath: savedPath,
      revisedPrompt,
      size,
    };
  } catch (err: any) {
    console.error("[agent-services] DALL-E image generation failed:", err.message);
    return null;
  }
}

export function isImageGenerationAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
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
