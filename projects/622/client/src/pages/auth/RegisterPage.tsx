import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios, { AxiosError } from "axios";

type RegisterResponse = {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  token?: string;
};

type ApiValidationError = {
  field?: string;
  message: string;
};

type ApiErrorResponse = {
  message?: string;
  errors?: ApiValidationError[];
};

type FormErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialFormValues: RegisterFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const emailRegex =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const minPasswordLength = 8;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState<RegisterFormValues>(initialFormValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get("redirect") || "/";

  useEffect(() => {
    const fromLoginPrompt = searchParams.get("loginPrompt");
    if (fromLoginPrompt === "true") {
      setLoginPrompt(true);
    }
  }, [location.search, searchParams]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      setValues((prev) => ({
        ...prev,
        [name]: value,
      }));
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
        general: undefined,
      }));
    },
    []
  );

  const validate = useCallback(
    (formValues: RegisterFormValues): FormErrors => {
      const validationErrors: FormErrors = {};

      if (!formValues.firstName.trim()) {
        validationErrors.firstName = "First name is required.";
      }

      if (!formValues.lastName.trim()) {
        validationErrors.lastName = "Last name is required.";
      }

      if (!formValues.email.trim()) {
        validationErrors.email = "Email is required.";
      } else if (!emailRegex.test(formValues.email)) {
        validationErrors.email = "Please enter a valid email address.";
      }

      if (!formValues.password) {
        validationErrors.password = "Password is required.";
      } else if (formValues.password.length < minPasswordLength) {
        validationErrors.password = `Password must be at least undefined characters.`;
      }

      if (!formValues.confirmPassword) {
        validationErrors.confirmPassword = "Please confirm your password.";
      } else if (formValues.confirmPassword !== formValues.password) {
        validationErrors.confirmPassword = "Passwords do not match.";
      }

      return validationErrors;
    },
    []
  );

  const mapApiErrorsToForm = useCallback((apiErrors: ApiValidationError[] = []): FormErrors => {
    const mapped: FormErrors = {};
    apiErrors.forEach((err) => {
      if (err.field && err.message) {
        switch (err.field) {
          case "firstName":
          case "lastName":
          case "email":
          case "password":
          case "confirmPassword":
            mapped[err.field] = err.message;
            break;
          default:
            mapped.general = err.message;
        }
      } else if (err.message) {
        mapped.general = err.message;
      }
    });
    return mapped;
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setErrors({});
      setSubmitSuccess(false);
      setLoginPrompt(false);

      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await axios.post<RegisterResponse>("/api/auth/register", {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });

        const { token, user } = response.data;

        if (token) {
          localStorage.setItem("authToken", token);
          localStorage.setItem("currentUser", JSON.stringify(user));
          setSubmitSuccess(true);
          navigate(redirectPath || "/", { replace: true });
          return;
        }

        setSubmitSuccess(true);
        setLoginPrompt(true);
      } catch (error: unknown) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        if (axiosError.response) {
          const data = axiosError.response.data;
          const apiErrors: ApiValidationError[] | undefined = data?.errors;
          const mappedErrors = apiErrors && apiErrors.length > 0 ? mapApiErrorsToForm(apiErrors) : {};
          if (!apiErrors || apiErrors.length === 0) {
            mappedErrors.general =
              data?.message ||
              "Registration failed. Please check your details and try again.";
          }
          setErrors(mappedErrors);
        } else if (axiosError.request) {
          setErrors({
            general:
              "Unable to reach the server. Please check your internet connection and try again.",
          });
        } else {
          setErrors({
            general: "An unexpected error occurred. Please try again.",
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [mapApiErrorsToForm, navigate, redirectPath, validate, values]
  );

  const navigateToLogin = useCallback(() => {
    const params = new URLSearchParams();
    if (redirectPath) {
      params.set("redirect", redirectPath);
    }
    navigate(`/login?undefined`);
  }, [navigate, redirectPath]);

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Enter your details to register. You can use this account to log in later.
        </p>

        {errors.general && (
          <div className="auth-alert auth-alert-error" role="alert">
            {errors.general}
          </div>
        )}

        {submitSuccess && !errors.general && (
          <div className="auth-alert auth-alert-success" role="status">
            Registration successful.
            {!loginPrompt && " Redirecting..."}
          </div>
        )}

        {loginPrompt && (
          <div className="auth-alert auth-alert-info" role="status">
            Your account has been created. Please{" "}
            <button
              type="button"
              className="auth-link-button"
              onClick={navigateToLogin}
            >
              log in
            </button>{" "}
            to continue.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-form-row">
            <div className="auth-form-field">
              <label htmlFor="firstName" className="auth-label">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                className={`auth-inputundefined`}
                value={values.firstName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.firstName && (
                <p className="auth-field-error" role="alert">
                  {errors.firstName}
                </p>
              )}
            </div>

            <div className="auth-form-field">
              <label htmlFor="lastName" className="auth-label">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                className={`auth-inputundefined`}
                value={values.lastName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.lastName && (
                <p className="auth-field-error" role="alert">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="auth-form-field">
            <label htmlFor="email" className="auth-label">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"