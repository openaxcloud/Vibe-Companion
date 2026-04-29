/**
 * JWT-token-based invite acceptance flow.
 *
 * The invite token is a signed JWT issued by invites.router.ts.  It carries
 * { inviteId, projectId, email, role } so the DB row is looked up by id,
 * and the email in the token is cross-checked against the logged-in user to
 * prevent token theft.
 */
import { Router } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { ensureAuthenticated } from "../middleware/auth";

const router = Router();

function getJwtSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev-invite-secret";
}

interface InviteTokenPayload {
  inviteId: string;
  projectId: string;
  email: string;
  role: string;
}

function verifyInviteToken(token: string): InviteTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as InviteTokenPayload;
  } catch {
    return null;
  }
}

// GET /api/invites/by-token/:token — public, returns invite preview (no auth required)
router.get("/by-token/:token", async (req, res) => {
  const payload = verifyInviteToken(req.params.token);
  if (!payload) return res.status(410).json({ message: "Invalid or expired invite token" });

  const invite = await storage.getProjectInviteByIdAndProject(payload.inviteId, payload.projectId).catch(() => undefined);
  if (!invite) return res.status(404).json({ message: "Invite not found" });
  if (invite.status !== "pending") return res.status(410).json({ message: "Invite has already been used or revoked" });

  const project = await storage.getProject(payload.projectId);
  const inviter = await storage.getUser(invite.invitedBy);
  return res.json({
    projectId: payload.projectId,
    projectName: project?.name ?? "Unknown project",
    role: payload.role,
    inviterName: inviter?.displayName || inviter?.email || "Someone",
    email: payload.email,
  });
});

// POST /api/invites/by-token/:token/accept — authenticated, adds to project_collaborators
router.post("/by-token/:token/accept", ensureAuthenticated, async (req, res) => {
  const payload = verifyInviteToken(req.params.token);
  if (!payload) return res.status(410).json({ message: "Invalid or expired invite token" });

  const user = await storage.getUser(String((req.session as any).userId));
  if (!user) return res.status(401).json({ message: "Not authenticated" });

  // Cross-check email to prevent token theft
  if (user.email.toLowerCase() !== payload.email.toLowerCase()) {
    return res.status(403).json({ message: "This invite was sent to a different email address" });
  }

  const invite = await storage.getProjectInviteByIdAndProject(payload.inviteId, payload.projectId).catch(() => undefined);
  if (!invite) return res.status(404).json({ message: "Invite not found" });
  if (invite.status !== "pending") {
    // Idempotent: already accepted — just redirect
    const project = await storage.getProject(payload.projectId);
    return res.json({ projectId: payload.projectId, projectName: project?.name, role: invite.role, alreadyAccepted: true });
  }

  const project = await storage.getProject(payload.projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  // Prevent double-add if user is already owner or collaborator
  if (String(project.userId) !== String(user.id)) {
    const collaborators = await storage.getProjectCollaborators(payload.projectId);
    const alreadyCollab = collaborators.some(c => String(c.userId) === String(user.id));
    if (!alreadyCollab) {
      await storage.addProjectCollaborator({
        projectId: payload.projectId,
        userId: String(user.id),
        role: payload.role as "editor" | "viewer",
        addedBy: invite.invitedBy,
      });
    }
  }

  // Mark invite accepted
  await storage.updateProjectInvite(invite.id, invite.projectId, { status: "accepted" });

  return res.json({ projectId: payload.projectId, projectName: project.name, role: payload.role });
});

export const inviteTokenRouter = router;
