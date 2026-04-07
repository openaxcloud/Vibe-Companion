import React, { ButtonHTMLAttributes, ReactNode, MouseEvent } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  children: ReactNode;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 px-4 py-2";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400 border border-gray-300",
};

const spinnerClasses =
  "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2";

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  className = "",
  onClick,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const combinedClassName = [
    baseClasses,
    variantClasses[variant],
    isLoading ? "cursor-wait" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={combinedClassName}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {isLoading && <span className={spinnerClasses} aria-hidden="true" />}
      <span className={isLoading ? "opacity-80" : ""}>{children}</span>
    </button>
  );
};

export default Button;