import React, { ButtonHTMLAttributes, ForwardedRef } from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400 border border-gray-300",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const spinnerClasses = "mr-2 h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      fullWidth = false,
      className = "",
      children,
      type = "button",
      "aria-busy": ariaBusyProp,
      "aria-disabled": ariaDisabledProp,
      ...rest
    },
    ref: ForwardedRef<HTMLButtonElement>
  ) => {
    const isDisabled = disabled || isLoading;

    const ariaBusy = ariaBusyProp ?? (isLoading ? true : undefined);
    const ariaDisabled = ariaDisabledProp ?? (isDisabled ? true : undefined);

    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={isDisabled}
        aria-busy={ariaBusy}
        aria-disabled={ariaDisabled}
        aria-live={isLoading ? "polite" : rest["aria-live"]}
        {...rest}
      >
        {isLoading && (
          <span
            className={spinnerClasses}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;