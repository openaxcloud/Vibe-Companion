import express, { type Express } from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname || __dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.warn("[static] dist/public not found, skipping static file serving");
    return;
  }

  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: true,
    index: false,
  }));

  app.get("{*path}", (_req, res, next) => {
    if (_req.path.startsWith("/api") || _req.path.startsWith("/ws")) {
      return next();
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}
