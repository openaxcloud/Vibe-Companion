// AUTO-EXTRACTED from server/routes.ts (lines 12781-13253)
// Original section: networking
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


export async function registerNetworkingRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ===================== NETWORKING ROUTES =====================
  app.get("/api/projects/:id/networking/ports", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const ports = await storage.getPortConfigs(project.id);
      const { checkPortListening } = await import("./portDetection");
      const portsWithStatus = await Promise.all(
        ports.map(async (p) => {
          const { listening, localhostOnly } = await checkPortListening(p.internalPort);
          const proxyUrl = p.isPublic ? `/proxy/${project.id}/${p.externalPort}/` : null;
          const externalUrl = p.externalPort === 80
            ? `${req.protocol}://${req.hostname}`
            : `${req.protocol}://${req.hostname}:${p.externalPort}`;
          return { ...p, listening, localhostOnly, proxyUrl, externalUrl };
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
      const { port, label, protocol, externalPort } = req.body;
      if (!port) return res.status(400).json({ message: "Port is required" });
      const internalPort = parseInt(port, 10);
      if (!Number.isInteger(internalPort) || internalPort < 1 || internalPort > 65535) {
        return res.status(400).json({ message: "Port must be an integer between 1 and 65535" });
      }
      const { isPortBlocked, isAllowedInternalPort, isValidExternalPort, getNextAvailableExternalPort } = await import("./portDetection");
      if (isPortBlocked(internalPort)) return res.status(400).json({ message: `Port ${internalPort} is blocked` });
      if (!isAllowedInternalPort(internalPort)) return res.status(400).json({ message: `Port ${internalPort} is not in the allowed port list (3000-3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081)` });
      const existingConfigs = await storage.getPortConfigs(project.id);
      const usedExternalPorts = existingConfigs.map(c => c.externalPort);
      let targetExternalPort = externalPort ? parseInt(externalPort, 10) : null;
      if (targetExternalPort) {
        if (!isValidExternalPort(targetExternalPort)) return res.status(400).json({ message: `External port ${targetExternalPort} is not in the allowed set (80, 3000-3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8081)` });
        if (usedExternalPorts.includes(targetExternalPort)) return res.status(409).json({ message: `External port ${targetExternalPort} is already in use` });
      } else {
        targetExternalPort = existingConfigs.length === 0 ? 80 : getNextAvailableExternalPort(usedExternalPorts);
        if (targetExternalPort === null) return res.status(400).json({ message: "No available external ports" });
      }
      const config = await storage.createPortConfig({
        projectId: project.id,
        port: internalPort,
        internalPort,
        externalPort: targetExternalPort,
        label: label || "",
        protocol: protocol || "http",
        isPublic: false,
        exposeLocalhost: false,
      });
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
      const { isPublic, exposeLocalhost, label, protocol } = req.body;
      const updateData: Partial<{ label: string; protocol: string; isPublic: boolean; exposeLocalhost: boolean }> = {};
      if (typeof isPublic === "boolean") updateData.isPublic = isPublic;
      if (typeof exposeLocalhost === "boolean") updateData.exposeLocalhost = exposeLocalhost;
      if (typeof label === "string") updateData.label = label;
      if (typeof protocol === "string") updateData.protocol = protocol;
      const updated = await storage.updatePortConfig(req.params.portId, updateData);
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

  app.post("/api/projects/:id/networking/ports/scan", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const { autoDetectPorts } = await import("./portDetection");
      await autoDetectPorts(project.id);
      const ports = await storage.getPortConfigs(project.id);
      res.json(ports);
    } catch { res.status(500).json({ message: "Failed to scan ports" }); }
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

  app.get("/api/projects/:id/networking/all-domains", requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const customDomains = await storage.getProjectCustomDomains(project.id);
      const purchasedDomains = await storage.getUserPurchasedDomains(req.session.userId!);
      const projectPurchased = purchasedDomains.filter(d => d.projectId === project.id);

      const unified = [];
      const seenDomains = new Set<string>();

      for (const pd of projectPurchased) {
        seenDomains.add(pd.domain);
        const matchingCustom = customDomains.find(cd => cd.domain === pd.domain);
        unified.push({
          domain: pd.domain,
          source: "purchased" as const,
          status: pd.status,
          verified: matchingCustom?.verified ?? true,
          sslStatus: matchingCustom?.sslStatus ?? "pending",
          purchasedDomainId: pd.id,
          customDomainId: matchingCustom?.id ?? null,
          autoRenew: pd.autoRenew,
          whoisPrivacy: pd.whoisPrivacy,
          expiresAt: pd.expiresAt,
          renewalPrice: pd.renewalPrice,
        });
      }

      for (const cd of customDomains) {
        if (!seenDomains.has(cd.domain)) {
          unified.push({
            domain: cd.domain,
            source: "connected" as const,
            status: cd.verified ? "active" : "pending",
            verified: cd.verified,
            sslStatus: cd.sslStatus,
            purchasedDomainId: null,
            customDomainId: cd.id,
            autoRenew: null,
            whoisPrivacy: null,
            expiresAt: null,
            renewalPrice: null,
          });
        }
      }

      res.json(unified);
    } catch { res.status(500).json({ message: "Failed to load unified domains" }); }
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

  app.get("/api/domains/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const query = (qstr(req.query.q) || "").trim();
      if (!query) return res.status(400).json({ message: "Search query required" });
      const tlds = req.query.tlds ? qstr(req.query.tlds).split(",") : [];
      const { getRegistrar } = await import("./domainRegistrar");
      const registrar = getRegistrar();
      const results = await registrar.searchAvailability(query, tlds);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: "Domain search failed" });
    }
  });

  app.post("/api/domains/purchase", requireAuth, async (req: Request, res: Response) => {
    try {
      const { domain, tld, projectId } = req.body;
      if (!domain || typeof domain !== "string" || !tld || typeof tld !== "string") return res.status(400).json({ message: "Domain and TLD required" });
      if (projectId && typeof projectId !== "string") return res.status(400).json({ message: "Invalid project ID" });
      const normalizedDomain = domain.toLowerCase();
      const existing = await storage.getPurchasedDomainByName(normalizedDomain);
      if (existing) return res.status(409).json({ message: "Domain already purchased" });

      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (!await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      }

      const { getRegistrar, SUPPORTED_TLDS } = await import("./domainRegistrar");
      if (!SUPPORTED_TLDS.includes(tld)) return res.status(400).json({ message: "Unsupported TLD" });
      const registrar = getRegistrar();
      const searchResults = await registrar.searchAvailability(domain.replace(tld, ""), [tld]);
      const match = searchResults.find(r => r.domain === normalizedDomain && r.available);
      if (!match) return res.status(400).json({ message: "Domain is not available" });

      const result = await registrar.purchaseDomain(normalizedDomain, tld, req.session.userId!);
      if (!result.success) return res.status(500).json({ message: "Purchase failed at registrar" });

      let purchased;
      try {
        purchased = await storage.createPurchasedDomain({
          domain: normalizedDomain,
          tld,
          userId: req.session.userId!,
          projectId: projectId || null,
          purchasePrice: match.registrationPrice,
          renewalPrice: match.renewalPrice,
          status: "active",
          autoRenew: true,
          whoisPrivacy: true,
          expiresAt: result.expiresAt,
        });
      } catch (dbErr: unknown) {
        const errCode = (dbErr as { code?: string }).code;
        if (errCode === "23505") return res.status(409).json({ message: "Domain already registered" });
        throw dbErr;
      }

      const defaultDnsRecords = [
        { type: "A", name: "@", value: "76.76.21.21", ttl: 3600 },
        { type: "CNAME", name: "www", value: normalizedDomain, ttl: 3600 },
      ];

      try {
        await registrar.configureDns(normalizedDomain, defaultDnsRecords);
      } catch (dnsErr) {
        log(`[domain] Warning: failed to configure initial DNS for ${normalizedDomain}: ${dnsErr}`, "domain");
      }

      for (const rec of defaultDnsRecords) {
        try {
          await storage.createDnsRecord({
            domainId: purchased.id,
            recordType: rec.type,
            name: rec.name,
            value: rec.value,
            ttl: rec.ttl,
          });
        } catch {
          log(`[domain] Warning: failed to persist default DNS record ${rec.type} for ${normalizedDomain}`, "domain");
        }
      }

      if (projectId) {
        try {
          const verificationToken = "ecode-verify-" + crypto.randomBytes(16).toString("hex");
          await storage.createCustomDomain({
            domain: normalizedDomain,
            projectId,
            userId: req.session.userId!,
            verificationToken,
          });
          const customDomain = await storage.getCustomDomainByHostname(normalizedDomain);
          if (customDomain) {
            await storage.updateCustomDomain(customDomain.id, {
              verified: true,
              verifiedAt: new Date(),
              sslStatus: "active",
            });
            await storage.updateProject(projectId, { customDomain: normalizedDomain });
          }
        } catch (linkErr) {
          log(`[domain] Warning: purchased ${normalizedDomain} but failed to link to project ${projectId}: ${linkErr}`, "domain");
        }
      }

      res.status(201).json(purchased);
    } catch (err: unknown) {
      const errCode = (err as { code?: string }).code;
      if (errCode === "23505") return res.status(409).json({ message: "Domain already registered" });
      log(`[domain] Purchase error: ${err}`, "error");
      res.status(500).json({ message: "Purchase failed" });
    }
  });

  app.get("/api/domains/purchased", requireAuth, async (req: Request, res: Response) => {
    try {
      const domains = await storage.getUserPurchasedDomains(req.session.userId!);
      res.json(domains);
    } catch { res.status(500).json({ message: "Failed to load domains" }); }
  });

  app.get("/api/domains/purchased/:domainId", requireAuth, async (req: Request, res: Response) => {
    try {
      const domain = await storage.getPurchasedDomain(req.params.domainId);
      if (!domain || String(domain.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Domain not found" });
      const records = await storage.getDomainDnsRecords(domain.id);
      res.json({ ...domain, dnsRecords: records });
    } catch { res.status(500).json({ message: "Failed to load domain" }); }
  });

  app.post("/api/domains/purchased/:domainId/dns", requireAuth, async (req: Request, res: Response) => {
    try {
      const domain = await storage.getPurchasedDomain(req.params.domainId);
      if (!domain || String(domain.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Domain not found" });
      const { recordType, name, value, ttl } = req.body;
      if (!recordType || typeof recordType !== "string" || !name || typeof name !== "string" || !value || typeof value !== "string") {
        return res.status(400).json({ message: "Record type, name, and value required" });
      }
      if (!["A", "TXT", "MX", "CNAME", "AAAA"].includes(recordType)) return res.status(400).json({ message: "Invalid record type" });
      const parsedTtl = typeof ttl === "number" && ttl >= 60 && ttl <= 86400 ? ttl : 3600;
      const record = await storage.createDnsRecord({
        domainId: domain.id,
        recordType,
        name: name.trim(),
        value: value.trim(),
        ttl: parsedTtl,
      });

      const { getRegistrar } = await import("./domainRegistrar");
      const allRecords = await storage.getDomainDnsRecords(domain.id);
      await getRegistrar().configureDns(domain.domain, allRecords.map(r => ({
        type: r.recordType, name: r.name, value: r.value, ttl: r.ttl ?? 3600,
      })));

      res.status(201).json(record);
    } catch { res.status(500).json({ message: "Failed to add DNS record" }); }
  });

  app.put("/api/domains/purchased/:domainId/dns/:recordId", requireAuth, async (req: Request, res: Response) => {
    try {
      const domain = await storage.getPurchasedDomain(req.params.domainId);
      if (!domain || String(domain.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Domain not found" });
      const record = await storage.getDnsRecord(req.params.recordId);
      if (!record || record.domainId !== domain.id) return res.status(404).json({ message: "Record not found" });
      const { recordType, name, value, ttl } = req.body;
      const updateData: Partial<{ recordType: string; name: string; value: string; ttl: number }> = {};
      if (recordType && typeof recordType === "string") {
        if (!["A", "TXT", "MX", "CNAME", "AAAA"].includes(recordType)) return res.status(400).json({ message: "Invalid record type" });
        updateData.recordType = recordType;
      }
      if (name && typeof name === "string") updateData.name = name.trim();
      if (value && typeof value === "string") updateData.value = value.trim();
      if (typeof ttl === "number" && ttl >= 60 && ttl <= 86400) updateData.ttl = ttl;
      if (Object.keys(updateData).length === 0) return res.status(400).json({ message: "No valid fields to update" });

      const updated = await storage.updateDnsRecord(req.params.recordId, updateData);
      if (!updated) return res.status(500).json({ message: "Failed to update record" });

      const { getRegistrar } = await import("./domainRegistrar");
      const allRecords = await storage.getDomainDnsRecords(domain.id);
      await getRegistrar().configureDns(domain.domain, allRecords.map(r => ({
        type: r.recordType, name: r.name, value: r.value, ttl: r.ttl ?? 3600,
      })));

      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update DNS record" }); }
  });

  app.delete("/api/domains/purchased/:domainId/dns/:recordId", requireAuth, async (req: Request, res: Response) => {
    try {
      const domain = await storage.getPurchasedDomain(req.params.domainId);
      if (!domain || String(domain.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Domain not found" });
      const record = await storage.getDnsRecord(req.params.recordId);
      if (!record || record.domainId !== domain.id) return res.status(404).json({ message: "Record not found" });
      await storage.deleteDnsRecord(req.params.recordId);

      const { getRegistrar } = await import("./domainRegistrar");
      const remainingRecords = await storage.getDomainDnsRecords(domain.id);
      await getRegistrar().configureDns(domain.domain, remainingRecords.map(r => ({
        type: r.recordType, name: r.name, value: r.value, ttl: r.ttl ?? 3600,
      })));

      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "Failed to delete DNS record" }); }
  });

  app.patch("/api/domains/purchased/:domainId", requireAuth, async (req: Request, res: Response) => {
    try {
      const domain = await storage.getPurchasedDomain(req.params.domainId);
      if (!domain || String(domain.userId) !== String(req.session.userId)) return res.status(404).json({ message: "Domain not found" });
      const { projectId, autoRenew } = req.body;
      const updates: Partial<{ projectId: string | null; status: string; autoRenew: boolean; expiresAt: Date }> = {};
      if (typeof autoRenew === "boolean") updates.autoRenew = autoRenew;
      if (projectId !== undefined) {
        if (projectId) {
          const project = await storage.getProject(projectId);
          if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
        }
        updates.projectId = projectId || null;

        if (projectId && projectId !== domain.projectId) {
          const existingCustom = await storage.getCustomDomainByHostname(domain.domain);
          if (!existingCustom) {
            const verificationToken = "ecode-verify-" + crypto.randomBytes(16).toString("hex");
            await storage.createCustomDomain({
              domain: domain.domain,
              projectId,
              userId: req.session.userId!,
              verificationToken,
            });
            const newCustom = await storage.getCustomDomainByHostname(domain.domain);
            if (newCustom) {
              await storage.updateCustomDomain(newCustom.id, {
                verified: true,
                verifiedAt: new Date(),
                sslStatus: "active",
              });
            }
          } else if (existingCustom.projectId !== projectId) {
            await storage.updateCustomDomain(existingCustom.id, { projectId } as any);
          }
          await storage.updateProject(projectId, { customDomain: domain.domain });
        }

        if (!projectId && domain.projectId) {
          const existingCustom = await storage.getCustomDomainByHostname(domain.domain);
          if (existingCustom) {
            await storage.deleteCustomDomain(existingCustom.id, req.session.userId!);
          }
          if (domain.projectId) {
            const project = await storage.getProject(domain.projectId);
            if (project && project.customDomain === domain.domain) {
              await storage.updateProject(domain.projectId, { customDomain: undefined });
            }
          }
        }
      }
      const updated = await storage.updatePurchasedDomain(domain.id, updates);
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update domain" }); }
  });

}
