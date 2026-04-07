import React, { useState, useEffect, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type LoginResponse = {
  token: string;
};

type UserProfile = {
  id: string;
  email: string;
  name?: string;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || "/";

  useEffect(() => {
    const existingToken = localStorage.getItem("token");
    if (existingToken) {
      navigate(from, { replace: true });
    }
  }, [navigate, from]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const loginRes = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (!loginRes.ok) {
        let message = "Login failed. Please check your credentials.";
        try {
          const errorData = await loginRes.json();
          if (errorData && typeof errorData.message === "string") {
            message = errorData.message;
          }
        } catch {
          // ignore JSON parse error and keep default message
        }
        throw new Error(message);
      }

      const loginData: LoginResponse = await loginRes.json();
      if (!loginData.token) {
        throw new Error("Authentication token not provided by server.");
      }

      localStorage.setItem("token", loginData.token);

      setProfileLoading(true);
      const profileRes = await fetch("/auth/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer undefined`
        }
      });

      if (!profileRes.ok) {
        let message = "Failed to fetch user profile.";
        try {
          const errorData = await profileRes.json();
          if (errorData && typeof errorData.message === "string") {
            message = errorData.message;
          }
        } catch {
          // ignore JSON parse error and keep default message
        }
        throw new Error(message);
      }

      const profileData: UserProfile = await profileRes.json();
      localStorage.setItem("userProfile", JSON.stringify(profileData));

      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      localStorage.removeItem("token");
      localStorage.removeItem("userProfile");
    } finally {
      setLoading(false);
      setProfileLoading(false);
    }
  };

  const isSubmitting = loading || profileLoading;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f7fafc",
        padding: "1rem"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          borderRadius: "0.5rem",
          boxShadow:
            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
          padding: "2rem"
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            textAlign: "center"
          }}
        >
          Login
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "#4a5568",
            marginBottom: "1.5rem",
            textAlign: "center"
          }}
        >
          Sign in with your email and password.
        </p>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "#fed7d7",
              color: "#822727",
              fontSize: "0.9rem"
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
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#2d3748"
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
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e0",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3182ce";
                e.currentTarget.style.boxShadow =
                  "0 0 0 1px rgba(49,130,206,0.5)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e0";
                e.currentTarget.style.boxShadow = "none";
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#2d3748"
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
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e0",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3182ce";
                e.currentTarget.style.boxShadow =
                  "0 0 0 1px rgba(49,130,206,0.5)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e0";
                e.currentTarget.style.boxShadow = "none";
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: isSubmitting ? "#a0aec0" : "#3182ce",
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background-color 0.2s ease"
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "#2b6cb0";
              }
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                isSubmitting ? "#a0aec0" : "#3182ce";
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;