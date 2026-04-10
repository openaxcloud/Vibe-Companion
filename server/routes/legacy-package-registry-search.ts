// AUTO-EXTRACTED from server/routes.ts (lines 3610-3692)
// Original section: package-registry-search
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


export async function registerPackageRegistrySearchRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- PACKAGE REGISTRY SEARCH ---
  app.get("/api/packages/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const lastSearch = searchRateLimits.get(userId) || 0;
      if (Date.now() - lastSearch < SEARCH_RATE_MS) {
        return res.status(429).json({ message: "Too many search requests, please slow down" });
      }
      searchRateLimits.set(userId, Date.now());

      const { q, registry } = z.object({
        q: z.string().min(1).max(200),
        registry: z.enum(["npm", "pypi"]).default("npm"),
      }).parse(req.query);

      const sanitizedQuery = q.replace(/[<>&"'\\]/g, "").trim();
      if (!sanitizedQuery) return res.json({ results: [], registry });

      if (registry === "npm") {
        const npmRes = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(sanitizedQuery)}&size=15`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!npmRes.ok) return res.status(502).json({ message: "npm registry search failed" });
        const data = await npmRes.json() as any;
        const results = (data.objects || []).map((obj: any) => ({
          name: obj.package?.name || "",
          description: (obj.package?.description || "").substring(0, 200),
          version: obj.package?.version || "",
          downloads: obj.score?.detail?.popularity ? Math.round(obj.score.detail.popularity * 1000000) : 0,
        }));
        return res.json({ results, registry: "npm" });
      } else {
        const exactRes = await fetch(`https://pypi.org/pypi/${encodeURIComponent(sanitizedQuery)}/json`, {
          signal: AbortSignal.timeout(8000),
        });
        const exactResults: { name: string; description: string; version: string; downloads: number }[] = [];
        if (exactRes.ok) {
          const data = await exactRes.json() as any;
          exactResults.push({
            name: data.info?.name || sanitizedQuery,
            description: (data.info?.summary || "").substring(0, 200),
            version: data.info?.version || "",
            downloads: 0,
          });
        }

        const searchResults: { name: string; description: string; version: string; downloads: number }[] = [];
        try {
          const htmlRes = await fetch(`https://pypi.org/search/?q=${encodeURIComponent(sanitizedQuery)}&page=1`, {
            headers: { "Accept": "text/html" },
            signal: AbortSignal.timeout(8000),
          });
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            const snippetRe = /<a class="package-snippet"[^>]*href="\/project\/([^/"]+)\/"[^>]*>[\s\S]*?<span class="package-snippet__name">([^<]*)<\/span>\s*<span class="package-snippet__version">([^<]*)<\/span>[\s\S]*?<p class="package-snippet__description">([^<]*)<\/p>/g;
            let match;
            const seen = new Set(exactResults.map(r => r.name.toLowerCase()));
            while ((match = snippetRe.exec(html)) && searchResults.length < 14) {
              const pkgName = (match[2] || match[1]).trim();
              if (!seen.has(pkgName.toLowerCase())) {
                seen.add(pkgName.toLowerCase());
                searchResults.push({
                  name: pkgName,
                  description: (match[4] || "").trim().substring(0, 200),
                  version: (match[3] || "").trim(),
                  downloads: 0,
                });
              }
            }
          }
        } catch {}

        const allResults = [...exactResults, ...searchResults];
        if (allResults.length === 0) {
          allResults.push({ name: sanitizedQuery, description: "Package not found in index — install to verify", version: "", downloads: 0 });
        }
        return res.json({ results: allResults.slice(0, 15), registry: "pypi" });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Package search failed" });
    }
  });

}
