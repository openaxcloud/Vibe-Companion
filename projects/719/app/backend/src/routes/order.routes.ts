import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { Types } from "mongoose";

const router = Router();

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface AuthUser {
  id: string;
  role: "user" | "admin";
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Placeholder order type; in a real app, import from your models
interface Order {
  _id: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Placeholder in-memory store; replace with real DB integration
const mockOrders: Order[] = [];

// Middleware: require authentication (replace with real auth)
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
};

// Middleware: require admin role
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
};

// Centralized validation error handler
const handleValidation: (req: Request, res: Response, next: NextFunction) => void = (
  req,
  res,
  next
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: "Validation failed", errors: errors.array() });
    return;
  }
  next();
};

const isValidObjectId = (value: string): boolean => {
  return Types.ObjectId.isValid(value);
};

// GET / - Get orders for current user
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const userOrders = mockOrders.filter((o) => o.userId === userId);
  res.json(userOrders);
});

// GET /all - Admin: get all orders
router.get(
  "/all",
  requireAuth,
  requireAdmin,
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json(mockOrders);
  }
);

// GET /:id - Get single order (owner or admin)
router.get(
  "/:id",
  requireAuth,
  param("id")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid order id"),
  handleValidation,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orderId = req.params.id;
    const order = mockOrders.find((o) => o._id === orderId);

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    if (req.user!.role !== "admin" && order.userId !== req.user!.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json(order);
  }
);

// PATCH /:id/status - Admin: update order status
router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  [
    param("id")
      .custom((value) => isValidObjectId(value))
      .withMessage("Invalid order id"),
    body("status")
      .isString()
      .custom((value) =>
        ["pending", "processing", "shipped", "delivered", "cancelled"].includes(value)
      )
      .withMessage(
        "Invalid status, must be one of: pending, processing, shipped, delivered, cancelled"
      ),
  ],
  handleValidation,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orderId = req.params.id;
    const { status } = req.body as { status: OrderStatus };

    const orderIndex = mockOrders.findIndex((o) => o._id === orderId);

    if (orderIndex === -1) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    mockOrders[orderIndex].status = status;
    mockOrders[orderIndex].updatedAt = new Date();

    res.json(mockOrders[orderIndex]);
  }
);

export default router;