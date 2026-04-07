import React, { Suspense, lazy, ReactElement } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import FullPageSpinner from "../components/common/FullPageSpinner";
import Layout from "../components/layout/Layout";
import NotFoundPage from "../pages/NotFoundPage";

// Lazy-loaded pages
const HomePage = lazy(() => import("../pages/HomePage"));
const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("../pages/auth/RegisterPage"));
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"));
const UserProfilePage = lazy(() => import("../pages/user/UserProfilePage"));
const AdminDashboardPage = lazy(
  () => import("../pages/admin/AdminDashboardPage")
);
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage"));
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage"));
const ReportsPage = lazy(() => import("../pages/reports/ReportsPage"));

type ProtectedRouteProps = {
  children?: ReactElement;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (children) {
    return children;
  }

  return <Outlet />;
};

type AdminRouteProps = {
  children?: ReactElement;
};

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (children) {
    return children;
  }

  return <Outlet />;
};

const RootRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          {/* Public auth routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />

          {/* Main layout with nested routes */}
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route index element={<HomePage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="profile" element={<UserProfilePage />} />
              <Route path="settings" element={<SettingsPage />}>
                <Route path="reports" element={<ReportsPage />} />
              </Route>
            </Route>

            {/* Admin-only routes */}
            <Route path="admin" element={<AdminRoute />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
            </Route>

            {/* Catch-all 404 within layout */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

type PublicOnlyRouteProps = {
  children: ReactElement;
};

const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from || "/"} replace />;
  }

  return children;
};

export default RootRouter;