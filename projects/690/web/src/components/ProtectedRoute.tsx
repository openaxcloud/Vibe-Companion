import React, { ReactElement, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Role = "admin" | "user" | "guest" | string;

interface ProtectedRouteProps {
  children: ReactElement;
  requiredRoles?: Role[];
  redirectTo?: string;
}

const hasRequiredRole = (userRole: Role | null | undefined, requiredRoles?: Role[]): boolean => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  redirectTo = "/login",
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Potential side-effects like analytics for auth-guarded route checks can go here
  }, [isAuthenticated, user, location.pathname]);

  if (isLoading) {
    return (
      <div style={{ width: "100%", textAlign: "center", marginTop: "2rem" }}>
        <span>Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!hasRequiredRole(user?.role ?? null, requiredRoles)) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname, unauthorized: true }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;