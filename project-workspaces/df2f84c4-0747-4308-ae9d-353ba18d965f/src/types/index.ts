export interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_id: string;
  category_name: string;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
  quantity: number;
  stock_quantity: number; // For checking available stock
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url: string;
}

export interface Order {
  order_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'shipped';
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface Category {
  id: string;
  name: string;
}