// AUTO-EXTRACTED from server/routes.ts (lines 2980-3609)
// Original section: package-management
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


export async function registerPackageManagementRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- PACKAGE MANAGEMENT ---
  async function runProjectCommand(projectId: string, command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const workspace = await storage.getWorkspaceByProject(projectId);
    if (workspace) {
      const result = await runnerClient.execInWorkspace(workspace.id, command, args);
      if (result) return result;
    }

    const path = await import("path");
    const localDir = path.join(process.cwd(), "project-workspaces", projectId);
    return runnerClient.execLocal(localDir, command, args);
  }

  async function getProjectPackageManager(projectId: string): Promise<"npm" | "pip" | "poetry" | "none"> {
    const files = await storage.getFiles(projectId);
    return detectPackageManager(files);
  }

  function detectPackageManager(files: { filename: string; content: string | null }[]): "npm" | "pip" | "poetry" | "none" {
    if (files.find(f => f.filename === "package.json")) return "npm";
    const pyprojectFile = files.find(f => f.filename === "pyproject.toml");
    if (pyprojectFile && pyprojectFile.content && pyprojectFile.content.includes("[tool.poetry]")) return "poetry";
    if (files.find(f => f.filename === "requirements.txt") || pyprojectFile) return "pip";
    return "none";
  }

  function detectAllManagers(files: { filename: string; content: string | null }[]): ("npm" | "pip" | "poetry")[] {
    const managers: ("npm" | "pip" | "poetry")[] = [];
    if (files.find(f => f.filename === "package.json")) managers.push("npm");
    const pyprojectFile = files.find(f => f.filename === "pyproject.toml");
    if (pyprojectFile && pyprojectFile.content && pyprojectFile.content.includes("[tool.poetry]")) {
      managers.push("poetry");
    } else if (files.find(f => f.filename === "requirements.txt") || pyprojectFile) {
      managers.push("pip");
    }
    return managers;
  }

  async function getPackagesForManager(
    projectId: string,
    pm: "npm" | "pip" | "poetry",
    files: { filename: string; content: string | null }[]
  ): Promise<{ name: string; version: string; dev?: boolean }[]> {
    const packages: { name: string; version: string; dev?: boolean }[] = [];
    if (pm === "npm") {
      let commandSucceeded = false;
      try {
        const result = await runProjectCommand(projectId, "npm", ["ls", "--json", "--depth=0"]);
        if (result.stdout) {
          const parsed = JSON.parse(result.stdout);
          const deps = parsed.dependencies || {};
          const pkgFile = files.find(f => f.filename === "package.json");
          let devDeps: Record<string, string> = {};
          if (pkgFile) {
            try { devDeps = JSON.parse(pkgFile.content || "{}").devDependencies || {}; } catch {}
          }
          for (const [name, info] of Object.entries(deps) as [string, any][]) {
            packages.push({ name, version: info.version || "unknown", dev: !!devDeps[name] });
          }
          commandSucceeded = true;
        }
      } catch {}
      if (!commandSucceeded) {
        const pkgFile = files.find(f => f.filename === "package.json");
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile.content || "{}");
            if (pkg.dependencies) Object.entries(pkg.dependencies).forEach(([name, version]) => packages.push({ name, version: String(version) }));
            if (pkg.devDependencies) Object.entries(pkg.devDependencies).forEach(([name, version]) => packages.push({ name, version: String(version), dev: true }));
          } catch {}
        }
      }
    } else if (pm === "poetry") {
      let commandSucceeded = false;
      try {
        const result = await runProjectCommand(projectId, "poetry", ["show", "--no-ansi"]);
        if (result.exitCode === 0 && result.stdout) {
          const lines = result.stdout.split("\n").filter(l => l.trim());
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              packages.push({ name: parts[0], version: parts[1] });
            }
          }
          commandSucceeded = true;
        }
      } catch {}
      if (!commandSucceeded) {
        const pyproject = files.find(f => f.filename === "pyproject.toml");
        if (pyproject && pyproject.content) {
          const depMatch = pyproject.content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
          if (depMatch) {
            depMatch[1].split("\n").forEach(l => {
              const m = l.match(/^(\w[\w.-]*)\s*=\s*"?([^"]*)"?/);
              if (m && m[1] !== "python") packages.push({ name: m[1], version: m[2] || "latest" });
            });
          }
          const devMatch = pyproject.content.match(/\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?:\[|$)/);
          if (devMatch) {
            devMatch[1].split("\n").forEach(l => {
              const m = l.match(/^(\w[\w.-]*)\s*=\s*"?([^"]*)"?/);
              if (m) packages.push({ name: m[1], version: m[2] || "latest", dev: true });
            });
          }
        }
      }
    } else if (pm === "pip") {
      let commandSucceeded = false;
      try {
        const result = await runProjectCommand(projectId, "pip", ["list", "--format=json"]);
        if (result.exitCode === 0 && result.stdout) {
          const parsed = JSON.parse(result.stdout);
          for (const p of parsed as { name: string; version: string }[]) {
            packages.push({ name: p.name, version: p.version });
          }
          commandSucceeded = true;
        }
      } catch {}
      if (!commandSucceeded) {
        const reqFile = files.find(f => f.filename === "requirements.txt");
        if (reqFile) {
          const lines = (reqFile.content || "").split("\n").filter(l => l.trim() && !l.startsWith("#"));
          for (const line of lines) {
            const match = line.match(/^([a-zA-Z0-9_.-]+)(?:[=<>!~]+(.+))?$/);
            if (match) packages.push({ name: match[1], version: match[2] || "latest" });
          }
        }
      }
    }
    return packages;
  }

  app.get("/api/projects/:id/config", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      const files = await storage.getFiles(req.params.id);
      const replitFile = files.find(f => f.filename === ".replit");
      const nixFile = files.find(f => f.filename === "replit.nix");

      let replitConfig: ReplitConfig = {};
      let rawReplit = "";
      if (replitFile?.content) {
        rawReplit = replitFile.content;
        try { replitConfig = parseReplitConfig(replitFile.content); } catch {}
      }

      let nixDeps: string[] = [];
      let rawNix = "";
      if (nixFile?.content) {
        rawNix = nixFile.content;
        try { nixDeps = parseReplitNix(nixFile.content).deps; } catch {}
      }

      return res.json({
        replit: replitConfig,
        nix: { deps: nixDeps },
        raw: { replit: rawReplit, nix: rawNix },
        hasReplitFile: !!replitFile,
        hasNixFile: !!nixFile,
      });
    } catch {
      return res.status(500).json({ message: "Failed to get config" });
    }
  });

  app.put("/api/projects/:id/config", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(project.id, req.session.userId!))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { replit, nix, rawReplit, rawNix } = req.body;
      const files = await storage.getFiles(req.params.id);

      if (rawReplit !== undefined) {
        const existingFile = files.find(f => f.filename === ".replit");
        if (existingFile) {
          await storage.updateFileContent(existingFile.id, rawReplit);
        } else {
          await storage.createFile(req.params.id, { filename: ".replit", content: rawReplit });
        }
      } else if (replit) {
        const content = serializeReplitConfig(replit);
        const existingFile = files.find(f => f.filename === ".replit");
        if (existingFile) {
          await storage.updateFileContent(existingFile.id, content);
        } else {
          await storage.createFile(req.params.id, { filename: ".replit", content });
        }
      }

      if (rawNix !== undefined) {
        const existingFile = files.find(f => f.filename === "replit.nix");
        if (existingFile) {
          await storage.updateFileContent(existingFile.id, rawNix);
        } else {
          await storage.createFile(req.params.id, { filename: "replit.nix", content: rawNix });
        }
      } else if (nix && Array.isArray(nix.deps)) {
        const content = serializeReplitNix(nix.deps);
        const existingFile = files.find(f => f.filename === "replit.nix");
        if (existingFile) {
          await storage.updateFileContent(existingFile.id, content);
        } else {
          await storage.createFile(req.params.id, { filename: "replit.nix", content });
        }
      }

      const updatedConfig = await getProjectConfig(req.params.id);
      return res.json({ replit: updatedConfig, message: "Config updated" });
    } catch {
      return res.status(500).json({ message: "Failed to update config" });
    }
  });

  app.post("/api/projects/:id/onboot", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) {
        return res.status(404).json({ message: "Project not found" });
      }
      const config = await getProjectConfig(req.params.id);
      if (!config.onBoot) {
        return res.json({ executed: false, message: "No onBoot command configured" });
      }
      const result = await executeCode(config.onBoot, "bash");
      return res.json({ executed: true, command: config.onBoot, result });
    } catch {
      return res.status(500).json({ message: "Failed to execute onBoot" });
    }
  });

  app.get("/api/projects/:id/files", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const files = await storage.getFiles(req.params.id);
      res.json(files);
    } catch { res.json([]); }
  });

  app.get("/api/projects/:id/packages", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const files = await storage.getFiles(req.params.id);
      const managers = detectAllManagers(files);
      const pm = managers[0] || "none";

      const groups: Record<string, { packages: { name: string; version: string; dev?: boolean }[]; manager: string; language: string }> = {};
      for (const mgr of managers) {
        const lang = mgr === "npm" ? "javascript" : "python";
        const packages = await getPackagesForManager(project.id, mgr, files);
        groups[lang] = { packages, manager: mgr, language: lang };
      }

      const allPackages = Object.values(groups).flatMap(g => g.packages);
      return res.json({
        packages: allPackages,
        packageManager: pm,
        managers,
        groups,
        language: project.language,
      });
    } catch {
      return res.status(500).json({ message: "Failed to get packages" });
    }
  });

  function extractBaseName(name: string): string {
    let baseName = name;
    if (baseName.startsWith("@")) {
      const slashIdx = baseName.indexOf("/");
      if (slashIdx > 0) {
        const afterSlash = baseName.substring(slashIdx + 1);
        const atIdx = afterSlash.indexOf("@");
        if (atIdx > 0) baseName = baseName.substring(0, slashIdx + 1 + atIdx);
        else baseName = baseName.replace(/[=<>!~].*$/, "");
      }
    } else {
      const atIdx = baseName.indexOf("@");
      if (atIdx > 0) baseName = baseName.substring(0, atIdx);
      baseName = baseName.replace(/[=<>!~].*$/, "");
    }
    return baseName;
  }

  function validatePackageName(name: string): boolean {
    const pkgNamePattern = /^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i;
    return pkgNamePattern.test(name) && !name.startsWith("-") && !name.startsWith(".");
  }

  function buildInstallCmd(pm: string, baseName: string, version?: string, dev?: boolean): { command: string; args: string[] } {
    if (pm === "poetry") {
      const pkgSpec = version ? `${baseName}==${version}` : baseName;
      return { command: "poetry", args: dev ? ["add", "--group", "dev", pkgSpec] : ["add", pkgSpec] };
    } else if (pm === "pip") {
      const pkgSpec = version ? `${baseName}==${version}` : baseName;
      return { command: "pip", args: ["install", pkgSpec] };
    } else {
      const pkgSpec = version ? `${baseName}@${version}` : baseName;
      return { command: "npm", args: dev ? ["install", "--save-dev", pkgSpec] : ["install", pkgSpec] };
    }
  }

  function buildUninstallCmd(pm: string, name: string): { command: string; args: string[] } {
    if (pm === "poetry") return { command: "poetry", args: ["remove", name] };
    if (pm === "pip") return { command: "pip", args: ["uninstall", "-y", name] };
    return { command: "npm", args: ["uninstall", name] };
  }

  function buildUpdateCmd(pm: string, name?: string): { command: string; args: string[] } {
    if (pm === "poetry") return { command: "poetry", args: name ? ["update", name] : ["update"] };
    if (pm === "pip") return { command: "pip", args: name ? ["install", "--upgrade", name] : ["install", "--upgrade", "-r", "requirements.txt"] };
    return { command: "npm", args: name ? ["update", name] : ["update"] };
  }

  async function withInstallLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    if (projectInstallLocks.get(projectId)) {
      throw new Error("Another package operation is in progress for this project. Please wait.");
    }
    projectInstallLocks.set(projectId, true);
    try {
      return await fn();
    } finally {
      projectInstallLocks.delete(projectId);
    }
  }

  async function streamCommand(res: any, projectId: string, command: string, args: string[]) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    sendEvent("start", { command: `${command} ${args.join(" ")}` });
    try {
      const result = await withInstallLock(projectId, () => runProjectCommand(projectId, command, args));
      const output = (result.stdout + "\n" + result.stderr).trim();
      const lines = output.split("\n");
      for (let i = 0; i < lines.length; i++) {
        sendEvent("output", { line: lines[i], index: i });
      }
      sendEvent("done", { success: result.exitCode === 0, output, exitCode: result.exitCode, command: `${command} ${args.join(" ")}` });
    } catch (execErr: any) {
      sendEvent("error", { message: execErr.message || "Execution failed" });
    }
    res.end();
  }

  app.post("/api/projects/:id/packages/add", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(req.params.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const { name, dev, version, manager: requestedManager } = z.object({
        name: z.string().min(1).max(200),
        dev: z.boolean().optional(),
        version: z.string().optional(),
        manager: z.enum(["npm", "pip", "poetry"]).optional(),
      }).parse(req.body);

      const baseName = extractBaseName(name);
      if (!validatePackageName(baseName)) return res.status(400).json({ message: "Invalid package name" });

      const files = await storage.getFiles(project.id);
      const pm = requestedManager || detectPackageManager(files);
      const { command, args } = buildInstallCmd(pm, baseName, version, dev);

      const result = await withInstallLock(project.id, () => runProjectCommand(project.id, command, args));
      const output = (result.stdout + "\n" + result.stderr).trim();

      if (result.exitCode !== 0) {
        return res.status(400).json({ success: false, message: "Installation failed", output, command: `${command} ${args.join(" ")}` });
      }
      return res.json({ success: true, output, command: `${command} ${args.join(" ")}` });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: err.message || "Failed to add package" });
    }
  });

  app.post("/api/projects/:id/packages/install-stream", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const { name, dev, version, manager: requestedManager } = z.object({
        name: z.string().min(1).max(200),
        dev: z.boolean().optional(),
        version: z.string().optional(),
        manager: z.enum(["npm", "pip", "poetry"]).optional(),
      }).parse(req.body);

      const baseName = extractBaseName(name);
      if (!validatePackageName(baseName)) {
        return res.status(400).json({ message: "Invalid package name" });
      }

      const files = await storage.getFiles(project.id);
      const pm = requestedManager || detectPackageManager(files);
      const { command, args } = buildInstallCmd(pm, baseName, version, dev);

      await streamCommand(res, project.id, command, args);
    } catch (err: any) {
      if (!res.headersSent) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
        return res.status(500).json({ message: err.message || "Failed to install package" });
      }
      res.end();
    }
  });

  app.post("/api/projects/:id/packages/remove", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (String(project.userId) !== String(req.session.userId) && !await verifyProjectWriteAccess(req.params.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const { name, manager: requestedManager } = z.object({
        name: z.string().min(1),
        manager: z.enum(["npm", "pip", "poetry"]).optional(),
      }).parse(req.body);

      if (!validatePackageName(name)) return res.status(400).json({ message: "Invalid package name" });

      const files = await storage.getFiles(project.id);
      const pm = requestedManager || detectPackageManager(files);
      const { command, args } = buildUninstallCmd(pm, name);

      const result = await withInstallLock(project.id, () => runProjectCommand(project.id, command, args));
      const output = (result.stdout + "\n" + result.stderr).trim();

      if (result.exitCode !== 0) {
        return res.status(400).json({ success: false, message: "Removal failed", output, command: `${command} ${args.join(" ")}` });
      }
      return res.json({ success: true, output, command: `${command} ${args.join(" ")}` });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: err.message || "Failed to remove package" });
    }
  });

  app.post("/api/projects/:id/packages/remove-stream", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const { name, manager: requestedManager } = z.object({
        name: z.string().min(1),
        manager: z.enum(["npm", "pip", "poetry"]).optional(),
      }).parse(req.body);

      if (!validatePackageName(name)) return res.status(400).json({ message: "Invalid package name" });

      const files = await storage.getFiles(project.id);
      const pm = requestedManager || detectPackageManager(files);
      const { command, args } = buildUninstallCmd(pm, name);

      await streamCommand(res, project.id, command, args);
    } catch (err: any) {
      if (!res.headersSent) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
        return res.status(500).json({ message: err.message || "Failed to remove package" });
      }
      res.end();
    }
  });

  app.post("/api/projects/:id/packages/update", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const { name, manager: requestedManager } = z.object({
        name: z.string().optional(),
        manager: z.enum(["npm", "pip", "poetry"]).optional(),
      }).parse(req.body);

      if (name && !validatePackageName(name)) return res.status(400).json({ message: "Invalid package name" });

      const files = await storage.getFiles(project.id);
      const pm = requestedManager || detectPackageManager(files);
      const { command, args } = buildUpdateCmd(pm, name);

      const result = await withInstallLock(project.id, () => runProjectCommand(project.id, command, args));
      const output = (result.stdout + "\n" + result.stderr).trim();

      if (result.exitCode !== 0) {
        return res.status(400).json({ success: false, message: "Update failed", output, command: `${command} ${args.join(" ")}` });
      }
      return res.json({ success: true, output, command: `${command} ${args.join(" ")}` });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: err.message || "Failed to update package" });
    }
  });

  app.post("/api/projects/:id/packages/update-stream", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });
      const { name, manager: requestedManager } = z.object({
        name: z.string().optional(),
        manager: z.enum(["npm", "pip", "poetry"]).optional(),
      }).parse(req.body);

      if (name && !validatePackageName(name)) return res.status(400).json({ message: "Invalid package name" });

      const files = await storage.getFiles(project.id);

      if (!name && !requestedManager) {
        const managers = detectAllManagers(files);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        const sendEvent = (event: string, data: any) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        let allOutput = "";
        let allSuccess = true;
        for (const pm of managers) {
          const { command, args } = buildUpdateCmd(pm);
          sendEvent("start", { command: `${command} ${args.join(" ")}`, manager: pm });
          try {
            const result = await withInstallLock(project.id, () => runProjectCommand(project.id, command, args));
            const output = (result.stdout + "\n" + result.stderr).trim();
            const lines = output.split("\n");
            for (let i = 0; i < lines.length; i++) {
              sendEvent("output", { line: lines[i], index: i, manager: pm });
            }
            allOutput += `\n--- ${pm} ---\n${output}`;
            if (result.exitCode !== 0) allSuccess = false;
          } catch (err: any) {
            sendEvent("error", { message: err.message, manager: pm });
            allSuccess = false;
          }
        }
        sendEvent("done", { success: allSuccess, output: allOutput.trim(), command: "update all" });
        outdatedCache.delete(project.id);
        res.end();
        return;
      }

      const pm = requestedManager || detectPackageManager(files);
      const { command, args } = buildUpdateCmd(pm, name);

      await streamCommand(res, project.id, command, args);
      outdatedCache.delete(project.id);
    } catch (err: any) {
      if (!res.headersSent) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
        return res.status(500).json({ message: err.message || "Failed to update package" });
      }
      res.end();
    }
  });

  const outdatedCache = new Map<string, { data: any; ts: number }>();
  const OUTDATED_CACHE_TTL = 120000;

  app.get("/api/projects/:id/packages/outdated", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Project not found" });

      const cached = outdatedCache.get(project.id);
      if (cached && Date.now() - cached.ts < OUTDATED_CACHE_TTL) {
        return res.json(cached.data);
      }

      const files = await storage.getFiles(project.id);
      const managers = detectAllManagers(files);

      const outdated: { name: string; current: string; latest: string; wanted: string; manager: string }[] = [];

      for (const pm of managers) {
        try {
          if (pm === "npm") {
            const result = await runProjectCommand(project.id, "npm", ["outdated", "--json"]);
            const stdout = result.stdout.trim();
            if (stdout) {
              try {
                const parsed = JSON.parse(stdout);
                for (const [name, info] of Object.entries(parsed as Record<string, any>)) {
                  outdated.push({ name, current: info.current || "", latest: info.latest || "", wanted: info.wanted || "", manager: "npm" });
                }
              } catch {}
            }
          } else if (pm === "pip") {
            const result = await runProjectCommand(project.id, "pip", ["list", "--outdated", "--format=json"]);
            if (result.stdout.trim()) {
              try {
                const parsed = JSON.parse(result.stdout) as any[];
                for (const pkg of parsed) {
                  outdated.push({ name: pkg.name, current: pkg.version, latest: pkg.latest_version, wanted: pkg.latest_version, manager: "pip" });
                }
              } catch {}
            }
          } else if (pm === "poetry") {
            const result = await runProjectCommand(project.id, "poetry", ["show", "--outdated", "--no-ansi"]);
            if (result.stdout.trim()) {
              for (const line of result.stdout.trim().split("\n")) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                  outdated.push({ name: parts[0], current: parts[1], latest: parts[2], wanted: parts[2], manager: "poetry" });
                }
              }
            }
          }
        } catch {}
      }

      const result = { outdated };
      outdatedCache.set(project.id, { data: result, ts: Date.now() });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to check outdated packages" });
    }
  });

  const searchRateLimits = new Map<string, number>();
  const SEARCH_RATE_MS = 300;

  const projectInstallLocks = new Map<string, boolean>();

}
