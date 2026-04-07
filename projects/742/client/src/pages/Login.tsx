import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type LoginResponse = {
  token: string;
};

type ApiError = {
  message?: string;
  errors?: Record<string, string[]>;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromPath =
    (location.state as { from?: string } | undefined)?.from || "/";

  useEffect(() => {
    const existingToken = localStorage.getItem("token");
    if (existingToken) {
      navigate(fromPath, { replace: true });
    }
  }, [navigate, fromPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        let errorText = "Login failed. Please check your credentials and try again.";
        try {
          const errorData: ApiError = await response.json();
          if (errorData.message) {
            errorText = errorData.message;
          }
        } catch {
          // ignore JSON parse errors and fall back to default message
        }
        throw new Error(errorText);
      }

      const data: LoginResponse = await response.json();
      if (!data.token) {
        throw new Error("Unexpected response from server.");
      }

      localStorage.setItem("token", data.token);

      navigate(fromPath, { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        padding: "1rem"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: "1.5rem",
            fontSize: "1.75rem",
            textAlign: "center"
          }}
        >
          Login
        </h1>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "4px",
              backgroundColor: "#ffe5e5",
              color: "#b00020",
              fontSize: "0.9rem"
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
                fontWeight: 500
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                boxSizing: "border-box"
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
                fontWeight: 500
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                boxSizing: "border-box"
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              fontWeight: 600,
              borderRadius: "4px",
              border: "none",
              backgroundColor: isSubmitting ? "#9e9e9e" : "#1976d2",
              color: "#ffffff",
              cursor: isSubmitting ? "default" : "pointer",
              transition: "background-color 0.2s ease-in-out"
            }}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;