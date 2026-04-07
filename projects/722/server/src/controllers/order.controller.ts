import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { OrderModel, OrderDocument, OrderStatus } from '../models/order.model';
import { UserDocument } from '../models/user.model';
import { sendOrderStatusEmail } from '../services/email.service';
import { logger } from '../utils/logger';
import ApiError from '../utils/ApiError';

type AuthenticatedRequest = Request & {
  user?: UserDocument & {
    _id: Types.ObjectId;
    role?: string;
  };
};

const isAdmin = (req: AuthenticatedRequest): boolean => {
  return Boolean(req.user && (req.user.role === 'admin' || req.user.role === 'superadmin'));
};

const validateObjectId = (id: string, fieldName = 'id') => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid undefined format`);
  }
};

const sanitizeOrderForUser = (order: OrderDocument, isAdminUser: boolean) => {
  const orderObject = order.toObject();
  if (!isAdminUser) {
    // Remove any sensitive fields that should not be exposed to regular users
    if ('internalNotes' in orderObject) {
      delete (orderObject as any).internalNotes;
    }
  }
  return orderObject;
};

export const getUserOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    const userId = req.user._id;
    const { page = '1', limit = '20', sort = '-createdAt' } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    const query = { user: userId };

    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .sort(sort as string)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .exec(),
      OrderModel.countDocuments(query).exec(),
    ]);

    const isAdminUser = isAdmin(req);
    const sanitizedOrders = orders.map((order) => sanitizeOrderForUser(order, isAdminUser));

    res.status(httpStatus.OK).json({
      data: sanitizedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    validateObjectId(orderId, 'orderId');

    const order = await OrderModel.findById(orderId).exec();

    if (!order) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
    }

    const isAdminUser = isAdmin(req);

    if (!isAdminUser) {
      if (!req.user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }
      if (order.user.toString() !== req.user._id.toString()) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to access this order');
      }
    }

    const sanitizedOrder = sanitizeOrderForUser(order, isAdminUser);

    res.status(httpStatus.OK).json({
      data: sanitizedOrder,
    });
  } catch (error) {
    next(error);
  }
};

export const adminGetAllOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isAdmin(req)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Admin privileges required');
    }

    const { page = '1', limit = '50', sort = '-createdAt', status, userId } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);

    const query: Record<string, any> = {};

    if (status) {
      query.status = status;
    }

    if (userId) {
      validateObjectId(userId as string, 'userId');
      query.user = userId;
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .sort(sort as string)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .exec(),
      OrderModel.countDocuments(query).exec(),
    ]);

    const sanitizedOrders = orders.map((order) => sanitizeOrderForUser(order, true));

    res.status(httpStatus.OK).json({
      data: sanitizedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isAdmin(req)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Admin privileges required');
    }

    const { orderId } = req.params;
    const { status }: { status: OrderStatus } = req.body;

    validateObjectId(orderId, 'orderId');

    if (!status) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Status is required');
    }

    const validStatuses: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid order status');
    }

    const order = await OrderModel.findById(orderId).populate('user').exec();

    if (!order) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
    }

    const prevStatus = order.status;
    if (prevStatus === status) {
      res.status(httpStatus.OK).json({
        data: sanitizeOrderForUser(order, true),
        message: 'Order status unchanged',
      });
      return;
    }

    order.status = status;
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user?._id || null,
    });

    await order.save();

    const sanitizedOrder = sanitizeOrderForUser(order, true);

    try {
      const userDoc = order.user as UserDocument | undefined;
      if (userDoc && userDoc.email) {
        await sendOrderStatusEmail({
          to: userDoc.email,
          orderId: order._id.toString(),
          newStatus: status,
          previousStatus: prevStatus,
          userName: userDoc.name || undefined,
        });
      }
    } catch (emailError) {
      logger.error('Failed to send order status email', {
        orderId: order._id.toString(),
        error: emailError,
      });
    }

    res.status(httpStatus.OK).json({
      data: sanitizedOrder,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelOwnOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }

    const { orderId } = req.params;
    validateObjectId(orderId, 'orderId');

    const order = await OrderModel.findById(orderId).populate('user').exec();

    if (!order) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
    }

    if (order.user.toString() !== req.user._id.toString() && !isAdmin(req)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to cancel this order');
    }

    if (order.status === 'shipped' || order.status === 'delivered') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Order cannot be cancelled at this stage');
    }

    const prevStatus = order.status;
    order.status = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      changedAt: new Date(),
      changedBy: req.user._id,
    });

    await order.save();

    const sanitizedOrder = sanitizeOrderForUser(order, isAdmin(req));

    try {
      const userDoc = order.user as UserDocument | undefined;
      if (userDoc && userDoc.email) {
        await sendOrderStatusEmail({
          to: userDoc.email,
          orderId: order._id.toString(),
          newStatus: 'cancelled',
          previousStatus: prevStatus,
          userName: userDoc.name || undefined,
        });
      }
    } catch (emailError) {