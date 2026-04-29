import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "../storage";
import { sendProjectInviteEmail } from "../email";
import { ensureAuthenticated } from "../middleware/auth";

const router = Router();

const VALID_ROLES = ["owner", "editor", "viewer"] as const;
type CollabRole = typeof VALID_ROLES[number];

function getJwtSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev-invite-secret";
}

interface InviteTokenPayload {
  inviteId: string;
  projectId: string;
  email: string;
  role: string;
}

function signInviteToken(payload: InviteTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function verifyInviteToken(token: string): InviteTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as InviteTokenPayload;
  } catch {
    return null;
  }
}

// POST /api/projects/:id/invites — owner only, creates JWT-signed per-user invite
router.post("/:id/invites", ensureAuthenticated, async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.userId) !== String((req.session as any).userId)) {
      return res.status(403).json({ message: "Only the project owner can send invites" });
    }

    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(["editor", "viewer"]).default("editor"),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase().trim();

    // Prevent duplicate pending invite
    const existing = await storage.getProjectInvites(project.id);
    if (existing.some(i => i.email === normalizedEmail && i.status === "pending")) {
      return res.status(409).json({ message: "A pending invite already exists for this email" });
    }

    const invite = await storage.createProjectInvite({
      projectId: project.id,
      email: normalizedEmail,
      role,
      invitedBy: String((req.session as any).userId),
    });

    const token = signInviteToken({
      inviteId: invite.id,
      projectId: invite.projectId,
      email: invite.email,
      role: invite.role,
    });

    // Send email
    let emailSent = false;
    try {
      const inviter = await storage.getUser(String((req.session as any).userId));
      const inviterName = inviter?.displayName || inviter?.email || "Someone";
      emailSent = await sendProjectInviteEmail(normalizedEmail, project.name, inviterName, role, token);
    } catch (emailErr: any) {
      console.warn(`[invites] Failed to send invite email: ${emailErr.message}`);
    }

    return res.status(201).json({ ...invite, token, emailSent });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    console.error("[invites] POST /:id/invites error:", err);
    return res.status(500).json({ message: "Failed to create invite" });
  }
});

// GET /api/projects/:id/invites — owner can list pending invites
router.get("/:id/invites", ensureAuthenticated, async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.userId) !== String((req.session as any).userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const invites = await storage.getProjectInvites(project.id);
    return res.json(invites);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch invites" });
  }
});

// DELETE /api/projects/:id/invites/:inviteId — owner can revoke pending invite
router.delete("/:id/invites/:inviteId", ensureAuthenticated, async (req, res) => {
  try {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.userId) !== String((req.session as any).userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const deleted = await storage.deleteProjectInvite(req.params.inviteId, project.id);
    if (!deleted) return res.status(404).json({ message: "Invite not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete invite" });
  }
});

export const invitesRouter = router;
