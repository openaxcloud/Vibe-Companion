import React, { ReactElement, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import type { RouteObject } from "react-router-dom";

const LoginPage = React.lazy(() => import("../pages/auth/LoginPage"));
const RegisterPage = React.lazy(() => import("../pages/auth/RegisterPage"));
const ForgotPasswordPage = React.lazy(
  () => import("../pages/auth/ForgotPasswordPage")
);
const ResetPasswordPage = React.lazy(
  () => import("../pages/auth/ResetPasswordPage")
);
const DashboardPage = React.lazy(
  () => import("../pages/app/DashboardPage")
);
const ProfilePage = React.lazy(() => import("../pages/app/ProfilePage"));
const SettingsPage = React.lazy(() => import("../pages/app/SettingsPage"));
const NotFoundPage = React.lazy(
  () => import("../pages/common/NotFoundPage")
);
const UnauthorizedPage = React.lazy(
  () => import("../pages/common/UnauthorizedPage")
);

const AppLayout = React.lazy(() => import("../layouts/AppLayout"));
const AuthLayout = React.lazy(() => import("../layouts/AuthLayout"));
const PublicLayout = React.lazy(() => import("../layouts/PublicLayout"));

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole?: string;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

const useAuth = (): AuthContextValue => {
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
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [userRole, setUserRole] = React.useState<string | undefined>(undefined);

  useEffect(() => {
    const bootstrapAuth = async (): Promise<void> => {
      try {
        const token = window.localStorage.getItem("accessToken");
        if (token) {
          setIsAuthenticated(true);
          setUserRole("user");
        } else {
          setIsAuthenticated(false);
          setUserRole(undefined);
        }
      } catch {
        setIsAuthenticated(false);
        setUserRole(undefined);
      } finally {
        setIsLoading(false);
      }
    };
    void bootstrapAuth();
  }, []);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    userRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

interface ProtectedRouteProps {
  children?: ReactElement;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <span>Loading...</span>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (allowedRoles && auth.userRole && !allowedRoles.includes(auth.userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
};

interface PublicRouteProps {
  children?: ReactElement;
  restrictedWhenAuthenticated?: boolean;
}

const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  restrictedWhenAuthenticated = false,
}) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <span>Loading...</span>
      </div>
    );
  }

  if (restrictedWhenAuthenticated && auth.isAuthenticated) {
    const from =
      (location.state as { from?: string } | null)?.from ?? "/app/dashboard";
    return <Navigate to={from} replace />;
  }

  return children ?? <Outlet />;
};

const routeConfig: RouteObject[] = [
  {
    path: "/",
    element: (
      <PublicLayout>
        <PublicRoute />
      </PublicLayout>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/app/dashboard" replace />,
      },
    ],
  },
  {
    path: "/login",
    element: (
      <AuthLayout>
        <PublicRoute restrictedWhenAuthenticated>
          <LoginPage />
        </PublicRoute>
      </AuthLayout>
    ),
  },
  {
    path: "/register",
    element: (
      <AuthLayout>
        <PublicRoute restrictedWhenAuthenticated>
          <RegisterPage />
        </PublicRoute>
      </AuthLayout>
    ),
  },
  {
    path: "/forgot-password",
    element: (
      <AuthLayout>
        <PublicRoute restrictedWhenAuthenticated>
          <ForgotPasswordPage />
        </PublicRoute>
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password",
    element: (
      <AuthLayout>
        <PublicRoute restrictedWhenAuthenticated>
          <ResetPasswordPage />
        </PublicRoute>
      </AuthLayout>
    ),
  },
  {
    path: "/app",
    element: (
      <AppLayout>
        <ProtectedRoute />
      </AppLayout>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: "/unauthorized",
    element: (
      <PublicLayout>
        <UnauthorizedPage />
      </PublicLayout>
    ),
  },
  {
    path: "*",
    element: (
      <PublicLayout>
        <NotFoundPage />
      </PublicLayout>
    ),
  },
];

const renderRoutes = (routes: RouteObject[]): ReactElement => (
  <Routes>
    {routes.map((route, index) => {
      const Element = route.element as ReactElement | null;
      return (
        <Route key={route.path ?? index} path={route.path} element={Element}>
          {route.children && renderChildRoutes(route.children)}
        </Route>
      );
    })}
  </Routes>
);

const renderChildRoutes = (routes: RouteObject[]): ReactElement[] =>
  routes.map((route, index) => {
    const Element = route.element as ReactElement | null;
    return (
      <Route
        key={route.path ?? `child-undefined`}
        path={route.path}
        index={route.index}
        element={Element}
      >
        {route.children && renderChildRoutes(route.children)}
      </Route>
    );
  });

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div style={{ padding: 24, textAlign: "center" }}>
              <span>Loading...</span>
            </div>
          }
        >
          {renderRoutes(routeConfig)}
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Router;