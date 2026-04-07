import React, { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type UserRole = 'admin' | 'user' | 'manager' | 'guest' | string;

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
    [key: string]: unknown;
  } | null;
}

interface AdminGuardProps {
  children: ReactNode;
  /**
   * Optional path to redirect unauthorized users.
   * Defaults to "/not-authorized"
   */
  redirectTo?: string;
}

// This hook is a placeholder and should be wired to the real auth context in the app.
// Replace this implementation with your actual auth state management.
const useAuth = (): AuthContextValue => {
  // Example stub; in real app, consume from context:
  // const ctx = React.useContext(AuthContext);
  // if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  // return ctx;

  return {
    isAuthenticated: false,
    isLoading: false,
    user: null,
  };
};

const isAdmin = (role: UserRole | undefined | null): boolean => {
  if (!role) return false;
  return role.toLowerCase() === 'admin';
};

const AdminGuard: React.FC<AdminGuardProps> = ({ children, redirectTo = '/not-authorized' }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Placeholder for side-effects like logging, analytics, etc.
    // Example:
    // if (!isLoading && isAuthenticated && !isAdmin(user?.role)) {
    //   trackUnauthorizedAccessAttempt({ path: location.pathname });
    // }
  }, [isAuthenticated, isLoading, user, location.pathname]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !isAdmin(user?.role)) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
};

export default AdminGuard;