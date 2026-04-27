// AUTO-EXTRACTED from server/routes.ts (lines 13925-14339)
// Original section: mcp-servers
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


export async function registerMcpServersRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- MCP Server Routes ---
  app.get("/api/projects/:projectId/mcp/servers", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || !await verifyProjectAccess(project.id, req.session.userId!)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const servers = await storage.getMcpServers(req.params.projectId);
    const mcpClientModule = await import("./mcpClient");
    const serversWithStatus = servers.map(s => {
      if (s.serverType === "remote") {
        const remoteClient = mcpClientModule.getRemoteClient(s.id);
        return { ...s, status: remoteClient?.connected ? "connected" : s.status };
      }
      const client = mcpClientModule.getClient(s.id);
      return { ...s, status: client?.status || s.status };
    });
    return res.json(serversWithStatus);
  });

  app.post("/api/projects/:projectId/mcp/servers", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { name, command, args, env, baseUrl, headers: reqHeaders, serverType } = req.body;
    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    if (typeof name !== "string" || name.length > 100) {
      return res.status(400).json({ message: "Invalid server name" });
    }

    const type = serverType === "remote" ? "remote" : "stdio";

    if (type === "remote") {
      if (!baseUrl || typeof baseUrl !== "string") {
        return res.status(400).json({ message: "baseUrl is required for remote servers" });
      }
      if (baseUrl.length > 2000) {
        return res.status(400).json({ message: "baseUrl too long" });
      }
      try {
        const parsedMcpUrl = new URL(baseUrl);
        if (parsedMcpUrl.protocol !== "https:") {
          return res.status(400).json({ message: "MCP server URL must use HTTPS" });
        }
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }
      const urlValidation = validateExternalUrl(baseUrl);
      if (!urlValidation.valid) {
        return res.status(400).json({ message: urlValidation.error });
      }
    } else {
      if (!command) {
        return res.status(400).json({ message: "command is required for stdio servers" });
      }
      if (typeof command !== "string" || command.length > 500) {
        return res.status(400).json({ message: "Invalid command" });
      }
    }

    const server = await storage.createMcpServer({
      projectId: req.params.projectId,
      name: name.slice(0, 100),
      command: type === "stdio" ? String(command || "").slice(0, 500) : "",
      args: Array.isArray(args) ? args.map((a: any) => String(a).slice(0, 1000)) : [],
      env: typeof env === "object" && env !== null ? env : {},
      baseUrl: type === "remote" ? baseUrl : undefined,
      headers: typeof reqHeaders === "object" && reqHeaders !== null ? reqHeaders : {},
      serverType: type,
    });
    return res.json(server);
  });

  app.put("/api/projects/:projectId/mcp/servers/:serverId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    const { name, command, args, env, baseUrl, headers: reqHeaders } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = String(name).slice(0, 100);
    if (command) updates.command = String(command).slice(0, 500);
    if (args) updates.args = Array.isArray(args) ? args.map((a: any) => String(a).slice(0, 1000)) : [];
    if (env) updates.env = typeof env === "object" && env !== null ? env : {};
    if (baseUrl !== undefined) {
      if (baseUrl) {
        try {
          const parsedMcpUrl = new URL(baseUrl);
          if (parsedMcpUrl.protocol !== "https:") {
            return res.status(400).json({ message: "MCP server URL must use HTTPS" });
          }
        } catch {
          return res.status(400).json({ message: "Invalid URL format" });
        }
        const urlValidation = validateExternalUrl(baseUrl);
        if (!urlValidation.valid) {
          return res.status(400).json({ message: urlValidation.error });
        }
      }
      updates.baseUrl = baseUrl || null;
    }
    if (reqHeaders !== undefined) updates.headers = typeof reqHeaders === "object" && reqHeaders !== null ? reqHeaders : {};
    const updated = await storage.updateMcpServer(server.id, updates);
    return res.json(updated);
  });

  app.delete("/api/projects/:projectId/mcp/servers/:serverId", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      if (server.serverType === "remote") {
        mcpClientModule.disconnectRemoteClient(server.id);
      } else {
        await mcpClientModule.stopClient(server.id);
      }
    } catch {}
    await storage.deleteMcpServer(server.id);
    return res.json({ message: "Server deleted" });
  });

  app.post("/api/projects/:projectId/mcp/servers/test-remote", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const { baseUrl, headers: reqHeaders } = req.body;
    if (!baseUrl || typeof baseUrl !== "string") {
      return res.status(400).json({ success: false, message: "baseUrl is required" });
    }
    try {
      const parsedMcpUrl = new URL(baseUrl);
      if (parsedMcpUrl.protocol !== "https:") {
        return res.status(400).json({ success: false, message: "MCP server URL must use HTTPS" });
      }
    } catch {
      return res.status(400).json({ success: false, message: "Invalid URL format" });
    }
    const urlValidation = validateExternalUrl(baseUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({ success: false, message: urlValidation.error });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      const result = await mcpClientModule.testRemoteConnection(baseUrl, reqHeaders || {});
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/test", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    try {
      if (server.serverType === "remote" && server.baseUrl) {
        const mcpClientModule = await import("./mcpClient");
        const result = await mcpClientModule.testRemoteConnection(
          server.baseUrl,
          server.headers as Record<string, string> || {}
        );
        if (result.success) {
          await storage.updateMcpServer(server.id, { status: "connected" });
        } else {
          await storage.updateMcpServer(server.id, { status: "error" });
        }
        return res.json(result);
      } else {
        return res.json({ success: false, message: "Use start endpoint for stdio servers" });
      }
    } catch (err: any) {
      await storage.updateMcpServer(server.id, { status: "error" });
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/connect", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
      return res.status(404).json({ message: "Project not found" });
    }
    const server = await storage.getMcpServer(req.params.serverId);
    if (!server || server.projectId !== req.params.projectId) {
      return res.status(404).json({ message: "MCP server not found" });
    }
    if (server.serverType !== "remote" || !server.baseUrl) {
      return res.status(400).json({ message: "Only remote servers can be connected this way" });
    }
    try {
      const mcpClientModule = await import("./mcpClient");
      const result = await mcpClientModule.connectRemoteServer(
        server.id,
        server.baseUrl,
        server.headers as Record<string, string> || {}
      );
      if (result.success) {
        await storage.updateMcpServer(server.id, { status: "connected" });
        await storage.deleteMcpToolsByServer(server.id);
        for (const tool of result.tools) {
          await storage.createMcpTool({
            serverId: server.id,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
        return res.json({
          status: "connected",
          tools: result.tools,
          blockedTools: result.blocked,
        });
      } else {
        await storage.updateMcpServer(server.id, { status: "error" });
        return res.status(400).json({ message: result.error || "Connection failed" });
      }
    } catch (err: any) {
      await storage.updateMcpServer(server.id, { status: "error" });
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:projectId/mcp/servers/:serverId/start", requireAuth, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.projectId);
    if (!project || String(project.userId) !== String(req.session.userId)) {
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
    if (!project || String(project.userId) !== String(req.session.userId)) {
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
    if (!project || String(project.userId) !== String(req.session.userId)) {
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
    if (!project || String(project.userId) !== String(req.session.userId)) {
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

}
