// AUTO-EXTRACTED from server/routes.ts (lines 9131-9442)
// Original section: database-viewer
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

async function verifyProjectWriteAccess(projectId: string, userId: string): Promise<boolean> {
  try {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    if (String(project.userId) === String(userId)) return true;
    const collaborators = await storage.getProjectCollaborators(projectId);
    const collab = collaborators.find((c: any) => String(c.userId) === String(userId));
    if (collab && (collab.role === "editor" || collab.role === "owner" || collab.role === "admin")) return true;
    const usr = await storage.getUser(userId);
    if (usr) {
      const accepted = await storage.getAcceptedInviteForProject(projectId, usr.email.toLowerCase());
      if (accepted && (accepted.role === "editor" || accepted.role === "owner")) return true;
    }
    return false;
  } catch {
    return false;
  }
}
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


export async function registerDatabaseViewerRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // ============ DATABASE VIEWER ============
  const VALID_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
  function isValidIdentifier(name: string): boolean {
    return VALID_IDENTIFIER_RE.test(name);
  }
  function getProjectSchema(projectId: string, env?: string): string {
    const sanitized = projectId.replace(/[^a-zA-Z0-9_]/g, "_");
    return env === "production" ? `prod_${sanitized}` : `proj_${sanitized}`;
  }
  async function ensureProjectSchema(pool: any, projectId: string, env?: string): Promise<string> {
    const schema = getProjectSchema(projectId, env);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    return schema;
  }
  function containsCrossSchemaRef(sql: string, allowedSchema: string): boolean {
    const normalized = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/'[^']*'/g, "''");
    if (/SET\s+search_path/i.test(normalized)) return true;
    const blockedSchemas = ["public", "pg_catalog", "pg_toast"];
    for (const schema of blockedSchemas) {
      const pattern = new RegExp(`\\b${schema}\\s*\\.`, "i");
      if (pattern.test(normalized)) return true;
    }
    const crossTenantPattern = /\b(proj_|prod_)[a-zA-Z0-9_]+\s*\./gi;
    let match;
    while ((match = crossTenantPattern.exec(normalized)) !== null) {
      const ref = match[0].replace(/\s*\.$/, "").toLowerCase();
      if (ref === allowedSchema.toLowerCase()) continue;
      return true;
    }
    return false;
  }

  app.post("/api/projects/:id/database/execute", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectWriteAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const { sql: sqlQuery, confirm, env } = req.body;
      if (!sqlQuery || typeof sqlQuery !== "string") return res.status(400).json({ error: "SQL query required" });

      const { pool } = await import("./db");
      const schema = await ensureProjectSchema(pool, project.id, env);

      if (containsCrossSchemaRef(sqlQuery, schema)) {
        return res.status(403).json({ error: "Cross-schema references are not allowed. Queries are restricted to your project database." });
      }

      const stripped = sqlQuery.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/'[^']*'/g, "''");
      const statements = stripped.split(";").map(s => s.trim()).filter(s => s.length > 0);
      if (statements.length > 1) {
        return res.status(400).json({ error: "Multi-statement queries are not allowed. Please execute one statement at a time." });
      }

      const dangerousPatterns = /\b(GRANT|REVOKE|COPY|pg_read_file|pg_write_file|lo_import|lo_export)\b/i;
      if (dangerousPatterns.test(stripped)) {
        return res.status(403).json({ error: "This operation is not permitted for security reasons." });
      }

      const writeKeywords = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/i;
      const destructiveKeywords = /\b(DROP|DELETE|TRUNCATE|ALTER|UPDATE)\b/i;
      const isWrite = writeKeywords.test(stripped);
      const isDestructive = destructiveKeywords.test(stripped);

      if (env === "production" && isWrite) {
        return res.status(403).json({ error: "Write operations are not allowed on production databases" });
      }

      if (isDestructive && !confirm) {
        return res.json({
          requiresConfirmation: true,
          sql: sqlQuery,
          message: "This is a destructive query. Confirm to execute.",
          columns: [],
          rows: [],
          rowCount: 0,
        });
      }

      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO "${schema}", information_schema, pg_catalog`);
        const result = await client.query(sqlQuery);
        if (result.rows && result.fields) {
          const columns = result.fields.map((f: any) => f.name);
          const rows = result.rows.map((row: any) => columns.map((col: string) => row[col]));
          res.json({ columns, rows, rowCount: result.rowCount ?? rows.length });
        } else {
          res.json({ columns: [], rows: [], rowCount: result.rowCount ?? 0 });
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      res.json({ error: safeError(err, "Query failed") });
    }
  });

  app.get("/api/projects/:id/database/tables", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectWriteAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const env = qstr(req.query.env);
      const { pool } = await import("./db");
      const schema = await ensureProjectSchema(pool, project.id, env);
      const result = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`,
        [schema]
      );
      res.json({ tables: result.rows.map((r: any) => r.tablename) });
    } catch (err: any) {
      res.json({ error: safeError(err, "Failed to list tables") });
    }
  });

  app.get("/api/projects/:id/database/tables/:tableName/data", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectWriteAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const tableName = req.params.tableName;
      if (!isValidIdentifier(tableName)) return res.status(400).json({ error: "Invalid table name" });

      const env = qstr(req.query.env);
      const { pool } = await import("./db");
      const schema = await ensureProjectSchema(pool, project.id, env);

      const tableCheck = await pool.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = $1 AND tablename = $2`,
        [schema, tableName]
      );
      if (tableCheck.rows.length === 0) return res.status(404).json({ error: "Table not found in project schema" });

      const limit = Math.min(parseInt(qstr(req.query.limit)) || 100, 500);
      const offset = parseInt(qstr(req.query.offset)) || 0;
      const sortCol = qstr(req.query.sort);
      const sortDir = qstr(req.query.dir)?.toUpperCase() === "DESC" ? "DESC" : "ASC";
      const filterCol = qstr(req.query.filterCol);
      const filterVal = qstr(req.query.filterVal);

      const colResult = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND table_schema = $2 ORDER BY ordinal_position`,
        [tableName, schema]
      );
      const validCols = colResult.rows.map((c: any) => c.column_name);

      let countQuery = `SELECT COUNT(*) as total FROM "${schema}"."${tableName}"`;
      let dataQuery = `SELECT * FROM "${schema}"."${tableName}"`;
      const params: any[] = [];

      if (filterCol && filterVal && validCols.includes(filterCol)) {
        const filterClause = ` WHERE "${filterCol}"::text ILIKE $1`;
        countQuery += filterClause;
        dataQuery += filterClause;
        params.push(`%${filterVal}%`);
      }

      if (sortCol && validCols.includes(sortCol)) {
        dataQuery += ` ORDER BY "${sortCol}" ${sortDir}`;
      }

      const countParams = [...params];
      params.push(limit, offset);
      dataQuery += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const [countRes, dataRes] = await Promise.all([
        pool.query(countQuery, countParams),
        pool.query(dataQuery, params),
      ]);

      const columns = colResult.rows.map((c: any) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === "YES",
        hasDefault: !!c.column_default,
      }));

      res.json({
        columns,
        rows: dataRes.rows,
        totalRows: parseInt(countRes.rows[0]?.total || "0"),
        limit,
        offset,
      });
    } catch (err: any) {
      res.json({ error: safeError(err, "Failed to fetch table data") });
    }
  });

  app.get("/api/projects/:id/database/credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) return res.status(403).json({ error: "Access denied" });

      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) return res.json({ credentials: {} });

      const env = qstr(req.query.env);
      const schema = getProjectSchema(project.id, env);

      try {
        const url = new URL(dbUrl);
        const mask = (s: string) => s.length > 4 ? s.slice(0, 2) + "***" + s.slice(-2) : "***";
        res.json({
          credentials: {
            DATABASE_URL: `postgresql://${url.username}:${mask(decodeURIComponent(url.password))}@${url.hostname}:${url.port || "5432"}${url.pathname}?options=-csearch_path%3D${schema}`,
            PGHOST: url.hostname,
            PGUSER: url.username,
            PGPASSWORD: mask(decodeURIComponent(url.password)),
            PGDATABASE: url.pathname.slice(1),
            PGPORT: url.port || "5432",
            PGSCHEMA: schema,
          },
        });
      } catch {
        res.json({ credentials: { DATABASE_URL: "Not configured" } });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get credentials" });
    }
  });

  app.get("/api/projects/:id/database/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || (project.userId !== userId && !await verifyProjectWriteAccess(project.id, userId))) return res.status(404).json({ error: "Project not found" });

      const env = qstr(req.query.env);
      const { pool } = await import("./db");
      const schema = await ensureProjectSchema(pool, project.id, env);

      const tablesResult = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`,
        [schema]
      );

      const tableStats = [];
      let totalSize = 0;
      for (const t of tablesResult.rows) {
        try {
          const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM "${schema}"."${t.tablename}"`);
          const sizeRes = await pool.query(`SELECT pg_total_relation_size('"${schema}"."${t.tablename}"') as tsize`);
          const tsize = parseInt(sizeRes.rows[0]?.tsize || "0");
          totalSize += tsize;
          tableStats.push({
            schema,
            table: t.tablename,
            rowCount: parseInt(countRes.rows[0]?.cnt || "0"),
            sizeBytes: tsize,
          });
        } catch {
          tableStats.push({ schema, table: t.tablename, rowCount: 0, sizeBytes: 0 });
        }
      }

      res.json({
        dbSizeBytes: totalSize,
        tableCount: tablesResult.rows.length,
        tables: tableStats,
        freeLimit: "10 GB",
        freeLimitBytes: 10 * 1024 * 1024 * 1024,
      });
    } catch (err: any) {
      res.json({ error: safeError(err, "Failed to get usage") });
    }
  });

  app.post("/api/projects/:id/database/remove", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) return res.status(403).json({ error: "Access denied" });

      const { confirmToken, env } = req.body;
      if (env === "production") {
        return res.status(403).json({ error: "Production databases cannot be removed from the panel" });
      }
      if (confirmToken !== "REMOVE_DATABASE") {
        return res.status(400).json({ error: "Confirmation required. Send confirmToken: 'REMOVE_DATABASE'" });
      }

      const { pool } = await import("./db");
      const schema = getProjectSchema(project.id, env);

      const tablesResult = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`,
        [schema]
      );

      const droppedTables: string[] = [];
      for (const t of tablesResult.rows) {
        try {
          await pool.query(`DROP TABLE IF EXISTS "${schema}"."${t.tablename}" CASCADE`);
          droppedTables.push(t.tablename);
        } catch {}
      }

      try {
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch {}

      res.json({ message: `Removed ${droppedTables.length} tables`, droppedTables });
    } catch (err: any) {
      res.status(500).json({ error: safeError(err, "Failed to remove database") });
    }
  });

}
