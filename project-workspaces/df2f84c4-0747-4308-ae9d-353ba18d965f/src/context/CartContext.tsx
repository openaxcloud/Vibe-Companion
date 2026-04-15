import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { CartItem, Product } from '../types';
import { toast } from 'react-hot-toast'; // Assuming you'll add react-hot-toast

// Define action types
type CartAction =
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' };

// Initial state
interface CartState {
  items: CartItem[];
}

const initialState: CartState = {
  items: JSON.parse(localStorage.getItem('cartItems') || '[]'),
};

// Reducer function
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM':
      const existingItem = state.items.find((item) => item.id === action.payload.id);
      if (existingItem) {
        // Check if adding more would exceed stock
        if (existingItem.quantity + 1 > action.payload.stock_quantity) {
          toast.error(`Only ${action.payload.stock_quantity} of "${action.payload.name}" available in stock.`);
          return state;
        }
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.payload.id ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      } else {
        return {
          ...state,
          items: [...state.items, { ...action.payload, quantity: 1 }],
        };
      }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      };
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== action.payload.id),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? {
                ...item,
                quantity: Math.min(action.payload.quantity, item.stock_quantity), // Don't exceed stock
              }
            : item
        ),
      };
    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
      };
    default:
      return state;
  }
};

// Create CartContext
export const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalAmount: () => number;
}>({
  state: initialState,
  dispatch: () => null,
  addToCart: () => {},
  removeFromCart: () => {},
  updateCartQuantity: () => {},
  clearCart: () => {},
  getTotalItems: () => 0,
  getTotalAmount: () => 0,
});

// CartProvider component
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Persist cart items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(state.items));
  }, [state.items]);

  const addToCart = (product: Product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
    toast.success(`${product.name} added to cart!`);
  };

  const removeFromCart = (productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
    toast.success('Item removed from cart!');
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    const item = state.items.find(i => i.id === productId);
    if (item && quantity > item.stock_quantity) {
      toast.error(`Cannot add more than ${item.stock_quantity} of "${item.name}" (stock limit).`);
      return;
    }
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalAmount = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{ state, dispatch, addToCart, removeFromCart, updateCartQuantity, clearCart, getTotalItems, getTotalAmount }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  return useContext(CartContext);
};