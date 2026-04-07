import { Prisma, PrismaClient, OrderStatus, InventoryTransactionType } from '@prisma/client';
import { NotFoundError } from '../errors/not-found.error';
import { BadRequestError } from '../errors/bad-request.error';
import { ConflictError } from '../errors/conflict.error';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export type CreateOrderFromCartInput = {
  userId: string;
  cartId: string;
  shippingAddressId: string;
  paymentMethodId: string;
  notes?: string | null;
};

export type UpdateOrderStatusInput = {
  orderId: string;
  status: OrderStatus;
  reason?: string | null;
};

export class OrderService {
  /**
   * Create an order from an existing cart.
   * Validates cart, checks inventory, creates order, updates inventory,
   * and records inventory transactions in a single transaction.
   */
  public static async createOrderFromCart(input: CreateOrderFromCartInput) {
    const { userId, cartId, shippingAddressId, paymentMethodId, notes } = input;

    return prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  stockQuantity: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!cart || cart.userId !== userId) {
        throw new NotFoundError('Cart not found for user');
      }

      if (cart.items.length === 0) {
        throw new BadRequestError('Cannot create order from empty cart');
      }

      const address = await tx.address.findUnique({
        where: { id: shippingAddressId },
      });

      if (!address || address.userId !== userId) {
        throw new BadRequestError('Invalid shipping address');
      }

      const paymentMethod = await tx.paymentMethod.findUnique({
        where: { id: paymentMethodId },
      });

      if (!paymentMethod || paymentMethod.userId !== userId) {
        throw new BadRequestError('Invalid payment method');
      }

      // Lock products and validate inventory
      const productIds = cart.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stockQuantity: true,
          isActive: true,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      const insufficient: { productId: string; requested: number; available: number }[] = [];

      for (const item of cart.items) {
        const product = productMap.get(item.productId);
        if (!product || !product.isActive) {
          insufficient.push({
            productId: item.productId,
            requested: item.quantity,
            available: 0,
          });
          continue;
        }

        if (product.stockQuantity < item.quantity) {
          insufficient.push({
            productId: product.id,
            requested: item.quantity,
            available: product.stockQuantity,
          });
        }
      }

      if (insufficient.length > 0) {
        throw new ConflictError('Insufficient inventory for some items', { details: insufficient });
      }

      const subtotal = cart.items.reduce((sum, item) => {
        const product = productMap.get(item.productId);
        const price = product?.price ?? item.unitPrice;
        return sum + price * item.quantity;
      }, 0);

      const shippingCost = await OrderService.calculateShippingCost(tx, userId, shippingAddressId, subtotal);
      const tax = await OrderService.calculateTax(tx, userId, subtotal);
      const total = subtotal + shippingCost + tax;

      const order = await tx.order.create({
        data: {
          userId,
          cartId: cart.id,
          status: OrderStatus.PENDING,
          subtotal,
          shippingCost,
          tax,
          total,
          notes: notes ?? null,
          shippingAddressSnapshot: {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            phone: address.phone,
            name: address.name,
          },
          paymentMethodSnapshot: {
            brand: paymentMethod.brand,
            last4: paymentMethod.last4,
            type: paymentMethod.type,
          },
          items: {
            create: cart.items.map((item) => {
              const product = productMap.get(item.productId);
              const unitPrice = product?.price ?? item.unitPrice;
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice,
                totalPrice: unitPrice * item.quantity,
                productSnapshot: {
                  name: product?.name ?? item.productName,
                  sku: product?.sku ?? item.productSku,
                },
              };
            }),
          },
        },
        include: {
          items: true,
        },
      });

      // Decrease inventory and create inventory transactions
      for (const item of order.items) {
        const product = productMap.get(item.productId);
        if (!product) continue;

        const newStock = product.stockQuantity - item.quantity;
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: newStock },
        });

        await tx.inventoryTransaction.create({
          data: {
            productId: product.id,
            type: InventoryTransactionType.DECREASE,
            quantity: item.quantity,
            referenceType: 'ORDER',
            referenceId: order.id,
            metadata: {
              reason: 'Order created',
            },
            previousQuantity: product.stockQuantity,
            newQuantity: newStock,
          },
        });
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: { isConvertedToOrder: true },
      });

      return order;
    });
  }

  /**
   * Update order status. On success, ensure inventory is decreased and recorded.
   * On cancellation, restore inventory and record corresponding transactions.
   */
  public static async updateOrderStatus(input: UpdateOrderStatusInput) {
    const { orderId, status, reason } = input;

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (order.status === status) {
        return order;
      }

      const previousStatus = order.status;

      // Validate status transition
      OrderService.assertValidStatusTransition(previousStatus, status);

      // If transitioning to PAID or COMPLETED, ensure inventory is already deducted.
      // This service assumes inventory was deducted on creation. If needed, we can
      // re-check and deduct here for safety in idempotent manner.
      if ((status === OrderStatus.PAID || status === OrderStatus.COMPLETED) && !order.inventoryLocked) {
        await OrderService.ensureInventoryOnPayment(tx, orderId);
      }

      // If cancelling from a state where inventory was locked/deducted, restore it
      if (
        status === OrderStatus.CANCELLED &&
        (previousStatus === OrderStatus.PAID ||
          previousStatus === OrderStatus.COMPLETED ||
          previousStatus === OrderStatus.PENDING) &&
        order.inventoryLocked
      ) {
        await OrderService.restoreInventoryForOrder(tx, order);
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          cancellationReason: status === OrderStatus.CANCELLED ? reason ?? null : null,
        },
      });

      return updated;
    });
  }

  /**
   * Ensure inventory is decreased for an order (idempotently).
   */
  private static async ensureInventoryOnPayment(tx: PrismaClient | Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.inventoryLocked) {
      return;
    }

    const productIds = order.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stockQuantity: true, isActive: true, name: true, sku: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const insufficient: { productId: string; requested: number; available: number }[] = [];

    for (const item of order.items) {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        insufficient.push({
          productId: item.productId,
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      if (product.stockQuantity < item.quantity) {
        insufficient.push({
          productId: product.id,
          requested: