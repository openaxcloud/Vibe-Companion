import React, { ReactElement, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  RouteObject,
  RouterProvider,
  useLocation,
  createBrowserRouter,
} from "react-router-dom";
import { AuthProvider, useAuth } from "../state/AuthContext";
import MainLayout from "../layout/MainLayout";
import AuthLayout from "../layout/AuthLayout";
import AdminLayout from "../layout/AdminLayout";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import VerifyEmailPage from "../pages/auth/VerifyEmailPage";
import ProfilePage from "../pages/account/ProfilePage";
import AccountSettingsPage from "../pages/account/AccountSettingsPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import AdminSettingsPage from "../pages/admin/AdminSettingsPage";
import NotFoundPage from "../pages/errors/NotFoundPage";
import UnauthorizedPage from "../pages/errors/UnauthorizedPage";
import LoadingScreen from "../components/common/LoadingScreen";

type ProtectedRouteProps = {
  children?: ReactElement;
  requireAdmin?: boolean;
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
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

  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
};

const AppRouterInner: React.FC = () => {
  const routes: RouteObject[] = [
    {
      path: "/",
      element: (
        <>
          <ScrollToTop />
          <MainLayout />
        </>
      ),
      children: [
        { index: true, element: <HomePage /> },
        {
          path: "account",
          element: (
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          ),
          children: [
            { index: true, element: <ProfilePage /> },
            { path: "settings", element: <AccountSettingsPage /> },
          ],
        },
      ],
    },
    {
      element: (
        <>
          <ScrollToTop />
          <AuthLayout />
        </>
      ),
      children: [
        { path: "login", element: <LoginPage /> },
        { path: "register", element: <RegisterPage /> },
        { path: "forgot-password", element: <ForgotPasswordPage /> },
        { path: "reset-password", element: <ResetPasswordPage /> },
        { path: "verify-email", element: <VerifyEmailPage /> },
      ],
    },
    {
      path: "/admin",
      element: (
        <>
          <ScrollToTop />
          <ProtectedRoute requireAdmin>
            <AdminLayout />
          </ProtectedRoute>
        </>
      ),
      children: [
        { index: true, element: <AdminDashboardPage /> },
        { path: "users", element: <AdminUsersPage /> },
        { path: "settings", element: <AdminSettingsPage /> },
      ],
    },
    {
      path: "/unauthorized",
      element: (
        <>
          <ScrollToTop />
          <UnauthorizedPage />
        </>
      ),
    },
    {
      path: "*",
      element: (
        <>
          <ScrollToTop />
          <NotFoundPage />
        </>
      ),
    },
  ];

  const router = createBrowserRouter(routes);

  return <RouterProvider router={router} />;
};

const AppRoutes: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouterInner />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default AppRoutes;