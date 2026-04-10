// AUTO-EXTRACTED from server/routes.ts (lines 1414-1897)
// Original section: usage-quotas
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


export async function registerUsageQuotasRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


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

  app.post("/api/billing/checkout", requireAuth, checkoutLimiter, async (req: Request, res: Response) => {
    const { plan, priceId } = req.body;
    if (!plan && !priceId) {
      return res.status(400).json({ message: "Plan or priceId required" });
    }
    try {
      const { getUncachableStripeClient, isStripeConfigured } = await import("./stripeClient");
      const configured = await isStripeConfigured();
      if (!configured) {
        return res.status(503).json({ url: null, message: "Payment processing is not configured. Please contact the administrator to enable billing." });
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
      if (!configured) return res.status(503).json({ url: null, message: "Billing management is not configured. Please contact the administrator." });
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
          const row = result.rows[0] as unknown as SubscriptionRow;
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
          const row = result.rows[0] as unknown as SubscriptionRow;
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
      credits: {
        monthlyIncluded: quota.monthlyCreditsIncluded,
        monthlyUsed: quota.monthlyCreditsUsed,
        remaining: Math.max(0, quota.monthlyCreditsIncluded - quota.monthlyCreditsUsed),
        overageEnabled: quota.overageEnabled,
        overageUsed: quota.overageCreditsUsed,
        billingCycleStart: quota.billingCycleStart,
      },
    });
  });

  app.get("/api/billing/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const quota = await storage.getUserQuota(req.session.userId!);
      const breakdown = await storage.getUsageBreakdown(req.session.userId!);
      const limits = await storage.getPlanLimits(quota.plan || "free");

      const remaining = Math.max(0, quota.monthlyCreditsIncluded - quota.monthlyCreditsUsed);
      const percentUsed = quota.monthlyCreditsIncluded > 0
        ? Math.round((quota.monthlyCreditsUsed / quota.monthlyCreditsIncluded) * 100)
        : 0;

      return res.json({
        plan: quota.plan,
        monthlyCreditsIncluded: quota.monthlyCreditsIncluded,
        monthlyCreditsUsed: quota.monthlyCreditsUsed,
        remaining,
        percentUsed,
        overageEnabled: quota.overageEnabled,
        overageCreditsUsed: quota.overageCreditsUsed,
        billingCycleStart: quota.billingCycleStart,
        breakdown,
        daily: {
          credits: { used: quota.dailyCreditsUsed, limit: limits.dailyCredits },
          executions: { used: quota.dailyExecutionsUsed, limit: limits.dailyExecutions },
          aiCalls: { used: quota.dailyAiCallsUsed, limit: limits.dailyAiCalls },
        },
      });
    } catch (err: any) {
      console.error("[billing] Usage data error:", err?.message || err);
      return res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  app.post("/api/billing/add-payment-method", requireAuth, async (req: Request, res: Response) => {
    try {
      const { getUncachableStripeClient, isStripeConfigured } = await import("./stripeClient");
      const configured = await isStripeConfigured();
      if (!configured) {
        return res.json({ clientSecret: null, message: "Stripe is not configured yet." });
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

      const setupIntent = await stripeClient.setupIntents.create({
        customer: customerId,
        usage: "off_session",
        metadata: { userId: user.id },
      });

      await storage.setOverageEnabled(user.id, true);

      return res.json({
        clientSecret: setupIntent.client_secret,
        customerId,
      });
    } catch (err) {
      log(`Add payment method error: ${err instanceof Error ? err.message : err}`);
      return res.status(500).json({ message: "Failed to create setup intent" });
    }
  });

  app.get("/api/billing/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const months = Math.min(parseInt(qstr(req.query.months)) || 6, 12);
      const history = await storage.getBillingHistory(req.session.userId!, months);
      return res.json({ history });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch billing history" });
    }
  });

  app.get("/api/billing/credits", requireAuth, async (req: Request, res: Response) => {
    try {
      const quota = await storage.getUserQuota(req.session.userId!);
      const remaining = Math.max(0, quota.monthlyCreditsIncluded - quota.monthlyCreditsUsed);
      const percentUsed = quota.monthlyCreditsIncluded > 0
        ? Math.round((quota.monthlyCreditsUsed / quota.monthlyCreditsIncluded) * 100)
        : 0;
      const lowCredits = percentUsed >= 80;
      const exhausted = remaining <= 0 && quota.monthlyCreditsIncluded > 0;
      return res.json({
        monthlyCreditsIncluded: quota.monthlyCreditsIncluded,
        monthlyCreditsUsed: quota.monthlyCreditsUsed,
        remaining,
        percentUsed,
        overageEnabled: quota.overageEnabled,
        overageCreditsUsed: quota.overageCreditsUsed,
        lowCredits,
        exhausted,
        plan: quota.plan,
      });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch credits" });
    }
  });

  app.get("/api/billing/pricing", (_req: Request, res: Response) => {
    return res.json({
      models: MODEL_TOKEN_PRICING,
      services: SERVICE_CREDIT_COSTS,
      overageRatePerCredit: OVERAGE_RATE_PER_CREDIT,
      plans: {
        free: { monthlyCredits: 0, price: 0, label: "Free" },
        pro: { monthlyCredits: 2000, price: 1200, label: "Pro" },
        team: { monthlyCredits: 5000, price: 2500, label: "Team" },
      },
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
      for (const row of result.rows as unknown as ProductPriceRow[]) {
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

}
