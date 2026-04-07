import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { body, param, ValidationChain, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { InventoryService } from '../services/inventory.service';
import { InventoryLogService } from '../services/inventoryLog.service';
import { EventBus } from '../events/eventBus';
import { DatabaseTransactionManager, Transaction } from '../db/transactionManager';
import { ApiError } from '../errors/ApiError';

export type InventoryAdjustmentType = 'INCREASE' | 'DECREASE' | 'SET';

export interface InventoryAdjustmentPayload {
  productId: string;
  locationId: string;
  quantity: number;
  type: InventoryAdjustmentType;
  reason?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryAdjustmentResult {
  productId: string;
  locationId: string;
  previousQuantity: number;
  newQuantity: number;
  change: number;
  adjustmentId: string;
  occurredAt: string;
}

export interface InventoryEventPayload extends InventoryAdjustmentResult {
  reason?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export class InventoryController {
  private readonly inventoryService: InventoryService;
  private readonly inventoryLogService: InventoryLogService;
  private readonly eventBus: EventBus;
  private readonly txManager: DatabaseTransactionManager;

  constructor(
    inventoryService: InventoryService,
    inventoryLogService: InventoryLogService,
    eventBus: EventBus,
    txManager: DatabaseTransactionManager
  ) {
    this.inventoryService = inventoryService;
    this.inventoryLogService = inventoryLogService;
    this.eventBus = eventBus;
    this.txManager = txManager;

    this.adjustInventory = this.adjustInventory.bind(this);
    this.getInventory = this.getInventory.bind(this);
    this.getInventoryHistory = this.getInventoryHistory.bind(this);
  }

  public static validateAdjustInventory(): ValidationChain[] {
    return [
      body('productId').isString().trim().notEmpty(),
      body('locationId').isString().trim().notEmpty(),
      body('quantity').isInt({ gt: 0 }).toInt(),
      body('type').isIn(['INCREASE', 'DECREASE', 'SET']),
      body('reason').optional().isString().trim(),
      body('referenceId').optional().isString().trim(),
      body('metadata').optional().isObject(),
    ];
  }

  public static validateGetInventory(): ValidationChain[] {
    return [
      param('productId').isString().trim().notEmpty(),
      param('locationId').isString().trim().notEmpty(),
    ];
  }

  public static validateGetInventoryHistory(): ValidationChain[] {
    return [
      param('productId').isString().trim().notEmpty(),
      param('locationId').isString().trim().notEmpty(),
    ];
  }

  public async adjustInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ApiError.badRequest('Validation failed', { errors: errors.array() });
      }

      const payload: InventoryAdjustmentPayload = {
        productId: req.body.productId,
        locationId: req.body.locationId,
        quantity: req.body.quantity,
        type: req.body.type,
        reason: req.body.reason,
        referenceId: req.body.referenceId,
        metadata: req.body.metadata,
      };

      const userId: string | undefined = (req as any).user?.id;

      const result = await this.txManager.runInTransaction<InventoryAdjustmentResult>(
        async (tx: Transaction): Promise<InventoryAdjustmentResult> => {
          const current = await this.inventoryService.getQuantity(
            payload.productId,
            payload.locationId,
            tx
          );

          const previousQuantity = current ?? 0;
          let newQuantity: number;

          switch (payload.type) {
            case 'INCREASE':
              newQuantity = previousQuantity + payload.quantity;
              break;
            case 'DECREASE':
              newQuantity = previousQuantity - payload.quantity;
              if (newQuantity < 0) {
                throw ApiError.conflict('Inventory cannot go negative', {
                  productId: payload.productId,
                  locationId: payload.locationId,
                  attemptedQuantity: newQuantity,
                });
              }
              break;
            case 'SET':
              newQuantity = payload.quantity;
              if (newQuantity < 0) {
                throw ApiError.conflict('Inventory cannot be set to a negative value', {
                  productId: payload.productId,
                  locationId: payload.locationId,
                  attemptedQuantity: newQuantity,
                });
              }
              break;
            default:
              throw ApiError.badRequest('Invalid adjustment type');
          }

          const change = newQuantity - previousQuantity;

          await this.inventoryService.setQuantity(
            payload.productId,
            payload.locationId,
            newQuantity,
            tx
          );

          const adjustmentId = uuidv4();
          const occurredAt = new Date().toISOString();

          await this.inventoryLogService.createLog(
            {
              id: adjustmentId,
              productId: payload.productId,
              locationId: payload.locationId,
              previousQuantity,
              newQuantity,
              change,
              type: payload.type,
              reason: payload.reason,
              referenceId: payload.referenceId,
              metadata: payload.metadata,
              userId,
              occurredAt,
            },
            tx
          );

          const eventPayload: InventoryEventPayload = {
            productId: payload.productId,
            locationId: payload.locationId,
            previousQuantity,
            newQuantity,
            change,
            adjustmentId,
            occurredAt,
            reason: payload.reason,
            referenceId: payload.referenceId,
            metadata: payload.metadata,
          };

          await this.eventBus.emit('inventory.adjusted', eventPayload, tx);

          return {
            productId: payload.productId,
            locationId: payload.locationId,
            previousQuantity,
            newQuantity,
            change,
            adjustmentId,
            occurredAt,
          };
        }
      );

      res.status(StatusCodes.OK).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ApiError.badRequest('Validation failed', { errors: errors.array() });
      }

      const { productId, locationId } = req.params;

      const quantity = await this.inventoryService.getQuantity(productId, locationId);

      res.status(StatusCodes.OK).json({
        data: {
          productId,
          locationId,
          quantity: quantity ?? 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async getInventoryHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ApiError.badRequest('Validation failed', { errors: errors.array() });
      }

      const { productId, locationId } = req.params;

      const logs = await this.inventoryLogService.getLogs(productId, locationId);

      res.status(StatusCodes.OK).json({
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryControllerFactory = (
  inventoryService: InventoryService,
  inventoryLogService: InventoryLogService,
  eventBus: EventBus,
  txManager: DatabaseTransactionManager
): InventoryController => {
  return new InventoryController(inventoryService, inventoryLogService, eventBus, txManager);
};