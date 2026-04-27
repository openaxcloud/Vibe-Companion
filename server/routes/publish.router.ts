import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

router.post('/projects/:id/publish', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.userId!;

    const project = await storage.getProject(projectId);
    if (!project || String(project.userId) !== String(userId)) {
      return res.status(404).json({ message: 'Project not found or not owned' });
    }

    await storage.publishProject(projectId, userId);

    const { deploymentManager } = await import('../services/deployment-manager.js');

    const existingDeployments = await storage.getProjectDeployments(projectId);
    const activeDeployment = existingDeployments.find(
      (d: any) => d.status === 'active' || d.status === 'deployed' || d.status === 'live'
    );

    if (activeDeployment) {
      return res.json({
        success: true,
        deployment: {
          id: activeDeployment.id,
          projectId,
          status: activeDeployment.status,
          url: activeDeployment.url || `https://${project.publishedSlug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.e-code.ai`,
          environment: 'production',
          publishedAt: activeDeployment.createdAt,
        },
      });
    }

    const deployType = req.body.deploymentType || 'autoscale';
    const maxMachines = req.body.maxMachines || 3;

    const deploymentId = await deploymentManager.createDeployment({
      id: `pub-${projectId}-${Date.now()}`,
      projectId,
      userId,
      type: deployType,
      environment: 'production',
      sslEnabled: true,
      regions: [req.body.region || 'us-east-1'],
      customDomain: req.body.customDomain,
      buildCommand: req.body.buildCommand,
      startCommand: req.body.runCommand,
      environmentVars: req.body.environmentVars || {},
      machineConfig: req.body.machineConfig,
      maxMachines,
      scaling: {
        minInstances: deployType === 'autoscale' ? 1 : 0,
        maxInstances: maxMachines,
        targetCPU: 70,
        targetMemory: 80,
      },
    });

    const deployment = await deploymentManager.getDeployment(deploymentId);
    const slug = project.publishedSlug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + String(projectId).slice(0, 8);

    return res.status(201).json({
      success: true,
      deployment: {
        id: deploymentId,
        projectId,
        status: deployment?.status || 'pending',
        url: deployment?.url || `https://${slug}.e-code.ai`,
        environment: 'production',
        publishedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[PUBLISH] Error:', error);
    return res.status(500).json({ message: error.message || 'Failed to publish project' });
  }
});

router.get('/shared/:id', async (req: Request, res: Response) => {
  const project = await storage.getProject(req.params.id);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }
  if (project.visibility === 'private') {
    const userId = req.session?.userId;
    if (!userId) return res.status(403).json({ message: 'This project is private' });
    if (String(project.userId) !== String(userId)) {
      const isGuest = await storage.isProjectGuest(project.id, userId);
      if (!isGuest) {
        if (project.teamId) {
          const teams = await storage.getUserTeams(userId);
          if (!teams.some(t => t.id === project.teamId)) {
            return res.status(403).json({ message: 'This project is private' });
          }
        } else {
          return res.status(403).json({ message: 'This project is private' });
        }
      }
    }
  } else if (project.visibility === 'team') {
    const userId = req.session?.userId;
    if (!userId) return res.status(403).json({ message: 'This project is only visible to team members' });
    if (String(project.userId) !== String(userId) && project.teamId) {
      const teams = await storage.getUserTeams(userId);
      if (!teams.some(t => t.id === project.teamId)) {
        return res.status(403).json({ message: 'This project is only visible to team members' });
      }
    } else if (String(project.userId) !== String(userId)) {
      return res.status(403).json({ message: 'This project is only visible to team members' });
    }
  } else if (project.visibility !== 'public') {
    return res.status(403).json({ message: 'Access denied' });
  }
  storage.incrementProjectViewCount(req.params.id).catch(() => {});
  const fileList = await storage.getFiles(project.id);
  return res.json({ project, files: fileList });
});

router.get('/shared/:id/preview', async (req: Request, res: Response) => {
  const project = await storage.getProject(req.params.id);
  if (!project) return res.status(404).send('Not found');
  if (project.visibility === 'private') {
    const userId = req.session?.userId;
    if (!userId) return res.status(403).send('Private project');
    if (String(project.userId) !== String(userId)) {
      const isGuest = await storage.isProjectGuest(project.id, userId);
      if (!isGuest) {
        if (project.teamId) {
          const teams = await storage.getUserTeams(userId);
          if (!teams.some(t => t.id === project.teamId)) return res.status(403).send('Private project');
        } else {
          return res.status(403).send('Private project');
        }
      }
    }
  }
  const files = await storage.getFiles(project.id);
  const htmlFile = files.find(f => f.filename === 'index.html') || files.find(f => f.filename.endsWith('.html'));
  if (!htmlFile) {
    return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#1C2333;color:#9CA3AF;font-family:system-ui;text-align:center}div{max-width:400px}h2{color:#E5E7EB;font-size:18px;margin-bottom:8px}p{font-size:14px;line-height:1.5}</style></head><body><div><h2>${project.name}</h2><p>This project doesn't have an HTML preview.</p></div></body></html>`);
  }
  let html = htmlFile.content || '';
  const cssFiles = files.filter(f => f.filename.endsWith('.css'));
  const jsFiles = files.filter(f => f.filename.endsWith('.js') && f.id !== htmlFile.id);
  for (const css of cssFiles) {
    const linkTag = `<link rel="stylesheet" href="${css.filename}"`;
    const linkTag2 = `<link href="${css.filename}"`;
    if (!html.includes(linkTag) && !html.includes(linkTag2) && !html.includes(css.filename)) {
      html = html.replace('</head>', `<style>${css.content || ''}</style>\n</head>`);
    } else {
      html = html.replace(new RegExp(`<link[^>]*href=["']${css.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g'), `<style>${css.content || ''}</style>`);
    }
  }
  for (const js of jsFiles) {
    const scriptTag = `<script src="${js.filename}"`;
    if (html.includes(scriptTag) || html.includes(`src="${js.filename}"`)) {
      html = html.replace(new RegExp(`<script[^>]*src=["']${js.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, 'g'), `<script>${js.content || ''}</script>`);
    }
  }
  const imgFiles = files.filter(f => /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f.filename));
  for (const img of imgFiles) {
    if (img.content && img.content.startsWith('data:')) {
      html = html.replace(new RegExp(`(src|href)=["']${img.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'), `$1="${img.content}"`);
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  return res.send(html);
});

export default router;
