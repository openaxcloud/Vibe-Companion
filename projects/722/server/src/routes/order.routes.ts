import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { OrderModel, OrderDocument, OrderStatus } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

type TypedRequestQuery<T> = Request<unknown, unknown, unknown, T>;
type TypedRequestParams<T> = Request<T>;
type TypedRequestBody<T> = Request<unknown, unknown, T>;
type TypedRequest<TParams, TResBody, TReqBody, TReqQuery> = Request<
  TParams,
  TResBody,
  TReqBody,
  TReqQuery
>;

interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UserOrdersQuery extends PaginationQuery {
  status?: OrderStatus;
}

interface AdminOrdersQuery extends PaginationQuery {
  userId?: string;
  status?: OrderStatus;
  fromDate?: string;
  toDate?: string;
}

interface UpdateOrderStatusBody {
  status: OrderStatus;
  note?: string;
}

const handleValidation = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }
  next();
};

// GET /orders - list orders for authenticated user
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(Object.values(OrderStatus)),
    query('sortBy').optional().isIn(['createdAt', 'total', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    handleValidation
  ],
  asyncHandler(
    async (
      req: TypedRequestQuery<UserOrdersQuery>,
      res: Response
    ): Promise<void> => {
      const userId = (req as any).user.id as string;

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const filters: Record<string, unknown> = {
        user: new Types.ObjectId(userId)
      };

      if (req.query.status) {
        filters.status = req.query.status;
      }

      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

      const [orders, total] = await Promise.all([
        OrderModel.find(filters)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        OrderModel.countDocuments(filters)
      ]);

      res.json({
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }
  )
);

// GET /orders/:id - get order details for authenticated user
router.get(
  '/:id',
  authenticate,
  [param('id').isMongoId(), handleValidation],
  asyncHandler(
    async (
      req: TypedRequestParams<{ id: string }>,
      res: Response
    ): Promise<void> => {
      const userId = (req as any).user.id as string;
      const orderId = req.params.id;

      const order = await OrderModel.findById(orderId).lean().exec();
      if (!order) {
        throw new ApiError(404, 'Order not found');
      }

      const isOwner = String(order.user) === String(userId);
      const isAdmin = (req as any).user.roles?.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new ApiError(403, 'You do not have access to this order');
      }

      res.json({ data: order });
    }
  )
);

// ADMIN ROUTES

// GET /admin/orders - list all orders (admin only)
router.get(
  '/admin',
  authenticate,
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('userId').optional().isMongoId(),
    query('status').optional().isIn(Object.values(OrderStatus)),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('sortBy').optional().isIn(['createdAt', 'total', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    handleValidation
  ],
  asyncHandler(
    async (
      req: TypedRequestQuery<AdminOrdersQuery>,
      res: Response
    ): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const filters: Record<string, unknown> = {};

      if (req.query.userId) {
        filters.user = new Types.ObjectId(req.query.userId);
      }
      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.fromDate || req.query.toDate) {
        filters.createdAt = {};
        if (req.query.fromDate) {
          (filters.createdAt as any).$gte = new Date(req.query.fromDate);
        }
        if (req.query.toDate) {
          (filters.createdAt as any).$lte = new Date(req.query.toDate);
        }
      }

      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

      const [orders, total] = await Promise.all([
        OrderModel.find(filters)
          .populate('user', '_id name email')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        OrderModel.countDocuments(filters)
      ]);

      res.json({
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }
  )
);

// PATCH /admin/orders/:id/status - update order status (admin only)
router.patch(
  '/admin/:id/status',
  authenticate,
  authorize('admin'),
  [
    param('id').isMongoId(),
    body('status')
      .isIn(Object.values(OrderStatus))
      .withMessage('Invalid order status'),
    body('note').optional().isString().isLength({ max: 500 }),
    handleValidation
  ],
  asyncHandler(
    async (
      req: TypedRequest<{ id: string }, unknown, UpdateOrderStatusBody, unknown>,
      res: Response
    ): Promise<void> => {
      const orderId = req.params.id;
      const { status, note } = req.body;

      const order = await OrderModel.findById(orderId).exec();
      if (!order) {
        throw new ApiError(404, 'Order not found');
      }

      const previousStatus = order.status;

      if (previousStatus === status) {
        res.json({ data: order });
        return;
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new ApiError(400, 'Cannot update a cancelled order');
      }

      if (
        previousStatus === OrderStatus.DELIVERED &&
        status !== OrderStatus.DELIVERED
      ) {
        throw new ApiError(400, 'Delivered orders cannot be reverted');
      }

      order.status = status;
      if (note) {
        order.statusHistory.push({
          status,
          note,
          changedBy: (req as any).user.id,
          changedAt: new Date()
        });
      } else {
        order.statusHistory.push({
          status,
          changedBy: (req as any).user.id,
          changedAt: new Date()
        });
      }

      await order.save();

      logger.info('Order status updated', {
        orderId: order._id.toString(),
        previousStatus,
        newStatus: status,
        adminId: (req as any).user.id
      });

      const populatedOrder = await OrderModel.findById(order._id)
        .populate('user', '_id name email')
        .lean()
        .exec();

      res.json({ data: populatedOrder });
    }
  )
);

export default router;