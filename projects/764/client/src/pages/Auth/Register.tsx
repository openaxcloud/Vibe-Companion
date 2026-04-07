import React, { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>> & {
  general?: string;
};

const emailRegex =
  // eslint-disable-next-line no-control-regex
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const validate = (fieldValues: RegisterFormValues = values): RegisterFormErrors => {
    const tempErrors: RegisterFormErrors = {};

    if (!fieldValues.name.trim()) {
      tempErrors.name = "Name is required.";
    } else if (fieldValues.name.trim().length < 2) {
      tempErrors.name = "Name must be at least 2 characters.";
    }

    if (!fieldValues.email.trim()) {
      tempErrors.email = "Email is required.";
    } else if (!emailRegex.test(fieldValues.email.trim())) {
      tempErrors.email = "Please enter a valid email address.";
    }

    if (!fieldValues.password) {
      tempErrors.password = "Password is required.";
    } else if (fieldValues.password.length < MIN_PASSWORD_LENGTH) {
      tempErrors.password = `Password must be at least undefined characters.`;
    }

    if (!fieldValues.confirmPassword) {
      tempErrors.confirmPassword = "Please confirm your password.";
    } else if (fieldValues.password !== fieldValues.confirmPassword) {
      tempErrors.confirmPassword = "Passwords do not match.";
    }

    return tempErrors;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => {
      const updatedValues = { ...values, [name]: value } as RegisterFormValues;
      const newErrors = validate(updatedValues);
      return { ...prev, ...newErrors };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErrors({});
    const validationErrors = validate(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) || {};
        const message =
          (errorData && (errorData.message || errorData.error)) ||
          "Unable to register. Please try again.";
        setErrors({ general: message });
        return;
      }

      const data = await response.json();

      if (data?.token) {
        localStorage.setItem("authToken", data.token);
      }
      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      navigate("/dashboard");
    } catch (error) {
      setErrors({
        general: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = (fieldName: keyof RegisterFormValues): string => {
    const base =
      "mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 text-sm";
    const error = errors[fieldName]
      ? "border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:ring-blue-500";
    return `undefined undefined`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
          Create your account
        </h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Sign in
          </Link>
        </p>

        {errors.general && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={handleChange}
              disabled={isSubmitting}
              className={getInputClassName("name")}
              placeholder="Jane Doe"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              disabled={isSubmitting}
              className={getInputClassName("email")}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
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
              disabled={isSubmitting}
              className={getInputClassName("password")}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            )}
            {!errors.password && (
              <p className="mt-1 text-xs text-gray-500">
                Must be at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
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
              disabled={isSubmitting}
              className={getInputClassName("confirmPassword")}
              placeholder="Re-enter your password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white undefined focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {isSubmitting ? "Creating account..." : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;