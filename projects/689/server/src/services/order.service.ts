import { PrismaClient, Order, OrderItem, User } from '@prisma/client';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { AuthUser } from '../types/auth.types';
import { ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors';
import { EmailService } from './email.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const orderEvents = new EventEmitter();

export type CreateOrderItemInput = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  userId: string;
  items: CreateOrderItemInput[];
  paymentIntentId: string;
  currency: string;
  amountPaid: number;
};

export type OrderWithRelations = Order & {
  items: (OrderItem & {
    product: {
      id: string;
      name: string;
      sku: string | null;
    };
  })[];
  user: Pick<User, 'id' | 'email' | 'name'>;
};

const createOrderItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive()
});

const createOrderInputSchema = z.object({
  userId: z.string().min(1),
  items: z.array(createOrderItemInputSchema).min(1),
  paymentIntentId: z.string().min(1),
  currency: z.string().min(1),
  amountPaid: z.number().positive()
});

export class OrderService {
  private emailService: EmailService;

  constructor(emailService?: EmailService) {
    this.emailService = emailService ?? new EmailService();
  }

  public on(event: 'order.created', listener: (order: OrderWithRelations) => void): void {
    orderEvents.on(event, listener);
  }

  public off(event: 'order.created', listener: (order: OrderWithRelations) => void): void {
    orderEvents.off(event, listener);
  }

  public async createOrderAfterSuccessfulPayment(input: CreateOrderInput): Promise<OrderWithRelations> {
    const parsed = createOrderInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestError('Invalid order data', parsed.error.flatten());
    }

    const { userId, items, paymentIntentId, currency, amountPaid } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
        sku: true,
        inventory: true,
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      throw new BadRequestError('One or more products not found');
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    let calculatedTotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestError(`Product not found: undefined`);
      }
      if (!product.isActive) {
        throw new BadRequestError(`Product is inactive: undefined`);
      }
      if (product.inventory < item.quantity) {
        throw new BadRequestError(`Insufficient inventory for product: undefined`);
      }
      calculatedTotal += product.price * item.quantity;
    }

    if (Math.round(calculatedTotal) !== Math.round(amountPaid)) {
      logger.warn('Amount mismatch on order creation', {
        calculatedTotal,
        amountPaid,
        userId,
        paymentIntentId
      });
    }

    const order = await prisma.$transaction(async tx => {
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, inventory: true, price: true }
      });
      const dbProductMap = new Map(dbProducts.map(p => [p.id, p]));

      for (const item of items) {
        const product = dbProductMap.get(item.productId);
        if (!product) {
          throw new BadRequestError(`Product not found during transaction: undefined`);
        }
        if (product.inventory < item.quantity) {
          throw new BadRequestError(`Insufficient inventory for product during transaction: undefined`);
        }
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          paymentIntentId,
          currency,
          amountPaid,
          status: 'PAID',
          items: {
            create: items.map(item => {
              const product = productMap.get(item.productId);
              if (!product) {
                throw new BadRequestError(`Product not found: undefined`);
              }
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
                totalPrice: product.price * item.quantity
              };
            })
          }
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      for (const item of items) {
        const product = dbProductMap.get(item.productId);
        if (!product) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: {
            inventory: {
              decrement: item.quantity
            }
          }
        });
      }

      return newOrder;
    });

    try {
      await this.emailService.sendOrderConfirmationEmail({
        to: user.email,
        userName: user.name ?? undefined,
        orderId: order.id,
        currency,
        amountPaid,
        items: order.items.map(i => ({
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice
        }))
      });
    } catch (error) {
      logger.error('Failed to send order confirmation email', {
        error,
        orderId: order.id,
        userId
      });
    }

    orderEvents.emit('order.created', order);

    return order;
  }

  public async getOrderById(orderId: string, authUser: AuthUser): Promise<OrderWithRelations> {
    if (!authUser) {
      throw new ForbiddenError('Not authenticated');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!this.canAccessOrder(order, authUser)) {
      throw new ForbiddenError('You are not allowed to access this order');
    }

    return order;
  }

  public async listOrdersForUser(authUser: AuthUser): Promise<OrderWithRelations[]> {
    if (!authUser) {
      throw new ForbiddenError('Not authenticated');
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: authUser.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return orders;
  }

  public async adminListOrders(authUser: AuthUser, params?: { userId?: string }): Promise<OrderWithRelations[]> {
    if (!authUser || !authUser.roles?.includes('ADMIN')) {
      throw new ForbiddenError('Admin access required');
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: params?.userId ?? undefined
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return orders;
  }

  public async adminUpdateOrderStatus(
    orderId: string,
    status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'FULFILLED',
    authUser: AuthUser
  ): Promise<OrderWithRelations> {
    if (!authUser || !authUser.roles?.includes('ADMIN')) {
      throw new ForbiddenError('Admin