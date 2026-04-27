// AUTO-EXTRACTED from server/routes.ts (lines 15884-16490)
// Original section: canvas
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


export async function registerCanvasRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== CANVAS ROUTES =====================
  const canvasFrameCreateSchema = z.object({
    name: z.string().max(200).optional().default("Untitled Frame"),
    htmlContent: z.string().optional().default(""),
    x: z.number().int().optional().default(0),
    y: z.number().int().optional().default(0),
    width: z.number().int().min(50).max(4000).optional().default(400),
    height: z.number().int().min(50).max(4000).optional().default(300),
    zIndex: z.number().int().optional().default(0),
  });

  const canvasFrameUpdateSchema = z.object({
    name: z.string().max(200).optional(),
    htmlContent: z.string().optional(),
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    width: z.number().int().min(50).max(4000).optional(),
    height: z.number().int().min(50).max(4000).optional(),
    zIndex: z.number().int().optional(),
  });

  const canvasAnnotationCreateSchema = z.object({
    type: z.enum(["sticky", "text", "image"]).optional().default("sticky"),
    content: z.string().optional().default(""),
    x: z.number().int().optional().default(0),
    y: z.number().int().optional().default(0),
    width: z.number().int().min(20).max(2000).optional().default(200),
    height: z.number().int().min(20).max(2000).optional().default(150),
    color: z.string().max(20).optional().default("#FBBF24"),
    zIndex: z.number().int().optional().default(0),
  });

  const canvasAnnotationUpdateSchema = z.object({
    type: z.enum(["sticky", "text", "image"]).optional(),
    content: z.string().optional(),
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    width: z.number().int().min(20).max(2000).optional(),
    height: z.number().int().min(20).max(2000).optional(),
    color: z.string().max(20).optional(),
    zIndex: z.number().int().optional(),
  });

  app.get("/api/projects/:projectId/canvas/frames", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const frames = await storage.getCanvasFrames(req.params.projectId);
      return res.json(frames);
    } catch {
      return res.status(500).json({ message: "Failed to fetch canvas frames" });
    }
  });

  app.post("/api/projects/:projectId/canvas/frames", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = canvasFrameCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid frame data", errors: parsed.error.errors });
      const frame = await storage.createCanvasFrame({ projectId: req.params.projectId, ...parsed.data });
      broadcastToProject(req.params.projectId, { type: "canvas_frame_created", frame });
      return res.status(201).json(frame);
    } catch {
      return res.status(500).json({ message: "Failed to create canvas frame" });
    }
  });

  app.put("/api/projects/:projectId/canvas/frames/:frameId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = canvasFrameUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid update data", errors: parsed.error.errors });
      const frame = await storage.updateCanvasFrame(req.params.frameId, req.params.projectId, parsed.data);
      if (!frame) return res.status(404).json({ message: "Frame not found" });
      broadcastToProject(req.params.projectId, { type: "canvas_frame_updated", frame });
      return res.json(frame);
    } catch {
      return res.status(500).json({ message: "Failed to update canvas frame" });
    }
  });

  app.delete("/api/projects/:projectId/canvas/frames/:frameId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const deleted = await storage.deleteCanvasFrame(req.params.frameId, req.params.projectId);
      if (!deleted) return res.status(404).json({ message: "Frame not found" });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to delete canvas frame" });
    }
  });

  const visualEditSchema = z.object({
    type: z.enum(["text", "style", "class", "image"]),
    property: z.string().optional(),
    oldValue: z.string(),
    newValue: z.string(),
    element: z.object({
      tag: z.string(),
      text: z.string(),
      className: z.string(),
      id: z.string(),
      imgSrc: z.string(),
      isImg: z.boolean(),
      dataTestId: z.string(),
      xpath: z.string(),
      styles: z.record(z.string()).optional(),
      rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
    }),
    frameId: z.string().optional(),
  });

  const TAILWIND_MAP: Record<string, (v: string) => string | null> = {
    color: (v) => { const hex = v.replace("#", "").toLowerCase(); return `text-[#${hex}]`; },
    backgroundColor: (v) => { const hex = v.replace("#", "").toLowerCase(); return `bg-[#${hex}]`; },
    fontSize: (v) => { const px = parseInt(v); if (isNaN(px)) return null; return `text-[${px}px]`; },
    borderRadius: (v) => { const px = parseInt(v); if (isNaN(px)) return null; if (px === 0) return "rounded-none"; return `rounded-[${px}px]`; },
    paddingTop: (v) => `pt-[${parseInt(v) || 0}px]`,
    paddingRight: (v) => `pr-[${parseInt(v) || 0}px]`,
    paddingBottom: (v) => `pb-[${parseInt(v) || 0}px]`,
    paddingLeft: (v) => `pl-[${parseInt(v) || 0}px]`,
    marginTop: (v) => `mt-[${parseInt(v) || 0}px]`,
    marginRight: (v) => `mr-[${parseInt(v) || 0}px]`,
    marginBottom: (v) => `mb-[${parseInt(v) || 0}px]`,
    marginLeft: (v) => `ml-[${parseInt(v) || 0}px]`,
  };

  function findTailwindClassForProperty(prop: string): RegExp | null {
    const patterns: Record<string, RegExp> = {
      color: /text-\[#[0-9a-fA-F]+\]|text-(black|white|transparent|current|inherit|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/,
      backgroundColor: /bg-\[#[0-9a-fA-F]+\]|bg-(black|white|transparent|current|inherit|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/,
      fontSize: /text-\[\d+px\]|text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/,
      borderRadius: /rounded-\[\d+px\]|rounded(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?/,
      paddingTop: /pt-\[\d+px\]|pt-\d+/,
      paddingRight: /pr-\[\d+px\]|pr-\d+/,
      paddingBottom: /pb-\[\d+px\]|pb-\d+/,
      paddingLeft: /pl-\[\d+px\]|pl-\d+/,
      marginTop: /mt-\[\d+px\]|mt-\d+/,
      marginRight: /mr-\[\d+px\]|mr-\d+/,
      marginBottom: /mb-\[\d+px\]|mb-\d+/,
      marginLeft: /ml-\[\d+px\]|ml-\d+/,
    };
    return patterns[prop] || null;
  }

  app.post("/api/projects/:projectId/visual-edit", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const isOwner = String(project.userId) === String(req.session.userId);
      const isCollab = !isOwner && await storage.isProjectCollaborator(req.params.projectId, req.session.userId!);
      const isGuest = !isOwner && !isCollab && await storage.isProjectGuest(req.params.projectId, req.session.userId!);
      if (!isOwner && !isCollab && !isGuest) return res.status(403).json({ message: "Access denied" });

      const parsed = visualEditSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid edit data", errors: parsed.error.errors });
      const edit = parsed.data;

      if (edit.frameId) {
        const frame = await storage.getCanvasFrame(edit.frameId);
        if (!frame || frame.projectId !== req.params.projectId) return res.status(404).json({ message: "Frame not found" });
        let html = frame.htmlContent || "";
        if (edit.type === "text" && edit.oldValue && edit.newValue) {
          html = html.replace(edit.oldValue, edit.newValue);
        }
        await storage.updateCanvasFrame(edit.frameId, req.params.projectId, { htmlContent: html });
        broadcastToProject(req.params.projectId, { type: "canvas_frame_updated", frame: { ...frame, htmlContent: html } });
        return res.json({ success: true, target: "frame", frameId: edit.frameId, content: html });
      }

      const projectFiles = await storage.getFiles(req.params.projectId);
      const editableExts = [".tsx", ".jsx", ".ts", ".js", ".html", ".css", ".vue", ".svelte"];
      const editableFiles = projectFiles.filter(f => editableExts.some(ext => f.filename.endsWith(ext)));

      let matchedFile: typeof projectFiles[0] | null = null;
      let updatedContent = "";

      if (edit.type === "text" && edit.oldValue && edit.newValue !== edit.oldValue) {
        for (const file of editableFiles) {
          if (file.content.includes(edit.oldValue)) {
            matchedFile = file;
            updatedContent = file.content.replace(edit.oldValue, edit.newValue);
            break;
          }
        }
      } else if (edit.type === "style" && edit.property) {
        const prop = edit.property;
        const newVal = edit.newValue;
        const elemClass = edit.element.className;

        for (const file of editableFiles) {
          if (!elemClass || typeof elemClass !== "string") continue;
          const classSegments = elemClass.split(/\s+/).filter(Boolean);
          if (classSegments.length === 0) continue;

          const classPattern = findTailwindClassForProperty(prop);
          if (classPattern) {
            const oldMatch = classSegments.find(c => classPattern.test(c));
            const twMapper = TAILWIND_MAP[prop];
            if (twMapper) {
              const newClass = twMapper(newVal);
              if (newClass) {
                const searchClasses = classSegments.join(" ");
                if (file.content.includes(searchClasses) || classSegments.some(c => file.content.includes(c))) {
                  matchedFile = file;
                  if (oldMatch && file.content.includes(oldMatch)) {
                    updatedContent = file.content.replace(oldMatch, newClass);
                  } else {
                    const classStr = classSegments.join(" ");
                    if (file.content.includes(classStr)) {
                      updatedContent = file.content.replace(classStr, classStr + " " + newClass);
                    } else {
                      updatedContent = file.content;
                    }
                  }
                  if (updatedContent !== file.content) break;
                  matchedFile = null;
                }
              }
            }
          }

          if (!matchedFile) {
            const cssPropName = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
            const styleAttrRegex = new RegExp(`style\\s*=\\s*["'][^"']*${cssPropName}\\s*:\\s*[^;'"]*`, "i");
            if (styleAttrRegex.test(file.content)) {
              matchedFile = file;
              const inlineStyleRegex = new RegExp(`(${cssPropName}\\s*:\\s*)([^;'"]+)`, "i");
              updatedContent = file.content.replace(inlineStyleRegex, `$1${newVal}`);
              break;
            }
          }
        }

        if (!matchedFile) {
          for (const file of editableFiles) {
            if (file.filename.endsWith(".css")) {
              const cssPropName = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
              const cssRegex = new RegExp(`(${cssPropName}\\s*:\\s*)([^;]+)`, "g");
              if (cssRegex.test(file.content)) {
                matchedFile = file;
                updatedContent = file.content.replace(new RegExp(`(${cssPropName}\\s*:\\s*)([^;]+)`, "g"), `$1${newVal}`);
                break;
              }
            }
          }
        }
      } else if (edit.type === "image" && edit.oldValue && edit.newValue) {
        for (const file of editableFiles) {
          if (file.content.includes(edit.oldValue)) {
            matchedFile = file;
            updatedContent = file.content.replace(edit.oldValue, edit.newValue);
            break;
          }
        }
      }

      if (matchedFile && updatedContent && updatedContent !== matchedFile.content) {
        await storage.updateFileContent(matchedFile.id, updatedContent);
        broadcastToProject(req.params.projectId, {
          type: "file_updated",
          file: { id: matchedFile.id, filename: matchedFile.filename, content: updatedContent },
        });
        return res.json({
          success: true,
          target: "file",
          fileId: matchedFile.id,
          filename: matchedFile.filename,
          content: updatedContent,
        });
      }

      return res.json({
        success: false,
        message: "Could not find matching source location. Use the AI Agent for complex edits.",
        needsAI: true,
      });
    } catch (err: any) {
      console.error("Visual edit error:", err);
      return res.status(500).json({ message: "Failed to apply visual edit" });
    }
  });

  app.post("/api/projects/:projectId/visual-edit/find-source", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const isOwner = String(project.userId) === String(req.session.userId);
      const isCollab = !isOwner && await storage.isProjectCollaborator(req.params.projectId, req.session.userId!);
      const isGuest = !isOwner && !isCollab && await storage.isProjectGuest(req.params.projectId, req.session.userId!);
      if (!isOwner && !isCollab && !isGuest) return res.status(403).json({ message: "Access denied" });

      const { text, className, tag, dataTestId } = req.body;
      const projectFiles = await storage.getFiles(req.params.projectId);
      const editableExts = [".tsx", ".jsx", ".ts", ".js", ".html", ".css", ".vue", ".svelte"];
      const editableFiles = projectFiles.filter(f => editableExts.some(ext => f.filename.endsWith(ext)));

      if (dataTestId) {
        for (const file of editableFiles) {
          const idx = file.content.indexOf(dataTestId);
          if (idx !== -1) {
            const line = file.content.substring(0, idx).split("\n").length;
            return res.json({ fileId: file.id, filename: file.filename, line });
          }
        }
      }

      if (text && text.length > 2) {
        for (const file of editableFiles) {
          const idx = file.content.indexOf(text);
          if (idx !== -1) {
            const line = file.content.substring(0, idx).split("\n").length;
            return res.json({ fileId: file.id, filename: file.filename, line });
          }
        }
      }

      if (className && typeof className === "string") {
        const classes = className.split(/\s+/).filter(Boolean);
        const searchStr = classes.slice(0, 5).join(" ");
        if (searchStr.length > 5) {
          for (const file of editableFiles) {
            const idx = file.content.indexOf(searchStr);
            if (idx !== -1) {
              const line = file.content.substring(0, idx).split("\n").length;
              return res.json({ fileId: file.id, filename: file.filename, line });
            }
          }
        }
      }

      return res.json({ fileId: null, filename: null, line: null, message: "Could not locate source" });
    } catch {
      return res.status(500).json({ message: "Failed to find source" });
    }
  });

  app.get("/api/projects/:projectId/canvas/annotations", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const annotations = await storage.getCanvasAnnotations(req.params.projectId);
      return res.json(annotations);
    } catch {
      return res.status(500).json({ message: "Failed to fetch canvas annotations" });
    }
  });

  app.post("/api/projects/:projectId/canvas/annotations", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = canvasAnnotationCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid annotation data", errors: parsed.error.errors });
      const annotation = await storage.createCanvasAnnotation({ projectId: req.params.projectId, ...parsed.data });
      broadcastToProject(req.params.projectId, { type: "canvas_annotation_created", annotation });
      return res.status(201).json(annotation);
    } catch {
      return res.status(500).json({ message: "Failed to create canvas annotation" });
    }
  });

  app.put("/api/projects/:projectId/canvas/annotations/:annotationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = canvasAnnotationUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid update data", errors: parsed.error.errors });
      const annotation = await storage.updateCanvasAnnotation(req.params.annotationId, req.params.projectId, parsed.data);
      if (!annotation) return res.status(404).json({ message: "Annotation not found" });
      broadcastToProject(req.params.projectId, { type: "canvas_annotation_updated", annotation });
      return res.json(annotation);
    } catch {
      return res.status(500).json({ message: "Failed to update canvas annotation" });
    }
  });

  app.delete("/api/projects/:projectId/canvas/annotations/:annotationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const deleted = await storage.deleteCanvasAnnotation(req.params.annotationId, req.params.projectId);
      if (!deleted) return res.status(404).json({ message: "Annotation not found" });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to delete canvas annotation" });
    }
  });

  app.get("/api/projects/:projectId/conversions", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const conversionsList = await storage.getConversions(req.params.projectId);
      return res.json(conversionsList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch conversions" });
    }
  });

  app.get("/api/projects/:projectId/conversions/:conversionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const conversion = await storage.getConversion(req.params.conversionId);
      if (!conversion || conversion.projectId !== req.params.projectId) return res.status(404).json({ message: "Conversion not found" });
      return res.json(conversion);
    } catch {
      return res.status(500).json({ message: "Failed to fetch conversion" });
    }
  });

  const conversionCreateSchema = z.object({
    frameId: z.string().min(1),
    targetArtifactType: z.string().min(1),
  });

  app.post("/api/projects/:projectId/conversions", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const parsed = conversionCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid conversion data", errors: parsed.error.errors });

      const frame = await storage.getCanvasFrame(parsed.data.frameId);
      if (!frame || frame.projectId !== req.params.projectId) return res.status(404).json({ message: "Frame not found" });

      const conversion = await storage.createConversion({
        projectId: req.params.projectId,
        frameId: parsed.data.frameId,
        targetArtifactType: parsed.data.targetArtifactType,
        status: "analyzing",
      });

      (async () => {
        try {
          const htmlContent = frame.htmlContent || "";

          const colorMatches = htmlContent.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)/g) || [];
          const fontMatches = htmlContent.match(/font-family:\s*([^;}"]+)/g) || [];
          const fonts = fontMatches.map(f => f.replace("font-family:", "").trim().replace(/['"]/g, ""));

          const sectionMatches: string[] = [];
          const sectionPatterns = [/header/i, /nav/i, /hero/i, /main/i, /section/i, /footer/i, /aside/i, /article/i];
          for (const pat of sectionPatterns) {
            if (pat.test(htmlContent)) sectionMatches.push(pat.source.replace(/\/i$/, ""));
          }

          const designTokens: Record<string, unknown> = {
            colors: [...new Set(colorMatches)].slice(0, 20),
            fonts: [...new Set(fonts)].slice(0, 10),
            sections: sectionMatches,
            frameName: frame.name,
            frameWidth: frame.width,
            frameHeight: frame.height,
          };

          await storage.updateConversion(conversion.id, { status: "generating", designTokens });

          const artifact = await storage.createArtifact({
            projectId: req.params.projectId,
            type: parsed.data.targetArtifactType,
            name: `${frame.name} — ${parsed.data.targetArtifactType}`,
            settings: { convertedFromFrame: frame.id, designTokens },
          });

          const entryFilename = parsed.data.targetArtifactType === "web-app" ? "index.html" : "App.tsx";
          const generatedContent = generateConvertedContent(htmlContent, parsed.data.targetArtifactType, designTokens);

          await storage.createFile(req.params.projectId, {
            filename: entryFilename,
            content: generatedContent,
            artifactId: artifact.id,
          });

          await storage.updateArtifact(artifact.id, { entryFile: entryFilename });
          await storage.updateConversion(conversion.id, { status: "complete", artifactId: artifact.id });
          broadcastToProject(req.params.projectId, { type: "conversion_complete", conversionId: conversion.id, artifactId: artifact.id });
        } catch (err: any) {
          await storage.updateConversion(conversion.id, { status: "failed", error: err.message || "Conversion failed" });
          broadcastToProject(req.params.projectId, { type: "conversion_failed", conversionId: conversion.id, error: err.message });
        }
      })();

      return res.status(201).json(conversion);
    } catch {
      return res.status(500).json({ message: "Failed to start conversion" });
    }
  });

  function generateConvertedContent(htmlContent: string, targetType: string, designTokens: Record<string, unknown>): string {
    const colors = (designTokens.colors as string[]) || [];
    const fonts = (designTokens.fonts as string[]) || [];
    const primaryColor = colors[0] || "#0079F2";
    const bgColor = colors.find(c => c.startsWith("#1") || c.startsWith("#2") || c.startsWith("#0")) || "#1a1a2e";
    const fontFamily = fonts[0] || "system-ui, sans-serif";

    if (targetType === "web-app") {
      return htmlContent || `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${designTokens.frameName || "Converted App"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${fontFamily}; background: ${bgColor}; color: #fff; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    a { color: ${primaryColor}; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${designTokens.frameName || "My App"}</h1>
    <p>Converted from canvas frame design.</p>
  </div>
</body>
</html>`;
    }

    return `import React from "react";

export default function App() {
  return (
    <div style={{ fontFamily: "${fontFamily}", background: "${bgColor}", color: "#fff", minHeight: "100vh", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1>${designTokens.frameName || "My App"}</h1>
        <p>Converted from canvas frame design.</p>
      </div>
    </div>
  );
}`;
  }

  app.post("/api/projects/:projectId/device-preset", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const { preset, customWidth, customHeight } = req.body;
      if (!preset || typeof preset !== "string") return res.status(400).json({ message: "Invalid preset" });
      const settings = { ...(project.description ? {} : {}), devicePreset: preset, customWidth, customHeight };
      const storageKey = `device-preset:${req.params.projectId}`;
      await storage.setStorageKvEntry(req.params.projectId, storageKey, JSON.stringify(settings));
      return res.json({ success: true, preset, customWidth, customHeight });
    } catch {
      return res.status(500).json({ message: "Failed to save device preset" });
    }
  });

  app.get("/api/projects/:projectId/device-preset", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const storageKey = `device-preset:${req.params.projectId}`;
      const entry = await storage.getStorageKvEntry(req.params.projectId, storageKey);
      if (!entry) return res.json({ preset: "responsive", customWidth: null, customHeight: null });
      try {
        const parsed = JSON.parse(entry.value);
        return res.json({ preset: parsed.devicePreset || "responsive", customWidth: parsed.customWidth || null, customHeight: parsed.customHeight || null });
      } catch {
        return res.json({ preset: "responsive", customWidth: null, customHeight: null });
      }
    } catch {
      return res.status(500).json({ message: "Failed to fetch device preset" });
    }
  });

  try {
    const { pool: dbPool } = await import("./db");
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS storage_bandwidth (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar(36) NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        bytes_downloaded bigint NOT NULL DEFAULT 0,
        download_count integer NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS storage_bandwidth_project_idx ON storage_bandwidth (project_id);
      CREATE INDEX IF NOT EXISTS storage_bandwidth_period_idx ON storage_bandwidth (project_id, period_start);
    `);
    log("storage_bandwidth table ensured", "seed");

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS conversions (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar(36) NOT NULL,
        frame_id varchar(36) NOT NULL,
        target_artifact_type text NOT NULL,
        artifact_id varchar(36),
        status text NOT NULL DEFAULT 'pending',
        design_tokens json,
        error text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS conversions_project_idx ON conversions (project_id);
      CREATE INDEX IF NOT EXISTS conversions_frame_idx ON conversions (frame_id);
    `);
    log("conversions table ensured", "seed");
  } catch (e: any) {
    log(`storage_bandwidth/conversions migration: ${e.message}`, "seed");
  }

}
