import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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

export const authApi = {
  register: (userData: any) => api.post('/auth/register', userData),
  login: (credentials: any) => api.post('/auth/login', credentials),
};

export const productApi = {
  getProducts: (params?: any) => api.get('/products', { params }),
  getProductById: (id: string) => api.get(`/products/${id}`),
  getCategories: () => api.get('/products/categories'),
  createProduct: (productData: any) => api.post('/products', productData),
  updateProduct: (id: string, productData: any) => api.put(`/products/${id}`, productData),
  deleteProduct: (id: string) => api.delete(`/products/${id}`),
};

export const cartApi = {
  // Assuming a client-side cart for now, but these would be for server-side cart
  // addToCart: (productId: string, quantity: number) => api.post('/cart/add', { productId, quantity }),
  // updateCartItem: (productId: string, quantity: number) => api.put('/cart/update', { productId, quantity }),
  // removeFromCart: (productId: string) => api.delete('/cart/remove', { data: { productId } }),
  // getCart: () => api.get('/cart'),
};

export const orderApi = {
  createOrder: (orderData: { cartItems: any[]; totalAmount: number; }) => api.post('/orders', orderData),
  getUserOrders: () => api.get('/orders'),
  getOrderById: (id: string) => api.get(`/orders/${id}`),
  updateOrderStatus: (id: string, status: string) => api.put(`/orders/${id}/status`, { status }),
};

export const stripeApi = {
  createPaymentIntent: (amount: number) => api.post('/stripe/create-payment-intent', { amount }),
};

export default api;