import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string;
  [key: string]: unknown;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
}

export interface Cart {
  id: string;
  userId?: string | null;
  items: CartItem[];
  totals: CartTotals;
  updatedAt: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface AddCartItemPayload {
  productId: string;
  quantity: number;
  variantId?: string;
  [key: string]: unknown;
}

export interface UpdateCartItemPayload {
  quantity: number;
  [key: string]: unknown;
}

export interface CartApiConfig {
  baseURL?: string;
  withCredentials?: boolean;
  headers?: AxiosRequestConfig['headers'];
}

const DEFAULT_CONFIG: Required<CartApiConfig> = {
  baseURL: '/api',
  withCredentials: true,
  headers: {},
};

let axiosClient: AxiosInstance | null = null;

const createAxiosClient = (config?: CartApiConfig): AxiosInstance => {
  const finalConfig: CartApiConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    headers: {
      ...DEFAULT_CONFIG.headers,
      ...(config?.headers ?? {}),
    },
  };

  return axios.create({
    baseURL: finalConfig.baseURL,
    withCredentials: finalConfig.withCredentials,
    headers: finalConfig.headers,
  });
};

export const initCartApi = (config?: CartApiConfig): void => {
  axiosClient = createAxiosClient(config);
};

const getClient = (): AxiosInstance => {
  if (!axiosClient) {
    axiosClient = createAxiosClient();
  }
  return axiosClient;
};

const handleResponse = <T>(response: AxiosResponse<T>): T => {
  return response.data;
};

export const fetchCart = async (): Promise<Cart> => {
  const client = getClient();
  const response = await client.get<Cart>('/cart');
  return handleResponse(response);
};

export const addItemToCart = async (
  payload: AddCartItemPayload
): Promise<Cart> => {
  const client = getClient();
  const response = await client.post<Cart>('/cart/items', payload);
  return handleResponse(response);
};

export const updateCartItem = async (
  itemId: string,
  payload: UpdateCartItemPayload
(): Promise<Cart> => {
  const client = getClient();
  const response = await client.patch<Cart>(`/cart/items/undefined`, payload);
  return handleResponse(response);
};

export const removeCartItem = async (itemId: string): Promise<Cart> => {
  const client = getClient();
  const response = await client.delete<Cart>(`/cart/items/undefined`);
  return handleResponse(response);
};

export const clearCart = async (): Promise<Cart> => {
  const client = getClient();
  const response = await client.delete<Cart>('/cart');
  return handleResponse(response);
};

export const setCartItemQuantity = async (
  itemId: string,
  quantity: number
): Promise<Cart> => {
  return updateCartItem(itemId, { quantity });
};

export const cartApi = {
  init: initCartApi,
  fetchCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  setCartItemQuantity,
};