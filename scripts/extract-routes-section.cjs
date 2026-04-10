#!/usr/bin/env node
/**
 * Script to extract a section from routes.ts into a separate module file.
 *
 * Usage: node scripts/extract-routes-section.js <sectionName> <startLine> <endLine>
 *
 * The section is wrapped in an async register function and saved to:
 *   server/routes/legacy-<sectionName>.ts
 *
 * The original routes.ts lines are replaced with an import + function call.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_PATH = path.join(__dirname, '..', 'server', 'routes.ts');
const ROUTES_DIR = path.join(__dirname, '..', 'server', 'routes');

// All imports from the top of routes.ts that sections might need
const SECTION_IMPORTS = `import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "../storage";
import { insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, STORAGE_PLAN_LIMITS, AGENT_MODE_COSTS, AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, AUTONOMOUS_TIER_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier, type InsertDeployment, type CheckpointStateSnapshot, insertThemeSchema, insertArtifactSchema, ARTIFACT_TYPES, type SlideData, type SlideTheme, MODEL_TOKEN_PRICING, SERVICE_CREDIT_COSTS, OVERAGE_RATE_PER_CREDIT, calculateTokenCredits, getProviderPricing } from "@shared/schema";
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
`;

const CONTEXT_INTERFACE = `
export interface RouteContext {
  app: Express;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  csrfProtection: (req: Request, res: Response, next: NextFunction) => void;
  authLimiter: any;
  apiLimiter: any;
  aiLimiter: any;
  aiGenerateLimiter: any;
  runLimiter: any;
  checkoutLimiter: any;
  errorBuffer: Array<{ timestamp: string; method: string; path: string; status: number; message: string }>;
  MAX_ERROR_BUFFER: number;
  serverStartTime: number;
  broadcastToProject: (projectId: string, data: any) => void;
  broadcastToUser: (userId: string, data: any) => void;
  wsClients: Map<string, Set<WebSocket>>;
  wsUserClients: Map<string, Set<WebSocket>>;
  verifyProjectAccess: (projectId: string, userId: string) => Promise<boolean>;
  verifyRecaptcha: (token: string | undefined) => Promise<boolean>;
  qstr: (val: unknown) => string;
  safeError: (err: any, fallback: string) => string;
  sanitizeAIFileContent: (content: string) => string;
  validateExternalUrl: (urlStr: string, allowedDomainSuffixes?: string[]) => { valid: boolean; url?: URL; error?: string };
  getAppUrl: () => string;
  generateCsrfToken: () => string;
  sessionMiddleware: any;
  httpServer: Server;
}
`;

function extractSection(sectionName, startLine, endLine) {
  const content = fs.readFileSync(ROUTES_PATH, 'utf8');
  const lines = content.split('\n');

  console.log(`Total lines in routes.ts: ${lines.length}`);
  console.log(`Extracting lines ${startLine}-${endLine} (${endLine - startLine + 1} lines)`);

  // Extract the section (1-indexed, inclusive)
  const sectionLines = lines.slice(startLine - 1, endLine);
  const sectionCode = sectionLines.join('\n');

  // Create the output file
  const outputFileName = `legacy-${sectionName}.ts`;
  const outputPath = path.join(ROUTES_DIR, outputFileName);

  const functionName = `register${sectionName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Routes`;

  const outputContent = `// AUTO-EXTRACTED from server/routes.ts (lines ${startLine}-${endLine})
// Original section: ${sectionName}
// DO NOT manually edit this file - it was extracted by scripts/extract-routes-section.js

${SECTION_IMPORTS}

${CONTEXT_INTERFACE}

export async function ${functionName}(app: Express, ctx: RouteContext): Promise<void> {
  const {
    requireAuth,
    csrfProtection,
    authLimiter,
    apiLimiter,
    aiLimiter,
    aiGenerateLimiter,
    runLimiter,
    checkoutLimiter,
    errorBuffer,
    MAX_ERROR_BUFFER,
    serverStartTime,
    broadcastToProject,
    broadcastToUser,
    wsClients,
    wsUserClients,
    verifyProjectAccess,
    verifyRecaptcha,
    qstr,
    safeError,
    sanitizeAIFileContent,
    validateExternalUrl,
    getAppUrl,
    generateCsrfToken,
    sessionMiddleware,
    httpServer,
  } = ctx;
  const path = path_;

${sectionCode}
}
`;

  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log(`Written: ${outputPath} (${outputContent.split('\n').length} lines)`);

  // Replace the section in routes.ts with an import + call
  const importStatement = `  // EXTRACTED: ${sectionName} -> ${outputFileName}`;
  const callStatement = `  await (await import("./routes/${outputFileName.replace('.ts', '')}")).${functionName}(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
    app,
  });`;

  const replacementLines = [
    importStatement,
    callStatement,
  ];

  // Replace section in routes.ts
  const newLines = [
    ...lines.slice(0, startLine - 1),
    ...replacementLines,
    ...lines.slice(endLine),
  ];

  fs.writeFileSync(ROUTES_PATH, newLines.join('\n'), 'utf8');
  console.log(`Updated routes.ts: replaced ${endLine - startLine + 1} lines with ${replacementLines.length} lines`);
  console.log(`New routes.ts line count: ${newLines.length}`);
}

// Parse command line args
const [,, sectionName, startLineStr, endLineStr] = process.argv;
if (!sectionName || !startLineStr || !endLineStr) {
  console.error('Usage: node extract-routes-section.js <sectionName> <startLine> <endLine>');
  process.exit(1);
}

extractSection(sectionName, parseInt(startLineStr), parseInt(endLineStr));
