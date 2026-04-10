// AUTO-EXTRACTED from server/routes.ts (lines 9443-9637)
// Original section: test-runner
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


export async function registerTestRunnerRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ============ TEST RUNNER ============
  app.get("/api/projects/:id/tests/detect", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const files = await storage.getFiles(req.params.id);
      const testPatterns = [
        /\.test\.[jt]sx?$/,
        /\.spec\.[jt]sx?$/,
        /test_.*\.py$/,
        /.*_test\.py$/,
        /.*_test\.go$/,
        /Test\.java$/,
        /\.test\.ts$/,
      ];

      const testFiles = files
        .filter((f) => testPatterns.some((p) => p.test(f.filename)))
        .map((f) => f.filename);

      let framework = "none";
      const projectConfig = await getProjectConfig(req.params.id);
      if (projectConfig.unitTest?.language) {
        const unitLang = projectConfig.unitTest.language;
        if (unitLang === "python") framework = "pytest";
        else if (unitLang === "javascript" || unitLang === "nodejs") framework = "jest";
        else if (unitLang === "typescript") framework = "vitest";
        else framework = unitLang;
      } else {
        const hasPackageJson = files.find((f) => f.filename === "package.json");
        if (hasPackageJson) {
          try {
            const pkg = JSON.parse(hasPackageJson.content || "{}");
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (allDeps.jest || allDeps["@jest/core"]) framework = "jest";
            else if (allDeps.vitest) framework = "vitest";
            else if (allDeps.mocha) framework = "mocha";
            else if (allDeps["@testing-library/react"]) framework = "testing-library";
            else framework = "node:test";
          } catch {}
        } else if (files.some((f) => f.filename.endsWith(".py"))) {
          framework = "pytest";
        }
      }

      res.json({ files: testFiles, framework });
    } catch (err: any) {
      res.status(500).json({ error: safeError(err, "Failed to discover tests") });
    }
  });

  app.post("/api/projects/:id/tests/run", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectWriteAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const files = await storage.getFiles(req.params.id);
      const { file } = req.body;

      const testPatterns = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /test_.*\.py$/, /.*_test\.py$/];
      const testFiles = file
        ? files.filter((f) => f.filename === file)
        : files.filter((f) => testPatterns.some((p) => p.test(f.filename)));

      if (testFiles.length === 0) {
        return res.json({ suites: [], output: "No test files found." });
      }

      const suites: any[] = [];
      let fullOutput = "";

      for (const tf of testFiles) {
        const content = tf.content || "";
        const isJs = /\.[jt]sx?$/.test(tf.filename);
        const isPy = /\.py$/.test(tf.filename);

        try {
          let testCode: string;
          if (isJs) {
            testCode = `
const startTime = Date.now();
const results = [];
function describe(name, fn) { fn(); }
function it(name, fn) { test(name, fn); }
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); results.push({ name, status: "pass", duration: Date.now() - t0 }); }
  catch(e) { results.push({ name, status: "fail", duration: Date.now() - t0, error: e.message }); }
}
function expect(v) {
  return {
    toBe(e) { if (v !== e) throw new Error(\`Expected \${JSON.stringify(e)} but got \${JSON.stringify(v)}\`); },
    toEqual(e) { if (JSON.stringify(v) !== JSON.stringify(e)) throw new Error(\`Expected \${JSON.stringify(e)} but got \${JSON.stringify(v)}\`); },
    toBeTruthy() { if (!v) throw new Error(\`Expected truthy but got \${JSON.stringify(v)}\`); },
    toBeFalsy() { if (v) throw new Error(\`Expected falsy but got \${JSON.stringify(v)}\`); },
    toContain(e) { if (!v.includes(e)) throw new Error(\`Expected to contain \${JSON.stringify(e)}\`); },
    toThrow(msg) { try { v(); throw new Error("Expected to throw"); } catch(e) { if (msg && !e.message.includes(msg)) throw new Error(\`Expected throw message to contain "\${msg}"\`); } },
    toBeGreaterThan(e) { if (!(v > e)) throw new Error(\`Expected \${v} > \${e}\`); },
    toBeLessThan(e) { if (!(v < e)) throw new Error(\`Expected \${v} < \${e}\`); },
    toBeNull() { if (v !== null) throw new Error(\`Expected null but got \${JSON.stringify(v)}\`); },
    toBeUndefined() { if (v !== undefined) throw new Error(\`Expected undefined but got \${JSON.stringify(v)}\`); },
    toBeDefined() { if (v === undefined) throw new Error("Expected defined but got undefined"); },
    not: {
      toBe(e) { if (v === e) throw new Error(\`Expected not \${JSON.stringify(e)}\`); },
      toEqual(e) { if (JSON.stringify(v) === JSON.stringify(e)) throw new Error(\`Expected not \${JSON.stringify(e)}\`); },
      toBeTruthy() { if (v) throw new Error("Expected falsy"); },
      toBeNull() { if (v === null) throw new Error("Expected not null"); },
    }
  };
}
${content}
console.log(JSON.stringify({ results, duration: Date.now() - startTime }));`;
          } else if (isPy) {
            testCode = content + `
import json, time, sys, unittest, io
loader = unittest.TestLoader()
suite_obj = loader.loadTestsFromModule(sys.modules[__name__])
stream = io.StringIO()
runner = unittest.TextTestRunner(stream=stream, verbosity=2)
t0 = time.time()
result = runner.run(suite_obj)
dur = int((time.time()-t0)*1000)
tests = []
for t,_ in result.failures: tests.append({"name":str(t),"status":"fail","error":_})
for t,_ in result.errors: tests.append({"name":str(t),"status":"fail","error":_})
for t in result.successes if hasattr(result,'successes') else []: tests.append({"name":str(t),"status":"pass"})
run_count = result.testsRun
pass_count = run_count - len(result.failures) - len(result.errors)
if not tests:
    for i in range(pass_count): tests.append({"name":f"test_{i+1}","status":"pass"})
print(json.dumps({"results":tests,"duration":dur}))`;
          } else {
            continue;
          }

          const lang = isJs ? (tf.filename.endsWith(".ts") || tf.filename.endsWith(".tsx") ? "typescript" : "javascript") : "python";
          const testEnvVars: Record<string, string> = {};
          const testProjectEnvVars = await storage.getProjectEnvVars(project.id);
          for (const ev of testProjectEnvVars) {
            testEnvVars[ev.key] = decrypt(ev.encryptedValue);
          }
          const testLinkedVars = await storage.getAccountEnvVarLinks(project.id);
          for (const link of testLinkedVars) {
            if (!(link.key in testEnvVars)) {
              testEnvVars[link.key] = decrypt(link.encryptedValue);
            }
          }
          testEnvVars["REPLIT_DOMAINS"] = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost";
          const testUser = await storage.getUser(userId);
          testEnvVars["REPLIT_USER"] = testUser?.displayName || testUser?.email || userId;
          const result = await executeCode(testCode, lang, undefined, undefined, undefined, testEnvVars);
          fullOutput += `--- ${tf.filename} ---\n${result.stdout || ""}${result.stderr ? "\n" + result.stderr : ""}\n\n`;

          try {
            const lines = (result.stdout || "").trim().split("\n");
            const lastLine = lines[lines.length - 1];
            const parsed = JSON.parse(lastLine);
            const tests = parsed.results || [];
            suites.push({
              file: tf.filename,
              tests,
              passed: tests.filter((t: any) => t.status === "pass").length,
              failed: tests.filter((t: any) => t.status === "fail").length,
              skipped: tests.filter((t: any) => t.status === "skip").length,
              duration: parsed.duration || 0,
            });
          } catch {
            suites.push({
              file: tf.filename,
              tests: [{ name: tf.filename, status: result.exitCode === 0 ? "pass" : "fail", error: result.stderr || undefined }],
              passed: result.exitCode === 0 ? 1 : 0,
              failed: result.exitCode === 0 ? 0 : 1,
              skipped: 0,
              duration: 0,
            });
          }
        } catch (err: any) {
          suites.push({
            file: tf.filename,
            tests: [{ name: tf.filename, status: "fail", error: err.message }],
            passed: 0, failed: 1, skipped: 0, duration: 0,
          });
          fullOutput += `--- ${tf.filename} ---\nError: ${err.message}\n\n`;
        }
      }

      res.json({ suites, output: fullOutput });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

}
