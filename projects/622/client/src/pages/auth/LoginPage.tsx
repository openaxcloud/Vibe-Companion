import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type AuthUser = {
  id: string;
  email: string;
  name?: string;
  token: string;
};

type AuthContextType = {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const useAuth = (): AuthContextType => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

const LOGIN_API_ENDPOINT = "/api/auth/login";

type LoginResponse = {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  token: string;
};

type LocationState = {
  from?: {
    pathname?: string;
  };
};

const emailRegex =
  /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

const validateEmail = (value: string): string | null => {
  if (!value.trim()) return "Email is required";
  if (!emailRegex.test(value)) return "Please enter a valid email address";
  return null;
};

const validatePassword = (value: string): string | null => {
  if (!value.trim()) return "Password is required";
  if (value.length < 6) return "Password must be at least 6 characters";
  return null;
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fromLocation = (location.state as LocationState | undefined)?.from;
  const redirectPath =
    (fromLocation && fromLocation.pathname && fromLocation.pathname !== "/login"
      ? fromLocation.pathname
      : "/") || "/";

  useEffect(() => {
    if (user) {
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate, redirectPath]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);

      const emailValidationError = validateEmail(email);
      const passwordValidationError = validatePassword(password);

      setEmailError(emailValidationError);
      setPasswordError(passwordValidationError);

      if (emailValidationError || passwordValidationError) {
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch(LOGIN_API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email: email.trim(), password }),
        });

        if (!response.ok) {
          let message = "Unable to sign in. Please try again.";
          try {
            const errorData = (await response.json()) as { error?: string; message?: string };
            if (errorData.error) message = errorData.error;
            else if (errorData.message) message = errorData.message;
          } catch {
            // ignore JSON parse errors, use default message
          }
          throw new Error(message);
        }

        const data = (await response.json()) as LoginResponse;

        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          token: data.token,
        };

        login(authUser);
        navigate(redirectPath, { replace: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
        setFormError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, login, navigate, redirectPath]
  );

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePassword(password));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
          Sign in to your account
        </h1>

        {formError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              onBlur={handleEmailBlur}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 undefined`}
              disabled={isSubmitting}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {emailError && (
              <p
                id="email-error"
                className="mt-1 text-xs text-red-600"
              >
                {emailError}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) {
                  setPasswordError(null);
                }
              }}
              onBlur={handlePasswordBlur}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 undefined`}
              disabled={isSubmitting}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
            />
            {passwordError && (
              <p
                id="password-error"
                className="mt-1 text-xs text-red-600"
              >
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;