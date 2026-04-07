import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { OrderService } from '../services/order.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { validateObjectId } from '../utils/validateObjectId';
import { OrderStatus, IOrder, IOrderUpdatePayload } from '../types/order.types';

const orderService = new OrderService();

export class OrderController {
  public async getOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }

      const {
        page = '1',
        limit = '20',
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        customerId,
      } = req.query as {
        page?: string;
        limit?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        customerId?: string;
      };

      const pageNum = Number(page);
      const limitNum = Number(limit);

      if (isNaN(pageNum) || pageNum <= 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid page parameter');
      }

      if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid limit parameter');
      }

      const filters: {
        status?: OrderStatus;
        customerId?: Types.ObjectId;
      } = {};

      if (status) {
        if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid order status');
        }
        filters.status = status as OrderStatus;
      }

      if (customerId) {
        if (!validateObjectId(customerId)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid customerId');
        }
        filters.customerId = new Types.ObjectId(customerId);
      }

      // Non-admin users can only see their own orders
      if (user.role !== 'admin') {
        filters.customerId = new Types.ObjectId(user.id);
      }

      const { results, total, totalPages } = await orderService.getOrders({
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder,
        filters,
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: results,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      });
    } catch (error) {
      logger.error('Error in getOrders controller', { error });
      next(error);
    }
  }

  public async getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }

      const { orderId } = req.params;
      if (!orderId || !validateObjectId(orderId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid orderId parameter');
      }

      const order = await orderService.getOrderById(new Types.ObjectId(orderId));
      if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      // Non-admin users can only access their own orders
      if (user.role !== 'admin' && order.customerId.toString() !== user.id) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this order');
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: order,
      });
    } catch (error) {
      logger.error('Error in getOrderById controller', { error });
      next(error);
    }
  }

  public async updateOrderStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }

      if (user.role !== 'admin' && user.role !== 'manager') {
        throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to update order status');
      }

      const { orderId } = req.params;
      if (!orderId || !validateObjectId(orderId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid orderId parameter');
      }

      const { status }: { status?: OrderStatus } = req.body;

      if (!status) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Status is required');
      }

      if (!Object.values(OrderStatus).includes(status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid order status');
      }

      const updatedOrder = await orderService.updateOrderStatus(new Types.ObjectId(orderId), status, user.id);

      if (!updatedOrder) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: updatedOrder,
      });
    } catch (error) {
      logger.error('Error in updateOrderStatus controller', { error });
      next(error);
    }
  }

  public async updateOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }

      const { orderId } = req.params;
      if (!orderId || !validateObjectId(orderId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid orderId parameter');
      }

      const payload = req.body as IOrderUpdatePayload;

      if (!payload || Object.keys(payload).length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'No update fields provided');
      }

      const existingOrder = await orderService.getOrderById(new Types.ObjectId(orderId));

      if (!existingOrder) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      // Authorization: customer can modify limited fields of their order while pending,
      // admin/manager can update more fields any time
      const isOwner = existingOrder.customerId.toString() === user.id;
      const isPrivileged = user.role === 'admin' || user.role === 'manager';

      if (!isOwner && !isPrivileged) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to update this order');
      }

      if (isOwner && !isPrivileged) {
        if (existingOrder.status !== OrderStatus.PENDING) {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            'You can only update orders that are still pending'
          );
        }

        const allowedCustomerFields: (keyof IOrderUpdatePayload)[] = ['items', 'shippingAddress', 'billingAddress', 'notes'];
        const invalidFields = Object.keys(payload).filter(
          (field) => !allowedCustomerFields.includes(field as keyof IOrderUpdatePayload)
        );
        if (invalidFields.length > 0) {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            `You are not allowed to update the following fields: undefined`
          );
        }
      }

      const updatedOrder: IOrder | null = await orderService.updateOrder(
        new Types.ObjectId(orderId),
        payload,
        user.id
      );

      if (!updatedOrder) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: updatedOrder,
      });
    } catch (error) {
      logger.error('Error in updateOrder controller', { error });
      next(error);
    }
  }

  public async cancelOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
      }

      const { orderId } = req.params;
      if (!orderId || !validateObjectId(orderId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid orderId parameter');
      }

      const existingOrder = await orderService.getOrderById(new Types.ObjectId(orderId));

      if (!existingOrder) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      const isOwner = existingOrder.customerId.toString() === user.id;
      const isPrivileged = user.role === 'admin' || user.role === 'manager';

      if (!isOwner && !isPrivileged) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to cancel this order');
      }

      if (
        existingOrder.status !== OrderStatus.PENDING &&
        existingOrder.status !== OrderStatus.CONFIRMED
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Only pending or confirmed orders can be cancelled