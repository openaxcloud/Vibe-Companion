import { PrismaClient, Order, OrderStatus, Prisma } from '@prisma/client';
import createHttpError from 'http-errors';

export type OrderWithRelations = Order & {
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product: {
      id: string;
      name: string;
      sku: string | null;
      price: number;
      stock: number;
      isActive: boolean;
    };
  }>;
};

export type OrderTotals = {
  itemsTotal: number;
  itemsCount: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

export type OrderQueryOptions = {
  includeCancelled?: boolean;
  status?: OrderStatus | OrderStatus[];
  customerId?: string;
  skip?: number;
  take?: number;
  cursor?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'grandTotal';
  sortDirection?: 'asc' | 'desc';
};

export type CreateOrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type CreateOrderInput = {
  customerId?: string | null;
  items: CreateOrderItemInput[];
  discountTotal?: number;
  taxTotal?: number;
  metadata?: Record<string, unknown> | null;
};

export type UpdateOrderStatusInput = {
  status: OrderStatus;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CancelOrderInput = {
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type OrderServiceConfig = {
  prisma?: PrismaClient;
  inventoryOnOrder?: boolean;
  allowNegativeStock?: boolean;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class OrdersService {
  private prisma: PrismaClient;
  private inventoryOnOrder: boolean;
  private allowNegativeStock: boolean;

  constructor(config: OrderServiceConfig = {}) {
    this.prisma = config.prisma ?? new PrismaClient();
    this.inventoryOnOrder = config.inventoryOnOrder ?? true;
    this.allowNegativeStock = config.allowNegativeStock ?? false;
  }

  async getOrderById(id: string): Promise<OrderWithRelations> {
    if (!id) {
      throw createHttpError(400, 'Order ID is required');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw createHttpError(404, 'Order not found');
    }

    return order as OrderWithRelations;
  }

  async listOrders(options: OrderQueryOptions = {}): Promise<{
    data: OrderWithRelations[];
    total: number;
    skip: number;
    take: number;
  }> {
    const {
      includeCancelled = false,
      status,
      customerId,
      skip = 0,
      take = DEFAULT_PAGE_SIZE,
      cursor,
      search,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = options;

    const limitedTake = Math.min(Math.max(take, 1), MAX_PAGE_SIZE);

    const where: Prisma.OrderWhereInput = {};

    if (!includeCancelled) {
      where.status = { not: 'CANCELLED' };
    }

    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status };
      } else {
        where.status = status;
      }
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { customerId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = fromDate;
      }
      if (toDate) {
        where.createdAt.lte = toDate;
      }
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limitedTake,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { [sortBy]: sortDirection },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    return {
      data: data as OrderWithRelations[],
      total,
      skip,
      take: limitedTake,
    };
  }

  async computeTotals(orderId: string): Promise<OrderTotals> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw createHttpError(404, 'Order not found');
    }

    const itemsTotal = order.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const itemsCount = order.items.reduce(
      (count, item) => count + item.quantity,
      0,
    );
    const discountTotal = order.discountTotal ?? 0;
    const taxTotal = order.taxTotal ?? 0;
    const grandTotal = itemsTotal - discountTotal + taxTotal;

    return {
      itemsTotal,
      itemsCount,
      discountTotal,
      taxTotal,
      grandTotal,
    };
  }

  async createOrder(input: CreateOrderInput): Promise<OrderWithRelations> {
    if (!input.items || input.items.length === 0) {
      throw createHttpError(400, 'Order must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const productIds = [...new Set(input.items.map((i) => i.productId))];

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
      });

      if (products.length !== productIds.length) {
        throw createHttpError(400, 'One or more products are invalid or inactive');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const itemsData = input.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw createHttpError(400, `Product not found: undefined`);
        }

        const unitPrice = item.unitPrice ?? product.price;
        if (item.quantity <= 0) {
          throw createHttpError(400, 'Item quantity must be greater than 0');
        }

        const totalPrice = unitPrice * item.quantity;

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        };
      });

      if (this.inventoryOnOrder) {
        for (const item of itemsData) {
          const product = productMap.get(item.productId);
          if (!product) continue;

          const newStock = product.stock - item.quantity;
          if (!this.allowNegativeStock && newStock < 0) {
            throw createHttpError(
              409,
              `Insufficient stock for product undefined`,
            );
          }

          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: newStock,
            },
          });

          product.stock = newStock;
        }
      }

      const itemsTotal = itemsData.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const discountTotal = input.discountTotal ?? 0;
      const taxTotal = input.taxTotal ?? 0;
      const grandTotal = itemsTotal - discountTotal + taxTotal;

      const order = await tx.order.create({
        data: {
          customerId: input.customerId ?? null,
          status: 'PENDING',
          itemsTotal,
          discountTotal,
          taxTotal,
          grandTotal,
          metadata: input.metadata ?? {},
          items: {
            createMany: {
              data: itemsData,
            },
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return order as OrderWithRelations;
    });
  }

  async updateOrderStatus(
    id: string,
    input: UpdateOrderStatusInput,
  ): Promise<OrderWithRelations> {
    if (!id) {
      throw createHttpError(400, 'Order ID is required');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw createHttpError(404, 'Order not found');
    }

    const currentStatus = order.status;
    const nextStatus = input.status;

    if (currentStatus === nextStatus) {
      return this.getOrderById(id);
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {