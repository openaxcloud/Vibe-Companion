import { createContext, useContext, useState, ReactNode } from 'react';

interface TokenCounterState {
  value: unknown;
  setValue: (value: unknown) => void;
}

const TokenCounter = createContext<TokenCounterState | undefined>(undefined);

export function TokenCounterProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);
  
  return (
    <TokenCounter.Provider value={{ value, setValue }}>
      {children}
    </TokenCounter.Provider>
  );
}

export function useTokenCounter() {
  const context = useContext(TokenCounter);
  if (context === undefined) {
    throw new Error('useTokenCounter must be used within a TokenCounterProvider');
  }
  return context;
}

export default TokenCounter;