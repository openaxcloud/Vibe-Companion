import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthState {
  value: unknown;
  setValue: (value: unknown) => void;
}

const Auth = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);
  
  return (
    <Auth.Provider value={{ value, setValue }}>
      {children}
    </Auth.Provider>
  );
}

export function useAuth() {
  const context = useContext(Auth);
  if (context === undefined) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
}

export default Auth;