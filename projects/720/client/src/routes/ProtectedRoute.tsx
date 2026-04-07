import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  token?: string | null;
}

export interface ProtectedRouteProps {
  isAuthenticated: boolean;
  user?: AuthUser | null;
  requireAdmin?: boolean;
  redirectTo?: string;
  adminRedirectTo?: string;
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  user,
  requireAdmin = false,
  redirectTo = "/login",
  adminRedirectTo = "/",
  children,
}) => {
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }

  if (requireAdmin && user.role !== "admin") {
    return <Navigate to={adminRedirectTo} replace />;
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
};

export default ProtectedRoute;