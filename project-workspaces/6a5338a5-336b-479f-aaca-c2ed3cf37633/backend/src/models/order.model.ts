import { pool } from '../index';

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: string;
  billing_address: string;
  payment_intent_id: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
}

export const createOrderTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      shipping_address TEXT NOT NULL,
      billing_address TEXT NOT NULL,
      payment_intent_id VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      price NUMERIC(10, 2) NOT NULL,
      UNIQUE (order_id, product_id)
    );
  `);
};

export const insertOrder = async (order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<Order> => {
  const result = await pool.query<Order>(
    `INSERT INTO orders (user_id, total_amount, shipping_address, billing_address, payment_intent_id, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [order.user_id, order.total_amount, order.shipping_address, order.billing_address, order.payment_intent_id]
  );
  return result.rows[0];
};

export const insertOrderItem = async (orderItem: Omit<OrderItem, 'id'>): Promise<OrderItem> => {
  const result = await pool.query<OrderItem>(
    `INSERT INTO order_items (order_id, product_id, quantity, price)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orderItem.order_id, orderItem.product_id, orderItem.quantity, orderItem.price]
  );
  return result.rows[0];
};

export const findOrdersByUserId = async (userId: string): Promise<Order[]> => {
  const result = await pool.query<Order>('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
};

export const findOrderById = async (orderId: string): Promise<Order | null> => {
  const result = await pool.query<Order>('SELECT * FROM orders WHERE id = $1', [orderId]);
  return result.rows[0] || null;
};

export const findOrderItemsByOrderId = async (orderId: string): Promise<OrderItem[]> => {
  const result = await pool.query<OrderItem>('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return result.rows;
};

export const updateOrderStatus = async (orderId: string, status: Order['status']): Promise<void> => {
  await pool.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, orderId]);
};

export const updateOrderPaymentIntent = async (orderId: string, paymentIntentId: string): Promise<void> => {
  await pool.query('UPDATE orders SET payment_intent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [paymentIntentId, orderId]);
};
