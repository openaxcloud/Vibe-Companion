import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ParsedQs } from "qs";

// Example placeholder imports – in a real application these should point to actual implementations
// Adjust import paths according to your project structure
import { requireAuth } from "../middleware/authMiddleware";
import { validateRequest } from "../middleware/validateRequest";
import { TimeEntryService } from "../services/timeEntryService";
import { ApiError } from "../utils/ApiError";

const router = Router();
const timeEntryService = new TimeEntryService();

type TypedRequestBody<T> = Request<unknown, unknown, T>;
type TypedRequestQuery<T extends ParsedQs> = Request<unknown, unknown, unknown, T>;
type TypedRequestParams<T> = Request<T>;
type TypedRequest<TParams, TResBody, TReqBody, TReqQuery extends ParsedQs> = Request<
  TParams,
  TResBody,
  TReqBody,
  TReqQuery
>;

const createTimeEntrySchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  userId: z.string().min(1, "userId is required"),
  startTime: z.string().datetime({ message: "startTime must be a valid ISO datetime string" }),
  endTime: z
    .string()
    .datetime({ message: "endTime must be a valid ISO datetime string" })
    .optional(),
  durationMinutes: z
    .number()
    .int()
    .positive("durationMinutes must be a positive integer")
    .optional(),
  notes: z.string().max(1000).optional(),
});

const updateTimeEntrySchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const listByTaskQuerySchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
});

const listByUserQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  taskId: z.string().optional(),
});

const paginationQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
    .optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1, "id is required"),
});

const combineQuerySchemas = <T1 extends z.ZodRawShape, T2 extends z.ZodRawShape>(
  s1: z.ZodObject<T1>,
  s2: z.ZodObject<T2>
) => s1.merge(s2);

router.post(
  "/",
  requireAuth,
  validateRequest({ body: createTimeEntrySchema }),
  async (
    req: TypedRequestBody<z.infer<typeof createTimeEntrySchema>>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { taskId, userId, startTime, endTime, durationMinutes, notes } = req.body;

      const timeEntry = await timeEntryService.createTimeEntry({
        taskId,
        userId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        durationMinutes,
        notes: notes ?? undefined,
        createdBy: (req as any).user?.id ?? userId,
      });

      res.status(201).json(timeEntry);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  validateRequest({ params: idParamSchema, body: updateTimeEntrySchema }),
  async (
    req: TypedRequest<{ id: string }, unknown, z.infer<typeof updateTimeEntrySchema>, ParsedQs>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { startTime, endTime, durationMinutes, notes } = req.body;

      const updatedEntry = await timeEntryService.updateTimeEntry(id, {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        durationMinutes,
        notes: notes === null ? null : notes ?? undefined,
        updatedBy: (req as any).user?.id,
      });

      if (!updatedEntry) {
        throw new ApiError(404, "Time entry not found");
      }

      res.json(updatedEntry);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  validateRequest({ params: idParamSchema }),
  async (req: TypedRequestParams<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const deleted = await timeEntryService.deleteTimeEntry(id, {
        deletedBy: (req as any).user?.id,
      });

      if (!deleted) {
        throw new ApiError(404, "Time entry not found");
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/by-task",
  requireAuth,
  validateRequest({
    query: combineQuerySchemas(listByTaskQuerySchema, paginationQuerySchema),
  }),
  async (
    req: TypedRequestQuery<
      z.infer<ReturnType<typeof combineQuerySchemas<z.ZodRawShape, z.ZodRawShape>>>
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = req.query as any;
      const { taskId, startDate, endDate, userId, page, limit } = query;

      const result = await timeEntryService.listTimeEntriesByTask({
        taskId,
        userId: userId ?? undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page ?? 1,
        limit: limit ?? 50,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/by-user",
  requireAuth,
  validateRequest({
    query: combineQuerySchemas(listByUserQuerySchema, paginationQuerySchema),
  }),
  async (
    req: TypedRequestQuery<
      z.infer<ReturnType<typeof combineQuerySchemas<z.ZodRawShape, z.ZodRawShape>>>
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = req.query as any;
      const { userId, startDate, endDate, taskId, page, limit } = query;

      const result = await timeEntryService.listTimeEntriesByUser({
        userId,
        taskId: taskId ?? undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page ?? 1,
        limit: limit ?? 50,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;