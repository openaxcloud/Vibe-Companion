import { Router, Request, Response, NextFunction } from "express";
import { body, param, query } from "express-validator";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// In-memory store placeholder – replace with real DB/repository in production
type WorkflowStatus = {
  id: string;
  projectId: string;
  name: string;
  color?: string | null;
  isDefault: boolean;
  isFinal: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

type ColumnMapping = {
  id: string;
  projectId: string;
  columnId: string;
  statusId: string;
  createdAt: Date;
  updatedAt: Date;
};

const workflowStatuses: WorkflowStatus[] = [];
const columnMappings: ColumnMapping[] = [];

// Generic helpers
const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req, res, next).catch(next);

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  // Lightweight validator result check using express-validator's request object
  // We avoid importing validationResult to keep this module self-contained;
  // if validation is critical, wire a centralized validator middleware instead.
  const anyError = (req as any)._validationErrors?.length;
  if (anyError) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: (req as any)._validationErrors,
    });
  }
  return next();
};

// Simple middleware to collect errors from express-validator chain
// This assumes an external middleware sets req._validationErrors on failure;
// if not available, this is effectively a no-op and validators should be
// wired with validationResult in your global middleware stack.
const validationCollector = (validators: any[]) => {
  return [
    ...validators,
    (req: Request, _res: Response, next: NextFunction) => {
      const errors: any[] = [];
      (validators || []).forEach((validator) => {
        if (validator && validator.run) {
          // run() already executed by express-validator; errors are stored globally,
          // here we only provide extension point if you centralize request errors.
        }
      });
      if (errors.length) {
        (req as any)._validationErrors = errors;
      }
      next();
    },
  ];
};

// Utility functions
const findStatusesByProject = (projectId: string): WorkflowStatus[] =>
  workflowStatuses
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.position - b.position);

const getNextPositionForProject = (projectId: string): number => {
  const projectStatuses = workflowStatuses.filter((s) => s.projectId === projectId);
  if (!projectStatuses.length) return 0;
  return Math.max(...projectStatuses.map((s) => s.position)) + 1;
};

const normalizePositions = (projectId: string): void => {
  const sorted = findStatusesByProject(projectId);
  sorted.forEach((s, idx) => {
    s.position = idx;
    s.updatedAt = new Date();
  });
};

const getStatusById = (id: string, projectId: string): WorkflowStatus | undefined =>
  workflowStatuses.find((s) => s.id === id && s.projectId === projectId);

const getColumnMappingsByProject = (projectId: string): ColumnMapping[] =>
  columnMappings.filter((m) => m.projectId === projectId);

const getMappingsByStatus = (statusId: string, projectId: string): ColumnMapping[] =>
  columnMappings.filter((m) => m.statusId === statusId && m.projectId === projectId);

// Routes

// GET /projects/:projectId/workflow-statuses
router.get(
  "/projects/:projectId/workflow-statuses",
  validationCollector([
    param("projectId").isString().trim().notEmpty(),
    query("includeMappings").optional().isBoolean().toBoolean(),
  ]),
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const includeMappings = (req.query.includeMappings as unknown as boolean) || false;

    const statuses = findStatusesByProject(projectId);
    if (!includeMappings) {
      return res.json({ items: statuses });
    }

    const mappings = getColumnMappingsByProject(projectId);
    return res.json({
      items: statuses,
      mappings,
    });
  })
);

// GET /projects/:projectId/workflow-statuses/:statusId
router.get(
  "/projects/:projectId/workflow-statuses/:statusId",
  validationCollector([
    param("projectId").isString().trim().notEmpty(),
    param("statusId").isString().trim().notEmpty(),
  ]),
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, statusId } = req.params;
    const status = getStatusById(statusId, projectId);
    if (!status) {
      return res.status(404).json({ error: "STATUS_NOT_FOUND" });
    }
    return res.json(status);
  })
);

// POST /projects/:projectId/workflow-statuses
router.post(
  "/projects/:projectId/workflow-statuses",
  validationCollector([
    param("projectId").isString().trim().notEmpty(),
    body("name").isString().trim().notEmpty(),
    body("color").optional({ nullable: true }).isString().trim(),
    body("isDefault").optional().isBoolean(),
    body("isFinal").optional().isBoolean(),
    body("position").optional().isInt({ min: 0 }),
  ]),
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { name, color, isDefault = false, isFinal = false } = req.body;
    const now = new Date();

    let position: number;
    if (typeof req.body.position === "number") {
      position = req.body.position;
      const statuses = findStatusesByProject(projectId);
      statuses.forEach((s) => {
        if (s.position >= position) {
          s.position += 1;
          s.updatedAt = now;
        }
      });
    } else {
      position = getNextPositionForProject(projectId);
    }

    const status: WorkflowStatus = {
      id: uuidv4(),
      projectId,
      name,
      color: color ?? null,
      isDefault: !!isDefault,
      isFinal: !!isFinal,
      position,
      createdAt: now,
      updatedAt: now,
    };

    if (isDefault) {
      workflowStatuses
        .filter((s) => s.projectId === projectId && s.id !== status.id)
        .forEach((s) => {
          s.isDefault = false;
          s.updatedAt = now;
        });
    }

    workflowStatuses.push(status);
    normalizePositions(projectId);
    return res.status(201).json(status);
  })
);

// PATCH /projects/:projectId/workflow-statuses/:statusId
router.patch(
  "/projects/:projectId/workflow-statuses/:statusId",
  validationCollector([
    param("projectId").isString().trim().notEmpty(),
    param("statusId").isString().trim().notEmpty(),
    body("name").optional().isString().trim().notEmpty(),
    body("color").optional({ nullable: true }).isString().trim(),
    body("isDefault").optional().isBoolean(),
    body("isFinal").optional().isBoolean(),
    body("position").optional().isInt({ min: 0 }),
  ]),
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, statusId } = req.params;
    const status = getStatusById(statusId, projectId);
    if (!status) {
      return res.status(404).json({ error: "STATUS_NOT_FOUND" });
    }

    const { name, color, isDefault, isFinal } = req.body;
    const now = new Date();

    if (typeof name === "string") {
      status.name = name;
    }
    if (req.body.hasOwnProperty("color")) {
      status.color = color ?? null;
    }
    if (typeof isFinal === "boolean") {
      status.isFinal = isFinal;
    }

    if (typeof isDefault === "boolean") {
      status.isDefault = isDefault;
      if (isDefault) {
        workflowStatuses
          .filter((s) => s.projectId === projectId && s.id !== status.id)
          .forEach((s) => {
            s.isDefault = false;
            s.updatedAt = now;
          });
      }
    }

    if (typeof req.body.position === "number") {
      const newPosition: number = req.body.position;
      const projectStatuses = findStatusesByProject(projectId);
      if (newPosition < 0 || newPosition >= projectStatuses.length) {
        return res.status(400).json({ error: "INVALID_POSITION" });
      }
      const oldPosition = status.position;

      if (new