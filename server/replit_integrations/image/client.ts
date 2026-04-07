export async function generateImageBuffer(prompt: string, options?: { width?: number; height?: number; model?: string }): Promise<Buffer | null> {
  console.warn("[image-client] Image generation not configured");
  return null;
}

export async function editImages(imageBuffer: Buffer, editPrompt: string, options?: any): Promise<Buffer | null> {
  console.warn("[image-client] Image editing not configured");
  return null;
}
