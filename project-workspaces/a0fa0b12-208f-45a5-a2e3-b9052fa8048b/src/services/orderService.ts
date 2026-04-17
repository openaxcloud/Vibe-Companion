import api from './api';
import { Order, ShippingAddress, BillingAddress } from '../utils/types';

interface CreateOrderPayload {
  items: { productId: string; quantity: number }[];
  shippingAddress: ShippingAddress;
  billingAddress: BillingAddress;
  totalAmount: number;
}

interface CreateOrderResponse {
  sessionId: string;
}

export const createOrder = async (token: string, orderData: CreateOrderPayload): Promise<CreateOrderResponse> => {
  const response = await api.post<CreateOrderResponse>('/orders', orderData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getOrdersByUserId = async (token: string, userId: string): Promise<Order[]> => {
  const response = await api.get<Order[]>(`/orders/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getAllOrders = async (token: string): Promise<Order[]> => {
  const response = await api.get<Order[]>('/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateOrderStatus = async (token: string, orderId: string, status: Order['orderStatus']): Promise<Order> => {
  const response = await api.put<Order>(`/orders/${orderId}/status`, { status }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
