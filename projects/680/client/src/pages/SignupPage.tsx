import React, { FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

type SignupResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isSubmitting) return;

      setError(null);

      if (!email.trim() || !password.trim() || !displayName.trim()) {
        setError("Please fill in all fields.");
        return;
      }

      setIsSubmitting(true);

      try {
        const res = await fetch(`undefined/api/auth/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
            displayName: displayName.trim(),
          }),
        });

        if (!res.ok) {
          let message = "Failed to sign up. Please try again.";
          try {
            const data = (await res.json()) as { error?: string; message?: string };
            message = data.error || data.message || message;
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(message);
        }

        const data = (await res.json()) as SignupResponse;

        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }

        navigate("/workspace", { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error occurred.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [API_BASE_URL, email, password, displayName, isSubmitting, navigate]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#020617",
          borderRadius: "0.75rem",
          padding: "2rem",
          boxShadow: "0 20px 40px rgba(15,23,42,0.8)",
          border: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        <div style={{ marginBottom: "1.75rem" }}>
          <h1
            style={{
              margin: 0,
              marginBottom: "0.5rem",
              fontSize: "1.75rem",
              lineHeight: 1.2,
              fontWeight: 600,
              color: "#e5e7eb",
            }}
          >
            Create your account
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "#9ca3af",
            }}
          >
            Sign up to start working in your workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="displayName"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148,163,184,0.4)",
                backgroundColor: "#020617",
                color: "#e5e7eb",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(79,70,229,0.7)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(148,163,184,0.4)";
                e.currentTarget.style.boxShadow = "none";
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148,163,184,0.4)",
                backgroundColor: "#020617",
                color: "#e5e7eb",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(79,70,229,0.7)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(148,163,184,0.4)";
                e.currentTarget.style.boxShadow = "none";
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148,163,184,0.4)",
                backgroundColor: "#020617",
                color: "#e5e7eb",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(79,70,229,0.7)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(148,163,184,0.4)";
                e.currentTarget.style.boxShadow = "none";
              }}
              required
              minLength={8}
            />
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.75rem",
                color: "#6b7280",
              }}
            >
              At least 8 characters.
            </p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.4)",
                color: "#fecaca",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}