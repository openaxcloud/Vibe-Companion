// This file will contain functions for making API calls to the backend.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiOptions {
  method?: string;
  headers?: HeadersInit;
  body?: any;
  token?: string;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Something went wrong');
  }

  return response.json();
}

// Auth API
export const registerUser = (data: any) => apiRequest('/auth/register', { method: 'POST', body: data });
export const loginUser = (data: any) => apiRequest('/auth/login', { method: 'POST', body: data });
export const fetchUserProfile = (token: string) => apiRequest('/auth/profile', { token });

// Product API
export const fetchProducts = (query?: string, category?: string, minPrice?: number, maxPrice?: number) => {
  const params = new URLSearchParams();
  if (query) params.append('search', query);
  if (category) params.append('category', category);
  if (minPrice !== undefined) params.append('minPrice', minPrice.toString());
  if (maxPrice !== undefined) params.append('maxPrice', maxPrice.toString());
  return apiRequest(`/products?${params.toString()}`);
};
export const fetchProductById = (id: string) => apiRequest(`/products/${id}`);
export const createProduct = (data: any, token: string) => apiRequest('/products', { method: 'POST', body: data, token });
export const updateProduct = (id: string, data: any, token: string) => apiRequest(`/products/${id}`, { method: 'PUT', body: data, token });

// Order API
export const createOrder = (data: any, token: string) => apiRequest('/orders', { method: 'POST', body: data, token });
export const fetchOrders = (token: string) => apiRequest('/orders', { token });
export const fetchOrderById = (id: string, token: string) => apiRequest(`/orders/${id}`, { token });
export const updateOrderStatus = (id: string, status: string, token: string) => apiRequest(`/orders/${id}/status`, { method: 'PUT', body: { status }, token });

// Stripe API
export const createPaymentIntent = (data: { amount: number; currency?: string; cartItems: any[] }, token: string) =>
  apiRequest('/stripe/create-payment-intent', { method: 'POST', body: data, token });
