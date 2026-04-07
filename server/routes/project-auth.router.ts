import { Router } from "express";
import { storage } from "../storage";
import { ensureAuthenticated } from "../middleware/auth";

const router = Router();

router.get("/:projectId/config", ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    if (!projectId) return res.status(400).json({ error: "Invalid project ID" });

    const config = await storage.getProjectAuthConfig(projectId as any);
    res.json(config || {
      projectId,
      enabled: false,
      providers: ["email"],
      allowedDomains: [],
      requireVerifiedEmail: false,
      loginRedirectUrl: null,
    });
  } catch (err) {
    console.error('[project-auth] GET config error:', err);
    res.status(500).json({ error: "Failed to fetch auth config" });
  }
});

router.put("/:projectId/config", ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    if (!projectId) return res.status(400).json({ error: "Invalid project ID" });

    const { enabled, providers, allowedDomains, requireVerifiedEmail } = req.body;
    const config = await storage.upsertProjectAuthConfig(projectId as any, {
      enabled,
      providers,
      allowedDomains,
      requireEmailVerification: requireVerifiedEmail,
    });
    res.json(config);
  } catch (err) {
    console.error('[project-auth] PUT config error:', err);
    res.status(500).json({ error: "Failed to update auth config" });
  }
});

router.get("/:projectId/users", ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    if (!projectId) return res.status(400).json({ error: "Invalid project ID" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const users = await storage.getProjectAuthUsers(projectId as any, limit);
    res.json({ users, total: users.length });
  } catch (err) {
    console.error('[project-auth] GET users error:', err);
    res.status(500).json({ error: "Failed to fetch auth users" });
  }
});

router.delete("/:projectId/users/:userId", ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.params.userId;
    if (!projectId || !userId) return res.status(400).json({ error: "Invalid ID" });

    const deleted = await storage.deleteProjectAuthUser(projectId as any, userId as any);
    res.json({ success: deleted });
  } catch (err) {
    console.error('[project-auth] DELETE user error:', err);
    res.status(500).json({ error: "Failed to delete auth user" });
  }
});

export default router;
