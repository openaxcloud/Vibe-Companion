// AUTO-EXTRACTED from server/routes.ts (lines 4020-4073)
// Original section: project-guests
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


export async function registerProjectGuestsRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  async function verifyProjectWriteAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    if (String(project.userId) === String(userId)) return true;
    if (project.teamId) {
      const teams = await storage.getUserTeams(userId);
      const teamMatch = teams.find((t: any) => t.id === project.teamId);
      if (teamMatch && (teamMatch.role === "owner" || teamMatch.role === "admin" || teamMatch.role === "editor")) return true;
    }
    const collaborators = await storage.getProjectCollaborators(projectId);
    const collab = collaborators.find((c: any) => String(c.userId) === String(userId));
    if (collab && (collab.role === "editor" || collab.role === "owner" || collab.role === "admin")) return true;
    const guest = await storage.getProjectGuestByUserId(projectId, userId);
    if (guest && guest.role === "editor") return true;
    const usr = await storage.getUser(userId);
    if (usr) {
      const accepted = await storage.getAcceptedInviteForProject(projectId, usr.email.toLowerCase());
      if (accepted && (accepted.role === "editor" || accepted.role === "owner")) return true;
    }
    return false;
  }

  // --- PROJECT GUESTS ---
  app.get("/api/projects/:id/guests", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const guests = await storage.getProjectGuests(project.id);
      return res.json(guests);
    } catch {
      return res.status(500).json({ message: "Failed to fetch guests" });
    }
  });

  app.post("/api/projects/:id/guests", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const { email, role } = z.object({ email: z.string().email(), role: z.enum(["viewer", "editor"]).default("viewer") }).parse(req.body);
      const existing = await storage.getProjectGuestByEmail(project.id, email);
      if (existing) return res.status(409).json({ message: "Guest already invited" });
      const guest = await storage.addProjectGuest(project.id, email, role, req.session.userId!);

      try {
        const inviter = await storage.getUser(req.session.userId!);
        const inviterName = inviter?.displayName || inviter?.email || 'Someone';
        const { sendProjectInviteEmail } = await import("../email");
        const emailSent = await sendProjectInviteEmail(email, project.name, inviterName, role, guest.token);
        (guest as any).emailSent = emailSent;
      } catch (emailErr: any) {
        console.warn(`[project-guests] Failed to send invite email to ${email}: ${emailErr.message}`);
        (guest as any).emailSent = false;
      }

      return res.status(201).json(guest);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to invite guest" });
    }
  });

  app.delete("/api/projects/:id/guests/:guestId", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== req.session.userId && !await verifyProjectWriteAccess(project.id, req.session.userId!))) return res.status(404).json({ message: "Project not found" });
      const removed = await storage.removeProjectGuest(req.params.guestId, req.params.id);
      if (!removed) return res.status(404).json({ message: "Guest not found" });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to remove guest" });
    }
  });

  app.post("/api/projects/:id/guests/accept", requireAuth, async (req: Request, res: Response) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const guests = await storage.getProjectGuests(req.params.id);
      const pendingGuest = guests.find(g => g.token === token && !g.acceptedAt);
      if (!pendingGuest) return res.status(404).json({ message: "Invalid or expired invite for this project" });
      const guest = await storage.acceptProjectGuestInvite(token, req.session.userId!);
      if (!guest) return res.status(404).json({ message: "Failed to accept invite" });
      return res.json(guest);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to accept invite" });
    }
  });

}
