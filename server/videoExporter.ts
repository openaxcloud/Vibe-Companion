import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  duration: number;
  quality: "standard" | "high";
}

export interface AnimationExportRequest {
  projectId: string;
  artifactId: string;
  htmlContent: string;
  options: ExportOptions;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  fileSize?: number;
}

async function captureFramesWithPuppeteer(
  htmlContent: string,
  tmpDir: string,
  options: ExportOptions,
): Promise<boolean> {
  try {
    const puppeteer = await import("puppeteer-core");
    let executablePath: string | undefined;
    const candidates = [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        executablePath = c;
        break;
      }
    }
    if (!executablePath) {
      try {
        const result = execSync("which chromium || which chromium-browser || which google-chrome 2>/dev/null", {
          timeout: 3000,
          encoding: "utf-8",
        }).trim();
        if (result) executablePath = result.split("\n")[0];
      } catch {}
    }
    if (!executablePath) return false;

    const browser = await puppeteer.default.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: options.width, height: options.height });

    const htmlPath = path.join(tmpDir, "animation.html");
    fs.writeFileSync(htmlPath, htmlContent);
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 15000 });

    await page.evaluate(() => {
      window.postMessage({ type: "animation-control", action: "reset" }, "*");
    });
    await new Promise((r) => setTimeout(r, 200));

    await page.evaluate(() => {
      window.postMessage({ type: "animation-control", action: "play" }, "*");
    });

    const totalFrames = Math.ceil(options.duration * options.fps);
    const frameDuration = 1000 / options.fps;

    for (let i = 0; i < totalFrames; i++) {
      await new Promise((r) => setTimeout(r, frameDuration));

      const framePath = path.join(tmpDir, `frame_${String(i).padStart(6, "0")}.png`);
      await page.screenshot({ path: framePath, type: "png" });
    }

    await browser.close();
    return true;
  } catch {
    return false;
  }
}

function captureFramesWithCanvas(
  scenes: any[],
  tmpDir: string,
  options: ExportOptions,
): void {
  let createCanvasFn: any = null;
  try {
    const canvasModule = require("canvas");
    createCanvasFn = canvasModule.createCanvas;
  } catch {}

  const effectiveScenes = scenes.length > 0 ? scenes : [{ backgroundColor: "#1a1a2e", duration: options.duration, elements: [] }];

  const totalSceneDuration = effectiveScenes.reduce((sum: number, s: any) => sum + (s.duration || 3), 0);
  const scaleFactor = options.duration / totalSceneDuration;

  let frameIndex = 0;

  for (const scene of effectiveScenes) {
    const sceneDuration = (scene.duration || 3) * scaleFactor;
    const totalFrames = Math.max(1, Math.round(sceneDuration * options.fps));

    for (let f = 0; f < totalFrames; f++) {
      const progress = totalFrames > 1 ? f / (totalFrames - 1) : 1;

      if (createCanvasFn) {
        const canvas = createCanvasFn(options.width, options.height);
        const ctx = canvas.getContext("2d");

        const bgHex = (scene.backgroundColor || "#1a1a2e").replace("#", "");
        ctx.fillStyle = `#${bgHex}`;
        ctx.fillRect(0, 0, options.width, options.height);

        if (scene.elements) {
          for (const el of scene.elements) {
            const elStartNorm = (el.startTime || 0) / (scene.duration || 3);
            const elEndNorm = (el.endTime || (scene.duration || 3)) / (scene.duration || 3);
            if (progress < elStartNorm || progress > elEndNorm) continue;

            const elProgress = (progress - elStartNorm) / (elEndNorm - elStartNorm);
            const x = (el.x || 0) / 100 * options.width;
            const y = (el.y || 0) / 100 * options.height;
            const w = (el.width || 10) / 100 * options.width;
            const h = (el.height || 10) / 100 * options.height;

            let alpha = 1;
            let offsetY = 0;
            let scale = 1;

            if (el.animation === "fade-in") {
              alpha = Math.min(1, elProgress * 3);
            } else if (el.animation === "slide-up") {
              const slideProgress = Math.min(1, elProgress * 3);
              offsetY = (1 - slideProgress) * 50;
              alpha = slideProgress;
            } else if (el.animation === "scale") {
              const scaleProgress = Math.min(1, elProgress * 3);
              scale = 0.5 + scaleProgress * 0.5;
              alpha = scaleProgress;
            }

            ctx.globalAlpha = alpha;

            if (el.type === "text" && el.content) {
              const fontSize = parseInt(el.style?.fontSize || "24", 10) * scale;
              ctx.font = `${el.style?.fontWeight === "bold" ? "bold " : ""}${Math.round(fontSize)}px sans-serif`;
              ctx.fillStyle = el.style?.color || "#ffffff";
              ctx.textAlign = (el.style?.textAlign as CanvasTextAlign) || "left";

              const lines = el.content.split("\n");
              const lineHeight = fontSize * 1.3;
              const textX = el.style?.textAlign === "center" ? x + w / 2 : x;

              for (let li = 0; li < lines.length; li++) {
                ctx.fillText(lines[li], textX, y + fontSize + li * lineHeight + offsetY);
              }
            } else if (el.type === "shape") {
              ctx.fillStyle = el.style?.backgroundColor || el.style?.fill || "#0079F2";
              const radius = parseInt(el.style?.borderRadius || "0", 10);
              if (radius > 0) {
                roundRect(ctx, x, y + offsetY, w * scale, h * scale, radius);
                ctx.fill();
              } else {
                ctx.fillRect(x, y + offsetY, w * scale, h * scale);
              }
            }

            ctx.globalAlpha = 1;
          }
        }

        const pngBuffer = canvas.toBuffer("image/png");
        const framePath = path.join(tmpDir, `frame_${String(frameIndex).padStart(6, "0")}.png`);
        fs.writeFileSync(framePath, pngBuffer);
      } else {
        const ppmHeader = `P6\n${options.width} ${options.height}\n255\n`;
        const bgHex = (scene.backgroundColor || "#1a1a2e").replace("#", "");
        const r = parseInt(bgHex.substring(0, 2), 16) || 26;
        const g = parseInt(bgHex.substring(2, 4), 16) || 26;
        const b = parseInt(bgHex.substring(4, 6), 16) || 46;
        const pixels = Buffer.alloc(options.width * options.height * 3);
        for (let i = 0; i < options.width * options.height; i++) {
          pixels[i * 3] = r;
          pixels[i * 3 + 1] = g;
          pixels[i * 3 + 2] = b;
        }
        const ppmData = Buffer.concat([Buffer.from(ppmHeader), pixels]);
        const framePath = path.join(tmpDir, `frame_${String(frameIndex).padStart(6, "0")}.ppm`);
        fs.writeFileSync(framePath, ppmData);
      }

      frameIndex++;
    }
  }
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function exportAnimationToMp4(
  scenes: any[],
  options: ExportOptions,
  htmlContent?: string,
): Promise<ExportResult> {
  const tmpDir = `/tmp/animation_export_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    let usedPuppeteer = false;
    if (htmlContent) {
      usedPuppeteer = await captureFramesWithPuppeteer(htmlContent, tmpDir, options);
    }

    if (!usedPuppeteer) {
      captureFramesWithCanvas(scenes, tmpDir, options);
    }

    const outputPath = path.join(tmpDir, "output.mp4");
    let hasCanvasModule = false;
    try {
      require("canvas");
      hasCanvasModule = true;
    } catch {}
    const ext = usedPuppeteer || hasCanvasModule ? "png" : "ppm";
    const crf = options.quality === "high" ? "18" : "23";
    const preset = options.quality === "high" ? "slow" : "fast";

    try {
      execSync(
        `ffmpeg -y -framerate ${options.fps} -i ${tmpDir}/frame_%06d.${ext} -c:v libx264 -pix_fmt yuv420p -preset ${preset} -crf ${crf} ${outputPath}`,
        { timeout: 120000, stdio: "pipe" },
      );
    } catch (ffmpegErr: unknown) {
      const errMsg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return { success: false, error: "FFmpeg render failed: " + errMsg.substring(0, 200) };
    }

    if (!fs.existsSync(outputPath)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return { success: false, error: "Video render produced no output" };
    }

    const stat = fs.statSync(outputPath);
    return { success: true, outputPath, fileSize: stat.size };
  } catch (err: unknown) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

export function cleanupExportDir(outputPath: string): void {
  try {
    const dir = path.dirname(outputPath);
    if (dir.startsWith("/tmp/animation_export_")) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
}
