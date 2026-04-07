import express, { Request, Response, NextFunction, Router } from "express";
import { isValidObjectId } from "mongoose";
import { body, param, query, validationResult } from "express-validator";
import { OrderStatus } from "../types/orderTypes";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { adminOnlyMiddleware } from "../middleware/adminOnlyMiddleware";
import { OrderService } from "../services/OrderService";
import { ApiError } from "../utils/ApiError";
import { parseISO, isValid as isValidDate } from "date-fns";

const router: Router = express.Router();
const orderService = new OrderService();

const handleValidationErrors = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ApiError(400, "Validation error", {
        errors: errors.array().map((e) => ({ field: e.param, message: e.msg })),
      })
    );
  }
  next();
};

const validateObjectIdParam = (name: string) =>
  param(name)
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid id format");

const parseDateQuery = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = parseISO(value);
  if (!isValidDate(date)) {
    throw new Error("Invalid date format, expected ISO 8601");
  }
  return date;
};

// GET /orders/me - list current user orders with optional filters
router.get(
  "/me",
  authMiddleware,
  [
    query("status")
      .optional()
      .isIn(Object.values(OrderStatus))
      .withMessage(`Status must be one of: undefined`),
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be a valid ISO 8601 date string"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be a valid ISO 8601 date string"),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as OrderStatus | undefined;
      const fromDate = req.query.fromDate ? parseDateQuery(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? parseDateQuery(req.query.toDate as string) : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await orderService.listUserOrders({
        userId,
        status,
        fromDate,
        toDate,
        pagination: { page, limit },
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /orders/me/:orderId - get current user order detail
router.get(
  "/me/:orderId",
  authMiddleware,
  [validateObjectIdParam("orderId"), handleValidationErrors],
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { orderId } = req.params;

      const order = await orderService.getUserOrderDetail(userId, orderId);
      if (!order) {
        throw new ApiError(404, "Order not found");
      }

      res.status(200).json(order);
    } catch (err) {
      next(err);
    }
  }
);

// Admin routes
// GET /orders/admin - admin dashboard listing with filters
router.get(
  "/admin",
  authMiddleware,
  adminOnlyMiddleware,
  [
    query("status")
      .optional()
      .isIn(Object.values(OrderStatus))
      .withMessage(`Status must be one of: undefined`),
    query("fromDate")
      .optional()
      .isISO8601()
      .withMessage("fromDate must be a valid ISO 8601 date string"),
    query("toDate")
      .optional()
      .isISO8601()
      .withMessage("toDate must be a valid ISO 8601 date string"),
    query("userId")
      .optional()
      .custom((value) => isValidObjectId(value))
      .withMessage("Invalid userId format"),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
    query("sortBy")
      .optional()
      .isIn(["createdAt", "updatedAt", "total", "status"])
      .withMessage("Invalid sortBy value"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("sortOrder must be 'asc' or 'desc'"),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.query.status as OrderStatus | undefined;
      const fromDate = req.query.fromDate ? parseDateQuery(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? parseDateQuery(req.query.toDate as string) : undefined;
      const userId = req.query.userId as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const sortBy = (req.query.sortBy as string | undefined) ?? "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc" | undefined) ?? "desc";

      const result = await orderService.listAllOrders({
        status,
        fromDate,
        toDate,
        userId,
        pagination: { page, limit },
        sort: { sortBy, sortOrder },
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /orders/admin/:orderId - admin order detail
router.get(
  "/admin/:orderId",
  authMiddleware,
  adminOnlyMiddleware,
  [validateObjectIdParam("orderId"), handleValidationErrors],
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderId } = req.params;
      const order = await orderService.getOrderById(orderId);

      if (!order) {
        throw new ApiError(404, "Order not found");
      }

      res.status(200).json(order);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /orders/admin/:orderId/status - update order status
router.patch(
  "/admin/:orderId/status",
  authMiddleware,
  adminOnlyMiddleware,
  [
    validateObjectIdParam("orderId"),
    body("status")
      .notEmpty()
      .withMessage("status is required")
      .isIn(Object.values(OrderStatus))
      .withMessage(`Status must be one of: undefined`),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { status } = req.body as { status: OrderStatus };

      const updated = await orderService.updateOrderStatus(orderId, status);

      if (!updated) {
        throw new ApiError(404, "Order not found");
      }

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;