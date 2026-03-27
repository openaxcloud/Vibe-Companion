import type { Express, Request, Response, RequestHandler } from "express";
import { openai } from "./client";
import { storage } from "../../storage";

export function registerImageRoutes(app: Express, ...middlewares: any[]): void {
  app.post("/api/generate-image", ...middlewares, async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (prompt.length > 4000) {
        return res.status(400).json({ error: "Prompt too long (max 4000 characters)" });
      }

      const validSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"] as const;
      type ImageSize = typeof validSizes[number];
      const imageSize: ImageSize = (validSizes as readonly string[]).includes(size) ? (size as ImageSize) : "1024x1024";

      const quota = await storage.incrementAiCall(req.session.userId!);
      if (!quota.allowed) {
        return res.status(429).json({ error: "Daily AI call limit reached. Upgrade to Pro for more." });
      }

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: imageSize,
      });

      const imageData = response.data?.[0];
      if (!imageData?.b64_json && !imageData?.url) {
        return res.status(502).json({ error: "Image generation returned empty result" });
      }
      res.json({
        url: imageData?.url,
        b64_json: imageData?.b64_json,
        image: imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : undefined,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}
