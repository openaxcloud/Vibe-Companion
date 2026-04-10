// AUTO-EXTRACTED from server/routes.ts (lines 13254-13554)
// Original section: reverse-proxy
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


export async function registerReverseProxyRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- REVERSE PROXY FOR PORT FORWARDING ---
  app.all("/proxy/:projectId/:port/{*path}", requireAuth, async (req: Request, res: Response) => {
    try {
      const { projectId, port: portStr } = req.params;
      const requestedExternalPort = parseInt(portStr, 10);
      if (isNaN(requestedExternalPort)) {
        return res.status(400).json({ message: "Invalid port" });
      }

      if (!await verifyProjectAccess(projectId, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const portConfigs = await storage.getPortConfigs(projectId);
      const config = portConfigs.find(p => p.externalPort === requestedExternalPort);
      if (!config || !config.isPublic) {
        return res.status(403).json({ message: "Port not configured or not public" });
      }

      const { checkPortListening, isPortBlocked, isAllowedInternalPort } = await import("./portDetection");
      if (isPortBlocked(config.internalPort) || !isAllowedInternalPort(config.internalPort)) {
        return res.status(403).json({ message: "Target port is not allowed for proxying" });
      }
      const { listening, localhostOnly } = await checkPortListening(config.internalPort);
      if (!listening) {
        return res.status(502).json({ message: "No process listening on the internal port" });
      }
      if (localhostOnly && !config.exposeLocalhost) {
        return res.status(403).json({ message: "Port is bound to localhost only. Enable 'Expose Localhost' to proxy this port." });
      }

      const rawPath = req.params.path;
      const proxyPath = Array.isArray(rawPath) ? rawPath.join("/") : (rawPath || "");
      const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const targetUrl = `http://127.0.0.1:${config.internalPort}/${proxyPath}${queryString}`;

      const http = require("http") as typeof import("http");

      const HOP_BY_HOP_HEADERS = new Set([
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailer", "transfer-encoding", "upgrade",
        "cookie", "authorization", "host",
      ]);
      const forwardHeaders: Record<string, any> = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
          forwardHeaders[key] = val;
        }
      }
      forwardHeaders["x-forwarded-for"] = req.ip || "unknown";
      forwardHeaders["x-forwarded-proto"] = req.protocol;
      forwardHeaders["host"] = `127.0.0.1:${config.internalPort}`;

      const RESPONSE_HOP_HEADERS = new Set([
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailer", "transfer-encoding", "upgrade",
      ]);
      const proxyReq = http.request(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        timeout: 30000,
      }, (proxyRes: any) => {
        const cleanHeaders: Record<string, any> = {};
        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (!RESPONSE_HOP_HEADERS.has(key.toLowerCase())) {
            cleanHeaders[key] = val;
          }
        }
        res.writeHead(proxyRes.statusCode || 502, cleanHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (err: Error) => {
        if (!res.headersSent) {
          res.status(502).json({ message: `Proxy error: ${err.message}` });
        }
      });

      if (req.method !== "GET" && req.method !== "HEAD") {
        req.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: "Proxy error" });
      }
    }
  });

  app.all("/dev-proxy/:projectId/{*path}", async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).send(`<!DOCTYPE html><html><head><title>Not Found</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}div{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#888}</style></head><body><div><h1>Project Not Found</h1><p>This development URL does not correspond to an active project.</p></div></body></html>`);
      }

      if (!project.devUrlPublic) {
        if (!req.session?.userId) {
          return res.status(401).send(`<!DOCTYPE html><html><head><title>Authentication Required</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}div{text-align:center;padding:2rem;max-width:400px}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#888;margin-bottom:1.5rem}a{display:inline-block;padding:0.75rem 2rem;background:#0079F2;color:white;text-decoration:none;border-radius:8px;font-weight:500}a:hover{background:#0062c4}</style></head><body><div><h1>Authentication Required</h1><p>This development URL is private. Please sign in to access it.</p><a href="/auth/login">Sign In</a></div></body></html>`);
        }

        const hasAccess = project.userId === req.session.userId || await verifyProjectAccess(projectId, req.session.userId!);
        if (!hasAccess) {
          return res.status(403).send(`<!DOCTYPE html><html><head><title>Access Denied</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}div{text-align:center;padding:2rem;max-width:400px}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#888}</style></head><body><div><h1>Access Denied</h1><p>You do not have permission to view this development URL. Only the project owner and authorized team members can access private development URLs.</p></div></body></html>`);
        }
      }

      const workspace = await storage.getWorkspaceByProject(projectId);
      if (!workspace) {
        return res.status(502).send(`<!DOCTYPE html><html><head><title>No Workspace</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}div{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#888}</style></head><body><div><h1>Workspace Not Running</h1><p>The development server for this project is not currently active. Start the workspace to enable the development URL.</p></div></body></html>`);
      }

      const targetPort = 3000;
      const previewBaseUrl = runnerClient.previewUrl(workspace.id, targetPort);
      const rawPath = req.params.path;
      const proxyPath = Array.isArray(rawPath) ? rawPath.join("/") : (rawPath || "");
      const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const targetUrl = `${previewBaseUrl}/${proxyPath}${queryString}`;

      const http = require("http") as typeof import("http");
      const https = require("https") as typeof import("https");
      const protocol = targetUrl.startsWith("https") ? https : http;

      const DEV_PROXY_HOP_HEADERS = new Set([
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailer", "transfer-encoding", "upgrade",
        "cookie", "authorization", "host", "accept-encoding",
      ]);
      const forwardHeaders: Record<string, any> = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (!DEV_PROXY_HOP_HEADERS.has(key.toLowerCase())) {
          forwardHeaders[key] = val;
        }
      }
      forwardHeaders["x-forwarded-for"] = req.ip || "unknown";
      forwardHeaders["x-forwarded-proto"] = req.protocol;
      forwardHeaders["accept-encoding"] = "identity";

      const DEV_PROXY_RESP_HOP_HEADERS = new Set([
        "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailer", "transfer-encoding", "upgrade",
      ]);

      const proxyReq = protocol.request(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        timeout: 30000,
      }, (proxyRes: any) => {
        const cleanHeaders: Record<string, any> = {};
        for (const [key, val] of Object.entries(proxyRes.headers)) {
          if (!DEV_PROXY_RESP_HOP_HEADERS.has(key.toLowerCase())) {
            cleanHeaders[key] = val;
          }
        }

        const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();
        const isHtml = contentType.includes("text/html");
        const cookieHeader = req.headers.cookie || "";
        const dismissCookie = cookieHeader.split(";").some(c => c.trim().startsWith("ecode_dev_banner_dismissed="));

        if (isHtml && !dismissCookie) {
          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            let html = Buffer.concat(chunks).toString("utf-8");
            const banner = `<div id="ecode-dev-banner" style="position:fixed;top:0;left:0;right:0;z-index:999999;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#e0e0e0;padding:8px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.1)"><span style="opacity:0.7">&#9432;</span><span>This is a development preview on <strong>.e-code.ai</strong>. Development URLs are temporary — <a href="/publish" style="color:#4dabf7;text-decoration:underline">publish your app</a> for a permanent URL.</span><button onclick="document.getElementById('ecode-dev-banner').remove();document.cookie='ecode_dev_banner_dismissed=1;path=/;max-age=86400;SameSite=Lax'" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#e0e0e0;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap">Dismiss</button></div><div style="height:38px"></div>`;
            const bodyIdx = html.indexOf("<body");
            if (bodyIdx !== -1) {
              const closeIdx = html.indexOf(">", bodyIdx);
              if (closeIdx !== -1) {
                html = html.slice(0, closeIdx + 1) + banner + html.slice(closeIdx + 1);
              }
            } else {
              html = banner + html;
            }
            delete cleanHeaders["content-length"];
            res.writeHead(proxyRes.statusCode || 200, cleanHeaders);
            res.end(html);
          });
        } else {
          res.writeHead(proxyRes.statusCode || 502, cleanHeaders);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on("error", (err: Error) => {
        if (!res.headersSent) {
          res.status(502).json({ message: `Proxy error: ${err.message}` });
        }
      });

      if (req.method !== "GET" && req.method !== "HEAD") {
        req.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: "Dev URL proxy error" });
      }
    }
  });

  app.get("/api/projects/:id/checkpoints", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const cps = await storage.getCheckpoints(project.id);
      const position = await storage.getCheckpointPosition(project.id);
      const stripped = cps.map(({ stateSnapshot, ...rest }) => {
        const snap = stateSnapshot as CheckpointStateSnapshot;
        return {
          ...rest,
          fileCount: snap?.files?.length || 0,
          packageCount: snap?.packages?.length || 0,
        };
      });
      return res.json({
        checkpoints: stripped,
        currentCheckpointId: position?.currentCheckpointId || null,
        divergedFromId: position?.divergedFromId || null,
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch checkpoints" });
    }
  });

  app.post("/api/projects/:id/checkpoints", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const description = typeof req.body?.description === "string" ? req.body.description.slice(0, 500) : undefined;
      const trigger = typeof req.body?.trigger === "string" && ["manual", "feature_complete", "deployment", "pre_risky_op"].includes(req.body.trigger) ? req.body.trigger : "manual";
      const cp = await createCheckpoint(project.id, req.session.userId!, trigger, description);
      const { stateSnapshot, ...rest } = cp;
      const snap = stateSnapshot as CheckpointStateSnapshot;
      return res.json({ ...rest, fileCount: snap?.files?.length || 0, packageCount: snap?.packages?.length || 0 });
    } catch {
      return res.status(500).json({ message: "Failed to create checkpoint" });
    }
  });

  app.get("/api/projects/:id/checkpoints/:cpId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const cp = await storage.getCheckpoint(req.params.cpId);
      if (!cp || cp.projectId !== project.id) return res.status(404).json({ message: "Checkpoint not found" });
      return res.json(cp);
    } catch {
      return res.status(500).json({ message: "Failed to fetch checkpoint" });
    }
  });

  app.post("/api/projects/:id/checkpoints/:cpId/restore", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const cp = await storage.getCheckpoint(req.params.cpId);
      if (!cp || cp.projectId !== project.id) return res.status(404).json({ message: "Checkpoint not found" });
      const { includeDatabase } = req.body || {};
      const result = await restoreCheckpoint(cp.id, { includeDatabase: !!includeDatabase });
      if (!result.success) return res.status(500).json({ message: result.message });
      return res.json(result);
    } catch {
      return res.status(500).json({ message: "Failed to restore checkpoint" });
    }
  });

  app.get("/api/projects/:id/checkpoints/:cpId/diff", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const cp = await storage.getCheckpoint(req.params.cpId);
      if (!cp || cp.projectId !== project.id) return res.status(404).json({ message: "Checkpoint not found" });
      const diff = await getCheckpointDiff(cp.id);
      if (!diff) return res.status(404).json({ message: "Checkpoint not found" });
      return res.json(diff);
    } catch {
      return res.status(500).json({ message: "Failed to compute diff" });
    }
  });

  app.delete("/api/projects/:id/checkpoints/:cpId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const cp = await storage.getCheckpoint(req.params.cpId);
      if (!cp || cp.projectId !== project.id) return res.status(404).json({ message: "Checkpoint not found" });
      await storage.deleteCheckpoint(cp.id);
      return res.json({ message: "Checkpoint deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete checkpoint" });
    }
  });

  registerImageRoutes(app, requireAuth);
  log("Integration routes registered (image)", "express");

}
