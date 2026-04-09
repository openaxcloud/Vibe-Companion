import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

interface ImageGenerationRequest {
  prompt: string;
  projectId?: string | number;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  n?: number;
  outputPath?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  negativePrompt?: string;
}

interface ImageEditRequest {
  prompt: string;
  imagePath: string;
  projectId?: string | number;
}

function aspectRatioToSize(ratio?: string): "1024x1024" | "1792x1024" | "1024x1792" {
  switch (ratio) {
    case "16:9":
    case "4:3":
      return "1792x1024";
    case "9:16":
    case "3:4":
      return "1024x1792";
    default:
      return "1024x1024";
  }
}

function sanitizePath(p: string): string {
  return p.replace(/\.\./g, "").replace(/[^a-zA-Z0-9_\-\/\. ]/g, "_");
}

async function downloadImageToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function registerImageRoutes(app: Express): void {
  app.post("/api/integrations/image/generate", async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "Image generation service not configured",
          message: "OpenAI API key is required for image generation",
        });
      }

      const {
        prompt,
        projectId,
        size,
        quality = "standard",
        style = "vivid",
        n = 1,
        outputPath,
        aspectRatio,
        negativePrompt,
      } = req.body as ImageGenerationRequest;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const effectiveSize = size || aspectRatioToSize(aspectRatio);
      let fullPrompt = prompt.trim();
      if (negativePrompt) {
        fullPrompt += `\n\nAvoid: ${negativePrompt}`;
      }

      const openai = new OpenAI({ apiKey });

      console.log(`[image-gen] Generating image: "${fullPrompt.substring(0, 80)}..." size=${effectiveSize} quality=${quality}`);

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: effectiveSize,
        quality,
        style,
        response_format: "url",
      });

      const imageUrl = response.data?.[0]?.url;
      const revisedPrompt = response.data?.[0]?.revised_prompt;

      if (!imageUrl) {
        return res.status(500).json({ error: "No image was generated" });
      }

      let savedPath: string | null = null;

      if (projectId) {
        const imageBuffer = await downloadImageToBuffer(imageUrl);
        const projectDir = path.resolve("projects", String(projectId));

        if (!fs.existsSync(projectDir)) {
          fs.mkdirSync(projectDir, { recursive: true });
        }

        const assetsDir = path.join(projectDir, "assets", "images");
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }

        let targetPath: string;
        if (outputPath) {
          const cleanPath = sanitizePath(outputPath).replace(/^\/+/, "");
          targetPath = path.resolve(projectDir, cleanPath);
          if (!targetPath.startsWith(path.resolve(projectDir) + path.sep)) {
            return res.status(400).json({ error: "Invalid output path" });
          }
          const parentDir = path.dirname(targetPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
        } else {
          const slug = prompt
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 40)
            .replace(/-$/, "");
          targetPath = path.join(assetsDir, `${slug}-${randomUUID().slice(0, 8)}.png`);
        }

        fs.writeFileSync(targetPath, imageBuffer);
        savedPath = path.relative(projectDir, targetPath);
        console.log(`[image-gen] Saved to: ${savedPath}`);
      }

      res.json({
        success: true,
        images: [
          {
            url: imageUrl,
            revisedPrompt,
            filePath: savedPath,
            size: effectiveSize,
            quality,
            style,
          },
        ],
      });
    } catch (err: any) {
      console.error("[image-gen] Error:", err.message);

      if (err.status === 400 && err.message?.includes("safety")) {
        return res.status(400).json({
          error: "content_policy_violation",
          message: "The image request was rejected due to content policy. Please modify your prompt.",
        });
      }

      res.status(500).json({
        error: "Image generation failed",
        message: err.message || "Unknown error",
      });
    }
  });

  app.post("/api/integrations/image/edit", async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "Image editing service not configured" });
      }

      const { prompt, imagePath, projectId } = req.body as ImageEditRequest;

      if (!prompt || !imagePath) {
        return res.status(400).json({ error: "Prompt and imagePath are required" });
      }

      const projectDir = path.resolve("projects", String(projectId || "default"));
      const fullImagePath = path.join(projectDir, sanitizePath(imagePath));

      if (!fs.existsSync(fullImagePath)) {
        return res.status(404).json({ error: "Source image not found" });
      }

      const openai = new OpenAI({ apiKey });

      const imageFile = fs.createReadStream(fullImagePath);
      const response = await openai.images.edit({
        model: "dall-e-2",
        image: imageFile as any,
        prompt: prompt.trim(),
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        return res.status(500).json({ error: "No edited image was generated" });
      }

      const imageBuffer = await downloadImageToBuffer(imageUrl);
      const editedPath = fullImagePath.replace(/(\.[^.]+)$/, `-edited$1`);
      fs.writeFileSync(editedPath, imageBuffer);
      const savedPath = path.relative(projectDir, editedPath);

      res.json({
        success: true,
        images: [
          {
            url: imageUrl,
            filePath: savedPath,
          },
        ],
      });
    } catch (err: any) {
      console.error("[image-edit] Error:", err.message);
      res.status(500).json({
        error: "Image editing failed",
        message: err.message || "Unknown error",
      });
    }
  });

  app.get("/api/integrations/image/status", (_req: Request, res: Response) => {
    const hasKey = !!process.env.OPENAI_API_KEY;
    res.json({
      available: hasKey,
      provider: "openai",
      model: "dall-e-3",
      editModel: "dall-e-2",
      supportedSizes: ["1024x1024", "1792x1024", "1024x1792"],
      supportedQualities: ["standard", "hd"],
      supportedStyles: ["vivid", "natural"],
    });
  });

  console.log("Integration routes registered (image - DALL-E 3)");
}
