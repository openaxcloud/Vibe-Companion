import React, { ButtonHTMLAttributes, ForwardedRef, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  type?: "button" | "submit" | "reset";
}

const baseClasses =
  "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-blue-400",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-gray-500",
  outline:
    "border border-gray-300 text-gray-900 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-400 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus-visible:ring-gray-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const spinnerClasses = "animate-spin h-4 w-4 mr-2 text-current";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      className = "",
      type = "button",
      ...rest
    },
    ref: ForwardedRef<HTMLButtonElement>
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        className={`undefined undefined undefined undefined`}
        disabled={isDisabled}
        {...rest}
      >
        {isLoading && (
          <svg
            className={spinnerClasses}
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
        )}

        {!isLoading && leftIcon && (
          <span className="mr-2 inline-flex items-center">{leftIcon}</span>
        )}

        <span className="inline-flex items-center">{children}</span>

        {!isLoading && rightIcon && (
          <span className="ml-2 inline-flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;