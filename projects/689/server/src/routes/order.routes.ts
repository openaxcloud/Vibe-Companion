import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { OrderModel, OrderDocument, OrderStatus } from '../models/order.model';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { PaginatedResult } from '../types/pagination';
import { UserRole, AuthenticatedRequest } from '../types/auth';

const router = Router();

const parsePagination = (req: Request): { page: number; limit: number } => {
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit as string, 10) || 20, 1),
    100
  );
  return { page, limit };
};

const buildOrderFilters = (req: AuthenticatedRequest): Record<string, unknown> => {
  const filters: Record<string, unknown> = {};

  if (req.user?.role !== UserRole.ADMIN) {
    filters.user = req.user?._id;
  }

  if (req.query.status) {
    filters.status = req.query.status;
  }

  if (req.query.fromDate || req.query.toDate) {
    const createdAt: Record<string, Date> = {};
    if (req.query.fromDate) {
      createdAt.$gte = new Date(req.query.fromDate as string);
    }
    if (req.query.toDate) {
      createdAt.$lte = new Date(req.query.toDate as string);
    }
    filters.createdAt = createdAt;
  }

  return filters;
};

const formatOrder = (order: OrderDocument) => {
  const obj = order.toObject({ virtuals: true });
  return obj;
};

// GET /orders - list current user's orders (with pagination)
// Admins can pass ?all=true to list all orders
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = parsePagination(req);
      const skip = (page - 1) * limit;

      const isAdmin = req.user?.role === UserRole.ADMIN;
      const requestAll = req.query.all === 'true' || req.query.all === '1';

      const filters =
        isAdmin && requestAll ? buildOrderFilters({ ...req, user: req.user }) : buildOrderFilters(req);

      const [items, total] = await Promise.all([
        OrderModel.find(filters)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        OrderModel.countDocuments(filters).exec(),
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      const result: PaginatedResult<ReturnType<typeof formatOrder>> = {
        items: items.map(formatOrder),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /orders/:id - get single order by id
// User can access own orders; admin can access any
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid order id' });
      }

      const order = await OrderModel.findById(id).exec();
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const isOwner = order.user.toString() === req.user?._id.toString();
      const isAdmin = req.user?.role === UserRole.ADMIN;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      res.json(formatOrder(order));
    } catch (err) {
      next(err);
    }
  }
);

// GET /orders/admin/all - admin list all orders with pagination
router.get(
  '/admin/all',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = parsePagination(req);
      const skip = (page - 1) * limit;

      const filters = buildOrderFilters(req);

      const [items, total] = await Promise.all([
        OrderModel.find(filters)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        OrderModel.countDocuments(filters).exec(),
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      const result: PaginatedResult<ReturnType<typeof formatOrder>> = {
        items: items.map(formatOrder),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /orders/:id - update order status (admin only)
router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status?: OrderStatus };

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid order id' });
      }

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      const validStatuses: OrderStatus[] = [
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid order status' });
      }

      const order = await OrderModel.findById(id).exec();
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      order.status = status;
      await order.save();

      res.json(formatOrder(order));
    } catch (err) {
      next(err);
    }
  }
);

export default router;