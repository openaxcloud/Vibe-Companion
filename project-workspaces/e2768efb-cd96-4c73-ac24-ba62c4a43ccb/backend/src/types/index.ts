export interface User {
  id: string;
  email: string;
  password?: string; // Optional for type safety if not always returned
  name?: string;
  role: 'buyer' | 'seller' | 'admin';
  created_at: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category: string;
  stock: number;
  seller_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  total: number;
  shipping_address: object; // JSONB type in PostgreSQL
  payment_intent_id: string; 
  status: 'pending' | 'completed' | 'shipped' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

export interface OrderItemDb {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}
