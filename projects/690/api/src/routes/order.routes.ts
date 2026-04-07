import { Router, Request, Response, NextFunction } from "express";
import { body, param, query } from "express-validator";
import { Types } from "mongoose";
import { Order, IOrder, OrderStatus } from "../models/Order";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateRequest } from "../middleware/validateRequest";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const isValidObjectId = (value: string): boolean => {
  return Types.ObjectId.isValid(value);
};

router.post(
  "/",
  authenticate,
  body("cartId").notEmpty().withMessage("cartId is required"),
  body("cartId")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid cartId"),
  body("shippingAddress")
    .notEmpty()
    .withMessage("shippingAddress is required")
    .isObject()
    .withMessage("shippingAddress must be an object"),
  body("shippingAddress.fullName")
    .notEmpty()
    .withMessage("Full name is required"),
  body("shippingAddress.addressLine1")
    .notEmpty()
    .withMessage("Address line 1 is required"),
  body("shippingAddress.city").notEmpty().withMessage("City is required"),
  body("shippingAddress.postalCode")
    .notEmpty()
    .withMessage("Postal code is required"),
  body("shippingAddress.country").notEmpty().withMessage("Country is required"),
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["card", "paypal", "cod"])
    .withMessage("Invalid payment method"),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { cartId, shippingAddress, paymentMethod } = req.body;

    const cart = await Cart.findOne({ _id: cartId, user: req.user!.id }).populate("items.product");
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    if (!cart.items.length) {
      throw new BadRequestError("Cart is empty");
    }

    let totalAmount = 0;
    const orderItems: IOrder["items"] = [];

    for (const item of cart.items) {
      if (!item.product) continue;

      const productDoc = await Product.findById(item.product);
      if (!productDoc) {
        throw new NotFoundError("Product not found in cart");
      }

      if (productDoc.stock < item.quantity) {
        throw new BadRequestError(
          `Insufficient stock for product: undefined`
        );
      }

      const itemTotal = productDoc.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product: productDoc._id,
        name: productDoc.name,
        price: productDoc.price,
        quantity: item.quantity,
        image: productDoc.image,
      });

      productDoc.stock -= item.quantity;
      await productDoc.save();
    }

    const order: IOrder = await Order.create({
      user: req.user!.id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      status: OrderStatus.Pending,
      totalAmount,
      isPaid: false,
      paidAt: null,
      isDelivered: false,
      deliveredAt: null,
    });

    await Cart.deleteOne({ _id: cartId });

    res.status(201).json({
      success: true,
      data: order,
    });
  })
);

router.get(
  "/my",
  authenticate,
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as number | undefined) || 1;
    const limit = (req.query.limit as number | undefined) || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user!.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ user: req.user!.id }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

router.get(
  "/admin",
  authenticate,
  authorize("admin"),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("status")
    .optional()
    .isIn(Object.values(OrderStatus))
    .withMessage("Invalid status filter"),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as number | undefined) || 1;
    const limit = (req.query.limit as number | undefined) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

router.get(
  "/:id",
  authenticate,
  param("id")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid order id"),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email"
    );

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (
      order.user &&
      order.user._id.toString() !== req.user!.id &&
      req.user!.role !== "admin"
    ) {
      throw new ForbiddenError("Not authorized to view this order");
    }

    res.json({
      success: true,
      data: order,
    });
  })
);

router.patch(
  "/admin/:id",
  authenticate,
  authorize("admin"),
  param("id")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid order id"),
  body("status")
    .optional()
    .isIn(Object.values(OrderStatus))
    .withMessage("Invalid status"),
  body("isPaid").optional().isBoolean(),
  body("isDelivered").optional().isBoolean(),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, isPaid, isDelivered } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (typeof status !== "undefined") {
      order.status = status;
    }

    if (typeof isPaid !== "undefined") {
      order.isPaid = isPaid;
      order.paidAt = isPaid ? new Date() : null;
    }

    if (typeof isDelivered !== "undefined") {
      order.isDelivered = isDelivered;
      order.deliveredAt = isDelivered ? new Date() : null;
    }

    await order.save();

    res.json({
      success: true,
      data: order,
    });
  })
);

router.patch(
  "/:id/status",
  authenticate,
  param("id")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid order id"),
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([OrderStatus.Cancelled])
    .withMessage("Invalid status update"),
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.user.toString() !== req.user!.id) {
      throw new ForbiddenError("Not authorized to modify this order");
    }

    if (
      order.status !== OrderStatus.Pending &&
      order.status !== OrderStatus.Processing
    ) {
      throw new BadRequestError("Only pending or processing orders can be cancelled");
    }

    order.status = OrderStatus.Cancelled;
    await