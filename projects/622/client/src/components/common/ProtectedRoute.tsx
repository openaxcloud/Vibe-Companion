import React, { ReactElement, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type ProtectedRouteProps = {
  children: ReactElement;
  roles?: string[];
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, isAuthenticated, loading, hasRole } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Could be used for analytics or side-effects on protected route access
  }, [location.pathname]);

  if (loading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    const searchParams = new URLSearchParams();
    searchParams.set("redirect", location.pathname + location.search + location.hash);
    return <Navigate to={`/login?undefined`} replace />;
  }

  if (roles && roles.length > 0) {
    const authorized = roles.some((role) => hasRole(role));
    if (!authorized) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;