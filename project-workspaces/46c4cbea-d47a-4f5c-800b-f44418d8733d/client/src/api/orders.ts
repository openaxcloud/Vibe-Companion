import axios from 'axios';
import { Order } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const createOrder = async (orderData: { cartItems: any[]; shippingAddress: any }): Promise<Order> => {
  const response = await api.post<Order>('/orders', orderData);
  return response.data;
};

export const getOrders = async (): Promise<Order[]> => {
  const response = await api.get<Order[]>('/orders');
  return response.data;
};

export const getOrderById = async (id: string): Promise<Order> => {
  const response = await api.get<Order>(`/orders/${id}`);
  return response.data;
};
