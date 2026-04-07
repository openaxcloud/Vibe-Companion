import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient, InventoryLogAction } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// Example auth/admin middleware placeholders.
// Replace with your real authentication/authorization logic.
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Assume user is attached to req in real middleware
  // if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Assume role is checked in real middleware
  // if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
  next();
};

const adjustStockSchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().min(1).max(255).optional(),
  // "action" is optional; if omitted, we infer based on delta sign
  action: z.enum(["INCREASE", "DECREASE"]).optional(),
});

const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

// Helper to ensure we never go negative and to log adjustment atomically
async function adjustProductStock(options: {
  productId: string;
  delta: number;
  reason?: string;
  action?: InventoryLogAction;
  performedByUserId?: string | null;
}) {
  const { productId, delta, reason, action, performedByUserId } = options;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    const newStock = product.stock + delta;
    if (newStock < 0) {
      throw Object.assign(new Error("Insufficient stock"), { status: 400 });
    }

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    const logAction: InventoryLogAction =
      action ??
      (delta > 0 ? InventoryLogAction.INCREASE : InventoryLogAction.DECREASE);

    await tx.inventoryLog.create({
      data: {
        productId,
        change: delta,
        action: logAction,
        reason: reason ?? null,
        resultingStock: newStock,
        performedByUserId: performedByUserId ?? null,
      },
    });

    return updatedProduct;
  });
}

// Increase stock
router.post(
  "/admin/inventory/:productId/increase",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = adjustStockSchema.safeParse({
        ...req.body,
        action: "INCREASE",
      });
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.flatten(),
        });
      }
      const { quantity, reason } = parseResult.data;
      const { productId } = req.params;

      const updatedProduct = await adjustProductStock({
        productId,
        delta: quantity,
        reason,
        action: InventoryLogAction.INCREASE,
        // Replace with real user id from auth context
        performedByUserId: (req as any).user?.id ?? null,
      });

      res.status(200).json({
        message: "Stock increased successfully",
        data: updatedProduct,
      });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      next(err);
    }
  }
);

// Decrease stock
router.post(
  "/admin/inventory/:productId/decrease",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = adjustStockSchema.safeParse({
        ...req.body,
        action: "DECREASE",
      });
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.flatten(),
        });
      }
      const { quantity, reason } = parseResult.data;
      const { productId } = req.params;

      const updatedProduct = await adjustProductStock({
        productId,
        delta: -quantity,
        reason,
        action: InventoryLogAction.DECREASE,
        // Replace with real user id from auth context
        performedByUserId: (req as any).user?.id ?? null,
      });

      res.status(200).json({
        message: "Stock decreased successfully",
        data: updatedProduct,
      });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      next(err);
    }
  }
);

// Set stock to a specific absolute value
router.put(
  "/admin/inventory/:productId/set",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bodySchema = z.object({
        stock: z.number().int().min(0),
        reason: z.string().min(1).max(255).optional(),
      });

      const parseResult = bodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.flatten(),
        });
      }

      const { stock, reason } = parseResult.data;
      const { productId } = req.params;

      const updatedProduct = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, stock: true },
        });

        if (!product) {
          throw Object.assign(new Error("Product not found"), { status: 404 });
        }

        const delta = stock - product.stock;

        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock },
        });

        let action: InventoryLogAction | null = null;
        if (delta > 0) action = InventoryLogAction.INCREASE;
        else if (delta < 0) action = InventoryLogAction.DECREASE;

        if (delta !== 0 && action) {
          await tx.inventoryLog.create({
            data: {
              productId,
              change: delta,
              action,
              reason: reason ?? null,
              resultingStock: stock,
              performedByUserId: (req as any).user?.id ?? null,
            },
          });
        }

        return updated;
      });

      res.status(200).json({
        message: "Stock set successfully",
        data: updatedProduct,
      });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      next(err);
    }
  }
);

// List inventory logs with pagination and optional filters
router.get(
  "/admin/inventory/logs",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const baseParsed = paginationSchema.safeParse(req.query);
      if (!baseParsed.success) {
        return res.status(400).json({
          message: "Invalid pagination params",
          errors: baseParsed.error.flatten(),
        });
      }
      const { page, limit } = baseParsed.data;

      const filterSchema = z.object({
        productId: z.string().optional(),
        action: z
          .enum(["INCREASE", "DECREASE", "MANUAL_ADJUSTMENT"])
          .optional(),
      });

      const filterParse = filterSchema.safeParse(req.query);
      if (!filterParse.success) {
        return res.status(400).json({
          message: "Invalid filter params",
          errors: filterParse.error.flatten(),
        });
      }

      const { productId, action } = filterParse.data;

      const where: any = {};
      if (productId) where.productId = productId;
      if (action) where.action = action;

      const [logs, total] = await Promise.all([
        prisma.inventoryLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            performedByUser: {
              select: {
                id: true,
                email: true,
              },