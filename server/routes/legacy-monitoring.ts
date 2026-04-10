// AUTO-EXTRACTED from server/routes.ts (lines 12382-12515)
// Original section: monitoring
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


export async function registerMonitoringRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== MONITORING ROUTES =====================
  app.get("/api/projects/:id/monitoring/metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const limit = parseInt(qstr(req.query.limit)) || 50;
      const metrics = await storage.getMonitoringMetrics(project.id, limit);
      res.json(metrics);
    } catch (err: any) {
      log(`[monitoring] Failed to load metrics for project ${req.params.id}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load metrics" });
    }
  });

  app.get("/api/projects/:id/monitoring/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const summary = await storage.getMonitoringSummary(project.id);
      const realMetrics = getRealMetrics();
      if (!summary) {
        return res.json({
          requests: 0,
          errors: 0,
          avgResponseMs: 0,
          uptime: 100,
          cpuPercent: realMetrics.cpuPercent,
          memoryMb: realMetrics.memoryMb,
          systemMemory: realMetrics.systemMemory,
          loadAverage: realMetrics.loadAverage,
        });
      }
      res.json({
        ...summary,
        cpuPercent: summary.cpuPercent || realMetrics.cpuPercent,
        memoryMb: summary.memoryMb || realMetrics.memoryMb,
        systemMemory: realMetrics.systemMemory,
        loadAverage: realMetrics.loadAverage,
      });
    } catch (err: any) {
      log(`[monitoring] Failed to load summary for project ${req.params.id}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load summary" });
    }
  });

  app.post("/api/projects/:id/monitoring/record", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const realMetrics = getRealMetrics();
      const counters = getAndResetCounters();
      const { getUptimePercent } = await import("./metricsCollector");
      const uptime = getUptimePercent(project.id);
      await Promise.all([
        storage.recordMonitoringMetric(project.id, "cpu_usage", Math.round(realMetrics.cpuPercent)),
        storage.recordMonitoringMetric(project.id, "memory_usage", realMetrics.memoryMb),
        storage.recordMonitoringMetric(project.id, "request_count", counters.requests),
        storage.recordMonitoringMetric(project.id, "response_time", counters.avgResponseMs),
        storage.recordMonitoringMetric(project.id, "uptime", uptime),
        storage.recordMonitoringMetric(project.id, "system_memory_percent", realMetrics.systemMemory.usedPercent),
        storage.recordMonitoringMetric(project.id, "load_avg_1m", realMetrics.loadAverage.load1),
        ...(counters.errors > 0 ? [storage.recordMonitoringMetric(project.id, "error_count", counters.errors)] : []),
      ]);
      res.json({ recorded: true, metrics: realMetrics });
    } catch (err: any) {
      log(`[monitoring] Failed to record metrics for project ${req.params.id}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to record metrics" });
    }
  });

  app.get("/api/projects/:id/monitoring/alerts", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const alerts = await storage.getMonitoringAlerts(project.id);
      res.json(alerts);
    } catch (err: any) {
      log(`[monitoring] Failed to load alerts for project ${req.params.id}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to load alerts" });
    }
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
    } catch (err: any) {
      log(`[monitoring] Failed to create alert for project ${req.params.id}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to create alert" });
    }
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
    } catch (err: any) {
      log(`[monitoring] Failed to update alert ${req.params.alertId}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to update alert" });
    }
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
    } catch (err: any) {
      log(`[monitoring] Failed to delete alert ${req.params.alertId}: ${err.message}`, "error");
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

}
