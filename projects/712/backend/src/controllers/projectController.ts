import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import {
  createProject as createProjectService,
  getProjectById,
  getProjectsForUser,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
  addMemberToProject,
  removeMemberFromProject,
  updateProjectMemberRole,
  archiveProject as archiveProjectService,
  restoreProject as restoreProjectService,
} from "../services/projectService";
import { ProjectDocument, ProjectRole, ProjectVisibility } from "../models/Project";
import { UserDocument } from "../models/User";
import { ForbiddenError, NotFoundError, BadRequestError } from "../utils/errors";
import { mapProjectToDTO, ProjectDTO } from "../mappers/projectMapper";

interface AuthenticatedRequest extends Request {
  user?: UserDocument & { id: string };
}

interface CreateProjectBody {
  name: string;
  description?: string;
  visibility?: ProjectVisibility;
  tags?: string[];
}

interface UpdateProjectBody {
  name?: string;
  description?: string;
  visibility?: ProjectVisibility;
  tags?: string[];
}

interface MemberUpdateBody {
  userId: string;
  role: ProjectRole;
}

const assertAuthenticated = (req: AuthenticatedRequest): UserDocument & { id: string } => {
  if (!req.user) {
    throw new ForbiddenError("Authentication required");
  }
  return req.user;
};

const parseObjectId = (id: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestError(`Invalid undefined`);
  }
  return new Types.ObjectId(id);
};

const ensureProjectAccess = (project: ProjectDocument | null, userId: string): ProjectDocument => {
  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const member = project.members.find((m) => m.user.toString() === userId);
  const isOwner = project.owner.toString() === userId;

  if (!isOwner && !member) {
    throw new ForbiddenError("You do not have access to this project");
  }

  return project;
};

const ensureProjectAdmin = (project: ProjectDocument, userId: string): void => {
  const isOwner = project.owner.toString() === userId;
  const member = project.members.find((m) => m.user.toString() === userId);

  if (!isOwner && member?.role !== "admin") {
    throw new ForbiddenError("Admin role required for this action");
  }
};

export const createProject = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const body: CreateProjectBody = req.body;

    if (!body.name || typeof body.name !== "string") {
      throw new BadRequestError("Project name is required");
    }

    const project = await createProjectService({
      ownerId: user.id,
      name: body.name.trim(),
      description: body.description?.trim(),
      visibility: body.visibility || "private",
      tags: Array.isArray(body.tags) ? body.tags : [],
    });

    const dto = mapProjectToDTO(project, user.id);
    res.status(201).json(dto);
  } catch (err) {
    next(err);
  }
};

export const getProject = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");

    const project = await getProjectById(projectId);
    const accessibleProject = ensureProjectAccess(project, user.id);

    const dto = mapProjectToDTO(accessibleProject, user.id);
    res.status(200).json(dto);
  } catch (err) {
    next(err);
  }
};

export const listProjects = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO[]>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projects = await getProjectsForUser(user.id);

    const dtos = projects.map((p) => mapProjectToDTO(p, user.id));
    res.status(200).json(dtos);
  } catch (err) {
    next(err);
  }
};

export const updateProject = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");
    const body: UpdateProjectBody = req.body;

    const existing = await getProjectById(projectId);
    const project = ensureProjectAccess(existing, user.id);
    ensureProjectAdmin(project, user.id);

    const updatePayload: Partial<UpdateProjectBody> = {};
    if (typeof body.name === "string") updatePayload.name = body.name.trim();
    if (typeof body.description === "string") updatePayload.description = body.description.trim();
    if (body.visibility) updatePayload.visibility = body.visibility;
    if (Array.isArray(body.tags)) updatePayload.tags = body.tags;

    const updatedProject = await updateProjectService(projectId, updatePayload);
    if (!updatedProject) {
      throw new NotFoundError("Project not found after update");
    }

    const dto = mapProjectToDTO(updatedProject, user.id);
    res.status(200).json(dto);
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (
  req: AuthenticatedRequest,
  res: Response<{ success: boolean }>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");

    const existing = await getProjectById(projectId);
    const project = ensureProjectAccess(existing, user.id);

    if (project.owner.toString() !== user.id) {
      throw new ForbiddenError("Only the project owner can delete the project");
    }

    await deleteProjectService(projectId);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const archiveProject = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");

    const existing = await getProjectById(projectId);
    const project = ensureProjectAccess(existing, user.id);
    ensureProjectAdmin(project, user.id);

    const archived = await archiveProjectService(projectId);
    if (!archived) {
      throw new NotFoundError("Project not found");
    }

    const dto = mapProjectToDTO(archived, user.id);
    res.status(200).json(dto);
  } catch (err) {
    next(err);
  }
};

export const restoreProject = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");

    const existing = await getProjectById(projectId);
    const project = ensureProjectAccess(existing, user.id);
    ensureProjectAdmin(project, user.id);

    const restored = await restoreProjectService(projectId);
    if (!restored) {
      throw new NotFoundError("Project not found");
    }

    const dto = mapProjectToDTO(restored, user.id);
    res.status(200).json(dto);
  } catch (err) {
    next(err);
  }
};

export const addMember = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");
    const body: MemberUpdateBody = req.body;

    if (!body.userId) {
      throw new BadRequestError("userId is required");
    }
    if (!body.role) {
      throw new BadRequestError("role is required");
    }

    const targetUserId = parseObjectId(body.userId, "userId");
    const existing = await getProjectById(projectId);
    const project = ensureProjectAccess(existing, user.id);
    ensureProjectAdmin(project, user.id);

    const updated = await addMemberToProject(projectId, targetUserId, body.role);
    if (!updated) {
      throw new NotFoundError("Project not found");
    }

    const dto = mapProjectToDTO(updated, user.id);
    res.status(200).json(dto);
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (
  req: AuthenticatedRequest,
  res: Response<ProjectDTO>,
  next: NextFunction
): Promise<void> => {
  try {
    const user = assertAuthenticated(req);
    const projectId = parseObjectId(req.params.projectId, "projectId");
    const memberId = req.params.memberId;

    if (!memberId)