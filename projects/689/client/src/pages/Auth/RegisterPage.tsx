import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Alert,
  Paper,
  Divider,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

type RegisterResponse = {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  token?: string;
};

type ApiErrorResponse = {
  message?: string;
  errors?: Record<string, string[] | string>;
};

type LocationState = {
  from?: string;
};

const REGISTER_ENDPOINT = "/api/auth/register";
const LOGIN_ENDPOINT = "/api/auth/login";

const PASSWORD_MIN_LENGTH = 8;

const validateEmail = (value: string): string | null => {
  if (!value) return "Email is required";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value.trim())) return "Please enter a valid email address";
  return null;
};

const validatePassword = (value: string): string | null => {
  if (!value) return "Password is required";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least undefined characters`;
  }
  return null;
};

const validateName = (value: string): string | null => {
  if (!value.trim()) return "Name is required";
  if (value.trim().length < 2) return "Name must be at least 2 characters";
  return null;
};

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state || {}) as LocationState;

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [attemptingAutoLogin, setAttemptingAutoLogin] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      name.trim() &&
        email.trim() &&
        password &&
        confirmPassword &&
        !nameError &&
        !emailError &&
        !passwordError &&
        !confirmPasswordError &&
        !isSubmitting &&
        !attemptingAutoLogin
    );
  }, [
    name,
    email,
    password,
    confirmPassword,
    nameError,
    emailError,
    passwordError,
    confirmPasswordError,
    isSubmitting,
    attemptingAutoLogin,
  ]);

  const handleBlurName = useCallback(() => {
    setNameError(validateName(name));
  }, [name]);

  const handleBlurEmail = useCallback(() => {
    setEmailError(validateEmail(email));
  }, [email]);

  const handleBlurPassword = useCallback(() => {
    setPasswordError(validatePassword(password));
  }, [password]);

  const handleBlurConfirmPassword = useCallback(() => {
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password");
      return;
    }
    if (confirmPassword !== password) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }
    setConfirmPasswordError(null);
  }, [confirmPassword, password]);

  const handleAutoLogin = useCallback(
    async (emailValue: string, passwordValue: string) => {
      setAttemptingAutoLogin(true);
      setFormError(null);
      try {
        const res = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: emailValue.trim(),
            password: passwordValue,
          }),
        });

        if (!res.ok) {
          setFormSuccess(
            "Registration successful, but automatic login failed. Please log in with your new credentials."
          );
          return;
        }

        const data = (await res.json()) as {
          token?: string;
          user?: { id: string; email: string; name?: string };
        };

        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }

        const redirectTo = locationState.from || "/";
        navigate(redirectTo, { replace: true });
      } catch (error) {
        setFormSuccess(
          "Registration successful, but automatic login failed. Please log in with your new credentials."
        );
      } finally {
        setAttemptingAutoLogin(false);
      }
    },
    [navigate, locationState.from]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nameValidation = validateName(name);
      const emailValidation = validateEmail(email);
      const passwordValidation = validatePassword(password);
      let confirmPasswordValidation: string | null = null;

      if (!confirmPassword) {
        confirmPasswordValidation = "Please confirm your password";
      } else if (confirmPassword !== password) {
        confirmPasswordValidation = "Passwords do not match";
      }

      setNameError(nameValidation);
      setEmailError(emailValidation);
      setPasswordError(passwordValidation);
      setConfirmPasswordError(confirmPasswordValidation);

      if (
        nameValidation ||
        emailValidation ||
        passwordValidation ||
        confirmPasswordValidation
      ) {
        return;
      }

      setIsSubmitting(true);
      setFormError(null);
      setFormSuccess(null);

      try {
        const res = await fetch(REGISTER_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
          }),
        });

        if (!res.ok) {
          let message = "Registration failed. Please try again.";
          try {
            const errorBody = (await res.json()) as ApiErrorResponse;
            if (errorBody.message) {
              message = errorBody.message;
            }
            if (errorBody.errors) {
              if (errorBody.errors.email) {
                const emailErr =
                  Array.isArray(errorBody.errors.email)
                    ? errorBody.errors.email.join(" ")
                    : errorBody.errors.email;
                setEmailError(emailErr);
              }
              if (errorBody.errors.password) {
                const passErr =
                  Array.isArray(errorBody.errors.password)
                    ? errorBody.errors.password.join(" ")
                    : errorBody.errors.password;
                setPasswordError(passErr);
              }
              if (errorBody.errors.name) {
                const nameErr =
                  Array.isArray(errorBody.errors.name)
                    ? errorBody.errors.name.join(" ")
                    : errorBody.errors.name;
                setNameError(nameErr);
              }
            }
          } catch {
            // ignore JSON parse errors
          }
          setFormError(message);
          return;
        }

        const data = (await res.json()) as RegisterResponse;

        if (data.token) {
          localStorage.setItem("authToken", data.token);
          const redirectTo = locationState.from || "/";
          navigate(redirectTo, { replace: true });
          return;
        }

        setFormSuccess("Registration successful! Logging you in...");
        await handleAutoLogin(email, password);
      } catch (error) {
        setFormError("An unexpected error occurred. Please try again later.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, email, password, confirmPassword, locationState.from, navigate, handleAutoLogin]
  );

  useEffect(() => {
    setFormError(null);
    setFormSuccess(null);
  }, [name, email, password, confirmPassword]);

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          p: 4,
          borderRadius: 3,
        }}
      >
        <Box mb={3} textAlign="center">
          <Typography variant="h4" component="h1" gutterBottom>
            Create an Account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign up to get started. If you already have an account,{" "}
            <Link to="/