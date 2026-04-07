import { Router, Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";
import { ProjectModel } from "../models/Project";
import { SprintModel } from "../models/Sprint";
import { BoardModel } from "../models/Board";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";
import { ApiError } from "../utils/ApiError";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

// Validation helpers
const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation error", errors.array());
  }
  next();
};

const isValidObjectId = (value: string): boolean => {
  return Types.ObjectId.isValid(value);
};

// Common validators
const projectIdParamValidator = [
  param("projectId")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid projectId"),
];

const memberIdParamValidator = [
  param("memberId")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid memberId"),
];

// Access control helper
const assertProjectAccess = async (
  userId: string,
  projectId: string
): Promise<InstanceType<typeof ProjectModel>> => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    isArchived: { $ne: true },
    $or: [{ owner: userId }, { members: userId }],
  });

  if (!project) {
    throw new ApiError(404, "Project not found or access denied");
  }

  return project;
};

// Ownership-only helper
const assertProjectOwnership = async (
  userId: string,
  projectId: string
): Promise<InstanceType<typeof ProjectModel>> => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    owner: userId,
    isArchived: { $ne: true },
  });

  if (!project) {
    throw new ApiError(404, "Project not found or access denied");
  }

  return project;
};

// GET /projects - list projects
router.get(
  "/",
  requireAuth,
  [
    query("status")
      .optional()
      .isIn(["active", "archived"])
      .withMessage("Invalid status filter"),
    query("search").optional().isString().trim().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { status, search } = req.query as {
      status?: "active" | "archived";
      search?: string;
    };

    const filter: Record<string, unknown> = {
      $or: [{ owner: userId }, { members: userId }],
    };

    if (status === "archived") {
      filter.isArchived = true;
    } else if (status === "active") {
      filter.isArchived = { $ne: true };
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const projects = await ProjectModel.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ data: projects });
  })
);

// POST /projects - create project
router.post(
  "/",
  requireAuth,
  [
    body("name").isString().trim().isLength({ min: 1, max: 200 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("members")
      .optional()
      .isArray()
      .withMessage("Members must be an array of user IDs"),
    body("members.*")
      .optional()
      .custom((value) => isValidObjectId(value))
      .withMessage("Invalid member ID"),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { name, description, members = [] } = req.body as {
      name: string;
      description?: string;
      members?: string[];
    };

    const uniqueMembers = Array.from(
      new Set(members.filter((m) => m !== userId))
    );

    const project = await ProjectModel.create({
      name,
      description,
      owner: userId,
      members: uniqueMembers,
      isArchived: false,
    });

    res.status(201).json({ data: project });
  })
);

// GET /projects/:projectId - get project details
router.get(
  "/:projectId",
  requireAuth,
  projectIdParamValidator,
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await assertProjectAccess(userId, projectId);

    res.json({ data: project });
  })
);

// PATCH /projects/:projectId - update project
router.patch(
  "/:projectId",
  requireAuth,
  [
    ...projectIdParamValidator,
    body("name").optional().isString().trim().isLength({ min: 1, max: 200 }),
    body("description")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 0, max: 2000 }),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { projectId } = req.params;
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };

    const project = await assertProjectOwnership(userId, projectId);

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();

    res.json({ data: project });
  })
);

// POST /projects/:projectId/archive - archive project
router.post(
  "/:projectId/archive",
  requireAuth,
  projectIdParamValidator,
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id
import { Router, Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Types } from "mongoose";
import { ProjectModel } from "../models/Project";
import { SprintModel } from "../models/Sprint";
import { BoardModel } from "../models/Board";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";
import { ApiError } from "../utils/ApiError";

const router = Router();

interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Validation helpers
const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation error", errors.array());
  }
  next();
};

const isValidObjectId = (value: string): boolean => {
  return Types.ObjectId.isValid(value);
};

// Common validators
const projectIdParamValidator = [
  param("projectId")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid projectId"),
];

const memberIdParamValidator = [
  param("memberId")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid memberId"),
];

// Access control helper
const assertProjectAccess = async (
  userId: string,
  projectId: string
): Promise<InstanceType<typeof ProjectModel>> => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    isArchived: { $ne: true },
    $or: [{ owner: userId }, { members: userId }],
  });

  if (!project) {
    throw new ApiError(404, "Project not found or access denied");
  }

  return project;
};

// Ownership-only helper
const assertProjectOwnership = async (
  userId: string,
  projectId: string
): Promise<InstanceType<typeof ProjectModel>> => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    owner: userId,
    isArchived: { $ne: true },
  });

  if (!project) {
    throw new ApiError(404, "Project not found or access denied");
  }

  return project;
};

// GET /projects - list projects
router.get(
  "/",
  requireAuth,
  [
    query("status")
      .optional()
      .isIn(["active", "archived"])
      .withMessage("Invalid status filter"),
    query("search").optional().isString().trim().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(async (req: Auth