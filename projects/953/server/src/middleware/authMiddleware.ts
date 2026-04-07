import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthMiddlewareState {
  value: unknown;
  setValue: (value: unknown) => void;
}

const AuthMiddleware = createContext<AuthMiddlewareState | undefined>(undefined);

export function AuthMiddlewareProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<unknown>(null);
  
  return (
    <AuthMiddleware.Provider value={{ value, setValue }}>
      {children}
    </AuthMiddleware.Provider>
  );
}

export function useAuthMiddleware() {
  const context = useContext(AuthMiddleware);
  if (context === undefined) {
    throw new Error('useAuthMiddleware must be used within a AuthMiddlewareProvider');
  }
  return context;
}

export default AuthMiddleware;