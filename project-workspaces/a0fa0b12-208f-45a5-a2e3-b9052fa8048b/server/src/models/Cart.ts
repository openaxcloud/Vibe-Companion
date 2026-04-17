import { query } from '../config/db';
import { Product } from './Product';
import { User } from './User';

export interface Cart {
  id: string;
  userId: string;
  created_at: Date;
  updated_at: Date;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  created_at: Date;
  updated_at: Date;
  product?: Product; // Populated product details
}

export const findCartByUserId = async (userId: string): Promise<Cart | null> => {
  const result = await query('SELECT * FROM carts WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
};

export const createCart = async (userId: string): Promise<Cart> => {
  const id = `cart_${Date.now()}`;
  const result = await query('INSERT INTO carts (id, user_id) VALUES ($1, $2) RETURNING *;', [id, userId]);
  return result.rows[0];
};

export const findCartItemsByCartId = async (cartId: string): Promise<CartItem[]> => {
  const result = await query(
    `SELECT ci.id, ci.quantity, ci.product_id, p.name, p.description, p.price, p.image_url, p.category, p.stock
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC;
    `,
    [cartId]
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    cartId,
    productId: row.product_id,
    quantity: row.quantity,
    product: {
      id: row.product_id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      imageUrl: row.image_url,
      category: row.category,
      stock: row.stock,
      // created_at and updated_at are not selected for product in this join, assuming they are not strictly needed for cart item display
    },
  }));
};

export const findCartItemByProductAndCart = async (cartId: string, productId: string): Promise<CartItem | null> => {
  const result = await query('SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cartId, productId]);
  return result.rows[0] || null;
};

export const addCartItem = async (cartId: string, productId: string, quantity: number): Promise<CartItem> => {
  const id = `cartitem_${Date.now()}`;
  const result = await query(
    'INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES ($1, $2, $3, $4) RETURNING *;',
    [id, cartId, productId, quantity]
  );
  return result.rows[0];
};

export const updateCartItemQuantity = async (id: string, quantity: number): Promise<CartItem | null> => {
  const result = await query(
    'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
    [quantity, id]
  );
  return result.rows[0] || null;
};

export const removeCartItem = async (id: string): Promise<void> => {
  await query('DELETE FROM cart_items WHERE id = $1', [id]);
};

export const clearCartItems = async (cartId: string): Promise<void> => {
  await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
};
