import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { Types } from 'mongoose';
import { TaskModel } from '../models/Task';
import { UserModel } from '../models/User';
import { SprintModel } from '../models/Sprint';
import { BacklogModel } from '../models/Backlog';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { NotFoundError } from '../errors/NotFoundError';
import { BadRequestError } from '../errors/BadRequestError';
import { ForbiddenError } from '../errors/ForbiddenError';

const router = Router();

const isValidObjectId = (value: string): boolean => Types.ObjectId.isValid(value);

const objectIdValidator = (field: string) =>
  body(field)
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error(`undefined must be a valid id`);
      }
      return true;
    });

const priorityValues = ['low', 'medium', 'high', 'critical'] as const;
const statusValues = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
const typeValues = ['task', 'bug', 'story', 'epic'] as const;

router.use(authMiddleware);

router.get(
  '/',
  [
    query('projectId')
      .optional()
      .custom((value) => {
        if (!isValidObjectId(value)) throw new Error('projectId must be a valid id');
        return true;
      }),
    query('sprintId')
      .optional()
      .custom((value) => {
        if (!isValidObjectId(value)) throw new Error('sprintId must be a valid id');
        return true;
      }),
    query('backlogId')
      .optional()
      .custom((value) => {
        if (!isValidObjectId(value)) throw new Error('backlogId must be a valid id');
        return true;
      }),
    query('assigneeId')
      .optional()
      .custom((value) => {
        if (!isValidObjectId(value)) throw new Error('assigneeId must be a valid id');
        return true;
      }),
    query('status')
      .optional()
      .isIn(statusValues)
      .withMessage(`status must be one of: undefined`),
    query('type')
      .optional()
      .isIn(typeValues)
      .withMessage(`type must be one of: undefined`),
    query('search').optional().isString().trim().isLength({ min: 1 }).withMessage('search must be a non-empty string'),
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      projectId,
      sprintId,
      backlogId,
      assigneeId,
      status,
      type,
      search,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const filters: Record<string, unknown> = {};
    if (projectId) filters.projectId = projectId;
    if (sprintId) filters.sprintId = sprintId;
    if (backlogId) filters.backlogId = backlogId;
    if (assigneeId) filters.assigneeId = assigneeId;
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { key: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      TaskModel.find(filters)
        .sort({ rank: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('assigneeId reporterId sprintId backlogId projectId parentId subtasks')
        .lean(),
      TaskModel.countDocuments(filters),
    ]);

    res.json({
      data: tasks,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

router.post(
  '/',
  [
    body('title').isString().trim().notEmpty().withMessage('title is required'),
    body('projectId')
      .isString()
      .custom((value) => {
        if (!isValidObjectId(value)) throw new Error('projectId must be a valid id');
        return true;
      }),
    body('type')
      .optional()
      .isIn(typeValues)
      .withMessage(`type must be one of: undefined`),
    body('status')
      .optional()
      .isIn(statusValues)
      .withMessage(`status must be one of: undefined`),
    body('priority')
      .optional()
      .isIn(priorityValues)
      .withMessage(`priority must be one of: undefined`),
    objectIdValidator('assigneeId'),
    objectIdValidator('reporterId'),
    objectIdValidator('sprintId'),
    objectIdValidator('backlogId'),
    objectIdValidator('parentId'),
    body('estimate').optional().isFloat({ min: 0 }).withMessage('estimate must be a non-negative number'),
    body('timeRemaining').optional().isFloat({ min: 0 }).withMessage('timeRemaining must be a non-negative number'),
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      title,
      description,
      projectId,
      type = 'task',
      status = 'backlog',
      priority = 'medium',
      assigneeId,
      reporterId,
      sprintId,
      backlogId,
      parentId,
      estimate,
      timeRemaining,
    } = req.body;

    if (assigneeId) {
      const assignee = await UserModel.findById(assigneeId).lean();
      if (!assignee) throw new BadRequestError('Invalid assigneeId');
    }

    if (reporterId) {
      const reporter = await UserModel.findById(reporterId).lean();
      if (!reporter) throw new BadRequestError('Invalid reporterId');
    }

    if (sprintId) {
      const sprint = await SprintModel.findById(sprintId).lean();
      if (!sprint) throw new BadRequestError('Invalid sprintId');
    }

    if (backlogId) {
      const backlog = await BacklogModel.findById(backlogId).lean();
      if (!backlog) throw new BadRequestError('Invalid backlogId');
    }

    let parentTaskId: Types.ObjectId | undefined;
    if (parentId) {
      const parentTask = await TaskModel.findById(parentId);
      if (!parentTask) throw new BadRequestError('Invalid parentId');
      parentTaskId = parentTask._id;
    }

    const maxRankTask = await TaskModel.findOne({ projectId, status }).sort({ rank: -1 }).lean();
    const nextRank = maxRankTask ? (maxRankTask.rank || 0) + 1 : 1;

    const keyPrefix = (projectId as string).toString().slice(-4).toUpperCase();
    const sequence = Math.floor(Math.random() * 9000) + 1000;
    const key = `undefined-undefined`;

    const task = await TaskModel.create({
      title,
      description,
      key,
      projectId,
      type,
      status,
      priority,
      assigneeId,
      reporterId,
      sprintId,
      backlogId,
      parentId: parentTaskId,
      estimate,
      timeRemaining,
      rank: nextRank,
      createdBy: req.user?.id,
    });

    if (parentTaskId) {
      await TaskModel.findByIdAndUpdate(parentTaskId, { $push: { subtasks: task._id } });
    }

    const populatedTask = await TaskModel.findById(task._id)
      .populate('assigneeId reporterId sprintId backlogId projectId parentId subtasks')
      .lean();

    res.status(201).json(populatedTask);
  })
);

router.get(
  '/:id',
  [
    param('id').custom((value) => {
      if (!isValidObjectId(value)) throw new Error('Invalid task id');
      return true;
    }),
  ],
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const task = await TaskModel.findById(id)
      .populate('assigneeId reporterId sprintId backlogId projectId parentId subtasks')
      .lean();

    if