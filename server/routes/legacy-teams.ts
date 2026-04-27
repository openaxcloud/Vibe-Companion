// AUTO-EXTRACTED from server/routes.ts (lines 2680-2823)
// Original section: teams
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


export async function registerTeamsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;

  async function createAndBroadcastNotification(userId: string, data: { category: string; title: string; message: string; actionUrl?: string; metadata?: Record<string, any> }) {
    try {
      const prefs = await storage.getNotificationPreferences(userId);
      const category = data.category as keyof typeof prefs;
      if (category in prefs && prefs[category] === false) return null;
      const notification = await storage.createNotification({ userId, ...data, isRead: false });
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      broadcastToUser(userId, { type: "notification", notification, unreadCount });
      return notification;
    } catch (err) {
      log(`Failed to create notification for user ${userId}: ${err}`, "notifications");
      return null;
    }
  }

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
      const isMember = members.some(m => String(m.userId) === String(req.session.userId));
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
      const requester = members.find(m => String(m.userId) === String(req.session.userId));
      if (!requester || !["owner", "admin"].includes(requester.role)) return res.status(403).json({ message: "Not authorized to invite" });
      const { email, role } = z.object({ email: z.string().email(), role: z.enum(["member", "admin"]).default("member") }).parse(req.body);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invite = await storage.createTeamInvite(team.id, email, role, req.session.userId!, token, expiresAt);
      const inviter = await storage.getUser(req.session.userId!);
      const emailSent = await sendTeamInviteEmail(email, team.name, inviter?.displayName || inviter?.email || "Someone", token);
      log(`[teams] Invite for ${email} to team ${team.name}: /invite/${token}`, "info");
      if (!emailSent) {
        log(`[teams] Warning: invite email could not be sent to ${email} (SMTP not configured)`, "info");
      }
      const invitedUser = await storage.getUserByEmail(email);
      if (invitedUser) {
        createAndBroadcastNotification(invitedUser.id, {
          category: "team",
          title: "Team invitation",
          message: `${inviter?.displayName || inviter?.email || "Someone"} invited you to join ${team.name}`,
          actionUrl: `/invite/${token}`,
          metadata: { teamId: team.id, teamName: team.name },
        }).catch(() => {});
      }
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
      const requester = members.find(m => String(m.userId) === String(req.session.userId));
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

}
