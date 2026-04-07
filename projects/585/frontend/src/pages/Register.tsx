import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

type RegisterFormState = {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  username: string;
  bio: string;
};

type RegisterFormErrors = Partial<Record<keyof RegisterFormState, string>> & {
  general?: string;
};

type PasswordStrength = "weak" | "medium" | "strong" | "empty";

type ApiError = {
  message: string;
  field?: keyof RegisterFormState;
};

const initialFormState: RegisterFormState = {
  email: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  username: "",
  bio: "",
};

const emailRegex =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;

const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

const passwordMinLength = 8;

const validateEmail = (email: string): string | null => {
  if (!email.trim()) return "Email is required.";
  if (!emailRegex.test(email.trim())) return "Please enter a valid email address.";
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return "Password is required.";
  if (password.length < passwordMinLength) {
    return `Password must be at least undefined characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }
  return null;
};

const validateConfirmPassword = (password: string, confirmPassword: string): string | null => {
  if (!confirmPassword) return "Please confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
};

const validateFullName = (fullName: string): string | null => {
  if (!fullName.trim()) return "Full name is required.";
  if (fullName.trim().length < 2) return "Full name must be at least 2 characters.";
  return null;
};

const validateUsername = (username: string): string | null => {
  if (!username.trim()) return "Username is required.";
  if (!usernameRegex.test(username.trim())) {
    return "Username must be 3–20 characters and contain only letters, numbers, or underscores.";
  }
  return null;
};

const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return "empty";
  let score = 0;
  if (password.length >= passwordMinLength) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
};

const getPasswordStrengthLabel = (strength: PasswordStrength): string => {
  switch (strength) {
    case "weak":
      return "Weak";
    case "medium":
      return "Medium";
    case "strong":
      return "Strong";
    default:
      return "";
  }
};

const getPasswordStrengthColorClass = (strength: PasswordStrength): string => {
  switch (strength) {
    case "weak":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "strong":
      return "bg-green-500";
    default:
      return "bg-gray-200";
  }
};

const useRegisterApi = () => {
  const [isLoading, setIsLoading] = useState(false);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      username: string;
      bio?: string;
    }): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { errors?: ApiError[]; message?: string } | null;

          if (data?.errors && data.errors.length > 0) {
            const error = data.errors[0];
            const e = new Error(error.message) as Error & { field?: keyof RegisterFormState };
            if (error.field) e.field = error.field;
            throw e;
          }

          const message = data?.message || "Unable to register. Please try again.";
          throw new Error(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { register, isLoading };
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormState>(initialFormState);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [touched, setTouched] = useState<Record<keyof RegisterFormState, boolean>>({
    email: false,
    password: false,
    confirmPassword: false,
    fullName: false,
    username: false,
    bio: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const { register, isLoading } = useRegisterApi();

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  useEffect(() => {
    setSubmitError(null);
    setSubmitSuccess(null);
  }, [form]);

  const handleChange =
    (field: keyof RegisterFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleBlur = (field: keyof RegisterFormState) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: keyof RegisterFormState): string | null => {
    let error: string | null = null;
    switch (field) {
      case "email":
        error = validateEmail(form.email);
        break;
      case "password":
        error = validatePassword(form.password);
        if (!error && form.confirmPassword) {
          const confirmError = validateConfirmPassword(form.password, form.confirmPassword);
          setErrors((prev) => ({ ...prev, confirmPassword: confirmError || undefined }));
        }
        break;
      case "confirmPassword":
        error = validateConfirmPassword(form.password, form.confirmPassword);
        break;
      case "fullName":
        error = validateFullName(form.fullName);
        break;
      case "username":
        error = validateUsername(form.username);
        break;
      case "bio":
        error = null;
        break;
      default:
        error = null;
    }

    setErrors((prev) => ({
      ...prev,
      [field]: error || undefined,
    }));
    return error;
  };

  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    const emailError = validateEmail(form.email);
    if (emailError) newErrors.email = emailError;

    const passwordError = validatePassword(form.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmError = validateConfirmPassword(form.password, form.confirmPassword);
    if (confirmError) newErrors.confirmPassword = confirmError;

    const fullNameError = validateFullName(form.fullName);
    if (fullNameError) newErrors.fullName = fullNameError;

    const usernameError = validateUsername(form.username);
    if (usernameError) newErrors.username = usernameError;

    setErrors(newErrors);
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
      fullName: true,
      username: true,
      bio: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit