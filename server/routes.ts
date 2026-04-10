// DEPRECATED: This monolithic file is being migrated to server/routes/ modules.
// New routes should be added to the appropriate file under server/routes/ instead.
// See server/routes/index.ts for the MainRouter that aggregates modular route files.
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";

/** Safely extract a query parameter as string, handling ParsedQs union type */
function qstr(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return String(val[0] ?? '');
  return '';
}

import bcrypt from "bcryptjs";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import compression from "compression";
import { storage } from "./storage";
import { insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, STORAGE_PLAN_LIMITS, AGENT_MODE_COSTS, AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, AUTONOMOUS_TIER_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier, type InsertDeployment, type CheckpointStateSnapshot, insertThemeSchema, insertArtifactSchema, ARTIFACT_TYPES, type SlideData, type SlideTheme, MODEL_TOKEN_PRICING, SERVICE_CREDIT_COSTS, OVERAGE_RATE_PER_CREDIT, calculateTokenCredits, getProviderPricing } from "@shared/schema";
import type PptxGenJS from "pptxgenjs";
import { decrypt, encrypt } from "./encryption";
import { z } from "zod";
import { executeCode, sendStdinToProcess, killInteractiveProcess, resolveRunCommand } from "./executor";
import { getProjectConfig, parseReplitConfig, serializeReplitConfig, getEnvironmentMetadata, type ReplitConfig } from "./configParser";
import { parseReplitNix, serializeReplitNix } from "./nixParser";
import { executionPool } from "./executionPool";
import { getOrCreateTerminal, createTerminalSession, resizeTerminal, listTerminalSessions, destroyTerminalSession, setSessionSelected, updateLastCommand, updateLastActivity, materializeProjectFiles as materializeTerminalFiles, getProjectWorkspaceDir, invalidateProjectWorkspace, syncFileToWorkspace, deleteFileFromWorkspace, renameFileInWorkspace, listWorkspaceFiles, destroyProjectTerminals } from "./terminal";
import { createDebugSession, connectToInspector, handleDebugCommand, getDebugSession, cleanupSession, getInspectPort } from "./debugger";
import { log } from "./index";
import { sendPasswordResetEmail, sendVerificationEmail, sendTeamInviteEmail, isEmailConfigured } from "./email";
import { buildAndDeploy, buildAndDeployMultiArtifact, createDeploymentRouter, rollbackDeployment, listDeploymentVersions, teardownDeployment, performHealthCheck, getProcessLogs, getProcessStatus, stopManagedProcess, restartManagedProcess, shutdownAllProcesses, cleanupProjectProcesses, setProcessLogCallback } from "./deploymentEngine";
import { getProcessInfo } from "./processManager";
import type { DeploymentType } from "./deploymentEngine";
import { incrementRequests, incrementErrors, recordResponseTime, getAndResetCounters, getRealMetrics } from "./metricsCollector";
import { DEFAULT_SHORTCUTS, isValidShortcutValue, findConflict, mergeWithDefaults } from "@shared/keyboardShortcuts";
import { createCheckpoint, restoreCheckpoint, getCheckpointDiff } from "./checkpointService";
import { triggerBackupAsync, createBackup, restoreFromBackup, getBackupStatus, verifyBackupIntegrity } from "./gitBackupService";
import { addDomain, verifyDomain, removeDomain, getProjectDomains, getDomainById, getACMEChallengeResponse } from "./domainManager";
import {
  checkUserRateLimit,
  checkIpRateLimit,
  acquireExecutionSlot,
  releaseExecutionSlot,
  recordExecution,
  getExecutionMetrics,
  getSystemMetrics,
  getClientIp,
} from "./rateLimiter";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, Type, type FunctionDeclaration, type Tool, type Content } from "@google/genai";
import { diffArrays } from "diff";
import multer from "multer";
import * as runnerClient from "./runnerClient";
import * as github from "./github";
import * as gitService from "./git";
import { getConnectorKey, getSupportedConnectors, getConnectorOperations, executeConnectorOperation, getConnectorDescription } from "./connectors";
import path, { posix as pathPosix } from "path";
import { generateImageBuffer, editImages } from "./replit_integrations/image/client";
import { registerImageRoutes } from "./replit_integrations/image";
import { searchBraveImages, BRAVE_CREDIT_COST, generateSpeech, AVAILABLE_VOICES, TTS_CREDIT_COST, generateNanoBananaImage, NANOBANANA_CREDIT_COST, generateDalleImage, DALLE_CREDIT_COST, searchTavily, TAVILY_CREDIT_COST } from "./agentServices";
import { generateFile, getMimeType, type FileGenerationInput, type FileSection } from "./fileGeneration";
let PDFDocument: any = null;
try { PDFDocument = require("pdfkit"); } catch { /* optional dependency */ }
import * as fs from "fs";
import { importFromGitHub, importFromZip, importFromFigma, importFromVercel, importFromBolt, importFromLovable, validateImportSource, startAsyncImport, startAsyncZipImport, getImportJob, validateZipBuffer, fetchFigmaDesignContext } from "./importService";
import { handleLSPConnection } from "./lspBridge";

/** Sanitize error messages to avoid leaking internal details (DB schema, connection strings, API keys) */
function safeError(err: any, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err || "");
  // Block messages containing connection strings, SQL internals, or API keys
  const sensitive = /password|connection|ECONNREFUSED|ENOTFOUND|at\s+\S+\.\w+\s+\(|SELECT |INSERT |UPDATE |DELETE |pg_|sk-[a-zA-Z0-9]/i;
  if (sensitive.test(msg)) return fallback;
  // Truncate to prevent oversized error responses
  return msg.slice(0, 200) || fallback;
}

async function loadCommitHistoryForRepo(projectId: string) {
  const dbCommits = await storage.getCommits(projectId);
  if (dbCommits.length === 0) return undefined;

  const authorCache = new Map<string, { name: string; email: string }>();
  const results = [];
  for (const c of dbCommits) {
    let authorInfo = authorCache.get(c.authorId);
    if (!authorInfo) {
      const user = await storage.getUser(c.authorId);
      authorInfo = {
        name: user?.displayName || user?.email || "User",
        email: user?.email || "user@ide.local",
      };
      authorCache.set(c.authorId, authorInfo);
    }
    results.push({
      message: c.message,
      authorName: authorInfo.name,
      authorEmail: authorInfo.email,
      snapshot: c.snapshot as Record<string, string>,
      branchName: c.branchName,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    });
  }
  return results;
}

async function ensureRepoWithPersistence(
  projectId: string,
  files: Array<{ filename: string; content: string }>
): Promise<{ recovered?: boolean }> {
  let recovered = false;
  const dbPackedState = await storage.getGitRepoState(projectId);
  const commitHistory = dbPackedState ? undefined : await loadCommitHistoryForRepo(projectId);

  try {
    await gitService.ensureRepo(projectId, files, { commitHistory, dbPackedState });
    if (gitService.isRepoInitialized(projectId)) {
      try {
        await gitService.getLog(projectId, undefined, 1);
      } catch {
        throw new Error("Git repo corruption detected");
      }
    }
  } catch (err) {
    console.error(`[git-recovery] Corruption detected for project ${projectId}, attempting restore...`);
    const restoredFromBackup = await restoreFromBackup(projectId);
    if (restoredFromBackup) {
      let verified = false;
      try {
        await gitService.getLog(projectId, undefined, 1);
        verified = true;
      } catch {}
      if (verified) {
        console.log(`[git-recovery] Restored and verified from backup for project ${projectId}`);
        recovered = true;
        broadcastToProject(projectId, { type: "git_recovery", message: "Repository automatically restored from backup" });
      } else {
        console.warn(`[git-recovery] Backup restore failed verification for project ${projectId}, trying fallback...`);
      }
    }
    if (!recovered && dbPackedState) {
      try {
        gitService.restoreGitStateFromPack(projectId, dbPackedState);
        let fallbackVerified = false;
        try {
          await gitService.getLog(projectId, undefined, 1);
          fallbackVerified = true;
        } catch {}
        if (fallbackVerified) {
          console.log(`[git-recovery] Restored and verified from git_repo_state for project ${projectId}`);
          recovered = true;
          broadcastToProject(projectId, { type: "git_recovery", message: "Repository automatically restored from saved state" });
        } else {
          console.warn(`[git-recovery] git_repo_state restore failed verification for project ${projectId}, reinitializing...`);
          await gitService.ensureRepo(projectId, files, {});
          recovered = true;
        }
      } catch {
        await gitService.ensureRepo(projectId, files, {});
        recovered = true;
      }
    } else if (!recovered) {
      await gitService.ensureRepo(projectId, files, { commitHistory });
      recovered = true;
    }
  }

  return { recovered };
}

async function persistRepoState(projectId: string, backupTrigger?: "commit" | "deploy" | "agent" | "manual") {
  const packed = gitService.getSerializedGitState(projectId);
  if (packed) {
    await storage.saveGitRepoState(projectId, packed);
    if (backupTrigger) {
      triggerBackupAsync(projectId, backupTrigger);
    }
  }
}
import { getTemplateById, getAllTemplates } from "./templates";
import { generateEcodeContent, getEcodeFilename, buildProjectStructureTree, detectDependencies, detectDependenciesFromPackageJson, parseUserPreferences, parseProjectContext, updateEcodeStructureSection, buildEcodePromptContext, shouldAutoUpdate } from "./ecodeTemplates";
import {
  addCollaborator,
  removeCollaborator,
  getCollaborators,
  updateActiveFile,
  broadcastToCollaborators,
  broadcastPresence,
  getOrCreateFileDoc,
  initializeFileDoc,
  getFileDocContent,
  broadcastBinaryToCollaborators,
  setFilePersister,
  type CollabMessage,
  Y,
} from "./collaboration";
import { MainRouter } from "./routes/index";

function validateExternalUrl(urlStr: string, allowedDomainSuffixes?: string[]): { valid: boolean; url?: URL; error?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
  if (url.protocol !== "https:") {
    return { valid: false, error: "URL must use HTTPS" };
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" ||
      host === "[::1]" || host === "[::]" ||
      host.startsWith("10.") || host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host === "metadata.google.internal" || host === "169.254.169.254") {
    return { valid: false, error: "URL must not point to internal/private hosts" };
  }
  if (allowedDomainSuffixes && allowedDomainSuffixes.length > 0) {
    if (!allowedDomainSuffixes.some(suffix => host === suffix || host.endsWith("." + suffix))) {
      return { valid: false, error: `URL domain must be one of: ${allowedDomainSuffixes.join(", ")}` };
    }
  }
  return { valid: true, url };
}

async function testIntegrationConnection(
  serviceName: string,
  config: Record<string, string>,
): Promise<{ success: boolean; message: string; noLiveTest?: boolean }> {
  const timeout = 8000;
  try {
    switch (serviceName) {
      case "OpenAI": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "API key valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": config.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "API key valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Perplexity AI": {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
          signal: AbortSignal.timeout(timeout),
        });
        return res.status !== 401 ? { success: true, message: "API key accepted" } : { success: false, message: "Invalid API key" };
      }
      case "Mistral AI": {
        const res = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${config.MISTRAL_API_KEY}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "API key valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Notion": {
        const res = await fetch("https://api.notion.com/v1/users/me", {
          headers: { Authorization: `Bearer ${config.NOTION_API_KEY}`, "Notion-Version": "2022-06-28" },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Connected to Notion workspace" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Linear": {
        const res = await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: { Authorization: config.LINEAR_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ viewer { id name } }" }),
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Connected to Linear" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Slack": {
        const res = await fetch("https://slack.com/api/auth.test", {
          headers: { Authorization: `Bearer ${config.SLACK_BOT_TOKEN}` },
          signal: AbortSignal.timeout(timeout),
        });
        const slackData: { ok?: boolean; user?: string; error?: string } = await res.json();
        return slackData.ok ? { success: true, message: `Connected as ${slackData.user || "bot"}` } : { success: false, message: slackData.error || "Auth failed" };
      }
      case "Discord": {
        const res = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Bot token valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Telegram": {
        const res = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getMe`, {
          signal: AbortSignal.timeout(timeout),
        });
        const tgData: { ok?: boolean; result?: { username?: string } } = await res.json();
        return tgData.ok ? { success: true, message: `Bot: @${tgData.result?.username}` } : { success: false, message: "Invalid bot token" };
      }
      case "HubSpot": {
        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
          headers: { Authorization: `Bearer ${config.HUBSPOT_ACCESS_TOKEN}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Access token valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Spotify": {
        const basic = Buffer.from(`${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`).toString("base64");
        const res = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: "grant_type=client_credentials",
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Client credentials valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "SendGrid": {
        const res = await fetch("https://api.sendgrid.com/v3/scopes", {
          headers: { Authorization: `Bearer ${config.SENDGRID_API_KEY}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "API key valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "GitHub": {
        const res = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${config.GITHUB_TOKEN}`, "User-Agent": "E-Code-IDE" },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Token valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Stripe": {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripeClient = await getUncachableStripeClient();
          const balance = await stripeClient.balance.retrieve();
          return { success: true, message: `Connected (${balance.available?.length || 0} currencies)` };
        } catch (err: any) {
          if (config.STRIPE_SECRET_KEY) {
            const res = await fetch("https://api.stripe.com/v1/balance", {
              headers: { Authorization: `Bearer ${config.STRIPE_SECRET_KEY}` },
              signal: AbortSignal.timeout(timeout),
            });
            return res.ok ? { success: true, message: "API key valid" } : { success: false, message: `HTTP ${res.status}` };
          }
          return { success: false, message: err.message || "Stripe not configured" };
        }
      }
      case "Jira": {
        if (!config.JIRA_BASE_URL || !config.JIRA_API_TOKEN || !config.JIRA_EMAIL) {
          return { success: false, message: "Missing JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN" };
        }
        const jiraValidation = validateExternalUrl(config.JIRA_BASE_URL, ["atlassian.net", "jira.com"]);
        if (!jiraValidation.valid) {
          return { success: false, message: `JIRA_BASE_URL: ${jiraValidation.error}` };
        }
        const jiraBasic = Buffer.from(`${config.JIRA_EMAIL}:${config.JIRA_API_TOKEN}`).toString("base64");
        const res = await fetch(`${jiraValidation.url!.origin}/rest/api/3/myself`, {
          headers: { Authorization: `Basic ${jiraBasic}`, Accept: "application/json" },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Jira credentials valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "WhatsApp": {
        if (!config.WHATSAPP_API_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
          return { success: false, message: "Missing API token or phone number ID" };
        }
        if (!/^\d+$/.test(config.WHATSAPP_PHONE_NUMBER_ID)) {
          return { success: false, message: "Invalid phone number ID format (expected numeric)" };
        }
        const res = await fetch(`https://graph.facebook.com/v18.0/${encodeURIComponent(config.WHATSAPP_PHONE_NUMBER_ID)}`, {
          headers: { Authorization: `Bearer ${config.WHATSAPP_API_TOKEN}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "WhatsApp API token valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Microsoft Outlook": {
        if (!config.MICROSOFT_CLIENT_ID || !config.MICROSOFT_CLIENT_SECRET || !config.MICROSOFT_TENANT_ID) {
          return { success: false, message: "Missing client ID, client secret, or tenant ID" };
        }
        if (!/^[a-zA-Z0-9-]+$/.test(config.MICROSOFT_TENANT_ID)) {
          return { success: false, message: "Invalid tenant ID format (expected UUID or domain)" };
        }
        const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.MICROSOFT_TENANT_ID)}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `client_id=${encodeURIComponent(config.MICROSOFT_CLIENT_ID)}&client_secret=${encodeURIComponent(config.MICROSOFT_CLIENT_SECRET)}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default&grant_type=client_credentials`,
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Microsoft Graph credentials valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Google Sheets":
      case "Google Calendar": {
        if (!config.GOOGLE_SERVICE_ACCOUNT_KEY) {
          return { success: false, message: "Missing service account key" };
        }
        try {
          const parsed = JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_KEY);
          if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
            return { success: false, message: "Service account key missing required fields (client_email, private_key, project_id)" };
          }
          if (!parsed.client_email.endsWith(".iam.gserviceaccount.com")) {
            return { success: false, message: "Invalid service account email format" };
          }
          if (!parsed.private_key.startsWith("-----BEGIN")) {
            return { success: false, message: "Invalid private key format" };
          }
          const googleScope = serviceName === "Google Calendar"
            ? "https://www.googleapis.com/auth/calendar.readonly"
            : "https://www.googleapis.com/auth/spreadsheets.readonly";
          const jwtHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
          const now = Math.floor(Date.now() / 1000);
          const jwtClaim = Buffer.from(JSON.stringify({
            iss: parsed.client_email,
            scope: googleScope,
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 300,
            iat: now,
          })).toString("base64url");
          try {
            const cryptoMod = await import("crypto");
            const sign = cryptoMod.createSign("RSA-SHA256");
            sign.update(`${jwtHeader}.${jwtClaim}`);
            const signature = sign.sign(parsed.private_key, "base64url");
            const jwt = `${jwtHeader}.${jwtClaim}.${signature}`;
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
              signal: AbortSignal.timeout(timeout),
            });
            if (tokenRes.ok) {
              return { success: true, message: `Authenticated as ${parsed.client_email}` };
            }
            const tokenErr: { error_description?: string } = await tokenRes.json().catch(() => ({}));
            return { success: false, message: `Token exchange failed: ${tokenErr.error_description || tokenRes.status}` };
          } catch (signErr: any) {
            return { success: false, message: `JWT signing failed: ${signErr.message?.slice(0, 80) || "Unknown error"}` };
          }
        } catch {
          return { success: false, message: "Service account key is not valid JSON" };
        }
      }
      case "Twilio": {
        if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
          return { success: false, message: "Missing account SID or auth token" };
        }
        const twilioBasic = Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString("base64");
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}.json`, {
          headers: { Authorization: `Basic ${twilioBasic}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: "Twilio credentials valid" } : { success: false, message: `HTTP ${res.status}` };
      }
      case "PostgreSQL": {
        if (!config.DATABASE_URL) return { success: false, message: "Missing DATABASE_URL" };
        if (!config.DATABASE_URL.startsWith("postgres")) {
          return { success: false, message: "Invalid PostgreSQL connection string format" };
        }
        try {
          const pgUrl = new URL(config.DATABASE_URL);
          if (!pgUrl.hostname) return { success: false, message: "Missing hostname in DATABASE_URL" };
          const pgHost = pgUrl.hostname.toLowerCase();
          if (pgHost === "localhost" || pgHost === "127.0.0.1" || pgHost === "0.0.0.0" ||
              pgHost === "[::1]" || pgHost === "[::]" ||
              pgHost.startsWith("10.") || pgHost.startsWith("192.168.") ||
              /^172\.(1[6-9]|2\d|3[01])\./.test(pgHost) ||
              pgHost.endsWith(".local") || pgHost.endsWith(".internal") ||
              pgHost === "metadata.google.internal" || pgHost === "169.254.169.254") {
            return { success: false, message: "DATABASE_URL must not point to internal/private hosts" };
          }
          const { Client } = await import("pg");
          const client = new Client({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: timeout - 1000 });
          await client.connect();
          await client.query("SELECT 1");
          await client.end();
          return { success: true, message: `Connected to ${pgUrl.hostname}/${pgUrl.pathname.slice(1) || "default"}` };
        } catch (pgErr: any) {
          return { success: false, message: `Connection failed: ${pgErr.message?.slice(0, 100) || "Unknown error"}` };
        }
      }
      case "Redis": {
        if (!config.REDIS_URL) return { success: false, message: "Missing REDIS_URL" };
        if (!config.REDIS_URL.startsWith("redis")) {
          return { success: false, message: "Invalid Redis connection string format" };
        }
        try {
          const redisUrl = new URL(config.REDIS_URL);
          if (!redisUrl.hostname) return { success: false, message: "Missing hostname in REDIS_URL" };
          const redisHost = redisUrl.hostname.toLowerCase();
          if (redisHost === "localhost" || redisHost === "127.0.0.1" || redisHost === "0.0.0.0" ||
              redisHost === "[::1]" || redisHost === "[::]" ||
              redisHost.startsWith("10.") || redisHost.startsWith("192.168.") ||
              /^172\.(1[6-9]|2\d|3[01])\./.test(redisHost) ||
              redisHost.endsWith(".local") || redisHost.endsWith(".internal") ||
              redisHost === "169.254.169.254") {
            return { success: false, message: "REDIS_URL must not point to internal/private hosts" };
          }
          const redisPort = parseInt(redisUrl.port || "6379", 10);
          const net = await import("net");
          const dnsModule = await import("dns/promises");
          const resolvedIps = await dnsModule.resolve4(redisUrl.hostname).catch(() => []);
          const blockedIp = resolvedIps.find((ip: string) =>
            ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.") ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === "0.0.0.0" || ip === "169.254.169.254"
          );
          if (blockedIp) return { success: false, message: `REDIS_URL resolves to private/internal IP (${blockedIp})` };
          const tcpResult = await new Promise<{ success: boolean; message: string }>((resolve) => {
            const socket = new net.Socket();
            const connTimeout = Math.min(timeout - 1000, 5000);
            socket.setTimeout(connTimeout);
            socket.connect(redisPort, redisUrl.hostname, () => {
              const password = redisUrl.password;
              if (password) {
                socket.write(`AUTH ${password}\r\n`);
                socket.once("data", (data) => {
                  const response = data.toString().trim();
                  if (response.startsWith("-")) {
                    socket.destroy();
                    resolve({ success: false, message: `Connected to ${redisUrl.hostname}:${redisPort} — authentication failed: ${response.slice(1, 80)}` });
                    return;
                  }
                  socket.write("PING\r\n");
                  socket.once("data", (pingData) => {
                    const pingResponse = pingData.toString().trim();
                    socket.destroy();
                    resolve({ success: pingResponse.includes("PONG"), message: pingResponse.includes("PONG")
                      ? `Connected to ${redisUrl.hostname}:${redisPort} — authenticated, PING/PONG OK`
                      : `Connected to ${redisUrl.hostname}:${redisPort} — auth accepted but PING failed: ${pingResponse.slice(0, 80)}` });
                  });
                });
              } else {
                socket.write("PING\r\n");
                socket.once("data", (data) => {
                  const response = data.toString().trim();
                  socket.destroy();
                  if (response.includes("PONG")) {
                    resolve({ success: true, message: `Connected to ${redisUrl.hostname}:${redisPort} — PING/PONG OK (no auth required)` });
                  } else if (response.includes("NOAUTH")) {
                    resolve({ success: false, message: `Connected to ${redisUrl.hostname}:${redisPort} — server requires authentication (NOAUTH)` });
                  } else {
                    resolve({ success: false, message: `Connected to ${redisUrl.hostname}:${redisPort} — unexpected response: ${response.slice(0, 80)}` });
                  }
                });
              }
            });
            socket.on("timeout", () => { socket.destroy(); resolve({ success: false, message: `Connection to ${redisUrl.hostname}:${redisPort} timed out after ${connTimeout}ms` }); });
            socket.on("error", (err: any) => { socket.destroy(); resolve({ success: false, message: `Connection failed: ${err.message?.slice(0, 100) || "Unknown error"}` }); });
          });
          return tcpResult;
        } catch (err: any) {
          return { success: false, message: `Redis connection error: ${err.message?.slice(0, 100) || "Invalid REDIS_URL format"}` };
        }
      }
      case "MongoDB": {
        if (!config.MONGODB_URI) return { success: false, message: "Missing MONGODB_URI" };
        if (!config.MONGODB_URI.startsWith("mongodb")) {
          return { success: false, message: "Invalid MongoDB connection string format" };
        }
        try {
          const mongoUrl = new URL(config.MONGODB_URI.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
          if (!mongoUrl.hostname) return { success: false, message: "Missing hostname in MONGODB_URI" };
          const mongoHost = mongoUrl.hostname.toLowerCase();
          if (mongoHost === "localhost" || mongoHost === "127.0.0.1" || mongoHost === "0.0.0.0" ||
              mongoHost === "[::1]" || mongoHost === "[::]" ||
              mongoHost.startsWith("10.") || mongoHost.startsWith("192.168.") ||
              /^172\.(1[6-9]|2\d|3[01])\./.test(mongoHost) ||
              mongoHost.endsWith(".local") || mongoHost.endsWith(".internal") ||
              mongoHost === "169.254.169.254") {
            return { success: false, message: "MONGODB_URI must not point to internal/private hosts" };
          }
          if (!mongoUrl.username) return { success: false, message: "Missing username in MONGODB_URI" };
          const net = await import("net");
          const dnsModule = await import("dns/promises");
          const isPrivateIp = (ip: string) =>
            ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.") ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === "0.0.0.0" || ip === "169.254.169.254";
          async function tcpProbe(host: string, port: number, connTimeout: number): Promise<{ success: boolean; message: string }> {
            const resolvedIps = await dnsModule.resolve4(host).catch(() => []);
            const blockedIp = resolvedIps.find((ip: string) => isPrivateIp(ip));
            if (blockedIp) return { success: false, message: `${host} resolves to private/internal IP (${blockedIp})` };
            return new Promise((resolve) => {
              const socket = new net.Socket();
              socket.setTimeout(connTimeout);
              socket.connect(port, host, () => { socket.destroy(); resolve({ success: true, message: `${host}:${port} — TCP reachable` }); });
              socket.on("timeout", () => { socket.destroy(); resolve({ success: false, message: `${host}:${port} timed out` }); });
              socket.on("error", (err: any) => { socket.destroy(); resolve({ success: false, message: `${host}:${port} — ${err.message?.slice(0, 80) || "error"}` }); });
            });
          }
          const connTimeout = Math.min(timeout - 1000, 5000);
          const isSrv = config.MONGODB_URI.startsWith("mongodb+srv://");
          if (isSrv) {
            try {
              const srvRecords = await dnsModule.resolveSrv(`_mongodb._tcp.${mongoHost}`);
              if (srvRecords.length === 0) return { success: false, message: `SRV lookup for ${mongoHost} returned no records` };
              const primarySrv = srvRecords[0];
              const probeResult = await tcpProbe(primarySrv.name, primarySrv.port, connTimeout);
              if (probeResult.success) {
                return { success: true, message: `SRV resolved: ${srvRecords.length} host(s) for ${mongoHost}. TCP verified on ${primarySrv.name}:${primarySrv.port}` };
              }
              return { success: false, message: `SRV resolved (${srvRecords.length} hosts) but TCP probe failed: ${probeResult.message}` };
            } catch (srvErr: any) {
              return { success: false, message: `SRV lookup failed for ${mongoHost}: ${srvErr.message?.slice(0, 100)}` };
            }
          }
          const mongoPort = parseInt(mongoUrl.port || "27017", 10);
          const probeResult = await tcpProbe(mongoUrl.hostname, mongoPort, connTimeout);
          return { success: probeResult.success, message: probeResult.success
            ? `Connected to ${mongoUrl.hostname}:${mongoPort} — MongoDB port reachable`
            : `MongoDB connection failed: ${probeResult.message}` };
        } catch (err: any) {
          return { success: false, message: `MongoDB connection error: ${err.message?.slice(0, 100) || "Invalid MONGODB_URI format"}` };
        }
      }
      case "AWS S3": {
        if (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY) {
          return { success: false, message: "Missing AWS access key ID or secret access key" };
        }
        if (!/^[A-Z0-9]{16,}$/i.test(config.AWS_ACCESS_KEY_ID)) {
          return { success: false, message: "AWS access key ID format invalid (expected 16+ alphanumeric chars)" };
        }
        if (config.AWS_SECRET_ACCESS_KEY.length < 20) {
          return { success: false, message: "AWS secret access key appears too short" };
        }
        try {
          const crypto = await import("crypto");
          const region = config.AWS_REGION || "us-east-1";
          const service = "sts";
          const host = `sts.${region}.amazonaws.com`;
          const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
          const dateStamp = amzDate.slice(0, 8);
          const canonicalUri = "/";
          const canonicalQuerystring = "Action=GetCallerIdentity&Version=2011-06-15";
          const hasSessionToken = !!config.AWS_SESSION_TOKEN;
          const canonicalHeaders = hasSessionToken
            ? `host:${host}\nx-amz-date:${amzDate}\nx-amz-security-token:${config.AWS_SESSION_TOKEN}\n`
            : `host:${host}\nx-amz-date:${amzDate}\n`;
          const signedHeaders = hasSessionToken ? "host;x-amz-date;x-amz-security-token" : "host;x-amz-date";
          const payloadHash = crypto.createHash("sha256").update("").digest("hex");
          const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
          const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
          const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;
          const kDate = crypto.createHmac("sha256", `AWS4${config.AWS_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
          const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
          const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
          const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
          const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
          const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
          const fetchHeaders: Record<string, string> = { "Host": host, "X-Amz-Date": amzDate, "Authorization": authorizationHeader };
          if (hasSessionToken) {
            fetchHeaders["X-Amz-Security-Token"] = config.AWS_SESSION_TOKEN;
          }
          const stsRes = await fetch(`https://${host}/?${canonicalQuerystring}`, {
            method: "GET",
            headers: fetchHeaders,
            signal: AbortSignal.timeout(Math.min(timeout - 1000, 5000)),
          });
          if (stsRes.ok) {
            const body = await stsRes.text();
            const arnMatch = body.match(/<Arn>([^<]+)<\/Arn>/);
            const accountMatch = body.match(/<Account>([^<]+)<\/Account>/);
            return { success: true, message: `AWS credentials verified — Account: ${accountMatch?.[1] || "unknown"}, ARN: ${arnMatch?.[1]?.slice(0, 50) || "verified"}` };
          }
          const errBody = await stsRes.text();
          const errMsg = errBody.match(/<Message>([^<]+)<\/Message>/)?.[1] || `HTTP ${stsRes.status}`;
          return { success: false, message: `AWS STS verification failed: ${errMsg.slice(0, 100)}` };
        } catch (err: any) {
          return { success: false, message: `AWS verification error: ${err.message?.slice(0, 100) || "Unknown error"}` };
        }
      }
      case "Firebase": {
        if (!config.FIREBASE_API_KEY || !config.FIREBASE_PROJECT_ID) {
          return { success: false, message: "Missing API key or project ID" };
        }
        const fbRes = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(config.FIREBASE_API_KEY)}`, {
          signal: AbortSignal.timeout(timeout),
        });
        return fbRes.ok
          ? { success: true, message: `Project: ${config.FIREBASE_PROJECT_ID}` }
          : { success: false, message: `Firebase API key invalid (HTTP ${fbRes.status})` };
      }
      case "Supabase": {
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
          return { success: false, message: "Missing Supabase URL or anon key" };
        }
        const sbValidation = validateExternalUrl(config.SUPABASE_URL, ["supabase.co", "supabase.com"]);
        if (!sbValidation.valid) {
          return { success: false, message: `SUPABASE_URL: ${sbValidation.error}` };
        }
        const sbRes = await fetch(`${sbValidation.url!.origin}/rest/v1/`, {
          headers: {
            apikey: config.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${config.SUPABASE_ANON_KEY}`,
          },
          signal: AbortSignal.timeout(timeout),
        });
        return sbRes.ok ? { success: true, message: "Supabase connection verified" } : { success: false, message: `HTTP ${sbRes.status}` };
      }
      case "BigQuery": {
        if (!config.BIGQUERY_ACCESS_TOKEN) {
          return { success: false, message: "Missing BIGQUERY_ACCESS_TOKEN" };
        }
        const bqProjectId = config.BIGQUERY_PROJECT_ID || "default";
        const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(bqProjectId)}/datasets?maxResults=1`, {
          headers: { Authorization: `Bearer ${config.BIGQUERY_ACCESS_TOKEN}` },
          signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? { success: true, message: `Connected to BigQuery project: ${bqProjectId}` } : { success: false, message: `HTTP ${res.status}` };
      }
      case "Amplitude": {
        if (!config.AMPLITUDE_API_KEY || !config.AMPLITUDE_SECRET_KEY) {
          return { success: false, message: "Missing AMPLITUDE_API_KEY or AMPLITUDE_SECRET_KEY" };
        }
        if (config.AMPLITUDE_API_KEY.length < 10) return { success: false, message: "API key appears too short" };
        return { success: false, noLiveTest: true, message: `API key format valid (${config.AMPLITUDE_API_KEY.slice(0, 4)}...) — live verification requires event data` };
      }
      case "Segment": {
        if (!config.SEGMENT_WRITE_KEY) {
          return { success: false, message: "Missing SEGMENT_WRITE_KEY" };
        }
        if (config.SEGMENT_WRITE_KEY.length < 10) return { success: false, message: "Write key appears too short" };
        return { success: false, noLiveTest: true, message: `Write key format valid (${config.SEGMENT_WRITE_KEY.slice(0, 4)}...) — live verification requires sending events` };
      }
      case "Hex": {
        if (!config.HEX_API_TOKEN) {
          return { success: false, message: "Missing HEX_API_TOKEN" };
        }
        const hexRes = await fetch("https://app.hex.tech/api/v1/projects?limit=1", {
          headers: { Authorization: `Bearer ${config.HEX_API_TOKEN}` },
          signal: AbortSignal.timeout(timeout),
        });
        return hexRes.ok ? { success: true, message: "Connected to Hex" } : { success: false, message: `HTTP ${hexRes.status}` };
      }
      case "E-Code Auth": {
        return { success: true, message: "E-Code Auth is a zero-setup managed integration — no API keys required" };
      }
      default: {
        const hasValues = Object.values(config).some(v => v && v.trim().length > 0);
        return hasValues
          ? { success: false, noLiveTest: true, message: "Credentials saved — no automated verification available for this service" }
          : { success: false, message: "No credentials provided" };
      }
    }
  } catch (err: any) {
    const msg = err.name === "TimeoutError" ? "Connection timed out" : (err.message || "Connection failed");
    return { success: false, message: msg };
  }
}

async function getIntegrationEnvVars(projectId: string): Promise<Record<string, string>> {
  const integrations = await storage.getProjectIntegrations(projectId);
  const envVars: Record<string, string> = {};
  for (const pi of integrations) {
    if ((pi.status === "connected" || pi.status === "unverified") && pi.config) {
      for (const [k, v] of Object.entries(pi.config)) {
        if (v) envVars[k] = v;
      }
    }
  }
  return envVars;
}

function sanitizePath(p: string): string | null {
  if (!p || typeof p !== "string") return null;
  const decoded = decodeURIComponent(p);
  if (decoded.includes("..") || decoded.includes("\\")) return null;
  if (p.includes("..") || p.includes("\\")) return null;
  const normalized = pathPosix.normalize(decoded).replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized || normalized.startsWith("/")) return null;
  return normalized;
}

function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") return "";
  return input.slice(0, maxLength);
}

function sanitizeProjectName(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, 200);
  const sanitized = trimmed.replace(/[<>"'`;{}]/g, "");
  if (!sanitized || sanitized.length === 0) return null;
  return sanitized;
}

function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  const trimmed = filename.trim().slice(0, 500);
  if (/[<>"'`;{}|&$!]/.test(trimmed)) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return sanitizePath(trimmed);
}

function validateRunnerPath(p: string): boolean {
  if (!p || typeof p !== "string") return false;
  const decoded = decodeURIComponent(p);
  if (decoded.includes("..") || decoded.includes("\\")) return false;
  const normalized = pathPosix.normalize(decoded);
  if (normalized.includes("..")) return false;
  return true;
}

const MAX_AGENT_ITERATIONS = 10;
const MAX_PROMPT_LENGTH = 50000;
const MAX_GENERATED_FILES = parseInt(process.env.MAX_GENERATED_FILES || "30", 10);
const MAX_MESSAGE_CONTENT_LENGTH = 100000;
const MAX_MESSAGES_COUNT = 50;
const MAX_AI_FILENAME_LENGTH = 255;

const FORBIDDEN_FILENAME_PATTERNS = [
  /\.\./,
  /\\/,
  /^\/+/,
  /[\x00-\x1f\x7f]/,
  /^\.+$/,
  /[<>:"|?*]/,
  /^\s|\s$/,
  /\.(env|pem|key|crt|cer|p12|pfx|jks)$/i,
  /^\.git\//,
  /^\.ssh\//,
  /^node_modules\//,
  /^__pycache__\//,
];

function sanitizeAIFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  if (filename.length > MAX_AI_FILENAME_LENGTH) return null;

  const trimmed = filename.trim();
  if (!trimmed) return null;

  for (const pattern of FORBIDDEN_FILENAME_PATTERNS) {
    if (pattern.test(trimmed)) return null;
  }

  const sanitized = sanitizePath(trimmed);
  if (!sanitized) return null;

  const parts = sanitized.split("/");
  for (const part of parts) {
    if (part.startsWith(".") && part !== ".gitignore" && part !== ".eslintrc" && part !== ".prettierrc") {
      return null;
    }
  }

  return sanitized;
}

function validateAIMessages(messages: any[]): string | null {
  if (!Array.isArray(messages)) return "messages must be an array";
  if (messages.length === 0) return "messages array cannot be empty";
  if (messages.length > MAX_MESSAGES_COUNT) return `Too many messages (max ${MAX_MESSAGES_COUNT})`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") return `Invalid message at index ${i}`;
    if (!msg.role || !["user", "assistant"].includes(msg.role)) {
      return `Invalid role at message index ${i}`;
    }
    if (typeof msg.content !== "string") return `Message content must be a string at index ${i}`;
    if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return `Message at index ${i} exceeds maximum length (${MAX_MESSAGE_CONTENT_LENGTH} chars)`;
    }
  }
  return null;
}

function resolveTopAgentMode(body: any, userPlan: string): { modelId: string; maxTokens: number; effectiveAgentMode: AgentMode; systemPromptPrefix: string } {
  const topMode: TopAgentMode = (body.topAgentMode && ["lite", "autonomous", "max"].includes(body.topAgentMode)) ? body.topAgentMode : "autonomous";
  const tier: AutonomousTier = (body.autonomousTier && ["economy", "power"].includes(body.autonomousTier)) ? body.autonomousTier : "economy";
  const turbo = body.turbo === true;
  const selectedModel = body.model || "claude";

  let effectiveAgentMode: AgentMode;
  let modelId: string;
  let maxTokens: number;
  let systemPromptPrefix = "";

  if (topMode === "lite") {
    effectiveAgentMode = "economy";
    modelId = TOP_AGENT_MODE_MODELS.lite[selectedModel] || TOP_AGENT_MODE_MODELS.lite.claude;
    maxTokens = TOP_AGENT_MODE_CONFIG.lite.maxTokens;
    systemPromptPrefix = "You are in Lite mode. Make quick, targeted changes only. Skip planning — go straight to implementation.\n\n";
  } else if (topMode === "max") {
    effectiveAgentMode = turbo ? "turbo" : "power";
    modelId = TOP_AGENT_MODE_MODELS.max[selectedModel] || TOP_AGENT_MODE_MODELS.max.claude;
    maxTokens = TOP_AGENT_MODE_CONFIG.max.maxTokens;
    systemPromptPrefix = "You are in Max mode with extended context. Provide thorough, multi-step solutions with detailed explanations.\n\n";
  } else {
    effectiveAgentMode = turbo ? "turbo" : tier;
    modelId = (turbo ? AGENT_MODE_MODELS.turbo : AGENT_MODE_MODELS[tier])?.[selectedModel] || AGENT_MODE_MODELS.economy[selectedModel] || "claude-sonnet-4-6";
    maxTokens = turbo ? 16384 : (tier === "power" ? 16384 : 16384);
  }

  if (effectiveAgentMode === "turbo" && (userPlan === "free" || !userPlan)) {
    effectiveAgentMode = "power";
    modelId = AGENT_MODE_MODELS.power[selectedModel] || "claude-sonnet-4-6";
    maxTokens = topMode === "max" ? TOP_AGENT_MODE_CONFIG.max.maxTokens : 16384;
  }

  return { modelId, maxTokens, effectiveAgentMode, systemPromptPrefix };
}

function sanitizeAIFileContent(content: string): string {
  if (typeof content !== "string") return "";
  const maxFileSize = 500000;
  if (content.length > maxFileSize) {
    content = content.slice(0, maxFileSize);
  }
  return content;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    twitterCodeVerifier?: string;
    oauthState?: string;
    pendingPrompt?: string;
    pendingOutputType?: string;
    githubReturnTo?: string;
  }
}

function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

const CSRF_EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/github",
  "/api/auth/github/callback",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/apple",
  "/api/auth/apple/callback",
  "/api/auth/twitter",
  "/api/auth/twitter/callback",
  "/api/auth/replit",
  "/api/auth/replit/callback",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/send-verification",
  "/api/csrf-token",
  // Webhook/external endpoints that cannot send CSRF tokens
  "/api/billing/webhook",
  "/api/feedback",
  "/api/stripe/webhook",
  "/api/analytics/track",
  "/api/webhooks/automation",
  "/api/slack/events",
];

function getAppUrl(): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes("replit.app")) return process.env.APP_URL;
  if (process.env.APP_DOMAIN) return `https://${process.env.APP_DOMAIN}`;
  return "https://e-code.ai";
}

function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const fullPath = req.originalUrl?.split("?")[0] || req.path;
  if (CSRF_EXEMPT_PATHS.some(p => fullPath === p || req.path === p || fullPath.startsWith(p + "/") || req.path.startsWith(p + "/"))) {
    return next();
  }
  const token = req.headers["x-csrf-token"] as string;
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
}

const wsClients = new Map<string, Set<WebSocket>>();
const wsUserClients = new Map<string, Set<WebSocket>>();
const wsConnectionsByIp = new Map<string, Set<WebSocket>>();
const WS_MAX_CONNECTIONS_PER_IP = 5;
const WS_MESSAGE_RATE_LIMIT = 30;
const WS_MESSAGE_RATE_WINDOW_MS = 10000;

interface WsMessageTracker {
  timestamps: number[];
}
const wsMessageTrackers = new WeakMap<WebSocket, WsMessageTracker>();

function checkWsMessageRate(ws: WebSocket): boolean {
  let tracker = wsMessageTrackers.get(ws);
  if (!tracker) {
    tracker = { timestamps: [] };
    wsMessageTrackers.set(ws, tracker);
  }
  const now = Date.now();
  tracker.timestamps = tracker.timestamps.filter(t => now - t < WS_MESSAGE_RATE_WINDOW_MS);
  if (tracker.timestamps.length >= WS_MESSAGE_RATE_LIMIT) {
    return false;
  }
  tracker.timestamps.push(now);
  return true;
}

const recentBroadcasts = new Map<string, { data: any; timestamp: number }[]>();
const MAX_RECENT_BROADCASTS = 50;

function broadcastToUser(userId: string, data: any) {
  const clients = wsUserClients.get(userId);
  if (!clients) return;
  const message = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

function broadcastToProject(projectId: string, data: any) {
  if (!recentBroadcasts.has(projectId)) {
    recentBroadcasts.set(projectId, []);
  }
  const broadcasts = recentBroadcasts.get(projectId)!;
  broadcasts.push({ data, timestamp: Date.now() });
  if (broadcasts.length > MAX_RECENT_BROADCASTS) {
    broadcasts.splice(0, broadcasts.length - MAX_RECENT_BROADCASTS);
  }

  const clients = wsClients.get(projectId);
  if (!clients) return;
  const message = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { mkdir } = await import("fs/promises");
  const express = await import("express");
  const persistentStorageDir = path.join(process.cwd(), ".storage", "objects");
  const persistentStorageTmp = path.join(process.cwd(), ".storage", "tmp");
  const feedbackUploadsDir = path.join(process.cwd(), "uploads", "feedback");
  await mkdir(persistentStorageDir, { recursive: true });
  await mkdir(persistentStorageTmp, { recursive: true });
  await mkdir(feedbackUploadsDir, { recursive: true });
  app.get("/uploads/feedback/:projectId/:filename", requireAuth, async (req: Request, res: Response) => {
    const { projectId, filename } = req.params;
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (/[\/\\]|\.\./.test(filename)) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    const filepath = path.join(feedbackUploadsDir, projectId, filename);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(filepath);
  });

  import("./workflowExecutor").then(({ setBroadcastFn }) => {
    setBroadcastFn(broadcastToProject);
  }).catch(() => {});

  import("./deploymentEngine").then(({ setProcessBroadcastFn }) => {
    setProcessBroadcastFn(broadcastToProject);
  }).catch(() => {});

  import("./localWorkspaceManager").then(({ setLocalWorkspaceBroadcastFn }) => {
    setLocalWorkspaceBroadcastFn(broadcastToProject);
  }).catch(() => {});

  app.use(compression());

  const PgStore = connectPgSimple(session);
  const sessionMiddleware = session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    secret: (() => {
      const s = process.env.SESSION_SECRET;
      if (!s && process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET is required in production");
      }
      return s || crypto.randomBytes(32).toString("hex");
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  });
  app.use(sessionMiddleware);

  app.use((req, res, next) => {
    incrementRequests();
    const start = Date.now();
    res.on("finish", () => {
      recordResponseTime(Date.now() - start);
      if (res.statusCode >= 400) incrementErrors();
    });
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { message: "Too many attempts. Try again later." },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { message: "Rate limit exceeded." },
  });

  const runLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: "Too many executions. Please wait." },
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req: Request) => req.session?.userId || "anonymous",
    message: { message: "Too many AI requests. Please wait a moment." },
    validate: { xForwardedForHeader: false, ip: false },
  });

  const aiGenerateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req: Request) => req.session?.userId || "anonymous",
    message: { message: "Too many project generation requests. Please wait." },
    validate: { xForwardedForHeader: false, ip: false },
  });

  const checkoutLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req: Request) => req.session?.userId || "anonymous",
    message: { message: "Too many checkout attempts. Please wait." },
    validate: { xForwardedForHeader: false, ip: false },
  });

  app.use("/api", apiLimiter);

  const serverStartTime = Date.now();
  const errorBuffer: Array<{ timestamp: string; method: string; path: string; status: number; message: string }> = [];
  const MAX_ERROR_BUFFER = 100;

  app.get("/.well-known/acme-challenge/:token", (req: Request, res: Response) => {
    const response = getACMEChallengeResponse(req.params.token);
    if (response) {
      res.type("text/plain").send(response);
    } else {
      res.status(404).send("Challenge not found");
    }
  });

  app.get("/api/health", async (_req: Request, res: Response) => {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const mem = process.memoryUsage();
    let dbStatus = "connected";
    try {
      const { db } = await import("./db");
      await db.execute("SELECT 1");
    } catch {
      dbStatus = "disconnected";
    }
    const system = getSystemMetrics();
    res.json({
      status: dbStatus === "connected" ? "healthy" : "degraded",
      uptime,
      database: dbStatus,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      execution: {
        activeSandboxes: system.globalConcurrent,
        maxConcurrent: system.maxConcurrent,
        queueLength: system.globalQueueLength,
        activeUsers: system.totalActiveUsers,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/config/status", async (_req: Request, res: Response) => {
    let stripeReady = false;
    try {
      const { isStripeConfigured } = await import("./stripeClient");
      stripeReady = await isStripeConfigured();
    } catch {}
    const emailReady = isEmailConfigured();

    res.json({
      stripe: {
        configured: stripeReady,
        proConfigured: stripeReady,
        teamConfigured: stripeReady,
        hasWebhookSecret: stripeReady,
      },
      email: {
        configured: emailReady,
      },
    });
  });

  app.get("/api/metrics", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      // Unauthenticated users get minimal info only
      return res.json({ status: "ok", uptime: Math.round(process.uptime()) });
    }
    const system = getSystemMetrics();
    res.json({
      execution: system,
      recentErrors: errorBuffer.slice(-20),
      errorCount: errorBuffer.length,
    });
  });

  async function verifyRecaptcha(token: string | undefined): Promise<boolean> {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return true;
    if (!token) return false;
    try {
      const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      });
      const data = await res.json() as { success: boolean; score?: number };
      return data.success && (data.score === undefined || data.score >= 0.5);
    } catch (err) {
      console.error("reCAPTCHA verification error:", err);
      return false;
    }
  }

  app.get("/api/csrf-token", (req: Request, res: Response) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    return res.json({ csrfToken: req.session.csrfToken });
  });

  app.get("/api/auth/config", (_req: Request, res: Response) => {
    return res.json({
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null,
      providers: {
        github: !!(process.env.GITHUB_CLIENT_ID),
        google: !!(process.env.GOOGLE_CLIENT_ID),
        apple: !!(process.env.APPLE_CLIENT_ID),
        twitter: !!(process.env.TWITTER_CLIENT_ID),
        replit: !!(process.env.REPLIT_CLIENT_ID),
        ecode: !!(process.env.ECODE_CLIENT_ID),
      },
    });
  });

  app.use("/api", csrfProtection);

  async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    if (project.userId === userId) return true;
    if (project.visibility === "public" || project.isPublic) return true;
    if (project.teamId) {
      const teams = await storage.getUserTeams(userId);
      if (teams.some(t => t.id === project.teamId)) return true;
    }
    const isGuest = await storage.isProjectGuest(projectId, userId);
    if (isGuest) return true;
    const usr = await storage.getUser(userId);
    if (usr) {
      const invite = await storage.getAcceptedInviteForProject(projectId, usr.email.toLowerCase());
      if (invite) return true;
    }
    const collaborators = await storage.getProjectCollaborators(projectId);
    if (collaborators.some(c => c.userId === userId)) return true;
    return false;
  }

  // EXTRACTED: auth -> legacy-auth.ts
  await (await import("./routes/legacy-auth")).registerAuthRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: usage-quotas -> legacy-usage-quotas.ts
  await (await import("./routes/legacy-usage-quotas")).registerUsageQuotasRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: github-oauth -> legacy-github-oauth.ts
  await (await import("./routes/legacy-github-oauth")).registerGithubOauthRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: replit-oauth -> legacy-replit-oauth.ts
  await (await import("./routes/legacy-replit-oauth")).registerReplitOauthRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: password-reset -> legacy-password-reset.ts
  await (await import("./routes/legacy-password-reset")).registerPasswordResetRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: email-verification -> legacy-email-verification.ts
  await (await import("./routes/legacy-email-verification")).registerEmailVerificationRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: profile-account -> legacy-profile-account.ts
  await (await import("./routes/legacy-profile-account")).registerProfileAccountRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: keyboard-shortcuts -> legacy-keyboard-shortcuts.ts
  await (await import("./routes/legacy-keyboard-shortcuts")).registerKeyboardShortcutsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: teams -> legacy-teams.ts
  await (await import("./routes/legacy-teams")).registerTeamsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: admin -> legacy-admin.ts
  await (await import("./routes/legacy-admin")).registerAdminRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // --- ANALYTICS TRACKING ---
  const analyticsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { message: "Too many tracking requests." },
  });

  app.post("/api/analytics/track", analyticsLimiter, async (req: Request, res: Response) => {
    try {
      const { event, properties } = z.object({
        event: z.string().max(100),
        properties: z.record(z.string().max(500)).optional(),
      }).parse(req.body);
      await storage.trackEvent(req.session.userId || null, event, properties);
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ message: "Invalid event" });
    }
  });

  // EXTRACTED: package-management -> legacy-package-management.ts
  await (await import("./routes/legacy-package-management")).registerPackageManagementRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: package-registry-search -> legacy-package-registry-search.ts
  await (await import("./routes/legacy-package-registry-search")).registerPackageRegistrySearchRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: package-version-lookup -> legacy-package-version-lookup.ts
  await (await import("./routes/legacy-package-version-lookup")).registerPackageVersionLookupRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: import-guessing -> legacy-import-guessing.ts
  await (await import("./routes/legacy-import-guessing")).registerImportGuessingRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: system-modules -> legacy-system-modules.ts
  await (await import("./routes/legacy-system-modules")).registerSystemModulesRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: system-dependencies -> legacy-system-dependencies.ts
  await (await import("./routes/legacy-system-dependencies")).registerSystemDependenciesRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: nix-package-search -> legacy-nix-package-search.ts
  await (await import("./routes/legacy-nix-package-search")).registerNixPackageSearchRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: fork-project -> legacy-fork-project.ts
  await (await import("./routes/legacy-fork-project")).registerForkProjectRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: visibility -> legacy-visibility.ts
  await (await import("./routes/legacy-visibility")).registerVisibilityRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: project-guests -> legacy-project-guests.ts
  await (await import("./routes/legacy-project-guests")).registerProjectGuestsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: deployments -> legacy-deployments.ts
  await (await import("./routes/legacy-deployments")).registerDeploymentsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: custom-domains -> legacy-custom-domains.ts
  await (await import("./routes/legacy-custom-domains")).registerCustomDomainsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: execution-pool-status -> legacy-execution-pool-status.ts
  await (await import("./routes/legacy-execution-pool-status")).registerExecutionPoolStatusRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: version-history -> legacy-version-history.ts
  await (await import("./routes/legacy-version-history")).registerVersionHistoryRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: metrics -> legacy-metrics.ts
  await (await import("./routes/legacy-metrics")).registerMetricsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: projects -> legacy-projects.ts
  await (await import("./routes/legacy-projects")).registerProjectsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: files -> legacy-files.ts
  await (await import("./routes/legacy-files")).registerFilesRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: notifications -> legacy-notifications.ts
  await (await import("./routes/legacy-notifications")).registerNotificationsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: env-vars -> legacy-env-vars.ts
  await (await import("./routes/legacy-env-vars")).registerEnvVarsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: account-env-vars -> legacy-account-env-vars.ts
  await (await import("./routes/legacy-account-env-vars")).registerAccountEnvVarsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: runs -> legacy-runs.ts
  await (await import("./routes/legacy-runs")).registerRunsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: demo -> legacy-demo.ts
  await (await import("./routes/legacy-demo")).registerDemoRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: publish-share -> legacy-publish-share.ts
  await (await import("./routes/legacy-publish-share")).registerPublishShareRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: developer-frameworks -> legacy-developer-frameworks.ts
  await (await import("./routes/legacy-developer-frameworks")).registerDeveloperFrameworksRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: git-version-control -> legacy-git-version-control.ts
  await (await import("./routes/legacy-git-version-control")).registerGitVersionControlRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: github-sync -> legacy-github-sync.ts
  await (await import("./routes/legacy-github-sync")).registerGithubSyncRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: git-backup-recovery -> legacy-git-backup-recovery.ts
  await (await import("./routes/legacy-git-backup-recovery")).registerGitBackupRecoveryRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: workspace-runner -> legacy-workspace-runner.ts
  await (await import("./routes/legacy-workspace-runner")).registerWorkspaceRunnerRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // --- AI Models API (for AIModelSelector) ---
  function getAvailableAIModels() {
    const models: Array<{id: string; name: string; provider: string; description: string; maxTokens: number; supportsStreaming: boolean; costPer1kTokens: number; available: boolean}> = [];
    if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY) {
      models.push(
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", description: "Latest Claude Sonnet — fast, intelligent, great for coding", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.003, available: true },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "anthropic", description: "Fast and affordable for quick tasks", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.001, available: true },
      );
    }
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
      models.push(
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "OpenAI's most capable model", maxTokens: 4096, supportsStreaming: true, costPer1kTokens: 0.005, available: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", description: "Fast and affordable GPT-4 class model", maxTokens: 4096, supportsStreaming: true, costPer1kTokens: 0.00015, available: true },
      );
    }
    if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      models.push(
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", description: "Google's fast multimodal model", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.00025, available: true },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini", description: "Google's most capable model", maxTokens: 8192, supportsStreaming: true, costPer1kTokens: 0.00125, available: true },
      );
    }
    return models;
  }

  app.get("/api/models", async (_req: Request, res: Response) => {
    try {
      const models = getAvailableAIModels();
      res.json({ models });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/models/preferred", async (req: Request, res: Response) => {
    try {
      const models = getAvailableAIModels();
      let preferredModel: string | null = null;
      if (!preferredModel && models.length > 0) {
        preferredModel = models[0].id;
      }
      res.json({ preferredModel, availableModels: models.length });
    } catch (err) {
      res.json({ preferredModel: null, availableModels: 0 });
    }
  });

  app.post("/api/models/preferred", requireAuth, async (req: Request, res: Response) => {
    try {
      const { modelId } = req.body;
      if (!modelId || typeof modelId !== "string") {
        return res.status(400).json({ message: "modelId is required" });
      }
      res.json({ success: true, preferredModel: modelId });
    } catch (err) {
      res.status(500).json({ message: "Failed to save preference" });
    }
  });

  // EXTRACTED: ai-assistant -> legacy-ai-assistant.ts
  await (await import("./routes/legacy-ai-assistant")).registerAiAssistantRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
    app,
  });
  // EXTRACTED: websocket -> legacy-websocket.ts
  await (await import("./routes/legacy-websocket")).registerWebsocketRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: database-viewer -> legacy-database-viewer.ts
  await (await import("./routes/legacy-database-viewer")).registerDatabaseViewerRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: test-runner -> legacy-test-runner.ts
  await (await import("./routes/legacy-test-runner")).registerTestRunnerRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: ai-commit-message -> legacy-ai-commit-message.ts
  await (await import("./routes/legacy-ai-commit-message")).registerAiCommitMessageRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: security-scanner -> legacy-security-scanner.ts
  await (await import("./routes/legacy-security-scanner")).registerSecurityScannerRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: app-storage-kv -> legacy-app-storage-kv.ts
  await (await import("./routes/legacy-app-storage-kv")).registerAppStorageKvRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: app-storage-objects -> legacy-app-storage-objects.ts
  await (await import("./routes/legacy-app-storage-objects")).registerAppStorageObjectsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: bucket-management -> legacy-bucket-management.ts
  await (await import("./routes/legacy-bucket-management")).registerBucketManagementRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: bucket-object-operations -> legacy-bucket-object-operations.ts
  await (await import("./routes/legacy-bucket-object-operations")).registerBucketObjectOperationsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: folder-operations -> legacy-folder-operations.ts
  await (await import("./routes/legacy-folder-operations")).registerFolderOperationsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: legacy-object-routes -> legacy-legacy-object-routes.ts
  await (await import("./routes/legacy-legacy-object-routes")).registerLegacyObjectRoutesRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: generated-file-download -> legacy-generated-file-download.ts
  await (await import("./routes/legacy-generated-file-download")).registerGeneratedFileDownloadRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: project-auth -> legacy-project-auth.ts
  await (await import("./routes/legacy-project-auth")).registerProjectAuthRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: integrations -> legacy-integrations.ts
  await (await import("./routes/legacy-integrations")).registerIntegrationsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: connector-proxy -> legacy-connector-proxy.ts
  await (await import("./routes/legacy-connector-proxy")).registerConnectorProxyRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: automations -> legacy-automations.ts
  await (await import("./routes/legacy-automations")).registerAutomationsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: workflows -> legacy-workflows.ts
  await (await import("./routes/legacy-workflows")).registerWorkflowsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: monitoring -> legacy-monitoring.ts
  await (await import("./routes/legacy-monitoring")).registerMonitoringRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: publishing-analytics -> legacy-publishing-analytics.ts
  await (await import("./routes/legacy-publishing-analytics")).registerPublishingAnalyticsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: threads -> legacy-threads.ts
  await (await import("./routes/legacy-threads")).registerThreadsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: skills -> legacy-skills.ts
  await (await import("./routes/legacy-skills")).registerSkillsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: networking -> legacy-networking.ts
  await (await import("./routes/legacy-networking")).registerNetworkingRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: reverse-proxy -> legacy-reverse-proxy.ts
  await (await import("./routes/legacy-reverse-proxy")).registerReverseProxyRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: task-system -> legacy-task-system.ts
  await (await import("./routes/legacy-task-system")).registerTaskSystemRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: mcp-servers -> legacy-mcp-servers.ts
  await (await import("./routes/legacy-mcp-servers")).registerMcpServersRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: figma-mcp -> legacy-figma-mcp.ts
  await (await import("./routes/legacy-figma-mcp")).registerFigmaMcpRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: slides-video -> legacy-slides-video.ts
  await (await import("./routes/legacy-slides-video")).registerSlidesVideoRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: trash-soft-delete -> legacy-trash-soft-delete.ts
  await (await import("./routes/legacy-trash-soft-delete")).registerTrashSoftDeleteRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: account-warnings -> legacy-account-warnings.ts
  await (await import("./routes/legacy-account-warnings")).registerAccountWarningsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: username -> legacy-username.ts
  await (await import("./routes/legacy-username")).registerUsernameRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: global-search -> legacy-global-search.ts
  await (await import("./routes/legacy-global-search")).registerGlobalSearchRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: canvas -> legacy-canvas.ts
  await (await import("./routes/legacy-canvas")).registerCanvasRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: deployment-feedback -> legacy-deployment-feedback.ts
  await (await import("./routes/legacy-deployment-feedback")).registerDeploymentFeedbackRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: ai-credential-configs -> legacy-ai-credential-configs.ts
  await (await import("./routes/legacy-ai-credential-configs")).registerAiCredentialConfigsRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });
  // EXTRACTED: ai-usage-tracking -> legacy-ai-usage-tracking.ts
  await (await import("./routes/legacy-ai-usage-tracking")).registerAiUsageTrackingRoutes(app, {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  });


  // Register modular routes from server/routes/ directory
  try {
    const mainRouter = new MainRouter(storage);
    await mainRouter.registerRoutes(app);
    console.log("[routes] Modular routes registered via MainRouter");
  } catch (err: any) {
    console.error("[routes] MainRouter registration failed:", err?.message || err);
  }
  return httpServer;
}
