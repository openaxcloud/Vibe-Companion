import express, { Request, Response, NextFunction, Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import type { ParamsDictionary } from "express-serve-static-core";

const activityRouter: Router = express.Router();

type ActivityType = "created" | "updated" | "deleted" | "comment" | "status_change";

interface ActivityFeedItem {
  id: string;
  projectId: string;
  taskId?: string | null;
  userId: string;
  type: ActivityType;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface ActivityQuery {
  page: number;
  limit: number;
  userId?: string;
  type?: ActivityType;
}

interface AuthenticatedRequest<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = any>
  extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    id: string;
    role: string;
  };
}

const activityTypeSchema = z.enum(["created", "updated", "deleted", "comment", "status_change"]);

const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = Number(val);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = Number(val);
      return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 20;
    }),
  userId: z.string().optional(),
  type: activityTypeSchema.optional(),
});

function parseActivityQuery(query: Request["query"]): ActivityQuery {
  const result = paginationSchema.safeParse(query);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(", ");
    const error = new Error(`Invalid query parameters: undefined`);
    (error as any).status = StatusCodes.BAD_REQUEST;
    throw error;
  }
  const { page, limit, userId, type } = result.data;
  return {
    page,
    limit,
    userId,
    type,
  };
}

async function fetchProjectActivities(
  projectId: string,
  query: ActivityQuery
): Promise<PaginatedResult<ActivityFeedItem>> {
  const mockTotal = 0;
  const items: ActivityFeedItem[] = [];

  return {
    items,
    total: mockTotal,
    page: query.page,
    limit: query.limit,
  };
}

async function fetchTaskActivities(
  projectId: string,
  taskId: string,
  query: ActivityQuery
): Promise<PaginatedResult<ActivityFeedItem>> {
  const mockTotal = 0;
  const items: ActivityFeedItem[] = [];

  return {
    items,
    total: mockTotal,
    page: query.page,
    limit: query.limit,
  };
}

function asyncHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
>(
  fn: (req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => Promise<unknown>
) {
  return (req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

activityRouter.get<
  { projectId: string },
  PaginatedResult<ActivityFeedItem>,
  never,
  {
    page?: string;
    limit?: string;
    userId?: string;
    type?: ActivityType;
  }
>(
  "/projects/:projectId/activity",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const query = parseActivityQuery(req.query);
    const result = await fetchProjectActivities(projectId, query);
    res.status(StatusCodes.OK).json(result);
  })
);

activityRouter.get<
  { projectId: string; taskId: string },
  PaginatedResult<ActivityFeedItem>,
  never,
  {
    page?: string;
    limit?: string;
    userId?: string;
    type?: ActivityType;
  }
>(
  "/projects/:projectId/tasks/:taskId/activity",
  asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const query = parseActivityQuery(req.query);
    const result = await fetchTaskActivities(projectId, taskId, query);
    res.status(StatusCodes.OK).json(result);
  })
);

export default activityRouter;