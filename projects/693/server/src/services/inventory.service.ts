import { PrismaClient, Prisma } from '@prisma/client';

export type InventoryLocation = 'WAREHOUSE' | 'STORE' | 'DROPSHIP';

export interface InventoryAvailability {
  productId: string;
  location: InventoryLocation;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
}

export interface ReserveStockInput {
  productId: string;
  quantity: number;
  location?: InventoryLocation;
  orderId: string;
  idempotencyKey?: string;
}

export interface ReleaseStockInput {
  reservationId?: string;
  orderId?: string;
  productId?: string;
  quantity?: number;
}

export interface CaptureStockInput {
  orderId: string;
}

export interface InventoryServiceOptions {
  prisma?: PrismaClient;
}

export class InventoryService {
  private prisma: PrismaClient;

  constructor(options: InventoryServiceOptions = {}) {
    this.prisma =
      options.prisma ??
      new PrismaClient({
        log: ['error', 'warn'],
      });
  }

  async getAvailability(params: {
    productId: string;
    location?: InventoryLocation;
  }): Promise<InventoryAvailability | null> {
    const { productId, location } = params;

    const inventory = await this.prisma.inventory.findFirst({
      where: {
        productId,
        ...(location ? { location } : {}),
      },
    });

    if (!inventory) {
      return null;
    }

    return {
      productId: inventory.productId,
      location: inventory.location as InventoryLocation,
      availableQuantity: inventory.availableQuantity,
      reservedQuantity: inventory.reservedQuantity,
      totalQuantity:
        inventory.availableQuantity +
        inventory.reservedQuantity +
        inventory.damagedQuantity,
    };
  }

  async reserveStock(input: ReserveStockInput): Promise<{
    reservationId: string;
    productId: string;
    quantity: number;
    location: InventoryLocation;
  }> {
    const { productId, quantity, location, orderId, idempotencyKey } = input;

    if (quantity <= 0) {
      throw new Error('Reservation quantity must be greater than zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (idempotencyKey) {
          const existing = await tx.inventoryReservation.findFirst({
            where: {
              idempotencyKey,
              orderId,
              productId,
            },
          });

          if (existing) {
            return {
              reservationId: existing.id,
              productId: existing.productId,
              quantity: existing.quantity,
              location: existing.location as InventoryLocation,
            };
          }
        }

        const inventory = await this.lockInventoryRow(tx, productId, location);

        if (!inventory) {
          throw new Error(
            `Inventory not found for product undefined undefined` : ''
            }`
          );
        }

        if (inventory.availableQuantity < quantity) {
          throw new Error(
            `Insufficient stock for product undefined. Available: undefined, requested: undefined`
          );
        }

        const updatedInventory = await tx.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            availableQuantity: {
              decrement: quantity,
            },
            reservedQuantity: {
              increment: quantity,
            },
          },
        });

        const reservation = await tx.inventoryReservation.create({
          data: {
            productId,
            location: updatedInventory.location,
            quantity,
            orderId,
            status: 'ACTIVE',
            idempotencyKey: idempotencyKey ?? null,
          },
        });

        return {
          reservationId: reservation.id,
          productId: reservation.productId,
          quantity: reservation.quantity,
          location: reservation.location as InventoryLocation,
        };
      },
      {
        isolationLevel: 'Serializable',
      }
    );
  }

  async releaseStock(input: ReleaseStockInput): Promise<void> {
    const { reservationId, orderId, productId, quantity } = input;

    if (!reservationId && !orderId) {
      throw new Error('Either reservationId or orderId must be provided');
    }

    await this.prisma.$transaction(
      async (tx) => {
        const reservationWhere: Prisma.InventoryReservationWhereInput = {
          status: 'ACTIVE',
          ...(reservationId ? { id: reservationId } : {}),
          ...(orderId ? { orderId } : {}),
          ...(productId ? { productId } : {}),
        };

        const reservations = await tx.inventoryReservation.findMany({
          where: reservationWhere,
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (reservations.length === 0) {
          return;
        }

        let remainingToRelease =
          quantity ?? reservations.reduce((sum, r) => sum + r.quantity, 0);

        for (const reservation of reservations) {
          if (remainingToRelease <= 0) break;

          const releaseQty = Math.min(reservation.quantity, remainingToRelease);

          const inventory = await this.lockInventoryRow(
            tx,
            reservation.productId,
            reservation.location as InventoryLocation
          );

          if (!inventory) {
            throw new Error(
              `Inventory not found for product undefined at location undefined`
            );
          }

          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              availableQuantity: {
                increment: releaseQty,
              },
              reservedQuantity: {
                decrement: releaseQty,
              },
            },
          });

          const newQuantity = reservation.quantity - releaseQty;
          const newStatus = newQuantity === 0 ? 'RELEASED' : 'PARTIAL';

          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: {
              quantity: newQuantity,
              status: newStatus,
            },
          });

          remainingToRelease -= releaseQty;
        }
      },
      {
        isolationLevel: 'Serializable',
      }
    );
  }

  async captureStock(input: CaptureStockInput): Promise<void> {
    const { orderId } = input;

    await this.prisma.$transaction(
      async (tx) => {
        const reservations = await tx.inventoryReservation.findMany({
          where: {
            orderId,
            status: 'ACTIVE',
          },
        });

        if (reservations.length === 0) {
          return;
        }

        for (const reservation of reservations) {
          const inventory = await this.lockInventoryRow(
            tx,
            reservation.productId,
            reservation.location as InventoryLocation
          );

          if (!inventory) {
            throw new Error(
              `Inventory not found for product undefined at location undefined`
            );
          }

          await tx.inventory.update({
            where: {
              id: inventory.id,
            },
            data: {
              reservedQuantity: {
                decrement: reservation.quantity,
              },
              soldQuantity: {
                increment: reservation.quantity,
              },
            },
          });

          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: {
              status: 'CAPTURED',
            },
          });
        }
      },
      {
        isolationLevel: 'Serializable',
      }
    );
  }

  async ensureInventoryRecord(params: {
    productId: string;
    location: InventoryLocation;
  }): Promise<void> {
    const { productId, location } = params;

    await this.prisma.inventory.upsert({
      where: {
        productId_location: {
          productId,
          location,
        },
      },
      update: {},
      create: {
        productId,
        location,
        availableQuantity: 0,
        reservedQuantity: 0,
        damagedQuantity: 0,
        soldQuantity: 0,
      },
    });
  }

  async adjustStock(params: {
    productId: string;
    location: InventoryLocation;
    deltaAvailable?: number;
    deltaDamaged?: number;
  }): Promise<InventoryAvailability> {
    const { productId, location, deltaAvailable = 0, deltaDamaged = 0 } = params;

    return this.prisma.$transaction(
      async (tx) => {
        const inventory = await this.lockInventoryRow(tx, productId, location);

        if (!inventory) {
          throw new Error(
            `Inventory not found for product undefined at location undefined`
          );
        }

        if (deltaAvailable < 0 && inventory.availableQuantity + deltaAvailable < 0) {
          throw new Error('Cannot reduce available quantity below zero');
        }

        const updated = await tx.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            availableQuantity:
              deltaAvailable !== 0
                ? { increment: deltaAvailable }
                : undefined,
            damagedQuantity:
              deltaDamaged !== 0 ? { increment: deltaDamaged } : undefined,
          },
        });

        return {
          productId: updated.productId,
          location: updated.location as InventoryLocation,
          availableQuantity: updated.availableQuantity,
          reservedQuantity: updated.reservedQuantity,
          totalQuantity:
            updated.availableQuantity +
            updated.reservedQuantity +
            updated.damagedQuantity,
        };
      },
      {
        isolationLevel: 'Serializable',
      }
    );
  }

  private async lockInventoryRow(
    tx: Prisma.TransactionClient,
    productId: string,
    location?: InventoryLocation
  ) {
    const found = await tx.inventory.findFirst({
      where: {
        productId,
        ...(location ? { location } : {}),
      },
    });