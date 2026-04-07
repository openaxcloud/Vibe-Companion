import { Request, Response, NextFunction } from 'express';
import { ParsedQs } from 'qs';
import { validationResult, query, param, body } from 'express-validator';
import { Types } from 'mongoose';
import { OrderModel, IOrder, OrderStatus } from '../models/order.model';
import { UserModel, IUser } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { buildPaginationMeta } from '../utils/pagination';
import { isAdminRequest } from '../utils/auth';

interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

interface PaginatedQuery {
  page?: string | string[] | ParsedQs | ParsedQs[];
  limit?: string | string[] | ParsedQs | ParsedQs[];
  search?: string | string[] | ParsedQs | ParsedQs[];
  sortBy?: string | string[] | ParsedQs | ParsedQs[];
  sortOrder?: string | string[] | ParsedQs | ParsedQs[];
  status?: string | string[] | ParsedQs | ParsedQs[];
}

const parseNumber = (value: unknown, defaultValue: number): number => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

const parseString = (value: unknown, defaultValue: string | undefined = undefined): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return defaultValue;
};

const parseSortOrder = (value: unknown, defaultValue: 1 | -1 = -1): 1 | -1 => {
  if (typeof value !== 'string') return defaultValue;
  const v = value.toLowerCase();
  if (v === 'asc' || v === '1') return 1;
  if (v === 'desc' || v === '-1') return -1;
  return defaultValue;
};

const buildOrderSearchFilter = async (
  search: string | undefined,
  status: string | undefined,
  userId?: string,
  isAdmin: boolean = false
) => {
  const filter: Record<string, unknown> = {};

  if (!isAdmin && userId) {
    filter.userId = new Types.ObjectId(userId);
  }

  if (status && Object.values<string>(OrderStatus as unknown as string[]).includes(status)) {
    filter.status = status;
  }

  if (search) {
    const emailRegex = new RegExp(search, 'i');
    const objectIdSearch = Types.ObjectId.isValid(search) ? new Types.ObjectId(search) : null;

    const orConditions: Record<string, unknown>[] = [];

    if (objectIdSearch) {
      orConditions.push({ _id: objectIdSearch });
      orConditions.push({ userId: objectIdSearch });
    }

    const matchedUsers: IUser[] = await UserModel.find({ email: emailRegex }).select('_id').lean();
    if (matchedUsers.length > 0) {
      const userIds = matchedUsers.map((u) => u._id);
      orConditions.push({ userId: { $in: userIds } });
    }

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }
  }

  return filter;
};

// Validators
export const validateListOrders = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('search').optional().isString().trim().isLength({ min: 1 }).withMessage('search must be a non-empty string'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'total', 'status'])
    .withMessage('sortBy must be one of createdAt, total, status'),
  query('sortOrder').optional().isIn(['asc', 'desc', '1', '-1']).withMessage('Invalid sortOrder'),
  query('status')
    .optional()
    .isIn(Object.values(OrderStatus))
    .withMessage(`status must be one of: undefined`),
];

export const validateGetOrderById = [
  param('orderId').isMongoId().withMessage('Invalid orderId'),
];

export const validateUpdateOrderStatus = [
  param('orderId').isMongoId().withMessage('Invalid orderId'),
  body('status')
    .exists()
    .withMessage('status is required')
    .bail()
    .isIn(Object.values(OrderStatus))
    .withMessage(`status must be one of: undefined`),
];

// Controllers

export const listUserOrders = asyncHandler(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  if (!req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { page, limit, search, sortBy, sortOrder, status } = req.query as PaginatedQuery;

  const pageNum = parseNumber(page, 1);
  const limitNum = parseNumber(limit, 20);
  const searchStr = parseString(search);
  const sortField = parseString(sortBy, 'createdAt') as 'createdAt' | 'total' | 'status';
  const sortDir = parseSortOrder(sortOrder, -1);

  const filter = await buildOrderSearchFilter(searchStr, parseString(status), req.user.id, false);

  const sort: Record<string, 1 | -1> = {
    [sortField]: sortDir,
  };

  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .populate('userId', 'email name')
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean<IOrder[]>(),
    OrderModel.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta({
    page: pageNum,
    limit: limitNum,
    total,
  });

  res.status(200).json({
    data: items,
    meta,
  });
});

export const listAllOrders = asyncHandler(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!isAdminRequest(req)) {
    throw new ApiError(403, 'Forbidden');
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  const { page, limit, search, sortBy, sortOrder, status } = req.query as PaginatedQuery;

  const pageNum = parseNumber(page, 1);
  const limitNum = parseNumber(limit, 20);
  const searchStr = parseString(search);
  const sortField = parseString(sortBy, 'createdAt') as 'createdAt' | 'total' | 'status';
  const sortDir = parseSortOrder(sortOrder, -1);

  const filter = await buildOrderSearchFilter(searchStr, parseString(status), undefined, true);

  const sort: Record<string, 1 | -1> = {
    [sortField]: sortDir,
  };

  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .populate('userId', 'email name')
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean<IOrder[]>(),
    OrderModel.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta({
    page: pageNum,
    limit: limitNum,
    total,
  });

  res.status(200).json({
    data: items,
    meta,
  });
});

export const getOrderById = asyncHandler(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Validation failed', errors.array());
  }

  if (!req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { orderId } = req.params;

  const order = await OrderModel.findById(orderId)
    .populate('userId', 'email name')
    .lean<IOrder | null>();

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const isOwner = order.userId && (order.userId as any)._id
    ? String((order.userId as any)._id) === req.user.id
    : String(order.userId) === req.user.id;

  if (!isOwner && !isAdminRequest(req)) {
    throw new ApiError(403, 'Forbidden');
  }

  res.status(200).json({
    data: order,
  });
});

export const updateOrderStatus = asyncHandler(async (req: AuthedRequest