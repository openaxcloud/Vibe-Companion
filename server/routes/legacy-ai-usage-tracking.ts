// AUTO-EXTRACTED from server/routes.ts (lines 16676-16844)
// Original section: ai-usage-tracking
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


export async function registerAiUsageTrackingRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- AI USAGE TRACKING ---
  app.get("/api/ai/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { projectId, provider, days } = req.query as { projectId?: string; provider?: string; days?: string };
      const since = new Date();
      since.setDate(since.getDate() - (parseInt(days || "30") || 30));
      let summary = await storage.getAiUsageSummary(userId, since);
      let byProject = await storage.getAiUsageByProject(userId, since);
      if (provider) {
        summary = summary.filter(s => s.provider === provider);
        byProject = byProject.filter(b => b.provider === provider);
      }
      if (projectId) {
        byProject = byProject.filter(b => b.projectId === projectId);
      }
      return res.json({ summary, byProject, since: since.toISOString() });
    } catch {
      return res.status(500).json({ message: "Failed to fetch AI usage" });
    }
  });

  app.get("/api/ai/usage/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { projectId, provider, limit } = req.query as { projectId?: string; provider?: string; limit?: string };
      const logs = await storage.getAiUsageLogs(userId, {
        projectId, provider, limit: parseInt(limit || "50") || 50,
      });
      return res.json(logs);
    } catch {
      return res.status(500).json({ message: "Failed to fetch AI usage logs" });
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
  await storage.seedArtifactTemplates();
  log("Artifact templates seeded", "seed");

  try {
    await storage.backfillStorageBuckets();
    log("Storage buckets backfilled", "seed");
  } catch (err: any) {
    log(`Storage bucket backfill error: ${err.message}`, "seed");
  }

  const { setExpressApp } = await import("./slackBot");
  setExpressApp(app);

  const { startAutomationScheduler } = await import("./automationScheduler");
  startAutomationScheduler().catch(err => log(`Automation scheduler error: ${err.message}`, "automation"));

  const { communityPosts, communityReplies, communityLikes, supportTickets } = await import("@shared/schema");
  const { desc: drizzleDesc, eq: drizzleEq, and: drizzleAnd, sql: drizzleSql } = await import("drizzle-orm");
  const { db: communityDb } = await import("./db");

  app.get("/api/community/posts", requireAuth, async (req: Request, res: Response) => {
    try {
      const sortBy = req.query.sort === "popular" ? communityPosts.likes : communityPosts.createdAt;
      const posts = await communityDb.select().from(communityPosts).orderBy(drizzleDesc(sortBy)).limit(50);
      const userId = req.session.userId!;
      const userLikes = await communityDb.select().from(communityLikes).where(drizzleEq(communityLikes.userId, userId));
      const likedSet = new Set(userLikes.map(l => l.postId));

      const postsWithReplies = await Promise.all(posts.map(async (post) => {
        const replies = await communityDb.select().from(communityReplies).where(drizzleEq(communityReplies.postId, post.id)).orderBy(communityReplies.createdAt).limit(50);
        return { ...post, replies, liked: likedSet.has(post.id) };
      }));

      res.json({ posts: postsWithReplies });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/community/posts", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const { title, content, category } = req.body;
      if (!title?.trim() || !content?.trim()) return res.status(400).json({ message: "Title and content required" });
      const [post] = await communityDb.insert(communityPosts).values({
        userId, authorName: user?.displayName || user?.email || "Anonymous",
        title: title.trim().slice(0, 200), content: content.trim().slice(0, 10000),
        category: category || "general",
      }).returning();
      res.json({ post });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/community/posts/:postId/replies", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content required" });
      const [reply] = await communityDb.insert(communityReplies).values({
        postId, userId,
        authorName: user?.displayName || user?.email || "Anonymous",
        content: content.trim().slice(0, 5000),
      }).returning();
      await communityDb.update(communityPosts).set({
        replyCount: drizzleSql`reply_count + 1`,
      }).where(drizzleEq(communityPosts.id, postId));
      res.json({ reply });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/community/posts/:postId/like", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
      const existing = await communityDb.select().from(communityLikes)
        .where(drizzleAnd(drizzleEq(communityLikes.postId, postId), drizzleEq(communityLikes.userId, userId)));
      if (existing.length > 0) {
        await communityDb.delete(communityLikes).where(drizzleEq(communityLikes.id, existing[0].id));
        await communityDb.update(communityPosts).set({ likes: drizzleSql`GREATEST(likes - 1, 0)` }).where(drizzleEq(communityPosts.id, postId));
        return res.json({ liked: false });
      }
      await communityDb.insert(communityLikes).values({ postId, userId });
      await communityDb.update(communityPosts).set({ likes: drizzleSql`likes + 1` }).where(drizzleEq(communityPosts.id, postId));
      res.json({ liked: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/support/tickets", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const tickets = await communityDb.select().from(supportTickets).where(drizzleEq(supportTickets.userId, userId)).orderBy(drizzleDesc(supportTickets.createdAt)).limit(50);
      res.json(tickets);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/support/ticket", requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      const { subject, message, category } = req.body;
      if (!subject?.trim() || !message?.trim()) return res.status(400).json({ message: "Subject and message required" });
      const [ticket] = await communityDb.insert(supportTickets).values({
        userId, email: user?.email || null,
        subject: subject.trim().slice(0, 200), message: message.trim().slice(0, 10000),
        category: category || "general",
      }).returning();
      log(`Support ticket created: ${ticket.id} by ${user?.email || userId} - ${subject}`, "support");
      res.json({ ticket });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

}
