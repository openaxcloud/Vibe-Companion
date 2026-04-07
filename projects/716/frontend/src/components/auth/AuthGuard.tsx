import React, { FC, ReactNode, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

type AuthGuardProps = {
  children: ReactNode;
  /**
   * If true, unauthenticated users will be redirected to login
   * and the originally requested location will be remembered so
   * they can be navigated back after successful login.
   */
  rememberDestination?: boolean;
  /**
   * Explicit authentication flag. If not provided, you should
   * integrate this with your actual auth state (e.g. from context,
   * Redux, or a custom hook).
   */
  isAuthenticated?: boolean;
  /**
   * Optional path to redirect to when unauthenticated.
   * Defaults to "/login".
   */
  loginPath?: string;
};

/**
 * Hook stub to retrieve authentication state.
 * Replace this with your real auth hook or context.
 */
const useAuth = (): { isAuthenticated: boolean; loading: boolean } => {
  // Example placeholder implementation:
  // Integrate with your real auth state management here.
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const isAuthenticated = Boolean(token);
  const loading = false;
  return { isAuthenticated, loading };
};

/**
 * Persist the original destination so that after login
 * the user can be redirected back.
 */
const rememberOriginalDestination = (pathname: string, search: string): void => {
  if (typeof window === "undefined") return;
  const destination = pathname + (search || "");
  try {
    sessionStorage.setItem("post_login_redirect", destination);
  } catch {
    // Swallow storage errors to avoid blocking navigation
  }
};

export const consumeOriginalDestination = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem("post_login_redirect");
    if (value) {
      sessionStorage.removeItem("post_login_redirect");
      return value;
    }
  } catch {
    return null;
  }
  return null;
};

const AuthGuard: FC<AuthGuardProps> = ({
  children,
  rememberDestination = true,
  isAuthenticated: isAuthenticatedProp,
  loginPath = "/login",
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated: isAuthenticatedFromHook, loading } = useAuth();

  const isAuthenticated = typeof isAuthenticatedProp === "boolean" ? isAuthenticatedProp : isAuthenticatedFromHook;

  useEffect(() => {
    if (!loading && !isAuthenticated && rememberDestination) {
      rememberOriginalDestination(location.pathname, location.search);
    }
  }, [isAuthenticated, loading, rememberDestination, location.pathname, location.search]);

  useEffect(() => {
    if (!loading && !isAuthenticated && !rememberDestination) {
      // Ensure we don't keep stale redirect destinations when not desired
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("post_login_redirect");
        } catch {
          // Ignore
        }
      }
    }
  }, [isAuthenticated, loading, rememberDestination]);

  if (loading) {
    // Replace with your real loading UI if desired
    return null;
  }

  if (!isAuthenticated) {
    // Prefer Navigate for declarative redirection, but use navigate() if needed
    // to support side-effect-based flows.
    const searchParams = new URLSearchParams();
    if (!rememberDestination) {
      // If not remembering destination, we can optionally still
      // encode a "from" param if desired; left empty by default.
    }
    const loginTarget = searchParams.toString()
      ? `undefined?undefined`
      : loginPath;

    // Use Navigate to prevent rendering protected content
    return <Navigate to={loginTarget} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;