import axios from 'axios';
import { Product } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getProducts = async (): Promise<Product[]> => {
  const response = await api.get<Product[]>('/products');
  return response.data;
};

export const getProductById = async (id: string): Promise<Product> => {
  const response = await api.get<Product>(`/products/${id}`);
  return response.data;
};

export const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  const response = await api.post<Product>('/products', productData);
  return response.data;
};

export const updateProduct = async (id: string, productData: Partial<Product>): Promise<Product> => {
  const response = await api.put<Product>(`/products/${id}`, productData);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await api.delete(`/products/${id}`);
};
