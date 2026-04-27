/**
 * RBAC invite endpoints (JWT-based) and project role helpers.
 *
 * New surface area:
 *   GET  /api/projects/:id/my-role        — caller's role on a project
 *   GET  /api/me/shared-projects          — projects where caller is a collaborator (not owner)
 *   GET  /api/projects/:id/invites        — list pending invites (owner only)
 *   POST /api/projects/:id/invites        — create invite + send email (owner only)
 *   GET  /api/invites/:token              — decode JWT, return invite details (unauthenticated)
 *   POST /api/invites/:token/accept       — accept JWT invite → add to project_collaborators
 *   DELETE /api/projects/:id/invites/:iid — cancel pending invite (owner only)
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { sendProjectInviteEmail } from "../email";

const INVITE_SECRET =
  process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || "dev-invite-secret-change-in-prod";

function signInviteToken(inviteId: string, projectId: string): string {
  return jwt.sign({ sub: inviteId, pid: projectId }, INVITE_SECRET, { expiresIn: "7d" });
}

function verifyInviteToken(token: string): { sub: string; pid: string } | null {
  try {
    return jwt.verify(token, INVITE_SECRET) as { sub: string; pid: string };
  } catch {
    return null;
  }
}

const inviteBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]).default("viewer"),
});

export async function registerRbacInviteRoutes(app: Express, ctx: any): Promise<void> {
  const { requireAuth } = ctx;

  // GET /api/projects/:id/my-role
  app.get("/api/projects/:id/my-role", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.session.userId!);
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      if (String(project.userId) === userId) {
        return res.json({ role: "owner", projectId: project.id });
      }

      const collaborators = await storage.getProjectCollaborators(project.id);
      const collab = collaborators.find((c) => String(c.userId) === userId);
      if (collab) return res.json({ role: collab.role, projectId: project.id });

      const user = await storage.getUser(userId);
      if (user) {
        const accepted = await storage.getAcceptedInviteForProject(project.id, user.email.toLowerCase());
        if (accepted) return res.json({ role: accepted.role, projectId: project.id });
      }

      if (project.visibility === "public" || (project as any).isPublic) {
        return res.json({ role: "viewer", projectId: project.id });
      }

      return res.status(403).json({ message: "No access" });
    } catch {
      return res.status(500).json({ message: "Failed to get role" });
    }
  });

  // GET /api/me/shared-projects
  app.get("/api/me/shared-projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.session.userId!);
      const shared = await storage.getCollaborationsForUser(userId);
      return res.json(shared);
    } catch {
      return res.status(500).json({ message: "Failed to fetch shared projects" });
    }
  });

  // GET /api/projects/:id/invites
  app.get("/api/projects/:id/invites", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.session.userId!);
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== userId) {
        return res.status(403).json({ message: "Access denied — owner only" });
      }
      const invites = await storage.getProjectInvites(project.id);
      return res.json(invites);
    } catch {
      return res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  // POST /api/projects/:id/invites
  app.post("/api/projects/:id/invites", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.session.userId!);
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== userId) {
        return res.status(403).json({ message: "Access denied — owner only" });
      }

      const { email, role } = inviteBodySchema.parse(req.body);

      const existing = await storage.getProjectInvites(project.id);
      const alreadyPending = existing.find(
        (i) => i.email.toLowerCase() === email.toLowerCase() && i.status === "pending",
      );
      if (alreadyPending) {
        return res.status(409).json({ message: "A pending invite already exists for this email" });
      }

      const invite = await storage.createProjectInvite({
        projectId: project.id,
        email: email.toLowerCase(),
        role,
        invitedBy: userId,
        status: "pending",
      });

      const token = signInviteToken(invite.id, project.id);
      const inviter = await storage.getUser(userId);
      const inviterName = inviter?.displayName || inviter?.email || "Someone";

      let emailSent = false;
      try {
        emailSent = await sendProjectInviteEmail(email, project.name, inviterName, role, token);
      } catch (emailErr: any) {
        console.warn(`[rbac-invites] Failed to send invite email: ${emailErr.message}`);
      }

      return res.status(201).json({ ...invite, token, emailSent });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // GET /api/invites/:token  (no auth required — used to preview invite before login)
  app.get("/api/invites/:token", async (req: Request, res: Response) => {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) return res.status(400).json({ message: "Invalid or expired invite token" });

    try {
      const invite = await storage.getProjectInviteByIdAndProject(payload.sub, payload.pid);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") {
        return res.status(410).json({ message: "Invite already used or cancelled" });
      }

      const project = await storage.getProject(invite.projectId);
      const inviter = await storage.getUser(invite.invitedBy);

      return res.json({
        inviteId: invite.id,
        projectId: invite.projectId,
        projectName: project?.name ?? "Unknown project",
        email: invite.email,
        role: invite.role,
        inviterEmail: inviter?.email ?? "Unknown",
        inviterName: inviter?.displayName ?? inviter?.email ?? "Unknown",
      });
    } catch {
      return res.status(500).json({ message: "Failed to look up invite" });
    }
  });

  // POST /api/invites/:token/accept
  app.post("/api/invites/:token/accept", requireAuth, async (req: Request, res: Response) => {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) return res.status(400).json({ message: "Invalid or expired invite token" });

    try {
      const userId = String(req.session.userId!);
      const invite = await storage.getProjectInviteByIdAndProject(payload.sub, payload.pid);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") {
        return res.status(410).json({ message: "Invite already used or cancelled" });
      }

      await storage.updateProjectInvite(invite.id, invite.projectId, { status: "accepted" });

      const collab = await storage.addProjectCollaborator({
        projectId: invite.projectId,
        userId,
        role: invite.role,
        addedBy: invite.invitedBy,
      });

      const project = await storage.getProject(invite.projectId);
      return res.json({
        projectId: invite.projectId,
        projectName: project?.name,
        role: invite.role,
        collaborator: collab,
      });
    } catch {
      return res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  // DELETE /api/projects/:id/invites/:inviteId
  app.delete("/api/projects/:id/invites/:inviteId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.session.userId!);
      const project = await storage.getProject(req.params.id);
      if (!project || String(project.userId) !== userId) {
        return res.status(403).json({ message: "Access denied — owner only" });
      }
      const deleted = await storage.deleteProjectInvite(req.params.inviteId, project.id);
      if (!deleted) return res.status(404).json({ message: "Invite not found" });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Failed to delete invite" });
    }
  });
}
