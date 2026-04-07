import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { OrderModel, IOrder, OrderStatus } from '../models/Order';
import { logger } from '../utils/logger';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
    return;
  }
  next();
};

// GET /orders - list current user's orders
router.get(
  '/',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const orders: IOrder[] = await OrderModel.find({ user: userId })
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      res.json({ orders });
    } catch (error) {
      logger.error('Error fetching user orders', { error });
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  }
);

// GET /orders/:id - get specific order (user or admin)
router.get(
  '/:id',
  authMiddleware,
  param('id').custom((value: string) => {
    if (!Types.ObjectId.isValid(value)) {
      throw new Error('Invalid order id');
    }
    return true;
  }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const isAdmin = !!req.user?.isAdmin;

      const query: Record<string, unknown> = { _id: id };
      if (!isAdmin) {
        query.user = userId;
      }

      const order = await OrderModel.findOne(query).lean().exec();

      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      res.json({ order });
    } catch (error) {
      logger.error('Error fetching order detail', { error });
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  }
);

// ADMIN: GET /admin/orders - list all orders
router.get(
  '/admin/all',
  authMiddleware,
  requireAdmin,
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const orders: IOrder[] = await OrderModel.find({})
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      res.json({ orders });
    } catch (error) {
      logger.error('Error fetching all orders', { error });
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  }
);

// ADMIN: PATCH /admin/orders/:id/status - update order status
router.patch(
  '/admin/:id/status',
  authMiddleware,
  requireAdmin,
  [
    param('id').custom((value: string) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order id');
      }
      return true;
    }),
    body('status')
      .isString()
      .custom((value: string) => {
        const allowed: OrderStatus[] = ['pending', 'paid', 'fulfilled', 'canceled'];
        if (!allowed.includes(value as OrderStatus)) {
          throw new Error(`Status must be one of: undefined`);
        }
        return true;
      }),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: OrderStatus };

      const order = await OrderModel.findById(id).exec();

      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      const prevStatus = order.status;
      order.status = status;
      order.updatedAt = new Date();

      await order.save();

      logger.info('Order status updated', {
        orderId: order._id.toString(),
        from: prevStatus,
        to: status,
        adminId: req.user?.id,
      });

      res.json({ order });
    } catch (error) {
      logger.error('Error updating order status', { error });
      res.status(500).json({ message: 'Failed to update order status' });
    }
  }
);

export default router;