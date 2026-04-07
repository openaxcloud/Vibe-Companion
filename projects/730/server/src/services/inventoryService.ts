import { Knex } from 'knex';
import { Logger } from 'winston';

export interface InventoryItem {
  id: number;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAdjustmentResult {
  success: boolean;
  item?: InventoryItem;
  error?: string;
}

export interface InventoryCheckResult {
  sufficient: boolean;
  availableQuantity: number;
}

export interface InventoryReservationResult {
  success: boolean;
  reservedQuantity?: number;
  error?: string;
}

export interface InventoryReleaseResult {
  success: boolean;
  releasedQuantity?: number;
  error?: string;
}

export interface InventoryServiceDeps {
  db: Knex;
  logger: Logger;
}

export interface InventoryService {
  getItemBySku(sku: string, trx?: Knex.Transaction): Promise<InventoryItem | null>;
  checkAvailability(sku: string, quantity: number, trx?: Knex.Transaction): Promise<InventoryCheckResult>;
  decrementStockOnOrder(
    sku: string,
    quantity: number,
    trx?: Knex.Transaction
  ): Promise<InventoryAdjustmentResult>;
  incrementStock(
    sku: string,
    quantity: number,
    trx?: Knex.Transaction
  ): Promise<InventoryAdjustmentResult>;
  reserveStock(
    sku: string,
    quantity: number,
    trx?: Knex.Transaction
  ): Promise<InventoryReservationResult>;
  releaseReservedStock(
    sku: string,
    quantity: number,
    trx?: Knex.Transaction
  ): Promise<InventoryReleaseResult>;
}

const INVENTORY_TABLE = 'inventory';

export const createInventoryService = (deps: InventoryServiceDeps): InventoryService => {
  const { db, logger } = deps;

  const mapRowToInventoryItem = (row: any): InventoryItem => ({
    id: row.id,
    sku: row.sku,
    quantity: Number(row.quantity),
    reservedQuantity: Number(row.reserved_quantity ?? row.reservedQuantity ?? 0),
    createdAt: new Date(row.created_at ?? row.createdAt),
    updatedAt: new Date(row.updated_at ?? row.updatedAt),
  });

  const getItemBySku = async (
    sku: string,
    trx?: Knex.Transaction
  ): Promise<InventoryItem | null> => {
    const query = (trx || db)(INVENTORY_TABLE)
      .where({ sku })
      .first();

    const row = await query;
    if (!row) {
      return null;
    }
    return mapRowToInventoryItem(row);
  };

  const checkAvailability = async (
    sku: string,
    quantity: number,
    trx?: Knex.Transaction
  ): Promise<InventoryCheckResult> => {
    if (quantity <= 0) {
      return { sufficient: false, availableQuantity: 0 };
    }

    const item = await getItemBySku(sku, trx);
    if (!item) {
      return { sufficient: false, availableQuantity: 0 };
    }

    const available = item.quantity - item.reservedQuantity;
    return {
      sufficient: available >= quantity,
      availableQuantity: available,
    };
  };

  const decrementStockOnOrder = async (
    sku: string,
    quantity: number,
    externalTrx?: Knex.Transaction
  ): Promise<InventoryAdjustmentResult> => {
    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }

    const run = async (trx: Knex.Transaction): Promise<InventoryAdjustmentResult> => {
      const item = await getItemBySku(sku, trx);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }

      const available = item.quantity - item.reservedQuantity;
      if (available < quantity) {
        return {
          success: false,
          error: 'Insufficient stock to fulfill order',
        };
      }

      const updatedRows = await trx(INVENTORY_TABLE)
        .where({ id: item.id })
        .andWhere('quantity', '>=', quantity)
        .update({
          quantity: db.raw('?? - ?', ['quantity', quantity]),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null;

      if (!updatedRow) {
        return {
          success: false,
          error: 'Failed to decrement stock due to concurrent modification',
        };
      }

      const updatedItem = mapRowToInventoryItem(updatedRow);
      logger.info('Decremented inventory stock', {
        sku,
        quantity,
        itemId: updatedItem.id,
        remainingQuantity: updatedItem.quantity,
      });

      return { success: true, item: updatedItem };
    };

    if (externalTrx) {
      return run(externalTrx);
    }

    return db.transaction(async (trx) => run(trx));
  };

  const incrementStock = async (
    sku: string,
    quantity: number,
    externalTrx?: Knex.Transaction
  ): Promise<InventoryAdjustmentResult> => {
    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }

    const run = async (trx: Knex.Transaction): Promise<InventoryAdjustmentResult> => {
      let item = await getItemBySku(sku, trx);

      if (!item) {
        const insertedRows = await trx(INVENTORY_TABLE)
          .insert({
            sku,
            quantity,
            reserved_quantity: 0,
          })
          .returning('*');

          const insertedRow = Array.isArray(insertedRows) ? insertedRows[0] : null;
          if (!insertedRow) {
            return { success: false, error: 'Failed to create inventory item' };
          }
          item = mapRowToInventoryItem(insertedRow);
      }

      const updatedRows = await trx(INVENTORY_TABLE)
        .where({ id: item.id })
        .update({
          quantity: db.raw('?? + ?', ['quantity', quantity]),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null;

      if (!updatedRow) {
        return {
          success: false,
          error: 'Failed to increment stock due to concurrent modification',
        };
      }

      const updatedItem = mapRowToInventoryItem(updatedRow);
      logger.info('Incremented inventory stock', {
        sku,
        quantity,
        itemId: updatedItem.id,
        newQuantity: updatedItem.quantity,
      });

      return { success: true, item: updatedItem };
    };

    if (externalTrx) {
      return run(externalTrx);
    }

    return db.transaction(async (trx) => run(trx));
  };

  const reserveStock = async (
    sku: string,
    quantity: number,
    externalTrx?: Knex.Transaction
  ): Promise<InventoryReservationResult> => {
    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }

    const run = async (trx: Knex.Transaction): Promise<InventoryReservationResult> => {
      const item = await getItemBySku(sku, trx);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }

      const available = item.quantity - item.reservedQuantity;
      if (available < quantity) {
        return {
          success: false,
          error: 'Insufficient stock to reserve',
        };
      }

      const updatedRows = await trx(INVENTORY_TABLE)
        .where({ id: item.id })
        .andWhereRaw('(quantity - reserved_quantity) >= ?', [quantity])
        .update({
          reserved_quantity: db.raw('?? + ?', ['reserved_quantity', quantity]),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null;

      if (!updatedRow) {
        return {
          success: false,
          error: 'Failed to reserve stock due to concurrent modification',
        };
      }

      const updatedItem = mapRowToInventoryItem(updatedRow);
      logger.info('Reserved inventory stock', {
        sku,
        quantity,
        itemId: updatedItem.id,
        reservedQuantity: updatedItem.reservedQuantity,
      });

      return {
        success: true,
        reservedQuantity: updatedItem.reservedQuantity,
      };
    };

    if (externalTrx) {
      return run(externalTrx);
    }

    return db.transaction(async (trx) => run(trx));
  };

  const releaseReservedStock = async (
    sku: string,
    quantity: number,
    externalTrx?: Knex.Transaction
  ): Promise<InventoryReleaseResult> => {
    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }

    const run = async (trx: Knex.Transaction): Promise<InventoryReleaseResult> => {
      const item = await getItemBySku(sku, trx);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }

      const releaseQty = Math.min(quantity, item.reservedQuantity);
      if (releaseQty <= 0) {
        return {
          success