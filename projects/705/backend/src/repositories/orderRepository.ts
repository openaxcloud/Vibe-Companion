import { Prisma, PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

export type CreateOrderItemInput = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  userId: string;
  items: CreateOrderItemInput[];
};

export type OrderWithItemsAndProducts = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: true;
      };
    };
  };
}>;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    user: true;
  };
}>;

export type OrderFilterOptions = {
  userId?: string;
  status?: OrderStatus;
  skip?: number;
  take?: number;
  orderBy?: Prisma.OrderOrderByWithRelationInput;
};

export type UpdateOrderStatusInput = {
  orderId: string;
  status: OrderStatus;
};

export class OrderRepository {
  async createOrder(input: CreateOrderInput): Promise<OrderWithItemsAndProducts> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    return prisma.$transaction(async (tx) => {
      const productIds = input.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        throw new Error('One or more products do not exist');
      }

      const productMap = new Map(
        products.map((product) => [product.id, product])
      );

      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product not found: undefined`);
        }
        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product undefined. Available: undefined, Requested: undefined`
          );
        }
      }

      for (const item of input.items) {
        const product = productMap.get(item.productId)!;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      const totalAmount = input.items.reduce((sum, item) => {
        const product = productMap.get(item.productId)!;
        return sum + product.price.toNumber() * item.quantity;
      }, 0);

      const order = await tx.order.create({
        data: {
          userId: input.userId,
          totalAmount,
          status: 'PENDING',
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productMap.get(item.productId)!.price,
            })),
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

      return order;
    });
  }

  async getOrdersForUser(userId: string): Promise<OrderWithItemsAndProducts[]> {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getOrderById(orderId: string): Promise<OrderWithItemsAndProducts | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async listOrders(options: OrderFilterOptions = {}): Promise<OrderWithRelations[]> {
    const { userId, status, skip, take, orderBy } = options;

    return prisma.order.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        items: true,
        user: true,
      },
      skip,
      take,
      orderBy: orderBy ?? { createdAt: 'desc' },
    });
  }

  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<OrderWithItemsAndProducts> {
    const { orderId, status } = input;

    return prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!existingOrder) {
        throw new Error('Order not found');
      }

      if (existingOrder.status === status) {
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });
      }

      if (
        (existingOrder.status === 'CANCELLED' || existingOrder.status === 'COMPLETED') &&
        status !== existingOrder.status
      ) {
        throw new Error(`Cannot change status of a undefined order`);
      }

      if (status === 'CANCELLED') {
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return updatedOrder;
    });
  }

  async deleteOrder(orderId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!existingOrder) {
        throw new Error('Order not found');
      }

      if (existingOrder.status === 'CANCELLED') {
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      await tx.orderItem.deleteMany({
        where: { orderId },
      });

      await tx.order.delete({
        where: { id: orderId },
      });
    });
  }
}

const orderRepository = new OrderRepository();

export default orderRepository;