import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../models/user.model';
import { Order, OrderDocument } from '../models/order.model';
import { InventoryItem, InventoryItemDocument } from '../models/inventory-item.model';
import { validateRequest } from '../middleware/validate-request.middleware';
import { BadRequestError, NotFoundError } from '../errors';
import { logger } from '../services/logger.service';

const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole(UserRole.ADMIN));

adminRouter.get(
  '/orders',
  [
    query('status')
      .optional()
      .isString()
      .withMessage('Status must be a string'),
    query('userId')
      .optional()
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage('Invalid userId'),
    query('from')
      .optional()
      .isISO8601()
      .withMessage('from must be a valid ISO-8601 date'),
    query('to')
      .optional()
      .isISO8601()
      .withMessage('to must be a valid ISO-8601 date'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        status,
        userId,
        from,
        to,
        page = 1,
        limit = 20,
      }: {
        status?: string;
        userId?: string;
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
      } = req.query as any;

      const filter: Record<string, unknown> = {};

      if (status) {
        filter.status = status;
      }

      if (userId) {
        filter.userId = new Types.ObjectId(userId);
      }

      if (from || to) {
        filter.createdAt = {};
        if (from) {
          (filter.createdAt as any).$gte = new Date(from);
        }
        if (to) {
          (filter.createdAt as any).$lte = new Date(to);
        }
      }

      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<OrderDocument[]>(),
        Order.countDocuments(filter),
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
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.get(
  '/orders/:id',
  [
    param('id')
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage('Invalid order id'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const order = await Order.findById(id)
        .populate('userId', 'email name')
        .populate('items.productId')
        .lean<OrderDocument | null>();

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.patch(
  '/orders/:id/status',
  [
    param('id')
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage('Invalid order id'),
    body('status')
      .isString()
      .isIn(['pending', 'processing', 'shipped', 'completed', 'cancelled'])
      .withMessage('Invalid status value'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: string };

      const order = await Order.findById(id);

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const previousStatus = order.status;
      order.status = status as OrderDocument['status'];
      await order.save();

      logger.info('Order status updated by admin', {
        orderId: order._id.toString(),
        previousStatus,
        newStatus: status,
        adminId: req.currentUser?.id,
      });

      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.get(
  '/inventory',
  [
    query('sku')
      .optional()
      .isString()
      .withMessage('sku must be a string'),
    query('name')
      .optional()
      .isString()
      .withMessage('name must be a string'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt(),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        sku,
        name,
        page = 1,
        limit = 50,
      }: {
        sku?: string;
        name?: string;
        page?: number;
        limit?: number;
      } = req.query as any;

      const filter: Record<string, unknown> = {};

      if (sku) {
        filter.sku = { $regex: sku, $options: 'i' };
      }

      if (name) {
        filter.name = { $regex: name, $options: 'i' };
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        InventoryItem.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<InventoryItemDocument[]>(),
        InventoryItem.countDocuments(filter),
      ]);

      res.status(200).json({
        data: items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.patch(
  '/inventory/:id',
  [
    param('id')
      .custom((value) => Types.ObjectId.isValid(value))
      .withMessage('Invalid inventory item id'),
    body('quantity')
      .optional()
      .isInt({ min: 0 })
      .withMessage('quantity must be a non-negative integer')
      .toInt(),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('price must be a non-negative number')
      .toFloat(),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('name must be a non-empty string'),
    body('sku')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('sku must be a non-empty string'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body as Partial<Pick<InventoryItemDocument, 'quantity' | 'price' | 'name' | 'sku'>>;

      if (Object.keys(updates).length === 0) {
        throw new BadRequestError('No fields provided to update');
      }

      const item = await InventoryItem.findById(id);

      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }

      const previous = {
        quantity: item.quantity,
        price: item.price,
        name: item.name,
        sku: item.sku,
      };

      if (typeof updates.quantity === 'number') {
        item.quantity = updates.quantity;
      }
      if (typeof updates.price === 'number') {
        item.price = updates.price;
      }
      if (typeof updates.name === 'string') {
        item.name = updates.name;
      }
      if (typeof updates.sku === 'string') {
        item.sku = updates.sku;
      }

      await item.save();

      logger.info('Inventory item updated by admin', {
        itemId: item._id.toString(),
        previous,
        updates,
        adminId: req.currentUser?.id,
      });

      res.status(200).json({ data: item });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.post(
  '/inventory',
  [
    body('name')
      .isString()