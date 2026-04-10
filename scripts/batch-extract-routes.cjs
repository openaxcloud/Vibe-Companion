#!/usr/bin/env node
/**
 * Batch extraction script for routes.ts sections.
 * Extracts all sections from bottom to top to avoid line number shifts.
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const ROUTES_PATH = path.join(BASE, 'server', 'routes.ts');
const ROUTES_DIR = path.join(BASE, 'server', 'routes');

const SECTION_IMPORTS = `import type { Express, Request, Response, NextFunction } from "express";
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
`;

const CONTEXT_DESTRUCTURE = `  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;
`;

const CONTEXT_PASS = `{
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  }`;

function toFunctionName(sectionName) {
  // Convert kebab-case to PascalCase function name
  return 'register' + sectionName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Routes';
}

function extractSection(lines, sectionName, startLine, endLine) {
  // Extract lines (1-indexed, inclusive)
  const sectionLines = lines.slice(startLine - 1, endLine);
  const sectionCode = sectionLines.join('\n');

  const fileName = `legacy-${sectionName}.ts`;
  const outputPath = path.join(ROUTES_DIR, fileName);
  const functionName = toFunctionName(sectionName);

  const outputContent = `// AUTO-EXTRACTED from server/routes.ts (lines ${startLine}-${endLine})
// Original section: ${sectionName}
// Extracted by scripts/batch-extract-routes.cjs

${SECTION_IMPORTS}

export async function ${functionName}(app: Express, ctx: any): Promise<void> {
${CONTEXT_DESTRUCTURE}

${sectionCode}
}
`;

  fs.writeFileSync(outputPath, outputContent, 'utf8');

  // Build replacement lines for routes.ts
  const importPath = `./routes/${fileName.replace('.ts', '')}`;
  const replacement = [
    `  // EXTRACTED: ${sectionName} -> ${fileName}`,
    `  await (await import("${importPath}")).${functionName}(app, ${CONTEXT_PASS});`,
  ];

  return replacement;
}

// Define sections to extract: [name, startLine, endLine]
// These are defined in the CURRENT state of routes.ts (after AI assistant extraction)
// Ordered from BOTTOM to TOP to avoid line shift issues when processing one at a time
const SECTIONS = [
  // Bottom sections first
  ['ai-usage-tracking', 16676, 16844],
  ['ai-credential-configs', 16606, 16675],
  ['deployment-feedback', 16491, 16605],
  ['canvas', 15884, 16490],
  ['global-search', 15692, 15883],
  ['username', 15674, 15691],
  ['account-warnings', 15664, 15673],
  ['trash-soft-delete', 15632, 15663],
  ['slides-video', 14690, 15631],
  ['figma-mcp', 14340, 14689],
  ['mcp-servers', 13925, 14339],
  ['task-system', 13555, 13924],
  ['reverse-proxy', 13254, 13554],
  ['networking', 12781, 13253],
  ['skills', 12704, 12780],
  ['threads', 12617, 12703],
  ['publishing-analytics', 12516, 12616],
  ['monitoring', 12382, 12515],
  ['workflows', 12086, 12381],
  ['automations', 11791, 12085],
  ['connector-proxy', 11745, 11790],
  ['integrations', 11480, 11744],
  ['project-auth', 11403, 11479],
  ['generated-file-download', 11321, 11402],
  ['legacy-object-routes', 11221, 11320],
  ['folder-operations', 11168, 11220],
  ['bucket-object-operations', 10897, 11167],
  ['bucket-management', 10773, 10896],
  ['app-storage-objects', 10717, 10772],
  ['app-storage-kv', 10678, 10716],
  ['security-scanner', 9699, 10677],
  ['ai-commit-message', 9638, 9698],
  ['test-runner', 9443, 9637],
  ['database-viewer', 9131, 9442],
  ['websocket', 8380, 9130],
  // Upper sections
  ['workspace-runner', 7815, 8312],
  ['git-backup-recovery', 7748, 7814],
  ['github-sync', 7348, 7747],
  ['git-version-control', 7046, 7347],
  ['developer-frameworks', 6971, 7045],
  ['publish-share', 6870, 6970],
  ['demo', 6794, 6869],
  ['runs', 6398, 6793],
  ['account-env-vars', 6248, 6397],
  ['env-vars', 6110, 6247],
  ['notifications', 6027, 6109],
  ['files', 5577, 6026],
  ['projects', 5021, 5576],
  ['metrics', 4845, 5020],
  ['version-history', 4654, 4844],
  ['execution-pool-status', 4643, 4653],
  ['custom-domains', 4585, 4642],
  ['deployments', 4074, 4584],
  ['project-guests', 4020, 4073],
  ['visibility', 3997, 4019],
  ['fork-project', 3936, 3996],
  ['nix-package-search', 3898, 3935],
  ['system-dependencies', 3857, 3897],
  ['system-modules', 3816, 3856],
  ['import-guessing', 3728, 3815],
  ['package-version-lookup', 3693, 3727],
  ['package-registry-search', 3610, 3692],
  ['package-management', 2980, 3609],
  ['admin', 2824, 2959],
  ['teams', 2680, 2823],
  ['keyboard-shortcuts', 2620, 2679],
  ['profile-account', 2374, 2619],
  ['email-verification', 2343, 2373],
  ['password-reset', 2306, 2342],
  ['replit-oauth', 2239, 2305],
  ['github-oauth', 1898, 2238],
  ['usage-quotas', 1414, 1897],
  ['auth', 1281, 1413],
];

function main() {
  const content = fs.readFileSync(ROUTES_PATH, 'utf8');
  let lines = content.split('\n');
  console.log(`Starting routes.ts: ${lines.length} lines`);

  // Process sections from bottom to top to avoid line shift issues
  const sortedSections = [...SECTIONS].sort((a, b) => b[1] - a[1]);

  let processed = 0;
  let skipped = 0;

  for (const [name, startLine, endLine] of sortedSections) {
    // Validate line range
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      console.warn(`SKIP ${name}: invalid range ${startLine}-${endLine} (file has ${lines.length} lines)`);
      skipped++;
      continue;
    }

    // Check if already extracted
    const firstLine = lines[startLine - 1] || '';
    if (firstLine.includes('EXTRACTED:')) {
      console.warn(`SKIP ${name}: already extracted at line ${startLine}`);
      skipped++;
      continue;
    }

    const replacement = extractSection(lines, name, startLine, endLine);
    const linesExtracted = endLine - startLine + 1;

    // Replace in lines array
    lines = [
      ...lines.slice(0, startLine - 1),
      ...replacement,
      ...lines.slice(endLine),
    ];

    console.log(`✓ Extracted ${name}: lines ${startLine}-${endLine} (${linesExtracted} lines -> ${replacement.length} lines)`);
    processed++;
  }

  // Write updated routes.ts
  fs.writeFileSync(ROUTES_PATH, lines.join('\n'), 'utf8');
  console.log(`\nDone! Processed: ${processed}, Skipped: ${skipped}`);
  console.log(`Final routes.ts: ${lines.length} lines`);
}

main();
