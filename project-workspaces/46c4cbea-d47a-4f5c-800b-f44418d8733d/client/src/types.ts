export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  inventory: number;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  totalAmount: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

export interface ShippingAddress {
  address: string;
  city: string;
  zip: string;
  country: string;
}

// API Payloads
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface CheckoutItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}
