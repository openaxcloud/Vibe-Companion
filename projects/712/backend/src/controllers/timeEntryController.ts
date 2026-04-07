import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import mongoose, { ClientSession } from "mongoose";
import TimeEntry from "../models/TimeEntry";
import Task from "../models/Task";
import Project from "../models/Project";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";

type DateRange = {
  from?: string;
  to?: string;
};

const parseDateRange = ({ from, to }: DateRange): { from?: Date; to?: Date } => {
  const range: { from?: Date; to?: Date } = {};
  if (from) {
    const f = new Date(from);
    if (!Number.isNaN(f.getTime())) range.from = f;
  }
  if (to) {
    const t = new Date(to);
    if (!Number.isNaN(t.getTime())) range.to = t;
  }
  return range;
};

const buildDateFilter = (range: { from?: Date; to?: Date }) => {
  if (!range.from && !range.to) return undefined;
  const filter: Record<string, Date> = {};
  if (range.from) filter.$gte = range.from;
  if (range.to) filter.$lte = range.to;
  return filter;
};

const recalcTaskAggregates = async (taskId: mongoose.Types.ObjectId, session?: ClientSession) => {
  const agg = await TimeEntry.aggregate<{ _id: null; totalSeconds: number }>([
    { $match: { task: taskId, deletedAt: { $exists: false } } },
    {
      $group: {
        _id: null,
        totalSeconds: { $sum: "$durationSeconds" }
      }
    }
  ]).session(session || null);

  const totalSeconds = agg.length ? agg[0].totalSeconds : 0;

  await Task.updateOne(
    { _id: taskId },
    {
      $set: {
        totalTimeSeconds: totalSeconds,
        updatedAt: new Date()
      }
    }
  ).session(session || null);
};

export const createTimeEntry = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { taskId, projectId, startedAt, endedAt, durationSeconds, note } = req.body;

    if (!taskId || (!durationSeconds && (!startedAt || !endedAt))) {
      res.status(400).json({
        message:
          "taskId and either durationSeconds or both startedAt and endedAt are required"
      });
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const task = await Task.findOne({ _id: taskId, deletedAt: { $exists: false } })
          .session(session)
          .lean();
        if (!task) {
          throw { status: 404, message: "Task not found" };
        }

        if (projectId) {
          const project = await Project.findOne({
            _id: projectId,
            deletedAt: { $exists: false }
          })
            .session(session)
            .lean();
          if (!project) {
            throw { status: 404, message: "Project not found" };
          }
        }

        let computedDuration = durationSeconds as number | undefined;
        let computedStartedAt = startedAt ? new Date(startedAt) : undefined;
        let computedEndedAt = endedAt ? new Date(endedAt) : undefined;

        if (!computedDuration) {
          if (!computedStartedAt || !computedEndedAt) {
            throw {
              status: 400,
              message:
                "Either durationSeconds or both startedAt and endedAt must be provided"
            };
          }
          const diffMs = computedEndedAt.getTime() - computedStartedAt.getTime();
          if (diffMs <= 0) {
            throw { status: 400, message: "endedAt must be after startedAt" };
          }
          computedDuration = Math.floor(diffMs / 1000);
        }

        const newEntry = await TimeEntry.create(
          [
            {
              user: userId,
              task: taskId,
              project: projectId || task.project,
              startedAt: computedStartedAt || null,
              endedAt: computedEndedAt || null,
              durationSeconds: computedDuration,
              note: note || null,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          { session }
        );

        await recalcTaskAggregates(new mongoose.Types.ObjectId(taskId), session);

        res.status(201).json(newEntry[0]);
      });
    } catch (err: any) {
      if (err && err.status) {
        res.status(err.status).json({ message: err.message });
      } else {
        res.status(500).json({ message: "Failed to create time entry" });
      }
    } finally {
      session.endSession();
    }
  }
);

export const listTimeEntries = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { taskId, projectId, from, to } = req.query as {
      taskId?: string;
      projectId?: string;
      from?: string;
      to?: string;
    };

    const range = parseDateRange({ from, to });
    const dateFilter = buildDateFilter(range);

    const filter: any = {
      user: userId,
      deletedAt: { $exists: false }
    };

    if (taskId) filter.task = taskId;
    if (projectId) filter.project = projectId;
    if (dateFilter) filter.startedAt = dateFilter;

    const entries = await TimeEntry.find(filter)
      .sort({ startedAt: 1, createdAt: 1 })
      .lean();

    res.json(entries);
  }
);

export const getTimeEntryById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid time entry id" });
      return;
    }

    const entry = await TimeEntry.findOne({
      _id: id,
      user: userId,
      deletedAt: { $exists: false }
    }).lean();

    if (!entry) {
      res.status(404).json({ message: "Time entry not found" });
      return;
    }

    res.json(entry);
  }
);

export const updateTimeEntry = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid time entry id" });
      return;
    }

    const {
      taskId,
      projectId,
      startedAt,
      endedAt,
      durationSeconds,
      note
    }: {
      taskId?: string;
      projectId?: string;
      startedAt?: string;
      endedAt?: string;
      durationSeconds?: number;
      note?: string | null;
    } = req.body;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const entry = await TimeEntry.findOne({
          _id: id,
          user: userId,
          deletedAt: { $exists: false }
        }).session(session);

        if (!entry) {
          throw { status: 404, message: "Time entry not found" };
        }

        const originalTaskId = entry.task as mongoose.Types.ObjectId;

        if (taskId && taskId !== String(originalTaskId)) {
          const newTask = await Task.findOne({
            _id: taskId,
            deletedAt: { $exists: false }
          })
            .session(session)
            .lean();
          if (!newTask) {
            throw { status: 404, message: "New task not found" };
          }
          entry.task = new mongoose.Types.ObjectId(taskId);
          if (!projectId) {
            entry.project = newTask.project;
          }
        }

        if (projectId) {
          const project = await Project.findOne({
            _id: projectId,
            deletedAt: { $exists: false }
          })
            .session(session)
            .lean();
          if (!project) {
            throw { status: 404, message: "Project not found" };
          }
          entry.project = new mongoose.Types.ObjectId(projectId);
        }

        let computedDuration = durationSeconds;
        let computedStartedAt = startedAt ? new Date(startedAt) : entry.startedAt