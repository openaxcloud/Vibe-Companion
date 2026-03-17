export interface NanoBananaResult {
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
  model: string;
  prompt: string;
}

interface NanoBananaAPIResponse {
  image?: string;
  data?: string;
  output?: string;
}

export const NANOBANANA_CREDIT_COST = 3;

export async function generateNanoBananaImage(
  prompt: string,
  width: number = 1024,
  height: number = 1024,
  model: string = "stable-diffusion-xl"
): Promise<NanoBananaResult> {
  const endpoint = process.env.NANOBANANA_API_URL;
  if (!endpoint) {
    throw new Error("NanoBanana image generation is not configured. The NANOBANANA_API_URL environment variable is required.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt.slice(0, 2000),
      width: Math.min(width, 2048),
      height: Math.min(height, 2048),
      model,
      num_inference_steps: 30,
      guidance_scale: 7.5,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`NanoBanana API returned status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data: NanoBananaAPIResponse = await response.json();
    const imageData = data.image || data.data || data.output;
    if (!imageData) {
      throw new Error("NanoBanana API returned empty image data");
    }
    const base64 =
      typeof imageData === "string" && imageData.startsWith("data:")
        ? imageData.split(",")[1] || imageData
        : imageData;
    const detectedMime =
      typeof imageData === "string" && imageData.startsWith("data:")
        ? imageData.split(";")[0].split(":")[1] || "image/png"
        : "image/png";
    return {
      imageBase64: base64,
      mimeType: detectedMime,
      width,
      height,
      model,
      prompt,
    };
  }

  if (contentType.includes("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    return {
      imageBase64: Buffer.from(arrayBuffer).toString("base64"),
      mimeType: contentType.split(";")[0].trim(),
      width,
      height,
      model,
      prompt,
    };
  }

  throw new Error(`NanoBanana API returned unexpected content type: ${contentType}`);
}
