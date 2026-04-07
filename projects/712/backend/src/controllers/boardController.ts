import { Request, Response, NextFunction } from "express";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AuthedRequest = Request & {
  user?: {
    id: string;
    orgId?: string | null;
  };
};

type BoardSnapshotColumn = {
  id: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

type BoardSnapshotTask = {
  id: string;
  title: string;
  description: string | null;
  columnId: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

type BoardSnapshotResponse = {
  boardId: string;
  name: string;
  columns: BoardSnapshotColumn[];
  tasks: BoardSnapshotTask[];
};

type ReorderTaskOperation = {
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  fromPosition: number;
  toPosition: number;
};

type ReorderColumnOperation = {
  columnId: string;
  fromPosition: number;
  toPosition: number;
};

type ReorderBoardPayload = {
  boardId: string;
  taskMoves?: ReorderTaskOperation[];
  columnMoves?: ReorderColumnOperation[];
  version?: number;
};

const ensureAuth = (req: AuthedRequest) => {
  if (!req.user || !req.user.id) {
    const error = new Error("Unauthorized");
    // @ts-expect-error add custom statusCode
    error.statusCode = 401;
    throw error;
  }
};

const assertBoardAccess = async (boardId: string, userId: string) => {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      members: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!board) {
    const error = new Error("Board not found or access denied");
    // @ts-expect-error add custom statusCode
    error.statusCode = 404;
    throw error;
  }
};

export const getBoardSnapshot = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    ensureAuth(req);

    const boardId = req.params.boardId;
    if (!boardId) {
      res.status(400).json({ error: "Missing boardId parameter" });
      return;
    }

    await assertBoardAccess(boardId, req.user!.id);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        name: true,
        columns: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            position: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        tasks: {
          orderBy: [
            { column: { position: "asc" } },
            { position: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            title: true,
            description: true,
            columnId: true,
            position: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }

    const response: BoardSnapshotResponse = {
      boardId: board.id,
      name: board.name,
      columns: board.columns,
      tasks: board.tasks,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

const normalizePositions = <T extends { id: string; position: number }>(
  items: T[]
): { id: string; position: number }[] => {
  return items
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({
      id: item.id,
      position: index,
    }));
};

const applyColumnMovesInMemory = (
  columns: { id: string; position: number }[],
  moves: ReorderColumnOperation[]
): { id: string; position: number }[] => {
  const map = new Map<string, { id: string; position: number }>();
  columns.forEach((c) => map.set(c.id, { ...c }));

  for (const move of moves) {
    const col = map.get(move.columnId);
    if (!col) continue;
    col.position = move.toPosition;
  }

  const updated = Array.from(map.values());
  return normalizePositions(updated);
};

const applyTaskMovesInMemory = (
  tasks: { id: string; columnId: string; position: number }[],
  moves: ReorderTaskOperation[]
): { id: string; columnId: string; position: number }[] => {
  const map = new Map<string, { id: string; columnId: string; position: number }>();
  tasks.forEach((t) => map.set(t.id, { ...t }));

  for (const move of moves) {
    const task = map.get(move.taskId);
    if (!task) continue;
    task.columnId = move.toColumnId;
    task.position = move.toPosition;
  }

  const byColumn = new Map<string, { id: string; columnId: string; position: number }[]>();
  Array.from(map.values()).forEach((t) => {
    const list = byColumn.get(t.columnId) ?? [];
    list.push(t);
    byColumn.set(t.columnId, list);
  });

  const result: { id: string; columnId: string; position: number }[] = [];
  for (const [, list] of byColumn.entries()) {
    normalizePositions(list).forEach((t) => {
      result.push({
        id: t.id,
        columnId: list[0].columnId,
        position: t.position,
      });
    });
  }

  return result;
};

export const reorderBoard = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    ensureAuth(req);

    const payload = req.body as ReorderBoardPayload;
    const { boardId, taskMoves = [], columnMoves = [] } = payload;

    if (!boardId) {
      res.status(400).json({ error: "Missing boardId in payload" });
      return;
    }

    if (!Array.isArray(taskMoves) || !Array.isArray(columnMoves)) {
      res.status(400).json({ error: "Invalid payload structure" });
      return;
    }

    await assertBoardAccess(boardId, req.user!.id);

    const result = await prisma.$transaction(async (tx) => {
      const [columns, tasks] = await Promise.all([
        tx.column.findMany({
          where: { boardId },
          select: { id: true, position: true },
          orderBy: { position: "asc" },
        }),
        tx.task.findMany({
          where: { boardId },
          select: { id: true, columnId: true, position: true },
          orderBy: [{ columnId: "asc" }, { position: "asc" }],
        }),
      });

      // Column moves
      const validColumnMoves = columnMoves.filter((move) =>
        columns.some((col) => col.id === move.columnId)
      );

      const finalColumns =
        validColumnMoves.length > 0
          ? applyColumnMovesInMemory(columns, validColumnMoves)
          : normalizePositions(columns);

      const columnUpdates: Prisma.PrismaPromise<any>[] = [];
      for (const col of finalColumns) {
        columnUpdates.push(
          tx.column.update({
            where: { id: col.id },
            data: { position: col.position },
          })
        );
      }

      // Task moves
      const validTaskMoves = taskMoves.filter((move) =>
        tasks.some((t) => t.id === move.taskId)
      );

      const finalTasks =
        validTaskMoves.length > 0
          ? applyTaskMovesInMemory(tasks, validTaskMoves)
          : (() => {
              const byColumn = new Map<
                string,
                { id: string; columnId: string; position: number }[]
              >();
              tasks.forEach((t) => {
                const list = byColumn.get(t.columnId) ?? [];
                list.push({ ...t });
                byColumn.set(t.columnId, list);
              });

              const normalized: { id: string; columnId: string; position: number }[] = [];
              for (const [columnId, list] of byColumn.entries()) {
                normalizePositions(list).forEach((t) =>
                  normalized.push({ ...t, columnId })
                );
              }
              return normalized;
            })();

      const taskUpdates: Prisma.PrismaPromise<any>[] = [];
      for (const task of finalTasks) {
        taskUpdates.push(
          tx.task.update({
            where: { id: task.id },
            data: {
              columnId: task.columnId,
              position: task.position,
            },
          })
        );
      }

      await Promise.all([...columnUpdates, ...taskUpdates]);

      const updatedBoard = await tx.board.findUnique({
        where: