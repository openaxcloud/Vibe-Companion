import React, { Suspense, lazy, ReactElement } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

const UserLayout = lazy(() => import("./layouts/UserLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const PublicLayout = lazy(() => import("./layouts/PublicLayout"));

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));

const UserDashboardPage = lazy(() => import("./pages/user/UserDashboardPage"));
const UserProfilePage = lazy(() => import("./pages/user/UserProfilePage"));

const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));

const GlobalErrorBoundary = lazy(() => import("./components/GlobalErrorBoundary"));
const FullPageSpinner = lazy(() => import("./components/FullPageSpinner"));

export type UserRole = "guest" | "user" | "admin";

export interface AuthContextValue {
  isAuthenticated: boolean;
  role: UserRole;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = React.useState<AuthContextValue>({
    isAuthenticated: false,
    role: "guest",
  });

  React.useEffect(() => {
    const stored = window.localStorage.getItem("app_auth_state");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthContextValue;
        setAuthState(parsed);
      } catch {
        // ignore invalid stored auth
      }
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("app_auth_state", JSON.stringify(authState));
  }, [authState]);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

interface ProtectedRouteProps {
  children?: ReactElement;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = ["user", "admin"],
}) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children ?? <Outlet />;
};

const AdminRoute: React.FC<{ children?: ReactElement }> = ({ children }) => {
  return <ProtectedRoute allowedRoles={["admin"]}>{children}</ProtectedRoute>;
};

const UserRoute: React.FC<{ children?: ReactElement }> = ({ children }) => {
  return <ProtectedRoute allowedRoles={["user", "admin"]}>{children}</ProtectedRoute>;
};

const RouterSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>
    </Suspense>
  );
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouterSuspense>
          <GlobalErrorBoundary>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forbidden" element={<ForbiddenPage />} />
              </Route>

              <Route element={<UserLayout />}>
                <Route
                  path="/app"
                  element={
                    <UserRoute>
                      <UserDashboardPage />
                    </UserRoute>
                  }
                />
                <Route
                  path="/app/profile"
                  element={
                    <UserRoute>
                      <UserProfilePage />
                    </UserRoute>
                  }
                />
              </Route>

              <Route element={<AdminLayout />}>
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboardPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AdminUsersPage />
                    </AdminRoute>
                  }
                />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </GlobalErrorBoundary>
        </RouterSuspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRouter;