export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'buyer' | 'seller' | 'admin';
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  stock: number;
  sellerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartProduct extends Product {
  quantity: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'completed' | 'shipped' | 'cancelled';
  shippingAddress?: {
    fullName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  paymentIntentId?: string; // Stripe Payment Intent ID
  createdAt: string;
  updatedAt?: string;
}
