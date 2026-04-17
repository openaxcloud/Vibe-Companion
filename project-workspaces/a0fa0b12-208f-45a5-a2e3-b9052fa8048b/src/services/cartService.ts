import api from './api';
import { CartItem } from '../utils/types';

export const getCart = async (token: string): Promise<CartItem[]> => {
  const response = await api.get<CartItem[]>('/cart', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const addItemToCart = async (token: string, productId: string, quantity: number): Promise<CartItem[]> => {
  const response = await api.post<CartItem[]>('/cart', { productId, quantity }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const removeItemFromCart = async (token: string, productId: string): Promise<CartItem[]> => {
  const response = await api.delete<CartItem[]>(`/cart/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateItemQuantity = async (token: string, productId: string, quantity: number): Promise<CartItem[]> => {
  const response = await api.put<CartItem[]>(`/cart/${productId}`, { quantity }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const clearCart = async (token: string): Promise<void> => {
  await api.delete('/cart/clear', {
    headers: { Authorization: `Bearer ${token}` },
  });
};
