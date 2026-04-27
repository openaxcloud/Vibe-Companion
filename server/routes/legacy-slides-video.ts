// AUTO-EXTRACTED from server/routes.ts (lines 14690-15631)
// Original section: slides-video
// Extracted by scripts/batch-extract-routes.cjs

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";
import { AGENT_MODE_COSTS, AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, AUTONOMOUS_TIER_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier, type InsertDeployment, type CheckpointStateSnapshot, insertThemeSchema, insertArtifactSchema, ARTIFACT_TYPES, type SlideData, type SlideTheme, MODEL_TOKEN_PRICING, SERVICE_CREDIT_COSTS, OVERAGE_RATE_PER_CREDIT, calculateTokenCredits, getProviderPricing, insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, STORAGE_PLAN_LIMITS } from "@shared/schema";
import { decrypt, encrypt } from "../encryption";
import { z } from "zod";
import { executeCode, sendStdinToProcess, killInteractiveProcess, resolveRunCommand } from "../executor";
import { getProjectConfig, parseReplitConfig, serializeReplitConfig, getEnvironmentMetadata, type ReplitConfig } from "../configParser";
import { parseReplitNix, serializeReplitNix } from "../nixParser";
import { executionPool } from "../executionPool";
import { getOrCreateTerminal, createTerminalSession, resizeTerminal, listTerminalSessions, destroyTerminalSession, setSessionSelected, updateLastCommand, updateLastActivity, materializeProjectFiles as materializeTerminalFiles, getProjectWorkspaceDir, invalidateProjectWorkspace, syncFileToWorkspace, deleteFileFromWorkspace, renameFileInWorkspace, listWorkspaceFiles, destroyProjectTerminals } from "../terminal";
import { createDebugSession, connectToInspector, handleDebugCommand, getDebugSession, cleanupSession, getInspectPort } from "../debugger";
import { log } from "../index";
import { sendPasswordResetEmail, sendVerificationEmail, sendTeamInviteEmail, isEmailConfigured } from "../email";
import { buildAndDeploy, buildAndDeployMultiArtifact, createDeploymentRouter, rollbackDeployment, listDeploymentVersions, teardownDeployment, performHealthCheck, getProcessLogs, getProcessStatus, stopManagedProcess, restartManagedProcess, shutdownAllProcesses, cleanupProjectProcesses, setProcessLogCallback } from "../deploymentEngine";
import { getProcessInfo } from "../processManager";
import type { DeploymentType } from "../deploymentEngine";
import { incrementRequests, incrementErrors, recordResponseTime, getAndResetCounters, getRealMetrics } from "../metricsCollector";
import { DEFAULT_SHORTCUTS, isValidShortcutValue, findConflict, mergeWithDefaults } from "@shared/keyboardShortcuts";
import { createCheckpoint, restoreCheckpoint, getCheckpointDiff } from "../checkpointService";
import { triggerBackupAsync, createBackup, restoreFromBackup, getBackupStatus, verifyBackupIntegrity } from "../gitBackupService";
import { addDomain, verifyDomain, removeDomain, getProjectDomains, getDomainById, getACMEChallengeResponse } from "../domainManager";
import { checkUserRateLimit, checkIpRateLimit, acquireExecutionSlot, releaseExecutionSlot, recordExecution, getExecutionMetrics, getSystemMetrics, getClientIp } from "../rateLimiter";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, Type, type FunctionDeclaration, type Tool, type Content } from "@google/genai";
import { diffArrays } from "diff";
import multer from "multer";
import * as runnerClient from "../runnerClient";
import * as github from "../github";
import * as gitService from "../git";
import { getConnectorKey, getSupportedConnectors, getConnectorOperations, executeConnectorOperation, getConnectorDescription } from "../connectors";
import path_ from "path";
import { posix as pathPosix } from "path";
import { generateImageBuffer, editImages } from "../replit_integrations/image/client";
import { registerImageRoutes } from "../replit_integrations/image";
import { searchBraveImages, BRAVE_CREDIT_COST, generateSpeech, AVAILABLE_VOICES, TTS_CREDIT_COST, generateNanoBananaImage, NANOBANANA_CREDIT_COST, generateDalleImage, DALLE_CREDIT_COST, searchTavily, TAVILY_CREDIT_COST } from "../agentServices";
import { generateFile, getMimeType, type FileGenerationInput, type FileSection } from "../fileGeneration";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import { importFromGitHub, importFromZip, importFromFigma, importFromVercel, importFromBolt, importFromLovable, validateImportSource, startAsyncImport, startAsyncZipImport, getImportJob, validateZipBuffer, fetchFigmaDesignContext } from "../importService";
import { handleLSPConnection } from "../lspBridge";
import { getTemplateById, getAllTemplates } from "../templates";
import { generateEcodeContent, getEcodeFilename, buildProjectStructureTree, detectDependencies, detectDependenciesFromPackageJson, parseUserPreferences, parseProjectContext, updateEcodeStructureSection, buildEcodePromptContext, shouldAutoUpdate } from "../ecodeTemplates";
import { addCollaborator, removeCollaborator, getCollaborators, updateActiveFile, broadcastToCollaborators, broadcastPresence, getOrCreateFileDoc, initializeFileDoc, getFileDocContent, broadcastBinaryToCollaborators, setFilePersister, type CollabMessage, Y } from "../collaboration";
import bcrypt from "bcrypt";
import crypto from "crypto";


export async function registerSlidesVideoRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== SLIDES & VIDEO ROUTES =====================
  app.get("/api/projects/:projectId/slides", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const data = await storage.getSlidesData(projectId);
      if (!data) return res.json({ projectId, slides: [], theme: null });
      return res.json(data);
    } catch {
      return res.status(500).json({ message: "Failed to fetch slides data" });
    }
  });

  const slideBlockSchema = z.object({
    id: z.string(),
    type: z.enum(["title", "body", "image", "code", "list"]),
    content: z.string(),
    imageUrl: z.string().optional(),
    language: z.string().optional(),
  });
  const slideSchema = z.object({
    id: z.string(),
    order: z.number(),
    layout: z.string().default("default"),
    blocks: z.array(slideBlockSchema),
    notes: z.string().optional(),
  });
  const slideThemeSchema = z.object({
    name: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    fontFamily: z.string().optional(),
    accentColor: z.string().optional(),
  }).optional();
  const slidesUpdateSchema = z.object({
    slides: z.array(slideSchema).optional(),
    theme: slideThemeSchema,
  });

  const videoElementSchema = z.object({
    id: z.string(),
    type: z.enum(["text", "image", "shape", "overlay"]),
    content: z.string().default(""),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    startTime: z.number().default(0),
    endTime: z.number().default(0),
    style: z.record(z.string()).optional(),
    animation: z.enum(["none", "fade-in", "slide-up", "scale", "typewriter"]).optional(),
  });
  const videoSceneSchema = z.object({
    id: z.string(),
    order: z.number(),
    duration: z.number().default(3),
    backgroundColor: z.string().default("#1a1a2e"),
    elements: z.array(videoElementSchema).default([]),
    transition: z.string().optional(),
  });
  const audioTrackSchema = z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().optional(),
    volume: z.number().min(0).max(100).default(80),
    loop: z.boolean().default(false),
  });
  const videoUpdateSchema = z.object({
    scenes: z.array(videoSceneSchema).optional(),
    audioTracks: z.array(audioTrackSchema).optional(),
    resolution: z.object({ width: z.number(), height: z.number() }).optional(),
    fps: z.number().min(1).max(120).optional(),
  });

  app.put("/api/projects/:projectId/slides", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = slidesUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid slides payload", errors: parsed.error.errors });
      const { slides, theme } = parsed.data;
      let data = await storage.getSlidesData(projectId);
      if (!data) {
        data = await storage.createSlidesData({ projectId, slides: slides as any || [], theme: theme as any || undefined });
      } else {
        const updatePayload: any = {};
        if (slides !== undefined) updatePayload.slides = slides;
        if (theme !== undefined) updatePayload.theme = theme;
        data = await storage.updateSlidesData(projectId, updatePayload);
      }
      await storage.updateProject(projectId, { name: project.name });
      return res.json(data);
    } catch {
      return res.status(500).json({ message: "Failed to update slides data" });
    }
  });

  app.delete("/api/projects/:projectId/slides", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      await storage.deleteSlidesData(projectId);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to delete slides data" });
    }
  });

  app.get("/api/projects/:projectId/video", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const data = await storage.getVideoData(projectId);
      if (!data) return res.json({ projectId, scenes: [], audioTracks: [], resolution: { width: 1920, height: 1080 }, fps: 30 });
      return res.json(data);
    } catch {
      return res.status(500).json({ message: "Failed to fetch video data" });
    }
  });

  app.put("/api/projects/:projectId/video", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = videoUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid video payload", errors: parsed.error.errors });
      const { scenes, audioTracks, resolution, fps } = parsed.data;
      let data = await storage.getVideoData(projectId);
      if (!data) {
        data = await storage.createVideoData({ projectId, scenes: scenes as any || [], audioTracks: audioTracks as any || [], resolution: resolution || undefined, fps: fps || undefined });
      } else {
        const updatePayload: any = {};
        if (scenes !== undefined) updatePayload.scenes = scenes;
        if (audioTracks !== undefined) updatePayload.audioTracks = audioTracks;
        if (resolution !== undefined) updatePayload.resolution = resolution;
        if (fps !== undefined) updatePayload.fps = fps;
        data = await storage.updateVideoData(projectId, updatePayload);
      }
      await storage.updateProject(projectId, { name: project.name });
      return res.json(data);
    } catch {
      return res.status(500).json({ message: "Failed to update video data" });
    }
  });

  app.delete("/api/projects/:projectId/video", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      await storage.deleteVideoData(projectId);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to delete video data" });
    }
  });

  app.get("/api/projects/:projectId/slides/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const data = await storage.getSlidesData(projectId);
      if (!data || !data.slides || data.slides.length === 0) return res.status(400).json({ message: "No slides to export" });

      const theme = (data.theme as any) || {};
      const bgColor = theme.backgroundColor || "#1a1a2e";
      const textColor = theme.textColor || "#ffffff";
      const primaryColor = theme.primaryColor || "#0079F2";
      const accentColor = theme.accentColor || "#0CCE6B";

      const hexToRGB = (hex: string): [number, number, number] => {
        const c = hex.replace("#", "");
        return [parseInt(c.substring(0, 2), 16) || 0, parseInt(c.substring(2, 4), 16) || 0, parseInt(c.substring(4, 6), 16) || 0];
      };

      const doc = new PDFDocument({ size: [842, 595], margin: 0, bufferPages: true });

      const sortedSlides = (data.slides as any[]).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      for (let idx = 0; idx < sortedSlides.length; idx++) {
        const slide = sortedSlides[idx];
        if (idx > 0) doc.addPage();

        const [bgR, bgG, bgB] = hexToRGB(slide.backgroundColor || bgColor);
        doc.rect(0, 0, 842, 595).fill([bgR, bgG, bgB]);

        let yPos = 60;

        if (slide.blocks) {
          for (const block of slide.blocks) {
            switch (block.type) {
              case "title":
                doc.font("Helvetica-Bold").fontSize(32).fillColor(primaryColor)
                  .text(block.content || "", 50, yPos, { width: 742, align: "left" });
                yPos += doc.heightOfString(block.content || "", { width: 742 }) + 30;
                break;
              case "body":
                doc.font("Helvetica").fontSize(16).fillColor(textColor)
                  .text(block.content || "", 50, yPos, { width: 742, align: "left" });
                yPos += doc.heightOfString(block.content || "", { width: 742 }) + 20;
                break;
              case "code": {
                const codeText = block.content || "";
                const codeHeight = Math.max(40, doc.font("Courier").fontSize(11).heightOfString(codeText, { width: 702 }) + 20);
                doc.save();
                doc.roundedRect(50, yPos, 742, codeHeight, 6).fill("#2d2d3d");
                doc.restore();
                doc.font("Courier").fontSize(11).fillColor("#e0e0e0")
                  .text(codeText, 60, yPos + 10, { width: 722, align: "left" });
                yPos += codeHeight + 15;
                break;
              }
              case "list": {
                const listItems = (block.content || "").split("\n").filter((item: string) => item.trim());
                for (const item of listItems) {
                  const cleanItem = item.replace(/^[-*•]\s*/, "").trim();
                  if (!cleanItem) continue;
                  doc.font("Helvetica").fontSize(14).fillColor(accentColor).text("●", 60, yPos, { width: 20 });
                  doc.font("Helvetica").fontSize(14).fillColor(textColor).text(cleanItem, 80, yPos, { width: 712, align: "left" });
                  yPos += doc.heightOfString(cleanItem, { width: 712 }) + 10;
                }
                yPos += 10;
                break;
              }
              case "image": {
                const imgUrl = block.imageUrl || block.content || "";
                if (imgUrl) {
                  const urlValidation = validateExternalUrl(imgUrl);
                  if (urlValidation.valid) {
                    try {
                      const imgResp = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
                      const contentType = imgResp.headers.get("content-type") || "";
                      if (imgResp.ok && contentType.startsWith("image/")) {
                        const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                        if (imgBuf.length <= 10 * 1024 * 1024) {
                          doc.image(imgBuf, 50, yPos, { fit: [742, 280], align: "center" });
                          yPos += 300;
                        } else {
                          doc.font("Helvetica-Oblique").fontSize(11).fillColor("#888888")
                            .text(`[Image too large]`, 50, yPos, { width: 742 });
                          yPos += 25;
                        }
                      } else {
                        doc.font("Helvetica-Oblique").fontSize(11).fillColor("#888888")
                          .text(`[Image could not be loaded]`, 50, yPos, { width: 742 });
                        yPos += 25;
                      }
                    } catch {
                      doc.font("Helvetica-Oblique").fontSize(11).fillColor("#888888")
                        .text(`[Image could not be loaded]`, 50, yPos, { width: 742 });
                      yPos += 25;
                    }
                  } else {
                    doc.font("Helvetica-Oblique").fontSize(11).fillColor("#888888")
                      .text(`[Image: invalid or blocked URL]`, 50, yPos, { width: 742 });
                    yPos += 25;
                  }
                }
                break;
              }
            }
          }
        }

        doc.font("Helvetica").fontSize(9).fillColor("#888888")
          .text(`${idx + 1} / ${sortedSlides.length}`, 0, 570, { width: 822, align: "right" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_slides.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (err) {
      log(`PDF export error: ${err}`, "error");
      return res.status(500).json({ message: "Failed to export slides" });
    }
  });

  app.get("/api/projects/:projectId/slides/export/pptx", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const data = await storage.getSlidesData(projectId);
      if (!data || !data.slides || data.slides.length === 0) return res.status(400).json({ message: "No slides to export" });

      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.author = "E-Code IDE";
      pptx.title = project.name;

      const theme: SlideTheme = (data.theme ?? {}) as SlideTheme;
      const bgColor = (theme.backgroundColor || "#1a1a2e").replace("#", "");
      const textColor = (theme.textColor || "#ffffff").replace("#", "");
      const primaryColor = (theme.primaryColor || "#0079F2").replace("#", "");
      const accentColor = (theme.accentColor || "#0CCE6B").replace("#", "");

      const sortedSlides: SlideData[] = [...(data.slides as SlideData[])].sort((a, b) => (a.order || 0) - (b.order || 0));

      for (let idx = 0; idx < sortedSlides.length; idx++) {
        const slideData = sortedSlides[idx];
        const slide = pptx.addSlide();
        slide.background = { color: slideData.backgroundColor ? slideData.backgroundColor.replace("#", "") : bgColor };

        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }

        let yPos = 0.8;

        if (slideData.blocks) {
          for (const block of slideData.blocks) {
            switch (block.type) {
              case "title":
                slide.addText(block.content || "", {
                  x: 0.5, y: yPos, w: 9, h: 0.8,
                  fontSize: 32, fontFace: "Arial", color: primaryColor,
                  bold: true, align: "left", valign: "top",
                });
                yPos += 1.0;
                break;
              case "body":
                slide.addText(block.content || "", {
                  x: 0.5, y: yPos, w: 9, h: 1.0,
                  fontSize: 16, fontFace: "Arial", color: textColor,
                  align: "left", valign: "top",
                });
                yPos += 1.2;
                break;
              case "code": {
                const codeText = block.content || "";
                const lineCount = codeText.split("\n").length;
                const codeHeight = Math.max(0.8, lineCount * 0.28 + 0.4);
                slide.addShape(pptx.ShapeType.roundRect, {
                  x: 0.5, y: yPos, w: 9, h: codeHeight,
                  fill: { color: "2d2d3d" }, rectRadius: 0.1,
                });
                slide.addText(codeText, {
                  x: 0.6, y: yPos + 0.1, w: 8.8, h: codeHeight - 0.2,
                  fontSize: 11, fontFace: "Courier New", color: "e0e0e0",
                  align: "left", valign: "top",
                });
                yPos += codeHeight + 0.3;
                break;
              }
              case "list": {
                const listItems = (block.content || "").split("\n").filter((item: string) => item.trim());
                const listText: PptxGenJS.TextProps[] = listItems.map((item: string) => {
                  const cleanItem = item.replace(/^[-*•]\s*/, "").trim();
                  return { text: cleanItem, options: { fontSize: 14, fontFace: "Arial", color: textColor, bullet: { code: "2022", color: accentColor }, paraSpaceAfter: 6 } };
                });
                if (listText.length > 0) {
                  const listHeight = Math.max(0.6, listText.length * 0.35 + 0.2);
                  slide.addText(listText, {
                    x: 0.5, y: yPos, w: 9, h: listHeight,
                    valign: "top",
                  });
                  yPos += listHeight + 0.3;
                }
                break;
              }
              case "image": {
                const imgUrl = block.imageUrl || block.content || "";
                if (imgUrl) {
                  const urlValidation = validateExternalUrl(imgUrl);
                  if (urlValidation.valid) {
                    try {
                      const imgResp = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
                      const contentType = imgResp.headers.get("content-type") || "";
                      if (imgResp.ok && contentType.startsWith("image/")) {
                        const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                        if (imgBuf.length <= 10 * 1024 * 1024) {
                          const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpeg";
                          slide.addImage({
                            data: `data:image/${ext};base64,${imgBuf.toString("base64")}`,
                            x: 0.5, y: yPos, w: 5, h: 3,
                            sizing: { type: "contain", w: 5, h: 3 },
                          });
                          yPos += 3.3;
                        }
                      }
                    } catch (imgErr) {
                      log(`PPTX export: failed to embed image "${imgUrl.substring(0, 80)}": ${imgErr}`, "warn");
                    }
                  }
                }
                break;
              }
            }
          }
        }

        slide.addText(`${idx + 1} / ${sortedSlides.length}`, {
          x: 8, y: 6.8, w: 1.5, h: 0.3,
          fontSize: 9, fontFace: "Arial", color: "888888",
          align: "right",
        });
      }

      const pptxBuffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_slides.pptx"`);
      res.send(pptxBuffer);
    } catch (err) {
      log(`PPTX export error: ${err}`, "error");
      return res.status(500).json({ message: "Failed to export slides as PPTX" });
    }
  });

  app.post("/api/projects/:projectId/dashboard/csv-export", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const { data, filename, columns } = req.body;
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "Data array is required" });
      }
      if (data.length > 10000) {
        return res.status(400).json({ message: "Data too large (max 10,000 rows)" });
      }

      const sanitizeCsvCell = (val: string): string => {
        if (/^[=+\-@\t\r]/.test(val)) val = "'" + val;
        if (val.includes(",") || val.includes('"') || val.includes("\n"))
          return `"${val.replace(/"/g, '""')}"`;
        return val;
      };

      const headers = columns || (data[0] ? Object.keys(data[0]) : []);
      if (headers.length > 200) {
        return res.status(400).json({ message: "Too many columns (max 200)" });
      }
      let csv = headers.map((h: string) => sanitizeCsvCell(String(h))).join(",") + "\n";
      for (const row of data) {
        const values = headers.map((h: string) => {
          const val = row[h] !== undefined ? String(row[h]) : "";
          return sanitizeCsvCell(val);
        });
        csv += values.join(",") + "\n";
      }

      const safeName = (filename || "dashboard_export").replace(/[^a-zA-Z0-9_-]/g, "_");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.csv"`);
      res.send(csv);
    } catch (err) {
      log(`Dashboard CSV export error: ${err}`, "error");
      return res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  app.post("/api/projects/:projectId/dashboard/pdf-export", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const { title, kpis, charts, summary } = req.body;
      if (title && typeof title !== "string") return res.status(400).json({ message: "Invalid title" });
      if (kpis && (!Array.isArray(kpis) || kpis.length > 50)) return res.status(400).json({ message: "Invalid KPIs (max 50)" });
      if (charts && (!Array.isArray(charts) || charts.length > 20)) return res.status(400).json({ message: "Invalid charts (max 20)" });

      const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });

      doc.fontSize(22).font("Helvetica-Bold").fillColor("#1e293b")
        .text(String(title || "Dashboard Report").slice(0, 200), { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").fillColor("#64748b")
        .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(1.5);

      if (kpis && Array.isArray(kpis) && kpis.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b").text("Key Metrics");
        doc.moveDown(0.5);
        for (const kpi of kpis) {
          doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155")
            .text(`${kpi.label}: `, { continued: true })
            .font("Helvetica").fillColor("#0f172a")
            .text(`${kpi.value}${kpi.change ? ` (${kpi.change})` : ""}`);
        }
        doc.moveDown(1);
      }

      if (charts && Array.isArray(charts) && charts.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b").text("Charts Data");
        doc.moveDown(0.5);
        for (const chart of charts) {
          doc.fontSize(12).font("Helvetica-Bold").fillColor("#334155").text(chart.title || "Chart");
          doc.moveDown(0.3);
          if (chart.data && Array.isArray(chart.data)) {
            const headers = chart.columns || (chart.data[0] ? Object.keys(chart.data[0]) : []);
            if (headers.length > 0 && chart.data.length > 0) {
              const colWidth = Math.min(120, (doc.page.width - 80) / headers.length);
              let y = doc.y;
              doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748b");
              headers.forEach((h: string, i: number) => {
                doc.text(h, 40 + i * colWidth, y, { width: colWidth, align: "left" });
              });
              y += 16;
              doc.font("Helvetica").fillColor("#1e293b").fontSize(9);
              for (const row of chart.data.slice(0, 20)) {
                if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
                headers.forEach((h: string, i: number) => {
                  doc.text(String(row[h] ?? ""), 40 + i * colWidth, y, { width: colWidth, align: "left" });
                });
                y += 14;
              }
              doc.y = y;
            }
          }
          doc.moveDown(1);
        }
      }

      if (summary) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b").text("Analysis Summary");
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica").fillColor("#334155").text(String(summary), { width: doc.page.width - 80 });
      }

      const safeName = (title || "dashboard").replace(/[^a-zA-Z0-9]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_report.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (err) {
      log(`Dashboard PDF export error: ${err}`, "error");
      return res.status(500).json({ message: "Failed to export PDF" });
    }
  });

  const dashboardDataUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.post("/api/projects/:projectId/dashboard/upload-data", requireAuth, dashboardDataUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const ext = file.originalname.split(".").pop()?.toLowerCase();
      const content = file.buffer.toString("utf-8");
      let parsedData: any[] = [];
      let columns: string[] = [];

      if (ext === "csv") {
        const lines = content.split("\n").map(l => l.trim()).filter(l => l);
        if (lines.length > 0) {
          columns = lines[0].split(",").map(c => c.replace(/^"|"$/g, "").trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map(v => v.replace(/^"|"$/g, "").trim());
            const row: Record<string, string | number> = {};
            columns.forEach((col, idx) => {
              const val = values[idx] || "";
              const num = Number(val);
              row[col] = isNaN(num) || val === "" ? val : num;
            });
            parsedData.push(row);
          }
        }
      } else if (ext === "json") {
        try {
          const parsed = JSON.parse(content);
          parsedData = Array.isArray(parsed) ? parsed : parsed.data || [parsed];
          if (parsedData.length > 0) {
            columns = Object.keys(parsedData[0]);
          }
        } catch {
          return res.status(400).json({ message: "Invalid JSON format" });
        }
      } else {
        return res.status(400).json({ message: "Unsupported file format. Use CSV or JSON." });
      }

      res.json({
        filename: file.originalname,
        rows: parsedData.length,
        columns,
        data: parsedData.slice(0, 1000),
        truncated: parsedData.length > 1000,
      });
    } catch (err) {
      log(`Dashboard data upload error: ${err}`, "error");
      return res.status(500).json({ message: "Failed to parse uploaded data" });
    }
  });

  app.post("/api/projects/:projectId/dashboard/fetch-data", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const { url } = req.body;
      if (!url || typeof url !== "string") return res.status(400).json({ message: "URL is required" });

      const urlValidation = validateExternalUrl(url);
      if (!urlValidation.valid) return res.status(400).json({ message: urlValidation.error });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { "Accept": "application/json, text/csv, text/plain" },
      });

      if (!response.ok) return res.status(400).json({ message: `Failed to fetch: HTTP ${response.status}` });

      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      let parsedData: any[] = [];
      let columns: string[] = [];

      if (contentType.includes("json") || body.trim().startsWith("[") || body.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(body);
          parsedData = Array.isArray(parsed) ? parsed : parsed.data || parsed.results || [parsed];
          if (parsedData.length > 0) columns = Object.keys(parsedData[0]);
        } catch {
          return res.status(400).json({ message: "Response is not valid JSON" });
        }
      } else {
        const lines = body.split("\n").map(l => l.trim()).filter(l => l);
        if (lines.length > 0) {
          columns = lines[0].split(",").map(c => c.replace(/^"|"$/g, "").trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map(v => v.replace(/^"|"$/g, "").trim());
            const row: Record<string, string | number> = {};
            columns.forEach((col, idx) => {
              const val = values[idx] || "";
              const num = Number(val);
              row[col] = isNaN(num) || val === "" ? val : num;
            });
            parsedData.push(row);
          }
        }
      }

      res.json({
        source: url,
        rows: parsedData.length,
        columns,
        data: parsedData.slice(0, 1000),
        truncated: parsedData.length > 1000,
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return res.status(408).json({ message: "Request timed out" });
      }
      log(`Dashboard fetch-data error: ${err}`, "error");
      return res.status(500).json({ message: "Failed to fetch external data" });
    }
  });

  app.get("/api/projects/:projectId/video/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const data = await storage.getVideoData(projectId);
      if (!data || !data.scenes || (data.scenes as any[]).length === 0) return res.status(400).json({ message: "No scenes to export" });

      const scenes = (data.scenes as any[]).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      const resolution = (data.resolution as any) || { width: 1920, height: 1080 };
      const fps = Math.max(1, Math.min(120, parseInt(String(data.fps)) || 30));
      const totalDuration = scenes.reduce((sum: number, s: any) => sum + (s.duration || 3), 0);

      const { execSync } = await import("child_process");
      const tmpDir = `/tmp/video_export_${projectId}_${Date.now()}`;
      fs.mkdirSync(tmpDir, { recursive: true });

      let createCanvas: any = null;
      try {
        // @ts-ignore
        const canvasModule = await import("canvas");
        createCanvas = canvasModule.createCanvas;
      } catch {}

      let frameIndex = 0;
      for (const scene of scenes) {
        const totalFrames = Math.max(1, Math.round((scene.duration || 3) * fps));

        if (createCanvas) {
          const canvas = createCanvas(resolution.width, resolution.height);
          const ctx = canvas.getContext("2d");
          const bgHex = (scene.backgroundColor || "#1a1a2e").replace("#", "");
          ctx.fillStyle = `#${bgHex}`;
          ctx.fillRect(0, 0, resolution.width, resolution.height);
          if (scene.elements) {
            for (const el of scene.elements) {
              const x = (el.x || 0) / 100 * resolution.width;
              const y = (el.y || 0) / 100 * resolution.height;
              if (el.type === "text" && el.content) {
                const fontSize = parseInt(el.style?.fontSize || "24", 10);
                ctx.font = `${el.style?.fontWeight === "bold" ? "bold " : ""}${fontSize}px sans-serif`;
                ctx.fillStyle = el.style?.color || "#ffffff";
                ctx.fillText(el.content, x, y + fontSize);
              } else if (el.type === "shape") {
                ctx.fillStyle = el.style?.backgroundColor || el.style?.fill || "#0079F2";
                const w = (el.width || 10) / 100 * resolution.width;
                const h = (el.height || 10) / 100 * resolution.height;
                ctx.fillRect(x, y, w, h);
              }
            }
          }
          const pngBuffer = canvas.toBuffer("image/png");
          for (let f = 0; f < totalFrames; f++) {
            const framePath = `${tmpDir}/frame_${String(frameIndex).padStart(6, "0")}.png`;
            fs.writeFileSync(framePath, pngBuffer);
            frameIndex++;
          }
        } else {
          const ppmHeader = `P6\n${resolution.width} ${resolution.height}\n255\n`;
          const bgHex = (scene.backgroundColor || "#1a1a2e").replace("#", "");
          const r = parseInt(bgHex.substring(0, 2), 16) || 26;
          const g = parseInt(bgHex.substring(2, 4), 16) || 26;
          const b = parseInt(bgHex.substring(4, 6), 16) || 46;
          const pixels = Buffer.alloc(resolution.width * resolution.height * 3);
          for (let i = 0; i < resolution.width * resolution.height; i++) {
            pixels[i * 3] = r;
            pixels[i * 3 + 1] = g;
            pixels[i * 3 + 2] = b;
          }
          const ppmData = Buffer.concat([Buffer.from(ppmHeader), pixels]);
          for (let f = 0; f < totalFrames; f++) {
            const framePath = `${tmpDir}/frame_${String(frameIndex).padStart(6, "0")}.ppm`;
            fs.writeFileSync(framePath, ppmData);
            frameIndex++;
          }
        }
      }

      const outputPath = `${tmpDir}/output.mp4`;
      const ext = createCanvas ? "png" : "ppm";
      try {
        execSync(`ffmpeg -y -framerate ${fps} -i ${tmpDir}/frame_%06d.${ext} -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 ${outputPath}`, { timeout: 60000, stdio: "pipe" });
      } catch (ffmpegErr: unknown) {
        const errMsg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(500).json({ message: "FFmpeg render failed: " + errMsg.substring(0, 200) });
      }

      if (!fs.existsSync(outputPath)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(500).json({ message: "Video render produced no output" });
      }

      const stat = fs.statSync(outputPath);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_video.mp4"`);
      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);
      readStream.on("end", () => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
      readStream.on("error", () => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
    } catch {
      return res.status(500).json({ message: "Failed to export video" });
    }
  });

  app.post("/api/projects/:projectId/animations/export/mp4", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const exportSchema = z.object({
        artifactId: z.string().optional(),
        width: z.number().min(320).max(3840).default(1920),
        height: z.number().min(240).max(2160).default(1080),
        fps: z.number().min(1).max(60).default(30),
        duration: z.number().min(1).max(120).default(10),
        quality: z.enum(["standard", "high"]).default("standard"),
      });
      const parsed = exportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid export options", errors: parsed.error.errors });

      const { width, height, fps, duration, quality, artifactId } = parsed.data;

      const files = await storage.getFiles(projectId);
      const htmlFile = files.find(f => f.filename === "index.html");

      let scenes: any[] = [];
      const videoData = await storage.getVideoData(projectId);
      if (videoData && videoData.scenes && (videoData.scenes as any[]).length > 0) {
        scenes = (videoData.scenes as any[]).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      }

      const { exportAnimationToMp4, cleanupExportDir } = await import("./videoExporter");
      const result = await exportAnimationToMp4(
        scenes,
        { width, height, fps, duration, quality },
        htmlFile?.content || undefined,
      );

      if (!result.success || !result.outputPath) {
        return res.status(500).json({ message: result.error || "Export failed" });
      }

      const stat = fs.statSync(result.outputPath);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_animation.mp4"`);
      const readStream = fs.createReadStream(result.outputPath);
      readStream.pipe(res);
      readStream.on("end", () => cleanupExportDir(result.outputPath!));
      readStream.on("error", () => cleanupExportDir(result.outputPath!));
    } catch {
      return res.status(500).json({ message: "Failed to export animation" });
    }
  });

  app.post("/api/projects/:projectId/artifacts/:artifactId/export/mp4", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const artifactId = req.params.artifactId as string;
      const project = await storage.getProject(projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const artifact = await storage.getArtifact(artifactId);
      if (!artifact || artifact.projectId !== projectId) return res.status(404).json({ message: "Artifact not found" });

      const exportSchema = z.object({
        width: z.number().min(320).max(3840).default(1920),
        height: z.number().min(240).max(2160).default(1080),
        fps: z.number().min(1).max(60).default(30),
        duration: z.number().min(1).max(120).default(10),
        quality: z.enum(["standard", "high"]).default("standard"),
      });
      const parsed = exportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid export options", errors: parsed.error.errors });

      const { width, height, fps, duration, quality } = parsed.data;

      const files = await storage.getFiles(projectId);
      const entryFile = artifact.entryFile || "index.html";
      const htmlFile = files.find(f => f.filename === entryFile);

      let scenes: any[] = [];
      const videoData = await storage.getVideoData(projectId);
      if (videoData && videoData.scenes && (videoData.scenes as any[]).length > 0) {
        scenes = (videoData.scenes as any[]).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      }

      const { exportAnimationToMp4, cleanupExportDir } = await import("./videoExporter");
      const result = await exportAnimationToMp4(
        scenes,
        { width, height, fps, duration, quality },
        htmlFile?.content || undefined,
      );

      if (!result.success || !result.outputPath) {
        return res.status(500).json({ message: result.error || "Export failed" });
      }

      const stat = fs.statSync(result.outputPath);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${artifact.name.replace(/[^a-zA-Z0-9]/g, '_')}.mp4"`);
      const readStream = fs.createReadStream(result.outputPath);
      readStream.pipe(res);
      readStream.on("end", () => cleanupExportDir(result.outputPath!));
      readStream.on("error", () => cleanupExportDir(result.outputPath!));
    } catch {
      return res.status(500).json({ message: "Failed to export animation" });
    }
  });

  app.get("/api/ssh-keys", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const keys = await storage.listSshKeysByUser(userId);
      return res.json(keys.map(k => ({ id: k.id, label: k.label, fingerprint: k.fingerprint, createdAt: k.createdAt })));
    } catch {
      return res.status(500).json({ message: "Failed to fetch SSH keys" });
    }
  });

  app.post("/api/ssh-keys", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const schema = z.object({
        label: z.string().min(1).max(100),
        publicKey: z.string().min(1).max(10000),
      });
      const data = schema.parse(req.body);

      const keyStr = data.publicKey.trim();
      const sshKeyRegex = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/=]+/;
      if (!sshKeyRegex.test(keyStr)) {
        return res.status(400).json({ message: "Invalid SSH public key format. Must be a valid ssh-rsa, ssh-ed25519, or ecdsa key." });
      }

      const parts = keyStr.split(/\s+/);
      const keyData = Buffer.from(parts[1], "base64");
      const fingerprint = crypto.createHash("sha256").update(keyData).digest("base64");
      const fingerprintFormatted = `SHA256:${fingerprint.replace(/=+$/, "")}`;

      const existing = await storage.findSshKeyByFingerprint(fingerprintFormatted);
      if (existing && existing.userId === userId) {
        return res.status(409).json({ message: "This SSH key is already added to your account." });
      }

      const key = await storage.createSshKey(userId, data.label, keyStr, fingerprintFormatted);
      return res.status(201).json({ id: key.id, label: key.label, fingerprint: key.fingerprint, createdAt: key.createdAt });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (error?.code === "23505") {
        return res.status(409).json({ message: "This SSH key is already added to your account." });
      }
      return res.status(500).json({ message: "Failed to add SSH key" });
    }
  });

  app.delete("/api/ssh-keys/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const deleted = await storage.deleteSshKey(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "SSH key not found" });
      }
      return res.json({ message: "SSH key deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete SSH key" });
    }
  });

}
