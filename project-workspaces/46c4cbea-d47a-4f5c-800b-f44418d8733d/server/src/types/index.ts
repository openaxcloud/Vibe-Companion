export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category: string;
  inventory: number;
  rating?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  user_id: string;
  user_email: string;
  shipping_address: ShippingAddress;
  total_amount: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  created_at: Date;
  updated_at: Date;
  items: OrderItem[]; // Populated when fetching full order details
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
  created_at: Date;
}

export interface ShippingAddress {
  address: string;
  city: string;
  zip: string;
  country: string;
}

export interface JwtPayload extends jwt.JwtPayload {
  id: string;
  role: string;
}

// Frontend types (re-declare or import from client/src/types.ts if you want to share)
// For a full-stack project, it's common to have shared types or generate them.
// For now, these are defined independently on the backend.

export interface CheckoutItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}
