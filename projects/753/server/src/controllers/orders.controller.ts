import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { OrderStatus } from '../types/order.types';
import { OrderService } from '../services/order.service';
import { EmailService } from '../services/email.service';
import { ApiError } from '../utils/ApiError';
import { paginateParamsFromRequest } from '../utils/pagination';
import logger from '../utils/logger';

export class OrdersController {
  private orderService: OrderService;
  private emailService: EmailService;

  constructor(orderService: OrderService, emailService: EmailService) {
    this.orderService = orderService;
    this.emailService = emailService;
  }

  public listUserOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const { page, limit, sortBy, sortOrder } = paginateParamsFromRequest(req);

      const result = await this.orderService.getUserOrders(
        new Types.ObjectId(userId),
        {
          page,
          limit,
          sortBy,
          sortOrder,
        }
      );

      res.status(httpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  public getOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const orderId = req.params.id;
      if (!Types.ObjectId.isValid(orderId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid order id');
      }

      const userId = req.user?.id || req.user?._id;
      const isAdmin = !!req.user?.roles?.includes('admin');

      const order = await this.orderService.getOrderById(
        new Types.ObjectId(orderId),
        isAdmin ? undefined : new Types.ObjectId(userId)
      );

      if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  public adminListOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const isAdmin = !!req.user?.roles?.includes('admin');
      if (!isAdmin) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
      }

      const { page, limit, sortBy, sortOrder } = paginateParamsFromRequest(req);
      const { status, userId } = req.query;

      const filters: {
        status?: OrderStatus;
        userId?: Types.ObjectId;
      } = {};

      if (status && typeof status === 'string') {
        filters.status = status as OrderStatus;
      }

      if (userId && typeof userId === 'string' && Types.ObjectId.isValid(userId)) {
        filters.userId = new Types.ObjectId(userId);
      }

      const result = await this.orderService.getAllOrders({
        page,
        limit,
        sortBy,
        sortOrder,
        filters,
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  public adminUpdateOrderStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const isAdmin = !!req.user?.roles?.includes('admin');
      if (!isAdmin) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
      }

      const orderId = req.params.id;
      if (!Types.ObjectId.isValid(orderId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid order id');
      }

      const { status, trackingNumber, comment } = req.body as {
        status: OrderStatus;
        trackingNumber?: string;
        comment?: string;
      };

      if (!status) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Status is required');
      }

      const existingOrder = await this.orderService.getOrderById(
        new Types.ObjectId(orderId)
      );

      if (!existingOrder) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
      }

      const previousStatus = existingOrder.status;

      const updatedOrder = await this.orderService.updateOrderStatus(
        new Types.ObjectId(orderId),
        {
          status,
          trackingNumber,
          comment,
          updatedBy: req.user?.id || req.user?._id,
        }
      );

      if (!updatedOrder) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to update order status'
        );
      }

      if (previousStatus !== status) {
        this.sendStatusChangeEmailSafe(updatedOrder.id, previousStatus, status).catch(
          (err) => {
            logger.error('Failed to send order status change email', {
              error: err,
              orderId,
              previousStatus,
              newStatus: status,
            });
          }
        );
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  private async sendStatusChangeEmailSafe(
    orderId: string,
    previousStatus: OrderStatus,
    newStatus: OrderStatus
  ): Promise<void> {
    try {
      const populatedOrder = await this.orderService.getOrderById(
        new Types.ObjectId(orderId)
      );

      if (!populatedOrder || !populatedOrder.user?.email) {
        logger.warn('Order or user email not found for status change email', {
          orderId,
        });
        return;
      }

      await this.emailService.sendOrderStatusChangedEmail({
        to: populatedOrder.user.email,
        orderId: populatedOrder.id,
        previousStatus,
        newStatus,
        userName: populatedOrder.user.name,
        items: populatedOrder.items.map((item: any) => ({
          name: item.product?.name || item.name,
          quantity: item.quantity,
        })),
      });
    } catch (error) {
      logger.error('Error sending order status change email', {
        error,
        orderId,
        previousStatus,
        newStatus,
      });
    }
  }
}

const orderService = new OrderService();
const emailService = new EmailService();
const ordersController = new OrdersController(orderService, emailService);

export default ordersController;