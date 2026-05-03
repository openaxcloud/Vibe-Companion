// Shared preview action contract used by both HTTP routes (server/routes/preview.ts)
// and agent tools (AgentToolFrameworkService). Changes to preview behaviour flow
// through here so both paths stay in sync.
import type { Project, ProjectCollaborator } from '../../shared/schema';
import { storage } from '../storage';
import { previewEvents } from './preview-websocket';

// Structural subset of PreviewInstance (preview-service.ts) used for serialisation.
interface PreviewSnap {
  status: 'starting' | 'running' | 'stopped' | 'error';
  runId: string;
  ports: number[];
  primaryPort: number;
  frameworkType?: string;
  exposedServices: Array<{ port: number; name: string; path?: string; description?: string }>;
  healthChecks: Map<number, boolean>;
  lastHealthCheck: Date;
  logs: string[];
}

export interface PreviewStatusResult {
  success: boolean;
  status: string;
  message?: string;
  projectId?: string;
  runId?: string | null;
  ports?: number[];
  primaryPort?: number | null;
  services?: Array<{ port: number; name: string; path?: string; description?: string }>;
  healthChecks?: Record<number, boolean>;
  lastHealthCheck?: string | null;
  frameworkType?: string | null;
  previewUrl?: string | null;
  logs?: string[];
  error?: string;
}

export interface PreviewMutationResult {
  success: boolean;
  error?: string;
  status?: string;
  message?: string;
  projectId?: string;
  runId?: string | null;
  ports?: number[];
  primaryPort?: number | null;
  frameworkType?: string | null;
  previewUrl?: string | null;
  port?: number;
  url?: string;
}

export async function verifyProjectAccess(
  projectId: string,
  userId: string
): Promise<string | null> {
  if (!userId) return 'Authentication required';
  const project: Project | undefined = await storage.getProject(projectId);
  if (!project) return `Project not found: ${projectId}`;
  if (String(project.userId) === userId) return null;
  const collaborators: (ProjectCollaborator & Record<string, unknown>)[] =
    await storage.getProjectCollaborators(projectId);
  if (collaborators.some((c) => String(c.userId) === userId)) return null;
  return "You don't have access to this project";
}

function fmtPreviewStatus(preview: PreviewSnap, projectId: string): PreviewStatusResult {
  return {
    success: true,
    status: preview.status,
    projectId,
    runId: preview.runId,
    ports: preview.ports,
    primaryPort: preview.primaryPort,
    services: preview.exposedServices,
    healthChecks: Object.fromEntries(preview.healthChecks) as Record<number, boolean>,
    lastHealthCheck: preview.lastHealthCheck?.toISOString() ?? null,
    frameworkType: preview.frameworkType ?? null,
    previewUrl: preview.status === 'running'
      ? `/api/preview/projects/${projectId}/preview/` : null,
    logs: preview.logs.slice(-50),
  };
}

function fmtPreviewMutation(preview: PreviewSnap, projectId: string): PreviewMutationResult {
  return {
    success: true,
    status: preview.status,
    projectId,
    runId: preview.runId,
    ports: preview.ports,
    primaryPort: preview.primaryPort,
    frameworkType: preview.frameworkType ?? null,
    previewUrl: preview.status === 'running'
      ? `/api/preview/projects/${projectId}/preview/` : null,
  };
}

export async function actionGetStatus(projectId: string): Promise<PreviewStatusResult> {
  const { previewService } = await import('./preview-service');
  const preview = previewService.getPreview(projectId) as PreviewSnap | undefined;
  if (!preview) return { success: true, status: 'stopped', message: 'No preview session found', projectId };
  return fmtPreviewStatus(preview, projectId);
}

export async function actionStart(
  projectId: string,
  userId: string,
  opts?: { port?: number; runId?: string }
): Promise<PreviewMutationResult> {
  const { previewService } = await import('./preview-service');
  const preview = opts?.port
    ? await previewService.startPreview(projectId, { port: opts.port, runId: opts.runId })
    : await previewService.startPreviewFromProject(projectId, userId);
  return fmtPreviewMutation(preview as PreviewSnap, projectId);
}

export async function actionStop(projectId: string): Promise<PreviewMutationResult> {
  const { previewService } = await import('./preview-service');
  await previewService.stopPreview(projectId);
  return { success: true, status: 'stopped', message: 'Preview stopped', projectId };
}

export async function actionSwitchPort(projectId: string, port: number): Promise<PreviewMutationResult> {
  const { previewService } = await import('./preview-service');
  const ok = await previewService.switchPort(projectId, port) as boolean;
  if (ok) {
    const url = previewService.getPreviewUrl(projectId, port) as string;
    return { success: true, port, projectId, url, previewUrl: url };
  }
  return { success: false, error: `Port ${port} is not available or not healthy` };
}

export async function actionReload(projectId: string): Promise<PreviewMutationResult> {
  previewEvents.emit('preview:rebuild', { projectId });
  return { success: true, message: 'Reload event broadcast to all preview subscribers', projectId };
}
