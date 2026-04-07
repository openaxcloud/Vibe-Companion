import React, {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ForwardedRef,
  ReactNode,
  forwardRef,
  useMemo,
} from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<
    DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>,
    "type"
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  type?: "button" | "submit" | "reset";
}

const baseClasses =
  "inline-flex items-center justify-center rounded-md font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400",
  outline:
    "border border-gray-300 bg-transparent text-gray-900 hover:bg-gray-50 focus-visible:ring-gray-400",
  ghost:
    "bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-5 w-5",
};

const spinnerSizeClasses: Record<ButtonSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-5 w-5",
};

const Spinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
  const spinnerClass = spinnerSizeClasses[size];
  return (
    <svg
      className={`animate-spin undefined`}
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
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
};

const ButtonInnerContent: React.FC<
  Pick<
    ButtonProps,
    "children" | "leftIcon" | "rightIcon" | "isLoading" | "size"
  >
> = ({ children, leftIcon, rightIcon, isLoading, size = "md" }) => {
  const iconClass = iconSizeClasses[size];

  const hasLeftIcon = Boolean(leftIcon);
  const hasRightIcon = Boolean(rightIcon);

  return (
    <>
      <span className="inline-flex items-center gap-2">
        {isLoading ? (
          <span className="flex items-center justify-center">
            <Spinner size={size} />
          </span>
        ) : (
          <>
            {hasLeftIcon && (
              <span className={`flex items-center justify-center undefined`}>
                {leftIcon}
              </span>
            )}
            {children && (
              <span
                className={
                  hasLeftIcon || hasRightIcon ? "inline-flex items-center" : ""
                }
              >
                {children}
              </span>
            )}
            {hasRightIcon && (
              <span className={`flex items-center justify-center undefined`}>
                {rightIcon}
              </span>
            )}
          </>
        )}
      </span>
    </>
  );
};

const ButtonComponent = (
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    isLoading = false,
    disabled,
    className = "",
    children,
    leftIcon,
    rightIcon,
    type = "button",
    "aria-busy": ariaBusyProp,
    "aria-disabled": ariaDisabledProp,
    ...rest
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
) => {
  const isDisabled = disabled || isLoading;
  const ariaBusy = ariaBusyProp ?? (isLoading ? true : undefined);
  const ariaDisabled = ariaDisabledProp ?? (isDisabled ? true : undefined);

  const computedClassName = useMemo(() => {
    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");
    return classes;
  }, [variant, size, fullWidth, className]);

  return (
    <button
      ref={ref}
      type={type}
      className={computedClassName}
      disabled={isDisabled}
      aria-busy={ariaBusy}
      aria-disabled={ariaDisabled}
      {...rest}
    >
      <ButtonInnerContent
        isLoading={isLoading}
        size={size}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
      >
        {children}
      </ButtonInnerContent>
    </button>
  );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(ButtonComponent);
Button.displayName = "Button";

export default Button;