import { Router, Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";
import { PrismaClient, OrderStatus } from "@prisma/client";
import { AuthenticatedRequest } from "../types/auth.types";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import { sendOrderStatusEmail } from "../services/email.service";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();
const router = Router();

type OrderStatusUpdate = Extract<OrderStatus, "PAID" | "FULFILLED" | "CANCELED">;

const mapStatusToEmailTemplate = (status: OrderStatusUpdate): string | null => {
  switch (status) {
    case "PAID":
      return "order_paid";
    case "FULFILLED":
      return "order_fulfilled";
    case "CANCELED":
      return "order_canceled";
    default:
      return null;
  }
};

const handleValidationResult = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
    });
    return;
  }
  next();
};

const validateOrderIdParam = [
  param("id").isString().trim().notEmpty().withMessage("Order ID is required"),
  handleValidationResult,
];

const validateStatusUpdate = [
  param("id").isString().trim().notEmpty().withMessage("Order ID is required"),
  body("status")
    .isString()
    .toUpperCase()
    .isIn(["PAID", "FULFILLED", "CANCELED"])
    .withMessage("Status must be one of: PAID, FULFILLED, CANCELED"),
  handleValidationResult,
];

const validatePagination = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("status").optional().isString().toUpperCase().isIn(["PENDING", "PAID", "FULFILLED", "CANCELED"]),
  handleValidationResult,
];

const getPaginationParams = (req: Request): { page: number; limit: number; skip: number } => {
  const page = (req.query.page as unknown as number) || 1;
  const limit = (req.query.limit as unknown as number) || 20;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

router.get(
  "/orders",
  requireAuth,
  validatePagination,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { page, limit, skip } = getPaginationParams(req);

    const statusFilter = req.query.status as OrderStatus | undefined;

    try {
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: {
            userId,
            ...(statusFilter ? { status: statusFilter } : {}),
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.order.count({
          where: {
            userId,
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        }),
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error("Error fetching user orders", { error, userId });
      res.status(500).json({
        success: false,
        message: "Failed to fetch orders",
      });
    }
  }
);

router.get(
  "/orders/:id",
  requireAuth,
  validateOrderIdParam,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { id } = req.params;

    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order || order.userId !== userId) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      logger.error("Error fetching order", { error, userId, orderId: id });
      res.status(500).json({
        success: false,
        message: "Failed to fetch order",
      });
    }
  }
);

router.get(
  "/admin/orders",
  requireAdmin,
  validatePagination,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page, limit, skip } = getPaginationParams(req);
    const statusFilter = req.query.status as OrderStatus | undefined;
    const userId = req.query.userId as string | undefined;

    try {
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(userId ? { userId } : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.order.count({
          where: {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(userId ? { userId } : {}),
          },
        }),
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error("Error fetching admin orders", { error });
      res.status(500).json({
        success: false,
        message: "Failed to fetch orders",
      });
    }
  }
);

router.patch(
  "/admin/orders/:id",
  requireAdmin,
  validateStatusUpdate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const newStatus = req.body.status as OrderStatusUpdate;

    try {
      const existingOrder = await prisma.order.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!existingOrder) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      if (existingOrder.status === newStatus) {
        res.json({
          success: true,
          data: existingOrder,
          message: "Order status unchanged",
        });
        return;
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "PAID" && existingOrder.paidAt == null
            ? { paidAt: new Date() }
            : {}),
          ...(newStatus === "FULFILLED" && existingOrder.fulfilledAt == null
            ? { fulfilledAt: new Date() }
            : {}),
          ...(newStatus === "CANCELED" && existingOrder.canceledAt == null
            ? { canceledAt: new Date() }
            : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      const templateId = mapStatusToEmailTemplate(newStatus);
      if (templateId && updatedOrder.user?.email) {
        try {
          await sendOrderStatusEmail({
            to: updatedOrder.user.email,
            template: templateId,
            variables: {
              orderId: updatedOrder.id,
              status: updatedOrder.status,
              total: updatedOrder.totalAmount?.toString() ?? "",
              name: updatedOrder.user.name ?? "",
            },
          });
        } catch (emailError) {
          logger.error("Failed to send order status email", {
            error: emailError,
            orderId: updatedOrder.id,
            status: updatedOrder.status,
          });
        }
      }

      res.json({
        success: true,
        data: updatedOrder,
      });
    } catch (error) {
      logger.error("Error updating order status", {
        error,
        orderId: id,
        status: newStatus,
      });