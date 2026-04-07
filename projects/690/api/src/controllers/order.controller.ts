import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { Types } from "mongoose";
import { OrderService } from "../services/order.service";
import { NotificationService } from "../services/notification.service";
import { ApiError } from "../utils/ApiError";
import { catchAsync } from "../utils/catchAsync";
import { logger } from "../utils/logger";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    name?: string;
  };
}

const orderService = new OrderService();
const notificationService = new NotificationService();

export const createOrder = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    const userId = new Types.ObjectId(req.user.id);
    const { items, shippingAddress, paymentMethod, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Order items are required");
    }

    const order = await orderService.createOrder({
      userId,
      items,
      shippingAddress,
      paymentMethod,
      notes,
    });

    try {
      await notificationService.sendOrderCreated({
        userId: req.user.id,
        orderId: order.id,
        email: req.user.email,
      });
    } catch (err) {
      logger.warn("Failed to send order created notification", {
        error: (err as Error).message,
        orderId: order.id,
      });
    }

    res.status(httpStatus.CREATED).json({
      success: true,
      data: order,
    });
  }
);

export const getUserOrders = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    const userId = new Types.ObjectId(req.user.id);
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as {
      page?: string | number;
      limit?: string | number;
      status?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc" | string;
    };

    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;

    const result = await orderService.getUserOrders({
      userId,
      page: numericPage,
      limit: numericLimit,
      status,
      sortBy,
      sortOrder: sortOrder === "asc" ? "asc" : "desc",
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  }
);

export const getAdminOrders = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id || req.user.role !== "admin") {
      return next(new ApiError(httpStatus.FORBIDDEN, "Forbidden"));
    }

    const {
      page = 1,
      limit = 50,
      status,
      userId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as {
      page?: string | number;
      limit?: string | number;
      status?: string;
      userId?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc" | string;
    };

    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 50;

    const result = await orderService.getAdminOrders({
      page: numericPage,
      limit: numericLimit,
      status,
      userId,
      sortBy,
      sortOrder: sortOrder === "asc" ? "asc" : "desc",
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  }
);

export const getOrderById = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { orderId } = req.params;

    if (!Types.ObjectId.isValid(orderId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid order ID");
    }

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    const isOwner = req.user?.id && order.userId.toString() === req.user.id;
    const isAdmin = req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: order,
    });
  }
);

export const updateOrderStatus = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id || req.user.role !== "admin") {
      return next(new ApiError(httpStatus.FORBIDDEN, "Forbidden"));
    }

    const { orderId } = req.params;
    const { status, trackingNumber } = req.body as {
      status: string;
      trackingNumber?: string;
    };

    if (!Types.ObjectId.isValid(orderId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid order ID");
    }

    if (!status) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Status is required");
    }

    const updatedOrder = await orderService.updateOrderStatus(orderId, {
      status,
      trackingNumber,
      updatedBy: req.user.id,
    });

    if (!updatedOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    try {
      await notificationService.sendOrderStatusUpdated({
        userId: updatedOrder.userId.toString(),
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        email: updatedOrder.user?.email,
      });
    } catch (err) {
      logger.warn("Failed to send order status update notification", {
        error: (err as Error).message,
        orderId: updatedOrder.id,
      });
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: updatedOrder,
    });
  }
);

export const cancelOrder = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    const { orderId } = req.params;

    if (!Types.ObjectId.isValid(orderId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid order ID");
    }

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    const isOwner = order.userId.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    }

    const cancelledOrder = await orderService.cancelOrder(orderId, {
      cancelledBy: req.user.id,
      role: req.user.role,
    });

    try {
      await notificationService.sendOrderCancelled({
        userId: cancelledOrder.userId.toString(),
        orderId: cancelledOrder.id,
        email: cancelledOrder.user?.email,
        cancelledByAdmin: req.user.role === "admin",
      });
    } catch (err) {
      logger.warn("Failed to send order cancellation notification", {
        error: (err as Error).message,
        orderId: cancelledOrder.id,
      });
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: cancelledOrder,
    });
  }
);

export const reorder = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    const { orderId } = req.params;

    if (!Types.ObjectId.isValid(orderId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid order ID");
    }

    const originalOrder = await orderService.getOrderById(orderId);

    if (!originalOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    if (originalOrder.userId.toString() !== req.user.id) {
      throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
    }

    const newOrder = await orderService.reorder({
      originalOrderId: orderId,
      userId: new Types.ObjectId(req.user.id),
    });

    try {
      await notificationService.sendOrderCreated({
        userId: req.user.id,
        orderId: newOrder.id,
        email: req.user.email,