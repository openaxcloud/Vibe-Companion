import { useContext, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";

export type UserRole = "admin" | "user" | "manager" | "guest";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  avatarUrl?: string | null;
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void> | void;
  refreshSession?: () => Promise<void>;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  role: UserRole | "guest";
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void> | void;
  refreshSession?: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext) as AuthContextValue | null;

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  const { user, isAuthenticated, isLoading, token, signIn, signOut, refreshSession } = context;

  const role: UserRole | "guest" = user?.role ?? "guest";

  const hasRole = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user || !isAuthenticated) return false;

    const rolesToCheck = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    return rolesToCheck.includes(user.role);
  };

  const derived = useMemo(
    () => ({
      role,
      isAdmin: hasRole("admin"),
      isManager: hasRole("manager"),
      isUser: hasRole("user"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, isAuthenticated, user?.id]
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    token,
    role: derived.role,
    hasRole,
    isAdmin: derived.isAdmin,
    isManager: derived.isManager,
    isUser: derived.isUser,
    signIn,
    signOut,
    refreshSession,
  };
};

export default useAuth;