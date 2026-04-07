import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import httpStatus from "http-status";
import { ProductRepository } from "../repositories/ProductRepository";
import { ValidationError, NotFoundError } from "../errors";
import { logger } from "../utils/logger";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const cartValidationSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  currency: z.string().optional(),
});

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CanonicalCartItem {
  productId: string;
  name: string;
  unitPrice: number;
  currency: string;
  quantityRequested: number;
  quantityAvailable: number;
  quantityBillable: number;
  inStock: boolean;
  backorderAllowed: boolean;
  subtotal: number;
  metadata?: Record<string, unknown>;
}

export interface CanonicalCartResponse {
  items: CanonicalCartItem[];
  currency: string;
  total: number;
  hasOutOfStockItems: boolean;
  hasQuantityAdjustments: boolean;
}

export class CartController {
  private productRepository: ProductRepository;
  private defaultCurrency: string;

  constructor(productRepository: ProductRepository, defaultCurrency = "usd") {
    this.productRepository = productRepository;
    this.defaultCurrency = defaultCurrency;
  }

  public validateCart = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const parseResult = cartValidationSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError("Invalid cart payload", parseResult.error);
      }

      const { items, currency } = parseResult.data;
      const effectiveCurrency = (currency || this.defaultCurrency).toLowerCase();

      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      const products = await this.productRepository.findByIds(productIds);

      const productMap = new Map(
        products.map((p) => [p.id, p] as const)
      );

      const canonicalItems: CanonicalCartItem[] = [];
      let total = 0;
      let hasOutOfStockItems = false;
      let hasQuantityAdjustments = false;

      for (const item of items) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new NotFoundError(`Product not found: undefined`);
        }

        if (!product.active) {
          hasOutOfStockItems = true;
          canonicalItems.push({
            productId: product.id,
            name: product.name,
            unitPrice: product.prices[effectiveCurrency] ?? product.price,
            currency: effectiveCurrency,
            quantityRequested: item.quantity,
            quantityAvailable: 0,
            quantityBillable: 0,
            inStock: false,
            backorderAllowed: Boolean(product.backorderAllowed),
            subtotal: 0,
            metadata: product.metadata ?? {},
          });
          continue;
        }

        const unitPrice =
          product.prices?.[effectiveCurrency] ??
          product.prices?.[this.defaultCurrency] ??
          product.price;

        const availableInventory =
          typeof product.inventory === "number" ? product.inventory : Infinity;

        let quantityAvailable = Math.max(0, Math.min(item.quantity, availableInventory));
        let inStock = quantityAvailable > 0;
        let quantityBillable = quantityAvailable;

        if (availableInventory <= 0) {
          inStock = false;
          hasOutOfStockItems = true;

          if (product.backorderAllowed) {
            quantityAvailable = item.quantity;
            quantityBillable = item.quantity;
            inStock = false;
          }
        }

        if (quantityBillable !== item.quantity) {
          hasQuantityAdjustments = true;
        }

        const subtotal = quantityBillable * unitPrice;
        total += subtotal;

        canonicalItems.push({
          productId: product.id,
          name: product.name,
          unitPrice,
          currency: effectiveCurrency,
          quantityRequested: item.quantity,
          quantityAvailable,
          quantityBillable,
          inStock,
          backorderAllowed: Boolean(product.backorderAllowed),
          subtotal,
          metadata: product.metadata ?? {},
        });
      }

      const response: CanonicalCartResponse = {
        items: canonicalItems,
        currency: effectiveCurrency,
        total,
        hasOutOfStockItems,
        hasQuantityAdjustments,
      };

      res.status(httpStatus.OK).json(response);
    } catch (error) {
      logger.error("Error validating cart", {
        error,
        body: req.body,
      });
      next(error);
    }
  };
}

export const createCartController = (
  productRepository: ProductRepository,
  defaultCurrency?: string
): CartController => {
  return new CartController(productRepository, defaultCurrency);
};