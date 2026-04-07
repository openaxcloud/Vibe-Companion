import React, { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";

type RegisterResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`undefined/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        let message = "Registration failed.";
        try {
          const data = await response.json();
          if (data && typeof data.message === "string") {
            message = data.message;
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const data: RegisterResponse = await response.json();

      if (!data.token) {
        throw new Error("Invalid response from server.");
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));

      navigate("/", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-page" style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create an Account</h1>
        {error && (
          <div style={styles.errorBox} role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
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
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
              minLength={6}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="confirmPassword" style={styles.label}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              required
              minLength={6}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.button,
              ...(isSubmitting ? styles.buttonDisabled : {}),
            }}
          >
            {isSubmitting ? "Registering..." : "Register"}
          </button>
        </form>

        <p style={styles.footerText}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    padding: "1rem",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: "#ffffff",
    borderRadius: "0.75rem",
    padding: "2rem",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
  },
  title: {
    margin: 0,
    marginBottom: "1.5rem",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#111827",
    textAlign: "center",
  },
  errorBox: {
    marginBottom: "1rem",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    fontSize: "0.875rem",
    border: "1px solid #fecaca",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  button: {
    marginTop: "0.5rem",
    padding: "0.6rem 0.75rem",
    borderRadius: "0.5rem",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease, box-shadow 0.15s ease",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
    cursor: "not-allowed",
    boxShadow: "none",
  },
  footerText: {
    marginTop: "1.5rem",
    fontSize: "0.875rem",
    color: "#6b7280",
    textAlign: "center",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 500,
  },
};

export default Register;