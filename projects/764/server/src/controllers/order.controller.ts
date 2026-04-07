import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { OrderModel } from "../models/order.model";
import { UserModel } from "../models/user.model";
import { sendOrderStatusNotification } from "../services/notification.service";
import { HttpError } from "../utils/http-error";
import { validateObjectId } from "../utils/validators";
import { logger } from "../utils/logger";

type AuthedRequest = Request & {
  user?: {
    id: string;
    role: "user" | "admin";
    email?: string;
  };
};

const parsePagination = (req: Request) => {
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const limit = Math.max(
    Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100),
    1
  );
  return { page, limit, skip: (page - 1) * limit };
};

const parseSort = (req: Request) => {
  const sortBy = (req.query.sortBy as string) || "createdAt";
  const order = (req.query.order as string) === "asc" ? 1 : -1;
  return { [sortBy]: order };
};

export const getUserOrders = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { page, limit, skip } = parsePagination(req);
    const sort = parseSort(req);

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(req.user.id),
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      OrderModel.countDocuments(filter),
    ]);

    res.status(200).json({
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserOrderById = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { orderId } = req.params;
    if (!validateObjectId(orderId)) {
      throw new HttpError(400, "Invalid order ID");
    }

    const order = await OrderModel.findOne({
      _id: orderId,
      userId: new Types.ObjectId(req.user.id),
    })
      .lean()
      .exec();

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
};

export const getAdminOrders = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const { page, limit, skip } = parsePagination(req);
    const sort = parseSort(req);

    const filter: Record<string, unknown> = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.userId && validateObjectId(String(req.query.userId))) {
      filter.userId = new Types.ObjectId(String(req.query.userId));
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) {
        filter.$or = [
          { orderNumber: { $regex: search, $options: "i" } },
          { "shippingAddress.fullName": { $regex: search, $options: "i" } },
          { "shippingAddress.email": { $regex: search, $options: "i" } },
        ];
      }
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      OrderModel.countDocuments(filter),
    ]);

    res.status(200).json({
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminOrderById = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const { orderId } = req.params;
    if (!validateObjectId(orderId)) {
      throw new HttpError(400, "Invalid order ID");
    }

    const order = await OrderModel.findById(orderId).lean().exec();
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const { orderId } = req.params;
    const { status, trackingNumber, note } = req.body as {
      status?: string;
      trackingNumber?: string;
      note?: string;
    };

    if (!validateObjectId(orderId)) {
      throw new HttpError(400, "Invalid order ID");
    }

    if (!status) {
      throw new HttpError(400, "Status is required");
    }

    const allowedStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ];
    if (!allowedStatuses.includes(status)) {
      throw new HttpError(400, "Invalid order status");
    }

    const order = await OrderModel.findById(orderId).exec();
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    const previousStatus = order.status;

    order.status = status as typeof order.status;

    if (trackingNumber !== undefined) {
      order.trackingNumber = trackingNumber || undefined;
    }

    if (note) {
      order.statusHistory.push({
        status: order.status,
        note,
        changedBy: new Types.ObjectId(req.user.id),
        changedAt: new Date(),
      });
    } else if (previousStatus !== order.status) {
      order.statusHistory.push({
        status: order.status,
        changedBy: new Types.ObjectId(req.user.id),
        changedAt: new Date(),
      });
    }

    await order.save();

    try {
      const user = await UserModel.findById(order.userId)
        .select("email firstName lastName")
        .lean()
        .exec();

      if (user && user.email) {
        await sendOrderStatusNotification({
          to: user.email,
          userName: `undefined undefined`.trim(),
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          newStatus: order.status,
          previousStatus,
          trackingNumber: order.trackingNumber,
        });
      }
    } catch (notifyErr) {
      logger.error("Failed to send order status notification", {
        error: notifyErr,
        orderId: String(order._id),
      });
    }

    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
};

export const cancelUserOrder = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { orderId } = req.params;
    if (!validateObjectId(orderId)) {
      throw new HttpError(400, "Invalid order ID");
    }

    const order = await OrderModel.findOne({
      _id: orderId,
      userId: new Types.ObjectId(req.user.id),
    }).exec();

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (!["pending", "processing"].includes(order.status)) {
      throw new HttpError(
        400,
        "Order cannot be cancelled in its current status"
      );
    }

    const previousStatus = order.status;
    order.status = "cancelled";
    order.statusHistory.push({
      status: "cancelled",
      changedBy: new Types.ObjectId(req.user.id),
      changedAt: new Date(),
      note: "Cancelled by user",
    });

    await order.save();

    try {
      const