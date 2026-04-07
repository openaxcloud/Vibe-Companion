import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Sprint from '../models/Sprint';
import Task from '../models/Task';
import Project from '../models/Project';
import { validateSprintDates, isDateRangeOverlapping } from '../utils/dateUtils';
import { HttpError } from '../utils/HttpError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles: string[];
  };
}

const assertProjectAccess = async (projectId: string, userId: string): Promise<void> => {
  const project = await Project.findById(projectId).select('members owner');
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  const isOwner = project.owner?.toString() === userId;
  const isMember = project.members?.some((m: Types.ObjectId) => m.toString() === userId);

  if (!isOwner && !isMember) {
    throw new HttpError(403, 'Access denied to this project');
  }
};

const validateSprintPayload = (body: any): { name: string; startDate: Date; endDate: Date } => {
  const { name, startDate, endDate } = body;

  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'Sprint name is required');
  }

  if (!startDate || !endDate) {
    throw new HttpError(400, 'Sprint startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!validateSprintDates(start, end)) {
    throw new HttpError(400, 'Invalid sprint date range');
  }

  return { name: name.trim(), startDate: start, endDate: end };
};

const getProjectSprints = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(projectId)) {
      throw new HttpError(400, 'Invalid project id');
    }

    await assertProjectAccess(projectId, userId);

    const sprints = await Sprint.find({ project: projectId })
      .sort({ startDate: 1 })
      .populate('tasks')
      .lean();

    res.json(sprints);
  } catch (err) {
    next(err);
  }
};

const getSprintById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sprintId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(sprintId)) {
      throw new HttpError(400, 'Invalid sprint id');
    }

    const sprint = await Sprint.findById(sprintId)
      .populate('tasks')
      .lean();

    if (!sprint) {
      throw new HttpError(404, 'Sprint not found');
    }

    await assertProjectAccess(String(sprint.project), userId);

    res.json(sprint);
  } catch (err) {
    next(err);
  }
};

const createSprint = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(projectId)) {
      throw new HttpError(400, 'Invalid project id');
    }

    await assertProjectAccess(projectId, userId);

    const { name, startDate, endDate } = validateSprintPayload(req.body);

    const overlapping = await Sprint.findOne({
      project: projectId,
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    }).lean();

    if (overlapping) {
      throw new HttpError(409, 'Sprint dates overlap with an existing sprint');
    }

    const sprint = await Sprint.create({
      name,
      startDate,
      endDate,
      project: projectId,
      tasks: [],
      createdBy: userId
    });

    res.status(201).json(sprint);
  } catch (err) {
    next(err);
  }
};

const updateSprint = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sprintId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(sprintId)) {
      throw new HttpError(400, 'Invalid sprint id');
    }

    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw new HttpError(404, 'Sprint not found');
    }

    await assertProjectAccess(String(sprint.project), userId);

    const updates: any = {};
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
        throw new HttpError(400, 'Invalid sprint name');
      }
      updates.name = req.body.name.trim();
    }

    let newStart = sprint.startDate;
    let newEnd = sprint.endDate;

    if (req.body.startDate || req.body.endDate) {
      newStart = req.body.startDate ? new Date(req.body.startDate) : sprint.startDate;
      newEnd = req.body.endDate ? new Date(req.body.endDate) : sprint.endDate;

      if (!validateSprintDates(newStart, newEnd)) {
        throw new HttpError(400, 'Invalid sprint date range');
      }

      const overlapping = await Sprint.findOne({
        _id: { $ne: sprintId },
        project: sprint.project,
        $or: [
          { startDate: { $lte: newEnd }, endDate: { $gte: newStart } }
        ]
      }).lean();

      if (overlapping) {
        throw new HttpError(409, 'Sprint dates overlap with an existing sprint');
      }

      updates.startDate = newStart;
      updates.endDate = newEnd;
    }

    const updatedSprint = await Sprint.findByIdAndUpdate(
      sprintId,
      { $set: updates },
      { new: true }
    ).populate('tasks');

    res.json(updatedSprint);
  } catch (err) {
    next(err);
  }
};

const deleteSprint = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sprintId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(sprintId)) {
      throw new HttpError(400, 'Invalid sprint id');
    }

    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw new HttpError(404, 'Sprint not found');
    }

    await assertProjectAccess(String(sprint.project), userId);

    if (sprint.tasks && sprint.tasks.length > 0) {
      await Task.updateMany(
        { _id: { $in: sprint.tasks } },
        { $set: { sprint: null, status: 'backlog' } }
      );
    }

    await sprint.deleteOne();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const addTaskToSprint = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sprintId, taskId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(sprintId) || !Types.ObjectId.isValid(taskId)) {
      throw new HttpError(400, 'Invalid sprint or task id');
    }

    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw new HttpError(404, 'Sprint not found');
    }

    const task = await Task.findById(taskId);
    if (!task) {
      throw new HttpError(404, 'Task not found');
    }

    if (String(task.project) !== String(sprint.project)) {
      throw new HttpError(400, 'Task and sprint belong to different projects');
    }

    await assertProjectAccess(String(sprint.project), userId);

    if (!sprint.tasks.some((id: Types.ObjectId) => id.toString() === taskId)) {
      sprint.tasks.push(task._id);
      await sprint.save();
    }

    task.sprint = sprint._id;
    if (task.status === 'backlog') {
      task.status = 'todo';
    }
    await task.save();

    const populatedSprint = await Sprint.findById(sprintId).populate('tasks');

    res.json(populatedSprint);
  } catch (err) {
    next(err);
  }
};

const removeTaskFromSprint = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sprintId, taskId } = req.params;
    const userId = req.user?.id as string;

    if (!Types.ObjectId.isValid(sprintId) || !Types.ObjectId.isValid(taskId)) {
      throw new HttpError(400,