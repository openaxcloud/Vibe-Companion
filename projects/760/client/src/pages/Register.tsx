import React, { useState, FormEvent, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";

type RegisterResponse =
  | {
      success: true;
      user: {
        id: string;
        name: string;
        email: string;
      };
      token?: string;
    }
  | {
      success: false;
      message: string;
      errors?: Record<string, string>;
    };

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setFieldErrors({});
  }, [name, email, password]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      const data: RegisterResponse = await response.json();

      if (!response.ok || !("success" in data) || !data.success) {
        const message =
          !response.ok && "message" in data
            ? data.message
            : "Unable to register. Please check your details and try again.";

        setError(message);

        if ("errors" in data && data.errors) {
          setFieldErrors(data.errors);
        }

        return;
      }

      if ("token" in data && data.token) {
        try {
          window.localStorage.setItem("authToken", data.token);
        } catch {
          // Ignore storage errors, still navigate
        }
        navigate(from, { replace: true });
        return;
      }

      setSuccessMessage("Registration successful. Redirecting to login...");
      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { email: email.trim() },
        });
      }, 1000);
    } catch {
      setError("Network error: unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = (): boolean => {
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      !isSubmitting
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1 text-center">
          Create an account
        </h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Sign up to get started. Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Log in
          </Link>
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 undefined`}
              placeholder="Jane Doe"
              required
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 undefined`}
              placeholder="you@example.com"
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 undefined`}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
            {!fieldErrors.password && (
              <p className="mt-1 text-xs text-slate-500">
                Must be at least 6 characters.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid()}
            className={`w-full inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 undefined`}
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Register;