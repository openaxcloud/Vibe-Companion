import { Request } from 'express';
import { User } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: User; // Add user property to Request object
    }
  }
}

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
}

export interface CartItemPayload {
  productId: string;
  quantity: number;
}

export interface ShippingAddressPayload {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderPayload {
  items: { productId: string; quantity: number }[];
  shippingAddress: ShippingAddressPayload;
  billingAddress: ShippingAddressPayload; // Reusing for simplicity, could be distinct
  totalAmount: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type UserRole = 'user' | 'admin';
