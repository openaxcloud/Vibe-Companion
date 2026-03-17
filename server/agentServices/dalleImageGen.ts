export interface DalleImageResult {
  imageUrl: string;
  revisedPrompt: string;
  model: string;
  size: string;
  quality: string;
  style: string;
}

export const DALLE_CREDIT_COST = 3;

export async function generateDalleImage(
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024",
  quality: "standard" | "hd" = "standard",
  style: "vivid" | "natural" = "vivid"
): Promise<DalleImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("DALL-E image generation is not configured. The OPENAI_API_KEY environment variable is required.");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      quality,
      style,
      response_format: "url",
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `DALL-E API returned status ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) message = parsed.error.message;
    } catch {}
    throw new Error(message);
  }

  const data = await response.json();
  const image = data.data?.[0];
  if (!image?.url) {
    throw new Error("DALL-E API returned empty image data");
  }

  return {
    imageUrl: image.url,
    revisedPrompt: image.revised_prompt || prompt,
    model: "dall-e-3",
    size,
    quality,
    style,
  };
}
