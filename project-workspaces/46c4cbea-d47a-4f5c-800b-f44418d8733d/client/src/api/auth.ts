import axios from 'axios';
import { LoginCredentials, RegisterCredentials, User } from '../types';

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

export const register = async (username: string, email: string, password: string) => {
  const response = await api.post<User>('/auth/register', { username, email, password });
  return response.data;
};

export const login = async (email: string, password: string) => {
  const response = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
  return response.data;
};

export const verifyToken = async (token: string) => {
  const response = await api.get<User>('/auth/verify-token', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
