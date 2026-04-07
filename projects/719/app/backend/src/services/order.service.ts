import { PrismaClient, Order, OrderStatus, InventoryMovementType } from '@prisma/client';
import { NotFoundError } from '../errors/not-found.error';
import { AuthorizationError } from '../errors/authorization.error';
import { ValidationError } from '../errors/validation.error';

const prisma = new PrismaClient();

export type OrderStatusUpdate = Extract<OrderStatus, 'PENDING' | 'PAID' | 'CANCELLED' | 'SHIPPED' | 'COMPLETED' | 'REFUNDED'>;

export interface OrderItemDTO {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDTO {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemDTO[];
}

export interface CreateOrderResult {
  order: OrderDTO;
}

export interface ListOrdersOptions {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
}

export interface PaginatedOrders {
  data: OrderDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class OrderService {
  private mapOrderToDTO(order: any): OrderDTO {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }))
    };
  }

  public async createOrderFromCartAfterPayment(userId: string, paymentIntentId: string): Promise<CreateOrderResult> {
    if (!userId || !paymentIntentId) {
      throw new ValidationError('Invalid user or payment intent.');
    }

    return await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!cart || cart.items.length === 0) {
        throw new ValidationError('Cart is empty or not found.');
      }

      const existingOrder = await tx.order.findFirst({
        where: {
          userId,
          paymentIntentId
        }
      });

      if (existingOrder) {
        throw new ValidationError('Order already exists for this payment.');
      }

      const insufficientInventory = cart.items.find(
        (item) => item.product.stock < item.quantity
      );

      if (insufficientInventory) {
        throw new ValidationError(
          `Insufficient stock for product undefined.`
        );
      }

      const totalAmount = cart.items.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0
      );

      const order = await tx.order.create({
        data: {
          userId,
          status: 'PAID',
          totalAmount,
          paymentIntentId,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
              totalPrice: item.quantity * item.product.price
            }))
          }
        },
        include: {
          items: true
        }
      });

      for (const item of cart.items) {
        const newStock = item.product.stock - item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock }
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            type: 'OUT' as InventoryMovementType,
            reference: `order:undefined`,
            metadata: {
              userId,
              paymentIntentId
            }
          }
        });
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      return {
        order: this.mapOrderToDTO(order)
      };
    });
  }

  public async listOrdersByUser(userId: string, options: ListOrdersOptions = {}): Promise<PaginatedOrders> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 100) : 20;

    const where: any = { userId };
    if (options.status) {
      where.status = options.status;
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: orders.map((order) => this.mapOrderToDTO(order)),
      page,
      pageSize,
      total,
      totalPages
    };
  }

  public async listAllOrdersAsAdmin(options: ListOrdersOptions = {}): Promise<PaginatedOrders> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 100) : 20;

    const where: any = {};
    if (options.status) {
      where.status = options.status;
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: orders.map((order) => this.mapOrderToDTO(order)),
      page,
      pageSize,
      total,
      totalPages
    };
  }

  public async getOrderByIdForUser(orderId: string, userId: string): Promise<OrderDTO> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      throw new NotFoundError('Order not found.');
    }

    if (order.userId !== userId) {
      throw new AuthorizationError('You are not allowed to view this order.');
    }

    return this.mapOrderToDTO(order);
  }

  public async getOrderByIdAsAdmin(orderId: string): Promise<OrderDTO> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      throw new NotFoundError('Order not found.');
    }

    return this.mapOrderToDTO(order);
  }

  public async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatusUpdate,
    actingUserId: string,
    isAdmin: boolean
  ): Promise<OrderDTO> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundError('Order not found.');
    }

    if (!isAdmin && order.userId !== actingUserId) {
      throw new AuthorizationError('You are not allowed to update this order.');
    }

    const currentStatus = order.status;

    const isTerminal = (status: OrderStatus) =>
      ['CANCELLED', 'COMPLETED', 'REFUNDED'].includes(status);

    if (isTerminal(currentStatus)) {
      throw new ValidationError(`Cannot change status of a undefined order.`);
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['PAID', 'CANCELLED'],
      PAID: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
      SHIPPED: ['COMPLETED', 'REFUNDED'],
      COMPLETED: [],
      CANCELLED: [],
      REFUNDED: []
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new ValidationError(`Invalid order status transition from undefined to undefined.`);
    }

    return await prisma.$transaction(async (tx) => {
      if (['CANCELLED', 'REFUNDED'].includes(newStatus)) {
        for (const item of order.items) {
          const product = item.product;
          const newStock = product.stock + item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock }
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: 'IN' as InventoryMovementType,
              reference: `order:undefined:status:undefined`,
              metadata: {
                fromStatus: currentStatus,
                to