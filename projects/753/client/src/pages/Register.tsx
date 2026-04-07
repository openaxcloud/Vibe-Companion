import React, { useState, useCallback, FormEvent, ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

const validateEmail = (email: string): boolean => {
  const re =
    // eslint-disable-next-line no-control-regex
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
  return re.test(String(email).toLowerCase());
};

const MIN_PASSWORD_LENGTH = 8;

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [values, setValues] = useState<RegisterFormValues>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
      setSubmitError(null);
    },
    [setValues, setErrors]
  );

  const validate = useCallback(
    (vals: RegisterFormValues): RegisterFormErrors => {
      const newErrors: RegisterFormErrors = {};

      if (!vals.name.trim()) {
        newErrors.name = "Name is required.";
      }

      if (!vals.email.trim()) {
        newErrors.email = "Email is required.";
      } else if (!validateEmail(vals.email)) {
        newErrors.email = "Please enter a valid email address.";
      }

      if (!vals.password) {
        newErrors.password = "Password is required.";
      } else if (vals.password.length < MIN_PASSWORD_LENGTH) {
        newErrors.password = `Password must be at least undefined characters.`;
      }

      if (!vals.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password.";
      } else if (vals.confirmPassword !== vals.password) {
        newErrors.confirmPassword = "Passwords do not match.";
      }

      return newErrors;
    },
    []
  );

  const mockRegisterRequest = async (payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ token: string; user: { id: string; name: string; email: string } }> => {
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (payload.email.toLowerCase() === "existing@example.com") {
      const error: any = new Error("Email is already in use.");
      error.status = 409;
      throw error;
    }

    return {
      token: "mock-jwt-token",
      user: {
        id: "user-" + Date.now().toString(),
        name: payload.name,
        email: payload.email,
      },
    };
  };

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);

      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await mockRegisterRequest({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        });

        localStorage.setItem("authToken", response.token);
        localStorage.setItem(
          "authUser",
          JSON.stringify({
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
          })
        );

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        if (err?.status === 409) {
          setSubmitError("An account with this email already exists.");
          setErrors((prev) => ({ ...prev, email: "Email is already in use." }));
        } else {
          setSubmitError("Registration failed. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate, navigate]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-semibold text-slate-800 mb-2 text-center">
          Create your account
        </h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Register to get started. You will be logged in automatically after signing up.
        </p>

        {submitError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
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
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={handleChange}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 undefined`}
              placeholder="Jane Doe"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
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
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 undefined`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="mb-4">
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
              autoComplete="new-password"
              value={values.password}
              onChange={handleChange}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 undefined`}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            )}
            {!errors.password && (
              <p className="mt-1 text-xs text-slate-400">
                Must be at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={handleChange}
              className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.confirmPassword
                  ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                  : "border-s