export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // cents
  imageUrl: string;
  category: string;
  stock: number;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  total: number;
  status: string;
  items: OrderItem[];
  createdAt: string;
}
