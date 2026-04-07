import { Pool, PoolClient } from "pg";

export interface InventoryItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface StockCheckResult {
  ok: boolean;
  insufficientItems?: Array<{
    productId: string;
    variantId?: string | null;
    requested: number;
    available: number;
  }>;
}

export interface ReserveStockResult extends StockCheckResult {
  reservationId?: string;
}

export interface InventoryServiceOptions {
  pool: Pool;
  /**
   * Reservation expiration time in seconds.
   * Expired reservations will not be honored when finalizing.
   */
  reservationTtlSeconds?: number;
}

export class InventoryService {
  private readonly pool: Pool;
  private readonly reservationTtlSeconds: number;

  constructor(options: InventoryServiceOptions) {
    this.pool = options.pool;
    this.reservationTtlSeconds = options.reservationTtlSeconds ?? 15 * 60; // default 15 minutes
  }

  /**
   * Check if all requested items have sufficient stock.
   */
  async checkStock(items: InventoryItem[]): Promise<StockCheckResult> {
    if (!items.length) {
      return { ok: true };
    }

    const client = await this.pool.connect();
    try {
      const insufficientItems: StockCheckResult["insufficientItems"] = [];

      // Aggregate quantities per (productId, variantId) in case of duplicates
      const aggregated = this.aggregateItems(items);

      for (const item of aggregated) {
        const { productId, variantId, quantity } = item;

        const res = await client.query<{
          available_quantity: number | null;
        }>(
          `
          SELECT
            s.quantity
              - COALESCE((
                  SELECT COALESCE(SUM(rs.quantity), 0)
                  FROM stock_reservations rs
                  WHERE rs.product_id = s.product_id
                    AND (rs.variant_id IS NOT DISTINCT FROM s.variant_id)
                    AND rs.expires_at > NOW()
                ), 0) AS available_quantity
          FROM stock s
          WHERE s.product_id = $1
            AND (s.variant_id IS NOT DISTINCT FROM $2)
          `,
          [productId, variantId ?? null]
        );

        const available = res.rows[0]?.available_quantity ?? 0;

        if (available < quantity) {
          insufficientItems.push({
            productId,
            variantId: variantId ?? undefined,
            requested: quantity,
            available: Math.max(available, 0),
          });
        }
      }

      if (insufficientItems.length) {
        return { ok: false, insufficientItems };
      }

      return { ok: true };
    } finally {
      client.release();
    }
  }

  /**
   * Atomically reserve stock for the given items.
   * Returns a reservationId if successful, or details of insufficient items.
   */
  async reserveStock(
    items: InventoryItem[],
    orderId: string
  ): Promise<ReserveStockResult> {
    if (!items.length) {
      return { ok: true, reservationId: this.generateReservationId() };
    }

    const aggregated = this.aggregateItems(items);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ");

      const insufficientItems: ReserveStockResult["insufficientItems"] = [];

      const reservationId = this.generateReservationId();
      const expiresAt = new Date(Date.now() + this.reservationTtlSeconds * 1000);

      for (const item of aggregated) {
        const { productId, variantId, quantity } = item;

        const row = await this.lockStockRow(client, productId, variantId);

        const currentQuantity = row?.quantity ?? 0;

        const reservedRes = await client.query<{ total_reserved: number | null }>(
          `
          SELECT COALESCE(SUM(quantity), 0) AS total_reserved
          FROM stock_reservations
          WHERE product_id = $1
            AND (variant_id IS NOT DISTINCT FROM $2)
            AND expires_at > NOW()
          FOR SHARE
          `,
          [productId, variantId ?? null]
        );

        const currentlyReserved = reservedRes.rows[0]?.total_reserved ?? 0;
        const available = currentQuantity - currentlyReserved;

        if (available < quantity) {
          insufficientItems.push({
            productId,
            variantId: variantId ?? undefined,
            requested: quantity,
            available: Math.max(available, 0),
          });
        }
      }

      if (insufficientItems.length) {
        await client.query("ROLLBACK");
        return { ok: false, insufficientItems };
      }

      // All ok; create reservation entries
      const insertValues: any[] = [];
      const valuePlaceholders: string[] = [];
      let paramIndex = 1;

      for (const item of aggregated) {
        insertValues.push(
          reservationId,
          orderId,
          item.productId,
          item.variantId ?? null,
          item.quantity,
          expiresAt
        );
        valuePlaceholders.push(
          `($undefined, $undefined, $undefined, $undefined, $undefined, $undefined)`
        );
      }

      await client.query(
        `
        INSERT INTO stock_reservations (
          reservation_id,
          order_id,
          product_id,
          variant_id,
          quantity,
          expires_at
        ) VALUES undefined
        `,
        insertValues
      );

      await client.query("COMMIT");
      return { ok: true, reservationId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Finalize a reservation upon successful payment:
   *  - Decrement stock permanently
   *  - Remove or mark reservation as consumed
   */
  async finalizeReservation(reservationId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ");

      const res = await client.query<{
        product_id: string;
        variant_id: string | null;
        quantity: number;
      }>(
        `
        SELECT product_id, variant_id, quantity
        FROM stock_reservations
        WHERE reservation_id = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
        `,
        [reservationId]
      );

      if (!res.rows.length) {
        await client.query("ROLLBACK");
        return;
      }

      // Lock corresponding stock rows and check availability
      for (const row of res.rows) {
        const { product_id, variant_id, quantity } = row;
        const stockRow = await this.lockStockRow(client, product_id, variant_id);

        const currentQuantity = stockRow?.quantity ?? 0;

        if (currentQuantity < quantity) {
          // Can choose to log or throw; for now we throw to surface inconsistency
          throw new Error(
            `Insufficient stock while finalizing reservation: product=undefined, variant=undefined, needed=undefined, available=undefined`
          );
        }
      }

      // Decrement stock
      for (const row of res.rows) {
        const { product_id, variant_id, quantity } = row;
        await client.query(
          `
          UPDATE stock
          SET quantity = quantity - $1,
              updated_at = NOW()
          WHERE product_id = $2
            AND (variant_id IS NOT DISTINCT FROM $3)
          `,
          [quantity, product_id, variant_id]
        );
      }

      // Mark reservation as consumed
      await client.query(
        `
        UPDATE stock_reservations
        SET consumed_at = NOW()
        WHERE reservation_id = $1
          AND consumed_at IS NULL
        `,
        [reservationId]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Release/cancel a reservation (e.g. payment failed or order cancelled).
   */
  async releaseReservation(reservationId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE stock_reservations
        SET cancelled_at = NOW()
        WHERE reservation_id = $1
          AND consumed_at IS NULL
          AND cancelled_at IS NULL
        `,
        [reservationId]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Utility: fetch and lock a stock row for update.
   */
  private async lockStockRow(
    client: PoolClient,
    productId: string,
    variantId?: string | null
  ): Promise<{ product_id: string; variant_id: string | null; quantity: number } | null> {
    const res = await client.query<{
      product_id: string;
      variant_id: string | null;
      quantity: number;
    }>(
      `
      SELECT product_id, variant_id, quantity
      FROM stock
      WHERE product_id = $1
        AND (variant