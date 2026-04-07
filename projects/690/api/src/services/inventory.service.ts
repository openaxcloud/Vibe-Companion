import { PrismaClient, InventoryAdjustmentReason, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Core types for inventory operations
 */
export type StockLevel = {
  productId: string;
  quantity: number;
  reserved: number;
  available: number;
  updatedAt: Date;
};

export type ReservationItemInput = {
  productId: string;
  quantity: number;
};

export type ReservationStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export type Reservation = {
  id: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  status: ReservationStatus;
  createdAt: Date;
  expiresAt: Date | null;
};

export type AdjustmentReason =
  | 'STOCKTAKE'
  | 'DAMAGED'
  | 'LOST'
  | 'RETURNED'
  | 'MANUAL_CORRECTION'
  | 'ORDER_FULFILLED'
  | 'ORDER_CANCELLED'
  | 'RESERVATION_EXPIRED';

export interface StockAdjustmentInput {
  productId: string;
  delta: number;
  reason: AdjustmentReason;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InventoryServiceConfig {
  defaultReservationTtlMs?: number;
  clock?: () => Date;
}

export class InventoryError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
  }
}

export class InventoryService {
  private readonly defaultReservationTtlMs: number;
  private readonly clock: () => Date;

  constructor(config?: InventoryServiceConfig) {
    this.defaultReservationTtlMs = config?.defaultReservationTtlMs ?? 15 * 60 * 1000; // 15 minutes
    this.clock = config?.clock ?? (() => new Date());
  }

  /**
   * Get current stock, reserved, and available for a product.
   */
  async getStockLevel(productId: string): Promise<StockLevel> {
    const inventory = await prisma.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      return {
        productId,
        quantity: 0,
        reserved: 0,
        available: 0,
        updatedAt: this.clock(),
      };
    }

    return {
      productId: inventory.productId,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
      available: inventory.quantity - inventory.reserved,
      updatedAt: inventory.updatedAt,
    };
  }

  /**
   * Ensure an inventory record exists for the product.
   */
  private async ensureInventoryRecord(
    tx: Prisma.TransactionClient,
    productId: string,
  ) {
    const existing = await tx.inventory.findUnique({
      where: { productId },
    });

    if (!existing) {
      return tx.inventory.create({
        data: {
          productId,
          quantity: 0,
          reserved: 0,
        },
      });
    }

    return existing;
  }

  /**
   * Reserve items for a potential order.
   * Fails if not enough available stock for any item.
   */
  async reserveItems(
    items: ReservationItemInput[],
    ttlMs?: number,
    referenceId?: string,
  ): Promise<Reservation> {
    if (!items.length) {
      throw new InventoryError('EMPTY_RESERVATION', 'At least one item is required for reservation.');
    }

    const now = this.clock();
    const expiresAt = new Date(now.getTime() + (ttlMs ?? this.defaultReservationTtlMs));
    const normalizedItems = this.normalizeReservationItems(items);

    return prisma.$transaction(async (tx) => {
      // Lock and validate stock
      for (const item of normalizedItems) {
        const inventory = await this.ensureInventoryRecord(tx, item.productId);

        const available = inventory.quantity - inventory.reserved;
        if (available < item.quantity) {
          throw new InventoryError(
            'INSUFFICIENT_STOCK',
            `Not enough stock for product undefined. Requested: undefined, Available: undefined`,
          );
        }
      }

      // Create reservation
      const reservationId = uuidv4();
      const createdReservation = await tx.inventoryReservation.create({
        data: {
          id: reservationId,
          status: 'PENDING',
          referenceId: referenceId ?? null,
          expiresAt,
          createdAt: now,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Increment reserved counts and log adjustments
      for (const item of normalizedItems) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            reserved: {
              increment: item.quantity,
            },
          },
        });

        await tx.inventoryAdjustment.create({
          data: {
            productId: item.productId,
            delta: 0,
            reservedDelta: item.quantity,
            reason: InventoryAdjustmentReason.RESERVATION_CREATED,
            reference: reservationId,
            metadata: null,
          },
        });
      }

      return {
        id: createdReservation.id,
        status: createdReservation.status as ReservationStatus,
        createdAt: createdReservation.createdAt,
        expiresAt: createdReservation.expiresAt,
        items: createdReservation.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      };
    });
  }

  /**
   * Confirm an order by consuming a reservation and decrementing stock.
   * This will:
   * - verify reservation is PENDING and not expired
   * - decrement quantity and reserved
   * - mark reservation as COMPLETED
   */
  async confirmOrderFromReservation(
    reservationId: string,
    orderId: string,
  ): Promise<void> {
    const now = this.clock();
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: reservationId },
        include: { items: true },
      });

      if (!reservation) {
        throw new InventoryError('RESERVATION_NOT_FOUND', 'Reservation not found.');
      }

      if (reservation.status !== 'PENDING') {
        throw new InventoryError('INVALID_RESERVATION_STATUS', `Reservation is undefined and cannot be confirmed.`);
      }

      if (reservation.expiresAt && reservation.expiresAt < now) {
        throw new InventoryError('RESERVATION_EXPIRED', 'Reservation has expired.');
      }

      // For each item: decrement quantity and reserved
      for (const item of reservation.items) {
        const inventory = await this.ensureInventoryRecord(tx, item.productId);

        if (inventory.reserved < item.quantity) {
          throw new InventoryError(
            'INCONSISTENT_RESERVATION',
            `Reserved quantity is less than reservation item for product undefined.`,
          );
        }

        if (inventory.quantity < item.quantity) {
          throw new InventoryError(
            'INSUFFICIENT_STOCK',
            `Not enough stock to confirm order for product undefined.`,
          );
        }

        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
            reserved: {
              decrement: item.quantity,
            },
          },
        });

        await tx.inventoryAdjustment.create({
          data: {
            productId: item.productId,
            delta: -item.quantity,
            reservedDelta: -item.quantity,
            reason: InventoryAdjustmentReason.ORDER_FULFILLED,
            reference: orderId,
            metadata: {
              reservationId,
            },
          },
        });
      }

      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: {
          status: 'COMPLETED',
          confirmedAt: now,
          orderId,
        },
      });
    });
  }

  /**
   * Cancel a reservation and release reserved stock.
   */
  async cancelReservation(
    reservationId: string,
    reason: 'CANCELLED' | 'EXPIRED' = 'CANCELLED',
  ): Promise<void> {
    const now = this.clock();
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: reservationId },
        include: { items: true },
      });

      if (!reservation) {
        throw new InventoryError('RESERVATION_NOT_FOUND', 'Reservation not found.');
      }

      if (reservation.status !== 'PENDING') {
        // Nothing to do if already completed or cancelled
        return;
      }

      const status = reason === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED';

      // Release reserved items
      for (const item of reservation.items) {
        const inventory = await this.ensureInventoryRecord(tx, item.productId);

        const reservedToRelease = Math.min(inventory.reserved, item.quantity);

        if (reservedToRelease <= 0) {
          continue;
        }

        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            reserved: {
              decrement: reservedToRelease,
            },
          },
        });