import OpenAI from "openai";

export async function generateImageBuffer(
  prompt: string,
  options?: { width?: number; height?: number; model?: string; quality?: string; style?: string }
): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[image-client] OPENAI_API_KEY not set");
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const w = options?.width || 1024;
    const h = options?.height || 1024;
    let size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    if (w > h) size = "1792x1024";
    else if (h > w) size = "1024x1792";

    const response = await openai.images.generate({
      model: options?.model || "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: (options?.quality as any) || "standard",
      style: (options?.style as any) || "vivid",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return null;

    return Buffer.from(b64, "base64");
  } catch (err: any) {
    console.error("[image-client] Generation failed:", err.message);
    return null;
  }
}

export async function editImages(
  imageBuffer: Buffer,
  editPrompt: string,
  options?: any
): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[image-client] OPENAI_API_KEY not set");
    return null;
  }

  try {
    console.log(`[image-client] Editing image with prompt: "${editPrompt.substring(0, 50)}..."`);
    return null;
  } catch (err: any) {
    console.error("[image-client] Edit failed:", err.message);
    return null;
  }
}
