// AUTO-EXTRACTED from server/routes.ts (lines 15692-15883)
// Original section: global-search
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


export async function registerGlobalSearchRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- GLOBAL SEARCH ---
  app.get("/api/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      const type = String(req.query.type || "all");
      if (!q) return res.json({ projects: [], templates: [], code: [], users: [] });
      const results: any = {};
      if (type === "all" || type === "projects") {
        results.projects = await storage.searchProjects(req.session.userId!, q);
      }
      if (type === "all" || type === "templates") {
        results.templates = await storage.searchTemplates(q);
      }
      if (type === "all" || type === "code") {
        results.code = await storage.searchCodeAcrossProjects(req.session.userId!, q);
      }
      if (type === "all" || type === "users") {
        results.users = await storage.searchUsers(q);
      }
      return res.json(results);
    } catch {
      return res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/desktop/releases/latest", async (_req: Request, res: Response) => {
    try {
      const releases = await storage.getLatestDesktopReleases();
      if (releases.length === 0) {
        return res.json({ version: null, platforms: {} });
      }
      const sorted = [...releases].sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      const version = sorted[0].version;
      const changelog = sorted[0].changelog;
      const platforms: Record<string, { downloadUrl: string; fileSize: number | null; sha512: string | null }> = {};
      for (const r of sorted) {
        if (!platforms[r.platform]) {
          platforms[r.platform] = { downloadUrl: r.downloadUrl, fileSize: r.fileSize, sha512: r.sha512 };
        }
      }
      return res.json({ version, changelog, platforms });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/desktop/releases/:version", async (req: Request, res: Response) => {
    try {
      const releases = await storage.getDesktopReleasesByVersion(req.params.version);
      if (releases.length === 0) {
        return res.status(404).json({ message: "Version not found" });
      }
      const platforms: Record<string, { downloadUrl: string; fileSize: number | null; sha512: string | null }> = {};
      for (const r of releases) {
        platforms[r.platform] = { downloadUrl: r.downloadUrl, fileSize: r.fileSize, sha512: r.sha512 };
      }
      return res.json({ version: req.params.version, changelog: releases[0].changelog, platforms });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/desktop/releases", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    try {
      const { version, changelog, isLatest, platforms } = req.body;
      if (!version || !platforms || typeof platforms !== "object" || Object.keys(platforms).length === 0) {
        return res.status(400).json({ message: "version and platforms (object with mac/win/linux keys) are required" });
      }
      const validPlatforms = ["mac", "win", "linux"];
      const results = [];
      for (const [platform, details] of Object.entries(platforms)) {
        if (!validPlatforms.includes(platform)) {
          return res.status(400).json({ message: `Invalid platform: ${platform}. Must be mac, win, or linux` });
        }
        const platformData = details as { downloadUrl: string; fileSize?: number; sha512?: string };
        if (!platformData.downloadUrl) {
          return res.status(400).json({ message: `downloadUrl is required for platform ${platform}` });
        }
        const release = await storage.createDesktopRelease({
          version,
          platform,
          downloadUrl: platformData.downloadUrl,
          changelog: changelog || null,
          fileSize: platformData.fileSize || null,
          sha512: platformData.sha512 || null,
          isLatest: isLatest !== false,
        });
        results.push(release);
      }
      return res.status(201).json({ version, releases: results });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/desktop/update/:platform/:version", async (req: Request, res: Response) => {
    try {
      const { platform, version } = req.params;
      if (!["mac", "win", "linux"].includes(platform)) {
        return res.status(400).json({ message: "Invalid platform" });
      }
      const latest = await storage.getLatestDesktopReleases();
      const platformRelease = latest.find(r => r.platform === platform);
      if (!platformRelease || platformRelease.version === version) {
        return res.status(204).end();
      }
      const pubDate = platformRelease.createdAt instanceof Date
        ? platformRelease.createdAt.toISOString()
        : String(platformRelease.createdAt);
      return res.json({
        url: platformRelease.downloadUrl,
        name: platformRelease.version,
        version: platformRelease.version,
        notes: platformRelease.changelog || "",
        pub_date: pubDate,
        sha512: platformRelease.sha512 || "",
        releaseDate: pubDate,
        path: platformRelease.downloadUrl,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/desktop/update/latest-:platformKey.yml", async (req: Request, res: Response) => {
    try {
      const platformMap: Record<string, string> = { mac: "mac", linux: "linux", win: "win" };
      const platform = platformMap[req.params.platformKey] || "win";
      const latest = await storage.getLatestDesktopReleases();
      const platformRelease = latest.find(r => r.platform === platform);
      if (!platformRelease) {
        return res.status(404).send("No release found");
      }
      const pubDate = platformRelease.createdAt instanceof Date
        ? platformRelease.createdAt.toISOString()
        : String(platformRelease.createdAt);
      const yml = [
        `version: ${platformRelease.version}`,
        `path: ${platformRelease.downloadUrl}`,
        `sha512: ${platformRelease.sha512 || ""}`,
        `releaseDate: '${pubDate}'`,
      ].join("\n");
      res.setHeader("Content-Type", "text/yaml");
      return res.send(yml);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/desktop/update/latest.yml", async (_req: Request, res: Response) => {
    try {
      const latest = await storage.getLatestDesktopReleases();
      const platformRelease = latest.find(r => r.platform === "win");
      if (!platformRelease) {
        return res.status(404).send("No release found");
      }
      const pubDate = platformRelease.createdAt instanceof Date
        ? platformRelease.createdAt.toISOString()
        : String(platformRelease.createdAt);
      const yml = [
        `version: ${platformRelease.version}`,
        `path: ${platformRelease.downloadUrl}`,
        `sha512: ${platformRelease.sha512 || ""}`,
        `releaseDate: '${pubDate}'`,
      ].join("\n");
      res.setHeader("Content-Type", "text/yaml");
      return res.send(yml);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/desktop/downloads/track", async (req: Request, res: Response) => {
    try {
      const { platform, version } = req.body;
      if (!platform || !version) {
        return res.status(400).json({ message: "platform and version are required" });
      }
      await storage.trackDesktopDownload(platform, version);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: safeError(err, "Failed to track download") });
    }
  });

}
