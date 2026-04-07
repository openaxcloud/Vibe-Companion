import React, { useState, useEffect, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type LoginResponse = {
  success: boolean;
  message?: string;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    document.title = "Login";
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data: LoginResponse = await response.json().catch(() => ({
        success: false,
        message: "Invalid server response.",
      }));

      if (!response.ok || !data.success) {
        setError(data.message || "Invalid email or password.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      navigate(from, { replace: true });
    } catch (err) {
      setError("Unable to login. Please try again.");
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
        background: "#f5f5f5",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#ffffff",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          padding: "2rem",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
            textAlign: "center",
          }}
        >
          Login
        </h1>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "4px",
              backgroundColor: "#fdecea",
              color: "#611a15",
              fontSize: "0.9rem",
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
                fontSize: "0.9rem",
                fontWeight: 500,
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
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.35rem",
                fontSize: "0.9rem",
                fontWeight: 500,
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
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "0.6rem 0.75rem",
              borderRadius: "4px",
              border: "none",
              backgroundColor: isSubmitting ? "#9c9c9c" : "#1976d2",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: isSubmitting ? "default" : "pointer",
              transition: "background-color 0.2s ease",
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