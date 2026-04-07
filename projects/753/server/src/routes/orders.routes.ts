import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';

type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

interface AuthUser {
  id: string;
  role: 'user' | 'admin';
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
  refundAmount?: number | null;
  refundReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface OrderRepository {
  findByUserId(userId: string): Promise<Order[]>;
  findByIdForUser(orderId: string, userId: string): Promise<Order | null>;
  findById(orderId: string): Promise<Order | null>;
  findAll(options?: {
    limit?: number;
    offset?: number;
    status?: OrderStatus;
    userId?: string;
  }): Promise<{ data: Order[]; total: number }>;
  updateStatus(orderId: string, status: OrderStatus): Promise<Order | null>;
  applyRefund(orderId: string, refundAmount: number, refundReason?: string): Promise<Order | null>;
}

interface OrdersRouteDeps {
  orderRepository: OrderRepository;
  requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
  requireAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
}

const adminListQuerySchema = z.object({
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((n) => !Number.isNaN(n) && n > 0 && n <= 100, {
      message: 'limit must be a positive integer between 1 and 100',
    })
    .optional(),
  offset: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((n) => !Number.isNaN(n) && n >= 0, {
      message: 'offset must be a non-negative integer',
    })
    .optional(),
  status: z
    .enum(['pending', 'processing', 'completed', 'cancelled', 'refunded'])
    .optional(),
  userId: z.string().min(1).optional(),
});

const adminUpdateBodySchema = z
  .object({
    status: z.enum(['pending', 'processing', 'completed', 'cancelled', 'refunded']).optional(),
    refundAmount: z
      .number()
      .nonnegative()
      .max(1_000_000)
      .optional(),
    refundReason: z.string().max(1024).optional(),
  })
  .refine(
    (body) => body.status !== undefined || body.refundAmount !== undefined,
    {
      message: 'At least one of status or refundAmount must be provided',
      path: ['status'],
    }
  )
  .refine(
    (body) =>
      body.refundAmount === undefined ||
      (body.refundAmount !== undefined && body.refundReason !== undefined && body.refundReason.trim().length > 0),
    {
      message: 'refundReason is required when refundAmount is provided',
      path: ['refundReason'],
    }
  );

function mapOrderToResponse(order: Order) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    total: order.total,
    currency: order.currency,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items,
    refundAmount: order.refundAmount ?? null,
    refundReason: order.refundReason ?? null,
    metadata: order.metadata ?? null,
  };
}

function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

export function createOrdersRouter(deps: OrdersRouteDeps): Router {
  const { orderRepository, requireAuth, requireAdmin } = deps;
  const router = Router();

  router.get(
    '/orders',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Unauthorized',
          });
        }

        const orders = await orderRepository.findByUserId(req.user.id);
        const response = orders.map(mapOrderToResponse);
        return res.status(StatusCodes.OK).json(response);
      } catch (error) {
        return next(error);
      }
    }
  );

  router.get(
    '/orders/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Unauthorized',
          });
        }

        const orderId = req.params.id;
        if (!orderId) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Order id is required',
          });
        }

        const order = await orderRepository.findByIdForUser(orderId, req.user.id);
        if (!order) {
          return res.status(StatusCodes.NOT_FOUND).json({
            error: 'Order not found',
          });
        }

        return res.status(StatusCodes.OK).json(mapOrderToResponse(order));
      } catch (error) {
        return next(error);
      }
    }
  );

  router.get(
    '/admin/orders',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const parseResult = adminListQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid query parameters',
            details: parseResult.error.flatten(),
          });
        }

        const { limit = 20, offset = 0, status, userId } = parseResult.data;

        const { data, total } = await orderRepository.findAll({
          limit,
          offset,
          status,
          userId,
        });

        return res.status(StatusCodes.OK).json({
          data: data.map(mapOrderToResponse),
          pagination: {
            total,
            limit,
            offset,
          },
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  router.patch(
    '/admin/orders/:id',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const orderId = req.params.id;
        if (!orderId) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Order id is required',
          });
        }

        const parseResult = adminUpdateBodySchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid request body',
            details: parseResult.error.flatten(),
          });
        }

        const { status, refundAmount, refundReason } = parseResult.data;

        const existingOrder = await orderRepository.findById(orderId);
        if (!existingOrder) {
          return res.status(StatusCodes.NOT_FOUND).json({
            error: 'Order not found',
          });
        }

        let updatedOrder: Order | null = existingOrder;

        if (status && status !== existingOrder.status) {
          updatedOrder = await orderRepository.updateStatus(orderId, status);
          if (!updatedOrder) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              error: 'Failed to update order status',
            });
          }
        }

        if (refundAmount !== undefined) {
          const targetOrder = updatedOrder ?? existingOrder;
          if (refundAmount > targetOrder.total) {
            return res.status(StatusCodes.BAD_REQUEST).json({
              error: 'Refund amount cannot exceed order total',
            });
          }

          const refundUpdatedOrder = await orderRepository.applyRefund(
            orderId,
            refundAmount,
            refundReason
          );

          if (!refundUpdatedOrder) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              error: 'Failed to apply refund',
            });
          }

          updatedOrder = refundUpdatedOrder;
        }

        if (!updatedOrder) {
          const reloaded = await orderRepository.findById(orderId);
          if (!reloaded) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              error: 'Order updated but could not be reloaded',
            });
          }
          updatedOrder = reloaded;
        }

        return res.status(StatusCodes.OK).json(mapOrderToResponse(updatedOrder));
      } catch (error) {
        if (isZodError(error)) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid request',
            details: error.flatten(),
          });
        }
        return next(error);
      }
    }
  );

  return router;
}