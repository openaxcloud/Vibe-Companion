// AUTO-EXTRACTED from server/routes.ts (lines 8380-9130)
// Original section: websocket
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
import { centralUpgradeDispatcher } from "../websocket/central-upgrade-dispatcher";


export async function registerWebsocketRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;

  // Bug #6 fix (audit 2026-04-27): the central upgrade dispatcher
  // had its `register()` calls scattered across this file (and other
  // modules) but `initialize(server)` was never called by anyone, so
  // its `prependListener('upgrade', …)` never attached. /ws/project
  // upgrades reached the legacy `httpServer.on('upgrade', …)` block
  // below, which has no /ws/project branch, so the socket died with
  // code 1006. /ws/collab and /ws/terminal happened to work via
  // their own attachments. Calling initialize here, before any
  // register(), ensures the dispatcher routes upgrades for every
  // path it knows about.
  centralUpgradeDispatcher.initialize(httpServer);


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
  const collabWss = new WebSocketServer({ noServer: true });
  const lspWss = new WebSocketServer({ noServer: true });
  const debuggerWss = new WebSocketServer({ noServer: true });

  setFilePersister(async (fileId: string, content: string) => {
    try {
      const file = await storage.getFile(fileId);
      if (file) {
        await storage.updateFileContent(fileId, content);
        log(`Collab auto-persisted file ${fileId}`, "collab");
      }
    } catch (err) {
      log(`Collab persist error for file ${fileId}: ${err}`, "collab");
    }
  });

  async function canAccessProject(userId: string | number, project: { id?: string; userId: string; isDemo?: boolean; teamId?: string | null }): Promise<boolean> {
    // String() coercion mirrors the fix in commit 1cfed00f for HTTP routes —
    // project.userId is varchar in the live DB, session.userId is integer.
    const uidStr = String(userId);
    if (String(project.userId) === uidStr) return true;
    if (project.isDemo) return true;
    if (project.teamId) {
      const teams = await storage.getUserTeams(uidStr as any);
      if (teams.some(t => t.id === project.teamId)) return true;
    }
    if (project.id) {
      const isCollab = await storage.isProjectCollaborator(project.id, uidStr as any);
      if (isCollab) return true;
    }
    return false;
  }

  const fakeRes = () => {
    const noop = () => {};
    return { on: noop, once: noop, emit: noop, end: noop, write: noop, writeHead: noop, setHeader: noop, getHeader: () => undefined, removeHeader: noop, headersSent: false, statusCode: 200 } as any;
  };

  async function getIntegrationEnvVars(projectId: string): Promise<Record<string, string>> {
    try {
      const integrations = await storage.getProjectIntegrations(projectId);
      const envVars: Record<string, string> = {};
      for (const pi of integrations) {
        if ((pi.status === "connected" || pi.status === "unverified") && pi.config) {
          for (const [k, v] of Object.entries(pi.config as Record<string, string>)) {
            if (v) envVars[k] = v;
          }
        }
      }
      return envVars;
    } catch {
      return {};
    }
  }

  centralUpgradeDispatcher.register(
    '/ws/project',
    (request: any, socket: any, head: any) => {
      log(`[ws-upgrade] /ws/project handler via central dispatcher`, "websocket");
      sessionMiddleware(request, fakeRes(), (err?: any) => {
        if (err) {
          log(`[ws-upgrade] /ws/project session error: ${err.message}`, "websocket");
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
          return;
        }
        const url = new URL(request.url || "/", `http://${request.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        log(`[ws-upgrade] /ws/project session loaded userId=${request.session?.userId} projectId=${projectId}`, "websocket");
        if (!request.session?.userId || !projectId) {
          log(`[ws-upgrade] /ws/project 401 — no session or projectId`, "websocket");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then(async (project: any) => {
          if (!project || !(await canAccessProject(request.session.userId, project))) {
            log(`[ws-upgrade] /ws/project 403 — project access denied`, "websocket");
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          log(`[ws-upgrade] /ws/project upgrading socket for project ${projectId}`, "websocket");
          wss.handleUpgrade(request, socket, head, (ws: any) => {
            wss.emit("connection", ws, request);
          });
        }).catch((e: any) => {
          log(`[ws-upgrade] /ws/project error: ${e?.message}`, "websocket");
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    },
    { pathMatch: 'exact', priority: 50 }
  );

  function handleTerminalUpgrade(request: any, socket: any, head: any) {
    log(`[ws-upgrade] /ws/terminal handler via central dispatcher`, "websocket");
    sessionMiddleware(request, fakeRes(), (err?: any) => {
      if (err) {
        log(`[ws-upgrade] /ws/terminal session error: ${err.message}`, "websocket");
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }
      const url = new URL(request.url || "/", `http://${request.headers.host}`);
      const projectId = url.searchParams.get("projectId");
      const sessionId = url.searchParams.get("sessionId") || "default";
      log(`[ws-upgrade] /ws/terminal session loaded userId=${request.session?.userId} projectId=${projectId}`, "websocket");
      if (!request.session?.userId || !projectId) {
        log(`[ws-upgrade] /ws/terminal 401 — no session or projectId`, "websocket");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      storage.getProject(projectId).then(async (project: any) => {
        if (!project || !(await canAccessProject(request.session.userId, project))) {
          log(`[ws-upgrade] /ws/terminal 403 — project access denied`, "websocket");
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          socket.destroy();
          return;
        }
        log(`[ws-upgrade] /ws/terminal upgrading socket for project ${projectId}`, "websocket");
        terminalWss.handleUpgrade(request, socket, head, (ws: any) => {
          terminalWss.emit("connection", ws, request);
        });
      }).catch((e: any) => {
        log(`[ws-upgrade] /ws/terminal error: ${e?.message}`, "websocket");
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
      });
    });
  }

  centralUpgradeDispatcher.register(
    '/ws/terminal',
    handleTerminalUpgrade,
    { pathMatch: 'exact', priority: 45 }
  );

  centralUpgradeDispatcher.register(
    '/terminal',
    handleTerminalUpgrade,
    { pathMatch: 'exact', priority: 45 }
  );

  httpServer.on("upgrade", (req: any, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host}`).pathname;
    log(`[ws-upgrade] path=${pathname} cookie=${!!req.headers.cookie}`, "websocket");

    // ── Preview proxy WebSocket (HMR, hot reload, etc.) ──────────────────────
    if (pathname.startsWith("/api/preview/")) {
      const previewMatch = pathname.match(/^\/api\/preview\/([^/]+)(\/.*)?$/);
      if (previewMatch) {
        const projectId = previewMatch[1];
        sessionMiddleware(req, fakeRes(), () => {
          if (!req.session?.userId) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
          storage.getProject(projectId).then(async (project) => {
            if (!project || !(await canAccessProject(req.session.userId, project))) {
              socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
              socket.destroy();
              return;
            }
            const lws = (app as any)._localWS;
            const port = lws?.getLocalWorkspacePort(projectId);
            if (!port) {
              socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
              socket.destroy();
              return;
            }
            lws.touchLocalWorkspace(projectId);
            // Forward the WebSocket upgrade to the local dev server
            import("net").then((net) => {
              const targetSocket = net.createConnection({ port, host: "127.0.0.1" }, () => {
                const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
                const headers = Object.entries(req.headers)
                  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                  .join("\r\n");
                targetSocket.write(reqLine + headers + "\r\n\r\n");
                if (head && head.length > 0) targetSocket.write(head);
                socket.pipe(targetSocket);
                targetSocket.pipe(socket);
              });
              targetSocket.on("error", () => { try { socket.destroy(); } catch {} });
              socket.on("error", () => { try { targetSocket.destroy(); } catch {} });
            });
          }).catch(() => {
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
          });
        });
        return;
      }
    }

    if (pathname === "/ws") {
      log(`[ws-upgrade] ${pathname} handler matched, running session middleware`, "websocket");
      sessionMiddleware(req, fakeRes(), (err?: any) => {
        if (err) {
          log(`[ws-upgrade] /ws session error: ${err.message}`, "websocket");
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
          return;
        }
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        log(`[ws-upgrade] /ws session loaded userId=${req.session?.userId} projectId=${projectId}`, "websocket");
        if (!req.session?.userId || !projectId) {
          log(`[ws-upgrade] /ws 401 — no session or projectId`, "websocket");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then(async (project) => {
          if (!project || !(await canAccessProject(req.session.userId, project))) {
            log(`[ws-upgrade] /ws 403 — project access denied`, "websocket");
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          log(`[ws-upgrade] /ws upgrading socket for project ${projectId}`, "websocket");
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }).catch((e) => {
          log(`[ws-upgrade] /ws error: ${e?.message}`, "websocket");
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    } else if (pathname === "/ws/terminal" || pathname === "/terminal") {
      sessionMiddleware(req, fakeRes(), () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          log(`[ws-upgrade] ${pathname} 401 — no session (userId=${req.session?.userId})`, "websocket");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then(async (project) => {
          if (!project || !(await canAccessProject(req.session.userId, project))) {
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
    } else if (pathname === "/ws/collab") {
      sessionMiddleware(req, fakeRes(), () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then(async (project) => {
          if (!project || !(await canAccessProject(req.session.userId, project))) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          collabWss.handleUpgrade(req, socket, head, (ws) => {
            (ws as WebSocket & { __collabProjectId?: string; __collabUserId?: string }).__collabProjectId = projectId;
            (ws as WebSocket & { __collabProjectId?: string; __collabUserId?: string }).__collabUserId = req.session.userId;
            collabWss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    } else if (pathname === "/ws/lsp") {
      sessionMiddleware(req, fakeRes(), () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then(async (project) => {
          if (!project || !(await canAccessProject(req.session.userId, project))) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          lspWss.handleUpgrade(req, socket, head, (ws) => {
            lspWss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    } else if (pathname === "/ws/debugger") {
      sessionMiddleware(req, fakeRes(), () => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const projectId = url.searchParams.get("projectId");
        if (!req.session?.userId || !projectId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        storage.getProject(projectId).then(async (project) => {
          if (!project || !(await canAccessProject(req.session.userId, project))) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
          }
          debuggerWss.handleUpgrade(req, socket, head, (ws) => {
            debuggerWss.emit("connection", ws, req);
          });
        }).catch(() => {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        });
      });
    }
  });

  lspWss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId") || "";
    const userId = (req as any).session?.userId || "";
    handleLSPConnection(ws, projectId, userId);
  });

  debuggerWss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId") || "";
    const userId = (req as any).session?.userId || "";

    log(`Debugger WS connected for project ${projectId} by user ${userId}`, "debugger");

    const session = createDebugSession(projectId);
    session.clientWs = ws;

    const inspectPort = getInspectPort(projectId);
    connectToInspector(session, inspectPort).then((connected) => {
      ws.send(JSON.stringify({
        type: connected ? "connected" : "notRunning",
        inspectPort,
        message: connected ? "Debugger attached" : "No debuggable process found. Run your project in debug mode first.",
      }));
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.command) {
          handleDebugCommand(session, msg.command, msg.params || {});
        } else if (msg.type === "reconnect") {
          connectToInspector(session, inspectPort).then((connected) => {
            ws.send(JSON.stringify({
              type: connected ? "connected" : "notRunning",
              inspectPort,
            }));
          });
        }
      } catch (e: any) {
        log(`Debugger WS message error: ${e.message}`, "debugger");
      }
    });

    ws.on("close", () => {
      cleanupSession(session);
      log(`Debugger WS disconnected for project ${projectId}`, "debugger");
    });
  });

  wss.on("connection", (ws: WebSocket & { isAlive?: boolean; __userId?: string }, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      ws.close(1008, "projectId required");
      return;
    }

    const userId = (req as any).session?.userId;
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

    const isFirstClient = !wsClients.has(projectId) || wsClients.get(projectId)!.size === 0;
    if (!wsClients.has(projectId)) {
      wsClients.set(projectId, new Set());
    }
    wsClients.get(projectId)!.add(ws);

    if (isFirstClient && projectId) {
      (async () => {
        try {
          const config = await getProjectConfig(projectId);
          if (config.onBoot) {
            log(`Running onBoot for project ${projectId}: ${config.onBoot}`, "config");
            const result = await executeCode(config.onBoot, "bash", undefined, undefined, projectId);
            if (result.exitCode !== 0 && result.stderr) {
              log(`onBoot failed for project ${projectId}: ${result.stderr.slice(0, 200)}`, "config");
            }
          }
        } catch {}
      })();
    }

    if (userId) {
      ws.__userId = userId;
      if (!wsUserClients.has(userId)) {
        wsUserClients.set(userId, new Set());
      }
      wsUserClients.get(userId)!.add(ws);
    }

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
        } else if (data.type === "stdin" && data.data && projectId) {
          const sent = sendStdinToProcess(projectId, data.data);
          if (!sent) {
            ws.send(JSON.stringify({ type: "stdin_error", message: "No active process to receive input" }));
          }
        } else if (data.type === "kill_process" && projectId) {
          killInteractiveProcess(projectId);
        }
      } catch {}
    });

    ws.on("close", () => {
      wsClients.get(projectId)?.delete(ws);
      if (wsClients.get(projectId)?.size === 0) {
        wsClients.delete(projectId);
      }
      if (ws.__userId) {
        wsUserClients.get(ws.__userId)?.delete(ws);
        if (wsUserClients.get(ws.__userId)?.size === 0) {
          wsUserClients.delete(ws.__userId);
        }
      }
      wsConnectionsByIp.get(clientIp)?.delete(ws);
      if (wsConnectionsByIp.get(clientIp)?.size === 0) {
        wsConnectionsByIp.delete(clientIp);
      }
    });

    ws.on("error", () => {
      wsClients.get(projectId)?.delete(ws);
      if (ws.__userId) {
        wsUserClients.get(ws.__userId)?.delete(ws);
      }
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

  const collabPingInterval = setInterval(() => {
    collabWss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  collabWss.on("close", () => {
    clearInterval(collabPingInterval);
  });

  collabWss.on("connection", async (ws: WebSocket & { isAlive?: boolean }, req) => {
    const collabWsExt = ws as WebSocket & { __collabProjectId?: string; __collabUserId?: string };
    const projectId = collabWsExt.__collabProjectId as string;
    const userId = collabWsExt.__collabUserId as string;

    if (!projectId || !userId) {
      ws.close(1008, "Missing projectId or auth");
      return;
    }

    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    const user = await storage.getUser(userId);
    if (!user) {
      ws.close(1008, "User not found");
      return;
    }

    let collabUser: ReturnType<typeof addCollaborator> | null = null;

    const MAX_COLLAB_MSG_SIZE = 1024 * 1024;
    const RATE_LIMIT_WINDOW_MS = 1000;
    const RATE_LIMIT_MAX_MSGS = 120;
    let rateLimitCount = 0;
    let rateLimitWindowStart = Date.now();

    function checkRateLimit(): boolean {
      const now = Date.now();
      if (now - rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitCount = 0;
        rateLimitWindowStart = now;
      }
      rateLimitCount++;
      if (rateLimitCount > RATE_LIMIT_MAX_MSGS) {
        return false;
      }
      return true;
    }

    function handleDisconnect(): void {
      const removed = removeCollaborator(ws);
      if (removed) {
        broadcastToCollaborators(removed.projectId, null, {
          type: "collab:user_left",
          userId: removed.userId,
          displayName: removed.user.displayName,
        });
        broadcastPresence(removed.projectId);
      }
    }

    ws.on("message", (rawData, isBinary) => {
      try {
        if (!checkRateLimit()) {
          log(`Rate limit exceeded for user ${userId} in project ${projectId}`, "collab");
          return;
        }
        if (isBinary) {
          if (!collabUser) return;
          const buf = rawData instanceof Buffer ? rawData : Buffer.from(rawData as ArrayBuffer);
          if (buf.length > MAX_COLLAB_MSG_SIZE || buf.length < 2) return;

          const msgType = buf[0];
          const fileIdLen = buf[1];
          if (buf.length < 2 + fileIdLen) return;
          const fileId = buf.slice(2, 2 + fileIdLen).toString("utf8");
          const payload = buf.slice(2 + fileIdLen);

          if (fileIdLen === 0 || fileIdLen > 255) return;

          const ensureInitialized = async (fId: string): Promise<ReturnType<typeof getOrCreateFileDoc> | null> => {
            const fd = getOrCreateFileDoc(projectId, fId);
            if (fd.initialized) return fd;
            if (fd.initPromise) {
              await fd.initPromise;
              return fd.initialized ? fd : null;
            }
            fd.initPromise = (async () => {
              const file = await storage.getFile(fId);
              if (file && file.projectId === projectId) {
                initializeFileDoc(projectId, fId, file.content || "");
              }
            })();
            await fd.initPromise;
            return fd.initialized ? fd : null;
          };

          const sendSyncResponse = (fId: string, clientSV: Uint8Array, doc: Y.Doc): void => {
            const update = clientSV.length > 0
              ? Y.encodeStateAsUpdate(doc, clientSV)
              : Y.encodeStateAsUpdate(doc);
            const header = Buffer.alloc(2 + Buffer.byteLength(fId, "utf8"));
            header[0] = 1;
            header[1] = Buffer.byteLength(fId, "utf8");
            header.write(fId, 2, "utf8");
            if (ws.readyState === 1) {
              ws.send(Buffer.concat([header, Buffer.from(update)]));
            }
          };

          if (msgType === 0) {
            ensureInitialized(fileId).then((fd) => {
              if (!fd) return;
              sendSyncResponse(fileId, payload, fd.ydoc);
            }).catch((err) => { log(`Collab sync init error for file ${fileId}: ${err}`, "collab"); });
          } else if (msgType === 2) {
            ensureInitialized(fileId).then((fd) => {
              if (!fd) return;
              Y.applyUpdate(fd.ydoc, payload);
              const header = Buffer.alloc(2 + Buffer.byteLength(fileId, "utf8"));
              header[0] = 2;
              header[1] = Buffer.byteLength(fileId, "utf8");
              header.write(fileId, 2, "utf8");
              const relayBuf = Buffer.concat([header, Buffer.from(payload)]);
              broadcastBinaryToCollaborators(projectId, userId, relayBuf, fileId);
            }).catch((err) => { log(`Collab update error for file ${fileId}: ${err}`, "collab"); });
          } else if (msgType === 3) {
            if (payload.length > 4096) return;
            let parsedState: unknown;
            try { parsedState = JSON.parse(payload.toString("utf8")); } catch { return; }
            if (!parsedState || typeof parsedState !== "object") return;
            ensureInitialized(fileId).then((fd) => {
              if (!fd) return;
              broadcastToCollaborators(projectId, userId, {
                type: "collab:awareness",
                userId,
                fileId,
                state: parsedState,
              }, fileId);
            }).catch((err) => { log(`Collab awareness error for file ${fileId}: ${err}`, "collab"); });
          }
          return;
        }

        const raw = typeof rawData === "string" ? rawData : rawData.toString();
        if (raw.length > MAX_COLLAB_MSG_SIZE) return;

        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }
        if (!data || typeof data.type !== "string") return;

        switch (data.type) {
          case "collab:join": {
            collabUser = addCollaborator(
              projectId,
              ws,
              userId,
              user.displayName || user.email.split("@")[0],
              user.avatarUrl || null,
            );
            ws.send(JSON.stringify({
              type: "collab:joined",
              user: {
                userId: collabUser.userId,
                displayName: collabUser.displayName,
                color: collabUser.color,
              },
            }));
            broadcastToCollaborators(projectId, userId, {
              type: "collab:user_joined",
              userId: collabUser.userId,
              displayName: collabUser.displayName,
              avatarUrl: collabUser.avatarUrl,
              color: collabUser.color,
            });
            broadcastPresence(projectId);
            break;
          }

          case "collab:active_file": {
            if (!collabUser) break;
            if (typeof data.fileId !== "string") break;
            updateActiveFile(projectId, userId, data.fileId);
            broadcastPresence(projectId);
            break;
          }

          case "collab:request_sync": {
            if (!collabUser) break;
            if (typeof data.fileId !== "string") break;
            const reqFileId = data.fileId as string;
            storage.getFile(reqFileId).then((file) => {
              if (!file || file.projectId !== projectId) return;
              const syncFd = getOrCreateFileDoc(projectId, reqFileId);
              if (!syncFd.initialized) {
                initializeFileDoc(projectId, reqFileId, file.content || "");
              }
              const update = Y.encodeStateAsUpdate(syncFd.ydoc);
              const header = Buffer.alloc(2 + Buffer.byteLength(reqFileId, "utf8"));
              header[0] = 1;
              header[1] = Buffer.byteLength(reqFileId, "utf8");
              header.write(reqFileId, 2, "utf8");
              if (ws.readyState === 1) {
                ws.send(Buffer.concat([header, Buffer.from(update)]));
              }
            }).catch((err) => { log(`Collab request_sync error for file ${reqFileId}: ${err}`, "collab"); });
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;
          }
        }
      } catch (err) {
        log(`Collab message error: ${err}`, "collab");
      }
    });

    ws.on("close", handleDisconnect);
    ws.on("error", handleDisconnect);
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

      const workspaceDir = await materializeTerminalFiles(
        projectId,
        () => storage.getFiles(projectId),
      );
      const term = createTerminalSession(projectId, userId, sessionId, workspaceDir, envVarsMap);
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

}
