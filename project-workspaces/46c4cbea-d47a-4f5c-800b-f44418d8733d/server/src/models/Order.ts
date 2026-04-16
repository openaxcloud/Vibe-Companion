import pool from '../config/db';
import { Order, ShippingAddress, OrderItem } from '../types';

export const createOrder = async (
  userId: string,
  userEmail: string,
  shippingAddress: ShippingAddress,
  totalAmount: number,
  items: OrderItem[]
): Promise<Order> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, user_email, shipping_address, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *' ,
      [userId, userEmail, shippingAddress, totalAmount, 'Pending']
    );
    const order: Order = orderResult.rows[0];

    const orderItemsValues = items.map(item => `($
      ${order.id}', '${item.productId}', '${item.name}', ${item.quantity}, ${item.price}, '${item.imageUrl || ''}')`);
    await client.query(
      `INSERT INTO order_items (order_id, product_id, name, quantity, price, image_url) VALUES ${orderItemsValues.join(', ')}`
    );

    await client.query('COMMIT');
    return order;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getOrdersByUserId = async (userId: string): Promise<Order[]> => {
  const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  // TODO: Fetch order items for each order
  return result.rows;
};

export const getAllOrders = async (): Promise<Order[]> => {
  const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  // TODO: Fetch order items for each order
  return result.rows;
};

export const getOrderById = async (orderId: string): Promise<Order | undefined> => {
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order: Order = orderResult.rows[0];

  if (order) {
    const itemsResult = await pool.query('SELECT product_id as \"productId\", name, quantity, price, image_url as \"imageUrl\" FROM order_items WHERE order_id = $1', [orderId]);
    order.items = itemsResult.rows;
  }
  return order;
};

export const updateOrderStatus = async (orderId: string, status: Order['status']): Promise<Order | undefined> => {
  const result = await pool.query(
    'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *' ,
    [status, orderId]
  );
  return result.rows[0];
};
