import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Types } from "mongoose";
import { TaskModel } from "../models/Task";
import { BoardModel } from "../models/Board";
import { ColumnModel } from "../models/Column";
import { SprintModel } from "../models/Sprint";
import { ActivityLogModel } from "../models/ActivityLog";
import { HttpError } from "../utils/HttpError";
import { getUserFromRequest } from "../utils/auth";
import {
  ITask,
  TaskPriority,
  TaskStatus,
  TaskType,
  ITaskDocument,
} from "../types/taskTypes";
import { IActivityLogDocument, ActivityAction } from "../types/activityLogTypes";

type TypedRequest<TBody = unknown, TParams = unknown, TQuery = unknown> = Request<
  TParams,
  unknown,
  TBody,
  TQuery
>;

interface CreateTaskBody {
  title: string;
  description?: string;
  boardId: string;
  columnId: string;
  sprintId?: string | null;
  assigneeId?: string | null;
  reporterId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  type?: TaskType;
  estimate?: number | null;
  dueDate?: string | null;
  position?: number;
  metadata?: Record<string, unknown>;
}

interface UpdateTaskBody {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  reporterId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  type?: TaskType;
  estimate?: number | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown>;
}

interface ReorderTasksBody {
  sourceColumnId: string;
  destinationColumnId: string;
  sourceIndex: number;
  destinationIndex: number;
  taskId: string;
}

interface MoveTaskToSprintBody {
  sprintId: string | null;
}

const ensureObjectId = (id: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(400, `Invalid undefined`);
  }
  return new Types.ObjectId(id);
};

const createActivityLog = async (
  params: Omit<IActivityLogDocument, "_id" | "createdAt" | "updatedAt">,
): Promise<IActivityLogDocument> => {
  const log = new ActivityLogModel(params);
  await log.save();
  return log;
};

const validateRequest = (req: Request): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError(422, "Validation failed", errors.array());
  }
};

export const createTask = async (
  req: TypedRequest<CreateTaskBody>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    validateRequest(req);
    const user = getUserFromRequest(req);
    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }

    const {
      title,
      description,
      boardId,
      columnId,
      sprintId,
      assigneeId,
      reporterId,
      priority = "medium",
      status = "todo",
      type = "task",
      estimate,
      dueDate,
      position,
      metadata,
    } = req.body;

    const boardObjectId = ensureObjectId(boardId, "boardId");
    const columnObjectId = ensureObjectId(columnId, "columnId");
    const sprintObjectId = sprintId ? ensureObjectId(sprintId, "sprintId") : null;
    const assigneeObjectId = assigneeId ? ensureObjectId(assigneeId, "assigneeId") : null;
    const reporterObjectId = reporterId ? ensureObjectId(reporterId, "reporterId") : null;

    const [board, column, sprint] = await Promise.all([
      BoardModel.findById(boardObjectId),
      ColumnModel.findById(columnObjectId),
      sprintObjectId ? SprintModel.findById(sprintObjectId) : Promise.resolve(null),
    ]);

    if (!board) {
      throw new HttpError(404, "Board not found");
    }
    if (!column || column.board.toString() !== board._id.toString()) {
      throw new HttpError(400, "Column does not belong to specified board");
    }
    if (sprint && sprint.board.toString() !== board._id.toString()) {
      throw new HttpError(400, "Sprint does not belong to specified board");
    }

    let taskPosition = position;
    if (taskPosition === undefined || taskPosition === null) {
      const maxPositionTask = await TaskModel.findOne({ column: columnObjectId })
        .sort({ position: -1 })
        .select("position")
        .lean()
        .exec();
      taskPosition = maxPositionTask ? maxPositionTask.position + 1 : 0;
    }

    const taskData: Partial<ITask> = {
      title,
      description,
      board: boardObjectId,
      column: columnObjectId,
      sprint: sprintObjectId ?? undefined,
      assignee: assigneeObjectId ?? undefined,
      reporter: reporterObjectId ?? user._id,
      priority,
      status,
      type,
      estimate: estimate ?? undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      position: taskPosition,
      metadata: metadata ?? {},
      createdBy: user._id,
      updatedBy: user._id,
    };

    const task = new TaskModel(taskData);
    await task.save();

    await createActivityLog({
      board: board._id,
      task: task._id,
      user: user._id,
      action: ActivityAction.TASK_CREATED,
      details: {
        title: task.title,
        columnId: column._id,
        sprintId: sprint?._id ?? null,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (
  req: TypedRequest<unknown, { taskId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { taskId } = req.params;
    const taskObjectId = ensureObjectId(taskId, "taskId");

    const task = await TaskModel.findById(taskObjectId)
      .populate("board")
      .populate("column")
      .populate("sprint")
      .populate("assignee")
      .populate("reporter")
      .lean()
      .exec();

    if (!task) {
      throw new HttpError(404, "Task not found");
    }

    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (
  req: TypedRequest<UpdateTaskBody, { taskId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    validateRequest(req);
    const user = getUserFromRequest(req);
    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { taskId } = req.params;
    const taskObjectId = ensureObjectId(taskId, "taskId");

    const existingTask = await TaskModel.findById(taskObjectId).exec();
    if (!existingTask) {
      throw new HttpError(404, "Task not found");
    }

    const updates: Partial<ITaskDocument> = {};
    const details: Record<string, unknown> = {};
    const body = req.body;

    const updateField = <K extends keyof UpdateTaskBody & keyof ITaskDocument>(
      field: K,
    ): void => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const newValue = body[field];
        const oldValue = (existingTask as ITaskDocument)[field];
        if (newValue !== undefined && newValue !== oldValue) {
          (updates as any)[field] = newValue;
          details[field] = { from: oldValue, to: newValue };
        }
      }
    };

    updateField("title");
    updateField("description");
    updateField("priority");
    updateField("status");
    updateField("type");
    updateField("estimate");

    if (Object.prototype.hasOwnProperty.call(body, "dueDate")) {
      const newDueDate = body.dueDate ? new Date(body.dueDate) : null;
      const oldDueDate = existingTask.dueDate ?? null;
      if ((newDueDate?.getTime() ?? null) !== (oldDueDate?.getTime() ?? null)) {
        updates.dueDate = newDueDate ?? undefined;
        details.dueDate = { from: oldDueDate, to: newDueDate };
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "assigneeId")) {
      const newAssigneeId = body.assigneeId
        ? ensureObjectId(body.assigneeId, "assigneeId")
        : null;
      const oldAssigneeId = existingTask.assignee ? existingTask.assignee.toString() : null;
      const newAssigneeIdStr = newAssigneeId ? newAssigneeId.toString()