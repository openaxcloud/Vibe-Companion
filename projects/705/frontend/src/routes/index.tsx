import React, { ReactElement } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

// Layouts
import MainLayout from "../layouts/MainLayout";
import AdminLayout from "../layouts/AdminLayout";

// Pages
import CatalogPage from "../pages/CatalogPage";
import ProductDetailPage from "../pages/ProductDetailPage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import ProfilePage from "../pages/ProfilePage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import NotFoundPage from "../pages/NotFoundPage";

// Auth utilities (replace with actual implementations)
type UserRole = "user" | "admin";

interface AuthContextShape {
  isAuthenticated: boolean;
  userRole: UserRole | null;
}

const useAuth = (): AuthContextShape => {
  // This should be replaced by real auth context / hook
  // Placeholder values for demonstration
  return {
    isAuthenticated: false,
    userRole: null,
  };
};

interface ProtectedRouteProps {
  children?: ReactElement;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = "/login",
}) => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children ?? <Outlet />;
};

interface AdminRouteProps {
  children?: ReactElement;
  redirectTo?: string;
}

const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  redirectTo = "/login",
}) => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated || auth.userRole !== "admin") {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children ?? <Outlet />;
};

const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes with main layout */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:productId" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected user routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Admin routes with admin layout and admin guard */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
        </Route>

        {/* Fallback / 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;