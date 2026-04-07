import express, { Request, Response, NextFunction, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import { SprintModel } from '../models/Sprint';
import { TaskModel } from '../models/Task';
import { ProjectModel } from '../models/Project';
import { authenticate } from '../middleware/authenticate';
import { authorizeProjectAccess } from '../middleware/authorizeProjectAccess';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

const router: Router = express.Router();

type TypedRequestBody<T> = Request<unknown, unknown, T>;
type TypedRequestParams<T> = Request<T>;
type TypedRequestQuery<T> = Request<unknown, unknown, unknown, T>;
type TypedRequest<TParams, TBody, TQuery> = Request<TParams, unknown, TBody, TQuery>;

interface CreateSprintBody {
  name: string;
  startDate: string;
  endDate: string;
  goal?: string;
  capacityPoints?: number;
}

interface UpdateSprintBody {
  name?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  capacityPoints?: number | null;
}

interface MoveTasksBody {
  taskIds: string[];
}

interface StartSprintBody {
  startDate?: string;
}

interface CompleteSprintBody {
  completedAt?: string;
  moveIncompleteTo?: 'backlog' | 'newSprint';
  newSprintName?: string;
  newSprintEndDate?: string;
  newSprintGoal?: string;
}

interface SprintQuery {
  status?: 'active' | 'planned' | 'completed';
  limit?: string;
  offset?: string;
}

interface BurndownQuery {
  from?: string;
  to?: string;
}

const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }
  next();
};

const isValidObjectId = (id: string): boolean => Types.ObjectId.isValid(id);

// Create sprint
router.post(
  '/projects/:projectId/sprints',
  authenticate,
  param('projectId').custom(isValidObjectId).withMessage('Invalid projectId'),
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date'),
  body('goal').optional().isString().trim(),
  body('capacityPoints').optional().isNumeric().toInt(),
  validate,
  authorizeProjectAccess('projectId'),
  asyncHandler(async (req: TypedRequest<{ projectId: string }, CreateSprintBody, unknown>, res: Response) => {
    const { projectId } = req.params;
    const { name, startDate, endDate, goal, capacityPoints } = req.body;

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    if (new Date(startDate) >= new Date(endDate)) {
      throw new ApiError(400, 'startDate must be before endDate');
    }

    const sprint = await SprintModel.create({
      project: project._id,
      name,
      goal: goal || '',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      capacityPoints: capacityPoints ?? null,
      status: 'planned',
      tasks: [],
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    });

    res.status(201).json({ sprint });
  })
);

// Get sprints for a project
router.get(
  '/projects/:projectId/sprints',
  authenticate,
  param('projectId').custom(isValidObjectId).withMessage('Invalid projectId'),
  query('status').optional().isIn(['active', 'planned', 'completed']),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  validate,
  authorizeProjectAccess('projectId'),
  asyncHandler(async (req: TypedRequest<{ projectId: string }, unknown, SprintQuery>, res: Response) => {
    const { projectId } = req.params;
    const { status, limit = '50', offset = '0' } = req.query;

    const filter: Record<string, unknown> = { project: projectId };
    if (status) filter.status = status;

    const [sprints, total] = await Promise.all([
      SprintModel.find(filter)
        .sort({ startDate: 1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      SprintModel.countDocuments(filter),
    ]);

    res.json({ sprints, total });
  })
);

// Get single sprint
router.get(
  '/projects/:projectId/sprints/:sprintId',
  authenticate,
  param('projectId').custom(isValidObjectId),
  param('sprintId').custom(isValidObjectId),
  validate,
  authorizeProjectAccess('projectId'),
  asyncHandler(async (req: TypedRequest<{ projectId: string; sprintId: string }, unknown, unknown>, res: Response) => {
    const { projectId, sprintId } = req.params;

    const sprint = await SprintModel.findOne({ _id: sprintId, project: projectId }).populate('tasks');
    if (!sprint) {
      throw new ApiError(404, 'Sprint not found');
    }

    res.json({ sprint });
  })
);

// Update sprint
router.patch(
  '/projects/:projectId/sprints/:sprintId',
  authenticate,
  param('projectId').custom(isValidObjectId),
  param('sprintId').custom(isValidObjectId),
  body('name').optional().isString().trim().notEmpty(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('goal').optional().isString().trim(),
  body('capacityPoints').optional({ nullable: true }).isNumeric().toInt(),
  validate,
  authorizeProjectAccess('projectId'),
  asyncHandler(async (req: TypedRequest<{ projectId: string; sprintId: string }, UpdateSprintBody, unknown>, res: Response) => {
    const { projectId, sprintId } = req.params;
    const { name, startDate, endDate, goal, capacityPoints } = req.body;

    const sprint = await SprintModel.findOne({ _id: sprintId, project: projectId });
    if (!sprint) {
      throw new ApiError(404, 'Sprint not found');
    }

    if (sprint.status === 'completed') {
      throw new ApiError(400, 'Completed sprint cannot be modified');
    }

    if (name !== undefined) sprint.name = name;
    if (goal !== undefined) sprint.goal = goal;
    if (capacityPoints !== undefined) sprint.capacityPoints = capacityPoints;

    if (startDate !== undefined) {
      sprint.startDate = new Date(startDate);
    }
    if (endDate !== undefined) {
      sprint.endDate = new Date(endDate);
    }
    if (startDate !== undefined || endDate !== undefined) {
      if (sprint.startDate >= sprint.endDate) {
        throw new ApiError(400, 'startDate must be before endDate');
      }
    }

    sprint.updatedBy = req.user?.id;
    await sprint.save();

    res.json({ sprint });
  })
);

// Delete sprint
router.delete(
  '/projects/:projectId/sprints/:sprintId',
  authenticate,
  param('projectId').custom(isValidObjectId),
  param('sprintId').custom(isValidObjectId),
  validate,
  authorizeProjectAccess('projectId'),
  asyncHandler(async (req: TypedRequest<{ projectId: string; sprintId: string }, unknown, unknown>, res: Response) => {
    const { projectId, sprintId } = req.params;

    const sprint = await SprintModel.findOne({ _id: sprintId, project: projectId });
    if (!sprint) {
      throw new ApiError(404, 'Sprint not found');
    }

    if (sprint.status === 'active') {
      throw new ApiError(400, 'Active sprint cannot be deleted');
    }

    if (sprint.tasks && sprint.tasks.length > 0) {
      await TaskModel.updateMany(
        { _id: { $in: sprint.tasks } },
        { $set: { sprint: null, status: 'backlog' } }
      );
    }

    await sprint.deleteOne();

    res.status(204).send();
  })
);

// Move tasks into sprint
router.post(
  '/projects/:projectId/sprints/:sprintId/tasks/add',
  authenticate,
  param('projectId').custom(isValidObjectId),
  param('sprintId').custom(isValidObjectId),
  body('taskIds').isArray({ min: 1 }).withMessage('taskIds must be a non-empty array'),
  body('taskIds.*').custom(isValidObjectId).withMessage('