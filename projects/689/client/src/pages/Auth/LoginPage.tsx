import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login as loginApi } from "../../services/api/auth";
import { useAuthStore } from "../../store/authStore";

type LocationState = {
  from?: { pathname?: string };
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromLocation = (location.state as LocationState | null)?.from;
  const redirectPath = fromLocation?.pathname || "/";

  const { user, setUser, setToken } = useAuthStore();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = submitting || !email.trim() || !password.trim();

  useEffect(() => {
    if (user) {
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate, redirectPath]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isDisabled) return;

      setSubmitting(true);
      setError(null);

      try {
        const response = await loginApi({ email: email.trim(), password });
        if (!response || !response.user || !response.token) {
          throw new Error("Unexpected response from server.");
        }

        setUser(response.user);
        setToken(response.token);

        navigate(redirectPath, { replace: true });
      } catch (err: unknown) {
        let message = "Unable to sign in. Please try again.";
        if (err && typeof err === "object") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyErr = err as any;
          if (anyErr.response?.data?.message && typeof anyErr.response.data.message === "string") {
            message = anyErr.response.data.message;
          } else if (anyErr.message && typeof anyErr.message === "string") {
            message = anyErr.message;
          }
        }
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, isDisabled, navigate, redirectPath, setToken, setUser]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
            color: "#0f172a",
          }}
        >
          Sign in
        </h1>
        <p
          style={{
            marginBottom: "1.5rem",
            color: "#6b7280",
            fontSize: "0.9rem",
          }}
        >
          Enter your credentials to continue.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 0.9rem",
              borderRadius: "0.5rem",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: "0.85rem",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "0.35rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 1px #2563eb22";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d5db";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.35rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 1px #2563eb22";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d1d5db";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              width: "100%",
              padding: "0.6rem 0.75rem",
              borderRadius: "0.5rem",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: isDisabled ? "not-allowed" : "pointer",
              backgroundColor: isDisabled ? "#9ca3af" : "#2563eb",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              transition: "background-color 0.15s ease, transform 0.05s ease",
            }}
            onMouseDown={(e) => {
              if (!isDisabled) {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.99)";
              }
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            {submitting && (
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.6)",
                  borderTopColor: "transparent",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            )}
            <span>{submitting ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>
      </div>
      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default LoginPage;