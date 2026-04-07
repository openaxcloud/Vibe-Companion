import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PrismaClient, WorkflowStatus, Task, Column } from '@prisma/client';

const prisma = new PrismaClient();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

interface CreateWorkflowStatusBody {
  name: string;
  color?: string | null;
  description?: string | null;
}

interface UpdateWorkflowStatusBody {
  name?: string;
  color?: string | null;
  description?: string | null;
}

interface ReorderStatusItem {
  id: string;
  order: number;
}

interface ReorderStatusesBody {
  statuses: ReorderStatusItem[];
}

const validateUUID = (id: string | undefined | null): id is string => {
  if (!id) return false;
  // Basic UUID v4 pattern; adjust if needed based on DB
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(id);
};

const asyncHandler =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

const mapWorkflowStatus = (status: WorkflowStatus) => ({
  id: status.id,
  name: status.name,
  color: status.color,
  description: status.description,
  order: status.order,
  createdAt: status.createdAt,
  updatedAt: status.updatedAt,
});

export const getWorkflowStatuses = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const statuses = await prisma.workflowStatus.findMany({
      orderBy: { order: 'asc' },
    });

    res.status(StatusCodes.OK).json(statuses.map(mapWorkflowStatus));
  }
);

export const getWorkflowStatusById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!validateUUID(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status id' });
      return;
    }

    const status = await prisma.workflowStatus.findUnique({
      where: { id },
    });

    if (!status) {
      res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: 'Workflow status not found' });
      return;
    }

    res.status(StatusCodes.OK).json(mapWorkflowStatus(status));
  }
);

export const createWorkflowStatus = asyncHandler(
  async (req: Request<unknown, unknown, CreateWorkflowStatusBody>, res: Response): Promise<void> => {
    const { name, color, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'Name is required and must be a non-empty string' });
      return;
    }

    const existingByName = await prisma.workflowStatus.findFirst({
      where: { name: name.trim() },
    });

    if (existingByName) {
      res
        .status(StatusCodes.CONFLICT)
        .json({ message: 'A workflow status with this name already exists' });
      return;
    }

    const maxOrder = await prisma.workflowStatus.aggregate({
      _max: { order: true },
    });

    const nextOrder = (maxOrder._max.order ?? 0) + 1;

    const created = await prisma.workflowStatus.create({
      data: {
        name: name.trim(),
        color: color ?? null,
        description: description ?? null,
        order: nextOrder,
      },
    });

    res.status(StatusCodes.CREATED).json(mapWorkflowStatus(created));
  }
);

export const updateWorkflowStatus = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, UpdateWorkflowStatusBody>,
    res: Response
  ): Promise<void> => {
    const { id } = req.params;
    const { name, color, description } = req.body;

    if (!validateUUID(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status id' });
      return;
    }

    const existing = await prisma.workflowStatus.findUnique({
      where: { id },
    });

    if (!existing) {
      res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: 'Workflow status not found' });
      return;
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.workflowStatus.findFirst({
        where: {
          name: name.trim(),
          NOT: { id },
        },
      });

      if (duplicate) {
        res
          .status(StatusCodes.CONFLICT)
          .json({ message: 'Another workflow status with this name already exists' });
        return;
      }
    }

    const updated = await prisma.workflowStatus.update({
      where: { id },
      data: {
        name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
        color: color !== undefined ? color : existing.color,
        description: description !== undefined ? description : existing.description,
      },
    });

    res.status(StatusCodes.OK).json(mapWorkflowStatus(updated));
  }
);

export const deleteWorkflowStatus = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!validateUUID(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status id' });
      return;
    }

    const status = await prisma.workflowStatus.findUnique({
      where: { id },
    });

    if (!status) {
      res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: 'Workflow status not found' });
      return;
    }

    const relatedTasks: Task[] = await prisma.task.findMany({
      where: { statusId: id },
      select: { id: true, statusId: true } as any,
    });

    if (relatedTasks.length > 0) {
      res.status(StatusCodes.CONFLICT).json({
        message:
          'Cannot delete workflow status while tasks are assigned to it. Reassign or remove those tasks first.',
        taskCount: relatedTasks.length,
      });
      return;
    }

    const relatedColumns: Column[] = await prisma.column.findMany({
      where: { statusId: id },
      select: { id: true, statusId: true } as any,
    });

    if (relatedColumns.length > 0) {
      res.status(StatusCodes.CONFLICT).json({
        message:
          'Cannot delete workflow status while columns are associated with it. Reassign or remove those columns first.',
        columnCount: relatedColumns.length,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const deletedOrder = status.order;

      await tx.workflowStatus.delete({
        where: { id },
      });

      await tx.workflowStatus.updateMany({
        where: {
          order: {
            gt: deletedOrder,
          },
        },
        data: {
          order: {
            decrement: 1,
          },
        },
      });
    });

    res.status(StatusCodes.NO_CONTENT).send();
  }
);

export const reorderWorkflowStatuses = asyncHandler(
  async (
    req: Request<unknown, unknown, ReorderStatusesBody>,
    res: Response
  ): Promise<void> => {
    const { statuses } = req.body;

    if (!Array.isArray(statuses) || statuses.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message:
          'Request body must contain a non-empty "statuses" array with ids and order values',
      });
      return;
    }

    const invalidItem = statuses.find(
      (item) =>
        !item ||
        typeof item.id !== 'string' ||
        !validateUUID(item.id) ||
        typeof item.order !== 'number' ||
        !Number.isInteger(item.order) ||
        item.order < 0
    );

    if (invalidItem) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message:
          'Each status must include a valid UUID "id" and a non-negative integer "order" value',
      });
      return;
    }

    const ids = statuses.map((s) => s.id);

    const existingStatuses = await prisma.workflowStatus.findMany({
      where: { id: { in: ids } },
      orderBy: { order: 'asc' },
    });

    if (existingStatuses.length !== statuses.length) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message:
          'One or more provided status ids do not exist or are duplicated',
      });
      return;
    }

    const providedOrders = statuses.map((s) => s.order).sort((a, b) => a - b);
    const minOrder = providedOrders[0];
    const maxOrder = providedOrders[providedOrders.length - 1];
    const expectedRange = Array.from(
      { length: providedOrders.length },
      (_, i) => minOrder + i
    );

    const isContiguous =
      providedOrders.length === expectedRange.length &&
      providedOrders.every((val, idx) => val ===