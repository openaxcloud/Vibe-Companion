import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "failed";

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderDocument extends Document {
  userId: Types.ObjectId;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  paymentIntentId?: string;
  paymentMethod?: string;
  shippingAddress: ShippingAddress;
  orderItems: Types.ObjectId[];
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // Virtuals
  id: string;
}

export interface OrderModel extends Model<OrderDocument> {}

const ShippingAddressSchema = new Schema<ShippingAddress>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    state: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
    },
  },
  { _id: false }
);

const OrderSchema = new Schema<OrderDocument, OrderModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "paid",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "failed",
      ],
      default: "pending",
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "USD",
      maxlength: 3,
    },
    paymentIntentId: {
      type: String,
      trim: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      required: true,
    },
    orderItems: [
      {
        type: Schema.Types.ObjectId,
        ref: "OrderItem",
        required: true,
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

const Order =
  (mongoose.models.Order as OrderModel) ||
  mongoose.model<OrderDocument, OrderModel>("Order", OrderSchema);

export default Order;