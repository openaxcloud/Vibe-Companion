import { Prisma, PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

export type CreateOrderFromCartInput = {
  userId: string;
  cartId: string;
  shippingAddressId: string;
  billingAddressId?: string | null;
  notes?: string | null;
};

export type OrderFilters = {
  userId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  cursor?: string | null;
  take?: number;
};

export type AdminOrderFilters = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  userId?: string;
  cursor?: string | null;
  take?: number;
  fromDate?: Date;
  toDate?: Date;
};

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    user: true;
    items: {
      include: {
        product: true;
        variant: true;
      };
    };
    shippingAddress: true;
    billingAddress: true;
    payment: true;
  };
}>;

export class OrderService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? prisma;
  }

  async createOrderFromCart(input: CreateOrderFromCartInput): Promise<OrderWithRelations> {
    const parsed = this.validateCreateOrderInput(input);

    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: parsed.cartId, userId: parsed.userId },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      if (!cart) {
        throw new Error('Cart not found or does not belong to user');
      }

      if (cart.items.length === 0) {
        throw new Error('Cannot create an order from an empty cart');
      }

      // Validate inventory availability
      for (const item of cart.items) {
        if (!item.variantId) {
          throw new Error('Cart item missing variant');
        }

        const inventory = await tx.inventory.findUnique({
          where: { productVariantId: item.variantId },
        });

        if (!inventory || inventory.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product variant undefined`
          );
        }
      }

      const billingAddressId = parsed.billingAddressId ?? parsed.shippingAddressId;

      const order = await tx.order.create({
        data: {
          userId: parsed.userId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          shippingAddressId: parsed.shippingAddressId,
          billingAddressId,
          notes: parsed.notes ?? null,
          subtotalAmount: cart.subtotalAmount,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      });

      // Adjust inventory
      for (const item of cart.items) {
        if (!item.variantId) continue;
        await tx.inventory.update({
          where: { productVariantId: item.variantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Optionally create a pending payment record
      await tx.payment.create({
        data: {
          orderId: order.id,
          userId: parsed.userId,
          amount: order.totalAmount,
          currency: order.currency,
          status: PaymentStatus.PENDING,
        },
      });

      // Clear cart
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          items: {
            deleteMany: {},
          },
          subtotalAmount: 0,
          totalAmount: 0,
        },
      });

      const fullOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          user: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          shippingAddress: true,
          billingAddress: true,
          payment: true,
        },
      });

      if (!fullOrder) {
        throw new Error('Failed to load created order');
      }

      return fullOrder;
    });
  }

  async transitionOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
    options?: { reason?: string; performedByAdminId?: string }
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payment: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      this.validateStatusTransition(order.status, nextStatus);

      // Handle status-specific business logic
      if (nextStatus === OrderStatus.CANCELLED) {
        await this.handleOrderCancellation(tx, order.id);
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          statusHistory: {
            push: {
              from: order.status,
              to: nextStatus,
              reason: options?.reason ?? null,
              performedByAdminId: options?.performedByAdminId ?? null,
              changedAt: new Date(),
            },
          },
        },
        include: {
          user: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          shippingAddress: true,
          billingAddress: true,
          payment: true,
        },
      });

      return updatedOrder;
    });
  }

  async updatePaymentStatus(
    orderId: string,
    nextPaymentStatus: PaymentStatus
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payment: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const payment = order.payment;
      if (!payment) {
        throw new Error('Payment record not found for order');
      }

      this.validatePaymentStatusTransition(payment.status, nextPaymentStatus);

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextPaymentStatus,
        },
      });

      let newOrderStatus: OrderStatus | null = null;

      if (updatedPayment.status === PaymentStatus.PAID) {
        if (order.status === OrderStatus.PENDING) {
          newOrderStatus = OrderStatus.CONFIRMED;
        }
      } else if (
        updatedPayment.status === PaymentStatus.FAILED ||
        updatedPayment.status === PaymentStatus.CANCELLED
      ) {
        if (
          order.status === OrderStatus.PENDING ||
          order.status === OrderStatus.CONFIRMED
        ) {
          newOrderStatus = OrderStatus.CANCELLED;
        }
      }

      let updatedOrder: OrderWithRelations | null;

      if (newOrderStatus) {
        updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: newOrderStatus,
          },
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
            billingAddress: true,
            payment: true,
          },
        });
      } else {
        updatedOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
            billingAddress: true,
            payment: true,
          },
        });
      }

      if (!updatedOrder) {
        throw new Error('Failed to update order with new payment status');
      }

      return updatedOrder;
    });
  }

  async getUserOrders(
    userId: string,
    filters: OrderFilters = {}
  ): Promise<{ orders: OrderWithRelations[]; nextCursor: string | null }> {
    const take = filters.take && filters.take > 0 && filters.take <= 100 ? filters.take : 20;

    const where: Prisma.OrderWhereInput = {
      userId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    const orders = await this.prisma.order.findMany({
      where,
      take: take + 1,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
        payment: true,
      },
    });

    let nextCursor: string | null = null;
    if (orders.length > take) {