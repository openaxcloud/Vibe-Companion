import React, { useState, FormEvent, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login as loginApi } from "../api";
import { setAuthToken, setAuthUser, getAuthToken } from "../auth";

interface LoginResponseUser {
  id: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

interface LoginResponse {
  token: string;
  user: LoginResponseUser;
}

interface LocationState {
  from?: {
    pathname?: string;
  };
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const redirectPath = state.from?.pathname || "/";

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const existingToken = getAuthToken();
    if (existingToken) {
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response: LoginResponse = await loginApi({ email: email.trim(), password });
      if (!response?.token || !response?.user) {
        throw new Error("Invalid response from server.");
      }

      setAuthToken(response.token);
      setAuthUser(response.user);

      navigate(redirectPath, { replace: true });
    } catch (error: unknown) {
      let message = "Unable to log in. Please try again.";
      if (error && typeof error === "object") {
        const anyError = error as { message?: string; response?: { data?: { message?: string; error?: string } } };
        if (anyError.response?.data?.message) {
          message = anyError.response.data.message;
        } else if (anyError.response?.data?.error) {
          message = anyError.response.data.error;
        } else if (anyError.message) {
          message = anyError.message;
        }
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setEmail(event.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setPassword(event.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Sign in to your account</h1>

        {errorMessage && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={handleEmailChange}
              disabled={isSubmitting}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={handlePasswordChange}
              disabled={isSubmitting}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;