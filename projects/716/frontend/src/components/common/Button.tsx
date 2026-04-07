import React from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
}

const baseStyles =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ring-offset-background";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
  outline:
    "border border-gray-300 text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-400 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const spinnerSizeStyles: Record<ButtonSize, string> = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      type = "button",
      disabled,
      fullWidth = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          (leftIcon || rightIcon) && "gap-2",
          isLoading && "relative",
          className
        )}
        {...props}
      >
        {isLoading && (
          <span
            className={clsx(
              "inline-flex items-center justify-center",
              children && "mr-1"
            )}
          >
            <svg
              className={clsx(
                "animate-spin text-current",
                spinnerSizeStyles[size]
              )}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v3.2a4.8 4.8 0 00-4.8 4.8H4z"
              />
            </svg>
          </span>
        )}

        {!isLoading && leftIcon && (
          <span className="inline-flex items-center justify-center">
            {leftIcon}
          </span>
        )}

        {children && (
          <span
            className={clsx(
              "inline-flex items-center justify-center",
              isLoading && "opacity-90"
            )}
          >
            {children}
          </span>
        )}

        {!isLoading && rightIcon && (
          <span className="inline-flex items-center justify-center">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;