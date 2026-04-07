import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { Types } from "mongoose";
import { BoardModel } from "../models/Board";
import { ProjectModel } from "../models/Project";
import { ColumnModel } from "../models/Column";
import { TaskModel } from "../models/Task";
import { authenticate } from "../middleware/authenticate";
import { authorizeProjectAccess } from "../middleware/authorizeProjectAccess";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
    });
    return;
  }
  next();
};

router.post(
  "/projects/:projectId/boards",
  authenticate,
  authorizeProjectAccess("projectId"),
  [
    param("projectId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid project ID");
      }
      return true;
    }),
    body("name").trim().isLength({ min: 1 }).withMessage("Board name is required"),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { name } = req.body;

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const lastBoard = await BoardModel.findOne({ project: projectId }).sort({ order: -1 }).lean();
      const newOrder = lastBoard ? lastBoard.order + 1 : 0;

      const board = await BoardModel.create({
        name,
        project: projectId,
        order: newOrder,
        createdBy: req.user?.id,
      });

      res.status(201).json(board);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/projects/:projectId/boards/:boardId",
  authenticate,
  authorizeProjectAccess("projectId"),
  [
    param("projectId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid project ID");
      }
      return true;
    }),
    param("boardId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid board ID");
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, boardId } = req.params;

      const board = await BoardModel.findOne({
        _id: boardId,
        project: projectId,
      })
        .lean()
        .exec();

      if (!board) {
        res.status(404).json({ message: "Board not found" });
        return;
      }

      const columns = await ColumnModel.find({ board: boardId })
        .sort({ order: 1 })
        .lean()
        .exec();

      const columnIds = columns.map((c) => c._id);
      const tasks = await TaskModel.find({ column: { $in: columnIds } })
        .sort({ order: 1 })
        .lean()
        .exec();

      const tasksByColumn: Record<string, any[]> = {};
      for (const task of tasks) {
        const key = String(task.column);
        if (!tasksByColumn[key]) {
          tasksByColumn[key] = [];
        }
        tasksByColumn[key].push(task);
      }

      const columnsWithTasks = columns.map((column) => ({
        ...column,
        tasks: tasksByColumn[String(column._id)] || [],
      }));

      res.json({
        ...board,
        columns: columnsWithTasks,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/projects/:projectId/boards/:boardId/columns/order",
  authenticate,
  authorizeProjectAccess("projectId"),
  [
    param("projectId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid project ID");
      }
      return true;
    }),
    param("boardId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid board ID");
      }
      return true;
    }),
    body("columnOrder")
      .isArray({ min: 1 })
      .withMessage("columnOrder must be a non-empty array of column IDs"),
    body("columnOrder.*").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid column ID in columnOrder");
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, boardId } = req.params;
      const { columnOrder } = req.body as { columnOrder: string[] };

      const board = await BoardModel.findOne({ _id: boardId, project: projectId });
      if (!board) {
        res.status(404).json({ message: "Board not found" });
        return;
      }

      const columns = await ColumnModel.find({ board: boardId }).lean();
      const existingIds = new Set(columns.map((c) => String(c._id)));
      const providedIds = new Set(columnOrder.map((id) => String(id)));

      if (existingIds.size !== providedIds.size || ![...existingIds].every((id) => providedIds.has(id))) {
        res.status(400).json({
          message: "columnOrder must include all and only the existing columns for this board",
        });
        return;
      }

      const bulkOps = columnOrder.map((columnId: string, index: number) => ({
        updateOne: {
          filter: { _id: columnId, board: boardId },
          update: { $set: { order: index } },
        },
      }));

      if (bulkOps.length > 0) {
        await ColumnModel.bulkWrite(bulkOps);
      }

      const updatedColumns = await ColumnModel.find({ board: boardId }).sort({ order: 1 }).lean();
      res.json({ boardId, columns: updatedColumns });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/projects/:projectId/boards/:boardId",
  authenticate,
  authorizeProjectAccess("projectId"),
  [
    param("projectId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid project ID");
      }
      return true;
    }),
    param("boardId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid board ID");
      }
      return true;
    }),
    body("name").optional().trim().isLength({ min: 1 }).withMessage("Board name cannot be empty"),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, boardId } = req.params;
      const { name } = req.body as { name?: string };

      const update: Partial<{ name: string }> = {};
      if (typeof name === "string" && name.trim().length > 0) {
        update.name = name.trim();
      }

      if (Object.keys(update).length === 0) {
        res.status(400).json({ message: "No valid fields to update" });
        return;
      }

      const board = await BoardModel.findOneAndUpdate(
        { _id: boardId, project: projectId },
        { $set: update },
        { new: true }
      ).lean();

      if (!board) {
        res.status(404).json({ message: "Board not found" });
        return;
      }

      res.json(board);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/projects/:projectId/boards",
  authenticate,
  authorizeProjectAccess("projectId"),
  [
    param("projectId").custom((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error("Invalid project ID");
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;

      const boards = await BoardModel.find({ project: projectId }).sort({ order: 1 }).lean();
      res.json(boards);
    } catch (error) {
      next(error);
    }
  }
);

export default