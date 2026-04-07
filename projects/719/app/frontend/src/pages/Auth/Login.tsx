import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token: string | null;
};

type AuthContextValue = {
  auth: AuthState;
  login: (params: { email: string; password: string }) => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const useAuth = (): AuthContextValue => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

// Mock API login function, replace with real implementation
async function loginRequest(params: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; token: string }> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!params.email || !params.password) {
    throw new Error("Email and password are required.");
  }
  if (params.email === "error@example.com") {
    throw new Error("Invalid email or password.");
  }
  return {
    user: {
      id: "1",
      email: params.email,
      name: "John Doe",
    },
    token: "mock-jwt-token",
  };
}

// Minimal AuthProvider for completeness; in production, this would live elsewhere
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    token: null,
  });

  const login = useCallback(async (params: { email: string; password: string }) => {
    const { user, token } = await loginRequest(params);
    setAuth({
      user,
      isAuthenticated: true,
      token,
    });
  }, []);

  const value: AuthContextValue = {
    auth,
    login,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
  };
};

const validateEmail = (email: string): boolean => {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

const Login: React.FC = () => {
  const { login, auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const redirectTo =
    state.from?.pathname && state.from.pathname !== "/login"
      ? `undefinedundefined`
      : "/";

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [auth.isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const newFieldErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newFieldErrors.email = "Email is required.";
    } else if (!validateEmail(email.trim())) {
      newFieldErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newFieldErrors.password = "Password is required.";
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    setSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to sign in. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page auth-page--login">
      <div className="auth-card">
        <h1 className="auth-title">Sign in</h1>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="email" className="auth-label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`auth-input undefined`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && (
              <div id="email-error" className="auth-field-error">
                {fieldErrors.email}
              </div>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={`auth-input undefined`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
            />
            {fieldErrors.password && (
              <div id="password-error" className="auth-field-error">
                {fieldErrors.password}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;