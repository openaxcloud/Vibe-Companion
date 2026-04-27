// AUTO-EXTRACTED from server/routes.ts (lines 3728-3815)
// Original section: import-guessing
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


export async function registerImportGuessingRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- IMPORT GUESSING ---
  app.get("/api/projects/:id/imports/missing", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const files = await storage.getFiles(project.id);
      const pm = detectPackageManager(files);

      const detectedImports = new Set<string>();
      const isJsProject = pm === "npm" || project.language === "javascript" || project.language === "typescript";
      const isPyProject = pm === "pip" || pm === "poetry" || project.language === "python" || project.language === "python3";

      for (const file of files) {
        if (!file.content) continue;
        const ext = file.filename.split(".").pop()?.toLowerCase() || "";

        if (isJsProject && ["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) {
          const jsImportRe = /(?:import\s+(?:.*?from\s+)?['"]([^'"./][^'"]*?)['"]|export\s+.*?from\s+['"]([^'"./][^'"]*?)['"]|require\s*\(\s*['"]([^'"./][^'"]*?)['"]\s*\))/g;
          let match;
          while ((match = jsImportRe.exec(file.content)) !== null) {
            const raw = match[1] || match[2] || match[3];
            if (!raw) continue;
            if (raw.startsWith("@")) {
              const parts = raw.split("/");
              if (parts.length >= 2) detectedImports.add(parts.slice(0, 2).join("/"));
            } else {
              detectedImports.add(raw.split("/")[0]);
            }
          }
        }

        if (isPyProject && ["py"].includes(ext)) {
          const pyImportRe = /(?:^\s*import\s+(\w+)|^\s*from\s+(\w+)\s+import)/gm;
          let match;
          while ((match = pyImportRe.exec(file.content)) !== null) {
            detectedImports.add(match[1] || match[2]);
          }
        }
      }

      const nodeBuiltins = new Set(["fs", "path", "http", "https", "url", "os", "crypto", "util", "stream", "events", "buffer", "child_process", "cluster", "dgram", "dns", "net", "readline", "tls", "vm", "zlib", "assert", "querystring", "string_decoder", "timers", "tty", "v8", "worker_threads", "perf_hooks", "module", "console", "process"]);
      const pyBuiltins = new Set(["os", "sys", "re", "json", "math", "datetime", "collections", "itertools", "functools", "io", "pathlib", "typing", "abc", "copy", "enum", "hashlib", "hmac", "logging", "pickle", "random", "shutil", "socket", "sqlite3", "string", "subprocess", "tempfile", "threading", "time", "traceback", "unittest", "urllib", "uuid", "warnings", "xml", "argparse", "base64", "contextlib", "csv", "dataclasses", "decimal", "difflib", "email", "glob", "gzip", "heapq", "html", "http", "importlib", "inspect", "ipaddress", "operator", "pprint", "queue", "signal", "statistics", "struct", "textwrap", "zipfile"]);

      const installedNames = new Set<string>();
      let pkgFile;
      if (isJsProject) {
        pkgFile = files.find(f => f.filename === "package.json");
        if (pkgFile && pkgFile.content) {
          try {
            const pkg = JSON.parse(pkgFile.content);
            if (pkg.dependencies) Object.keys(pkg.dependencies).forEach(n => installedNames.add(n));
            if (pkg.devDependencies) Object.keys(pkg.devDependencies).forEach(n => installedNames.add(n));
          } catch {}
        }
      }
      if (isPyProject) {
        const reqFile = files.find(f => f.filename === "requirements.txt");
        if (reqFile && reqFile.content) {
          reqFile.content.split("\n").filter(l => l.trim() && !l.startsWith("#")).forEach(l => {
            const m = l.match(/^([a-zA-Z0-9_.-]+)/);
            if (m) installedNames.add(m[1].toLowerCase());
          });
        }
        const pyproject = files.find(f => f.filename === "pyproject.toml");
        if (pyproject && pyproject.content) {
          const depMatch = pyproject.content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
          if (depMatch) {
            depMatch[1].split("\n").forEach(l => {
              const m = l.match(/^(\w[\w.-]*)\s*=/);
              if (m) installedNames.add(m[1].toLowerCase());
            });
          }
        }
      }

      const builtins = isJsProject ? nodeBuiltins : pyBuiltins;
      const projectFileNames = new Set(files.map(f => f.filename.replace(/\.[^.]+$/, "").replace(/\//g, ".")));

      const missing = Array.from(detectedImports)
        .filter(imp => !builtins.has(imp) && !installedNames.has(imp.toLowerCase()) && !projectFileNames.has(imp))
        .map(imp => ({ name: imp, suggestedPackage: imp }));

      return res.json({ missing, packageManager: pm, language: project.language });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to analyze imports" });
    }
  });

}
