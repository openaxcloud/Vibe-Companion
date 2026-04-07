import React, { FormEvent, useCallback, useState } from "react";
import { useNavigate, NavigateFunction } from "react-router-dom";

type LoginResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
};

type AuthContextShape = {
  isAuthenticated: boolean;
  user: LoginResponse["user"] | null;
  token: string | null;
  setAuthState: (data: { token: string; user: LoginResponse["user"] }) => void;
};

const AuthContext = React.createContext<AuthContextShape | undefined>(
  undefined
);

const useAuth = (): AuthContextShape => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() => {
    return window.localStorage.getItem("auth_token");
  });

  const [user, setUser] = useState<LoginResponse["user"] | null>(() => {
    const storedUser = window.localStorage.getItem("auth_user");
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser) as LoginResponse["user"];
    } catch {
      return null;
    }
  });

  const setAuthState = useCallback(
    (data: { token: string; user: LoginResponse["user"] }) => {
      setToken(data.token);
      setUser(data.user);
      window.localStorage.setItem("auth_token", data.token);
      window.localStorage.setItem("auth_user", JSON.stringify(data.user));
    },
    []
  );

  const value: AuthContextShape = {
    isAuthenticated: Boolean(token),
    token,
    user,
    setAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

type LoginFormState = {
  email: string;
  password: string;
};

type LoginFormErrors = {
  email?: string;
  password?: string;
  form?: string;
};

const validateEmail = (email: string): boolean => {
  if (!email) return false;
  // Basic email regex for client-side validation only
  const re =
    // eslint-disable-next-line no-control-regex
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validateForm = (values: LoginFormState): LoginFormErrors => {
  const errors: LoginFormErrors = {};
  if (!values.email) {
    errors.email = "Email is required.";
  } else if (!validateEmail(values.email)) {
    errors.email = "Please enter a valid email.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  return errors;
};

const loginRequest = async (
  values: LoginFormState
): Promise<LoginResponse> => {
  // Replace with your real API endpoint
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    const message =
      errorBody?.message || "Unable to login. Please check your credentials.";
    throw new Error(message);
  }

  const data = (await response.json()) as LoginResponse;
  return data;
};

const Login: React.FC = () => {
  const navigate: NavigateFunction = useNavigate();
  const { setAuthState } = useAuth();

  const [values, setValues] = useState<LoginFormState>({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const validationErrors = validateForm(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      try {
        const data = await loginRequest(values);
        setAuthState({ token: data.token, user: data.user });
        navigate("/", { replace: true });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while logging in.";
        setErrors({ form: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, setAuthState, values]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          boxShadow:
            "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            marginBottom: "0.25rem",
            color: "#111827",
          }}
        >
          Sign in
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "#6b7280",
            marginBottom: "1.5rem",
          }}
        >
          Enter your email and password to access your account.
        </p>

        {errors.form && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: "0.9rem",
              border: "1px solid #fecaca",
            }}
          >
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "0.25rem",
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: `1px solid undefined`,
                outline: "none",
                fontSize: "0.95rem",
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
            {errors.email && (
              <p
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.8rem",
                  color: "#b91c1c",
                }}
              >
                {errors.email}
              </p>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "0.25rem",
              }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={values.password}
              onChange={handleChange}
              autoComplete="current-password"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: `1px solid ${
                  errors.password ? "#f87171" : "#d1d5db"