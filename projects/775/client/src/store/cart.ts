import { createContext, useContext, useState, ReactNode } from 'react';

interface CartState {
  value: unknown;
  setValue: (value: unknown) => void;
}

const Cart = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);
  
  return (
    <Cart.Provider value={{ value, setValue }}>
      {children}
    </Cart.Provider>
  );
}

export function useCart() {
  const context = useContext(Cart);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default Cart;