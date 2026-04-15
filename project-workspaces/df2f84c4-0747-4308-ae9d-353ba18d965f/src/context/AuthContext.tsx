import React, { createContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { authApi } from '../utils/api';

// Define action types
type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { token: string; user: User } }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'REGISTER_SUCCESS'; payload: { token: string; user: User } };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

// Reducer function
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

// Create AuthContext
export const AuthContext = createContext<{
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
  login: (credentials: any) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
}>({
  state: initialState,
  dispatch: () => null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

// AuthProvider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Auto-login on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        // Here, you would typically verify the token with the backend
        // and fetch user data. For simplicity, we'll decode it locally (not secure for production without server-side validation)
        // A better approach would be to have a /api/auth/me endpoint
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const user = JSON.parse(atob(base64)); // This is a client-side decode, not a validation

          // Assuming the token payload contains user info directly
          dispatch({ type: 'LOGIN_SUCCESS', payload: { token, user } });
        } catch (error) {
          console.error('Failed to parse token or validate user:', error);
          dispatch({ type: 'LOGOUT' }); // Invalidate token if parsing fails
        }
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    };
    loadUser();
  }, []);

  const login = async (credentials: any) => {
    try {
      const res = await authApi.login(credentials);
      dispatch({ type: 'LOGIN_SUCCESS', payload: res.data });
    } catch (error: any) {
      throw error.response?.data?.message || 'Login failed';
    }
  };

  const register = async (userData: any) => {
    try {
      const res = await authApi.register(userData);
      dispatch({ type: 'REGISTER_SUCCESS', payload: res.data });
    } catch (error: any) {
      throw error.response?.data?.message || 'Registration failed';
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ state, dispatch, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};