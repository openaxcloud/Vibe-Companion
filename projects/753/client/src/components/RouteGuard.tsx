import React, { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export interface RouteGuardProps {
  children: ReactElement;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requireAuth = true,
  requireAdmin = false,
}) => {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (!requireAuth && !requireAdmin) {
    return children;
  }

  if (isLoading) {
    return null;
  }

  const redirectToLogin = (
    <Navigate
      to={{
        pathname: "/login",
        search: `?returnTo=undefined`,
      }}
      replace
    />
  );

  if (!isAuthenticated) {
    return redirectToLogin;
  }

  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RouteGuard;