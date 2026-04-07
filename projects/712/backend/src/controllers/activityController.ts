import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import ActivityLogModel, {
  ActivityLogDocument,
  ActivityAction,
} from "../models/ActivityLog";
import TaskModel from "../models/Task";
import UserModel from "../models/User";

type ActivityFeedItem = {
  id: string;
  action: ActivityAction;
  message: string;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  task?: {
    id: string;
    title: string;
    status?: string;
  };
  meta?: Record<string, unknown>;
};

type GetActivityFeedQuery = {
  limit?: string;
  cursor?: string;
  taskId?: string;
  userId?: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const getLimitFromQuery = (value?: string): number => {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const buildActivityMessage = (activity: ActivityLogDocument, context: { actorName?: string; taskTitle?: string }): string => {
  const actor = context.actorName ?? "Someone";
  const task = context.taskTitle ? `"undefined"` : "a task";

  switch (activity.action) {
    case "TASK_CREATED":
      return `undefined created undefined.`;
    case "TASK_UPDATED":
      return `undefined updated undefined.`;
    case "TASK_COMPLETED":
      return `undefined completed undefined.`;
    case "TASK_REOPENED":
      return `undefined reopened undefined.`;
    case "TASK_ASSIGNED":
      if (activity.meta?.assigneeName) {
        return `undefined assigned undefined to undefined.`;
      }
      return `undefined changed the assignee for undefined.`;
    case "TASK_COMMENTED":
      return `undefined commented on undefined.`;
    case "TASK_DELETED":
      return `undefined deleted undefined.`;
    case "USER_JOINED":
      return `undefined joined the workspace.`;
    case "USER_LEFT":
      return `undefined left the workspace.`;
    default:
      return `undefined performed an action.`;
  }
};

const toActivityFeedItem = (
  activity: ActivityLogDocument,
  options: {
    actorName?: string;
    actorEmail?: string;
    actorAvatarUrl?: string;
    taskTitle?: string;
    taskStatus?: string;
  }
): ActivityFeedItem => {
  const { actorName, actorEmail, actorAvatarUrl, taskTitle, taskStatus } = options;

  return {
    id: activity._id.toString(),
    action: activity.action,
    message: buildActivityMessage(activity, { actorName, taskTitle }),
    createdAt: activity.createdAt.toISOString(),
    actor: activity.actorId
      ? {
          id: activity.actorId.toString(),
          name: actorName ?? "Unknown user",
          email: actorEmail,
          avatarUrl: actorAvatarUrl,
        }
      : undefined,
    task: activity.taskId
      ? {
          id: activity.taskId.toString(),
          title: taskTitle ?? "Untitled task",
          status: taskStatus,
        }
      : undefined,
    meta: activity.meta ?? undefined,
  };
};

export const getActivityFeed = async (
  req: Request<unknown, unknown, unknown, GetActivityFeedQuery>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cursor, taskId, userId } = req.query;
    const limit = getLimitFromQuery(req.query.limit);

    const filters: Record<string, unknown> = {};

    if (taskId) {
      if (!Types.ObjectId.isValid(taskId)) {
        res.status(400).json({ error: "Invalid taskId" });
        return;
      }
      filters.taskId = new Types.ObjectId(taskId);
    }

    if (userId) {
      if (!Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: "Invalid userId" });
        return;
      }
      filters.actorId = new Types.ObjectId(userId);
    }

    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filters._id = { $lt: new Types.ObjectId(cursor) };
    }

    const activities = await ActivityLogModel.find(filters)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean(false)
      .exec();

    const hasMore = activities.length > limit;
    const slicedActivities = hasMore ? activities.slice(0, limit) : activities;

    const actorIds = new Set<string>();
    const taskIds = new Set<string>();

    slicedActivities.forEach((a) => {
      if (a.actorId) actorIds.add(a.actorId.toString());
      if (a.taskId) taskIds.add(a.taskId.toString());
    });

    const [actors, tasks] = await Promise.all([
      actorIds.size
        ? UserModel.find({ _id: { $in: Array.from(actorIds).map((id) => new Types.ObjectId(id)) } })
            .select("_id name email avatarUrl")
            .lean()
            .exec()
        : Promise.resolve([]),
      taskIds.size
        ? TaskModel.find({ _id: { $in: Array.from(taskIds).map((id) => new Types.ObjectId(id)) } })
            .select("_id title status")
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    const actorMap = new Map<
      string,
      { name?: string; email?: string; avatarUrl?: string }
    >();
    actors.forEach((actor) => {
      actorMap.set(actor._id.toString(), {
        name: actor.name,
        email: actor.email,
        avatarUrl: actor.avatarUrl,
      });
    });

    const taskMap = new Map<string, { title?: string; status?: string }>();
    tasks.forEach((task) => {
      taskMap.set(task._id.toString(), {
        title: task.title,
        status: task.status,
      });
    });

    const feedItems: ActivityFeedItem[] = slicedActivities.map((activity) => {
      const actorInfo = activity.actorId
        ? actorMap.get(activity.actorId.toString()) ?? {}
        : {};
      const taskInfo = activity.taskId
        ? taskMap.get(activity.taskId.toString()) ?? {}
        : {};

      return toActivityFeedItem(activity, {
        actorName: actorInfo.name,
        actorEmail: actorInfo.email,
        actorAvatarUrl: actorInfo.avatarUrl,
        taskTitle: taskInfo.title,
        taskStatus: taskInfo.status,
      });
    });

    const nextCursor =
      hasMore && slicedActivities.length > 0
        ? slicedActivities[slicedActivities.length - 1]._id.toString()
        : null;

    res.status(200).json({
      items: feedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};

export const getActivityItemById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }

    const activity = await ActivityLogModel.findById(id).lean(false).exec();
    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    const [actor, task] = await Promise.all([
      activity.actorId
        ? UserModel.findById(activity.actorId)
            .select("_id name email avatarUrl")
            .lean()
            .exec()
        : Promise.resolve(null),
      activity.taskId
        ? TaskModel.findById(activity.taskId)
            .select("_id title status")
            .lean()
            .exec()
        : Promise.resolve(null),
    ]);

    const item = toActivityFeedItem(activity, {
      actorName: actor?.name,
      actorEmail: actor?.email,
      actorAvatarUrl: actor?.avatarUrl,
      taskTitle: task?.title,
      taskStatus: task?.status,
    });

    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

export const clearActivityForTask = async (
  req: Request<{ taskId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { taskId } = req.params;

    if (!Types.ObjectId.isValid(taskId)) {
      res.status(400).json({ error: "Invalid taskId" });
      return;
    }

    const result = await ActivityLogModel.deleteMany({
      taskId: new Types.ObjectId(taskId),
    }).exec();

    res.status(200).json({