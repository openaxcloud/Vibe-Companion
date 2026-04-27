// AUTO-EXTRACTED from server/routes.ts (lines 1898-2238)
// Original section: github-oauth
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


export async function registerGithubOauthRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


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
      if (user.isBanned) {
        return res.status(403).json({ message: "Your account has been suspended" + (user.banReason ? `: ${user.banReason}` : "") });
      }
      req.session.userId = String(user.id);
      req.session.csrfToken = generateCsrfToken();
      const ip = req.headers["x-forwarded-for"] as string || req.ip || null;
      await storage.recordLogin(user.id, ip, "github", req.headers["user-agent"] || null);
      await storage.trackEvent(user.id, "login", { method: "github" });
      return res.json({ id: user.id, email: user.email, displayName: user.displayName, csrfToken: req.session.csrfToken });
    } catch (err: any) {
      return res.status(500).json({ message: "GitHub authentication failed: " + safeError(err, "Unknown error") });
    }
  });

  app.get("/api/auth/github/redirect", (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "GitHub OAuth not configured" });
    const redirectUri = `${getAppUrl()}/api/auth/github/callback`;
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    const returnTo = req.headers.referer || "/dashboard";
    req.session.githubReturnTo = returnTo;
    if (req.query.prompt) req.session.pendingPrompt = String(req.query.prompt);
    if (req.query.outputType) req.session.pendingOutputType = String(req.query.outputType);
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email,repo&state=${state}`;
    return res.redirect(url);
  });

  app.get("/api/auth/github/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code) return res.redirect("/auth?error=no_code");
      const savedState = req.session.oauthState;
      delete req.session.oauthState;
      if (!state || !savedState || state !== savedState) return res.redirect("/auth?error=invalid_state");
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.redirect("/auth?error=not_configured");
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) return res.redirect("/auth?error=token_failed");
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
      });
      const ghUser = await userRes.json() as { id: number; login: string; name?: string; email?: string; avatar_url?: string };
      const githubId = String(ghUser.id);
      let user = await storage.getUserByGithubId(githubId);
      if (!user) {
        const email = ghUser.email || `github-${githubId}@users.noreply.github.com`;
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          await storage.updateUser(existing.id, { githubId, avatarUrl: ghUser.avatar_url });
          user = (await storage.getUser(existing.id))!;
        } else {
          user = await storage.createUser({ email, password: "", displayName: ghUser.login || ghUser.name || email.split("@")[0], githubId, avatarUrl: ghUser.avatar_url, emailVerified: true });
        }
      }
      if (user.isBanned) return res.redirect("/auth?error=banned");
      req.session.userId = String(user.id);
      req.session.csrfToken = generateCsrfToken();
      const ip = req.headers["x-forwarded-for"] as string || req.ip || null;
      await storage.recordLogin(user.id, ip, "github", req.headers["user-agent"] || null);
      const pendingPrompt = req.session.pendingPrompt;
      const pendingOutputType = req.session.pendingOutputType;
      delete req.session.pendingPrompt;
      delete req.session.pendingOutputType;
      delete req.session.githubReturnTo;
      let redirectUrl = "/dashboard";
      if (pendingPrompt) {
        redirectUrl += `?prompt=${encodeURIComponent(pendingPrompt)}&outputType=${encodeURIComponent(pendingOutputType || "web")}`;
      }
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect("/auth?error=github_failed");
    }
  });

  app.get("/api/auth/google", (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "Google OAuth not configured" });
    const redirectUri = `${getAppUrl()}/api/auth/google/callback`;
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    if (req.query.prompt) req.session.pendingPrompt = String(req.query.prompt);
    if (req.query.outputType) req.session.pendingOutputType = String(req.query.outputType);
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&access_type=offline&state=${state}`;
    return res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code) return res.redirect("/auth?error=no_code");
      const savedState = req.session.oauthState;
      delete req.session.oauthState;
      if (!state || !savedState || state !== savedState) return res.redirect("/auth?error=invalid_state");
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.redirect("/auth?error=not_configured");
      const redirectUri = `${getAppUrl()}/api/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code`,
      });
      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) return res.redirect("/auth?error=token_failed");
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const gUser = await userRes.json() as { id: string; email: string; name?: string; picture?: string };
      let user = await storage.getUserByGoogleId(gUser.id);
      if (!user) {
        const existing = await storage.getUserByEmail(gUser.email);
        if (existing) {
          await storage.updateUser(existing.id, { googleId: gUser.id, avatarUrl: gUser.picture || existing.avatarUrl || undefined });
          user = (await storage.getUser(existing.id))!;
        } else {
          user = await storage.createUser({ email: gUser.email, password: "", displayName: gUser.name || gUser.email.split("@")[0], googleId: gUser.id, avatarUrl: gUser.picture, emailVerified: true });
        }
      }
      if (user.isBanned) return res.redirect("/auth?error=banned");
      req.session.userId = String(user.id);
      req.session.csrfToken = generateCsrfToken();
      const ip = req.headers["x-forwarded-for"] as string || req.ip || null;
      await storage.recordLogin(user.id, ip, "google", req.headers["user-agent"] || null);
      const pendingPrompt = req.session.pendingPrompt;
      const pendingOutputType = req.session.pendingOutputType;
      delete req.session.pendingPrompt;
      delete req.session.pendingOutputType;
      let redirectUrl = "/dashboard";
      if (pendingPrompt) {
        redirectUrl += `?prompt=${encodeURIComponent(pendingPrompt)}&outputType=${encodeURIComponent(pendingOutputType || "web")}`;
      }
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect("/auth?error=google_failed");
    }
  });

  app.get("/api/auth/apple", (req: Request, res: Response) => {
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "Apple Sign-In not configured" });
    const redirectUri = `${getAppUrl()}/api/auth/apple/callback`;
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    if (req.query.prompt) req.session.pendingPrompt = String(req.query.prompt);
    if (req.query.outputType) req.session.pendingOutputType = String(req.query.outputType);
    const url = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("name email")}&response_mode=form_post&state=${state}`;
    return res.redirect(url);
  });

  app.post("/api/auth/apple/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.body;
      if (!code) return res.redirect("/auth?error=no_code");
      const savedState = req.session.oauthState;
      delete req.session.oauthState;
      if (!state || !savedState || state !== savedState) return res.redirect("/auth?error=invalid_state");
      const clientId = process.env.APPLE_CLIENT_ID;
      const clientSecret = process.env.APPLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.redirect("/auth?error=not_configured");
      const redirectUri = `${getAppUrl()}/api/auth/apple/callback`;
      const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri)}`,
      });
      const tokenData = await tokenRes.json() as { id_token?: string };
      if (!tokenData.id_token) return res.redirect("/auth?error=token_failed");

      // Verify Apple JWT: fetch Apple's public keys and validate
      const parts = tokenData.id_token.split(".");
      if (parts.length !== 3) return res.redirect("/auth?error=token_failed");
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as { kid: string; alg: string };
      const appleKeysRes = await fetch("https://appleid.apple.com/auth/keys");
      const appleKeys = await appleKeysRes.json() as { keys: Array<{ kid: string; kty: string; n: string; e: string; alg: string }> };
      const matchingKey = appleKeys.keys.find((k: any) => k.kid === header.kid);
      if (!matchingKey) return res.redirect("/auth?error=token_failed");

      // Verify signature using Node crypto
      const importedKey = await crypto.subtle.importKey(
        "jwk",
        { kty: matchingKey.kty, n: matchingKey.n, e: matchingKey.e, alg: matchingKey.alg, ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: header.alg === "RS256" ? "SHA-256" : "SHA-384" },
        false,
        ["verify"]
      );
      const signatureValid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        importedKey,
        Buffer.from(parts[2], "base64url"),
        Buffer.from(parts[0] + "." + parts[1])
      );
      if (!signatureValid) return res.redirect("/auth?error=token_failed");

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { sub: string; email?: string; iss?: string; aud?: string; exp?: number };

      // Validate claims
      if (payload.iss !== "https://appleid.apple.com") return res.redirect("/auth?error=token_failed");
      if (payload.aud !== clientId) return res.redirect("/auth?error=token_failed");
      if (payload.exp && payload.exp * 1000 < Date.now()) return res.redirect("/auth?error=token_failed");
      const appleId = payload.sub;
      const email = payload.email || `apple-${appleId}@privaterelay.appleid.com`;
      let user = await storage.getUserByAppleId(appleId);
      if (!user) {
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          await storage.updateUser(existing.id, { appleId });
          user = (await storage.getUser(existing.id))!;
        } else {
          let userPayload: any = null;
          try { userPayload = req.body.user ? JSON.parse(req.body.user) : null; } catch { /* Apple may send malformed user data */ }
          const displayName = userPayload?.name ? `${userPayload.name.firstName || ""} ${userPayload.name.lastName || ""}`.trim() : email.split("@")[0];
          user = await storage.createUser({ email, password: "", displayName, appleId, emailVerified: true });
        }
      }
      if (user.isBanned) return res.redirect("/auth?error=banned");
      req.session.userId = String(user.id);
      req.session.csrfToken = generateCsrfToken();
      const ip = req.headers["x-forwarded-for"] as string || req.ip || null;
      await storage.recordLogin(user.id, ip, "apple", req.headers["user-agent"] || null);
      const pendingPrompt = req.session.pendingPrompt;
      const pendingOutputType = req.session.pendingOutputType;
      delete req.session.pendingPrompt;
      delete req.session.pendingOutputType;
      let redirectUrl = "/dashboard";
      if (pendingPrompt) {
        redirectUrl += `?prompt=${encodeURIComponent(pendingPrompt)}&outputType=${encodeURIComponent(pendingOutputType || "web")}`;
      }
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect("/auth?error=apple_failed");
    }
  });

  app.get("/api/auth/twitter", (req: Request, res: Response) => {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "X/Twitter OAuth not configured" });
    const redirectUri = `${getAppUrl()}/api/auth/twitter/callback`;
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const state = crypto.randomBytes(16).toString("hex");
    req.session.twitterCodeVerifier = codeVerifier;
    req.session.oauthState = state;
    if (req.query.prompt) req.session.pendingPrompt = String(req.query.prompt);
    if (req.query.outputType) req.session.pendingOutputType = String(req.query.outputType);
    const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("tweet.read users.read offline.access")}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    return res.redirect(url);
  });

  app.get("/api/auth/twitter/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code) return res.redirect("/auth?error=no_code");
      const savedState = req.session.oauthState;
      delete req.session.oauthState;
      if (!state || !savedState || state !== savedState) return res.redirect("/auth?error=invalid_state");
      const clientId = process.env.TWITTER_CLIENT_ID;
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.redirect("/auth?error=not_configured");
      const codeVerifier = req.session.twitterCodeVerifier;
      if (!codeVerifier) return res.redirect("/auth?error=no_verifier");
      delete req.session.twitterCodeVerifier;
      const redirectUri = `${getAppUrl()}/api/auth/twitter/callback`;
      const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: `code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri)}&code_verifier=${codeVerifier}`,
      });
      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) return res.redirect("/auth?error=token_failed");
      const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json() as { data?: { id: string; name: string; username: string; profile_image_url?: string } };
      if (!userData.data) return res.redirect("/auth?error=user_fetch_failed");
      const twitterId = userData.data.id;
      let user = await storage.getUserByTwitterId(twitterId);
      if (!user) {
        const email = `twitter-${twitterId}@users.noreply.twitter.com`;
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          await storage.updateUser(existing.id, { twitterId, avatarUrl: userData.data.profile_image_url });
          user = (await storage.getUser(existing.id))!;
        } else {
          user = await storage.createUser({ email, password: "", displayName: userData.data.name || userData.data.username, twitterId, avatarUrl: userData.data.profile_image_url, emailVerified: true });
        }
      }
      if (user.isBanned) return res.redirect("/auth?error=banned");
      req.session.userId = String(user.id);
      req.session.csrfToken = generateCsrfToken();
      const ip = req.headers["x-forwarded-for"] as string || req.ip || null;
      await storage.recordLogin(user.id, ip, "twitter", req.headers["user-agent"] || null);
      const pendingPrompt = req.session.pendingPrompt;
      const pendingOutputType = req.session.pendingOutputType;
      delete req.session.pendingPrompt;
      delete req.session.pendingOutputType;
      let redirectUrl = "/dashboard";
      if (pendingPrompt) {
        redirectUrl += `?prompt=${encodeURIComponent(pendingPrompt)}&outputType=${encodeURIComponent(pendingOutputType || "web")}`;
      }
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect("/auth?error=twitter_failed");
    }
  });

}
