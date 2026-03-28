import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const dir = typeof import.meta.dirname === "string" ? import.meta.dirname : __dirname;
  let distPath = path.resolve(dir, "public");
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(dir, "..", "dist", "public");
  }
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory, make sure to build the client first`,
    );
  }

  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));

  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
