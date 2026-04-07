import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation, Location } from "react-router-dom";
import { authApi } from "../api/authApi";
import { useAuth } from "../contexts/AuthContext";

type LocationState = {
  from?: Location;
  message?: string;
};

type LoginFormState = {
  email: string;
  password: string;
};

type LoginFormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

const validateEmail = (email: string): string | undefined => {
  if (!email.trim()) return "Email is required";
  const emailRegex =
    // eslint-disable-next-line no-control-regex
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Enter a valid email address";
  return undefined;
};

const validatePassword = (password: string): string | undefined => {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  return undefined;
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const locationState = (location.state || {}) as LocationState;
  const redirectPath = locationState.from?.pathname || "/workspace";

  const [form, setForm] = useState<LoginFormState>({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
    },
    []
  );

  const validateForm = useCallback(
    (data: LoginFormState): LoginFormErrors => {
      const newErrors: LoginFormErrors = {};
      const emailError = validateEmail(data.email);
      const passwordError = validatePassword(data.password);

      if (emailError) newErrors.email = emailError;
      if (passwordError) newErrors.password = passwordError;

      return newErrors;
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting) return;

      const validationErrors = validateForm(form);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setSubmitting(true);
      setErrors({});

      try {
        const response = await authApi.login({
          email: form.email.trim(),
          password: form.password,
        });

        await login(response.user, response.token);

        navigate(redirectPath, { replace: true });
      } catch (error: unknown) {
        let message = "Unable to sign in. Please check your credentials.";
        if (error && typeof error === "object") {
          const anyError = error as { message?: string; status?: number };
          if (anyError.status === 401) {
            message = "Invalid email or password.";
          } else if (anyError.message) {
            message = anyError.message;
          }
        }
        setErrors((prev) => ({
          ...prev,
          general: message,
        }));
      } finally {
        setSubmitting(false);
      }
    },
    [form, login, navigate, redirectPath, submitting, validateForm]
  );

  const handleNavigateToSignup = useCallback(() => {
    navigate("/signup");
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Sign in to your account
        </h1>
        {locationState.message && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 mb-4">
            {locationState.message}
          </p>
        )}
        {errors.general && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
            {errors.general}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 undefined`}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              disabled={submitting}
            />
            {errors.email && (
              <p
                id="email-error"
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 undefined`}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              disabled={submitting}
            />
            {errors.password && (
              <p
                id="password-error"
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600 text-center">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={handleNavigateToSignup}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;