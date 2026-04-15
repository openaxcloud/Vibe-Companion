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
      authMod,
      projectsMod,
      filesMod,
      usersMod,
      healthMod,
      chatgptMod,
      loadTestMod,
      csrfMod,
      tierMod,
      aiTrackerMod,
      versionMod,
      promMod,
      previewSvcMod,
    ] = await Promise.all([
      safeImport("auth.router", () => import("./auth.router")),
      safeImport("projects.router", () => import("./projects.router")),
      safeImport("files.router", () => import("./files.router")),
      safeImport("users.router", () => import("./users.router")),
      safeImport("health.router", () => import("./health.router")),
      safeImport("chatgpt.router", () => import("./chatgpt.router")),
      safeImport("load-testing.router", () => import("./load-testing.router")),
      safeImport("csrf", () => import("../middleware/csrf")),
      safeImport("tier-rate-limiter", () => import("../middleware/tier-rate-limiter")),
      safeImport("ai-usage-tracker", () => import("../middleware/ai-usage-tracker")),
      safeImport("api-versioning", () => import("../middleware/api-versioning")),
      safeImport("prometheus", () => import("../monitoring/prometheus")),
      safeImport("preview-service", () => import("../preview/preview-service")),
    ]);

    const noop: RequestHandler = (_req, _res, next) => next();
    const noopTiers = { api: noop, ai: noop, agent: noop, auth: noop, streaming: noop };

    if (healthMod) app.use('/api', new healthMod.HealthRouter(this.storage).getRouter());
    if (promMod) app.use('/api', (promMod as any).prometheusRouter);
    if (loadTestMod) app.use('/api', new loadTestMod.LoadTestingRouter(this.storage).getRouter());
    if (csrfMod) {
      app.get('/api/csrf-token', csrfMod.csrfTokenEndpoint);
      app.get('/api/auth/csrf-token', csrfMod.csrfTokenEndpoint);
    }
    if (versionMod) {
      app.use('/api', (versionMod as any).apiVersionMiddleware);
      app.use('/api', (versionMod as any).rejectUnsupportedVersions);
    }
    if (authMod) app.use('/api', new authMod.AuthRouter(this.storage).getRouter());

    const tierLimiters = tierMod ? (tierMod as any).tierRateLimiters : noopTiers;
    if (usersMod) {
      const ur = new usersMod.UsersRouter(this.storage).getRouter();
      app.use('/api/users', tierLimiters.api, ur);
      app.use('/api/user', tierLimiters.api, ur);
    }
    if (projectsMod) app.use('/api/projects', tierLimiters.api, new projectsMod.ProjectsRouter(this.storage).getRouter());
    if (filesMod) app.use('/api/projects', tierLimiters.api, new filesMod.FilesRouter(this.storage).getRouter());
    if (chatgptMod) app.use('/api', tierLimiters.api, new chatgptMod.ChatGPTRouter(this.storage).getRouter());

    const aiTracker = aiTrackerMod ? (aiTrackerMod as any).aiUsageTracker : noop;
    app.use('/api/agent', aiTracker);
    app.use('/api/admin/agent', aiTracker);
    app.use('/api/ai', aiTracker);

    const setupPreviewRoutes = previewSvcMod ? (previewSvcMod as any).setupPreviewRoutes : null;

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
      projectTasksMod,
      phantomPanelsMod,
      publishMod,
      sshInfoMod,
      automationsMod,
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
      safeImport("checkpoints", () => import("./checkpoints.router")),
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
      safeImport("project-tasks", () => import("./project-tasks.router")),
      safeImport("phantom-panels", () => import("./phantom-panels.router")),
      safeImport("publish", () => import("./publish.router")),
      safeImport("ssh-info", () => import("./ssh-info.router")),
      safeImport("automations", () => import("./automations.router")),
    ]);

    const [paymentsMod] = await Promise.all([
      safeImport("payments", () => import("./payments.router")),
    ]);

    const [openhandsMod, gooseMod, agentProvidersMod, claudeAgentMod] = await Promise.all([
      safeImport("openhands", () => import("./openhands.router")),
      safeImport("goose", () => import("./goose.router")),
      safeImport("agent-providers", () => import("./agent-providers.router")),
      safeImport("claude-agent", () => import("./claude-agent.router")),
    ]);

    mount(app, '/api', def(placeholderMod));
    mount(app, '/api', def(logsMod));
    if (authCompleteMod) mount(app, '/api/auth', tierLimiters.auth, (authCompleteMod as any).authCompleteRouter);
    if (twoFactorMod) mount(app, '/api/2fa', tierLimiters.auth, def(twoFactorMod));
    if (agentPrefsMod) mount(app, '/api/agent', tierLimiters.api, def(agentPrefsMod)(this.storage));
    if (agentToolsMod) mount(app, '/api/agent', tierLimiters.api, def(agentToolsMod)());
    if (agentPlanMod) mount(app, '/api/agent/plan', tierLimiters.streaming, def(agentPlanMod)(this.storage));
    if (agentBuildMod) mount(app, '/api/agent/build', tierLimiters.streaming, def(agentBuildMod)(this.storage));
    mount(app, '/api/agent', tierLimiters.streaming, def(agentAutonomousMod));
    mount(app, '/api/agent', tierLimiters.api, def(agentWorkflowMod));
    mount(app, '/api/agent', tierLimiters.streaming, def(agentMod));
    mount(app, '/api/agent/step-cache', tierLimiters.api, def(agentStepCacheMod));
    mount(app, '/api/admin/agent', tierLimiters.api, def(agentTestingMod));
    mount(app, '/api', tierLimiters.api, def(testAgentMod));
    mount(app, '/api/agent-grid', tierLimiters.api, def(agentGridMod));
    mount(app, '/api/collaboration', tierLimiters.api, def(collaborationMod));
    mount(app, '/api', tierLimiters.api, def(deploymentMod));
    mount(app, '/api', tierLimiters.api, def(rollbackMod));
    mount(app, '/api/upload', tierLimiters.api, def(fileUploadMod));
    mount(app, '/api/notifications', tierLimiters.api, def(notificationsMod));
    mount(app, '/api/preview', tierLimiters.api, def(previewMod));
    mount(app, '/api/shell', tierLimiters.api, def(shellMod));
    mount(app, '/api/containers', tierLimiters.api, def(containersMod));
    mount(app, '/api/scalability', tierLimiters.api, def(scalabilityMod));
    mount(app, '/api', tierLimiters.api, def(resourcesMod));
    mount(app, '/api/marketplace', tierLimiters.api, def(marketplaceMod));
    mount(app, '/api/community', tierLimiters.api, def(communityMod));
    mount(app, '/api/teams', tierLimiters.api, def(teamsMod));
    mount(app, '/api', tierLimiters.api, def(polyglotMod));
    mount(app, '/api/admin', tierLimiters.api, def(adminMod));
    mount(app, '/api/admin/monitoring', tierLimiters.api, def(adminMonitoringMod));
    mount(app, '/api/admin/system', tierLimiters.api, def(adminSystemMod));
    mount(app, '/api/admin/billing', tierLimiters.api, def(adminBillingMod));
    mount(app, '/api/admin/seo', tierLimiters.api, def(seoMod));

    app.get('/api/system/status', async (req, res) => {
      const runnerHealth = await import('../runnerClient').then(m => m.pingRunner()).catch(() => ({ online: false }));
      res.json({ platform: 'online', runner: runnerHealth, timestamp: new Date().toISOString() });
    });

    mount(app, '/api/metrics/generation', tierLimiters.api, def(generationMetricsMod));

    const aiR = def(aiMod);
    if (aiR) {
      mount(app, '/api', tierLimiters.api, aiR);
      mount(app, '/api/ai', tierLimiters.api, aiR);
    }

    const aiUR = def(aiUsageMod);
    if (aiUR) {
      mount(app, '/api/usage', tierLimiters.api, aiUR);
      mount(app, '/api/ai/usage', tierLimiters.api, aiUR);
      mount(app, '/api/admin/ai-usage', tierLimiters.api, aiUR);
    }

    const aiMR = def(aiModelsMod);
    if (aiMR) {
      mount(app, '/api/models', tierLimiters.api, aiMR);
      mount(app, '/api/ai/models', tierLimiters.api, aiMR);
    }

    mount(app, '/api/rag', tierLimiters.api, def(ragMod));
    mount(app, '/api/memory-bank', tierLimiters.api, def(memoryBankMod));
    mount(app, '/api', tierLimiters.api, def(unifiedCheckpointsMod));
    mount(app, '/api/ai/health', tierLimiters.api, def(aiHealthMod));
    mount(app, '/api/code-generation', tierLimiters.streaming, def(codeGenMod));
    mount(app, '/api', tierLimiters.api, def(featureFlagsMod));
    mount(app, '/api', tierLimiters.streaming, def(aiStreamingMod));
    mount(app, '/api/voice-video', tierLimiters.api, def(voiceVideoMod));
    mount(app, '/api/voice', tierLimiters.api, def(voiceTranscribeMod));
    mount(app, '/api/data-provisioning', tierLimiters.api, def(dataProvisioningMod));
    mount(app, '/api', tierLimiters.api, def(terminalMod));
    mount(app, '/api/terminal', tierLimiters.api, def(terminalMetricsMod));
    mount(app, '/api', tierLimiters.api, def(runtimeMod));

    if (packagesMod) {
      mount(app, '/api/packages', tierLimiters.api, def(packagesMod));
      if ((packagesMod as any).projectPackagesRouter) {
        mount(app, '/api/projects', tierLimiters.api, (packagesMod as any).projectPackagesRouter);
      }
    }

    mount(app, '/api/code-review', tierLimiters.api, def(codeReviewMod));

    if (workspaceMod) {
      const wsCreate = (workspaceMod as any).createWorkspaceRoutes;
      if (wsCreate) mount(app, '/api/workspace', tierLimiters.api, wsCreate(this.storage));
    }
    mount(app, '/api/workspace', tierLimiters.api, def(workspaceBootstrapMod));

    if (mobileMod) mount(app, '/api', tierLimiters.api, (mobileMod as any).mobileRouter);
    mount(app, '/api/mobile', tierLimiters.api, def(mobileSessionsMod));
    mount(app, '/api/mobile', tierLimiters.api, def(mobileBuildsMod));
    if (expoSnackMod) mount(app, '/api/expo-snack', tierLimiters.api, (expoSnackMod as any).expoSnackRouter);

    mount(app, '/api/git', tierLimiters.api, def(gitProjectMod));
    if (gitMod) mount(app, '/api/git', tierLimiters.api, (gitMod as any).GitRouter);
    mount(app, '/api/debug', tierLimiters.api, def(debugMod));
    const dbR = def(databaseMod);
    if (dbR) {
      mount(app, '/api/admin/database', tierLimiters.api, dbR);
      mount(app, '/api/database', tierLimiters.api, dbR);
    }
    if (replitdbMod) mount(app, '/api/db', (replitdbMod as any).replitdbRouter);
    mount(app, '/api/kv-store', tierLimiters.api, def(kvStoreMod));
    mount(app, '/api/projects', tierLimiters.api, def(projectDataMod));
    mount(app, '/api/search', tierLimiters.api, def(globalSearchMod));
    mount(app, '/api/projects', tierLimiters.api, def(projectSearchMod));
    mount(app, '/api/logs', tierLimiters.api, def(logsViewerMod));
    mount(app, '/api/env-vars', tierLimiters.api, def(envVarsMod));
    mount(app, '/api/projects/:projectId/secrets', tierLimiters.api, def(secretsMod));
    mount(app, '/api/projects/:projectId/themes', tierLimiters.api, def(themesMod));
    mount(app, '/api/themes', tierLimiters.api, def(globalThemesMod));
    mount(app, '/api/projects/:projectId/settings', tierLimiters.api, def(settingsMod));
    mount(app, '/api/projects/:projectId/storage', tierLimiters.api, def(storageMod));
    mount(app, '/api/extensions', tierLimiters.api, def(extensionsMod));
    mount(app, '/api/workflows', tierLimiters.api, def(workflowsMod));
    mount(app, '/api/projects', tierLimiters.api, def(projectShellMod));
    mount(app, '/api/projects', tierLimiters.api, def(mcpServersMod));
    mount(app, '/api/projects', tierLimiters.api, def(networkingMod));
    mount(app, '/api/projects', tierLimiters.api, def(videoMod));
    mount(app, '/api/sync', tierLimiters.api, def(syncMod));
    mount(app, '/api/background-tests', tierLimiters.api, def(bgTestsMod));
    mount(app, '/api/autonomy', tierLimiters.streaming, def(maxAutonomyMod));
    if (bountiesMod) mount(app, '/api/bounties', tierLimiters.api, (bountiesMod as any).bountiesRouter);
    mount(app, '/api/effort', tierLimiters.api, def(effortMod));
    mount(app, '/api', tierLimiters.api, def(analyticsMod));
    mount(app, '/api/webhooks', def(sendgridMod));
    mount(app, '/api', def(publicFormsMod));
    mount(app, '/api', def(statusMod));
    mount(app, '/api/runner', tierLimiters.api, def(runnerMod));
    mount(app, '/api/workspaces', tierLimiters.api, def(workspacesMod));
    mount(app, '/api/project-auth', tierLimiters.api, def(projectAuthMod));
    mount(app, '/api/projects', tierLimiters.api, def(projectTasksMod));
    mount(app, '/api', tierLimiters.api, def(phantomPanelsMod));
    mount(app, '/api', tierLimiters.api, def(publishMod));
    mount(app, '/api', tierLimiters.api, def(sshInfoMod));
    mount(app, '/api', tierLimiters.api, def(automationsMod));
    mount(app, '/api/payments', tierLimiters.api, def(paymentsMod));

    mount(app, '/api/openhands', tierLimiters.api, def(openhandsMod));
    mount(app, '/api/goose', tierLimiters.api, def(gooseMod));
    mount(app, '/api/agent-providers', tierLimiters.api, def(agentProvidersMod));
    mount(app, '/api', tierLimiters.streaming, def(claudeAgentMod));

    if (setupPreviewRoutes) setupPreviewRoutes(app);

    console.log(`[routes] Loaded ${loadedCount} routers, ${failedCount} failed${failedRouters.length ? ': ' + failedRouters.join(', ') : ''}`);
  }

  getRouters() {
    return {};
  }
}
