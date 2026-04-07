/**
 * Main router aggregator for E-Code Platform
 * Uses resilient dynamic imports so individual router failures don't block the entire app
 */

import { Application, Router, RequestHandler } from "express";
import { type IStorage } from "../storage";

type RouterModule = { default: Router } | { default: { getRouter(): Router } } | Router;

let loadedCount = 0;
let failedCount = 0;
const failedRouters: string[] = [];

async function safeImport<T>(name: string, importFn: () => Promise<T>): Promise<T | null> {
  try {
    const mod = await importFn();
    loadedCount++;
    return mod;
  } catch (err: any) {
    failedCount++;
    failedRouters.push(name);
    console.warn(`[routes] Failed to load ${name}: ${err?.message || err}`);
    return null;
  }
}

function mount(app: Application, path: string, ...handlers: (RequestHandler | Router | null | undefined)[]) {
  const valid = handlers.filter((h): h is RequestHandler | Router => h != null);
  if (valid.length > 0) {
    app.use(path, ...valid);
  }
}

export class MainRouter {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async registerRoutes(app: Application): Promise<void> {
    loadedCount = 0;
    failedCount = 0;
    failedRouters.length = 0;

    const [
      { AuthRouter: AR },
      { ProjectsRouter: PR },
      { FilesRouter: FR },
      { UsersRouter: UR },
      { HealthRouter: HR },
      { ChatGPTRouter: CR },
      { LoadTestingRouter: LR },
      { csrfTokenEndpoint },
      { tierRateLimiters },
      { aiUsageTracker },
      { apiVersionMiddleware, rejectUnsupportedVersions },
      { prometheusRouter },
      { setupPreviewRoutes },
    ] = await Promise.all([
      import("./auth.router"),
      import("./projects.router"),
      import("./files.router"),
      import("./users.router"),
      import("./health.router"),
      import("./chatgpt.router"),
      import("./load-testing.router"),
      import("../middleware/csrf"),
      import("../middleware/tier-rate-limiter"),
      import("../middleware/ai-usage-tracker"),
      import("../middleware/api-versioning"),
      import("../monitoring/prometheus"),
      import("../preview/preview-service"),
    ]);

    const authRouter = new AR(this.storage);
    const projectsRouter = new PR(this.storage);
    const filesRouter = new FR(this.storage);
    const usersRouter = new UR(this.storage);
    const healthRouter = new HR(this.storage);
    const chatgptRouter = new CR(this.storage);
    const loadTestingRouter = new LR(this.storage);

    app.use('/api', healthRouter.getRouter());
    app.use('/api', prometheusRouter);
    app.use('/api', loadTestingRouter.getRouter());
    app.get('/api/csrf-token', csrfTokenEndpoint);
    app.get('/api/auth/csrf-token', csrfTokenEndpoint);
    app.use('/api', apiVersionMiddleware);
    app.use('/api', rejectUnsupportedVersions);
    app.use('/api', authRouter.getRouter());

    app.use('/api/users', tierRateLimiters.api, usersRouter.getRouter());
    app.use('/api/user', tierRateLimiters.api, usersRouter.getRouter());
    app.use('/api/projects', tierRateLimiters.api, projectsRouter.getRouter());
    app.use('/api/projects', tierRateLimiters.api, filesRouter.getRouter());
    app.use('/api', tierRateLimiters.api, chatgptRouter.getRouter());

    app.use('/api/agent', aiUsageTracker);
    app.use('/api/admin/agent', aiUsageTracker);
    app.use('/api/ai', aiUsageTracker);

    const def = (m: any) => m?.default ?? m;
    const getRouter = (m: any) => m?.getRouter?.() ?? m;

    const [
      placeholderMod,
      logsMod,
      authCompleteMod,
      twoFactorMod,
      agentPrefsMod,
      agentToolsMod,
      agentPlanMod,
      agentBuildMod,
      agentAutonomousMod,
      agentWorkflowMod,
      agentMod,
      agentStepCacheMod,
      agentTestingMod,
      testAgentMod,
      agentGridMod,
      collaborationMod,
      deploymentMod,
      rollbackMod,
      fileUploadMod,
      notificationsMod,
      previewMod,
      shellMod,
      containersMod,
      scalabilityMod,
      resourcesMod,
      marketplaceMod,
      communityMod,
      teamsMod,
      polyglotMod,
      adminMod,
      adminMonitoringMod,
      adminSystemMod,
      adminBillingMod,
      seoMod,
      aiMod,
      aiStreamingMod,
      aiModelsMod,
      aiUsageMod,
      aiHealthMod,
      ragMod,
      memoryBankMod,
      unifiedCheckpointsMod,
      codeGenMod,
      codeReviewMod,
      featureFlagsMod,
      generationMetricsMod,
      voiceVideoMod,
      voiceTranscribeMod,
      dataProvisioningMod,
      terminalMod,
      terminalMetricsMod,
      runtimeMod,
      packagesMod,
      workspaceMod,
      workspaceBootstrapMod,
      workspacesMod,
      mobileMod,
      mobileSessionsMod,
      mobileBuildsMod,
      expoSnackMod,
      gitProjectMod,
      gitMod,
      debugMod,
      databaseMod,
      replitdbMod,
      kvStoreMod,
      projectDataMod,
      globalSearchMod,
      projectSearchMod,
      logsViewerMod,
      envVarsMod,
      secretsMod,
      themesMod,
      globalThemesMod,
      settingsMod,
      storageMod,
      extensionsMod,
      workflowsMod,
      projectShellMod,
      mcpServersMod,
      networkingMod,
      videoMod,
      syncMod,
      bgTestsMod,
      maxAutonomyMod,
      bountiesMod,
      effortMod,
      analyticsMod,
      sendgridMod,
      publicFormsMod,
      statusMod,
      runnerMod,
      projectAuthMod,
    ] = await Promise.all([
      safeImport("placeholder", () => import("./placeholder.router")),
      safeImport("logs", () => import("./logs.router")),
      safeImport("auth-complete", () => import("./auth-complete")),
      safeImport("2fa", () => import("./2fa.router")),
      safeImport("agent-preferences", () => import("./agent-preferences.router")),
      safeImport("agent-tools", () => import("./agent-tools.router")),
      safeImport("agent-plan", () => import("./agent-plan.router")),
      safeImport("agent-build", () => import("./agent-build.router")),
      safeImport("agent-autonomous", () => import("./agent-autonomous.router")),
      safeImport("agent-workflow", () => import("./agent-workflow.router")),
      safeImport("agent", () => import("./agent.router")),
      safeImport("agent-step-cache", () => import("./agent-step-cache.router")),
      safeImport("agent-testing", () => import("./agent-testing.router")),
      safeImport("test-agent", () => import("./test-agent")),
      safeImport("agent-grid", () => import("./agent-grid.router")),
      safeImport("collaboration", () => import("./collaboration")),
      safeImport("deployment", () => import("./deployment")),
      safeImport("rollback", () => import("./rollback.router")),
      safeImport("file-upload", () => import("./file-upload")),
      safeImport("notifications", () => import("./notifications")),
      safeImport("preview", () => import("./preview")),
      safeImport("shell", () => import("./shell")),
      safeImport("containers", () => import("./containers")),
      safeImport("scalability", () => import("./scalability")),
      safeImport("resources", () => import("./resources.router")),
      safeImport("marketplace", () => import("./marketplace")),
      safeImport("community", () => import("./community.router")),
      safeImport("teams", () => import("./teams.router")),
      safeImport("polyglot", () => import("../polyglot-routes")),
      safeImport("admin", () => import("./admin")),
      safeImport("admin-monitoring", () => import("./admin-monitoring.router")),
      safeImport("admin-system-metrics", () => import("./admin-system-metrics.router")),
      safeImport("admin-billing", () => import("./admin-billing.router")),
      safeImport("seo", () => import("./seo.router")),
      safeImport("ai", () => import("./ai.router")),
      safeImport("ai-streaming", () => import("../api/ai-streaming")),
      safeImport("ai-models", () => import("./ai-models.router")),
      safeImport("ai-usage", () => import("./ai-usage.router")),
      safeImport("ai-health", () => import("./ai-health")),
      safeImport("rag", () => import("./rag.router")),
      safeImport("memory-bank", () => import("./memory-bank.router")),
      safeImport("unified-checkpoints", () => import("./unified-checkpoints.router")),
      safeImport("code-generation", () => import("./code-generation.router")),
      safeImport("code-review", () => import("./code-review.router")),
      safeImport("feature-flags", () => import("./feature-flags.router")),
      safeImport("generation-metrics", () => import("./generation-metrics.router")),
      safeImport("voice-video", () => import("./voice-video.router")),
      safeImport("voice-transcribe", () => import("./voice-transcribe.router")),
      safeImport("data-provisioning", () => import("./data-provisioning.router")),
      safeImport("terminal", () => import("./terminal.router")),
      safeImport("terminal-metrics", () => import("./terminal-metrics.router")),
      safeImport("runtime", () => import("./runtime.router")),
      safeImport("packages", () => import("./packages.router")),
      safeImport("workspace", () => import("./workspace")),
      safeImport("workspace-bootstrap", () => import("./workspace-bootstrap.router")),
      safeImport("workspaces", () => import("./workspaces.router")),
      safeImport("mobile", () => import("../api/mobile")),
      safeImport("mobile-sessions", () => import("./mobile-sessions.router")),
      safeImport("mobile-builds", () => import("./mobile-builds.router")),
      safeImport("expo-snack", () => import("./expo-snack.router")),
      safeImport("git-project", () => import("./git-project.router")),
      safeImport("git", () => import("./git.router")),
      safeImport("debug", () => import("./debug.router")),
      safeImport("database", () => import("./database.router")),
      safeImport("replitdb", () => import("./replitdb.router")),
      safeImport("kv-store", () => import("./kv-store.router")),
      safeImport("project-data", () => import("./project-data.router")),
      safeImport("global-search", () => import("./global-search.router")),
      safeImport("project-search", () => import("./project-search.router")),
      safeImport("logs-viewer", () => import("./logs-viewer.router")),
      safeImport("env-vars", () => import("./env-vars.router")),
      safeImport("secrets", () => import("./secrets.router")),
      safeImport("themes", () => import("./themes.router")),
      safeImport("global-themes", () => import("./global-themes.router")),
      safeImport("settings", () => import("./settings.router")),
      safeImport("storage-router", () => import("./storage.router")),
      safeImport("extensions", () => import("./extensions.router")),
      safeImport("workflows", () => import("./workflows.router")),
      safeImport("project-shell", () => import("./shell.router")),
      safeImport("mcp-servers", () => import("./mcp-servers.router")),
      safeImport("networking", () => import("./networking.router")),
      safeImport("video", () => import("./video.router")),
      safeImport("sync", () => import("./sync")),
      safeImport("background-tests", () => import("./background-tests.router")),
      safeImport("max-autonomy", () => import("./max-autonomy.router")),
      safeImport("bounties", () => import("./bounties.router")),
      safeImport("effort", () => import("./effort.router")),
      safeImport("analytics", () => import("./analytics.router")),
      safeImport("sendgrid-webhooks", () => import("./webhooks-sendgrid.router")),
      safeImport("public-forms", () => import("./public-forms.router")),
      safeImport("status", () => import("./status.router")),
      safeImport("runner-workspaces", () => import("./runner-workspaces.router")),
      safeImport("project-auth", () => import("./project-auth.router")),
    ]);

    mount(app, '/api', def(placeholderMod));
    mount(app, '/api', def(logsMod));
    if (authCompleteMod) mount(app, '/api/auth', tierRateLimiters.auth, (authCompleteMod as any).authCompleteRouter);
    if (twoFactorMod) mount(app, '/api/2fa', tierRateLimiters.auth, def(twoFactorMod));
    if (agentPrefsMod) mount(app, '/api/agent', tierRateLimiters.api, def(agentPrefsMod)(this.storage));
    if (agentToolsMod) mount(app, '/api/agent', tierRateLimiters.api, def(agentToolsMod)());
    if (agentPlanMod) mount(app, '/api/agent/plan', tierRateLimiters.streaming, def(agentPlanMod)(this.storage));
    if (agentBuildMod) mount(app, '/api/agent/build', tierRateLimiters.streaming, def(agentBuildMod)(this.storage));
    mount(app, '/api/agent', tierRateLimiters.streaming, def(agentAutonomousMod));
    mount(app, '/api/agent', tierRateLimiters.api, def(agentWorkflowMod));
    mount(app, '/api/agent', tierRateLimiters.streaming, def(agentMod));
    mount(app, '/api/agent/step-cache', tierRateLimiters.api, def(agentStepCacheMod));
    mount(app, '/api/admin/agent', tierRateLimiters.api, def(agentTestingMod));
    mount(app, '/api', tierRateLimiters.api, def(testAgentMod));
    mount(app, '/api/agent-grid', tierRateLimiters.api, def(agentGridMod));
    mount(app, '/api/collaboration', tierRateLimiters.api, def(collaborationMod));
    mount(app, '/api', tierRateLimiters.api, def(deploymentMod));
    mount(app, '/api', tierRateLimiters.api, def(rollbackMod));
    mount(app, '/api/upload', tierRateLimiters.api, def(fileUploadMod));
    mount(app, '/api/notifications', tierRateLimiters.api, def(notificationsMod));
    mount(app, '/api/preview', tierRateLimiters.api, def(previewMod));
    mount(app, '/api/shell', tierRateLimiters.api, def(shellMod));
    mount(app, '/api/containers', tierRateLimiters.api, def(containersMod));
    mount(app, '/api/scalability', tierRateLimiters.api, def(scalabilityMod));
    mount(app, '/api', tierRateLimiters.api, def(resourcesMod));
    mount(app, '/api/marketplace', tierRateLimiters.api, def(marketplaceMod));
    mount(app, '/api/community', tierRateLimiters.api, def(communityMod));
    mount(app, '/api/teams', tierRateLimiters.api, def(teamsMod));
    mount(app, '/api', tierRateLimiters.api, def(polyglotMod));
    mount(app, '/api/admin', tierRateLimiters.api, def(adminMod));
    mount(app, '/api/admin/monitoring', tierRateLimiters.api, def(adminMonitoringMod));
    mount(app, '/api/admin/system', tierRateLimiters.api, def(adminSystemMod));
    mount(app, '/api/admin/billing', tierRateLimiters.api, def(adminBillingMod));
    mount(app, '/api/admin/seo', tierRateLimiters.api, def(seoMod));

    app.get('/api/system/status', async (req, res) => {
      const runnerHealth = await import('../runnerClient').then(m => m.pingRunner()).catch(() => ({ online: false }));
      res.json({ platform: 'online', runner: runnerHealth, timestamp: new Date().toISOString() });
    });

    mount(app, '/api/metrics/generation', tierRateLimiters.api, def(generationMetricsMod));

    const aiR = def(aiMod);
    if (aiR) {
      mount(app, '/api', tierRateLimiters.api, aiR);
      mount(app, '/api/ai', tierRateLimiters.api, aiR);
    }

    const aiUR = def(aiUsageMod);
    if (aiUR) {
      mount(app, '/api/usage', tierRateLimiters.api, aiUR);
      mount(app, '/api/ai/usage', tierRateLimiters.api, aiUR);
      mount(app, '/api/admin/ai-usage', tierRateLimiters.api, aiUR);
    }

    const aiMR = def(aiModelsMod);
    if (aiMR) {
      mount(app, '/api/models', tierRateLimiters.api, aiMR);
      mount(app, '/api/ai/models', tierRateLimiters.api, aiMR);
    }

    mount(app, '/api/rag', tierRateLimiters.api, def(ragMod));
    mount(app, '/api/memory-bank', tierRateLimiters.api, def(memoryBankMod));
    mount(app, '/api', tierRateLimiters.api, def(unifiedCheckpointsMod));
    mount(app, '/api/ai/health', tierRateLimiters.api, def(aiHealthMod));
    mount(app, '/api/code-generation', tierRateLimiters.streaming, def(codeGenMod));
    mount(app, '/api', tierRateLimiters.api, def(featureFlagsMod));
    mount(app, '/api', tierRateLimiters.streaming, def(aiStreamingMod));
    mount(app, '/api/voice-video', tierRateLimiters.api, def(voiceVideoMod));
    mount(app, '/api/voice', tierRateLimiters.api, def(voiceTranscribeMod));
    mount(app, '/api/data-provisioning', tierRateLimiters.api, def(dataProvisioningMod));
    mount(app, '/api', tierRateLimiters.api, def(terminalMod));
    mount(app, '/api/terminal', tierRateLimiters.api, def(terminalMetricsMod));
    mount(app, '/api', tierRateLimiters.api, def(runtimeMod));

    if (packagesMod) {
      mount(app, '/api/packages', tierRateLimiters.api, def(packagesMod));
      if ((packagesMod as any).projectPackagesRouter) {
        mount(app, '/api/projects', tierRateLimiters.api, (packagesMod as any).projectPackagesRouter);
      }
    }

    mount(app, '/api/code-review', tierRateLimiters.api, def(codeReviewMod));

    if (workspaceMod) {
      const wsCreate = (workspaceMod as any).createWorkspaceRoutes;
      if (wsCreate) mount(app, '/api/workspace', tierRateLimiters.api, wsCreate(this.storage));
    }
    mount(app, '/api/workspace', tierRateLimiters.api, def(workspaceBootstrapMod));

    if (mobileMod) mount(app, '/api', tierRateLimiters.api, (mobileMod as any).mobileRouter);
    mount(app, '/api/mobile', tierRateLimiters.api, def(mobileSessionsMod));
    mount(app, '/api/mobile', tierRateLimiters.api, def(mobileBuildsMod));
    if (expoSnackMod) mount(app, '/api/expo-snack', tierRateLimiters.api, (expoSnackMod as any).expoSnackRouter);

    mount(app, '/api/git', tierRateLimiters.api, def(gitProjectMod));
    if (gitMod) mount(app, '/api/git', tierRateLimiters.api, (gitMod as any).GitRouter);
    mount(app, '/api/debug', tierRateLimiters.api, def(debugMod));
    const dbR = def(databaseMod);
    if (dbR) {
      mount(app, '/api/admin/database', tierRateLimiters.api, dbR);
      mount(app, '/api/database', tierRateLimiters.api, dbR);
    }
    if (replitdbMod) mount(app, '/api/db', (replitdbMod as any).replitdbRouter);
    mount(app, '/api/kv-store', tierRateLimiters.api, def(kvStoreMod));
    mount(app, '/api/projects', tierRateLimiters.api, def(projectDataMod));
    mount(app, '/api/search', tierRateLimiters.api, def(globalSearchMod));
    mount(app, '/api/projects', tierRateLimiters.api, def(projectSearchMod));
    mount(app, '/api/logs', tierRateLimiters.api, def(logsViewerMod));
    mount(app, '/api/env-vars', tierRateLimiters.api, def(envVarsMod));
    mount(app, '/api/projects/:projectId/secrets', tierRateLimiters.api, def(secretsMod));
    mount(app, '/api/projects/:projectId/themes', tierRateLimiters.api, def(themesMod));
    mount(app, '/api/themes', tierRateLimiters.api, def(globalThemesMod));
    mount(app, '/api/projects/:projectId/settings', tierRateLimiters.api, def(settingsMod));
    mount(app, '/api/projects/:projectId/storage', tierRateLimiters.api, def(storageMod));
    mount(app, '/api/extensions', tierRateLimiters.api, def(extensionsMod));
    mount(app, '/api/workflows', tierRateLimiters.api, def(workflowsMod));
    mount(app, '/api/projects', tierRateLimiters.api, def(projectShellMod));
    mount(app, '/api/projects', tierRateLimiters.api, def(mcpServersMod));
    mount(app, '/api/projects', tierRateLimiters.api, def(networkingMod));
    mount(app, '/api/projects', tierRateLimiters.api, def(videoMod));
    mount(app, '/api/sync', tierRateLimiters.api, def(syncMod));
    mount(app, '/api/background-tests', tierRateLimiters.api, def(bgTestsMod));
    mount(app, '/api/autonomy', tierRateLimiters.streaming, def(maxAutonomyMod));
    if (bountiesMod) mount(app, '/api/bounties', tierRateLimiters.api, (bountiesMod as any).bountiesRouter);
    mount(app, '/api/effort', tierRateLimiters.api, def(effortMod));
    mount(app, '/api', tierRateLimiters.api, def(analyticsMod));
    mount(app, '/api/webhooks', def(sendgridMod));
    mount(app, '/api', def(publicFormsMod));
    mount(app, '/api', def(statusMod));
    mount(app, '/api/runner', tierRateLimiters.api, def(runnerMod));
    mount(app, '/api/workspaces', tierRateLimiters.api, def(workspacesMod));
    mount(app, '/api/project-auth', tierRateLimiters.api, def(projectAuthMod));

    setupPreviewRoutes(app);

    console.log(`[routes] Loaded ${loadedCount} routers, ${failedCount} failed${failedRouters.length ? ': ' + failedRouters.join(', ') : ''}`);
  }

  getRouters() {
    return {};
  }
}
