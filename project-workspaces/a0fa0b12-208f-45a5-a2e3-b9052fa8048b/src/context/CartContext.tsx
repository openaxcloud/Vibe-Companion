import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { CartItem, Product } from '../utils/types';
import * as cartService from '../services/cartService';
import { useAuth } from './AuthContext';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateCartItemQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCart = async () => {
      if (isAuthenticated()) {
        setLoading(true);
        try {
          const fetchedCart = await cartService.getCart(token!);
          setCart(fetchedCart);
        } catch (error) {
          console.error('Failed to fetch cart:', error);
          setCart([]);
        } finally {
          setLoading(false);
        }
      } else {
        // For guests, load from localStorage
        const localCart = localStorage.getItem('guestCart');
        setCart(localCart ? JSON.parse(localCart) : []);
      }
    };
    fetchCart();
  }, [isAuthenticated, token, user]);

  const saveGuestCart = (newCart: CartItem[]) => {
    localStorage.setItem('guestCart', JSON.stringify(newCart));
    setCart(newCart);
  };

  const addToCart = async (product: Product, quantity: number) => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        const updatedCart = await cartService.addItemToCart(token!, product._id, quantity);
        setCart(updatedCart);
      } else {
        const existingItemIndex = cart.findIndex(item => item.product._id === product._id);
        let newCart;
        if (existingItemIndex > -1) {
          newCart = cart.map((item, index) =>
            index === existingItemIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          newCart = [...cart, { product, quantity, _id: '' }]; // _id is placeholder for guest cart
        }
        saveGuestCart(newCart);
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (productId: string) => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        const updatedCart = await cartService.removeItemFromCart(token!, productId);
        setCart(updatedCart);
      } else {
        const newCart = cart.filter(item => item.product._id !== productId);
        saveGuestCart(newCart);
      }
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateCartItemQuantity = async (productId: string, quantity: number) => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        const updatedCart = await cartService.updateItemQuantity(token!, productId, quantity);
        setCart(updatedCart);
      } else {
        const newCart = cart.map(item =>
          item.product._id === productId ? { ...item, quantity } : item
        );
        saveGuestCart(newCart);
      }
    } catch (error) {
      console.error('Failed to update cart item quantity:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        await cartService.clearCart(token!);
        setCart([]);
      } else {
        saveGuestCart([]);
      }
    } catch (error) {
      console.error('Failed to clear cart:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateCartItemQuantity,
      clearCart,
      totalItems,
      totalPrice,
      loading
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
