import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Order from "../models/Order";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { UserRole } from "../types/userTypes";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const asyncHandler =
  (
    fn: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => Promise<unknown> | unknown
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * GET /orders
 * Customer: list their orders (with optional status filter)
 * Admin: list all orders (with optional status filter)
 */
router.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.query;
    const query: Record<string, unknown> = {};

    if (status && typeof status === "string") {
      query.status = status;
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === UserRole.CUSTOMER) {
      query.customer = req.user.id;
    }

    const orders = await Order.find(query)
      .populate("customer", "name email")
      .populate("items.product", "name price")
      .sort({ createdAt: -1 });

    res.json({ data: orders });
  })
);

/**
 * GET /orders/:id
 * Customer: view their own order
 * Admin: view any order
 */
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const order = await Order.findById(id)
      .populate("customer", "name email")
      .populate("items.product", "name price");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (
      req.user.role === UserRole.CUSTOMER &&
      order.customer.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json({ data: order });
  })
);

/**
 * GET /admin/orders
 * Admin: list all orders with optional filters
 *  - status: string
 *  - customerId: string
 */
router.get(
  "/admin/orders",
  authenticate,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, customerId } = req.query;
    const query: Record<string, unknown> = {};

    if (status && typeof status === "string") {
      query.status = status;
    }

    if (customerId && typeof customerId === "string") {
      if (!isValidObjectId(customerId)) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }
      query.customer = customerId;
    }

    const orders = await Order.find(query)
      .populate("customer", "name email")
      .populate("items.product", "name price")
      .sort({ createdAt: -1 });

    res.json({ data: orders });
  })
);

/**
 * PATCH /admin/orders/:id/status
 * Admin: update order status
 * Body: { status: string }
 */
router.patch(
  "/admin/orders/:id/status",
  authenticate,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!status || typeof status !== "string") {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ message: `Invalid status. Valid values: undefined` });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status as (typeof validStatuses)[number];
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("items.product", "name price");

    res.json({ data: populatedOrder });
  })
);

export default router;