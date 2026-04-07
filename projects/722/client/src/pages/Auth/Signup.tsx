import React, { useState, useCallback, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";

type SignupResponseSuccess = {
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
  token?: string;
};

type SignupResponseError = {
  message?: string;
  error?: string;
  [key: string]: unknown;
};

const Signup: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const resetMessages = useCallback(() => {
    setError(null);
    setInfoMessage(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      resetMessages();

      if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
        setError("Please fill in all fields.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch("/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email: email.trim(), password }),
        });

        const contentType = response.headers.get("Content-Type") || "";
        let data: SignupResponseSuccess | SignupResponseError | null = null;

        if (contentType.includes("application/json")) {
          data = (await response.json()) as
            | SignupResponseSuccess
            | SignupResponseError;
        }

        if (!response.ok) {
          const messageFromServer =
            (data && ("message" in data || "error" in data) &&
              ((data as SignupResponseError).message ||
                (data as SignupResponseError).error)) ||
            "Signup failed. Please try again.";
          setError(messageFromServer);
          return;
        }

        const successData = data as SignupResponseSuccess | null;

        // Auto-login if a token or authenticated session is returned
        if (successData && (successData.token || successData.user)) {
          navigate("/", { replace: true });
          return;
        }

        // Otherwise, prompt user to log in
        setInfoMessage(
          "Signup successful. Please log in with your new credentials."
        );
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 1500);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Signup error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, password, confirmPassword, navigate, resetMessages]
  );

  return (
    <div className="auth-page auth-page--signup">
      <div className="auth-card">
        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">
            Log in
          </Link>
        </p>

        {error && <div className="auth-alert auth-alert--error">{error}</div>}
        {infoMessage && (
          <div className="auth-alert auth-alert--info">{infoMessage}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-form-group">
            <label htmlFor="signup-email" className="auth-label">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              className="auth-input"
              value={email}
              onChange={(e) => {
                resetMessages();
                setEmail(e.target.value);
              }}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="signup-password" className="auth-label">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              className="auth-input"
              value={password}
              onChange={(e) => {
                resetMessages();
                setPassword(e.target.value);
              }}
              disabled={isSubmitting}
              required
              minLength={8}
            />
            <small className="auth-hint">
              Use at least 8 characters, including letters and numbers.
            </small>
          </div>

          <div className="auth-form-group">
            <label htmlFor="signup-confirm-password" className="auth-label">
              Confirm password
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              autoComplete="new-password"
              className="auth-input"
              value={confirmPassword}
              onChange={(e) => {
                resetMessages();
                setConfirmPassword(e.target.value);
              }}
              disabled={isSubmitting}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="auth-button auth-button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing up..." : "Sign up"}
          </button>
        </form>

        <p className="auth-footer-text">
          By signing up, you agree to our{" "}
          <Link to="/terms" className="auth-link">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="auth-link">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default Signup;