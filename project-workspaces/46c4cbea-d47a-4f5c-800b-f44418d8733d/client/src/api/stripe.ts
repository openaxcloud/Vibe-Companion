import axios from 'axios';
import { CheckoutItem, ShippingAddress } from '../types';

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

export const createCheckoutSession = async (data: {
  items: CheckoutItem[];
  shippingAddress: ShippingAddress;
}): Promise<{ url: string }> => {
  const response = await api.post<{ url: string }>('/stripe/create-checkout-session', data);
  return response.data;
};
