import { query } from '../config/db';
import { OrderStatus, PaymentStatus, ShippingAddressPayload } from '../types';
import { User } from './User';
import { Product } from './Product';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  priceAtPurchase: number;
  created_at: Date;
  updated_at: Date;
  product?: Product; // Populated product details
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  shippingAddress: ShippingAddressPayload;
  billingAddress: ShippingAddressPayload;
  paymentIntentId?: string;
  created_at: Date;
  updated_at: Date;
  user?: User; // Populated user details
  items?: OrderItem[]; // Populated order items
}

interface CreateOrderInput {
  userId: string;
  totalAmount: number;
  shippingAddress: ShippingAddressPayload;
  billingAddress: ShippingAddressPayload;
  paymentIntentId?: string;
}

export const createOrder = async (order: CreateOrderInput): Promise<Order> => {
  const id = `order_${Date.now()}`;
  const result = await query(
    'INSERT INTO orders (id, user_id, total_amount, shipping_address, billing_address, payment_intent_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
    [id, order.userId, order.totalAmount, order.shippingAddress, order.billingAddress, order.paymentIntentId]
  );
  return result.rows[0];
};

export const addOrderItem = async (orderId: string, productId: string, quantity: number, priceAtPurchase: number): Promise<OrderItem> => {
  const id = `orderitem_${Date.now()}`;
  const result = await query(
    'INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4, $5) RETURNING *;',
    [id, orderId, productId, quantity, priceAtPurchase]
  );
  return result.rows[0];
};

export const findOrderById = async (id: string): Promise<Order | null> => {
  const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const findOrdersByUserId = async (userId: string): Promise<Order[]> => {
  const result = await query(
    `SELECT o.*, u.username, u.email
     FROM orders o
     JOIN users u ON o.user_id = u.id
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC;
    `,
    [userId]
  );

  const ordersWithItems = await Promise.all(result.rows.map(async (orderRow: any) => {
    const itemsResult = await query(
      `SELECT oi.id, oi.quantity, oi.price_at_purchase, p.id AS product_id, p.name, p.description, p.price, p.image_url, p.category, p.stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1;
      `,
      [orderRow.id]
    );
    return {
      ...orderRow,
      totalAmount: parseFloat(orderRow.total_amount),
      user: { id: orderRow.user_id, username: orderRow.username, email: orderRow.email },
      items: itemsResult.rows.map((itemRow: any) => ({
        id: itemRow.id,
        orderId: itemRow.order_id,
        productId: itemRow.product_id,
        quantity: itemRow.quantity,
        priceAtPurchase: parseFloat(itemRow.price_at_purchase),
        product: {
          id: itemRow.product_id,
          name: itemRow.name,
          description: itemRow.description,
          price: parseFloat(itemRow.price),
          imageUrl: itemRow.image_url,
          category: itemRow.category,
          stock: itemRow.stock,
        },
      })),
    };
  }));
  return ordersWithItems;
};

export const findAllOrders = async (): Promise<Order[]> => {
  const result = await query(
    `SELECT o.*, u.username, u.email
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ORDER BY o.created_at DESC;
    `,
    []
  );

  const ordersWithItems = await Promise.all(result.rows.map(async (orderRow: any) => {
    const itemsResult = await query(
      `SELECT oi.id, oi.quantity, oi.price_at_purchase, p.id AS product_id, p.name, p.description, p.price, p.image_url, p.category, p.stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1;
      `,
      [orderRow.id]
    );
    return {
      ...orderRow,
      totalAmount: parseFloat(orderRow.total_amount),
      user: { id: orderRow.user_id, username: orderRow.username, email: orderRow.email },
      items: itemsResult.rows.map((itemRow: any) => ({
        id: itemRow.id,
        orderId: itemRow.order_id,
        productId: itemRow.product_id,
        quantity: itemRow.quantity,
        priceAtPurchase: parseFloat(itemRow.price_at_purchase),
        product: {
          id: itemRow.product_id,
          name: itemRow.name,
          description: itemRow.description,
          price: parseFloat(itemRow.price),
          imageUrl: itemRow.image_url,
          category: itemRow.category,
          stock: itemRow.stock,
        },
      })),
    };
  }));
  return ordersWithItems;
};

export const updateOrder = async (id: string, updates: { paymentStatus?: PaymentStatus; orderStatus?: OrderStatus; paymentIntentId?: string }): Promise<Order | null> => {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const key in updates) {
    if (updates.hasOwnProperty(key)) {
      fields.push(`${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = $${paramIndex}`);
      params.push((updates as any)[key]);
      paramIndex++;
    }
  }

  if (fields.length === 0) return findOrderById(id); // No updates provided

  params.push(id);

  const result = await query(
    `UPDATE orders SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *;`,
    params
  );
  return result.rows[0] || null;
};
