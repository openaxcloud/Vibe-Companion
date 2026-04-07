import React, { ReactElement } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface ProtectedRouteProps {
  isAuthenticated: boolean;
  user?: AuthUser | null;
  requiredRole?: UserRole;
  redirectTo?: string;
  children?: ReactElement | null;
}

/**
 * Guard routes based on authentication status and optional role.
 *
 * Usage examples:
 * <Route
 *   path="/dashboard"
 *   element={
 *     <ProtectedRoute isAuthenticated={isAuthenticated}>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   }
 * />
 *
 * <Route
 *   path="/admin"
 *   element={
 *     <ProtectedRoute
 *       isAuthenticated={isAuthenticated}
 *       user={user}
 *       requiredRole="admin"
 *     >
 *       <AdminPanel />
 *     </ProtectedRoute>
 *   }
 * />
 *
 * Or as a wrapper for nested routes:
 * <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
 *   <Route path="/app" element={<AppLayout />}>
 *     <Route path="home" element={<Home />} />
 *   </Route>
 * </Route>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  user,
  requiredRole,
  redirectTo = "/login",
  children,
}) => {
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (requiredRole && user && user.role !== requiredRole) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname + location.search, unauthorized: true }}
      />
    );
  }

  if (children) {
    return children;
  }

  return <Outlet />;
};

export default ProtectedRoute;