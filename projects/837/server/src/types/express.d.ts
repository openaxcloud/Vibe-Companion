import { createContext, useContext, useState, ReactNode } from 'react';

interface Express.dState {
  value: unknown;
  setValue: (value: unknown) => void;
}

const Express.d = createContext<Express.dState | undefined>(undefined);

export function Express.dProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);
  
  return (
    <Express.d.Provider value={{ value, setValue }}>
      {children}
    </Express.d.Provider>
  );
}

export function useExpress.d() {
  const context = useContext(Express.d);
  if (context === undefined) {
    throw new Error('useExpress.d must be used within a Express.dProvider');
  }
  return context;
}

export default Express.d;