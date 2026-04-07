import { Schema, Document, Types, model, Model } from 'mongoose';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum FulfillmentStatus {
  UNFULFILLED = 'UNFULFILLED',
  PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED',
  FULFILLED = 'FULFILLED',
  RETURNED = 'RETURNED'
}

export enum OrderStatusUpdateType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ADMIN = 'ADMIN',
  WEBHOOK = 'WEBHOOK'
}

export interface IOrderItem {
  productId: Types.ObjectId;
  skuId?: Types.ObjectId;
  name: string;
  skuCode?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  metadata?: Record<string, unknown>;
}

export interface IOrderShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface IOrderTotals {
  itemsSubtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: string;
}

export interface IOrderStatusUpdate {
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  updatedBy?: Types.ObjectId | null;
  updateType: OrderStatusUpdateType;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface IOrder extends Document {
  customerId: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IOrderShippingAddress;
  billingAddress?: IOrderShippingAddress;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totals: IOrderTotals;
  notes?: string;
  statusHistory: IOrderStatusUpdate[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  deliveredAt?: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    skuId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductSku',
      required: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    skuCode: {
      type: String,
      required: false,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      uppercase: true
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false
    }
  },
  {
    _id: false
  }
);

const OrderAddressSchema = new Schema<IOrderShippingAddress>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    company: {
      type: String,
      required: false,
      trim: true
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true
    },
    addressLine2: {
      type: String,
      required: false,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: false,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 2,
      uppercase: true
    },
    phone: {
      type: String,
      required: false,
      trim: true
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true
    }
  },
  {
    _id: false
  }
);

const OrderTotalsSchema = new Schema<IOrderTotals>(
  {
    itemsSubtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shippingTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    taxTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    discountTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      uppercase: true
    }
  },
  {
    _id: false
  }
);

const OrderStatusUpdateSchema = new Schema<IOrderStatusUpdate>(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: false
    },
    fulfillmentStatus: {
      type: String,
      enum: Object.values(FulfillmentStatus),
      required: false
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    updateType: {
      type: String,
      enum: Object.values(OrderStatusUpdateType),
      required: true
    },
    reason: {
      type: String,
      required: false,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const OrderSchema = new Schema<IOrder>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (value: IOrderItem[]) => Array.isArray(value) && value.length > 0,
        message: 'Order must contain at least one item.'
      }
    },
    shippingAddress: {
      type: OrderAddressSchema,
      required: true
    },
    billingAddress: {
      type: OrderAddressSchema,
      required: false
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.PENDING,
      index: true
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      default: PaymentStatus.PENDING
    },
    fulfillmentStatus: {
      type: String,
      enum: Object.values(FulfillmentStatus),
      required: true,
      default: FulfillmentStatus.UNFULFILLED
    },
    totals: {
      type: OrderTotalsSchema,
      required: true
    },
    notes: {
      type: String,
      required: false,
      trim: true
    },
    statusHistory: {
      type: [OrderStatusUpdateSchema],
      required: true,
      default: []
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false
    },
    canceledAt: {
      type: Date,
      required: false
    },
    deliveredAt: {
      type: Date,
      required: false