import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import { storage } from "./storage";
import { insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, AGENT_MODE_COSTS, AGENT_MODE_MODELS, type AgentMode, type InsertDeployment, type CheckpointStateSnapshot } from "@shared/schema";
import { decrypt, encrypt } from "./encryption";
import { z } from "zod";
import { executeCode } from "./executor";
import { executionPool } from "./executionPool";
import { getOrCreateTerminal, createTerminalSession, resizeTerminal, listTerminalSessions, destroyTerminalSession, setSessionSelected, updateLastCommand, updateLastActivity } from "./terminal";
import { log } from "./index";
import { sendPasswordResetEmail, sendVerificationEmail, sendTeamInviteEmail, isEmailConfigured } from "./email";
import { buildAndDeploy, createDeploymentRouter, rollbackDeployment, listDeploymentVersions, teardownDeployment, performHealthCheck, getProcessLogs, getProcessStatus, stopManagedProcess, restartManagedProcess } from "./deploymentEngine";
import type { DeploymentType } from "./deploymentEngine";
import { incrementRequests, incrementErrors, recordResponseTime, getAndResetCounters, getRealMetrics } from "./metricsCollector";
import { DEFAULT_SHORTCUTS, isValidShortcutValue, findConflict, mergeWithDefaults } from "@shared/keyboardShortcuts";
import { createCheckpoint, restoreCheckpoint, getCheckpointDiff } from "./checkpointService";
import { addDomain, verifyDomain, removeDomain, getProjectDomains, getDomainById } from "./domainManager";
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
import { generateFile, getMimeType, type FileGenerationInput, type FileSection } from "./fileGeneration";

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
) {
  const dbPackedState = await storage.getGitRepoState(projectId);
  const commitHistory = dbPackedState ? undefined : await loadCommitHistoryForRepo(projectId);
  await gitService.ensureRepo(projectId, files, { commitHistory, dbPackedState });
}

async function persistRepoState(projectId: string) {
  const packed = gitService.getSerializedGitState(projectId);
  if (packed) {
    await storage.saveGitRepoState(projectId, packed);
  }
}
import { getTemplateById, getAllTemplates } from "./templates";
import { generateEcodeContent, getEcodeFilename } from "./ecodeTemplates";

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
          headers: { Authorization: `Bearer ${config.GITHUB_TOKEN}`, "User-Agent": "Replit-IDE" },
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
          return { success: false, noLiveTest: true, message: `Format valid (${redisUrl.hostname}:${redisUrl.port || "6379"}) — live TCP probe not available in this environment` };
        } catch {
          return { success: false, message: "Invalid REDIS_URL format" };
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
          return { success: false, noLiveTest: true, message: `Format valid (${mongoUrl.hostname}) — live TCP probe not available in this environment` };
        } catch {
          return { success: false, message: "Invalid MONGODB_URI format" };
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
        return { success: false, noLiveTest: true, message: `Key format valid (${config.AWS_ACCESS_KEY_ID.slice(0, 4)}...) — STS verification requires AWS SDK` };
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
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/send-verification",
  "/api/csrf-token",
  "/api/demo/run",
  "/api/demo/project",
  "/api/ai/chat",
  "/api/ai/complete",
  "/api/billing/webhook",
  "/api/stripe/webhook",
  "/api/analytics/track",
  "/api/webhooks/automation",
  "/api/slack/events",
];

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
  const persistentStorageDir = path.join(process.cwd(), ".storage", "objects");
  const persistentStorageTmp = path.join(process.cwd(), ".storage", "tmp");
  await mkdir(persistentStorageDir, { recursive: true });
  await mkdir(persistentStorageTmp, { recursive: true });

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
      return s || "dev-only-fallback-" + Date.now();
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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

  app.use("/api", apiLimiter);

  const serverStartTime = Date.now();
  const errorBuffer: Array<{ timestamp: string; method: string; path: string; status: number; message: string }> = [];
  const MAX_ERROR_BUFFER = 100;

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
      return res.json({ execution: getSystemMetrics(), errorCount: 0 });
    }
    const system = getSystemMetrics();
    res.json({
      execution: system,
      recentErrors: errorBuffer.slice(-20),
      errorCount: errorBuffer.length,
    });
  });

  app.get("/api/csrf-token", (req: Request, res: Response) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    return res.json({ csrfToken: req.session.csrfToken });
  });

  app.use("/api", csrfProtection);

  // --- AUTH ---
  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        displayName: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        displayName: data.displayName || data.email.split("@")[0],
      });

      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      return res.status(201).json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        csrfToken: req.session.csrfToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
      });
      const data = schema.parse(req.body);

      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      return res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        csrfToken: req.session.csrfToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      isAdmin: user.isAdmin,
      githubId: user.githubId,
    });
  });

  // --- USAGE & QUOTAS ---
  app.get("/api/user/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const quota = await storage.getUserQuota(userId);
      const limits = await storage.getPlanLimits(quota.plan || "free");
      const projectList = await storage.getProjects(userId);
      const alertThreshold = quota.creditAlertThreshold || 80;
      const creditPercent = limits.dailyCredits > 0 ? Math.round((quota.dailyCreditsUsed / limits.dailyCredits) * 100) : 0;
      res.json({
        plan: quota.plan,
        daily: {
          executions: { used: quota.dailyExecutionsUsed, limit: limits.dailyExecutions },
          aiCalls: { used: quota.dailyAiCallsUsed, limit: limits.dailyAiCalls },
          credits: { used: quota.dailyCreditsUsed, limit: limits.dailyCredits },
        },
        storage: { usedMb: Math.round(quota.storageBytes / 1024 / 1024 * 100) / 100, limitMb: limits.storageMb },
        projects: { count: projectList.length, limit: limits.maxProjects },
        totals: { executions: quota.totalExecutions, aiCalls: quota.totalAiCalls },
        resetsAt: new Date(new Date(quota.lastResetAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        agentMode: quota.agentMode || "economy",
        codeOptimizationsEnabled: quota.codeOptimizationsEnabled || false,
        creditAlertThreshold: alertThreshold,
        creditAlertTriggered: creditPercent >= alertThreshold,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  app.get("/api/user/credits/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const history = await storage.getCreditHistory(req.session.userId!);
      const dayMap: Record<string, { economy: number; power: number; turbo: number; total: number }> = {};
      for (const entry of history) {
        const day = new Date(entry.createdAt).toISOString().split("T")[0];
        if (!dayMap[day]) dayMap[day] = { economy: 0, power: 0, turbo: 0, total: 0 };
        const mode = entry.mode as "economy" | "power" | "turbo";
        dayMap[day][mode] = (dayMap[day][mode] || 0) + entry.creditCost;
        dayMap[day].total += entry.creditCost;
      }
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        days.push({ date: key, ...(dayMap[key] || { economy: 0, power: 0, turbo: 0, total: 0 }) });
      }
      res.json({ days, entries: history.slice(0, 50) });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch credit history" });
    }
  });

  app.put("/api/user/agent-preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentMode, codeOptimizationsEnabled, creditAlertThreshold } = req.body;
      const updates: Record<string, unknown> = {};
      if (agentMode && ["economy", "power", "turbo"].includes(agentMode)) {
        if (agentMode === "turbo") {
          const quota = await storage.getUserQuota(req.session.userId!);
          if (quota.plan === "free") {
            return res.status(403).json({ message: "Turbo mode requires Pro or Team plan" });
          }
        }
        updates.agentMode = agentMode;
      }
      if (typeof codeOptimizationsEnabled === "boolean") updates.codeOptimizationsEnabled = codeOptimizationsEnabled;
      if (typeof creditAlertThreshold === "number" && creditAlertThreshold >= 0 && creditAlertThreshold <= 100) updates.creditAlertThreshold = creditAlertThreshold;
      const updated = await storage.updateAgentPreferences(req.session.userId!, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  app.post("/api/billing/checkout", requireAuth, async (req: Request, res: Response) => {
    const { plan, priceId } = req.body;
    if (!plan && !priceId) {
      return res.status(400).json({ message: "Plan or priceId required" });
    }
    try {
      const { getUncachableStripeClient, isStripeConfigured } = await import("./stripeClient");
      const configured = await isStripeConfigured();
      if (!configured) {
        return res.json({ url: null, message: "Stripe is not configured yet. Connect Stripe to enable payments." });
      }
      const stripeClient = await getUncachableStripeClient();
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const quota = await storage.getUserQuota(user.id);

      let customerId = quota.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeClient.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await storage.updateUserPlan(user.id, quota.plan, customerId);
      }

      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      let resolvedPriceId = priceId;
      if (!resolvedPriceId && plan) {
        const result = await db.execute(
          sql`SELECT pr.id as price_id FROM stripe.prices pr
              JOIN stripe.products p ON pr.product = p.id
              WHERE p.active = true AND pr.active = true
              AND p.metadata->>'plan' = ${plan}
              ORDER BY pr.unit_amount ASC LIMIT 1`
        );
        if (result.rows.length > 0) {
          resolvedPriceId = (result.rows[0] as { price_id: string }).price_id;
        }
      }

      if (!resolvedPriceId) {
        return res.json({ url: null, message: "No price found for this plan. Run the seed-products script first." });
      }

      const priceInfo = await db.execute(
        sql`SELECT pr.recurring, p.metadata->>'plan' as verified_plan
            FROM stripe.prices pr
            JOIN stripe.products p ON p.id = pr.product
            WHERE pr.id = ${resolvedPriceId} AND pr.active = true`
      );
      if (priceInfo.rows.length === 0) {
        return res.status(400).json({ message: "Invalid or inactive price" });
      }
      const priceRow = priceInfo.rows[0] as { recurring: object | null; verified_plan: string | null };
      const isRecurring = !!priceRow.recurring;
      const mode = isRecurring ? "subscription" : "payment";
      const verifiedPlan = priceRow.verified_plan || "pro";

      const session = await stripeClient.checkout.sessions.create({
        customer: customerId,
        mode,
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        success_url: `${req.protocol}://${req.get("host")}/pricing?billing=success`,
        cancel_url: `${req.protocol}://${req.get("host")}/pricing?billing=cancelled`,
        metadata: { userId: user.id, plan: verifiedPlan, priceId: resolvedPriceId },
      });
      return res.json({ url: session.url });
    } catch (err) {
      log(`Stripe checkout error: ${err instanceof Error ? err.message : err}`);
      return res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/billing/portal", requireAuth, async (req: Request, res: Response) => {
    try {
      const { getUncachableStripeClient, isStripeConfigured } = await import("./stripeClient");
      const configured = await isStripeConfigured();
      if (!configured) return res.json({ url: null, message: "Stripe is not configured yet." });
      const stripeClient = await getUncachableStripeClient();
      const quota = await storage.getUserQuota(req.session.userId!);
      if (!quota.stripeCustomerId) return res.json({ url: null, message: "No billing account found." });
      const session = await stripeClient.billingPortal.sessions.create({
        customer: quota.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/settings`,
      });
      return res.json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  app.get("/api/billing/status", requireAuth, async (req: Request, res: Response) => {
    const quota = await storage.getUserQuota(req.session.userId!);

    interface SubscriptionRow {
      id: string;
      status: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      unit_amount: number;
      currency: string;
      recurring: { interval: string } | null;
      product_name: string;
      product_metadata: Record<string, string> | null;
    }

    let subscriptionDetails: {
      id: string;
      status: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
      amount: number;
      currency: string;
      interval: string | null;
      productName: string;
      planKey: string | null;
    } | null = null;

    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      if (quota.stripeSubscriptionId) {
        const result = await db.execute(
          sql`SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end,
                     pr.unit_amount, pr.currency, pr.recurring,
                     p.name as product_name, p.metadata as product_metadata
              FROM stripe.subscriptions s
              JOIN stripe.subscription_items si ON si.subscription = s.id
              JOIN stripe.prices pr ON pr.id = si.price
              JOIN stripe.products p ON p.id = pr.product
              WHERE s.id = ${quota.stripeSubscriptionId}`
        );
        if (result.rows.length > 0) {
          const row = result.rows[0] as SubscriptionRow;
          subscriptionDetails = {
            id: row.id,
            status: row.status,
            currentPeriodEnd: new Date(Number(row.current_period_end) * 1000).toISOString(),
            cancelAtPeriodEnd: row.cancel_at_period_end,
            amount: row.unit_amount,
            currency: row.currency,
            interval: row.recurring?.interval || null,
            productName: row.product_name,
            planKey: row.product_metadata?.plan || null,
          };
        }
      }

      if (!subscriptionDetails && quota.stripeCustomerId) {
        const result = await db.execute(
          sql`SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end,
                     pr.unit_amount, pr.currency, pr.recurring,
                     p.name as product_name, p.metadata as product_metadata
              FROM stripe.subscriptions s
              JOIN stripe.subscription_items si ON si.subscription = s.id
              JOIN stripe.prices pr ON pr.id = si.price
              JOIN stripe.products p ON p.id = pr.product
              WHERE s.customer = ${quota.stripeCustomerId}
              AND s.status IN ('active', 'trialing', 'past_due')
              ORDER BY s.created DESC LIMIT 1`
        );
        if (result.rows.length > 0) {
          const row = result.rows[0] as SubscriptionRow;
          subscriptionDetails = {
            id: row.id,
            status: row.status,
            currentPeriodEnd: new Date(Number(row.current_period_end) * 1000).toISOString(),
            cancelAtPeriodEnd: row.cancel_at_period_end,
            amount: row.unit_amount,
            currency: row.currency,
            interval: row.recurring?.interval || null,
            productName: row.product_name,
            planKey: row.product_metadata?.plan || null,
          };
        }
      }
    } catch {
      // stripe schema may not exist yet
    }

    const derivedStatus = subscriptionDetails
      ? subscriptionDetails.status
      : "none";

    return res.json({
      plan: quota.plan,
      status: derivedStatus,
      stripeCustomerId: quota.stripeCustomerId || null,
      subscriptionId: quota.stripeSubscriptionId || null,
      subscription: subscriptionDetails,
    });
  });

  app.get("/api/stripe/products", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(
        sql`SELECT
              p.id as product_id,
              p.name as product_name,
              p.description as product_description,
              p.active as product_active,
              p.metadata as product_metadata,
              pr.id as price_id,
              pr.unit_amount,
              pr.currency,
              pr.recurring,
              pr.active as price_active,
              pr.metadata as price_metadata
            FROM stripe.products p
            LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
            WHERE p.active = true
            ORDER BY p.name, pr.unit_amount`
      );

      interface ProductPriceRow {
        product_id: string;
        product_name: string;
        product_description: string | null;
        product_active: boolean;
        product_metadata: Record<string, string> | null;
        price_id: string | null;
        unit_amount: number | null;
        currency: string | null;
        recurring: { interval: string } | null;
        price_active: boolean | null;
        price_metadata: Record<string, string> | null;
      }

      interface ProductData {
        id: string;
        name: string;
        description: string | null;
        active: boolean;
        metadata: Record<string, string> | null;
        prices: Array<{
          id: string;
          unitAmount: number | null;
          currency: string | null;
          recurring: { interval: string } | null;
          active: boolean | null;
          metadata: Record<string, string> | null;
        }>;
      }

      const productsMap = new Map<string, ProductData>();
      for (const row of result.rows as ProductPriceRow[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: [],
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id)!.prices.push({
            id: row.price_id,
            unitAmount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }
      return res.json({ data: Array.from(productsMap.values()) });
    } catch (err) {
      return res.json({ data: [] });
    }
  });

  // --- GITHUB OAUTH ---
  app.post("/api/auth/github", async (req: Request, res: Response) => {
    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser || !ghUser.id) {
        return res.status(401).json({ message: "GitHub not connected. Please connect GitHub integration first." });
      }
      const githubId = String(ghUser.id);
      let user = await storage.getUserByGithubId(githubId);
      if (!user) {
        const email = ghUser.email || `github-${githubId}@users.noreply.github.com`;
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          await storage.updateUser(existing.id, { githubId, avatarUrl: ghUser.avatar_url });
          user = (await storage.getUser(existing.id))!;
        } else {
          user = await storage.createUser({
            email,
            password: "",
            displayName: ghUser.login || ghUser.name || email.split("@")[0],
            githubId,
            avatarUrl: ghUser.avatar_url,
            emailVerified: true,
          });
        }
      }
      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      await storage.trackEvent(user.id, "login", { method: "github" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, csrfToken: req.session.csrfToken });
    } catch (err: any) {
      return res.status(500).json({ message: "GitHub authentication failed: " + (err.message || "Unknown error") });
    }
  });

  // --- PASSWORD RESET ---
  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(email, token);
      log(`[auth] Password reset requested for ${email}`, "info");
      return res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { token, password } = z.object({ token: z.string(), password: z.string().min(6) }).parse(req.body);
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      await storage.usePasswordResetToken(token);
      return res.json({ message: "Password reset successfully" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // --- EMAIL VERIFICATION ---
  app.post("/api/auth/send-verification", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.createEmailVerification(user.id, token, expiresAt);
      await sendVerificationEmail(user.email, token);
      log(`[auth] Email verification requested for ${user.email}`, "info");
      return res.json({ message: "Verification email sent" });
    } catch {
      return res.status(500).json({ message: "Failed to send verification" });
    }
  });

  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const success = await storage.verifyEmail(token);
      if (!success) return res.status(400).json({ message: "Invalid or expired verification token" });
      return res.json({ message: "Email verified successfully" });
    } catch {
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  // --- PROFILE & ACCOUNT MANAGEMENT ---
  app.put("/api/user/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        displayName: z.string().min(1).max(50).optional(),
        avatarUrl: z.string().url().optional(),
      }).parse(req.body);
      const user = await storage.updateUser(req.session.userId!, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/user/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }).parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.password) {
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      return res.json({ message: "Password updated successfully" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.delete("/api/user/account", requireAuth, async (req: Request, res: Response) => {
    try {
      const { confirmation } = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).parse(req.body);
      const userId = req.session.userId!;
      await storage.deleteUser(userId);
      req.session.destroy(() => {});
      return res.json({ message: "Account deleted" });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Type 'DELETE MY ACCOUNT' to confirm" });
      return res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get("/api/user/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const projectsList = await storage.getProjects(userId);
      const allData: any = { user: { id: user?.id, email: user?.email, displayName: user?.displayName, createdAt: user?.createdAt }, projects: [] };
      for (const p of projectsList) {
        const pFiles = await storage.getFiles(p.id);
        allData.projects.push({ ...p, files: pFiles.map(f => ({ filename: f.filename, content: f.content })) });
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="replit-export-${userId}.json"`);
      return res.json(allData);
    } catch {
      return res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.get("/api/user/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const prefs = await storage.getUserPreferences(req.session.userId!);
      res.json(prefs);
    } catch { res.status(500).json({ message: "Failed to load preferences" }); }
  });

  app.put("/api/user/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        fontSize: z.number().int().min(10).max(24).optional(),
        tabSize: z.number().int().min(1).max(8).optional(),
        wordWrap: z.boolean().optional(),
        theme: z.enum(["dark", "light"]).optional(),
        agentToolsConfig: z.object({
          liteMode: z.boolean().optional(),
          webSearch: z.boolean().optional(),
          appTesting: z.boolean().optional(),
          codeOptimizations: z.boolean().optional(),
          architect: z.boolean().optional(),
        }).optional(),
        keyboardShortcuts: z.record(z.string().nullable()).optional(),
      });
      const prefs = schema.parse(req.body);
      const updated = await storage.updateUserPreferences(req.session.userId!, prefs);
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid preferences" });
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  // --- KEYBOARD SHORTCUTS ---
  app.get("/api/user/keyboard-shortcuts", requireAuth, async (req: Request, res: Response) => {
    try {
      const shortcuts = await storage.getKeyboardShortcuts(req.session.userId!);
      res.json(shortcuts);
    } catch { res.status(500).json({ message: "Failed to load keyboard shortcuts" }); }
  });

  app.put("/api/user/keyboard-shortcuts", requireAuth, async (req: Request, res: Response) => {
    try {
      const KNOWN_COMMAND_IDS = DEFAULT_SHORTCUTS.map(s => s.id);
      const schema = z.record(z.string().max(50).nullable());
      const shortcuts = schema.parse(req.body);

      const validated: Record<string, string | null> = {};
      const invalidKeys: string[] = [];
      for (const [key, val] of Object.entries(shortcuts)) {
        if (!KNOWN_COMMAND_IDS.includes(key)) continue;
        if (val === null) {
          validated[key] = null;
        } else if (isValidShortcutValue(val)) {
          validated[key] = val;
        } else {
          invalidKeys.push(key);
        }
      }

      if (invalidKeys.length > 0) {
        return res.status(400).json({ message: `Invalid shortcut format for: ${invalidKeys.join(", ")}` });
      }

      const resolvedMap = mergeWithDefaults(validated);
      const conflicts: { commandId: string; conflictWith: string; keys: string }[] = [];
      for (const [cmdId, keys] of Object.entries(validated)) {
        if (keys === null) continue;
        const conflict = findConflict(cmdId, keys, resolvedMap);
        if (conflict) {
          conflicts.push({ commandId: cmdId, conflictWith: conflict.conflictCommandId, keys });
        }
      }

      if (conflicts.length > 0) {
        return res.status(409).json({
          message: "Shortcut conflicts detected",
          conflicts: conflicts.map(c => ({
            commandId: c.commandId,
            conflictWith: c.conflictWith,
            keys: c.keys,
          })),
        });
      }

      const updated = await storage.updateKeyboardShortcuts(req.session.userId!, validated);
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid shortcuts data" });
      res.status(500).json({ message: "Failed to save keyboard shortcuts" });
    }
  });

  // --- TEAMS ---
  app.get("/api/teams", requireAuth, async (req: Request, res: Response) => {
    try {
      const userTeams = await storage.getUserTeams(req.session.userId!);
      return res.json(userTeams);
    } catch {
      return res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = z.object({ name: z.string().min(1).max(50), slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/) }).parse(req.body);
      const existing = await storage.getTeamBySlug(data.slug);
      if (existing) return res.status(409).json({ message: "Team slug already taken" });
      const team = await storage.createTeam({ name: data.name, slug: data.slug, ownerId: req.session.userId! });
      await storage.trackEvent(req.session.userId!, "team_created", { teamId: team.id });
      return res.status(201).json(team);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.get("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const members = await storage.getTeamMembers(team.id);
      const isMember = members.some(m => m.userId === req.session.userId);
      if (!isMember) return res.status(403).json({ message: "Not a team member" });
      return res.json({ ...team, members });
    } catch {
      return res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.put("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team || team.ownerId !== req.session.userId) return res.status(403).json({ message: "Not authorized" });
      const data = z.object({ name: z.string().min(1).max(50).optional(), avatarUrl: z.string().url().optional() }).parse(req.body);
      const updated = await storage.updateTeam(team.id, data);
      return res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team || team.ownerId !== req.session.userId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteTeam(team.id);
      return res.json({ message: "Team deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete team" });
    }
  });

  app.post("/api/teams/:id/invite", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const members = await storage.getTeamMembers(team.id);
      const requester = members.find(m => m.userId === req.session.userId);
      if (!requester || !["owner", "admin"].includes(requester.role)) return res.status(403).json({ message: "Not authorized to invite" });
      const { email, role } = z.object({ email: z.string().email(), role: z.enum(["member", "admin"]).default("member") }).parse(req.body);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invite = await storage.createTeamInvite(team.id, email, role, req.session.userId!, token, expiresAt);
      const inviter = await storage.getUser(req.session.userId!);
      await sendTeamInviteEmail(email, team.name, inviter?.displayName || inviter?.email || "Someone", token);
      log(`[teams] Invite for ${email} to team ${team.name}: /invite/${token}`, "info");
      return res.status(201).json(invite);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to send invite" });
    }
  });

  app.get("/api/teams/:id/invites", requireAuth, async (req: Request, res: Response) => {
    try {
      const invites = await storage.getTeamInvites(req.params.id);
      return res.json(invites);
    } catch {
      return res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  app.post("/api/teams/accept-invite", requireAuth, async (req: Request, res: Response) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const invite = await storage.acceptTeamInvite(token);
      if (!invite) return res.status(400).json({ message: "Invalid or expired invite" });
      await storage.addTeamMember({ teamId: invite.teamId, userId: req.session.userId!, role: invite.role });
      return res.json({ message: "Joined team successfully", teamId: invite.teamId });
    } catch {
      return res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.delete("/api/teams/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const members = await storage.getTeamMembers(team.id);
      const requester = members.find(m => m.userId === req.session.userId);
      if (!requester || !["owner", "admin"].includes(requester.role)) return res.status(403).json({ message: "Not authorized" });
      if (req.params.userId === team.ownerId) return res.status(400).json({ message: "Cannot remove team owner" });
      await storage.removeTeamMember(team.id, req.params.userId);
      return res.json({ message: "Member removed" });
    } catch {
      return res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.put("/api/teams/:id/members/:userId/role", requireAuth, async (req: Request, res: Response) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team || team.ownerId !== req.session.userId) return res.status(403).json({ message: "Not authorized" });
      const { role } = z.object({ role: z.enum(["member", "admin"]) }).parse(req.body);
      const member = await storage.updateTeamMemberRole(team.id, req.params.userId, role);
      return res.json(member);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update role" });
    }
  });

  // --- ADMIN ---
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    next();
  };

  app.get("/api/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      const metrics = getSystemMetrics();
      return res.json({ ...summary, system: metrics });
    } catch {
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const { users: userList, total } = await storage.getAllUsers(limit, offset);
      const safeUsers = userList.map(u => ({
        id: u.id, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl,
        emailVerified: u.emailVerified, isAdmin: u.isAdmin, createdAt: u.createdAt,
      }));
      return res.json({ users: safeUsers, total, limit, offset });
    } catch {
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        displayName: z.string().optional(),
        emailVerified: z.boolean().optional(),
      }).parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.put("/api/admin/users/:id/plan", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { plan } = z.object({ plan: z.enum(["free", "pro", "team"]) }).parse(req.body);
      const quota = await storage.updateUserPlan(req.params.id, plan);
      return res.json(quota);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === req.session.userId) return res.status(400).json({ message: "Cannot delete yourself" });
      await storage.deleteUser(req.params.id);
      return res.json({ message: "User deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const event = req.query.event as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.getAnalytics({ event, limit });
      return res.json(events);
    } catch {
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/execution-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getExecutionLogs({ limit: 100 });
      return res.json(logs);
    } catch {
      return res.status(500).json({ message: "Failed to fetch execution logs" });
    }
  });

  // --- ANALYTICS TRACKING ---
  app.post("/api/analytics/track", async (req: Request, res: Response) => {
    try {
      const { event, properties } = z.object({
        event: z.string(),
        properties: z.record(z.any()).optional(),
      }).parse(req.body);
      await storage.trackEvent(req.session.userId || null, event, properties);
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ message: "Invalid event" });
    }
  });

  // --- PACKAGE MANAGEMENT ---
  async function runProjectCommand(projectId: string, command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const workspace = await storage.getWorkspaceByProject(projectId);
    if (!workspace) {
      throw new Error("No project workspace available. Open the project in the workspace first to manage packages.");
    }
    const result = await runnerClient.execInWorkspace(workspace.id, command, args);
    if (!result) {
      throw new Error("Workspace runner is not available. Please try again later.");
    }
    return result;
  }

  async function getProjectPackageManager(projectId: string): Promise<"npm" | "pip" | "none"> {
    const files = await storage.getFiles(projectId);
    return detectPackageManager(files);
  }

  function detectPackageManager(files: { filename: string; content: string | null }[]): "npm" | "pip" | "none" {
    if (files.find(f => f.filename === "package.json")) return "npm";
    if (files.find(f => f.filename === "requirements.txt") || files.find(f => f.filename === "pyproject.toml")) return "pip";
    return "none";
  }

  app.get("/api/projects/:id/packages", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const files = await storage.getFiles(req.params.id);
      const pm = detectPackageManager(files);
      let packages: { name: string; version: string; dev?: boolean }[] = [];

      if (pm === "npm") {
        let commandSucceeded = false;
        try {
          const result = await runProjectCommand(project.id, "npm", ["ls", "--json", "--depth=0"]);
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
      } else if (pm === "pip") {
        let commandSucceeded = false;
        try {
          const result = await runProjectCommand(project.id, "pip", ["list", "--format=json"]);
          if (result.exitCode === 0 && result.stdout) {
            const parsed = JSON.parse(result.stdout);
            packages = parsed.map((p: { name: string; version: string }) => ({ name: p.name, version: p.version }));
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
      return res.json({ packages, packageManager: pm, language: project.language });
    } catch {
      return res.status(500).json({ message: "Failed to get packages" });
    }
  });

  app.post("/api/projects/:id/packages/add", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { name, dev } = z.object({ name: z.string().min(1).max(200), dev: z.boolean().optional() }).parse(req.body);

      const pkgNamePattern = /^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i;
      if (!pkgNamePattern.test(name) || name.startsWith("-") || name.startsWith(".")) {
        return res.status(400).json({ message: "Invalid package name" });
      }

      const isPython = project.language === "python" || project.language === "python3";

      let command: string;
      let args: string[];
      if (isPython) {
        command = "pip";
        args = ["install", name];
      } else {
        command = "npm";
        args = dev ? ["install", "--save-dev", name] : ["install", name];
      }

      const result = await runProjectCommand(project.id, command, args);
      const output = (result.stdout + "\n" + result.stderr).trim();

      if (result.exitCode !== 0) {
        return res.status(400).json({ success: false, message: `Installation failed`, output, command: `${command} ${args.join(" ")}` });
      }

      return res.json({ success: true, output, command: `${command} ${args.join(" ")}` });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: err.message || "Failed to add package" });
    }
  });

  app.post("/api/projects/:id/packages/remove", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);

      const pkgNamePattern = /^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i;
      if (!pkgNamePattern.test(name) || name.startsWith("-") || name.startsWith(".")) {
        return res.status(400).json({ message: "Invalid package name" });
      }

      const isPython = project.language === "python" || project.language === "python3";

      let command: string;
      let args: string[];
      if (isPython) {
        command = "pip";
        args = ["uninstall", "-y", name];
      } else {
        command = "npm";
        args = ["uninstall", name];
      }

      const result = await runProjectCommand(project.id, command, args);
      const output = (result.stdout + "\n" + result.stderr).trim();

      if (result.exitCode !== 0) {
        return res.status(400).json({ success: false, message: `Removal failed`, output, command: `${command} ${args.join(" ")}` });
      }

      return res.json({ success: true, output, command: `${command} ${args.join(" ")}` });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: err.message || "Failed to remove package" });
    }
  });

  // --- FORK PROJECT ---
  app.post("/api/projects/:id/fork", requireAuth, async (req: Request, res: Response) => {
    try {
      const sourceProject = await storage.getProject(req.params.id);
      if (!sourceProject) return res.status(404).json({ message: "Project not found" });
      const isOwner = sourceProject.userId === req.session.userId;
      const isPublished = sourceProject.isPublished;
      if (!isOwner && !isPublished) return res.status(403).json({ message: "Cannot fork a private project" });
      const sourceFiles = await storage.getFiles(sourceProject.id);
      const userProjects = await storage.getProjects(req.session.userId!);
      const forkQuota = await storage.getUserQuota(req.session.userId!);
      const forkLimits = await storage.getPlanLimits(forkQuota.plan || "free");
      if (userProjects.length >= forkLimits.maxProjects) return res.status(403).json({ message: "Project limit reached" });
      const rawName = req.body.name || `${sourceProject.name} (fork)`;
      const forkName = sanitizeInput(rawName, 100);
      const newProject = await storage.createProject(req.session.userId!, {
        name: forkName,
        language: sourceProject.language,
      });
      for (const file of sourceFiles) {
        if (file.filename === "ecode.md") continue;
        await storage.createFile(newProject.id, {
          filename: file.filename,
          content: file.content,
        });
      }
      const sourceEcode = sourceFiles.find(f => f.filename === "ecode.md");
      if (sourceEcode) {
        const existingEcode = (await storage.getFiles(newProject.id)).find(f => f.filename === "ecode.md");
        if (existingEcode) {
          await storage.updateFileContent(existingEcode.id, sourceEcode.content);
        }
      }
      await storage.trackEvent(req.session.userId!, "project_forked", { sourceProjectId: sourceProject.id, newProjectId: newProject.id });
      return res.json(newProject);
    } catch {
      return res.status(500).json({ message: "Failed to fork project" });
    }
  });

  // --- DEPLOYMENTS ---
  app.use(createDeploymentRouter());

  const deployConfigSchema = z.object({
    deploymentType: z.enum(["autoscale", "static", "reserved-vm", "scheduled"]).default("static"),
    buildCommand: z.string().max(1000).optional(),
    runCommand: z.string().max(1000).optional(),
    machineConfig: z.object({ cpu: z.number().min(0.25).max(16), ram: z.number().min(128).max(65536) }).optional(),
    maxMachines: z.number().int().min(1).max(20).optional(),
    cronExpression: z.string().max(100).optional(),
    scheduleDescription: z.string().max(500).optional(),
    jobTimeout: z.number().int().min(1).max(86400).optional(),
    publicDirectory: z.string().max(200).optional(),
    appType: z.enum(["web_server", "background_worker"]).optional(),
    deploymentSecrets: z.record(z.string().max(10000)).optional(),
    portMapping: z.number().int().min(1).max(65535).optional(),
    isPrivate: z.boolean().optional(),
    showBadge: z.boolean().optional(),
    enableFeedback: z.boolean().optional(),
  });

  app.post("/api/projects/:id/deploy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const projectFiles = await storage.getFiles(project.id);
      if (projectFiles.length === 0) return res.status(400).json({ message: "No files to deploy" });
      const existingDeps = await storage.getProjectDeployments(project.id);
      const version = existingDeps.length > 0 ? Math.max(...existingDeps.map(d => d.version)) + 1 : 1;

      const deployConfig = deployConfigSchema.parse(req.body || {});
      const deploymentType = deployConfig.deploymentType || "static";

      if (deployConfig.isPrivate === true) {
        const quota = await storage.getUserQuota(req.session.userId!);
        if (!quota || quota.plan !== "team") {
          return res.status(403).json({ message: "Private deployments require a Teams plan" });
        }
      }

      const insertData: InsertDeployment = {
        projectId: project.id,
        userId: req.session.userId!,
        version,
        deploymentType,
        buildCommand: deployConfig.buildCommand,
        runCommand: deployConfig.runCommand,
        machineConfig: deployConfig.machineConfig,
        maxMachines: deployConfig.maxMachines,
        cronExpression: deployConfig.cronExpression,
        scheduleDescription: deployConfig.scheduleDescription,
        jobTimeout: deployConfig.jobTimeout,
        publicDirectory: deployConfig.publicDirectory,
        appType: deployConfig.appType,
        deploymentSecrets: deployConfig.deploymentSecrets,
        portMapping: deployConfig.portMapping,
        isPrivate: deployConfig.isPrivate,
        showBadge: deployConfig.showBadge,
        enableFeedback: deployConfig.enableFeedback,
      };

      const deployment = await storage.createDeployment(insertData);
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);

      const build = await buildAndDeploy(
        project.id,
        project.name,
        project.language,
        projectFiles.map(f => ({ filename: f.filename, content: f.content })),
        req.session.userId!,
        deployment.id,
        version,
        (line) => {
          log(line, "deploy");
          broadcastToProject(project.id, { type: "deploy_log", line });
        },
        {
          deploymentType,
          buildCommand: deployConfig.buildCommand,
          runCommand: deployConfig.runCommand,
          machineConfig: deployConfig.machineConfig,
          maxMachines: deployConfig.maxMachines,
          cronExpression: deployConfig.cronExpression,
          scheduleDescription: deployConfig.scheduleDescription,
          jobTimeout: deployConfig.jobTimeout,
          publicDirectory: deployConfig.publicDirectory,
          appType: deployConfig.appType,
          deploymentSecrets: deployConfig.deploymentSecrets,
          portMapping: deployConfig.portMapping,
          isPrivate: deployConfig.isPrivate,
          showBadge: deployConfig.showBadge,
          enableFeedback: deployConfig.enableFeedback,
        },
      );

      const deployUrl = build.url;
      if (build.status === "live") {
        await storage.demotePreviousLiveDeployments(project.id, deployment.id);
        await storage.updateProject(project.id, { isPublished: true, publishedSlug: slug });
      }
      await storage.updateDeployment(deployment.id, {
        status: build.status,
        buildLog: build.buildLog,
        url: deployUrl,
        finishedAt: new Date(),
        deploymentType,
        processPort: build.processPort || undefined,
      });
      await storage.trackEvent(req.session.userId!, "project_deployed", { projectId: project.id, version, deploymentType });
      if (build.status === "live") {
        createCheckpoint(project.id, req.session.userId!, "deployment", `Deployment v${version} successful`).catch(() => {});
      }
      return res.json({ deployment: { ...deployment, version, status: build.status, buildLog: build.buildLog, url: deployUrl, deploymentType, processPort: build.processPort }, slug, url: deployUrl, version });
    } catch (err: any) {
      log(`Deploy error: ${err.message}`, "deploy");
      return res.status(500).json({ message: "Deployment failed" });
    }
  });

  app.post("/api/projects/:id/deploy/rollback", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { version } = z.object({ version: z.number().int().min(0) }).parse(req.body);
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      const result = await rollbackDeployment(project.id, slug, version);
      if (!result.success) return res.status(400).json({ message: result.message });
      return res.json({ success: true, message: result.message, version });
    } catch {
      return res.status(500).json({ message: "Rollback failed" });
    }
  });

  app.get("/api/projects/:id/deploy/versions", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      const versions = await listDeploymentVersions(slug);
      return res.json({ versions, slug });
    } catch {
      return res.status(500).json({ message: "Failed to fetch versions" });
    }
  });

  app.delete("/api/projects/:id/deploy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + project.id.slice(0, 8);
      await teardownDeployment(slug, project.id);
      await storage.updateProject(project.id, { isPublished: false, publishedSlug: null });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Teardown failed" });
    }
  });

  app.get("/api/projects/:id/deployments", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const deps = await storage.getProjectDeployments(req.params.id);
      return res.json(deps);
    } catch {
      return res.status(500).json({ message: "Failed to fetch deployments" });
    }
  });

  app.get("/api/projects/:id/deploy/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const summary = await storage.getDeploymentAnalyticsSummary(project.id, since);
      return res.json(summary);
    } catch {
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.post("/api/projects/:id/deploy/track", async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const { path, referrer, visitorId } = req.body || {};
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
      await storage.createDeploymentAnalytic({
        projectId: project.id,
        path: path || "/",
        referrer: referrer || null,
        userAgent: req.headers["user-agent"] || null,
        visitorId: visitorId || null,
        ipHash,
      });
      return res.json({ tracked: true });
    } catch {
      return res.status(500).json({ message: "Tracking failed" });
    }
  });

  app.post("/api/deploy/schedule-to-cron", requireAuth, async (req: Request, res: Response) => {
    try {
      const { description } = z.object({ description: z.string().min(1).max(500) }).parse(req.body);
      const anthropic = new Anthropic();
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Convert this natural language schedule description to a cron expression (5-field format: minute hour day-of-month month day-of-week). Only respond with the cron expression, nothing else.\n\nDescription: "${description}"`
        }],
      });
      const firstBlock = message.content[0];
      const cronText = (firstBlock.type === "text" ? firstBlock.text : "").trim();
      const cronMatch = cronText.match(/^[\d\*\/\-\,\s]+$/);
      const cronExpression = cronMatch ? cronText : "0 * * * *";
      return res.json({ cronExpression, description });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to convert schedule", cronExpression: "0 * * * *" });
    }
  });

  const deploySettingsSchema = z.object({
    isPrivate: z.boolean().optional(),
    showBadge: z.boolean().optional(),
    enableFeedback: z.boolean().optional(),
  });

  app.patch("/api/projects/:id/deploy/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const deps = await storage.getProjectDeployments(project.id);
      const liveDep = deps.find(d => d.status === "live");
      if (!liveDep) return res.status(404).json({ message: "No active deployment" });

      const body = deploySettingsSchema.parse(req.body);

      if (body.isPrivate === true) {
        const quota = await storage.getUserQuota(req.session.userId!);
        if (!quota || quota.plan !== "team") {
          return res.status(403).json({ message: "Private deployments require a Teams plan" });
        }
      }

      const updates: Partial<{ isPrivate: boolean; showBadge: boolean; enableFeedback: boolean }> = {};
      if (body.isPrivate !== undefined) updates.isPrivate = body.isPrivate;
      if (body.showBadge !== undefined) updates.showBadge = body.showBadge;
      if (body.enableFeedback !== undefined) updates.enableFeedback = body.enableFeedback;
      const updated = await storage.updateDeployment(liveDep.id, updates);
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get("/api/projects/:id/deploy/health", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const health = await performHealthCheck(project.id);
      const deps = await storage.getProjectDeployments(project.id);
      const latestDep = deps[0];
      if (latestDep && health.lastCheck) {
        await storage.updateDeployment(latestDep.id, {
          lastHealthCheck: health.lastCheck,
          healthStatus: health.status,
        });
      }
      return res.json(health);
    } catch {
      return res.status(500).json({ message: "Health check failed" });
    }
  });

  app.get("/api/projects/:id/deploy/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const logs = getProcessLogs(project.id);
      return res.json({ logs });
    } catch {
      return res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get("/api/projects/:id/deploy/process", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const status = getProcessStatus(project.id);
      return res.json({ process: status });
    } catch {
      return res.status(500).json({ message: "Failed to fetch process status" });
    }
  });

  app.post("/api/projects/:id/deploy/stop", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      await stopManagedProcess(project.id);
      const deps = await storage.getProjectDeployments(project.id);
      if (deps[0]) {
        await storage.updateDeployment(deps[0].id, { status: "stopped", healthStatus: "unknown" });
      }
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Stop failed" });
    }
  });

  app.post("/api/projects/:id/deploy/restart", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const managed = await restartManagedProcess(project.id);
      if (!managed) return res.status(400).json({ message: "No running process to restart" });
      return res.json({ success: true, port: managed.port });
    } catch {
      return res.status(500).json({ message: "Restart failed" });
    }
  });

  // --- CUSTOM DOMAINS ---
  app.post("/api/projects/:id/domains", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const { domain } = z.object({ domain: z.string().min(3).max(253) }).parse(req.body);
      const result = await addDomain(domain, project.id, req.session.userId!);
      return res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(400).json({ message: err.message || "Failed to add domain" });
    }
  });

  app.post("/api/projects/:id/domains/:domainId/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const domainRecord = await getDomainById(req.params.domainId);
      if (!domainRecord || domainRecord.projectId !== project.id) return res.status(404).json({ message: "Domain not found" });
      const result = await verifyDomain(req.params.domainId);
      if (result.verified) {
        await storage.updateProject(project.id, { customDomain: domainRecord.domain });
      }
      return res.json(result);
    } catch {
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  app.delete("/api/projects/:id/domains/:domainId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const domainToDelete = await getDomainById(req.params.domainId);
      if (!domainToDelete || domainToDelete.projectId !== project.id) return res.status(404).json({ message: "Domain not found" });
      const success = await removeDomain(req.params.domainId, req.session.userId!);
      if (!success) return res.status(404).json({ message: "Domain not found" });
      if (project.customDomain) {
        await storage.updateProject(project.id, { customDomain: null });
      }
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to remove domain" });
    }
  });

  app.get("/api/projects/:id/domains", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const domains = await getProjectDomains(project.id);
      return res.json(domains);
    } catch {
      return res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  // --- EXECUTION POOL STATUS (admin) ---
  app.get("/api/admin/execution-pool", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      return res.json(executionPool.getStatus());
    } catch {
      return res.status(500).json({ message: "Failed to get pool status" });
    }
  });

  // --- VERSION HISTORY ---
  app.post("/api/projects/:id/commits", requireAuth, async (req: Request, res: Response) => {
    try {
      const { message } = z.object({ message: z.string().min(1).max(200) }).parse(req.body);
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const projectFiles = await storage.getFiles(project.id);
      const snapshot: Record<string, string> = {};
      projectFiles.forEach(f => { snapshot[f.filename] = f.content; });
      const existingCommits = await storage.getCommits(project.id, "main");
      const parentCommitId = existingCommits.length > 0 ? existingCommits[0].id : undefined;
      const commit = await storage.createCommit({
        projectId: project.id, branchName: "main", message,
        authorId: req.session.userId!, parentCommitId: parentCommitId || null, snapshot,
      });
      let branch = await storage.getBranch(project.id, "main");
      if (!branch) {
        branch = await storage.createBranch({ projectId: project.id, name: "main", headCommitId: commit.id, isDefault: true });
      } else {
        await storage.updateBranchHead(branch.id, commit.id);
      }
      await storage.trackEvent(req.session.userId!, "commit_created", { projectId: project.id, commitId: commit.id });
      return res.status(201).json(commit);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to create commit" });
    }
  });

  app.get("/api/projects/:id/commits", requireAuth, async (req: Request, res: Response) => {
    try {
      const branch = (req.query.branch as string) || "main";
      const commitList = await storage.getCommits(req.params.id, branch);
      return res.json(commitList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch commits" });
    }
  });

  app.get("/api/commits/:commitId", requireAuth, async (req: Request, res: Response) => {
    try {
      const commit = await storage.getCommit(req.params.commitId);
      if (!commit) return res.status(404).json({ message: "Commit not found" });
      return res.json(commit);
    } catch {
      return res.status(500).json({ message: "Failed to fetch commit" });
    }
  });

  app.post("/api/projects/:id/restore/:commitId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const commit = await storage.getCommit(req.params.commitId);
      if (!commit || commit.projectId !== project.id) return res.status(404).json({ message: "Commit not found" });
      await createCheckpoint(project.id, req.session.userId!, "pre_risky_op", `Before restoring to commit ${commit.id.slice(0, 7)}`).catch(() => {});
      const currentFiles = await storage.getFiles(project.id);
      for (const f of currentFiles) { await storage.deleteFile(f.id); }
      const snapshot = commit.snapshot as Record<string, string>;
      for (const [filename, content] of Object.entries(snapshot)) {
        await storage.createFile(project.id, { filename, content });
      }
      return res.json({ message: "Restored to commit", commitId: commit.id });
    } catch {
      return res.status(500).json({ message: "Failed to restore" });
    }
  });

  app.get("/api/projects/:id/branches", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchList = await storage.getBranches(req.params.id);
      return res.json(branchList);
    } catch {
      return res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  // --- METRICS (for error boundary reporting) ---
  app.get("/api/metrics", (_req: Request, res: Response) => {
    return res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/github/user", requireAuth, async (_req: Request, res: Response) => {
    try {
      const user = await github.getAuthenticatedUser();
      if (!user) return res.json({ connected: false });
      return res.json({ connected: true, user });
    } catch {
      return res.json({ connected: false });
    }
  });

  app.get("/api/github/repos", requireAuth, async (_req: Request, res: Response) => {
    try {
      const repos = await github.listUserRepos();
      return res.json(repos);
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to fetch repos" });
    }
  });

  app.post("/api/github/import", requireAuth, async (req: Request, res: Response) => {
    const { owner, repo, name } = req.body;
    if (!owner || !repo) return res.status(400).json({ message: "owner and repo required" });
    try {
      const projectCheck = await storage.checkProjectLimit(req.session.userId!);
      if (!projectCheck.allowed) {
        return res.status(429).json({ message: `Project limit reached` });
      }
      const contents = await github.getRepoContents(owner, repo);
      const repoInfo = await github.getRepo(owner, repo);
      const lang = repoInfo.language === "Python" ? "python" : repoInfo.language === "TypeScript" ? "typescript" : "javascript";
      const project = await storage.createProject(req.session.userId!, {
        name: (name || repo).slice(0, 50),
        language: lang,
      });
      const importFiles = contents.filter((c: any) => c.type === "file").slice(0, 20);
      let importedEcode = false;
      for (const item of importFiles) {
        if (item.path === "ecode.md") { importedEcode = true; continue; }
        try {
          const content = await github.getFileContent(owner, repo, item.path);
          await storage.createFile(project.id, { filename: item.path, content: content.slice(0, 500000) });
        } catch {}
      }
      if (importedEcode) {
        try {
          const ecodeContent = await github.getFileContent(owner, repo, "ecode.md");
          const existingEcode = (await storage.getFiles(project.id)).find(f => f.filename === "ecode.md");
          if (existingEcode) {
            await storage.updateFileContent(existingEcode.id, ecodeContent.slice(0, 500000));
          }
        } catch {}
      }
      const files = await storage.getFiles(project.id);
      return res.status(201).json({ project, files });
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to import from GitHub" });
    }
  });

  app.post("/api/github/export", requireAuth, async (req: Request, res: Response) => {
    const { projectId, repoName, isPrivate } = req.body;
    if (!projectId || !repoName) return res.status(400).json({ message: "projectId and repoName required" });
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });
      const newRepo = await github.createRepo(repoName, `Exported from IDE: ${project.name}`, isPrivate !== false);
      const files = await storage.getFiles(projectId);
      for (const file of files) {
        if (file.content && !file.content.startsWith("data:")) {
          try {
            await github.pushFile(ghUser.login, newRepo.name, file.filename, file.content, `Add ${file.filename}`);
          } catch {}
        }
      }
      return res.json({ repo: newRepo, url: newRepo.html_url });
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Failed to export to GitHub" });
    }
  });

  // --- PROJECTS ---
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    const projectList = await storage.getProjects(req.session.userId!);
    return res.json(projectList);
  });

  app.post("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectCheck = await storage.checkProjectLimit(req.session.userId!);
      if (!projectCheck.allowed) {
        return res.status(429).json({ message: `Project limit reached (${projectCheck.current}/${projectCheck.limit}). Upgrade to Pro for more.` });
      }
      const data = insertProjectSchema.parse(req.body);
      if (data.name) {
        const safeName = sanitizeProjectName(data.name);
        if (!safeName) {
          return res.status(400).json({ message: "Invalid project name" });
        }
        data.name = safeName;
      }
      const project = await storage.createProject(req.session.userId!, data);
      return res.status(201).json(project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/templates", (_req: Request, res: Response) => {
    return res.json(getAllTemplates());
  });

  app.get("/api/plan-configs", async (_req: Request, res: Response) => {
    try {
      const configs = await storage.getAllPlanConfigs();
      return res.json(configs);
    } catch {
      return res.status(500).json({ message: "Failed to fetch plan configs" });
    }
  });

  app.get("/api/landing-stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getLandingStats();
      return res.json(stats);
    } catch {
      return res.status(500).json({ message: "Failed to fetch landing stats" });
    }
  });

  app.get("/api/ai-suggestions", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const languages = await storage.getUserRecentLanguages(userId);
      const languageSuggestions: Record<string, { chat: string[]; agent: string[] }> = {
        python: {
          chat: ["Explain this Python code", "Add type hints to this code", "Convert to async/await", "Optimize with list comprehensions"],
          agent: ["Build a Flask REST API", "Create a data analysis script", "Add pytest unit tests", "Build a CLI tool with Click"],
        },
        javascript: {
          chat: ["Explain this JavaScript code", "Convert to TypeScript", "Add JSDoc comments", "Optimize array operations"],
          agent: ["Build a React component", "Create an Express API endpoint", "Add Jest unit tests", "Build a Node.js CLI tool"],
        },
        typescript: {
          chat: ["Explain this TypeScript code", "Improve type definitions", "Add generics", "Fix type errors"],
          agent: ["Build a typed React component", "Create a typed API endpoint", "Add Vitest unit tests", "Refactor with utility types"],
        },
        go: {
          chat: ["Explain this Go code", "Add error handling", "Optimize goroutines", "Add Go doc comments"],
          agent: ["Build an HTTP handler", "Create a CLI with Cobra", "Add table-driven tests", "Build a concurrent worker"],
        },
        rust: {
          chat: ["Explain this Rust code", "Fix borrow checker issues", "Add error handling with Result", "Optimize with iterators"],
          agent: ["Build a CLI with Clap", "Create a REST API with Actix", "Add unit tests", "Implement a custom trait"],
        },
      };

      if (languages.length > 0) {
        const primaryLang = languages[0].toLowerCase();
        const suggestions = languageSuggestions[primaryLang];
        if (suggestions) {
          return res.json({
            personalized: true,
            primaryLanguage: primaryLang,
            languages,
            chat: suggestions.chat.map(label => ({ label, category: "Suggested" })),
            agent: suggestions.agent.map(label => ({ label, category: "Suggested" })),
          });
        }
      }

      return res.json({
        personalized: false,
        languages,
        chat: [
          { label: "Explain this code", category: "Understand" },
          { label: "Find bugs and fix them", category: "Debug" },
          { label: "Add error handling", category: "Improve" },
          { label: "Optimize performance", category: "Optimize" },
        ],
        agent: [
          { label: "Build a login form with validation", category: "UI" },
          { label: "Add a REST API endpoint", category: "Backend" },
          { label: "Create a utility functions file", category: "Utils" },
          { label: "Refactor this code for performance", category: "Refactor" },
        ],
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch AI suggestions" });
    }
  });

  app.post("/api/projects/from-template", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const projectCheck = await storage.checkProjectLimit(userId);
      if (!projectCheck.allowed) {
        return res.status(429).json({ message: `Project limit reached (${projectCheck.current}/${projectCheck.limit}). Upgrade to Pro for more.` });
      }
      const schema = z.object({
        templateId: z.string(),
        name: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const template = getTemplateById(data.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const projectName = data.name ? (sanitizeProjectName(data.name) || template.name) : template.name;
      const project = await storage.createProjectFromTemplate(userId, {
        name: projectName,
        language: template.language,
        projectType: template.projectType,
        files: template.files,
      });
      return res.status(201).json(project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create project from template" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== req.session.userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }
    return res.json(project);
  });

  app.delete("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const deleted = await storage.deleteProject(req.params.id, req.session.userId!);
    if (!deleted) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    return res.json({ message: "Project deleted" });
  });

  app.post("/api/projects/:id/duplicate", requireAuth, async (req: Request, res: Response) => {
    const sourceProject = await storage.getProject(req.params.id);
    if (!sourceProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (sourceProject.userId !== req.session.userId && !sourceProject.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }
    const projectLimit = await storage.checkProjectLimit(req.session.userId!);
    if (!projectLimit.allowed) {
      return res.status(403).json({ message: `Project limit reached (${projectLimit.current}/${projectLimit.limit}). Upgrade to Pro for more.` });
    }
    const project = await storage.duplicateProject(req.params.id, req.session.userId!);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.status(201).json(project);
  });

  app.get("/api/projects/:id/ecode", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const projectFiles = await storage.getFiles(project.id);
    const ecodeFile = projectFiles.find(f => f.filename === "ecode.md");
    return res.json({ exists: !!ecodeFile, fileId: ecodeFile?.id || null });
  });

  app.post("/api/projects/:id/ecode/generate", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const projectFiles = await storage.getFiles(project.id);
    const existing = projectFiles.find(f => f.filename === "ecode.md");
    if (existing) {
      return res.json({ file: existing, regenerated: false });
    }
    const content = generateEcodeContent(project.name, project.language);
    const file = await storage.createFile(project.id, { filename: "ecode.md", content });
    return res.status(201).json({ file, regenerated: true });
  });

  // --- FILES ---
  app.get("/api/projects/:projectId/files", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== req.session.userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }
    const fileList = await storage.getFiles(req.params.projectId);
    return res.json(fileList);
  });

  app.post("/api/projects/:projectId/files", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const data = insertFileSchema.parse(req.body);
      const safeName = sanitizeFilename(data.filename);
      if (!safeName) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      if (data.content) {
        data.content = sanitizeInput(data.content, 500000);
      }
      const file = await storage.createFile(req.params.projectId, { ...data, filename: safeName });
      storage.updateStorageUsage(req.session.userId!).catch(() => {});
      return res.status(201).json(file);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to create file" });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.projectFiles, files: UPLOAD_LIMITS.maxProjectFiles },
  });

  app.post("/api/projects/:projectId/upload", requireAuth, upload.array("files", 10), async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    const prefix = (req.body.path || "").replace(/^\/+|\/+$/g, "");
    const created = [];
    for (const f of files) {
      const rawName = f.originalname.replace(/[^a-zA-Z0-9._\-\/]/g, "_").slice(0, 100);
      const filename = prefix ? `${prefix}/${rawName}` : rawName;
      const safeName = sanitizeFilename(filename);
      if (!safeName) continue;
      const isBinary = !f.mimetype.startsWith("text/") && !f.mimetype.includes("json") && !f.mimetype.includes("javascript") && !f.mimetype.includes("xml") && !f.mimetype.includes("css") && !f.mimetype.includes("html") && !f.mimetype.includes("svg");
      const content = isBinary
        ? `data:${f.mimetype};base64,${f.buffer.toString("base64")}`
        : f.buffer.toString("utf-8");
      try {
        const file = await storage.createFile(req.params.projectId, { filename: safeName, content, isBinary, mimeType: f.mimetype });
        created.push(file);
      } catch {}
    }
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    return res.status(201).json({ files: created, count: created.length });
  });

  app.patch("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const existingFile = await storage.getFile(req.params.id);
    if (!existingFile) {
      return res.status(404).json({ message: "File not found" });
    }
    const project = await storage.getProject(existingFile.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, filename } = req.body;
    if (typeof content === "string") {
      const sanitizedContent = sanitizeInput(content, 500000);
      const file = await storage.updateFileContent(req.params.id, sanitizedContent);
      storage.updateStorageUsage(req.session.userId!).catch(() => {});
      return res.json(file);
    }
    if (typeof filename === "string" && filename.trim()) {
      const safeName = sanitizeFilename(filename.trim());
      if (!safeName) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      const file = await storage.renameFile(req.params.id, safeName);
      return res.json(file);
    }
    return res.status(400).json({ message: "content or filename required" });
  });

  app.delete("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    const existingFile = await storage.getFile(req.params.id);
    if (!existingFile) {
      return res.status(404).json({ message: "File not found" });
    }
    const project = await storage.getProject(existingFile.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteFile(req.params.id);
    storage.updateStorageUsage(req.session.userId!).catch(() => {});
    return res.json({ message: "File deleted" });
  });

  app.patch("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { name, language } = req.body;
    let safeName = name;
    if (typeof name === "string") {
      safeName = sanitizeProjectName(name);
      if (!safeName) {
        return res.status(400).json({ message: "Invalid project name" });
      }
    }
    const updated = await storage.updateProject(req.params.id, { name: safeName, language });
    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(updated);
  });

  // --- ENV VARS ---
  async function getEnvVarAccessLevel(projectId: string, userId: string | undefined): Promise<"owner" | "collaborator" | "readonly" | "none"> {
    const project = await storage.getProject(projectId);
    if (!project) return "none";
    if (!userId) return "none";
    if (project.userId === userId) return "owner";
    if (project.teamId) {
      const teams = await storage.getUserTeams(userId);
      const teamMatch = teams.find(t => t.id === project.teamId);
      if (teamMatch) {
        if (teamMatch.role === "owner" || teamMatch.role === "admin" || teamMatch.role === "member") {
          return "collaborator";
        }
        return "readonly";
      }
    }
    if (project.isPublished) return "readonly";
    return "none";
  }

  app.get("/api/projects/:projectId/env-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const userId = req.session.userId!;
    const accessLevel = await getEnvVarAccessLevel(req.params.projectId, userId);
    if (accessLevel === "none") {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVars = await storage.getProjectEnvVars(req.params.projectId);
    if (accessLevel === "readonly") {
      return res.json(envVars.map(ev => ({
        id: ev.id,
        projectId: ev.projectId,
        key: ev.key,
        encryptedValue: "••••••••",
        createdAt: ev.createdAt,
      })));
    }
    const decrypted = envVars.map(ev => ({
      ...ev,
      encryptedValue: decrypt(ev.encryptedValue),
    }));
    return res.json(decrypted);
  });

  app.post("/api/projects/:projectId/env-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { key, value } = req.body;
    if (!key || typeof key !== "string" || !value || typeof value !== "string") {
      return res.status(400).json({ message: "key and value are required" });
    }
    const sanitizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!sanitizedKey || sanitizedKey.length > 100) {
      return res.status(400).json({ message: "Invalid key name" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    try {
      const envVar = await storage.createProjectEnvVar(req.params.projectId, sanitizedKey, value);
      return res.status(201).json({ ...envVar, encryptedValue: value });
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ message: `Variable "${sanitizedKey}" already exists` });
      }
      return res.status(500).json({ message: "Failed to create env var" });
    }
  });

  app.patch("/api/projects/:projectId/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVar = await storage.getProjectEnvVar(req.params.id);
    if (!envVar || envVar.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Env var not found" });
    }
    const { value } = req.body;
    if (!value || typeof value !== "string") {
      return res.status(400).json({ message: "value is required" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    const updated = await storage.updateProjectEnvVar(req.params.id, value);
    return res.json(updated ? { ...updated, encryptedValue: value } : updated);
  });

  app.delete("/api/projects/:projectId/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const envVar = await storage.getProjectEnvVar(req.params.id);
    if (!envVar || envVar.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "Env var not found" });
    }
    await storage.deleteProjectEnvVar(req.params.id);
    return res.json({ message: "Env var deleted" });
  });

  app.put("/api/projects/:projectId/env-vars/bulk", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { vars } = req.body;
    if (!vars || typeof vars !== "object") {
      return res.status(400).json({ message: "vars object is required" });
    }
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value !== "string") {
        return res.status(400).json({ message: `Invalid value for key "${key}"` });
      }
      const sanitizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
      if (!sanitizedKey || sanitizedKey.length > 100) {
        return res.status(400).json({ message: `Invalid key name: "${key}"` });
      }
    }
    try {
      const sanitizedVars: Record<string, string> = {};
      for (const [key, value] of Object.entries(vars)) {
        sanitizedVars[key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "")] = value as string;
      }
      const results = await storage.bulkUpsertProjectEnvVars(req.params.projectId, sanitizedVars);
      const decrypted = results.map(ev => ({ ...ev, encryptedValue: decrypt(ev.encryptedValue) }));
      return res.json(decrypted);
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to bulk update env vars" });
    }
  });

  // --- ACCOUNT ENV VARS ---
  app.get("/api/account/env-vars", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const envVars = await storage.getAccountEnvVars(userId);
    const decrypted = envVars.map(ev => ({
      ...ev,
      encryptedValue: decrypt(ev.encryptedValue),
    }));
    return res.json(decrypted);
  });

  app.post("/api/account/env-vars", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const { key, value } = req.body;
    if (!key || typeof key !== "string" || !value || typeof value !== "string") {
      return res.status(400).json({ message: "key and value are required" });
    }
    const sanitizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!sanitizedKey || sanitizedKey.length > 100) {
      return res.status(400).json({ message: "Invalid key name" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    try {
      const envVar = await storage.createAccountEnvVar(userId, sanitizedKey, value);
      return res.status(201).json({ ...envVar, encryptedValue: value });
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ message: `Account variable "${sanitizedKey}" already exists` });
      }
      return res.status(500).json({ message: "Failed to create account env var" });
    }
  });

  app.patch("/api/account/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const envVar = await storage.getAccountEnvVar(req.params.id);
    if (!envVar || envVar.userId !== userId) {
      return res.status(404).json({ message: "Account env var not found" });
    }
    const { value } = req.body;
    if (!value || typeof value !== "string") {
      return res.status(400).json({ message: "value is required" });
    }
    if (value.length > 10000) {
      return res.status(400).json({ message: "Value too long" });
    }
    const updated = await storage.updateAccountEnvVar(req.params.id, value);
    return res.json(updated ? { ...updated, encryptedValue: value } : updated);
  });

  app.delete("/api/account/env-vars/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const envVar = await storage.getAccountEnvVar(req.params.id);
    if (!envVar || envVar.userId !== userId) {
      return res.status(404).json({ message: "Account env var not found" });
    }
    await storage.deleteAccountEnvVar(req.params.id);
    return res.json({ message: "Account env var deleted" });
  });

  app.get("/api/account/env-vars/:id/links", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const envVar = await storage.getAccountEnvVar(req.params.id);
    if (!envVar || envVar.userId !== userId) {
      return res.status(404).json({ message: "Account env var not found" });
    }
    const projectIds = await storage.getLinkedProjectIds(req.params.id);
    return res.json(projectIds);
  });

  app.post("/api/account/env-vars/:id/link", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const envVar = await storage.getAccountEnvVar(req.params.id);
    if (!envVar || envVar.userId !== userId) {
      return res.status(404).json({ message: "Account env var not found" });
    }
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== userId) {
      return res.status(403).json({ message: "Access denied to project" });
    }
    try {
      const link = await storage.linkAccountEnvVar(req.params.id, projectId);
      return res.status(201).json(link);
    } catch (err: any) {
      if (err.message?.includes("unique") || err.code === "23505") {
        return res.status(409).json({ message: "Already linked to this project" });
      }
      return res.status(500).json({ message: "Failed to link" });
    }
  });

  app.delete("/api/account/env-vars/:id/link/:projectId", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const envVar = await storage.getAccountEnvVar(req.params.id);
    if (!envVar || envVar.userId !== userId) {
      return res.status(404).json({ message: "Account env var not found" });
    }
    await storage.unlinkAccountEnvVar(req.params.id, req.params.projectId);
    return res.json({ message: "Unlinked" });
  });

  app.get("/api/projects/:projectId/linked-account-vars", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const links = await storage.getAccountEnvVarLinks(req.params.projectId);
    const decrypted = links.map(l => ({
      ...l,
      encryptedValue: decrypt(l.encryptedValue),
    }));
    return res.json(decrypted);
  });

  app.post("/api/projects/:projectId/provision-database-secrets", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { databaseUrl } = req.body;
    if (!databaseUrl || typeof databaseUrl !== "string") {
      return res.status(400).json({ message: "databaseUrl is required in request body" });
    }
    try {
      const url = new URL(databaseUrl);
      const dbSecrets: Record<string, string> = {
        DATABASE_URL: databaseUrl,
        PGHOST: url.hostname,
        PGUSER: url.username,
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: url.pathname.slice(1),
        PGPORT: url.port || "5432",
      };
      const results = await storage.bulkUpsertProjectEnvVars(req.params.projectId, dbSecrets);
      const decrypted = results.map(ev => ({ ...ev, encryptedValue: decrypt(ev.encryptedValue) }));
      return res.json(decrypted);
    } catch (err: any) {
      if (err instanceof TypeError && err.message.includes("URL")) {
        return res.status(400).json({ message: "Invalid database URL format" });
      }
      return res.status(500).json({ message: "Failed to provision database secrets" });
    }
  });

  // --- RUNS ---
  app.post("/api/projects/:projectId/run", requireAuth, runLimiter, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const clientIp = getClientIp(req);

    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many executions from this IP. Please wait.",
        retryAfterMs: ipCheck.retryAfterMs,
      });
    }

    const userCheck = checkUserRateLimit(userId);
    if (!userCheck.allowed) {
      return res.status(429).json({
        message: "Execution rate limit exceeded. Please wait.",
        retryAfterMs: userCheck.retryAfterMs,
      });
    }

    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.userId !== userId && !project.isDemo) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { code, language, fileName } = req.body;
    if (code === undefined || code === null || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    const quotaCheck = await storage.incrementExecution(userId);
    if (!quotaCheck.allowed) {
      return res.status(429).json({ message: "Daily execution limit reached. Upgrade to Pro for more." });
    }

    try {
      await acquireExecutionSlot(userId);
    } catch (err: any) {
      return res.status(429).json({ message: err.message });
    }

    const startTime = Date.now();

    const run = await storage.createRun(userId, {
      projectId: project.id,
      language,
      code,
    });

    const commandLabel = fileName ? `run ${fileName}` : `run ${language}`;
    const consoleRun = await storage.createConsoleRun({
      projectId: project.id,
      command: commandLabel,
    });

    broadcastToProject(project.id, {
      type: "run_status",
      runId: run.id,
      consoleRunId: consoleRun.id,
      status: "running",
    });

    res.status(202).json({ runId: run.id, consoleRunId: consoleRun.id, status: "running" });

    const codeHash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);

    const projectEnvVarsList = await storage.getProjectEnvVars(project.id);
    const envVarsMap: Record<string, string> = {};
    for (const ev of projectEnvVarsList) {
      envVarsMap[ev.key] = decrypt(ev.encryptedValue);
    }
    const integrationEnvVars = await getIntegrationEnvVars(project.id);
    Object.assign(envVarsMap, integrationEnvVars);

    const linkedAccountVars = await storage.getAccountEnvVarLinks(project.id);
    for (const link of linkedAccountVars) {
      if (!(link.key in envVarsMap)) {
        envVarsMap[link.key] = decrypt(link.encryptedValue);
      }
    }

    envVarsMap["REPLIT_DOMAINS"] = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost";
    const user = await storage.getUser(userId);
    envVarsMap["REPLIT_USER"] = user?.displayName || user?.email || userId;

    const consoleLogBuffer: { id: number; text: string; type: "info" | "error" | "success" }[] = [];
    let logIdCounter = 0;
    let lastFlushLen = 0;
    const LOG_FLUSH_INTERVAL = 3000;

    const flushLogs = () => {
      if (consoleLogBuffer.length > lastFlushLen) {
        lastFlushLen = consoleLogBuffer.length;
        storage.updateConsoleRun(consoleRun.id, {
          logs: consoleLogBuffer.slice(0, 5000),
        }).catch(() => {});
      }
    };
    const flushTimer = setInterval(flushLogs, LOG_FLUSH_INTERVAL);

    try {
      const result = await executionPool.submit(userId, project.id, code, language, (message, type) => {
        consoleLogBuffer.push({ id: logIdCounter++, text: message, type });
        broadcastToProject(project.id, {
          type: "run_log",
          runId: run.id,
          message,
          logType: type,
          timestamp: Date.now(),
        });
      }, envVarsMap);
      clearInterval(flushTimer);

      const durationMs = Date.now() - startTime;
      const failed = result.exitCode !== 0;
      recordExecution(userId, clientIp, durationMs, failed);

      storage.createExecutionLog({
        userId,
        projectId: project.id,
        language,
        exitCode: result.exitCode,
        durationMs,
        securityViolation: result.securityViolation || null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      await storage.updateRun(run.id, {
        status: failed ? "failed" : "completed",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        finishedAt: new Date(),
      });

      const exitMsg = failed
        ? `\x1b[31m✗ Process failed with code ${result.exitCode}\x1b[0m`
        : `\x1b[32m✓ Process exited with code ${result.exitCode}\x1b[0m`;
      consoleLogBuffer.push({ id: logIdCounter++, text: exitMsg, type: failed ? "error" : "success" });

      storage.updateConsoleRun(consoleRun.id, {
        status: failed ? "failed" : "completed",
        exitCode: result.exitCode,
        logs: consoleLogBuffer.slice(0, 5000),
        finishedAt: new Date(),
      }).catch(() => {});

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        consoleRunId: consoleRun.id,
        status: failed ? "failed" : "completed",
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      clearInterval(flushTimer);
      const durationMs = Date.now() - startTime;
      recordExecution(userId, clientIp, durationMs, true);

      storage.createExecutionLog({
        userId,
        projectId: project.id,
        language,
        exitCode: 1,
        durationMs,
        securityViolation: null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      await storage.updateRun(run.id, {
        status: "failed",
        stderr: error.message,
        exitCode: 1,
        finishedAt: new Date(),
      });

      consoleLogBuffer.push({ id: logIdCounter++, text: error.message, type: "error" });
      consoleLogBuffer.push({ id: logIdCounter++, text: `\x1b[31m✗ Process failed with code 1\x1b[0m`, type: "error" });

      storage.updateConsoleRun(consoleRun.id, {
        status: "failed",
        exitCode: 1,
        logs: consoleLogBuffer.slice(0, 5000),
        finishedAt: new Date(),
      }).catch(() => {});

      broadcastToProject(project.id, {
        type: "run_status",
        runId: run.id,
        consoleRunId: consoleRun.id,
        status: "failed",
        exitCode: 1,
      });
    } finally {
      releaseExecutionSlot(userId);
    }
  });

  app.get("/api/projects/:projectId/runs", requireAuth, async (req: Request, res: Response) => {
    const runList = await storage.getRunsByProject(req.params.projectId);
    return res.json(runList);
  });

  app.get("/api/projects/:projectId/console-runs", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
    const limit = parseInt(req.query.limit as string) || 50;
    const runs = await storage.getConsoleRunsByProject(project.id, limit);
    return res.json(runs);
  });

  app.post("/api/projects/:projectId/console-runs", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
    const { command } = req.body;
    if (!command) return res.status(400).json({ message: "command is required" });
    const run = await storage.createConsoleRun({ projectId: project.id, command });
    return res.status(201).json(run);
  });

  app.patch("/api/console-runs/:id", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const run = await storage.getConsoleRun(req.params.id);
    if (!run) return res.status(404).json({ message: "Console run not found" });
    const project = await storage.getProject(run.projectId);
    if (!project || project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
    const { status, logs, exitCode, finishedAt } = req.body;
    const validStatuses = ["running", "completed", "failed"];
    const updates: any = {};
    if (status !== undefined && validStatuses.includes(status)) updates.status = status;
    if (logs !== undefined && Array.isArray(logs)) updates.logs = logs.slice(0, 5000);
    if (exitCode !== undefined && typeof exitCode === "number") updates.exitCode = exitCode;
    if (finishedAt !== undefined) updates.finishedAt = new Date(finishedAt);
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No valid fields to update" });
    const updated = await storage.updateConsoleRun(run.id, updates);
    return res.json(updated);
  });

  app.post("/api/projects/:projectId/stop", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
    const cancelled = executionPool.cancelProjectExecution(project.id);
    return res.json({ stopped: cancelled });
  });

  app.delete("/api/projects/:projectId/console-runs", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
    const excludeRunId = req.query.excludeRunId as string | undefined;
    await storage.clearConsoleRuns(project.id, excludeRunId);
    return res.json({ success: true });
  });

  app.get("/api/execution-metrics", requireAuth, async (req: Request, res: Response) => {
    const metrics = getExecutionMetrics(req.session.userId!);
    return res.json(metrics);
  });

  app.get("/api/projects/:projectId/poll", requireAuth, async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.userId !== req.session.userId && !project.isDemo && !project.isPublished) {
      return res.status(403).json({ message: "Access denied" });
    }
    const since = parseInt(req.query.since as string) || 0;
    const broadcasts = recentBroadcasts.get(projectId) || [];
    const newMessages = broadcasts
      .filter(b => b.timestamp > since)
      .map(b => b.data);
    return res.json({ messages: newMessages, timestamp: Date.now() });
  });

  // --- DEMO ---
  app.get("/api/demo/project", async (_req: Request, res: Response) => {
    const project = await storage.getDemoProject();
    if (!project) {
      return res.status(404).json({ message: "No demo project available" });
    }
    const fileList = await storage.getFiles(project.id);
    return res.json({ project, files: fileList });
  });

  app.post("/api/demo/run", runLimiter, async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);

    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        message: "Too many executions from this IP. Please wait.",
        retryAfterMs: ipCheck.retryAfterMs,
      });
    }

    const demoUserId = `demo-${clientIp}`;
    const userCheck = checkUserRateLimit(demoUserId);
    if (!userCheck.allowed) {
      return res.status(429).json({
        message: "Execution rate limit exceeded. Please wait.",
        retryAfterMs: userCheck.retryAfterMs,
      });
    }

    const { code, language } = req.body;
    if (code === undefined || code === null || !language) {
      return res.status(400).json({ message: "Code and language are required" });
    }

    try {
      await acquireExecutionSlot(demoUserId);
    } catch (err: any) {
      return res.status(429).json({ message: err.message });
    }

    const startTime = Date.now();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);
    const demoEnvVars: Record<string, string> = {
      REPLIT_DOMAINS: process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost",
    };
    try {
      const result = await executeCode(code, language, undefined, undefined, undefined, demoEnvVars);
      const durationMs = Date.now() - startTime;
      recordExecution(demoUserId, clientIp, durationMs, result.exitCode !== 0);

      storage.createExecutionLog({
        userId: null,
        projectId: null,
        language,
        exitCode: result.exitCode,
        durationMs,
        securityViolation: result.securityViolation || null,
        codeHash,
        ipAddress: clientIp,
      }).catch(() => {});

      return res.json({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      recordExecution(demoUserId, clientIp, durationMs, true);
      return res.status(500).json({ message: "Execution failed" });
    } finally {
      releaseExecutionSlot(demoUserId);
    }
  });

  // --- PUBLISH / SHARE ---
  app.post("/api/projects/:id/publish", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.publishProject(req.params.id, req.session.userId!);
    if (!project) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    return res.json(project);
  });

  app.get("/api/shared/:id", async (req: Request, res: Response) => {
    const result = await storage.getPublishedProject(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Project not found or not published" });
    }
    return res.json(result);
  });

  // --- DEVELOPER FRAMEWORKS ---
  app.get("/api/frameworks", async (req: Request, res: Response) => {
    const { search, category, language } = req.query;
    const frameworks = await storage.getFrameworks({
      search: search as string | undefined,
      category: category as string | undefined,
      language: language as string | undefined,
    });
    return res.json(frameworks);
  });

  app.get("/api/frameworks/:id", async (req: Request, res: Response) => {
    const framework = await storage.getFramework(req.params.id);
    if (!framework) {
      return res.status(404).json({ message: "Framework not found" });
    }
    const frameworkFiles = await storage.getFiles(req.params.id);
    const updates = await storage.getFrameworkUpdates(req.params.id);
    return res.json({ ...framework, files: frameworkFiles, updates });
  });

  app.post("/api/projects/:id/publish-as-framework", requireAuth, async (req: Request, res: Response) => {
    const frameworkPublishSchema = z.object({
      description: z.string().max(500).optional(),
      category: z.enum(["frontend", "backend", "fullstack", "systems", "scripting", "other"]).optional(),
      coverUrl: z.string().url().max(500).optional().or(z.literal("")),
    });
    const parsed = frameworkPublishSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const { description, category, coverUrl } = parsed.data;
    const project = await storage.publishAsFramework(req.params.id, req.session.userId!, {
      description, category, coverUrl: coverUrl || undefined,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    return res.json(project);
  });

  app.post("/api/projects/:id/unpublish-framework", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.unpublishFramework(req.params.id, req.session.userId!);
    if (!project) {
      return res.status(404).json({ message: "Project not found or not owned" });
    }
    return res.json(project);
  });

  app.get("/api/frameworks/:id/updates", async (req: Request, res: Response) => {
    const framework = await storage.getFramework(req.params.id);
    if (!framework) {
      return res.status(404).json({ message: "Framework not found" });
    }
    const updates = await storage.getFrameworkUpdates(req.params.id);
    return res.json(updates);
  });

  app.post("/api/frameworks/:id/updates", requireAuth, async (req: Request, res: Response) => {
    const framework = await storage.getFramework(req.params.id);
    if (!framework) {
      return res.status(404).json({ message: "Framework not found" });
    }
    if (framework.userId !== req.session.userId) {
      return res.status(403).json({ message: "Not the framework author" });
    }
    const updateSchema = z.object({ message: z.string().min(1).max(2000) });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Message is required (max 2000 chars)", errors: parsed.error.flatten() });
    }
    const update = await storage.createFrameworkUpdate(req.params.id, parsed.data.message);
    return res.json(update);
  });

  // --- GIT VERSION CONTROL (Real Git via isomorphic-git) ---

  app.get("/api/projects/:projectId/git/commits", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const branchName = req.query.branch as string | undefined;
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const logs = await gitService.getLog(req.params.projectId, branchName);
      const commitList = logs.map(entry => ({
        id: entry.sha,
        projectId: req.params.projectId,
        branchName: branchName || "main",
        message: entry.message,
        authorId: entry.author,
        parentCommitId: entry.parentSha,
        createdAt: entry.date,
      }));
      return res.json(commitList);
    } catch (err: any) {
      return res.json([]);
    }
  });

  app.get("/api/projects/:projectId/git/commits/:commitId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const logs = await gitService.getLog(req.params.projectId, undefined, 200);
      const entry = logs.find(l => l.sha === req.params.commitId);
      if (!entry) {
        return res.status(404).json({ message: "Commit not found" });
      }
      return res.json({
        id: entry.sha,
        projectId: req.params.projectId,
        branchName: "main",
        message: entry.message,
        authorId: entry.author,
        parentCommitId: entry.parentSha,
        createdAt: entry.date,
      });
    } catch {
      return res.status(404).json({ message: "Commit not found" });
    }
  });

  app.post("/api/projects/:projectId/git/commits", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { message, branchName = "main", files: selectedFiles } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Commit message is required" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      if (branchName && branchName !== "main") {
        try {
          await gitService.checkoutBranch(req.params.projectId, branchName);
        } catch {
          await gitService.createBranch(req.params.projectId, branchName);
          await gitService.checkoutBranch(req.params.projectId, branchName);
        }
      }

      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const validFiles = Array.isArray(selectedFiles) ? selectedFiles.filter((f: unknown) => typeof f === "string") : undefined;
      const result = await gitService.addAndCommit(req.params.projectId, message.trim(), authorName, authorEmail, validFiles);

      const snapshot: Record<string, string> = {};
      for (const f of dbFiles) {
        snapshot[f.filename] = f.content;
      }
      let branch = await storage.getBranch(req.params.projectId, branchName);
      if (!branch) {
        branch = await storage.createBranch({
          projectId: req.params.projectId,
          name: branchName,
          isDefault: branchName === "main",
        });
      }
      const dbCommit = await storage.createCommit({
        projectId: req.params.projectId,
        branchName,
        message: message.trim(),
        authorId: req.session.userId!,
        parentCommitId: branch.headCommitId || undefined,
        snapshot,
      });
      await storage.updateBranchHead(branch.id, dbCommit.id);
      await persistRepoState(req.params.projectId);

      return res.status(201).json({
        id: result.sha,
        dbId: dbCommit.id,
        projectId: req.params.projectId,
        branchName,
        message: message.trim(),
        authorId: req.session.userId!,
        sha: result.sha,
        createdAt: result.date,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Commit failed";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/projects/:projectId/git/branches", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const gitBranches = await gitService.listBranches(req.params.projectId);
      const branchList: Array<Record<string, unknown>> = [];
      for (const b of gitBranches) {
        let headCommitId: string | null = null;
        try {
          const commits = await gitService.getLog(req.params.projectId, b.name, 1);
          if (commits.length > 0) headCommitId = commits[0].sha;
        } catch {}
        branchList.push({
          id: `git-branch-${b.name}`,
          projectId: req.params.projectId,
          name: b.name,
          headCommitId,
          isDefault: b.name === "main",
          current: b.current,
          createdAt: new Date().toISOString(),
        });
      }
      if (branchList.length === 0) {
        branchList.push({
          id: "git-branch-main",
          projectId: req.params.projectId,
          name: "main",
          headCommitId: null,
          isDefault: true,
          current: true,
          createdAt: new Date().toISOString(),
        });
      }
      return res.json(branchList);
    } catch {
      return res.json([{ id: "git-branch-main", projectId: req.params.projectId, name: "main", headCommitId: null, isDefault: true, current: true, createdAt: new Date().toISOString() }]);
    }
  });

  app.post("/api/projects/:projectId/git/branches", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { name, fromBranch = "main" } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      await gitService.createBranch(req.params.projectId, name.trim(), fromBranch);
      await persistRepoState(req.params.projectId);
      return res.status(201).json({
        id: `git-branch-${name.trim()}`,
        projectId: req.params.projectId,
        name: name.trim(),
        headCommitId: null,
        isDefault: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to create branch";
      if (errMsg.includes("already exists")) {
        return res.status(409).json({ message: "Branch already exists" });
      }
      return res.status(500).json({ message: errMsg });
    }
  });

  app.delete("/api/projects/:projectId/git/branches/:branchId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }

    const branchName = req.params.branchId.replace(/^git-branch-/, "");
    if (branchName === "main") {
      return res.status(400).json({ message: "Cannot delete the default branch" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      await gitService.deleteBranch(req.params.projectId, branchName);
      await persistRepoState(req.params.projectId);
      return res.json({ success: true });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete branch";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.post("/api/projects/:projectId/git/checkout", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { commitId, branchName } = req.body;

    if (!commitId && !branchName) {
      return res.status(400).json({ message: "commitId or branchName is required" });
    }

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", `Before git checkout ${commitId ? commitId.slice(0, 7) : branchName}`).catch(() => {});

      if (commitId) {
        await gitService.checkoutCommit(req.params.projectId, commitId);
      } else if (branchName) {
        await gitService.checkoutBranch(req.params.projectId, branchName);
      }

      const workingFiles = gitService.getWorkingTreeFiles(req.params.projectId);

      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of workingFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await persistRepoState(req.params.projectId);
      return res.json({ success: true, filesRestored: workingFiles.length });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Checkout failed";
      return res.status(500).json({ message: errMsg });
    }
  });

  app.get("/api/projects/:projectId/git/diff", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = (req.query.branch as string) || "main";

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const diff = await gitService.getDiff(req.params.projectId, branchName);
      return res.json(diff);
    } catch {
      return res.json({ branch: branchName, changes: [], hasCommits: false });
    }
  });

  app.get("/api/projects/:projectId/git/blame/:filename", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const branchName = (req.query.branch as string) || "main";
    const filename = decodeURIComponent(req.params.filename);

    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const blame = await gitService.getBlame(req.params.projectId, filename, branchName);
      if (blame.length === 0) {
        return res.status(404).json({ message: "File not found" });
      }
      return res.json({ filename, blame });
    } catch {
      return res.status(404).json({ message: "File not found" });
    }
  });

  // --- GitHub Sync Routes ---

  app.post("/api/projects/:projectId/git/connect-github", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { repoFullName } = req.body;
    if (!repoFullName || typeof repoFullName !== "string" || !repoFullName.includes("/")) {
      return res.status(400).json({ message: "Valid repository name (owner/repo) is required" });
    }

    try {
      const [owner, repo] = repoFullName.split("/");
      await github.getRepo(owner, repo);
      await storage.updateProject(req.params.projectId, { githubRepo: repoFullName });
      return res.json({ success: true, githubRepo: repoFullName });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to connect repository" });
    }
  });

  app.delete("/api/projects/:projectId/git/connect-github", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    await storage.updateProject(req.params.projectId, { githubRepo: "" });
    return res.json({ success: true });
  });

  app.get("/api/projects/:projectId/git/github-status", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const githubRepo = project.githubRepo;
    if (!githubRepo) {
      return res.json({ connected: false, githubRepo: null, ahead: 0, behind: 0 });
    }

    let ahead = 0;
    let behind = 0;
    try {
      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));
      const url = `https://github.com/${githubRepo}.git`;
      const httpTransport = github.createGitHttpTransport();
      const currentBranch = await gitService.getCurrentBranch(req.params.projectId);
      const status = await gitService.getRemoteStatus(req.params.projectId, url, { httpTransport, branch: currentBranch });
      ahead = status.ahead;
      behind = status.behind;
    } catch {
    }

    return res.json({ connected: true, githubRepo, ahead, behind });
  });

  app.post("/api/projects/:projectId/git/push", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const githubRepo = project.githubRepo;
    if (!githubRepo) {
      return res.status(400).json({ message: "No GitHub repository connected" });
    }

    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });

      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      const url = `https://github.com/${githubRepo}.git`;
      const httpTransport = github.createGitHttpTransport();

      const currentBranch = await gitService.getCurrentBranch(req.params.projectId);
      const result = await gitService.pushToRemote(req.params.projectId, url, {
        httpTransport,
        branch: currentBranch,
      });

      if (!result.ok) {
        return res.status(500).json({ message: result.error || "Push failed" });
      }

      await persistRepoState(req.params.projectId);
      return res.json({ success: true, filesPushed: dbFiles.length, filesDeleted: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Push failed";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/pull", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const githubRepo = project.githubRepo;
    if (!githubRepo) {
      return res.status(400).json({ message: "No GitHub repository connected" });
    }

    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });

      const dbFiles = await storage.getFiles(req.params.projectId);
      await ensureRepoWithPersistence(req.params.projectId, dbFiles.map(f => ({ filename: f.filename, content: f.content })));

      const url = `https://github.com/${githubRepo}.git`;
      const httpTransport = github.createGitHttpTransport();

      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", "Before git pull").catch(() => {});

      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const currentBranch = await gitService.getCurrentBranch(req.params.projectId);
      const result = await gitService.pullFromRemoteWithConflicts(req.params.projectId, url, {
        httpTransport,
        authorName,
        authorEmail,
        branch: currentBranch,
      });

      if (!result.ok && result.conflicts && result.conflicts.length > 0) {
        return res.status(409).json({
          message: "Merge conflicts detected",
          conflicts: result.conflicts,
        });
      }

      if (!result.ok) {
        return res.status(500).json({ message: result.error || "Pull failed" });
      }

      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of result.files) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await persistRepoState(req.params.projectId);
      return res.json({ success: true, filesPulled: result.files.length, skipped: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Pull failed";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/projects/:projectId/git/resolve-conflicts", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { resolvedFiles } = req.body;
    if (!Array.isArray(resolvedFiles) || resolvedFiles.length === 0) {
      return res.status(400).json({ message: "resolvedFiles array is required" });
    }

    try {
      const user = await storage.getUser(req.session.userId!);
      const authorName = user?.displayName || user?.email || "User";
      const authorEmail = user?.email || "user@ide.local";

      const result = await gitService.resolveConflicts(
        req.params.projectId,
        resolvedFiles,
        authorName,
        authorEmail,
      );

      const updatedFiles = gitService.getWorkingTreeFiles(req.params.projectId);
      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of updatedFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      await persistRepoState(req.params.projectId);
      return res.json({ success: true, sha: result.sha });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Conflict resolution failed";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/projects/:projectId/git/state-hash", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }

    try {
      const hash = await gitService.getGitStateHash(req.params.projectId);
      return res.json({ hash });
    } catch {
      return res.json({ hash: "unknown" });
    }
  });

  app.post("/api/projects/:projectId/git/clone", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { owner, repo } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ message: "owner and repo are required" });
    }

    try {
      const ghUser = await github.getAuthenticatedUser();
      if (!ghUser) return res.status(401).json({ message: "GitHub not connected" });

      const url = `https://github.com/${owner}/${repo}.git`;
      const httpTransport = github.createGitHttpTransport();

      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", `Before cloning ${owner}/${repo}`).catch(() => {});

      const clonedFiles = await gitService.cloneRepo(req.params.projectId, url, {
        httpTransport,
      });

      const currentFiles = await storage.getFiles(req.params.projectId);
      for (const f of currentFiles) {
        await storage.deleteFile(f.id);
      }
      for (const { filename, content } of clonedFiles) {
        await storage.createFile(req.params.projectId, { filename, content });
      }

      const repoFullName = `${owner}/${repo}`;
      await storage.updateProject(req.params.projectId, { githubRepo: repoFullName });
      await persistRepoState(req.params.projectId);

      return res.json({ success: true, filesCloned: clonedFiles.length, githubRepo: repoFullName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Clone failed";
      return res.status(500).json({ message });
    }
  });

  // --- WORKSPACE / RUNNER ---
  app.get("/api/runner/status", requireAuth, async (_req: Request, res: Response) => {
    const online = await runnerClient.ping();
    return res.json({ online, baseUrl: runnerClient.getBaseUrl() });
  });

  app.post("/api/workspaces/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }

    const online = await runnerClient.ping();
    if (!online) {
      return res.json({ workspaceId: null, runnerUrl: runnerClient.getBaseUrl(), token: null, online: false });
    }

    let workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      workspace = await storage.createWorkspace({ projectId: project.id, ownerUserId: req.session.userId! });
      try {
        await runnerClient.createWorkspace(workspace.id, project.language);
      } catch (err: any) {
        log(`Runner createWorkspace error: ${err.message}`, "runner");
        await storage.updateWorkspaceStatus(workspace.id, "error");
        return res.json({ workspaceId: workspace.id, runnerUrl: runnerClient.getBaseUrl(), token: null, online: true, error: "Failed to provision workspace on runner" });
      }
    }

    let token: string | null = null;
    try {
      token = runnerClient.generateToken(workspace.id, req.session.userId!);
    } catch (err: any) {
      log(`Token generation error: ${err.message}`, "runner");
      return res.json({ workspaceId: workspace.id, runnerUrl: runnerClient.getBaseUrl(), token: null, online: true, error: "JWT secret not configured" });
    }

    const ttl = parseInt(process.env.WORKSPACE_TOKEN_TTL_MIN || "15", 10);
    await storage.createWorkspaceSession({
      workspaceId: workspace.id,
      userId: req.session.userId!,
      expiresAt: new Date(Date.now() + ttl * 60 * 1000),
    });

    await storage.touchWorkspace(workspace.id);

    return res.json({
      workspaceId: workspace.id,
      runnerUrl: runnerClient.getBaseUrl(),
      token,
      online: true,
    });
  });

  app.post("/api/workspaces/:projectId/start", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    try {
      await runnerClient.startWorkspace(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, "running");
      return res.json({ status: "running" });
    } catch (err: any) {
      log(`Runner start error: ${err.message}`, "runner");
      return res.status(502).json({ message: "Runner unavailable" });
    }
  });

  app.post("/api/workspaces/:projectId/stop", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    try {
      await runnerClient.stopWorkspace(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, "stopped");
      return res.json({ status: "stopped" });
    } catch (err: any) {
      log(`Runner stop error: ${err.message}`, "runner");
      return res.status(502).json({ message: "Runner unavailable" });
    }
  });

  app.get("/api/workspaces/:projectId/status", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.json({ status: "none" });
    }
    try {
      const status = await runnerClient.getWorkspaceStatus(workspace.id);
      await storage.updateWorkspaceStatus(workspace.id, status);
      return res.json({ status, workspaceId: workspace.id });
    } catch {
      return res.json({ status: workspace.statusCache || "offline", workspaceId: workspace.id });
    }
  });

  app.get("/api/workspaces/:projectId/terminal-url", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const host = req.headers.host || "localhost:5000";
    const sessionId = (req.query.sessionId as string) || "default";
    const wsUrl = `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(sessionId)}`;
    return res.json({ wsUrl, workspaceId: project.id });
  });

  app.get("/api/workspaces/:projectId/terminal-sessions", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const sessionsList = listTerminalSessions(project.id, req.session.userId!);
    return res.json({ sessions: sessionsList });
  });

  app.post("/api/workspaces/:projectId/terminal-sessions", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const sessionId = req.body.sessionId || `shell-${Date.now()}`;

    try {
      const projectEnvVarsList = await storage.getProjectEnvVars(project.id);
      const envVarsMap: Record<string, string> = {};
      for (const ev of projectEnvVarsList) {
        envVarsMap[ev.key] = decrypt(ev.encryptedValue);
      }
      const linkedAccountVars = await storage.getAccountEnvVarLinks(project.id);
      for (const link of linkedAccountVars) {
        if (!(link.key in envVarsMap)) {
          envVarsMap[link.key] = decrypt(link.encryptedValue);
        }
      }
      envVarsMap["REPLIT_DOMAINS"] = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost";
      const termUser = await storage.getUser(req.session.userId!);
      envVarsMap["REPLIT_USER"] = termUser?.displayName || termUser?.email || req.session.userId!;

      createTerminalSession(project.id, req.session.userId!, sessionId, envVarsMap);
    } catch (err: any) {
      log(`Failed to pre-create terminal session: ${err.message}`, "terminal");
    }

    const protocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const host = req.headers.host || "localhost:5000";
    const wsUrl = `${protocol}://${host}/ws/terminal?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(sessionId)}`;
    return res.json({ sessionId, wsUrl });
  });

  app.put("/api/workspaces/:projectId/terminal-sessions/:sessionId/select", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const found = setSessionSelected(project.id, req.session.userId!, req.params.sessionId);
    if (!found) {
      return res.status(404).json({ message: "Terminal session not found" });
    }
    return res.json({ success: true });
  });

  app.delete("/api/workspaces/:projectId/terminal-sessions/:sessionId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    destroyTerminalSession(project.id, req.session.userId!, req.params.sessionId);
    return res.json({ success: true });
  });

  const getWorkspaceForProject = async (req: Request, res: Response): Promise<{ project: any; workspace: any } | null> => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      res.status(404).json({ message: "Project not found" });
      return null;
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      res.status(404).json({ message: "Workspace not initialized" });
      return null;
    }
    return { project, workspace };
  };

  app.get("/api/workspaces/:projectId/fs", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const path = (req.query.path as string) || "/";
      const entries = await runnerClient.fsList(ctx.workspace.id, path);
      return res.json(entries);
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.get("/api/workspaces/:projectId/fs/read", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const path = req.query.path as string;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      const content = await runnerClient.fsRead(ctx.workspace.id, path);
      return res.json({ content });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.post("/api/workspaces/:projectId/fs/write", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { path, content } = req.body;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      await runnerClient.fsWrite(ctx.workspace.id, path, content ?? "");
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.post("/api/workspaces/:projectId/fs/mkdir", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { path } = req.body;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      await runnerClient.fsMkdir(ctx.workspace.id, path);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.delete("/api/workspaces/:projectId/fs/rm", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { path } = req.body;
      if (!path || !validateRunnerPath(path)) return res.status(400).json({ message: "Invalid path" });
      await createCheckpoint(req.params.projectId, req.session.userId!, "pre_risky_op", `Before deleting ${path}`).catch(() => {});
      await runnerClient.fsRm(ctx.workspace.id, path);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.post("/api/workspaces/:projectId/fs/rename", requireAuth, async (req: Request, res: Response) => {
    const ctx = await getWorkspaceForProject(req, res);
    if (!ctx) return;
    try {
      const { oldPath, newPath } = req.body;
      if (!oldPath || !newPath || !validateRunnerPath(oldPath) || !validateRunnerPath(newPath)) {
        return res.status(400).json({ message: "Invalid path" });
      }
      await runnerClient.fsRename(ctx.workspace.id, oldPath, newPath);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(502).json({ message: err.message });
    }
  });

  app.get("/api/workspaces/:projectId/preview-url", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workspace = await storage.getWorkspaceByProject(project.id);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not initialized" });
    }
    const rawPort = parseInt(req.query.port as string);
    const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3000;
    const url = runnerClient.previewUrl(workspace.id, port);
    return res.json({ previewUrl: url, workspaceId: workspace.id, port });
  });

  app.get("/api/workspaces/:projectId/preview-proxy", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      const workspace = await storage.getWorkspaceByProject(project.id);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not initialized" });
      }
      const rawPort = parseInt(req.query.port as string);
      const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3000;
      const subpath = (req.query.path as string) || "/";
      const result = await runnerClient.fetchPreviewContent(workspace.id, port, subpath);
      const isHtml = result.contentType.includes("text/html");
      if (isHtml) {
        let html = result.body.toString("utf-8");
        const erudaCdn = "https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js";
        const snippet = `<script src="${erudaCdn}"></script><script>if(typeof eruda!=='undefined'){eruda.init();eruda.show();}</script>`;
        if (!html.includes("eruda")) {
          const bodyIdx = html.lastIndexOf("</body>");
          if (bodyIdx !== -1) {
            html = html.slice(0, bodyIdx) + snippet + html.slice(bodyIdx);
          } else {
            html += snippet;
          }
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(result.status).send(html);
      }
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      }
      return res.status(result.status).send(result.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Preview proxy failed";
      return res.status(502).json({ message });
    }
  });

  app.get("/api/workspaces/:projectId/preview-proxy/{*path}", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      const workspace = await storage.getWorkspaceByProject(project.id);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not initialized" });
      }
      const rawPort = parseInt(req.query.port as string);
      const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3000;
      const rawPath = req.params.path;
      const subpath = "/" + (Array.isArray(rawPath) ? rawPath.join("/") : rawPath || "");
      const result = await runnerClient.fetchPreviewContent(workspace.id, port, subpath);
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      }
      return res.status(result.status).send(result.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Preview proxy failed";
      return res.status(502).json({ message });
    }
  });

  // --- AI ASSISTANT ---
  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const gemini = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
    },
  });

  app.post("/api/projects/generate", requireAuth, aiGenerateLimiter, async (req: Request, res: Response) => {
    try {
      const { prompt, model: requestedModel } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
        return res.status(400).json({ message: "Please provide a project description (at least 3 characters)" });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ message: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
      }

      const genProjectLimit = await storage.checkProjectLimit(req.session.userId!);
      if (!genProjectLimit.allowed) {
        return res.status(403).json({ message: `Project limit reached (${genProjectLimit.current}/${genProjectLimit.limit}). Upgrade to Pro for more.` });
      }

      const systemPrompt = `You are a senior software engineer. Given a project description, generate a project specification as JSON.

Return ONLY valid JSON (no markdown, no code blocks, no explanation) with this structure:
{
  "name": "project-name-slug",
  "language": "javascript",
  "projectType": "web",
  "files": [
    { "filename": "index.js", "content": "// code" }
  ]
}

Rules:
- name: short kebab-case slug (max 30 chars)
- language: one of javascript, typescript, python
- projectType: "web" for websites/APIs, "mobile-app" for mobile apps
- files: generate 1-3 concise, working files. Keep code SHORT but functional.
- For web apps: put everything in a single HTML file with inline CSS/JS when possible
- For mobile apps: use React Native/Expo with View, Text, TouchableOpacity, StyleSheet.create(). Include app.json with Expo config and package.json with expo/react-native/react-native-web dependencies. Use "typescript" as the language.
- IMPORTANT: Keep total response under 3000 tokens. Prefer fewer, smaller files.
- Do NOT add any text before or after the JSON object`;

      let text = "";

      if (requestedModel === "gemini") {
        const geminiResponse = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\nUser request: " + prompt.trim() }] },
          ],
          config: { maxOutputTokens: 16384 },
        });
        text = geminiResponse.text || "";
      } else if (requestedModel === "gpt") {
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt.trim() },
          ],
          max_completion_tokens: 16384,
        });
        text = gptResponse.choices[0]?.message?.content || "";
      } else {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          system: systemPrompt,
          messages: [{ role: "user", content: prompt.trim() }],
          max_tokens: 16384,
        });
        text = message.content[0].type === "text" ? message.content[0].text : "";
      }
      let spec: { name: string; language: string; projectType?: string; files: { filename: string; content: string }[] };

      log(`AI generate raw response (first 500 chars): ${text.slice(0, 500)}`, "ai");

      let jsonStr = text.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const firstBrace = jsonStr.indexOf("{");
        const lastBrace = jsonStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
        }
      }

      function sanitizeJsonString(str: string): string {
        return str.replace(/[\x00-\x1F\x7F]/g, (ch) => {
          switch (ch) {
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\b': return '\\b';
            case '\f': return '\\f';
            default: return '';
          }
        });
      }

      function repairAndParseJson(raw: string): any {
        try { return JSON.parse(raw); } catch {}

        let fixed = raw;
        fixed = fixed.replace(/```(?:json)?\s*\n?/g, '').replace(/```/g, '');
        const first = fixed.indexOf('{');
        const last = fixed.lastIndexOf('}');
        if (first !== -1 && last > first) fixed = fixed.slice(first, last + 1);
        try { return JSON.parse(fixed); } catch {}

        const sanitized = fixed.replace(
          /"(?:[^"\\]|\\.)*"/g,
          (match) => {
            try { JSON.parse(match); return match; } catch {}
            let inner = match.slice(1, -1);
            inner = inner.replace(/\\/g, '\\\\');
            inner = inner.replace(/"/g, '\\"');
            inner = inner.replace(/\n/g, '\\n');
            inner = inner.replace(/\r/g, '\\r');
            inner = inner.replace(/\t/g, '\\t');
            return '"' + inner + '"';
          }
        );
        try { return JSON.parse(sanitized); } catch {}

        const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/);
        const langMatch = raw.match(/"language"\s*:\s*"([^"]+)"/);
        const filesRegex = /"filename"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        const files: { filename: string; content: string }[] = [];
        let m;
        while ((m = filesRegex.exec(raw)) !== null) {
          try {
            files.push({ filename: m[1], content: JSON.parse('"' + m[2] + '"') });
          } catch {
            files.push({ filename: m[1], content: m[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"') });
          }
        }
        if (nameMatch && langMatch && files.length > 0) {
          return { name: nameMatch[1], language: langMatch[1], files };
        }

        return null;
      }

      try {
        spec = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        log(`AI JSON parse error: ${parseErr.message}. Attempting recovery...`, "ai");
        const recovered = repairAndParseJson(jsonStr);
        if (recovered && recovered.name && recovered.files?.length) {
          spec = recovered;
          log(`JSON recovery succeeded via repair`, "ai");
        } else {
          log(`Recovery failed. Raw text (first 500): ${text.slice(0, 500)}`, "ai");
          return res.status(500).json({ message: "AI generated invalid project structure. Please try again." });
        }
      }

      if (!spec.name || !spec.language || !spec.files?.length) {
        return res.status(500).json({ message: "AI generated incomplete project. Please try again." });
      }

      const validLangs = ["javascript", "typescript", "python"];
      if (!validLangs.includes(spec.language)) spec.language = "javascript";

      const detectedProjectType = spec.projectType === "mobile-app" ? "mobile-app" : "web";

      const project = await storage.createProject(req.session.userId!, {
        name: spec.name.slice(0, 50),
        language: spec.language,
        projectType: detectedProjectType,
      });

      for (const file of spec.files.slice(0, 10)) {
        const safeFilename = sanitizeAIFilename(file.filename);
        if (!safeFilename || safeFilename === "ecode.md") continue;
        const safeContent = sanitizeAIFileContent(file.content || "");
        await storage.createFile(project.id, {
          filename: safeFilename,
          content: safeContent,
        });
      }

      const files = await storage.getFiles(project.id);

      const conversation = await storage.createConversation({
        projectId: project.id,
        userId: req.session.userId!,
        title: prompt.slice(0, 100),
        model: requestedModel || "gpt",
      });
      await storage.addMessage({
        conversationId: conversation.id,
        role: "user",
        content: prompt,
      });
      const fileList = files.map(f => f.filename).join(", ");
      await storage.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: `I've created your project **${spec.name}** with the following files: ${fileList}.\n\nThe project is set up and ready to go! You can run it or ask me to make any changes.`,
        model: requestedModel || "gpt",
        fileOps: files.map(f => ({ type: "created" as const, filename: f.filename })),
      });

      createCheckpoint(project.id, req.session.userId!, "feature_complete", `AI generated project: ${spec.name}`).catch(() => {});
      return res.json({ project, files });
    } catch (error: any) {
      log(`AI project generation error: ${error.message}`, "ai");
      return res.status(500).json({ message: "Failed to generate project. Please try again." });
    }
  });

  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  app.post("/api/ai/transcribe", requireAuth, audioUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No audio file provided" });

      const file = new File([req.file.buffer], req.file.originalname || "recording.webm", {
        type: req.file.mimetype || "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "en",
      });

      res.json({ text: transcription.text });
    } catch (err: any) {
      log(`Transcription error: ${err.message}`, "ai");
      res.status(500).json({ error: "Transcription failed: " + (err.message || "unknown error") });
    }
  });

  app.post("/api/ai/generate-image", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (prompt.length > 4000) {
        return res.status(400).json({ error: "Prompt too long (max 4000 characters)" });
      }
      const validSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"] as const;
      type ImageSize = typeof validSizes[number];
      const imageSize: ImageSize = (validSizes as readonly string[]).includes(size) ? (size as ImageSize) : "1024x1024";

      const imageQuota = await storage.incrementAiCall(req.session.userId!);
      if (!imageQuota.allowed) {
        return res.status(429).json({ error: "Daily AI call limit reached. Upgrade to Pro for more." });
      }
      const imgCreditResult = await storage.deductCredits(req.session.userId!, "economy");
      if (!imgCreditResult.allowed) {
        return res.status(429).json({ error: imgCreditResult.reason || "Daily credit limit reached" });
      }

      const imageBuffer = await generateImageBuffer(prompt, imageSize);
      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(502).json({ error: "Image generation returned empty result" });
      }
      const base64 = imageBuffer.toString("base64");
      res.json({ image: `data:image/png;base64,${base64}` });
    } catch (err: any) {
      log(`Image generation error: ${err.message}`, "ai");
      res.status(500).json({ error: "Image generation failed: " + (err.message || "unknown error") });
    }
  });

  app.get("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (!conversation) {
      return res.json({ conversation: null, messages: [] });
    }
    const msgs = await storage.getMessages(conversation.id);
    return res.json({ conversation, messages: msgs });
  });

  app.post("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const existing = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (existing) {
      return res.json(existing);
    }
    const { title, model } = req.body;
    const conversation = await storage.createConversation({
      projectId: req.params.projectId,
      userId: req.session.userId!,
      title: title || "",
      model: model || "gpt",
    });
    return res.status(201).json(conversation);
  });

  app.post("/api/ai/conversations/:projectId/messages", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    let conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (!conversation) {
      conversation = await storage.createConversation({
        projectId: req.params.projectId,
        userId: req.session.userId!,
        model: req.body.model || "gpt",
      });
    }
    const { role, content, model: msgModel, fileOps } = req.body;
    if (!role || !content) {
      return res.status(400).json({ message: "role and content required" });
    }
    const msg = await storage.addMessage({
      conversationId: conversation.id,
      role,
      content: typeof content === "string" ? content.slice(0, 100000) : "",
      model: msgModel || null,
      fileOps: fileOps || null,
    });
    return res.status(201).json(msg);
  });

  app.delete("/api/ai/conversations/:projectId", requireAuth, async (req: Request, res: Response) => {
    const conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (conversation) {
      await storage.deleteConversation(conversation.id);
    }
    return res.json({ message: "Conversation cleared" });
  });

  app.get("/api/ai/queue/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const messages = await storage.getQueuedMessages(req.params.projectId, req.session.userId!);
    return res.json(messages);
  });

  app.post("/api/ai/queue/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, attachments } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ message: "content required" });
    }
    let conversation = await storage.getConversation(req.params.projectId, req.session.userId!);
    if (!conversation) {
      conversation = await storage.createConversation({
        projectId: req.params.projectId,
        userId: req.session.userId!,
        model: "gpt",
      });
    }
    const existing = await storage.getQueuedMessages(req.params.projectId, req.session.userId!);
    const position = existing.length;
    const msg = await storage.createQueuedMessage({
      conversationId: conversation.id,
      projectId: req.params.projectId,
      userId: req.session.userId!,
      content: content.slice(0, 100000),
      attachments: attachments || null,
      position,
    });
    return res.status(201).json(msg);
  });

  app.patch("/api/ai/queue/:projectId/:messageId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { content, attachments } = req.body;
    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (attachments !== undefined) updates.attachments = attachments;
    const msg = await storage.updateQueuedMessage(req.params.messageId, req.params.projectId, req.session.userId!, updates);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    return res.json(msg);
  });

  app.put("/api/ai/queue/:projectId/reorder", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: "updates array required" });
    }
    await storage.reorderQueuedMessages(updates, req.params.projectId, req.session.userId!);
    const messages = await storage.getQueuedMessages(req.params.projectId, req.session.userId!);
    return res.json(messages);
  });

  app.delete("/api/ai/queue/:projectId/:messageId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.deleteQueuedMessage(req.params.messageId, req.params.projectId, req.session.userId!);
    return res.json({ message: "Deleted" });
  });

  app.delete("/api/ai/queue/:projectId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.clearQueuedMessages(req.params.projectId, req.session.userId!);
    return res.json({ message: "Queue cleared" });
  });

  app.post("/api/ai/queue/:projectId/dequeue", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const msg = await storage.dequeueNextMessage(req.params.projectId, req.session.userId!);
    if (!msg) return res.json({ message: null });
    return res.json(msg);
  });

  app.post("/api/ai/complete", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { code, cursorOffset, language } = req.body;
      if (!code || typeof cursorOffset !== "number") {
        return res.status(400).json({ message: "code and cursorOffset required" });
      }
      const creditResult = await storage.deductCredits(req.session.userId!, "economy", "gpt-4o-mini", "complete");
      if (!creditResult.allowed) {
        return res.json({ completion: "" });
      }
      const before = code.slice(Math.max(0, cursorOffset - 1500), cursorOffset);
      const after = code.slice(cursorOffset, cursorOffset + 500);
      const prompt = `You are a code completion engine. Given the code context, output ONLY the completion text (no explanation, no markdown). If there is nothing to suggest, respond with an empty string.\n\nLanguage: ${language || "javascript"}\nCode before cursor:\n${before}\n[CURSOR]\nCode after cursor:\n${after}`;
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.1,
      });
      const completion = result.choices[0]?.message?.content?.trim() || "";
      return res.json({ completion });
    } catch (err: any) {
      console.error("AI complete error:", err.message);
      return res.json({ completion: "" });
    }
  });

  app.post("/api/ai/chat", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, context, model, agentMode: reqMode } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }

      if (context) {
        if (typeof context.code === "string" && context.code.length > MAX_MESSAGE_CONTENT_LENGTH) {
          return res.status(400).json({ message: "Context code too large" });
        }
      }

      let chatMode: AgentMode = (reqMode && ["economy", "power", "turbo"].includes(reqMode)) ? reqMode : "economy";
      if (chatMode === "turbo") {
        const userQuota = await storage.getUserQuota(req.session.userId!);
        if (userQuota.plan === "free" || !userQuota.plan) {
          chatMode = "power";
        }
      }
      const selectedModel = model || "claude";
      const modelId = AGENT_MODE_MODELS[chatMode]?.[selectedModel] || AGENT_MODE_MODELS.economy[selectedModel] || "claude-sonnet-4-6";

      let skillsContext = "";
      let chatMobileContext = "";
      let ecodeContext = "";
      if (req.body.projectId && typeof req.body.projectId === "string") {
        try {
          const chatProject = await storage.getProject(req.body.projectId);
          if (chatProject && await verifyProjectAccess(chatProject.id, req.session.userId!)) {
            const activeSkills = await storage.getActiveSkills(chatProject.id);
            if (activeSkills.length > 0) {
              skillsContext = "\n\n## Project Skills\nThe following skills define project-specific patterns and conventions. Follow them when applicable:\n\n" +
                activeSkills.map(s => `### ${s.name}\n${s.description ? s.description + "\n" : ""}${s.content}`).join("\n\n");
            }
            if (chatProject.projectType === "mobile-app") {
              chatMobileContext = `\n\nIMPORTANT: This is a React Native/Expo mobile app project. Follow these rules:
- Use React Native components (View, Text, TouchableOpacity, ScrollView, FlatList, TextInput, Image, etc.) — NOT HTML elements
- Use StyleSheet.create() for styles — NOT CSS
- Import from "react-native" and "expo-*" packages, not web libraries
- Use "react-native-web" compatible APIs so the app runs via Expo Web preview`;
            }
            const chatFiles = await storage.getFiles(chatProject.id);
            let ecodeFile = chatFiles.find(f => f.filename === "ecode.md");
            if (!ecodeFile) {
              const ecodeContent = generateEcodeContent(chatProject.name, chatProject.language);
              ecodeFile = await storage.createFile(chatProject.id, { filename: "ecode.md", content: ecodeContent });
            }
            if (ecodeFile && ecodeFile.content) {
              ecodeContext = `\n\n## Project Guidelines (ecode.md)\n${ecodeFile.content}`;
            }
          }
        } catch {}
      }

      const systemPrompt = `You are an expert coding assistant embedded in Replit IDE. You help users write, debug, and improve code.

Rules:
- Always provide COMPLETE, WORKING code — never truncate, abbreviate, or use "..." to skip sections.
- When showing code, use markdown code blocks with the language tag and filename as a comment on the first line.
- If the user asks to build or create something, provide the full implementation, not just snippets.
- Include all imports, all functions, and all necessary code for the file to work standalone.
- When modifying existing code, show the COMPLETE updated file, not just the changed parts.${chatMobileContext}${context ? `\n\nCurrent context:\nLanguage: ${context.language}\nFilename: ${context.filename}\nCode:\n\`\`\`\n${context.code}\n\`\`\`` : ""}${ecodeContext}${skillsContext}`;

      const chatCreditResult = await storage.deductCredits(req.session.userId!, chatMode, modelId, "chat");
      if (!chatCreditResult.allowed) {
        return res.status(429).json({ message: "Daily credit limit reached. Upgrade your plan for more credits." });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const turboMaxTokens = chatMode === "turbo" ? 32768 : 16384;

      if (selectedModel === "gemini") {
        const geminiContents = [
          { role: "user" as const, parts: [{ text: systemPrompt }] },
          { role: "model" as const, parts: [{ text: "Understood. I'm ready to help." }] },
          ...messages.map((m: any) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            parts: [{ text: m.content }],
          })),
        ];

        const stream = await gemini.models.generateContentStream({
          model: modelId,
          contents: geminiContents,
          config: { maxOutputTokens: turboMaxTokens },
        });

        for await (const chunk of stream) {
          const content = chunk.text || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else if (selectedModel === "gpt") {
        const gptMessages = [
          { role: "system" as const, content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const stream = await openai.chat.completions.create({
          model: modelId,
          messages: gptMessages,
          stream: true,
          max_completion_tokens: turboMaxTokens,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } else {
        const stream = anthropic.messages.stream({
          model: modelId,
          system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          max_tokens: turboMaxTokens,
        });

        stream.on("text", (text) => {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        });

        await stream.finalMessage();
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI chat error: ${error.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI service error" });
      }
    }
  });

  function convertJsonSchemaToGemini(schema: Record<string, any>): any {
    const typeMap: Record<string, any> = { string: Type.STRING, number: Type.NUMBER, boolean: Type.BOOLEAN, integer: Type.NUMBER, object: Type.OBJECT, array: Type.ARRAY };
    const result: any = { type: typeMap[schema.type] || Type.STRING };
    if (schema.properties) {
      result.properties = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        const prop = v as Record<string, any>;
        result.properties[k] = { type: typeMap[prop.type] || Type.STRING, description: prop.description || "" };
      }
    }
    if (schema.required) result.required = schema.required;
    return result;
  }

  const agentFileOpsCount = { value: 0 };

  interface GeneratedFileEntry {
    projectId: string;
    filename: string;
    storagePath: string;
    mimeType: string;
    size: number;
  }

  const generatedFileRegistry = new Map<string, GeneratedFileEntry>();

  async function persistGeneratedFileMeta(fileId: string, entry: GeneratedFileEntry): Promise<void> {
    const fs = await import("fs/promises");
    const metaPath = entry.storagePath + ".meta.json";
    await fs.writeFile(metaPath, JSON.stringify({ fileId, ...entry }), "utf-8");
    generatedFileRegistry.set(fileId, entry);
  }

  async function loadGeneratedFileMeta(projectId: string, fileId: string): Promise<GeneratedFileEntry | undefined> {
    const cached = generatedFileRegistry.get(fileId);
    if (cached && cached.projectId === projectId) return cached;

    const fs = await import("fs");
    const fsp = await import("fs/promises");
    const generatedDir = path.join(process.cwd(), ".storage", "generated", projectId);
    try {
      const files = await fsp.readdir(generatedDir);
      for (const f of files) {
        if (!f.endsWith(".meta.json")) continue;
        try {
          const raw = await fsp.readFile(path.join(generatedDir, f), "utf-8");
          const meta = JSON.parse(raw);
          if (meta.fileId === fileId && meta.projectId === projectId) {
            const entry: GeneratedFileEntry = {
              projectId: meta.projectId,
              filename: meta.filename,
              storagePath: meta.storagePath,
              mimeType: meta.mimeType,
              size: meta.size,
            };
            generatedFileRegistry.set(fileId, entry);
            return entry;
          }
        } catch {}
      }
    } catch {}
    return undefined;
  }

  interface AgentToolInput {
    filename: string;
    content: string;
    name?: string;
    description?: string;
    prompt?: string;
    size?: string;
    modification_prompt?: string;
    format?: string;
    title?: string;
    sections?: FileSection[];
  }

  const executeToolCall = async (
    toolName: string,
    toolInput: { filename: string; content: string; name?: string; description?: string; prompt?: string; size?: string; modification_prompt?: string; query?: string; url?: string; format?: string; title?: string; sections?: FileSection[]; [key: string]: any },
    projectId: string,
    existingFiles: { id: string; filename: string; content: string }[],
    res: Response,
    modifiedFiles?: Set<string>,
    mcpDefs?: { name: string; originalName: string; description: string; inputSchema: Record<string, any>; serverId: string }[]
  ): Promise<string> => {
    try {
      if (toolName === "web_search") {
        const query = toolInput.query || toolInput.content || "";
        if (!query) return "Error: search query is required";
        const results = await fetchSearchResults(query);
        res.write(`data: ${JSON.stringify({ type: "web_search_results", results })}\n\n`);
        if (results.length === 0) return "No search results found.";
        return "Search results:\n" + results.map((r, i) => `${i + 1}. ${r.title} (${r.url}): ${r.snippet}`).join("\n");
      }
      if (toolName === "fetch_url") {
        const url = toolInput.url || toolInput.content || "";
        if (!url) return "Error: URL is required";
        res.write(`data: ${JSON.stringify({ type: "web_fetch_result", url, status: "fetching" })}\n\n`);
        const result = await fetchUrlContent(url);
        res.write(`data: ${JSON.stringify({ type: "web_fetch_result", url: result.url, title: result.title, content: result.content.slice(0, 500), status: "done" })}\n\n`);
        return `Content from ${result.title} (${result.url}):\n\n${result.content}`;
      }
      if (toolName.startsWith("mcp__") && mcpDefs) {
        const mcpDef = mcpDefs.find(d => d.name === toolName);
        if (mcpDef) {
          const mcpClientModule = await import("./mcpClient");
          let client = mcpClientModule.getClient(mcpDef.serverId);
          if (!client || client.status !== "running") {
            try {
              const server = await storage.getMcpServer(mcpDef.serverId);
              if (server) {
                client = await mcpClientModule.startClient(server.id, server.command, server.args as string[] || [], server.env as Record<string, string> || {});
                await storage.updateMcpServer(server.id, { status: "running" });
              }
            } catch (startErr: any) {
              const errorMsg = `Failed to start MCP server: ${startErr.message}`;
              res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", name: toolName, error: errorMsg })}\n\n`);
              return errorMsg;
            }
          }
          if (!client || client.status !== "running") {
            const errorMsg = "MCP server not available";
            res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", name: toolName, error: errorMsg })}\n\n`);
            return errorMsg;
          }
          const result = await client.callTool(mcpDef.originalName, toolInput);
          const resultText = result.content.map(c => c.text || "").join("\n");
          res.write(`data: ${JSON.stringify({ type: "mcp_tool_result", name: toolName, result: resultText.slice(0, 5000) })}\n\n`);
          return resultText;
        }
      }
      if (toolName === "create_skill") {
        const skillName = toolInput.name || "Untitled Skill";
        const skillContent = toolInput.content || "";
        const skillDescription = toolInput.description || "";
        const skill = await storage.createSkill({
          projectId,
          name: skillName.slice(0, 200),
          description: skillDescription.slice(0, 1000),
          content: skillContent.slice(0, 50000),
          isActive: true,
        });
        res.write(`data: ${JSON.stringify({ type: "skill_created", skill })}\n\n`);
        return "Done";
      }
      if (toolName === "generate_image") {
        const prompt = toolInput.prompt;
        const filename = toolInput.filename || "generated-image.png";
        const size = toolInput.size as "1024x1024" | "1024x1536" | "1536x1024" | "auto" || "1024x1024";
        if (!prompt) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Image prompt is required" })}\n\n`);
          return "Error: prompt required";
        }
        const safeName = sanitizeAIFilename(filename);
        if (!safeName) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid filename for image" })}\n\n`);
          return "Error: invalid filename";
        }
        const imageBuffer = await generateImageBuffer(prompt, size);
        const base64Content = imageBuffer.toString("base64");
        const dataUri = `data:image/png;base64,${base64Content}`;
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (existingFile) {
          const file = await storage.updateFileContent(existingFile.id, dataUri);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file: { ...file, isImage: true }, imageData: dataUri })}\n\n`);
          broadcastToProject(projectId, { type: "file_updated", filename: safeName });
        } else {
          const file = await storage.createFile(projectId, { filename: safeName, content: dataUri });
          existingFiles.push(file);
          res.write(`data: ${JSON.stringify({ type: "file_created", file: { ...file, isImage: true }, imageData: dataUri })}\n\n`);
          broadcastToProject(projectId, { type: "file_created", filename: safeName });
        }
        if (modifiedFiles) modifiedFiles.add(safeName);
        return `Image generated and saved as ${safeName}`;
      }
      if (toolName === "edit_image") {
        const filename = toolInput.filename;
        const modPrompt = toolInput.modification_prompt || toolInput.prompt;
        if (!filename || !modPrompt) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Filename and modification prompt are required" })}\n\n`);
          return "Error: filename and modification_prompt required";
        }
        const safeName = sanitizeAIFilename(filename);
        if (!safeName) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid filename" })}\n\n`);
          return "Error: invalid filename";
        }
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (!existingFile) {
          res.write(`data: ${JSON.stringify({ type: "error", message: `File "${safeName}" not found in project` })}\n\n`);
          return "Error: file not found";
        }
        const existingContent = existingFile.content || "";
        let inputBuffer: Buffer;
        if (existingContent.startsWith("data:image/")) {
          const base64Data = existingContent.split(",")[1] || existingContent;
          inputBuffer = Buffer.from(base64Data, "base64");
        } else {
          res.write(`data: ${JSON.stringify({ type: "error", message: `File "${safeName}" is not an image` })}\n\n`);
          return "Error: file is not an image";
        }
        const fs = await import("fs");
        const os = await import("os");
        const tmpPath = path.join(os.tmpdir(), `edit-${Date.now()}-${path.basename(safeName)}`);
        fs.writeFileSync(tmpPath, inputBuffer);
        try {
          const editedBuffer = await editImages([tmpPath], modPrompt);
          const base64Content = editedBuffer.toString("base64");
          const dataUri = `data:image/png;base64,${base64Content}`;
          const file = await storage.updateFileContent(existingFile.id, dataUri);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file: { ...file, isImage: true }, imageData: dataUri })}\n\n`);
          if (modifiedFiles) modifiedFiles.add(safeName);
          broadcastToProject(projectId, { type: "file_updated", filename: safeName });
          return `Image "${safeName}" edited successfully`;
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      }
      if (toolName === "generate_file") {
        const format = toolInput.format;
        const filename = toolInput.filename;
        const title = toolInput.title;
        const sections = toolInput.sections;

        if (!format || !["pdf", "docx", "xlsx", "csv"].includes(format)) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid format. Use pdf, docx, xlsx, or csv." })}\n\n`);
          return "Error: invalid format";
        }
        if (!filename) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Filename is required" })}\n\n`);
          return "Error: filename required";
        }
        if (!sections || !Array.isArray(sections) || sections.length === 0) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "At least one section is required" })}\n\n`);
          return "Error: sections required";
        }

        const safeName = sanitizeAIFilename(filename);
        if (!safeName) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid filename" })}\n\n`);
          return "Error: invalid filename";
        }

        const validFormat = format as "pdf" | "docx" | "xlsx" | "csv";
        const fileBuffer = await generateFile({ format: validFormat, filename: safeName, title, sections });

        const fsModule = await import("fs");
        const { mkdir } = await import("fs/promises");
        const generatedDir = path.join(process.cwd(), ".storage", "generated", projectId);
        await mkdir(generatedDir, { recursive: true });
        const storagePath = path.join(generatedDir, `${Date.now()}_${safeName}`);
        fsModule.writeFileSync(storagePath, fileBuffer);

        const fileId = crypto.randomUUID();
        const mimeType = getMimeType(validFormat);
        await persistGeneratedFileMeta(fileId, {
          projectId,
          filename: safeName,
          storagePath,
          mimeType,
          size: fileBuffer.length,
        });

        const downloadUrl = `/api/projects/${projectId}/generated-files/${fileId}/download`;
        const sizeKB = (fileBuffer.length / 1024).toFixed(1);

        res.write(`data: ${JSON.stringify({
          type: "file_generated",
          filename: safeName,
          format: validFormat,
          downloadUrl,
          mimeType,
          size: fileBuffer.length,
        })}\n\n`);

        if (modifiedFiles) modifiedFiles.add(safeName);
        return `File generated: ${safeName} (${validFormat.toUpperCase()}, ${sizeKB} KB). Download URL: ${downloadUrl}`;
      }
      if (toolName === "query_connector" || toolName === "write_connector") {
        const connectorName = (toolInput as any).connector;
        const operation = (toolInput as any).operation;
        const params = (toolInput as any).params || {};
        if (!connectorName || !operation) {
          res.write(`data: ${JSON.stringify({ type: "error", message: "connector and operation are required" })}\n\n`);
          return "Error: connector and operation are required";
        }
        const connectorKey = getConnectorKey(connectorName) || connectorName.toLowerCase();
        const integrations = await storage.getProjectIntegrations(projectId);
        const matchedIntegration = integrations.find(i => {
          const key = getConnectorKey(i.integration.name);
          return key === connectorKey && (i.status === "connected" || i.status === "unverified");
        });
        if (!matchedIntegration) {
          return `Error: No connected ${connectorName} integration found. The user needs to connect it from the Integrations panel first.`;
        }
        const allowedType = toolName === "query_connector" ? "read" as const : "write" as const;
        const result = await executeConnectorOperation(connectorKey, operation, params, matchedIntegration.config || {}, allowedType);
        await storage.addIntegrationLog(
          matchedIntegration.id,
          result.success ? "info" : "error",
          `Agent ${toolName}: ${operation} — ${result.success ? "Success" : result.error || "Failed"}`
        );
        if (result.success) {
          res.write(`data: ${JSON.stringify({ type: "connector_result", connector: connectorName, operation, success: true })}\n\n`);
          return JSON.stringify(result.data).slice(0, 8000);
        } else {
          res.write(`data: ${JSON.stringify({ type: "connector_result", connector: connectorName, operation, success: false, error: result.error })}\n\n`);
          return `Error: ${result.error}`;
        }
      }
      if (toolName === "create_file" || toolName === "edit_file") {
        agentFileOpsCount.value++;
        const safeName = sanitizeAIFilename(toolInput.filename);
        if (!safeName) {
          log(`AI agent: blocked invalid filename "${toolInput.filename}"`, "ai");
          res.write(`data: ${JSON.stringify({ type: "error", message: "Invalid or forbidden filename" })}\n\n`);
          return "Error: invalid filename";
        }
        const safeContent = sanitizeAIFileContent(toolInput.content);
        const existingFile = existingFiles.find(f => f.filename === safeName);
        if (existingFile) {
          const file = await storage.updateFileContent(existingFile.id, safeContent);
          res.write(`data: ${JSON.stringify({ type: "file_updated", file })}\n\n`);
        } else {
          const file = await storage.createFile(projectId, { filename: safeName, content: safeContent });
          existingFiles.push(file);
          res.write(`data: ${JSON.stringify({ type: "file_created", file })}\n\n`);
        }
        if (modifiedFiles) modifiedFiles.add(safeName);
        return "Done";
      }
      return "Unknown tool";
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", message: `Failed to ${toolName}: ${err.message}` })}\n\n`);
      return `Error: ${err.message}`;
    }
  };

  app.post("/api/ai/agent", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, projectId, model: requestedModel, optimize, agentMode: agentReqMode, webSearchEnabled } = req.body;
      if (!messages || !Array.isArray(messages) || !projectId) {
        return res.status(400).json({ message: "messages array and projectId required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }

      if (typeof projectId !== "string" || projectId.length > 100) {
        return res.status(400).json({ message: "Invalid projectId" });
      }

      const project = await storage.getProject(projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      let agentModeVal: AgentMode = (agentReqMode && ["economy", "power", "turbo"].includes(agentReqMode)) ? agentReqMode : "economy";
      if (agentModeVal === "turbo") {
        const modeQuota = await storage.getUserQuota(req.session.userId!);
        if (modeQuota.plan === "free" || !modeQuota.plan) {
          agentModeVal = "power";
        }
      }
      const agentSelectedModel = requestedModel || "claude";
      const agentModelId = AGENT_MODE_MODELS[agentModeVal]?.[agentSelectedModel] || AGENT_MODE_MODELS.economy[agentSelectedModel] || "claude-sonnet-4-6";

      const agentCreditResult = await storage.deductCredits(req.session.userId!, agentModeVal, agentModelId, "agent");
      if (!agentCreditResult.allowed) {
        return res.status(429).json({ message: "Daily credit limit reached. Upgrade your plan for more credits." });
      }

      const existingFiles = await storage.getFiles(projectId);
      const agentModifiedFiles = new Set<string>();

      let ecodeFile = existingFiles.find(f => f.filename === "ecode.md");
      let ecodeRegenerated = false;
      if (!ecodeFile) {
        const ecodeContent = generateEcodeContent(project.name, project.language);
        ecodeFile = await storage.createFile(projectId, { filename: "ecode.md", content: ecodeContent });
        ecodeRegenerated = true;
      }

      const fileList = existingFiles.filter(f => f.filename !== "ecode.md").map(f => `- ${f.filename}`).join("\n");
      const ecodeGuidelines = ecodeFile && ecodeFile.content ? `\n\n## Project Guidelines (ecode.md)\n${ecodeFile.content}` : "";

      let agentSkillsContext = "";
      try {
        const activeSkills = await storage.getActiveSkills(projectId);
        if (activeSkills.length > 0) {
          agentSkillsContext = "\n\n## Project Skills\nThe following skills define project-specific patterns and conventions. Follow them when applicable:\n\n" +
            activeSkills.map(s => `### ${s.name}\n${s.description ? s.description + "\n" : ""}${s.content}`).join("\n\n");
        }
      } catch {}

      let mcpToolsContext = "";
      let mcpToolDefinitions: { name: string; originalName: string; description: string; inputSchema: Record<string, any>; serverId: string }[] = [];
      try {
        const mcpServers = await storage.getMcpServers(projectId);
        const mcpClientModule = await import("./mcpClient");
        for (const server of mcpServers) {
          let client = mcpClientModule.getClient(server.id);
          if (!client || client.status !== "running") {
            try {
              client = await mcpClientModule.startClient(server.id, server.command, server.args as string[] || [], server.env as Record<string, string> || {});
              await storage.updateMcpServer(server.id, { status: "running" });
              const discoveredTools = await client.listTools();
              await storage.deleteMcpToolsByServer(server.id);
              for (const tool of discoveredTools) {
                await storage.createMcpTool({ serverId: server.id, name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
              }
            } catch (startErr: any) {
              log(`MCP server '${server.name}' (${server.id}) failed to start/discover: ${startErr.message}`, "mcp");
              await storage.updateMcpServer(server.id, { status: "error" });
            }
          }
        }
        const mcpProjectTools = await storage.getMcpToolsByProject(projectId);
        if (mcpProjectTools.length > 0) {
          const safeName = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
          mcpToolDefinitions = mcpProjectTools.map(t => ({
            name: `mcp__${safeName(t.serverName)}__${safeName(t.name)}`,
            originalName: t.name,
            description: `[MCP: ${t.serverName}] ${t.description}`,
            inputSchema: t.inputSchema,
            serverId: t.serverId,
          }));
          mcpToolsContext = "\n\nYou also have access to MCP tools from configured servers. Use them when relevant to the user's request.";
        }
      } catch (mcpErr: any) {
        log(`MCP initialization error: ${mcpErr.message}`, "mcp");
      }

      const isMobileProject = project.projectType === "mobile-app";
      const mobileContext = isMobileProject ? `

IMPORTANT: This is a React Native/Expo mobile app project. Follow these rules:
- Use React Native components (View, Text, TouchableOpacity, ScrollView, FlatList, TextInput, Image, etc.) — NOT HTML elements (div, span, button, input, etc.)
- Use StyleSheet.create() for styles — NOT CSS or inline style objects with web properties
- Use React Native layout (flexbox with flex, alignItems, justifyContent) — NOT CSS grid, float, or position: absolute for layouts
- Import from "react-native" and "expo-*" packages, not web libraries
- Use "react-native-web" compatible APIs so the app runs via Expo Web preview
- Include proper app.json with Expo configuration
- Include package.json with Expo dependencies (expo, react-native, react-native-web, react-dom)` : "";

      const agentSystemPrompt = `You are an AI coding agent inside Replit IDE. You can create and edit files in the user's project.

Current project: "${project.name}" (${project.language}${isMobileProject ? ", mobile-app" : ""})
Existing files:
${fileList || "(no files yet)"}${mobileContext}

When the user asks you to build something, create files, or make changes:
1. Think about what files need to be created or modified
2. Use the provided tools to create or update files
3. Explain what you're doing as you work

When the user asks you to create a skill, use the create_skill tool to persist it.

When the user asks you to generate an image, use the generate_image tool. Choose an appropriate filename (e.g. 'assets/logo.png', 'images/hero.png'). Available sizes: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), auto.

When the user asks you to modify or refine an existing generated image, use the edit_image tool with the existing filename and a description of the changes.

When the user asks you to generate a document, report, spreadsheet, or data export, use the generate_file tool. Supported formats: pdf, docx, xlsx, csv. Structure the content using sections with types: heading (with level 1-3), paragraph, table (with headers and rows arrays), and list (with items array). Choose an appropriate filename with the correct extension.

When the user asks about data from connected services (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex), use the query_connector tool to read data or write_connector to create/update data. Available connectors and operations:
${getConnectorDescription()}

Always write complete, working code. Never use placeholders or TODOs.${ecodeGuidelines}${webSearchEnabled ? `

## Web Search
You have access to web search tools. Use them when:
- The user asks about current information, latest versions, prices, or recent events
- You need to look up API documentation, package info, or framework details
- The user asks you to research something or find specific information online

Use \`web_search\` to search for information. Use \`fetch_url\` to read the full content of a specific URL when you need more detail than the search snippet provides.
Always cite your sources in your response when using information from web searches.` : ""}${agentSkillsContext}${mcpToolsContext}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (ecodeRegenerated && ecodeFile) {
        res.write(`data: ${JSON.stringify({ type: "file_created", file: { id: ecodeFile.id, filename: "ecode.md", content: ecodeFile.content } })}\n\n`);
      }

      const agentTurboMaxTokens = agentModeVal === "turbo" ? 32768 : 16384;

      if (agentSelectedModel === "gemini") {
        const geminiToolDeclarations: FunctionDeclaration[] = [
            {
              name: "create_file",
              description: "Create a new file in the project with the given filename and content",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename (e.g. 'index.js', 'styles.css')" },
                  content: { type: Type.STRING, description: "The full file content" },
                },
                required: ["filename", "content"],
              },
            },
            {
              name: "edit_file",
              description: "Replace the entire content of an existing file",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename of the existing file to edit" },
                  content: { type: Type.STRING, description: "The new full file content" },
                },
                required: ["filename", "content"],
              },
            },
            {
              name: "create_skill",
              description: "Create a reusable skill that teaches the AI agent project-specific patterns, conventions, or domain knowledge",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The skill name" },
                  description: { type: Type.STRING, description: "A short description of what the skill teaches" },
                  content: { type: Type.STRING, description: "The full skill content in markdown" },
                },
                required: ["name", "content"],
              },
            },
            {
              name: "generate_image",
              description: "Generate an AI image using DALL-E and save it as a project file",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: { type: Type.STRING, description: "A detailed description of the image to generate" },
                  filename: { type: Type.STRING, description: "The filename to save the image as (e.g. 'assets/logo.png')" },
                  size: { type: Type.STRING, description: "Image size: '1024x1024' (square), '1024x1536' (portrait), '1536x1024' (landscape), or 'auto'" },
                },
                required: ["prompt", "filename"],
              },
            },
            {
              name: "edit_image",
              description: "Modify an existing generated image in the project using AI",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename of the existing image to edit" },
                  modification_prompt: { type: Type.STRING, description: "Description of the changes to make to the image" },
                },
                required: ["filename", "modification_prompt"],
              },
            },
            {
              name: "generate_file",
              description: "Generate a downloadable file (PDF, DOCX, XLSX, or CSV) with structured content including headings, paragraphs, tables, and lists",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  format: { type: Type.STRING, description: "File format: 'pdf', 'docx', 'xlsx', or 'csv'" },
                  filename: { type: Type.STRING, description: "The output filename with extension (e.g. 'report.pdf', 'data.xlsx')" },
                  title: { type: Type.STRING, description: "Document title (optional)" },
                  sections: {
                    type: Type.ARRAY,
                    description: "Array of content sections",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "Section type: 'heading', 'paragraph', 'table', or 'list'" },
                        content: { type: Type.STRING, description: "Text content for heading or paragraph sections" },
                        level: { type: Type.NUMBER, description: "Heading level (1-3), only for heading type" },
                        headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Column headers for table type" },
                        rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } }, description: "Data rows for table type" },
                        items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List items for list type" },
                      },
                      required: ["type"],
                    },
                  },
                },
                required: ["format", "filename", "sections"],
              },
            },
            {
              name: "query_connector",
              description: "Read data from a connected external service (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex)",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  connector: { type: Type.STRING, description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'BigQuery')" },
                  operation: { type: Type.STRING, description: "The read operation to perform (e.g. 'list_issues', 'list_channels', 'list_pages')" },
                  params: { type: Type.OBJECT, description: "Operation-specific parameters as key-value pairs", properties: {} },
                },
                required: ["connector", "operation"],
              },
            },
            {
              name: "write_connector",
              description: "Write data to a connected external service (create issues, send messages, add pages, track events)",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  connector: { type: Type.STRING, description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'Segment')" },
                  operation: { type: Type.STRING, description: "The write operation to perform (e.g. 'create_issue', 'send_message', 'create_page')" },
                  params: { type: Type.OBJECT, description: "Operation-specific parameters as key-value pairs", properties: {} },
                },
                required: ["connector", "operation"],
              },
            },
        ];
        if (webSearchEnabled) {
          geminiToolDeclarations.push(
            {
              name: "web_search",
              description: "Search the web for current information, documentation, package details, API references, prices, or any real-time data",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: { type: Type.STRING, description: "The search query" },
                },
                required: ["query"],
              },
            },
            {
              name: "fetch_url",
              description: "Fetch and read the content of a specific web page URL. Use after web_search to get full details from a result, or when the user provides a specific URL.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING, description: "The full URL to fetch (must start with http:// or https://)" },
                },
                required: ["url"],
              },
            },
          );
        }
        geminiToolDeclarations.push(
            ...mcpToolDefinitions.map(t => ({
              name: t.name,
              description: t.description,
              parameters: convertJsonSchemaToGemini(t.inputSchema),
            })),
        );
        const geminiTools = [{ functionDeclarations: geminiToolDeclarations }];

        let geminiContents: Content[] = [
          { role: "user", parts: [{ text: agentSystemPrompt }] },
          { role: "model", parts: [{ text: "I understand. I'm ready to help with your project." }] },
          ...messages.map((m: { role: string; content: string }) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            parts: [{ text: m.content }],
          })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: geminiContents,
            config: { maxOutputTokens: 16384, tools: geminiTools },
          });

          const candidate = response.candidates?.[0];
          if (!candidate?.content?.parts) { continueLoop = false; break; }

          const parts = candidate.content.parts;
          let hasToolCall = false;
          const toolResponseParts: any[] = [];

          for (const part of parts) {
            if (part.text) {
              res.write(`data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`);
            }
            if (part.functionCall) {
              hasToolCall = true;
              const fn = part.functionCall;
              const toolInput = fn.args as any;

              const toolLabel = fn.name === "generate_image" ? "Generating image" : fn.name === "edit_image" ? "Editing image" : fn.name === "generate_file" ? "Generating file" : fn.name === "web_search" ? "Searching the web" : fn.name === "fetch_url" ? "Fetching content" : undefined;
              res.write(`data: ${JSON.stringify({ type: fn.name!.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: fn.name, input: fn.name!.startsWith("mcp__") ? {} : { filename: toolInput.filename, query: toolInput.query, url: toolInput.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(fn.name!, toolInput, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions);

              toolResponseParts.push({
                functionResponse: {
                  name: fn.name,
                  response: { result: result || "Done" },
                },
              });
            }
          }

          if (hasToolCall) {
            geminiContents = [
              ...geminiContents,
              { role: "model", parts },
              { role: "user", parts: toolResponseParts },
            ];
          } else {
            continueLoop = false;
          }
        }

        if (iterations >= MAX_AGENT_ITERATIONS) {
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n[Agent reached maximum iteration limit]" })}\n\n`);
        }
      } else if (agentSelectedModel === "gpt") {
        const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          {
            type: "function",
            function: {
              name: "create_file",
              description: "Create a new file in the project with the given filename and content",
              parameters: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "The filename (e.g. 'index.js', 'styles.css')" },
                  content: { type: "string", description: "The full file content" },
                },
                required: ["filename", "content"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_file",
              description: "Replace the entire content of an existing file",
              parameters: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "The filename of the existing file to edit" },
                  content: { type: "string", description: "The new full file content" },
                },
                required: ["filename", "content"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "create_skill",
              description: "Create a reusable skill that teaches the AI agent project-specific patterns, conventions, or domain knowledge",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The skill name" },
                  description: { type: "string", description: "A short description of what the skill teaches" },
                  content: { type: "string", description: "The full skill content in markdown" },
                },
                required: ["name", "content"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_image",
              description: "Generate an AI image using DALL-E and save it as a project file",
              parameters: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "A detailed description of the image to generate" },
                  filename: { type: "string", description: "The filename to save the image as (e.g. 'assets/logo.png')" },
                  size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"], description: "Image size" },
                },
                required: ["prompt", "filename"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "edit_image",
              description: "Modify an existing generated image in the project using AI",
              parameters: {
                type: "object",
                properties: {
                  filename: { type: "string", description: "The filename of the existing image to edit" },
                  modification_prompt: { type: "string", description: "Description of the changes to make to the image" },
                },
                required: ["filename", "modification_prompt"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "generate_file",
              description: "Generate a downloadable file (PDF, DOCX, XLSX, or CSV) with structured content including headings, paragraphs, tables, and lists",
              parameters: {
                type: "object",
                properties: {
                  format: { type: "string", enum: ["pdf", "docx", "xlsx", "csv"], description: "File format" },
                  filename: { type: "string", description: "The output filename with extension (e.g. 'report.pdf', 'data.xlsx')" },
                  title: { type: "string", description: "Document title (optional)" },
                  sections: {
                    type: "array",
                    description: "Array of content sections",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["heading", "paragraph", "table", "list"], description: "Section type" },
                        content: { type: "string", description: "Text content for heading or paragraph sections" },
                        level: { type: "number", description: "Heading level (1-3), only for heading type" },
                        headers: { type: "array", items: { type: "string" }, description: "Column headers for table type" },
                        rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Data rows for table type" },
                        items: { type: "array", items: { type: "string" }, description: "List items for list type" },
                      },
                      required: ["type"],
                    },
                  },
                },
                required: ["format", "filename", "sections"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "query_connector",
              description: "Read data from a connected external service (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex)",
              parameters: {
                type: "object",
                properties: {
                  connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'BigQuery')" },
                  operation: { type: "string", description: "The read operation to perform (e.g. 'list_issues', 'list_channels', 'list_pages')" },
                  params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
                },
                required: ["connector", "operation"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "write_connector",
              description: "Write data to a connected external service (create issues, send messages, add pages, track events)",
              parameters: {
                type: "object",
                properties: {
                  connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'Segment')" },
                  operation: { type: "string", description: "The write operation to perform (e.g. 'create_issue', 'send_message', 'create_page')" },
                  params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
                },
                required: ["connector", "operation"],
              },
            },
          },
          ...mcpToolDefinitions.map(t => ({
            type: "function" as const,
            function: { name: t.name, description: t.description, parameters: t.inputSchema },
          })),
        ];
        if (webSearchEnabled) {
          openaiTools.push(
            {
              type: "function",
              function: {
                name: "web_search",
                description: "Search the web for current information, documentation, package details, API references, prices, or any real-time data",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "The search query" },
                  },
                  required: ["query"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "fetch_url",
                description: "Fetch and read the content of a specific web page URL. Use after web_search to get full details from a result, or when the user provides a specific URL.",
                parameters: {
                  type: "object",
                  properties: {
                    url: { type: "string", description: "The full URL to fetch (must start with http:// or https://)" },
                  },
                  required: ["url"],
                },
              },
            },
          );
        }

        let gptMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: agentSystemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await openai.chat.completions.create({
            model: agentModelId,
            messages: gptMessages,
            tools: openaiTools,
            max_completion_tokens: agentTurboMaxTokens,
          });

          const choice = response.choices[0];
          const message = choice.message;

          if (message.content) {
            res.write(`data: ${JSON.stringify({ type: "text", content: message.content })}\n\n`);
          }

          if (message.tool_calls && message.tool_calls.length > 0) {
            const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

            for (const toolCall of message.tool_calls) {
              if (toolCall.type !== "function") continue;
              const fn = toolCall.function;
              const toolInput = JSON.parse(fn.arguments) as any;

              const toolLabel = fn.name === "generate_image" ? "Generating image" : fn.name === "edit_image" ? "Editing image" : fn.name === "generate_file" ? "Generating file" : fn.name === "web_search" ? "Searching the web" : fn.name === "fetch_url" ? "Fetching content" : undefined;
              res.write(`data: ${JSON.stringify({ type: fn.name.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: fn.name, input: fn.name.startsWith("mcp__") ? {} : { filename: toolInput.filename, query: toolInput.query, url: toolInput.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions);

              toolResultMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result || "Done",
              });
            }

            gptMessages = [
              ...gptMessages,
              { role: "assistant", content: message.content, tool_calls: message.tool_calls } as any,
              ...toolResultMessages,
            ];
          }

          if (choice.finish_reason !== "tool_calls") {
            continueLoop = false;
          }
        }

        if (iterations >= MAX_AGENT_ITERATIONS) {
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n[Agent reached maximum iteration limit]" })}\n\n`);
        }
      } else {
        const tools: Anthropic.Messages.Tool[] = [
          {
            name: "create_file",
            description: "Create a new file in the project with the given filename and content",
            input_schema: {
              type: "object" as const,
              properties: {
                filename: { type: "string", description: "The filename (e.g. 'index.js', 'styles.css')" },
                content: { type: "string", description: "The full file content" },
              },
              required: ["filename", "content"],
            },
          },
          {
            name: "edit_file",
            description: "Replace the entire content of an existing file",
            input_schema: {
              type: "object" as const,
              properties: {
                filename: { type: "string", description: "The filename of the existing file to edit" },
                content: { type: "string", description: "The new full file content" },
              },
              required: ["filename", "content"],
            },
          },
          {
            name: "create_skill",
            description: "Create a reusable skill that teaches the AI agent project-specific patterns, conventions, or domain knowledge",
            input_schema: {
              type: "object" as const,
              properties: {
                name: { type: "string", description: "The skill name" },
                description: { type: "string", description: "A short description of what the skill teaches" },
                content: { type: "string", description: "The full skill content in markdown" },
              },
              required: ["name", "content"],
            },
          },
          {
            name: "generate_image",
            description: "Generate an AI image using DALL-E and save it as a project file",
            input_schema: {
              type: "object" as const,
              properties: {
                prompt: { type: "string", description: "A detailed description of the image to generate" },
                filename: { type: "string", description: "The filename to save the image as (e.g. 'assets/logo.png')" },
                size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"], description: "Image size" },
              },
              required: ["prompt", "filename"],
            },
          },
          {
            name: "edit_image",
            description: "Modify an existing generated image in the project using AI",
            input_schema: {
              type: "object" as const,
              properties: {
                filename: { type: "string", description: "The filename of the existing image to edit" },
                modification_prompt: { type: "string", description: "Description of the changes to make to the image" },
              },
              required: ["filename", "modification_prompt"],
            },
          },
          {
            name: "generate_file",
            description: "Generate a downloadable file (PDF, DOCX, XLSX, or CSV) with structured content including headings, paragraphs, tables, and lists",
            input_schema: {
              type: "object" as const,
              properties: {
                format: { type: "string", enum: ["pdf", "docx", "xlsx", "csv"], description: "File format" },
                filename: { type: "string", description: "The output filename with extension (e.g. 'report.pdf', 'data.xlsx')" },
                title: { type: "string", description: "Document title (optional)" },
                sections: {
                  type: "array",
                  description: "Array of content sections",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["heading", "paragraph", "table", "list"], description: "Section type" },
                      content: { type: "string", description: "Text content for heading or paragraph sections" },
                      level: { type: "number", description: "Heading level (1-3), only for heading type" },
                      headers: { type: "array", items: { type: "string" }, description: "Column headers for table type" },
                      rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Data rows for table type" },
                      items: { type: "array", items: { type: "string" }, description: "List items for list type" },
                    },
                    required: ["type"],
                  },
                },
              },
              required: ["format", "filename", "sections"],
            },
          },
          {
            name: "query_connector",
            description: "Read data from a connected external service (Linear, Slack, Notion, BigQuery, Amplitude, Segment, Hex)",
            input_schema: {
              type: "object" as const,
              properties: {
                connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'BigQuery')" },
                operation: { type: "string", description: "The read operation to perform (e.g. 'list_issues', 'list_channels', 'list_pages')" },
                params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
              },
              required: ["connector", "operation"],
            },
          },
          {
            name: "write_connector",
            description: "Write data to a connected external service (create issues, send messages, add pages, track events)",
            input_schema: {
              type: "object" as const,
              properties: {
                connector: { type: "string", description: "The connector name (e.g. 'Linear', 'Slack', 'Notion', 'Segment')" },
                operation: { type: "string", description: "The write operation to perform (e.g. 'create_issue', 'send_message', 'create_page')" },
                params: { type: "object", description: "Operation-specific parameters as key-value pairs" },
              },
              required: ["connector", "operation"],
            },
          },
          ...mcpToolDefinitions.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: { type: "object" as const, ...t.inputSchema },
          })),
        ];
        if (webSearchEnabled) {
          tools.push(
            {
              name: "web_search",
              description: "Search the web for current information, documentation, package details, API references, prices, or any real-time data",
              input_schema: {
                type: "object" as const,
                properties: {
                  query: { type: "string", description: "The search query" },
                },
                required: ["query"],
              },
            },
            {
              name: "fetch_url",
              description: "Fetch and read the content of a specific web page URL. Use after web_search to get full details from a result, or when the user provides a specific URL.",
              input_schema: {
                type: "object" as const,
                properties: {
                  url: { type: "string", description: "The full URL to fetch (must start with http:// or https://)" },
                },
                required: ["url"],
              },
            },
          );
        }

        let currentMessages = messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await anthropic.messages.create({
            model: agentModelId,
            system: agentSystemPrompt,
            messages: currentMessages,
            max_tokens: agentTurboMaxTokens > 16384 ? 8192 : 4096,
            tools,
          });

          const toolResultMap = new Map<string, string>();
          for (const block of response.content) {
            if (block.type === "text") {
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              const input = block.input as any;

              const toolLabel = block.name === "generate_image" ? "Generating image" : block.name === "edit_image" ? "Editing image" : block.name === "generate_file" ? "Generating file" : block.name === "web_search" ? "Searching the web" : block.name === "fetch_url" ? "Fetching content" : undefined;
              res.write(`data: ${JSON.stringify({ type: block.name.startsWith("mcp__") ? "mcp_tool_use" : "tool_use", name: block.name, input: block.name.startsWith("mcp__") ? {} : { filename: input.filename, query: input.query, url: input.url, ...(toolLabel ? { label: toolLabel } : {}) } })}\n\n`);

              const result = await executeToolCall(block.name, input, projectId, existingFiles, res, agentModifiedFiles, mcpToolDefinitions);
              toolResultMap.set(block.id, result);
            }
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: any[] = response.content
              .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
              .map((b) => ({
                type: "tool_result" as const,
                tool_use_id: b.id,
                content: toolResultMap.get(b.id) || "Done",
              }));

            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: response.content as any },
              { role: "user" as const, content: toolResults as any },
            ];
          } else {
            continueLoop = false;
          }
        }

        if (iterations >= MAX_AGENT_ITERATIONS) {
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n[Agent reached maximum iteration limit]" })}\n\n`);
        }
      }

      const userQuota = await storage.getUserQuota(req.session.userId!);
      const shouldOptimize = optimize || userQuota.codeOptimizationsEnabled;
      if (shouldOptimize && agentModifiedFiles.size > 0) {
        const updatedFiles = await storage.getFiles(projectId);
        const changedFiles = updatedFiles.filter(f => agentModifiedFiles.has(f.filename));
        const changedFileSummary = changedFiles
          .map(f => `### ${f.filename}\n\`\`\`\n${typeof f.content === "string" ? f.content.slice(0, 3000) : ""}\n\`\`\``)
          .join("\n\n");

        const optimizePrompt = `You just completed changes to the project "${project.name}". Review the modified files below for code quality, simplification opportunities, and potential issues. Provide a concise review with specific suggestions. Use markdown formatting.

Modified files:
${changedFileSummary}

Review for:
1. Code quality issues (unused variables, dead code, inconsistencies)
2. Simplification opportunities (redundant logic, verbose patterns)
3. Potential bugs or edge cases
4. Performance improvements

Be concise and actionable. Only mention real issues, not style preferences.`;

        res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n---\n\n**🔍 Code Optimization Review**\n\n" })}\n\n`);

        try {
          const reviewModelId = AGENT_MODE_MODELS.economy[agentSelectedModel] || "gpt-4o-mini";
          if (agentSelectedModel === "gemini") {
            const reviewStream = await gemini.models.generateContentStream({
              model: reviewModelId,
              contents: [{ role: "user", parts: [{ text: optimizePrompt }] }],
              config: { maxOutputTokens: 4096 },
            });
            for await (const chunk of reviewStream) {
              const content = chunk.text || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
              }
            }
          } else if (agentSelectedModel === "gpt") {
            const reviewStream = await openai.chat.completions.create({
              model: reviewModelId,
              messages: [{ role: "user", content: optimizePrompt }],
              stream: true,
              max_completion_tokens: 4096,
            });
            for await (const chunk of reviewStream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
              }
            }
          } else {
            const reviewStream = anthropic.messages.stream({
              model: reviewModelId,
              messages: [{ role: "user", content: optimizePrompt }],
              max_tokens: 4096,
            });
            reviewStream.on("text", (text) => {
              res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
            });
            await reviewStream.finalMessage();
          }
        } catch (reviewErr: any) {
          log(`Code optimization review error: ${reviewErr.message}`, "ai");
          res.write(`data: ${JSON.stringify({ type: "text", content: "\n\n_Code optimization review could not be completed._" })}\n\n`);
        }
      }

      if (agentFileOpsCount.value > 0) {
        createCheckpoint(projectId, req.session.userId!, "feature_complete", `AI agent: ${agentFileOpsCount.value} file operation${agentFileOpsCount.value > 1 ? "s" : ""}`).catch(() => {});
        agentFileOpsCount.value = 0;
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI agent error: ${error.message}`, "ai");
      agentFileOpsCount.value = 0;
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI agent error" });
      }
    }
  });

  app.post("/api/ai/lite", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { messages, projectId, model: requestedModel } = req.body;
      if (!messages || !Array.isArray(messages) || !projectId) {
        return res.status(400).json({ message: "messages array and projectId required" });
      }

      const msgError = validateAIMessages(messages);
      if (msgError) {
        return res.status(400).json({ message: msgError });
      }

      if (typeof projectId !== "string" || projectId.length > 100) {
        return res.status(400).json({ message: "Invalid projectId" });
      }

      const project = await storage.getProject(projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const liteAiQuota = await storage.incrementAiCall(req.session.userId!);
      if (!liteAiQuota.allowed) {
        return res.status(429).json({ message: "Daily AI call limit reached. Upgrade to Pro for more." });
      }
      const liteCreditResult = await storage.deductCredits(req.session.userId!, "economy");
      if (!liteCreditResult.allowed) {
        return res.status(429).json({ message: liteCreditResult.reason || "Daily credit limit reached" });
      }

      const existingFiles = await storage.getFiles(projectId);
      const liteModifiedFiles = new Set<string>();
      const fileList = existingFiles.map(f => `- ${f.filename}`).join("\n");

      const liteSystemPrompt = `You are a fast AI coding agent in Replit IDE. Make quick, targeted changes only.

Project: "${project.name}" (${project.language})
Files:
${fileList || "(empty)"}

Rules:
- Analyze ONLY the files relevant to the user's request
- Make targeted, minimal changes — no refactoring, no architecture review
- Skip planning explanations — go straight to implementation
- Write complete, working code for each file you touch
- Be concise in your responses`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (requestedModel === "gemini") {
        const geminiTools: Tool[] = [{
          functionDeclarations: [
            {
              name: "create_file",
              description: "Create a new file",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename" },
                  content: { type: Type.STRING, description: "The full file content" },
                },
                required: ["filename", "content"],
              },
            },
            {
              name: "edit_file",
              description: "Replace file content",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING, description: "The filename" },
                  content: { type: Type.STRING, description: "The new content" },
                },
                required: ["filename", "content"],
              },
            },
          ],
        }];

        let geminiContents: Content[] = [
          { role: "user", parts: [{ text: liteSystemPrompt }] },
          { role: "model", parts: [{ text: "Ready." }] },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: geminiContents,
            config: { maxOutputTokens: 8192, tools: geminiTools },
          });

          const candidate = response.candidates?.[0];
          if (!candidate?.content?.parts) { continueLoop = false; break; }

          const parts = candidate.content.parts;
          let hasToolCall = false;
          const toolResponseParts: any[] = [];

          for (const part of parts) {
            if (part.text) {
              res.write(`data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`);
            }
            if (part.functionCall) {
              hasToolCall = true;
              const fn = part.functionCall;
              const toolInput = fn.args as { filename: string; content: string };
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: fn.name, input: { filename: toolInput.filename } })}\n\n`);
              await executeToolCall(fn.name!, toolInput, projectId, existingFiles, res, liteModifiedFiles);
              toolResponseParts.push({ functionResponse: { name: fn.name, response: { result: "Done" } } });
            }
          }

          if (hasToolCall) {
            geminiContents = [...geminiContents, { role: "model", parts }, { role: "user", parts: toolResponseParts }];
          } else {
            continueLoop = false;
          }
        }
      } else if (requestedModel === "gpt") {
        const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          { type: "function", function: { name: "create_file", description: "Create a new file", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
          { type: "function", function: { name: "edit_file", description: "Replace file content", parameters: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } } },
        ];

        let gptMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: liteSystemPrompt },
          ...messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: gptMessages,
            tools: openaiTools,
            max_completion_tokens: 8192,
          });

          const choice = response.choices[0];
          const message = choice.message;

          if (message.content) {
            res.write(`data: ${JSON.stringify({ type: "text", content: message.content })}\n\n`);
          }

          if (message.tool_calls && message.tool_calls.length > 0) {
            const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
            for (const toolCall of message.tool_calls) {
              if (toolCall.type !== "function") continue;
              const fn = toolCall.function;
              const toolInput = JSON.parse(fn.arguments) as { filename: string; content: string };
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: fn.name, input: { filename: toolInput.filename } })}\n\n`);
              await executeToolCall(fn.name, toolInput, projectId, existingFiles, res, liteModifiedFiles);
              toolResultMessages.push({ role: "tool", tool_call_id: toolCall.id, content: "Done" });
            }
            gptMessages = [...gptMessages, { role: "assistant", content: message.content, tool_calls: message.tool_calls } as any, ...toolResultMessages];
          }

          if (choice.finish_reason !== "tool_calls") {
            continueLoop = false;
          }
        }
      } else {
        const tools: Anthropic.Messages.Tool[] = [
          { name: "create_file", description: "Create a new file", input_schema: { type: "object" as const, properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } },
          { name: "edit_file", description: "Replace file content", input_schema: { type: "object" as const, properties: { filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } },
        ];

        let currentMessages = messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        let continueLoop = true;
        let iterations = 0;

        while (continueLoop && iterations < MAX_AGENT_ITERATIONS) {
          iterations++;
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            system: liteSystemPrompt,
            messages: currentMessages,
            max_tokens: 4096,
            tools,
          });

          for (const block of response.content) {
            if (block.type === "text") {
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              const input = block.input as { filename: string; content: string };
              res.write(`data: ${JSON.stringify({ type: "tool_use", name: block.name, input: { filename: input.filename } })}\n\n`);
              await executeToolCall(block.name, input, projectId, existingFiles, res, liteModifiedFiles);
            }
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: any[] = response.content
              .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
              .map((b) => ({ type: "tool_result" as const, tool_use_id: b.id, content: "Done" }));
            currentMessages = [...currentMessages, { role: "assistant" as const, content: response.content as any }, { role: "user" as const, content: toolResults as any }];
          } else {
            continueLoop = false;
          }
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI lite error: ${error.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "AI lite error" });
      }
    }
  });

  async function fetchSearchResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey) {
      try {
        const results = await fetchTavilyResults(query, tavilyKey);
        if (results.length > 0) return results;
      } catch (err: any) {
        log(`Tavily search error, falling back: ${err.message}`, "ai");
      }
    }
    const fallbacks = [fetchGoogleResults, fetchBingResults];
    for (const engine of fallbacks) {
      try {
        const results = await engine(query);
        if (results.length > 0) return results;
      } catch (err: any) {
        log(`Search engine fallback: ${err.message}`, "ai");
      }
    }
    return [];
  }

  async function fetchTavilyResults(query: string, apiKey: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 8,
        include_answer: false,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Tavily API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json() as { results?: { title: string; url: string; content: string }[] };
    return (data.results || []).map(r => ({
      title: r.title || "",
      url: r.url || "",
      snippet: (r.content || "").slice(0, 300),
    }));
  }

  async function fetchGoogleResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://www.google.com/search?q=${encoded}&num=8&hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const blockRegex = /<div class="[^"]*(?:tF2Cxc|g)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let block;
    while ((block = blockRegex.exec(html)) !== null && results.length < 8) {
      const content = block[1];
      const urlMatch = content.match(/<a[^>]*href="(https?:\/\/[^"]+)"/);
      const titleMatch = content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
      const snippetMatch = content.match(/<span[^>]*class="[^"]*(?:aCOpRe|st)[^"]*"[^>]*>([\s\S]*?)<\/span>/)
        || content.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (urlMatch && titleMatch) {
        const url = urlMatch[1];
        const title = titleMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : "";
        if (title && url && !url.includes("google.com")) results.push({ title, url, snippet });
      }
    }
    if (results.length === 0) {
      const linkRegex = /<a[^>]*href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(html)) !== null && results.length < 8) {
        const url = decodeURIComponent(linkMatch[1]);
        const title = linkMatch[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
        if (title && url && !url.includes("google.com") && title.length > 3) {
          results.push({ title, url, snippet: "" });
        }
      }
    }
    return results;
  }

  async function fetchBingResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://www.bing.com/search?q=${encoded}&count=8`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const blockRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let block;
    while ((block = blockRegex.exec(html)) !== null && results.length < 8) {
      const content = block[1];
      const urlMatch = content.match(/<a[^>]*href="(https?:\/\/[^"]+)"/);
      const titleMatch = content.match(/<a[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/) || content.match(/<div class="b_caption"[^>]*>([\s\S]*?)<\/div>/);
      if (urlMatch && titleMatch) {
        const url = urlMatch[1];
        const title = titleMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
        const snippet = snippetMatch ? (snippetMatch[1] || snippetMatch[2] || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim() : "";
        if (title && url) results.push({ title, url, snippet });
      }
    }
    return results;
  }

  function isPrivateIP(ip: string): boolean {
    if (ip === "0.0.0.0" || ip === "::1" || ip === "::") return true;
    const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (a === 127) return true;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
    return false;
  }

  function validateExternalUrl(urlStr: string): { valid: boolean; error?: string } {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return { valid: false, error: "Invalid URL" };
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "Only HTTP/HTTPS URLs are supported" };
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHostPatterns = [
      /^localhost$/i,
      /^127\.\d+\.\d+\.\d+$/,
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^0\.0\.0\.0$/,
      /^169\.254\.\d+\.\d+$/,
      /^\[?::1?\]?$/,
      /\.internal$/,
      /\.local$/,
      /^metadata\.google\.internal$/,
    ];
    if (blockedHostPatterns.some(p => p.test(hostname))) {
      return { valid: false, error: "Access to internal/private URLs is not allowed" };
    }
    return { valid: true };
  }

  async function resolveAndValidateHost(hostname: string): Promise<{ valid: boolean; error?: string }> {
    const dns = await import("dns");
    return new Promise((resolve) => {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) {
          resolve({ valid: false, error: `DNS resolution failed: ${err.message}` });
          return;
        }
        for (const addr of addresses) {
          if (isPrivateIP(addr.address)) {
            resolve({ valid: false, error: "Access to internal/private IPs is not allowed" });
            return;
          }
        }
        resolve({ valid: true });
      });
    });
  }

  async function fetchUrlContent(url: string, redirectDepth: number = 0): Promise<{ url: string; content: string; title: string }> {
    try {
      const urlCheck = validateExternalUrl(url);
      if (!urlCheck.valid) {
        return { url, content: `Error: ${urlCheck.error}`, title: url };
      }
      const parsedUrl = new URL(url);
      const dnsCheck = await resolveAndValidateHost(parsedUrl.hostname);
      if (!dnsCheck.valid) {
        return { url, content: `Error: ${dnsCheck.error}`, title: url };
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ReplitIDE/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      clearTimeout(timeout);
      if (response.status >= 300 && response.status < 400) {
        if (redirectDepth >= 5) {
          return { url, content: "Error: Too many redirects (max 5)", title: url };
        }
        const redirectUrl = response.headers.get("location");
        if (!redirectUrl) {
          return { url, content: "Error: Redirect with no location header", title: url };
        }
        const absoluteRedirect = new URL(redirectUrl, url).toString();
        const redirectCheck = validateExternalUrl(absoluteRedirect);
        if (!redirectCheck.valid) {
          return { url, content: `Error: Redirect blocked — ${redirectCheck.error}`, title: url };
        }
        const redirectParsed = new URL(absoluteRedirect);
        const redirectDnsCheck = await resolveAndValidateHost(redirectParsed.hostname);
        if (!redirectDnsCheck.valid) {
          return { url, content: `Error: Redirect blocked — ${redirectDnsCheck.error}`, title: url };
        }
        return fetchUrlContent(absoluteRedirect, redirectDepth + 1);
      }
      if (!response.ok) {
        return { url, content: `Error: HTTP ${response.status} ${response.statusText}`, title: url };
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/") && !contentType.includes("application/json") && !contentType.includes("application/xml")) {
        return { url, content: `Error: Non-text content type (${contentType})`, title: url };
      }
      let text = await response.text();
      if (text.length > 100000) {
        text = text.slice(0, 100000) + "\n\n[Content truncated at 100KB]";
      }
      let title = url;
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim();
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 50000) {
        text = text.slice(0, 50000) + "\n\n[Content truncated]";
      }
      return { url, content: text, title };
    } catch (err: any) {
      const errMsg = err.name === "AbortError" ? "Request timed out (10s limit)" : err.message;
      log(`Fetch URL error for ${url}: ${errMsg}`, "ai");
      return { url, content: `Error fetching URL: ${errMsg}`, title: url };
    }
  }

  app.post("/api/ai/web-search", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    try {
      const { query, model: requestedModel } = req.body;
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return res.status(400).json({ message: "Search query required (at least 2 characters)" });
      }
      if (query.length > 1000) {
        return res.status(400).json({ message: "Query too long (max 1000 characters)" });
      }

      const searchQuota = await storage.incrementAiCall(req.session.userId!);
      if (!searchQuota.allowed) {
        return res.status(429).json({ message: "Daily AI call limit reached." });
      }
      const searchCreditResult = await storage.deductCredits(req.session.userId!, "economy");
      if (!searchCreditResult.allowed) {
        return res.status(429).json({ message: searchCreditResult.reason || "Daily credit limit reached" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "text", content: "🔍 **Searching the web...**\n\n" })}\n\n`);

      const searchResults = await fetchSearchResults(query.trim());

      let sourcesContext = "";
      if (searchResults.length > 0) {
        sourcesContext = "## Web Search Results\n\n" + searchResults.map((r, i) =>
          `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`
        ).join("\n\n");

        res.write(`data: ${JSON.stringify({ type: "text", content: "Found " + searchResults.length + " results. Synthesizing...\n\n" })}\n\n`);
      } else {
        sourcesContext = "No web search results were found. Answer based on your knowledge.";
        res.write(`data: ${JSON.stringify({ type: "text", content: "No results found. Answering from knowledge...\n\n" })}\n\n`);
      }

      const searchPrompt = `You are a web-search AI assistant. The user searched for: "${query.trim()}"

${sourcesContext}

Based on the search results above, provide a comprehensive answer to the user's query. Cite specific sources with their URLs when referencing information. Format your response with clear sections and include a "Sources" section at the end listing the relevant URLs used.`;

      if (requestedModel === "gemini") {
        const stream = await gemini.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
          config: { maxOutputTokens: 4096 },
        });
        for await (const chunk of stream) {
          const content = chunk.text || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          }
        }
      } else if (requestedModel === "gpt") {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "system", content: "You are a helpful search assistant that synthesizes web search results into clear, cited answers." }, { role: "user", content: searchPrompt }],
          stream: true,
          max_completion_tokens: 4096,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          }
        }
      } else {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          messages: [{ role: "user", content: searchPrompt }],
          max_tokens: 4096,
        });
        stream.on("text", (text) => {
          res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
        });
        await stream.finalMessage();
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      log(`AI web-search error: ${error.message}`, "ai");
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Web search error" });
      }
    }
  });

  registerImageRoutes(app, requireAuth, aiLimiter);

  // --- WebSocket ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      errorBuffer.push({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: err.status || 500,
        message: err.message || "Unknown error",
      });
      if (errorBuffer.length > MAX_ERROR_BUFFER) errorBuffer.shift();
    }
    next(err);
  });

  const wss = new WebSocketServer({ noServer: true });
  const terminalWss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: any, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    if (pathname === "/ws") {
      sessionMiddleware(req, {} as any, () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then((project) => {
          if (!project || (project.userId !== req.session.userId && !project.isDemo)) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    } else if (pathname === "/ws/terminal") {
      sessionMiddleware(req, {} as any, () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then((project) => {
          if (!project || project.userId !== req.session.userId) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          terminalWss.handleUpgrade(req, socket, head, (ws) => {
            terminalWss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    }
  });

  wss.on("connection", (ws: WebSocket & { isAlive?: boolean }, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      ws.close(1008, "projectId required");
      return;
    }

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress || "unknown";

    if (!wsConnectionsByIp.has(clientIp)) {
      wsConnectionsByIp.set(clientIp, new Set());
    }
    const ipConnections = wsConnectionsByIp.get(clientIp)!;
    Array.from(ipConnections).forEach(existingWs => {
      if ((existingWs as any).readyState !== WebSocket.OPEN) {
        ipConnections.delete(existingWs);
      }
    });
    if (ipConnections.size >= WS_MAX_CONNECTIONS_PER_IP) {
      ws.close(1013, "Too many connections");
      log(`WebSocket connection rejected for IP ${clientIp}: limit reached`, "ws");
      return;
    }
    ipConnections.add(ws);

    if (!wsClients.has(projectId)) {
      wsClients.set(projectId, new Set());
    }
    wsClients.get(projectId)!.add(ws);
    ws.isAlive = true;

    ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));

    log(`WebSocket connected for project ${projectId} (IP: ${clientIp}, connections: ${ipConnections.size})`, "ws");

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (rawData) => {
      if (!checkWsMessageRate(ws)) {
        ws.send(JSON.stringify({ type: "error", message: "Message rate limit exceeded" }));
        return;
      }
      try {
        const data = JSON.parse(rawData.toString());
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on("close", () => {
      wsClients.get(projectId)?.delete(ws);
      if (wsClients.get(projectId)?.size === 0) {
        wsClients.delete(projectId);
      }
      wsConnectionsByIp.get(clientIp)?.delete(ws);
      if (wsConnectionsByIp.get(clientIp)?.size === 0) {
        wsConnectionsByIp.delete(clientIp);
      }
    });

    ws.on("error", () => {
      wsClients.get(projectId)?.delete(ws);
      wsConnectionsByIp.get(clientIp)?.delete(ws);
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  const terminalPingInterval = setInterval(() => {
    terminalWss.clients.forEach((ws) => {
      if ((ws as any).__termDead) {
        ws.terminate();
        return;
      }
      (ws as any).__termDead = true;
      ws.ping();
    });
  }, 30000);

  terminalWss.on("close", () => {
    clearInterval(terminalPingInterval);
  });

  terminalWss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("sessionId") || "default";
    const userId = (req as any).session?.userId;

    (ws as any).__termDead = false;
    ws.on("pong", () => { (ws as any).__termDead = false; });

    if (!projectId || !userId) {
      ws.close(1008, "Missing projectId or auth");
      return;
    }

    log(`Terminal WebSocket connected for project ${projectId}, session ${sessionId}`, "terminal");

    try {
      const projectEnvVarsList = await storage.getProjectEnvVars(projectId);
      const envVarsMap: Record<string, string> = {};
      for (const ev of projectEnvVarsList) {
        envVarsMap[ev.key] = decrypt(ev.encryptedValue);
      }
      const termIntegrationEnvVars = await getIntegrationEnvVars(projectId);
      Object.assign(envVarsMap, termIntegrationEnvVars);
      const linkedAccountVars = await storage.getAccountEnvVarLinks(projectId);
      for (const link of linkedAccountVars) {
        if (!(link.key in envVarsMap)) {
          envVarsMap[link.key] = decrypt(link.encryptedValue);
        }
      }
      envVarsMap["REPLIT_DOMAINS"] = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "localhost";
      const termUser = await storage.getUser(userId);
      envVarsMap["REPLIT_USER"] = termUser?.displayName || termUser?.email || userId;
      const term = createTerminalSession(projectId, userId, sessionId, envVarsMap);
      setSessionSelected(projectId, userId, sessionId);

      let inputLine = "";
      let inEscapeSeq = false;

      const dataHandler = term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "output", data }));
        }
      });

      ws.on("message", (rawData) => {
        try {
          const msg = JSON.parse(rawData.toString());
          if (msg.type === "input" && typeof msg.data === "string") {
            term.write(msg.data);
            updateLastActivity(projectId, userId, sessionId);
            for (const ch of msg.data) {
              if (inEscapeSeq) {
                if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "~") {
                  inEscapeSeq = false;
                }
                continue;
              }
              if (ch === "\x1b") {
                inEscapeSeq = true;
                continue;
              }
              if (ch === "\r" || ch === "\n") {
                const cmd = inputLine.trim();
                if (cmd.length > 0) {
                  updateLastCommand(projectId, userId, sessionId, cmd);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "lastCommand", sessionId, command: cmd }));
                  }
                }
                inputLine = "";
              } else if (ch === "\x7f" || ch === "\b") {
                inputLine = inputLine.slice(0, -1);
              } else if (ch === "\x15") {
                inputLine = "";
              } else if (ch === "\x17") {
                inputLine = inputLine.replace(/\S+\s*$/, "");
              } else if (ch.charCodeAt(0) >= 32) {
                inputLine += ch;
              }
            }
          } else if (msg.type === "resize" && msg.cols && msg.rows) {
            resizeTerminal(projectId, userId, msg.cols, msg.rows, sessionId);
          }
        } catch {}
      });

      ws.on("close", () => {
        dataHandler.dispose();
        log(`Terminal WebSocket disconnected for project ${projectId}, session ${sessionId}`, "terminal");
      });

      ws.on("error", () => {
        dataHandler.dispose();
      });
    } catch (err: any) {
      log(`Terminal error: ${err.message}`, "terminal");
      ws.send(JSON.stringify({ type: "error", message: "Failed to start terminal" }));
      ws.close(1011, "Terminal error");
    }
  });

  // ============ DATABASE VIEWER ============
  app.post("/api/projects/:id/database/query", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Project not found" });

      const { sql } = req.body;
      if (!sql || typeof sql !== "string") return res.status(400).json({ error: "SQL query required" });

      const trimmed = sql.trim().toUpperCase();
      const allowed = trimmed.startsWith("SELECT") || trimmed.startsWith("WITH") || trimmed.startsWith("EXPLAIN") || trimmed.startsWith("SHOW");
      if (!allowed) return res.status(400).json({ error: "Only SELECT, WITH, EXPLAIN, and SHOW queries are allowed" });

      const { pool } = await import("./db");
      const result = await pool.query(sql);

      if (result.rows && result.fields) {
        const columns = result.fields.map((f: any) => f.name);
        const rows = result.rows.map((row: any) => columns.map((col: string) => row[col]));
        res.json({ columns, rows, rowCount: result.rowCount ?? rows.length });
      } else {
        res.json({ columns: [], rows: [], rowCount: result.rowCount ?? 0 });
      }
    } catch (err: any) {
      res.json({ error: err.message || "Query failed" });
    }
  });

  // ============ TEST RUNNER ============
  app.get("/api/projects/:id/tests/detect", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Project not found" });

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

      res.json({ files: testFiles, framework });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/tests/run", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Project not found" });

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

  // ============ AI COMMIT MESSAGE ============
  app.post("/api/projects/:id/git/generate-commit-message", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Project not found" });

      const files = await storage.getFiles(req.params.id);
      const branch = req.body.branch || "main";

      await ensureRepoWithPersistence(req.params.id, files.map(f => ({ filename: f.filename, content: f.content })));
      const diff = await gitService.getDiff(req.params.id, branch);

      let changesSummary = "";
      if (diff.hasCommits && diff.changes.length > 0) {
        const added = diff.changes.filter(c => c.status === "added").map(c => c.filename);
        const deleted = diff.changes.filter(c => c.status === "deleted").map(c => c.filename);
        const modified = diff.changes.filter(c => c.status === "modified").map(c => c.filename);

        if (added.length) changesSummary += `Added: ${added.join(", ")}\n`;
        if (deleted.length) changesSummary += `Deleted: ${deleted.join(", ")}\n`;
        if (modified.length) {
          changesSummary += `Modified: ${modified.join(", ")}\n`;
          for (const change of diff.changes.filter(c => c.status === "modified").slice(0, 5)) {
            const oldLines = (change.oldContent || "").split("\n");
            const newLines = (change.newContent || "").split("\n");
            const addedLines = newLines.filter((l) => !oldLines.includes(l)).slice(0, 5);
            const removedLines = oldLines.filter((l) => !newLines.includes(l)).slice(0, 5);
            if (addedLines.length || removedLines.length) {
              changesSummary += `\n${change.filename}:\n`;
              removedLines.forEach((l) => { changesSummary += `- ${l.trim().slice(0, 100)}\n`; });
              addedLines.forEach((l) => { changesSummary += `+ ${l.trim().slice(0, 100)}\n`; });
            }
          }
        }
      } else if (!diff.hasCommits) {
        changesSummary = `Initial commit with files: ${files.map((f) => f.filename).join(", ")}`;
      }

      if (!changesSummary.trim()) {
        return res.json({ message: "Update project files" });
      }

      const anthropic = new Anthropic();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Generate a concise git commit message (max 72 chars first line, optional body) for these changes:\n\n${changesSummary.slice(0, 2000)}\n\nRespond with ONLY the commit message, no quotes or explanation.`
        }],
      });

      const message = response.content[0].type === "text" ? response.content[0].text.trim() : "Update project files";
      res.json({ message });
    } catch (err: any) {
      log(`AI commit message error: ${err.message}`, "ai");
      res.json({ message: "Update project files" });
    }
  });

  // --- SECURITY SCANNER ---
  async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    if (project.userId === userId) return true;
    if (project.teamId) {
      const teams = await storage.getUserTeams(userId);
      return teams.some(t => t.id === project.teamId);
    }
    return false;
  }

  app.post("/api/projects/:id/security/scan", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId!;
      if (!await verifyProjectAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });

      const scan = await storage.createSecurityScan({ projectId, userId });
      const projectFiles = await storage.getFiles(projectId);

      type FindingEntry = { severity: string; title: string; description: string; file: string; line: number | null; code: string | null; suggestion: string | null };
      const findings: FindingEntry[] = [];

      const regexPatterns = [
        { pattern: /\b(password|passwd|secret|api_key|apikey|api[-_]?secret|token|auth[-_]?token)\s*[:=]\s*["'`][^"'`]{4,}["'`]/gi, severity: "critical", title: "Hardcoded secret/credential", description: "Hardcoded secrets in source code can be exposed if the code is shared or committed.", suggestion: "Use environment variables or a secrets manager instead." },
        { pattern: /["'`](sk-[a-zA-Z0-9]{20,})["'`]/g, severity: "critical", title: "Hardcoded API key (OpenAI pattern)", description: "API keys should never be hardcoded in source code.", suggestion: "Store API keys in environment variables." },
        { pattern: /["'`](ghp_[a-zA-Z0-9]{36,})["'`]/g, severity: "critical", title: "Hardcoded GitHub token", description: "GitHub personal access tokens should not be in source code.", suggestion: "Use environment variables for tokens." },
        { pattern: /\$\{.*\}\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)/gi, severity: "high", title: "Potential SQL injection", description: "String interpolation in SQL queries can lead to SQL injection attacks.", suggestion: "Use parameterized queries or an ORM." },
        { pattern: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*/gi, severity: "high", title: "SQL string concatenation", description: "Building SQL queries with string concatenation is vulnerable to SQL injection.", suggestion: "Use parameterized queries with placeholders." },
        { pattern: /innerHTML\s*=/g, severity: "high", title: "Direct innerHTML assignment", description: "Setting innerHTML with user input can lead to XSS attacks.", suggestion: "Use textContent or a DOM sanitization library like DOMPurify." },
        { pattern: /document\.write\s*\(/g, severity: "high", title: "Use of document.write()", description: "document.write() can be exploited for XSS attacks.", suggestion: "Use DOM manipulation methods instead." },
        { pattern: /dangerouslySetInnerHTML/g, severity: "medium", title: "React dangerouslySetInnerHTML", description: "dangerouslySetInnerHTML bypasses React's XSS protections.", suggestion: "Sanitize content with DOMPurify before using dangerouslySetInnerHTML." },
        { pattern: /fs\.(readFile|writeFile|unlink|rmdir|readdir)\s*\([^)]*(?:req\.|params\.|query\.)/g, severity: "high", title: "User input in filesystem operation", description: "Passing user input directly to filesystem operations can lead to path traversal.", suggestion: "Validate file paths against an allow list or base directory." },
        { pattern: /(?:cors\(\s*\)|Access-Control-Allow-Origin.*\*)/g, severity: "medium", title: "Permissive CORS configuration", description: "Allowing all origins can expose the API to cross-origin attacks.", suggestion: "Restrict CORS to specific trusted origins." },
        { pattern: /Math\.random\s*\(\)/g, severity: "low", title: "Weak random number generation", description: "Math.random() is not cryptographically secure.", suggestion: "Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive values." },
        { pattern: /console\.(log|debug|info)\s*\(/g, severity: "info", title: "Console logging", description: "Console logging may leak sensitive information in production.", suggestion: "Remove or guard console statements in production code." },
        { pattern: /(?:http:\/\/)/g, severity: "low", title: "HTTP URL (insecure)", description: "Using HTTP instead of HTTPS can expose data in transit.", suggestion: "Use HTTPS URLs for secure communication." },
      ];

      const pythonRegexPatterns = [
        { pattern: /\bexec\s*\(/g, severity: "critical", title: "Use of exec()", description: "exec() executes arbitrary Python code and can lead to code injection.", suggestion: "Avoid exec(); use safe alternatives or controlled evaluation." },
        { pattern: /\beval\s*\(/g, severity: "critical", title: "Use of eval()", description: "eval() executes arbitrary expressions and can lead to code injection.", suggestion: "Use ast.literal_eval() for safe evaluation of literals." },
        { pattern: /\bos\.system\s*\(/g, severity: "critical", title: "Use of os.system()", description: "os.system() executes shell commands and is vulnerable to injection.", suggestion: "Use subprocess.run() with a list of arguments instead." },
        { pattern: /\bsubprocess\.\w+\s*\([^)]*shell\s*=\s*True/g, severity: "high", title: "Subprocess with shell=True", description: "Using shell=True with subprocess allows shell injection attacks.", suggestion: "Use subprocess with a list of arguments and shell=False." },
        { pattern: /\bpickle\.(load|loads)\s*\(/g, severity: "high", title: "Unsafe pickle deserialization", description: "Deserializing untrusted data with pickle can execute arbitrary code.", suggestion: "Use json or a safe serialization format instead of pickle for untrusted data." },
        { pattern: /\b__import__\s*\(/g, severity: "medium", title: "Dynamic import with __import__", description: "Dynamic imports can load arbitrary modules if input is not controlled.", suggestion: "Use static imports or validate module names against an allow list." },
        { pattern: /\bformat\s*\(.*\bsql\b|\bf["'].*\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi, severity: "high", title: "Potential SQL injection in Python", description: "String formatting in SQL queries is vulnerable to injection.", suggestion: "Use parameterized queries with %s or ? placeholders." },
      ];

      function runAstAnalysis(content: string, filename: string): FindingEntry[] {
        const astFindings: FindingEntry[] = [];
        try {
          const acorn = require("acorn");
          const walk = require("acorn-walk");

          const isJsx = filename.endsWith(".jsx") || filename.endsWith(".tsx");
          let parseContent = content;
          if (filename.endsWith(".ts") || filename.endsWith(".tsx")) {
            parseContent = content
              .replace(/:\s*\w[\w<>\[\]|&,\s]*(?=[;=,\)\}\]\n])/g, "")
              .replace(/\bas\s+\w+/g, "")
              .replace(/<\w+(?:\s+extends\s+\w+)?>/g, "");
          }

          let ast: any;
          try {
            ast = acorn.parse(parseContent, {
              ecmaVersion: "latest",
              sourceType: "module",
              locations: true,
              allowImportExportEverywhere: true,
              allowReturnOutsideFunction: true,
              allowHashBang: true,
              ...(isJsx ? {} : {}),
            });
          } catch {
            return astFindings;
          }

          walk.simple(ast, {
            CallExpression(node: any) {
              const callee = node.callee;
              if (callee.type === "Identifier" && callee.name === "eval") {
                astFindings.push({
                  severity: "critical",
                  title: "Use of eval() (AST detected)",
                  description: "eval() executes arbitrary code. Detected via AST analysis of the call expression.",
                  file: filename,
                  line: node.loc?.start?.line ?? null,
                  code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                  suggestion: "Use JSON.parse() for JSON data, or a safe alternative to eval().",
                });
              }

              if (callee.type === "Identifier" && callee.name === "setTimeout" || callee.name === "setInterval") {
                if (node.arguments.length > 0 && node.arguments[0].type === "Literal" && typeof node.arguments[0].value === "string") {
                  astFindings.push({
                    severity: "high",
                    title: `String argument to ${callee.name}() (AST detected)`,
                    description: `Passing a string to ${callee.name}() is equivalent to eval() and can execute arbitrary code.`,
                    file: filename,
                    line: node.loc?.start?.line ?? null,
                    code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                    suggestion: "Pass a function reference instead of a string.",
                  });
                }
              }

              if (callee.type === "MemberExpression") {
                const obj = callee.object;
                const prop = callee.property;

                if (obj.type === "Identifier" && obj.name === "child_process" ||
                    (prop.type === "Identifier" && (prop.name === "exec" || prop.name === "execSync") &&
                     obj.type === "Identifier" && obj.name !== "RegExp")) {
                  const hasTemplateOrConcat = node.arguments.some((arg: any) =>
                    arg.type === "TemplateLiteral" || arg.type === "BinaryExpression"
                  );
                  if (hasTemplateOrConcat) {
                    astFindings.push({
                      severity: "critical",
                      title: "Command injection risk (AST detected)",
                      description: "Dynamic string passed to command execution function detected via AST analysis.",
                      file: filename,
                      line: node.loc?.start?.line ?? null,
                      code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                      suggestion: "Use execFile() with an argument array, or sanitize inputs.",
                    });
                  }
                }
              }
            },

            NewExpression(node: any) {
              if (node.callee.type === "Identifier" && node.callee.name === "Function") {
                astFindings.push({
                  severity: "high",
                  title: "Dynamic Function constructor (AST detected)",
                  description: "The Function constructor creates functions from strings, similar to eval().",
                  file: filename,
                  line: node.loc?.start?.line ?? null,
                  code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                  suggestion: "Avoid dynamic code generation; use static functions instead.",
                });
              }
            },

            AssignmentExpression(node: any) {
              if (node.left.type === "MemberExpression" && node.left.property.type === "Identifier") {
                if (node.left.property.name === "innerHTML" || node.left.property.name === "outerHTML") {
                  const hasUserInput = node.right.type === "TemplateLiteral" ||
                    node.right.type === "BinaryExpression" ||
                    (node.right.type === "Identifier" && !["''", '""', "``"].includes(node.right.name));
                  if (hasUserInput) {
                    astFindings.push({
                      severity: "high",
                      title: `Dynamic ${node.left.property.name} assignment (AST detected)`,
                      description: `Setting ${node.left.property.name} with dynamic content can lead to XSS attacks.`,
                      file: filename,
                      line: node.loc?.start?.line ?? null,
                      code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                      suggestion: "Use textContent or sanitize with DOMPurify.",
                    });
                  }
                }
              }
            },

            ImportDeclaration(node: any) {
              if (node.source.value === "child_process") {
                astFindings.push({
                  severity: "medium",
                  title: "child_process import (AST detected)",
                  description: "Importing child_process can lead to command injection if not used carefully.",
                  file: filename,
                  line: node.loc?.start?.line ?? null,
                  code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                  suggestion: "Ensure all child_process usage validates and sanitizes inputs.",
                });
              }
            },
          });
        } catch {}
        return astFindings;
      }

      for (const file of projectFiles) {
        const ext = file.filename.split(".").pop()?.toLowerCase();
        if (!ext || !["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "mjs", "cjs"].includes(ext)) continue;

        const isJsLike = ["js", "ts", "jsx", "tsx", "mjs", "cjs"].includes(ext);
        const isPython = ext === "py";

        if (isJsLike) {
          const astResults = runAstAnalysis(file.content, file.filename);
          findings.push(...astResults);
        }

        const patternsToUse = isPython
          ? [...regexPatterns, ...pythonRegexPatterns]
          : regexPatterns;

        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const rule of patternsToUse) {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(line)) {
              const isDuplicate = isJsLike && findings.some(f =>
                f.file === file.filename && f.line === i + 1 && f.title.replace(" (AST detected)", "") === rule.title
              );
              if (!isDuplicate) {
                findings.push({
                  severity: rule.severity,
                  title: rule.title,
                  description: rule.description,
                  file: file.filename,
                  line: i + 1,
                  code: line.trim().slice(0, 200),
                  suggestion: rule.suggestion,
                });
              }
            }
          }
        }
      }

      const knownVulnDeps: Record<string, { severity: string; description: string; suggestion: string }> = {
        "lodash": { severity: "medium", description: "Older lodash versions have prototype pollution vulnerabilities.", suggestion: "Update to lodash >=4.17.21." },
        "express": { severity: "info", description: "Ensure express is up-to-date for security patches.", suggestion: "Keep express updated to the latest version." },
        "jquery": { severity: "medium", description: "jQuery has known XSS vulnerabilities in older versions.", suggestion: "Update jQuery to >=3.5.0 or use vanilla JS." },
        "moment": { severity: "low", description: "moment.js is in maintenance mode with known ReDoS issues.", suggestion: "Consider migrating to date-fns or dayjs." },
        "minimist": { severity: "medium", description: "minimist has prototype pollution vulnerabilities in older versions.", suggestion: "Update to minimist >=1.2.6." },
        "node-fetch": { severity: "low", description: "node-fetch v2 has known issues; consider built-in fetch.", suggestion: "Use built-in fetch (Node 18+) or update to node-fetch v3." },
      };

      const knownVulnPyDeps: Record<string, { severity: string; description: string; suggestion: string }> = {
        "pyyaml": { severity: "high", description: "PyYAML yaml.load() without Loader argument can execute arbitrary code.", suggestion: "Use yaml.safe_load() instead of yaml.load()." },
        "requests": { severity: "info", description: "Keep requests updated for security patches.", suggestion: "Update to the latest version of requests." },
        "flask": { severity: "info", description: "Ensure Flask is up-to-date for security patches.", suggestion: "Update Flask to the latest version." },
        "django": { severity: "info", description: "Ensure Django is up-to-date for security patches.", suggestion: "Update Django to the latest LTS version." },
        "jinja2": { severity: "medium", description: "Older Jinja2 versions have sandbox escape vulnerabilities.", suggestion: "Update to Jinja2 >=3.1.2." },
        "pillow": { severity: "medium", description: "Older Pillow versions have buffer overflow vulnerabilities.", suggestion: "Update to Pillow >=9.3.0." },
        "paramiko": { severity: "medium", description: "Older paramiko versions have authentication bypass issues.", suggestion: "Update to paramiko >=3.4.0." },
      };

      const packageJson = projectFiles.find(f => f.filename === "package.json");
      if (packageJson) {
        try {
          const pkg = JSON.parse(packageJson.content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          for (const [dep, info] of Object.entries(knownVulnDeps)) {
            if (deps[dep]) {
              findings.push({
                severity: info.severity,
                title: `Dependency: ${dep}`,
                description: info.description,
                file: "package.json",
                line: null,
                code: `"${dep}": "${deps[dep]}"`,
                suggestion: info.suggestion,
              });
            }
          }
        } catch {}
      }

      const requirementsTxt = projectFiles.find(f => f.filename === "requirements.txt");
      if (requirementsTxt) {
        try {
          const lines = requirementsTxt.content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("#")) continue;
            const match = line.match(/^([a-zA-Z0-9_-]+)\s*(?:[=<>!~]+\s*(.*))?$/);
            if (match) {
              const pkgName = match[1].toLowerCase();
              const version = match[2] || "unknown";
              for (const [dep, info] of Object.entries(knownVulnPyDeps)) {
                if (pkgName === dep || pkgName === dep.replace(/-/g, "_")) {
                  findings.push({
                    severity: info.severity,
                    title: `Python dependency: ${pkgName}`,
                    description: info.description,
                    file: "requirements.txt",
                    line: i + 1,
                    code: line,
                    suggestion: info.suggestion,
                  });
                }
              }
            }
          }
        } catch {}
      }

      const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of findings) {
        if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
      }

      if (findings.length > 0) {
        await storage.createSecurityFindings(findings.map(f => ({ scanId: scan.id, ...f })));
      }

      const updated = await storage.updateSecurityScan(scan.id, {
        status: "completed",
        totalFindings: findings.length,
        ...counts,
        finishedAt: new Date(),
      });

      res.json(updated);
    } catch (err: any) {
      log(`Security scan error: ${err.message}`, "security");
      res.status(500).json({ message: "Scan failed" });
    }
  });

  app.get("/api/projects/:id/security/scans", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const scans = await storage.getProjectScans(req.params.id);
      res.json(scans);
    } catch {
      res.status(500).json({ message: "Failed to fetch scans" });
    }
  });

  app.get("/api/projects/:id/security/scans/:scanId/findings", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const scan = (await storage.getProjectScans(req.params.id)).find(s => s.id === req.params.scanId);
      if (!scan) return res.status(404).json({ message: "Scan not found in this project" });
      const findings = await storage.getScanFindings(req.params.scanId);
      res.json(findings);
    } catch {
      res.status(500).json({ message: "Failed to fetch findings" });
    }
  });

  // --- APP STORAGE: KEY-VALUE ---
  app.get("/api/projects/:id/storage/kv", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const entries = await storage.getStorageKvEntries(req.params.id);
      res.json(entries);
    } catch {
      res.status(500).json({ message: "Failed to fetch KV entries" });
    }
  });

  app.put("/api/projects/:id/storage/kv", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { key, value } = req.body;
      if (!key || typeof key !== "string" || typeof value !== "string") {
        return res.status(400).json({ message: "Key and value are required strings" });
      }
      if (key.length > 256) return res.status(400).json({ message: "Key too long (max 256 chars)" });
      if (value.length > 65536) return res.status(400).json({ message: "Value too long (max 64KB)" });
      const entry = await storage.setStorageKvEntry(req.params.id, key, value);
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to set KV entry" });
    }
  });

  app.delete("/api/projects/:id/storage/kv/:key", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const key = decodeURIComponent(req.params.key);
      const deleted = await storage.deleteStorageKvEntry(req.params.id, key);
      if (!deleted) return res.status(404).json({ message: "Key not found" });
      res.json({ message: "Deleted" });
    } catch {
      res.status(500).json({ message: "Failed to delete KV entry" });
    }
  });

  // --- APP STORAGE: OBJECTS ---
  const PERSISTENT_STORAGE_DIR = path.join(process.cwd(), ".storage", "objects");
  const STORAGE_UPLOAD_TEMP = path.join(process.cwd(), ".storage", "tmp");
  const storageUpload = multer({
    dest: STORAGE_UPLOAD_TEMP,
    limits: { fileSize: UPLOAD_LIMITS.objectStorage },
  });

  app.get("/api/projects/:id/storage/objects", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const objects = await storage.getStorageObjects(req.params.id);
      res.json(objects);
    } catch {
      res.status(500).json({ message: "Failed to fetch objects" });
    }
  });

  app.post("/api/projects/:id/storage/objects", requireAuth, storageUpload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      if (file.size === 0) return res.status(400).json({ message: "Empty file (0 bytes) cannot be uploaded" });

      const projectId = req.params.id;
      const { mkdir, rename } = await import("fs/promises");

      const storageDir = path.join(PERSISTENT_STORAGE_DIR, projectId);
      await mkdir(storageDir, { recursive: true });
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
      const storagePath = path.join(storageDir, `${Date.now()}_${safeName}`);
      await rename(file.path, storagePath);

      const obj = await storage.createStorageObject({
        projectId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
      });
      res.json(obj);
    } catch (err: any) {
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.get("/api/projects/:id/storage/objects/:objId/download", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const obj = await storage.getStorageObject(req.params.objId);
      if (!obj || obj.projectId !== req.params.id) return res.status(404).json({ message: "Object not found" });

      const { createReadStream } = await import("fs");
      const { stat } = await import("fs/promises");

      try {
        await stat(obj.storagePath);
      } catch {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.setHeader("Content-Type", obj.mimeType);
      const encodedFilename = encodeURIComponent(obj.filename).replace(/'/g, "%27");
      res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
      createReadStream(obj.storagePath).pipe(res);
    } catch {
      res.status(500).json({ message: "Download failed" });
    }
  });

  app.delete("/api/projects/:id/storage/objects/:objId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const obj = await storage.getStorageObject(req.params.objId);
      if (!obj || obj.projectId !== req.params.id) return res.status(404).json({ message: "Object not found" });

      try {
        const { unlink } = await import("fs/promises");
        await unlink(obj.storagePath);
      } catch {}

      const deleted = await storage.deleteStorageObject(req.params.objId);
      if (!deleted) return res.status(404).json({ message: "Object not found" });
      res.json({ message: "Deleted" });
    } catch {
      res.status(500).json({ message: "Failed to delete object" });
    }
  });

  app.get("/api/projects/:id/storage/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const usage = await storage.getProjectStorageUsage(req.params.id);
      res.json(usage);
    } catch {
      res.status(500).json({ message: "Failed to fetch usage" });
    }
  });

  // --- GENERATED FILE DOWNLOAD ---
  app.get("/api/projects/:id/generated-files/:fileId/download", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const entry = await loadGeneratedFileMeta(req.params.id, req.params.fileId);
      if (!entry) {
        return res.status(404).json({ message: "File not found" });
      }

      const { createReadStream } = await import("fs");
      const { stat } = await import("fs/promises");

      try {
        await stat(entry.storagePath);
      } catch {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.setHeader("Content-Type", entry.mimeType);
      const encodedFilename = encodeURIComponent(entry.filename).replace(/'/g, "%27");
      res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
      createReadStream(entry.storagePath).pipe(res);
    } catch {
      res.status(500).json({ message: "Download failed" });
    }
  });

  app.post("/api/projects/:id/generate-file", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { format, filename, title, sections } = req.body;

      if (!format || !["pdf", "docx", "xlsx", "csv"].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Use pdf, docx, xlsx, or csv." });
      }
      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ message: "Filename is required" });
      }
      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ message: "At least one section is required" });
      }

      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safeName || safeName.startsWith(".")) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      const fileBuffer = await generateFile({ format, filename: safeName, title, sections });

      const fs = await import("fs");
      const { mkdir } = await import("fs/promises");
      const generatedDir = path.join(process.cwd(), ".storage", "generated", req.params.id);
      await mkdir(generatedDir, { recursive: true });
      const storagePath = path.join(generatedDir, `${Date.now()}_${safeName}`);
      fs.writeFileSync(storagePath, fileBuffer);

      const fileId = crypto.randomUUID();
      const mimeType = getMimeType(format);
      await persistGeneratedFileMeta(fileId, {
        projectId: req.params.id,
        filename: safeName,
        storagePath,
        mimeType,
        size: fileBuffer.length,
      });

      const downloadUrl = `/api/projects/${req.params.id}/generated-files/${fileId}/download`;

      res.json({
        filename: safeName,
        format,
        downloadUrl,
        mimeType,
        size: fileBuffer.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "File generation failed" });
    }
  });

  // --- PROJECT AUTH ---
  app.get("/api/projects/:id/auth/config", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const config = await storage.getProjectAuthConfig(req.params.id);
      res.json(config || { enabled: false, providers: ["email"], requireEmailVerification: false, sessionDurationHours: 24, allowedDomains: [] });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get auth config" });
    }
  });

  app.put("/api/projects/:id/auth/config", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const schema = z.object({
        enabled: z.boolean().optional(),
        providers: z.array(z.string()).optional(),
        requireEmailVerification: z.boolean().optional(),
        sessionDurationHours: z.number().min(1).max(720).optional(),
        allowedDomains: z.array(z.string()).optional(),
      });
      const data = schema.parse(req.body);
      const config = await storage.upsertProjectAuthConfig(req.params.id, data);
      res.json(config);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update auth config" });
    }
  });

  app.get("/api/projects/:id/auth/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const users = await storage.getProjectAuthUsers(req.params.id);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get auth users" });
    }
  });

  app.post("/api/projects/:id/auth/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        provider: z.string().default("email"),
      });
      const data = schema.parse(req.body);
      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await storage.createProjectAuthUser(req.params.id, data.email, passwordHash, data.provider);
      res.status(201).json(user);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err.code === "23505") return res.status(409).json({ message: "User already exists" });
      res.status(500).json({ message: "Failed to create auth user" });
    }
  });

  app.delete("/api/projects/:id/auth/users/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const deleted = await storage.deleteProjectAuthUser(req.params.id, req.params.userId);
      if (!deleted) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete auth user" });
    }
  });

  // --- INTEGRATIONS ---
  app.get("/api/integrations/catalog", requireAuth, async (_req: Request, res: Response) => {
    try {
      const catalog = await storage.getIntegrationCatalog();
      res.json(catalog);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get integration catalog" });
    }
  });

  app.get("/api/projects/:id/integrations", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const integrations = await storage.getProjectIntegrations(req.params.id);
      res.json(integrations);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get integrations" });
    }
  });

  app.post("/api/projects/:id/integrations", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const schema = z.object({
        integrationId: z.string(),
        config: z.record(z.string()).default({}),
      });
      const data = schema.parse(req.body);

      const catalogEntry = (await storage.getIntegrationCatalog()).find(c => c.id === data.integrationId);
      const integrationName = catalogEntry?.name || "Unknown";

      const pi = await storage.connectIntegration(req.params.id, data.integrationId, data.config);
      await storage.addIntegrationLog(pi.id, "info", `Integration "${integrationName}" added, verifying credentials...`);

      const testResult = await testIntegrationConnection(integrationName, data.config);
      if (testResult.success) {
        await storage.updateIntegrationStatus(pi.id, "connected");
        await storage.addIntegrationLog(pi.id, "info", `Connection verified: ${testResult.message}`);
      } else if (testResult.noLiveTest) {
        await storage.updateIntegrationStatus(pi.id, "unverified");
        await storage.addIntegrationLog(pi.id, "warn", `${testResult.message}`);
      } else {
        await storage.updateIntegrationStatus(pi.id, "error");
        await storage.addIntegrationLog(pi.id, "error", `Connection test failed: ${testResult.message}`);
      }

      const updated = (await storage.getProjectIntegrations(req.params.id)).find(i => i.id === pi.id);
      res.status(201).json(updated || pi);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err.code === "23505") return res.status(409).json({ message: "Integration already connected" });
      res.status(500).json({ message: "Failed to connect integration" });
    }
  });

  app.post("/api/projects/:id/integrations/:integrationId/test", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const integrations = await storage.getProjectIntegrations(req.params.id);
      const pi = integrations.find(i => i.id === req.params.integrationId);
      if (!pi) return res.status(404).json({ message: "Integration not found" });

      const testResult = await testIntegrationConnection(pi.integration.name, pi.config);
      if (testResult.success) {
        await storage.updateIntegrationStatus(pi.id, "connected");
        await storage.addIntegrationLog(pi.id, "info", `Re-test passed: ${testResult.message}`);
      } else if (testResult.noLiveTest) {
        await storage.updateIntegrationStatus(pi.id, "unverified");
        await storage.addIntegrationLog(pi.id, "warn", `${testResult.message}`);
      } else {
        await storage.updateIntegrationStatus(pi.id, "error");
        await storage.addIntegrationLog(pi.id, "error", `Re-test failed: ${testResult.message}`);
      }
      res.json({ success: testResult.success, message: testResult.message });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to test integration" });
    }
  });

  app.delete("/api/projects/:id/integrations/:integrationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });

      const integrations = await storage.getProjectIntegrations(req.params.id);
      const pi = integrations.find(i => i.id === req.params.integrationId);
      if (pi) {
        await storage.addIntegrationLog(pi.id, "info", `Integration "${pi.integration.name}" disconnected`);
      }

      const deleted = await storage.disconnectIntegration(req.params.id, req.params.integrationId);
      if (!deleted) return res.status(404).json({ message: "Integration not found" });
      res.json({ message: "Integration disconnected" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to disconnect integration" });
    }
  });

  app.get("/api/projects/:id/integrations/:integrationId/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
      const logs = await storage.getIntegrationLogs(req.params.id, req.params.integrationId, 50);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get integration logs" });
    }
  });

  // --- CONNECTOR PROXY ROUTES ---

  app.get("/api/connectors/supported", requireAuth, async (_req: Request, res: Response) => {
    const connectors = getSupportedConnectors().map(name => {
      const key = getConnectorKey(name);
      return { name, key, operations: key ? getConnectorOperations(key) : [] };
    });
    res.json(connectors);
  });

  app.post("/api/projects/:id/connectors/:connectorName/execute", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });

      const connectorName = req.params.connectorName as string;
      const connectorKey = getConnectorKey(connectorName) || connectorName.toLowerCase();
      const { operation, params } = req.body;
      if (!operation) return res.status(400).json({ message: "operation is required" });

      const integrations = await storage.getProjectIntegrations(req.params.id);
      const matchedIntegration = integrations.find(i => {
        const key = getConnectorKey(i.integration.name);
        return key === connectorKey && (i.status === "connected" || i.status === "unverified");
      });

      if (!matchedIntegration) {
        return res.status(400).json({ message: `No connected ${req.params.connectorName} integration found. Connect it first from the Integrations panel.` });
      }

      const result = await executeConnectorOperation(connectorKey, operation, params || {}, matchedIntegration.config || {});

      if (matchedIntegration) {
        await storage.addIntegrationLog(
          matchedIntegration.id,
          result.success ? "info" : "error",
          `${operation}: ${result.success ? "Success" : result.error || "Failed"}`
        );
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Connector operation failed" });
    }
  });

  // --- AUTOMATIONS ---
  app.get("/api/projects/:id/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const list = await storage.getAutomations(req.params.id);
      const sanitized = list.map(a => ({
        ...a,
        slackBotToken: a.slackBotToken ? "****" + a.slackBotToken.slice(-4) : null,
        slackSigningSecret: a.slackSigningSecret ? "****" + a.slackSigningSecret.slice(-4) : null,
        telegramBotToken: a.telegramBotToken ? "****" + a.telegramBotToken.slice(-4) : null,
      }));
      res.json(sanitized);
    } catch {
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post("/api/projects/:id/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, type, cronExpression, script, language, slackBotToken, slackSigningSecret, telegramBotToken } = req.body;
      if (!name || !type) return res.status(400).json({ message: "Name and type are required" });

      const data: Parameters<typeof storage.createAutomation>[0] = {
        projectId: req.params.id, name, type, script: script || "", language: language || "javascript",
      };
      if (type === "cron" && cronExpression) {
        const { validateCronExpression } = await import("./automationScheduler");
        if (!validateCronExpression(cronExpression)) return res.status(400).json({ message: "Invalid cron expression" });
        data.cronExpression = cronExpression;
      }
      if (type === "webhook") {
        const { generateWebhookToken } = await import("./automationScheduler");
        data.webhookToken = generateWebhookToken();
      }
      if (type === "slack") {
        if (!slackBotToken || !slackSigningSecret) return res.status(400).json({ message: "Slack bot token and signing secret are required" });
        data.slackBotToken = slackBotToken;
        data.slackSigningSecret = slackSigningSecret;
      }
      if (type === "telegram") {
        if (!telegramBotToken) return res.status(400).json({ message: "Telegram bot token is required" });
        data.telegramBotToken = telegramBotToken;
      }

      const automation = await storage.createAutomation(data);

      if (type === "cron" && cronExpression && automation.enabled) {
        const { scheduleAutomation } = await import("./automationScheduler");
        scheduleAutomation(automation.id, cronExpression);
      }
      if (type === "slack" && automation.enabled && automation.slackBotToken && automation.slackSigningSecret) {
        const { startSlackBot } = await import("./slackBot");
        startSlackBot(automation.id, automation.slackBotToken, automation.slackSigningSecret).catch(err =>
          log(`Failed to start Slack bot: ${err.message}`, "automation"));
      }
      if (type === "telegram" && automation.enabled && automation.telegramBotToken) {
        const { startTelegramBot } = await import("./telegramBot");
        startTelegramBot(automation.id, automation.telegramBotToken).catch(err =>
          log(`Failed to start Telegram bot: ${err.message}`, "automation"));
      }

      res.status(201).json(automation);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create automation" });
    }
  });

  app.patch("/api/automations/:automationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.script !== undefined) updates.script = req.body.script;
      if (req.body.language !== undefined) updates.language = req.body.language;
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
      if (req.body.cronExpression !== undefined) {
        const { validateCronExpression } = await import("./automationScheduler");
        if (!validateCronExpression(req.body.cronExpression)) return res.status(400).json({ message: "Invalid cron expression" });
        updates.cronExpression = req.body.cronExpression;
      }
      if (req.body.slackBotToken !== undefined) updates.slackBotToken = req.body.slackBotToken;
      if (req.body.slackSigningSecret !== undefined) updates.slackSigningSecret = req.body.slackSigningSecret;
      if (req.body.telegramBotToken !== undefined) updates.telegramBotToken = req.body.telegramBotToken;

      const updated = await storage.updateAutomation(req.params.automationId, updates);

      const { scheduleAutomation, unscheduleAutomation, stopBotAutomation } = await import("./automationScheduler");
      if (updated && updated.type === "cron") {
        if (updated.enabled && updated.cronExpression) {
          scheduleAutomation(updated.id, updated.cronExpression);
        } else {
          unscheduleAutomation(updated.id);
        }
      }
      if (updated && updated.type === "slack") {
        const { startSlackBot, stopSlackBot } = await import("./slackBot");
        if (updated.enabled && updated.slackBotToken && updated.slackSigningSecret) {
          await startSlackBot(updated.id, updated.slackBotToken, updated.slackSigningSecret);
        } else {
          await stopSlackBot(updated.id);
        }
      }
      if (updated && updated.type === "telegram") {
        const { startTelegramBot, stopTelegramBot } = await import("./telegramBot");
        if (updated.enabled && updated.telegramBotToken) {
          await startTelegramBot(updated.id, updated.telegramBotToken);
        } else {
          await stopTelegramBot(updated.id);
        }
      }

      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update automation" });
    }
  });

  app.delete("/api/automations/:automationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { unscheduleAutomation, stopBotAutomation } = await import("./automationScheduler");
      unscheduleAutomation(req.params.automationId);
      await stopBotAutomation(req.params.automationId);

      await storage.deleteAutomation(req.params.automationId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });

  app.post("/api/automations/:automationId/trigger", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      broadcastToProject(automation.projectId, {
        type: "automation_started",
        automationId: automation.id,
        name: automation.name,
        triggeredBy: "manual",
      });

      const { executeAutomation } = await import("./automationScheduler");
      let triggeredBy = "manual";
      let eventPayload: string | undefined;

      if (req.body.testMessage && (automation.type === "slack" || automation.type === "telegram")) {
        triggeredBy = `${automation.type}-test`;
        if (automation.type === "slack") {
          eventPayload = JSON.stringify({
            type: "slack_message",
            text: req.body.testMessage,
            user: "test-user",
            channel: "test-channel",
            ts: String(Date.now()),
          });
        } else {
          eventPayload = JSON.stringify({
            type: "telegram_message",
            messageId: Date.now(),
            text: req.body.testMessage,
            from: { id: 0, firstName: "Test", lastName: "User", username: "test_user" },
            chat: { id: 0, type: "private", title: undefined },
            date: Math.floor(Date.now() / 1000),
          });
        }
      }

      const result = await executeAutomation(req.params.automationId, triggeredBy, eventPayload);

      broadcastToProject(automation.projectId, {
        type: "automation_completed",
        automationId: automation.id,
        name: automation.name,
        success: result.success,
        runId: result.runId,
      });

      if (result.runId) {
        const run = await storage.getAutomationRuns(automation.id, 1);
        if (run[0]) {
          broadcastToProject(automation.projectId, {
            type: "automation_log",
            automationId: automation.id,
            runId: result.runId,
            stdout: run[0].stdout || "",
            stderr: run[0].stderr || "",
            exitCode: run[0].exitCode,
            durationMs: run[0].durationMs,
          });
        }
      }

      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to trigger automation" });
    }
  });

  app.get("/api/automations/:automationId/runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const runs = await storage.getAutomationRuns(req.params.automationId);
      res.json(runs);
    } catch {
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.all("/api/webhooks/automation/:token", async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomationByWebhookToken(req.params.token);
      if (!automation) return res.status(404).json({ message: "Webhook not found" });
      if (!automation.enabled) return res.status(403).json({ message: "Automation is disabled" });

      const { executeAutomation } = await import("./automationScheduler");
      const result = await executeAutomation(automation.id, "webhook");
      res.json(result);
    } catch {
      res.status(500).json({ message: "Webhook execution failed" });
    }
  });

  app.post("/api/automations/test-slack", requireAuth, async (req: Request, res: Response) => {
    try {
      const { botToken, signingSecret } = req.body;
      if (!botToken || !signingSecret) return res.status(400).json({ message: "Bot token and signing secret are required" });
      const { testSlackConnection } = await import("./slackBot");
      const result = await testSlackConnection(botToken, signingSecret);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to test Slack connection" });
    }
  });

  app.post("/api/automations/test-telegram", requireAuth, async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      if (!botToken) return res.status(400).json({ message: "Bot token is required" });
      const { testTelegramConnection } = await import("./telegramBot");
      const result = await testTelegramConnection(botToken);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to test Telegram connection" });
    }
  });

  app.get("/api/automations/:automationId/bot-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.automationId);
      if (!automation) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(automation.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      let status = automation.botStatus || "disconnected";
      if (automation.type === "slack") {
        const { getSlackBotStatus } = await import("./slackBot");
        status = getSlackBotStatus(automation.id);
      } else if (automation.type === "telegram") {
        const { getTelegramBotStatus } = await import("./telegramBot");
        status = getTelegramBotStatus(automation.id);
      }

      res.json({ status });
    } catch {
      res.status(500).json({ message: "Failed to get bot status" });
    }
  });

  // --- WORKFLOWS ---
  app.get("/api/projects/:id/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const list = await storage.getWorkflows(req.params.id);
      const withSteps = await Promise.all(list.map(async (w) => {
        const steps = await storage.getWorkflowSteps(w.id);
        return { ...w, steps };
      }));
      res.json(withSteps);
    } catch {
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/projects/:id/workflows", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, triggerEvent, steps } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });

      const workflow = await storage.createWorkflow({ projectId: req.params.id, name, triggerEvent: triggerEvent || "manual" });

      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          await storage.createWorkflowStep({ workflowId: workflow.id, name: steps[i].name || `Step ${i + 1}`, command: steps[i].command || "echo 'hello'", orderIndex: i, continueOnError: steps[i].continueOnError || false });
        }
      }

      const createdSteps = await storage.getWorkflowSteps(workflow.id);
      res.status(201).json({ ...workflow, steps: createdSteps });
    } catch {
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  app.post("/api/projects/:id/workflows/from-template", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { templateName } = req.body;
      const { WORKFLOW_TEMPLATES } = await import("./workflowExecutor");
      const template = WORKFLOW_TEMPLATES.find(t => t.name === templateName);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const workflow = await storage.createWorkflow({ projectId: req.params.id, name: template.name, triggerEvent: template.triggerEvent });
      for (let i = 0; i < template.steps.length; i++) {
        await storage.createWorkflowStep({ workflowId: workflow.id, name: template.steps[i].name, command: template.steps[i].command, orderIndex: i });
      }

      const createdSteps = await storage.getWorkflowSteps(workflow.id);
      res.status(201).json({ ...workflow, steps: createdSteps });
    } catch {
      res.status(500).json({ message: "Failed to create from template" });
    }
  });

  app.patch("/api/workflows/:workflowId", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.triggerEvent !== undefined) updates.triggerEvent = req.body.triggerEvent;
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;

      const updated = await storage.updateWorkflow(req.params.workflowId, updates);
      const steps = await storage.getWorkflowSteps(req.params.workflowId);
      res.json({ ...updated, steps });
    } catch {
      res.status(500).json({ message: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:workflowId", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      await storage.deleteWorkflow(req.params.workflowId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  app.post("/api/workflows/:workflowId/steps", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { name, command, orderIndex, continueOnError } = req.body;
      const step = await storage.createWorkflowStep({ workflowId: req.params.workflowId, name: name || "New Step", command: command || "echo 'hello'", orderIndex: orderIndex ?? 0, continueOnError: continueOnError || false });
      res.status(201).json(step);
    } catch {
      res.status(500).json({ message: "Failed to create step" });
    }
  });

  app.patch("/api/workflow-steps/:stepId", requireAuth, async (req: Request, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.stepId);
      if (!step) return res.status(404).json({ message: "Step not found" });
      const workflow = await storage.getWorkflow(step.workflowId);
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.command !== undefined) updates.command = req.body.command;
      if (req.body.orderIndex !== undefined) updates.orderIndex = req.body.orderIndex;
      if (req.body.continueOnError !== undefined) updates.continueOnError = req.body.continueOnError;

      const updated = await storage.updateWorkflowStep(req.params.stepId, updates);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update step" });
    }
  });

  app.delete("/api/workflow-steps/:stepId", requireAuth, async (req: Request, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.stepId);
      if (!step) return res.status(404).json({ message: "Step not found" });
      const workflow = await storage.getWorkflow(step.workflowId);
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      await storage.deleteWorkflowStep(req.params.stepId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete step" });
    }
  });

  app.post("/api/workflows/:workflowId/run", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const { executeWorkflow } = await import("./workflowExecutor");
      const result = await executeWorkflow(req.params.workflowId);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to run workflow" });
    }
  });

  app.get("/api/workflows/:workflowId/runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ message: "Not found" });
      if (!await verifyProjectAccess(workflow.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });

      const runs = await storage.getWorkflowRuns(req.params.workflowId);
      res.json(runs);
    } catch {
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.get("/api/workflow-templates", requireAuth, async (_req: Request, res: Response) => {
    const { WORKFLOW_TEMPLATES } = await import("./workflowExecutor");
    res.json(WORKFLOW_TEMPLATES);
  });

  // ===================== MONITORING ROUTES =====================
  app.get("/api/projects/:id/monitoring/metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const metrics = await storage.getMonitoringMetrics(project.id);
      res.json(metrics);
    } catch { res.status(500).json({ message: "Failed to load metrics" }); }
  });

  app.get("/api/projects/:id/monitoring/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const summary = await storage.getMonitoringSummary(project.id);
      if (!summary) {
        return res.json(null);
      }
      const realMetrics = getRealMetrics();
      res.json({
        ...summary,
        cpuPercent: summary.cpuPercent || realMetrics.cpuPercent,
        memoryMb: summary.memoryMb || realMetrics.memoryMb,
      });
    } catch { res.status(500).json({ message: "Failed to load summary" }); }
  });

  app.post("/api/projects/:id/monitoring/record", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const realMetrics = getRealMetrics();
      const counters = getAndResetCounters();
      await Promise.all([
        storage.recordMonitoringMetric(project.id, "cpu_usage", Math.round(realMetrics.cpuPercent)),
        storage.recordMonitoringMetric(project.id, "memory_usage", realMetrics.memoryMb),
        storage.recordMonitoringMetric(project.id, "request_count", counters.requests),
        storage.recordMonitoringMetric(project.id, "response_time", counters.avgResponseMs),
        ...(counters.errors > 0 ? [storage.recordMonitoringMetric(project.id, "error_count", counters.errors)] : []),
      ]);
      res.json({ recorded: true });
    } catch { res.status(500).json({ message: "Failed to record metrics" }); }
  });

  app.get("/api/projects/:id/monitoring/alerts", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const alerts = await storage.getMonitoringAlerts(project.id);
      res.json(alerts);
    } catch { res.status(500).json({ message: "Failed to load alerts" }); }
  });

  app.post("/api/projects/:id/monitoring/alerts", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, metricType, threshold, condition } = req.body;
      if (!name || !metricType || threshold === undefined) return res.status(400).json({ message: "Missing fields" });
      const alert = await storage.createMonitoringAlert({ projectId: project.id, name, metricType, threshold, condition: condition || "gt", enabled: true });
      res.status(201).json(alert);
    } catch { res.status(500).json({ message: "Failed to create alert" }); }
  });

  app.patch("/api/projects/:id/monitoring/alerts/:alertId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const alerts = await storage.getMonitoringAlerts(req.params.id);
      const existing = alerts.find(a => a.id === req.params.alertId);
      if (!existing) return res.status(404).json({ message: "Alert not found" });
      const alert = await storage.updateMonitoringAlert(req.params.alertId, req.body);
      if (!alert) return res.status(404).json({ message: "Alert not found" });
      res.json(alert);
    } catch { res.status(500).json({ message: "Failed to update alert" }); }
  });

  app.delete("/api/projects/:id/monitoring/alerts/:alertId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const alerts = await storage.getMonitoringAlerts(req.params.id);
      const existing = alerts.find(a => a.id === req.params.alertId);
      if (!existing) return res.status(404).json({ message: "Alert not found" });
      await storage.deleteMonitoringAlert(req.params.alertId);
      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "Failed to delete alert" }); }
  });

  // ===================== THREADS ROUTES =====================
  app.get("/api/projects/:id/threads", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const threads = await storage.getCodeThreads(project.id);
      const threadsWithCounts = await Promise.all(threads.map(async (t) => {
        const comments = await storage.getThreadComments(t.id);
        const author = await storage.getUser(t.userId);
        return { ...t, commentCount: comments.length, authorName: author?.displayName || author?.email || "User" };
      }));
      res.json(threadsWithCounts);
    } catch { res.status(500).json({ message: "Failed to load threads" }); }
  });

  app.post("/api/projects/:id/threads", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { title, filename, lineNumber } = req.body;
      if (!title || !filename) return res.status(400).json({ message: "Title and filename are required" });
      const thread = await storage.createCodeThread({ projectId: project.id, userId: req.session.userId!, title, filename, lineNumber: lineNumber || null });
      res.status(201).json(thread);
    } catch { res.status(500).json({ message: "Failed to create thread" }); }
  });

  app.patch("/api/projects/:id/threads/:threadId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      const data: any = {};
      if (req.body.status) data.status = req.body.status;
      if (req.body.status === "resolved") data.resolvedAt = new Date();
      if (req.body.status === "open") data.resolvedAt = null;
      const updated = await storage.updateCodeThread(req.params.threadId, data);
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update thread" }); }
  });

  app.delete("/api/projects/:id/threads/:threadId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      await storage.deleteCodeThread(req.params.threadId);
      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "Failed to delete thread" }); }
  });

  app.get("/api/projects/:id/threads/:threadId/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      const comments = await storage.getThreadComments(req.params.threadId);
      const commentsWithAuthors = await Promise.all(comments.map(async (c) => {
        const author = await storage.getUser(c.userId);
        return { ...c, authorName: author?.displayName || author?.email || "User" };
      }));
      res.json(commentsWithAuthors);
    } catch { res.status(500).json({ message: "Failed to load comments" }); }
  });

  app.post("/api/projects/:id/threads/:threadId/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const thread = await storage.getCodeThread(req.params.threadId);
      if (!thread || thread.projectId !== project.id) return res.status(404).json({ message: "Thread not found" });
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const comment = await storage.createThreadComment({ threadId: req.params.threadId, userId: req.session.userId!, content });
      const author = await storage.getUser(req.session.userId!);
      res.status(201).json({ ...comment, authorName: author?.displayName || author?.email || "User" });
    } catch { res.status(500).json({ message: "Failed to add comment" }); }
  });

  // ===================== SKILLS ROUTES =====================
  app.get("/api/skills/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const skillsList = await storage.getSkills(project.id);
      res.json(skillsList);
    } catch { res.status(500).json({ message: "Failed to load skills" }); }
  });

  app.post("/api/skills/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, description, content } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ message: "Name is required" });
      const skill = await storage.createSkill({
        projectId: project.id,
        name: name.slice(0, 200),
        description: (description || "").slice(0, 1000),
        content: (content || "").slice(0, 50000),
        isActive: true,
      });
      res.status(201).json(skill);
    } catch { res.status(500).json({ message: "Failed to create skill" }); }
  });

  app.put("/api/skills/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const skill = await storage.getSkill(req.params.id);
      if (!skill) return res.status(404).json({ message: "Skill not found" });
      const project = await storage.getProject(skill.projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { name, description, content, isActive } = req.body;
      const updateData: Partial<{ name: string; description: string; content: string; isActive: boolean }> = {};
      if (name !== undefined) updateData.name = String(name).slice(0, 200);
      if (description !== undefined) updateData.description = String(description).slice(0, 1000);
      if (content !== undefined) updateData.content = String(content).slice(0, 50000);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      const updated = await storage.updateSkill(req.params.id, updateData);
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update skill" }); }
  });

  app.delete("/api/skills/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const skill = await storage.getSkill(req.params.id);
      if (!skill) return res.status(404).json({ message: "Skill not found" });
      const project = await storage.getProject(skill.projectId);
      if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      await storage.deleteSkill(req.params.id);
      res.json({ message: "Skill deleted" });
    } catch { res.status(500).json({ message: "Failed to delete skill" }); }
  });

  app.post("/api/skills/:projectId/upload", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { filename, content } = req.body;
      if (!filename || !content) return res.status(400).json({ message: "filename and content required" });
      if (!String(filename).endsWith(".md")) return res.status(400).json({ message: "Only .md files are supported" });
      const name = String(filename).replace(/\.md$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const skill = await storage.createSkill({
        projectId: project.id,
        name: name.slice(0, 200),
        description: `Imported from ${filename}`,
        content: String(content).slice(0, 50000),
        isActive: true,
      });
      res.status(201).json(skill);
    } catch { res.status(500).json({ message: "Failed to upload skill" }); }
  });

  // ===================== NETWORKING ROUTES =====================
  app.get("/api/projects/:id/networking/ports", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const ports = await storage.getPortConfigs(project.id);
      const workspace = await storage.getWorkspaceByProject(project.id);
      const portsWithStatus = await Promise.all(
        ports.map(async (p) => {
          let listening = false;
          if (workspace) {
            try {
              const probeResult = await runnerClient.execInWorkspace(workspace.id, "node", [
                "-e",
                `const s=require("net").createConnection(${p.port},"127.0.0.1");s.on("connect",()=>{console.log("LISTENING");s.destroy();process.exit(0)});s.on("error",()=>{console.log("CLOSED");process.exit(0)});s.setTimeout(1500,()=>{console.log("CLOSED");s.destroy();process.exit(0)})`
              ]);
              if (probeResult && probeResult.stdout.trim() === "LISTENING") {
                listening = true;
              }
            } catch {
              listening = false;
            }
          }
          const proxyUrl = (p.isPublic && workspace) ? `/proxy/${project.id}/${p.port}/` : null;
          return { ...p, listening, proxyUrl };
        })
      );
      res.json(portsWithStatus);
    } catch { res.status(500).json({ message: "Failed to load ports" }); }
  });

  app.post("/api/projects/:id/networking/ports", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { port, label, protocol } = req.body;
      if (!port) return res.status(400).json({ message: "Port is required" });
      const config = await storage.createPortConfig({ projectId: project.id, port, label: label || "", protocol: protocol || "http", isPublic: false });
      res.status(201).json(config);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Port already configured" });
      res.status(500).json({ message: "Failed to add port" });
    }
  });

  app.patch("/api/projects/:id/networking/ports/:portId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const portConfig = await storage.getPortConfig(req.params.portId);
      if (!portConfig || portConfig.projectId !== project.id) return res.status(404).json({ message: "Port config not found" });
      const updated = await storage.updatePortConfig(req.params.portId, req.body);
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update port" }); }
  });

  app.delete("/api/projects/:id/networking/ports/:portId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const portConfig = await storage.getPortConfig(req.params.portId);
      if (!portConfig || portConfig.projectId !== project.id) return res.status(404).json({ message: "Port config not found" });
      await storage.deletePortConfig(req.params.portId);
      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "Failed to delete port" }); }
  });

  app.get("/api/projects/:id/networking/domains", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const domains = await storage.getProjectCustomDomains(project.id);
      res.json(domains);
    } catch { res.status(500).json({ message: "Failed to load domains" }); }
  });

  app.post("/api/projects/:id/networking/domains", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { domain } = req.body;
      if (!domain) return res.status(400).json({ message: "Domain is required" });
      const crypto = await import("crypto");
      const verificationToken = "ecode-verify-" + crypto.randomBytes(16).toString("hex");
      const d = await storage.createCustomDomain({ domain, projectId: project.id, userId: req.session.userId!, verificationToken });
      res.status(201).json(d);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Domain already registered" });
      res.status(500).json({ message: "Failed to add domain" });
    }
  });

  app.post("/api/projects/:id/networking/domains/:domainId/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const domainRecord = await storage.getCustomDomain(req.params.domainId);
      if (!domainRecord || domainRecord.projectId !== project.id) return res.status(404).json({ message: "Domain not found" });
      const result = await verifyDomain(req.params.domainId);
      if (result.verified) {
        await storage.updateProject(project.id, { customDomain: domainRecord.domain });
      }
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to verify domain" }); }
  });

  app.delete("/api/projects/:id/networking/domains/:domainId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      await storage.deleteCustomDomain(req.params.domainId, req.session.userId!);
      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "Failed to delete domain" }); }
  });

  // --- REVERSE PROXY FOR PORT FORWARDING ---
  const ALLOWED_PROXY_PORTS = { min: 1024, max: 65535 };
  app.all("/proxy/:projectId/:port/{*path}", requireAuth, async (req: Request, res: Response) => {
    try {
      const { projectId, port: portStr } = req.params;
      const targetPort = parseInt(portStr, 10);
      if (isNaN(targetPort) || targetPort < ALLOWED_PROXY_PORTS.min || targetPort > ALLOWED_PROXY_PORTS.max) {
        return res.status(400).json({ message: "Invalid port (must be 1024-65535)" });
      }

      if (!await verifyProjectAccess(projectId, req.session.userId!)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const portConfig = await storage.getPortConfigs(projectId);
      const config = portConfig.find(p => p.port === targetPort);
      if (!config || !config.isPublic) {
        return res.status(403).json({ message: "Port not configured or not public" });
      }

      const workspace = await storage.getWorkspaceByProject(projectId);
      if (!workspace) {
        return res.status(502).json({ message: "No workspace running for this project" });
      }

      const previewBaseUrl = runnerClient.previewUrl(workspace.id, targetPort);
      const rawPath = req.params.path;
      const proxyPath = Array.isArray(rawPath) ? rawPath.join("/") : (rawPath || "");
      const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const targetUrl = `${previewBaseUrl}/${proxyPath}${queryString}`;

      const http = require("http") as typeof import("http");
      const https = require("https") as typeof import("https");
      const protocol = targetUrl.startsWith("https") ? https : http;

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

      const RESPONSE_HOP_HEADERS = new Set([
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

  app.get("/api/projects/:id/checkpoints", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
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
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
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
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
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
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
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
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
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
      if (!project || project.userId !== req.session.userId) return res.status(404).json({ message: "Project not found" });
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

  // ===================== TASK SYSTEM ROUTES =====================
  const { executeTask, acceptAndExecuteTask, bulkAcceptTasks, cancelTask } = await import("./taskExecutor");
  const { mergeTaskToMain, getTaskDiff } = await import("./mergeEngine");

  const taskBroadcast = (projectId: string, type: string, data: any) => {
    broadcastToProject(projectId, { type: `task_${type}`, ...data });
  };

  const taskExecutorOptions = (projectId: string) => ({
    onTaskUpdate: (task: any) => taskBroadcast(projectId, "update", { task }),
    onStepUpdate: (taskId: string, step: any) => taskBroadcast(projectId, "step_update", { taskId, step }),
    onMessage: (taskId: string, role: string, content: string) => taskBroadcast(projectId, "message", { taskId, role, content }),
  });

  app.get("/api/projects/:id/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const taskList = await storage.getProjectTasks(project.id);
      res.json(taskList);
    } catch { res.status(500).json({ message: "Failed to load tasks" }); }
  });

  app.post("/api/projects/:id/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { title, description, plan, dependsOn, priority } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const task = await storage.createTask({
        projectId: project.id,
        userId: req.session.userId!,
        title,
        description: description || "",
        plan: plan || [],
        dependsOn: dependsOn || [],
        priority: priority || 0,
      });
      if (plan && plan.length > 0) {
        for (let i = 0; i < plan.length; i++) {
          await storage.createTaskStep({
            taskId: task.id,
            orderIndex: i,
            title: plan[i],
            description: plan[i],
          });
        }
      }
      taskBroadcast(project.id, "created", { task });
      res.status(201).json(task);
    } catch { res.status(500).json({ message: "Failed to create task" }); }
  });

  app.get("/api/projects/:id/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const steps = await storage.getTaskSteps(task.id);
      const diff = task.status === "ready" ? await getTaskDiff(task.id) : [];
      res.json({ ...task, steps, diff });
    } catch { res.status(500).json({ message: "Failed to load task" }); }
  });

  app.patch("/api/projects/:id/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { title, description, plan, status, priority } = req.body;
      const updated = await storage.updateTask(task.id, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(plan !== undefined && { plan }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
      });
      if (updated) taskBroadcast(task.projectId, "update", { task: updated });
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update task" }); }
  });

  app.delete("/api/projects/:id/tasks/:taskId", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      if (task.status === "active") cancelTask(task.id);
      await storage.deleteTask(task.id);
      taskBroadcast(task.projectId, "deleted", { taskId: task.id });
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to delete task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const result = await acceptAndExecuteTask(task.id, req.session.userId!, taskExecutorOptions(task.projectId));
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to accept task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/apply", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      if (task.status !== "ready") return res.status(400).json({ message: "Task is not ready for apply" });
      await storage.updateTask(task.id, { status: "applying" });
      taskBroadcast(task.projectId, "update", { task: { ...task, status: "applying" } });
      const mergeResult = await mergeTaskToMain(task.id, task.projectId);
      if (mergeResult.error) {
        await storage.updateTask(task.id, { status: "ready", errorMessage: mergeResult.error });
        const failedTask = await storage.getTask(task.id);
        if (failedTask) taskBroadcast(task.projectId, "update", { task: failedTask });
        return res.status(500).json({ message: mergeResult.error });
      }
      if (!mergeResult.success || mergeResult.conflicts.length > 0) {
        await storage.updateTask(task.id, { status: "ready", errorMessage: `${mergeResult.conflicts.length} file(s) have conflicts` });
        const conflictTask = await storage.getTask(task.id);
        if (conflictTask) taskBroadcast(task.projectId, "update", { task: conflictTask });
        return res.json({ success: false, conflicts: mergeResult.conflicts, appliedFiles: mergeResult.appliedFiles });
      }
      await storage.updateTask(task.id, { status: "done", completedAt: new Date() });
      const doneTask = await storage.getTask(task.id);
      if (doneTask) taskBroadcast(task.projectId, "update", { task: doneTask });
      broadcastToProject(task.projectId, { type: "files_changed" });
      res.json({ success: true, ...mergeResult });
    } catch { res.status(500).json({ message: "Failed to apply task" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/dismiss", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      if (task.status === "active") cancelTask(task.id);
      await storage.updateTask(task.id, { status: "done", result: "dismissed" });
      const dismissed = await storage.getTask(task.id);
      if (dismissed) taskBroadcast(task.projectId, "update", { task: dismissed });
      res.json({ success: true });
    } catch { res.status(500).json({ message: "Failed to dismiss task" }); }
  });

  app.get("/api/projects/:id/tasks/:taskId/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const messages = await storage.getTaskMessages(task.id);
      res.json(messages);
    } catch { res.status(500).json({ message: "Failed to load messages" }); }
  });

  app.post("/api/projects/:id/tasks/:taskId/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!await verifyProjectAccess(task.projectId, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const msg = await storage.addTaskMessage({ taskId: task.id, role: "user", content });
      taskBroadcast(task.projectId, "message", { taskId: task.id, role: "user", content });
      res.status(201).json(msg);
    } catch { res.status(500).json({ message: "Failed to add message" }); }
  });

  app.post("/api/projects/:id/tasks/propose", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { prompt, model } = req.body;
      if (!prompt) return res.status(400).json({ message: "Prompt is required" });

      const projectFiles = await storage.getFiles(project.id);
      const fileList = projectFiles.map(f => f.filename).join(", ");
      const systemPrompt = `You are a task decomposition agent. Break the user's request into discrete, parallel tasks.
Each task should be independent and executable in isolation against a copy of the project files.
The project has these files: ${fileList}
Language: ${project.language}

Return a JSON array of tasks, each with: title (string), description (string), plan (string[] of step descriptions), dependsOn (string[] of task indices like "0", "1" for tasks that must complete first).

Example format:
[
  {"title": "Add user model", "description": "Create user schema", "plan": ["Create user table schema", "Add validation"], "dependsOn": []},
  {"title": "Add user API", "description": "REST endpoints for users", "plan": ["Create GET /users", "Create POST /users"], "dependsOn": ["0"]}
]

Respond ONLY with the JSON array, no other text.`;

      let responseText = "";
      try {
        const anthropic = new Anthropic();
        const result = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        });
        responseText = result.content.map((b: any) => b.type === "text" ? b.text : "").join("");
      } catch {
        try {
          const openai = new OpenAI();
          const result = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 2000,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
          });
          responseText = result.choices[0]?.message?.content || "";
        } catch {
          return res.status(500).json({ message: "AI service unavailable" });
        }
      }

      let proposedTasks: any[] = [];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) proposedTasks = JSON.parse(jsonMatch[0]);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response" });
      }

      const createdTasks = [];
      const idMap = new Map<string, string>();
      for (let i = 0; i < proposedTasks.length; i++) {
        const pt = proposedTasks[i];
        const deps = (pt.dependsOn || []).map((d: string) => idMap.get(d)).filter(Boolean) as string[];
        const task = await storage.createTask({
          projectId: project.id,
          userId: req.session.userId!,
          title: pt.title || `Task ${i + 1}`,
          description: pt.description || "",
          plan: pt.plan || [],
          dependsOn: deps,
          priority: i,
        });
        idMap.set(String(i), task.id);
        if (pt.plan && pt.plan.length > 0) {
          for (let j = 0; j < pt.plan.length; j++) {
            await storage.createTaskStep({
              taskId: task.id,
              orderIndex: j,
              title: pt.plan[j],
              description: pt.plan[j],
            });
          }
        }
        createdTasks.push(task);
      }

      taskBroadcast(project.id, "proposed", { tasks: createdTasks });
      res.json({ tasks: createdTasks });
    } catch (err: any) { res.status(500).json({ message: "Failed to propose tasks" }); }
  });

  app.post("/api/projects/:id/tasks/discard-proposed", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { taskIds } = req.body;
      if (!taskIds || !Array.isArray(taskIds)) return res.status(400).json({ message: "taskIds array is required" });
      let deleted = 0;
      for (const tid of taskIds) {
        const t = await storage.getTask(tid);
        if (t && t.projectId === project.id && t.status === "draft") {
          await storage.deleteTask(tid);
          deleted++;
        }
      }
      taskBroadcast(project.id, "discarded", { taskIds, deleted });
      res.json({ success: true, deleted });
    } catch { res.status(500).json({ message: "Failed to discard tasks" }); }
  });

  app.post("/api/projects/:id/tasks/bulk-accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { taskIds } = req.body;
      if (!taskIds || !Array.isArray(taskIds)) return res.status(400).json({ message: "taskIds array is required" });
      const validatedIds: string[] = [];
      for (const tid of taskIds) {
        const t = await storage.getTask(tid);
        if (t && t.projectId === project.id) validatedIds.push(tid);
      }
      const result = await bulkAcceptTasks(validatedIds, req.session.userId!, taskExecutorOptions(project.id));
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to bulk accept tasks" }); }
  });

  // --- MCP Server Routes ---
  app.get("/api/projects/:projectId/mcp/servers", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const servers = await storage.getMcpServers(req.params.projectId);
    const mcpClientModule = await import("./mcpClient");
    const serversWithStatus = servers.map(s => {
      const client = mcpClientModule.getClient(s.id);
      return { ...s, status: client?.status || s.status };
    });
    return res.json(serversWithStatus);
  });

  app.post("/api/projects/:projectId/mcp/servers", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { name, command, args, env } = req.body;
    if (!name || !command) {
      return res.status(400).json({ message: "name and command are required" });
    }
    if (typeof name !== "string" || name.length > 100) {
      return res.status(400).json({ message: "Invalid server name" });
    }
    if (typeof command !== "string" || command.length > 500) {
      return res.status(400).json({ message: "Invalid command" });
    }
    const server = await storage.createMcpServer({
      projectId: req.params.projectId,
      name: name.slice(0, 100),
      command: command.slice(0, 500),
      args: Array.isArray(args) ? args.map((a: any) => String(a).slice(0, 1000)) : [],
      env: typeof env === "object" && env !== null ? env : {},
    });
    return res.json(server);
  });

  app.put("/api/projects/:projectId/mcp/servers/:serverId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    const { name, command, args, env } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = String(name).slice(0, 100);
    if (command) updates.command = String(command).slice(0, 500);
    if (args) updates.args = Array.isArray(args) ? args.map((a: any) => String(a).slice(0, 1000)) : [];
    if (env) updates.env = typeof env === "object" && env !== null ? env : {};
    const updated = await storage.updateMcpServer(server.id, updates);
    return res.json(updated);
  });

  app.delete("/api/projects/:projectId/mcp/servers/:serverId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      await mcpClientModule.stopClient(server.id);
    } catch {}
    await storage.deleteMcpServer(server.id);
    return res.json({ message: "Server deleted" });
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/start", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      const client = await mcpClientModule.startClient(server.id, server.command, server.args as string[] || [], server.env as Record<string, string> || {});
      await storage.updateMcpServer(server.id, { status: "running" });
      const tools = await client.listTools();
      await storage.deleteMcpToolsByServer(server.id);
      for (const tool of tools) {
        await storage.createMcpTool({
          serverId: server.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
      return res.json({ status: "running", tools });
    } catch (err: any) {
      await storage.updateMcpServer(server.id, { status: "error" });
      return res.status(500).json({ message: `Failed to start server: ${err.message}` });
    }
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/stop", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      await mcpClientModule.stopClient(server.id);
    } catch {}
    await storage.updateMcpServer(server.id, { status: "stopped" });
    return res.json({ status: "stopped" });
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/restart", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      await mcpClientModule.stopClient(server.id);
      const client = await mcpClientModule.startClient(server.id, server.command, server.args as string[] || [], server.env as Record<string, string> || {});
      await storage.updateMcpServer(server.id, { status: "running" });
      const tools = await client.listTools();
      await storage.deleteMcpToolsByServer(server.id);
      for (const tool of tools) {
        await storage.createMcpTool({
          serverId: server.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
      return res.json({ status: "running", tools });
    } catch (err: any) {
      await storage.updateMcpServer(server.id, { status: "error" });
      return res.status(500).json({ message: `Failed to restart server: ${err.message}` });
    }
  });

  app.get("/api/projects/:projectId/mcp/servers/:serverId/logs", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }

    const mcpClientModule = await import("./mcpClient");
    const client = mcpClientModule.getClient(server.id);

    if (req.headers.accept === "text/event-stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const existingLogs = client?.logs || [];
      for (const line of existingLogs) {
        res.write(`data: ${JSON.stringify(line)}\n\n`);
      }

      const onLog = (msg: string) => {
        const ts = new Date().toISOString();
        res.write(`data: ${JSON.stringify(`[${ts}] ${msg}`)}\n\n`);
      };
      client?.on("log", onLog);
      req.on("close", () => { client?.off("log", onLog); });
    } else {
      return res.json({ logs: client?.logs || [] });
    }
  });

  app.get("/api/projects/:projectId/mcp/servers/:serverId/tools", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    const tools = await storage.getMcpTools(server.id);
    return res.json(tools);
  });

  app.get("/api/projects/:projectId/mcp/tools", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const tools = await storage.getMcpToolsByProject(req.params.projectId);
    return res.json(tools);
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/call", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    const { toolName, args } = req.body;
    if (!toolName || typeof toolName !== "string") {
      return res.status(400).json({ message: "toolName is required" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      const client = mcpClientModule.getClient(server.id);
      if (!client || client.status !== "running") {
        return res.status(400).json({ message: "Server is not running" });
      }
      const result = await client.callTool(toolName, args || {});
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: `Tool call failed: ${err.message}` });
    }
  });

  app.post("/api/projects/:projectId/mcp/init-builtin", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || project.userId !== req.session.userId) {
      return res.status(404).json({ message: "Project not found" });
    }
    try {
      const { ensureBuiltInServers } = await import("./mcpServers");
      const created = await ensureBuiltInServers(req.params.projectId);
      return res.json({ created: created.length, servers: created });
    } catch (err: any) {
      return res.status(500).json({ message: `Failed to initialize built-in servers: ${err.message}` });
    }
  });

  await storage.seedDemoProject();
  log("Demo project seeded", "seed");
  await storage.seedPlanConfigs();
  log("Plan configs seeded", "seed");
  await storage.seedIntegrationCatalog();
  log("Integration catalog seeded", "seed");
  await storage.seedOfficialFrameworks();
  log("Official frameworks seeded", "seed");

  const { setExpressApp } = await import("./slackBot");
  setExpressApp(app);

  const { startAutomationScheduler } = await import("./automationScheduler");
  startAutomationScheduler().catch(err => log(`Automation scheduler error: ${err.message}`, "automation"));

  return httpServer;
}
