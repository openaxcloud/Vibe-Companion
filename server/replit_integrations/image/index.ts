import type { Express } from "express";

export function registerImageRoutes(app: Express): void {
  app.post("/api/integrations/image/generate", async (req, res) => {
    res.status(501).json({ error: "Image generation not configured" });
  });

  app.post("/api/integrations/image/edit", async (req, res) => {
    res.status(501).json({ error: "Image editing not configured" });
  });

  console.log("Integration routes registered (image)");
}
