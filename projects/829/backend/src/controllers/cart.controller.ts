import { createContext, useContext, useState, ReactNode } from 'react';

interface Cart.controllerState {
  value: unknown;
  setValue: (value: unknown) => void;
}

const Cart.controller = createContext<Cart.controllerState | undefined>(undefined);

export function Cart.controllerProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);
  
  return (
    <Cart.controller.Provider value={{ value, setValue }}>
      {children}
    </Cart.controller.Provider>
  );
}

export function useCart.controller() {
  const context = useContext(Cart.controller);
  if (context === undefined) {
    throw new Error('useCart.controller must be used within a Cart.controllerProvider');
  }
  return context;
}

export default Cart.controller;