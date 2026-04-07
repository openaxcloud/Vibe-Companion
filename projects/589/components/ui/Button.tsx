import React, {
  ButtonHTMLAttributes,
  ForwardedRef,
  MouseEvent,
  ReactNode,
  forwardRef,
  useMemo,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 border border-transparent",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-blue-400",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-blue-400",
        ghost:
          "bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-blue-500 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus-visible:ring-blue-400",
        outline:
          "bg-transparent text-gray-900 border-gray-300 hover:bg-gray-50 focus-visible:ring-blue-500 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:focus-visible:ring-blue-400",
        danger:
          "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600 dark:focus-visible:ring-red-400",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
      rounded: {
        true: "rounded-full",
        false: "",
      },
      isLoading: {
        true: "relative !text-transparent hover:!text-transparent",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
      rounded: false,
      isLoading: false,
    },
  }
);

export type ButtonBaseProps = {
  children?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  loader?: ReactNode;
  fullWidth?: boolean;
  rounded?: boolean;
} & VariantProps<typeof buttonVariants>;

export type ButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    type?: "button" | "submit" | "reset";
  };

const Spinner: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      className={clsx("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25 text-gray-300 dark:text-gray-700"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75 text-current"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3.2a4.8 4.8 0 00-4.8 4.8H4z"
      />
    </svg>
  );
};

const ButtonInnerContent: React.FC<{
  children?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  loader?: ReactNode;
  size?: ButtonSize;
}> = ({ children, leftIcon, rightIcon, isLoading, loader, size = "md" }) => {
  const iconSize = useMemo(() => {
    switch (size) {
      case "xs":
        return "h-3.5 w-3.5";
      case "sm":
        return "h-4 w-4";
      case "lg":
        return "h-5 w-5";
      case "icon":
      case "md":
      default:
        return "h-4.5 w-4.5";
    }
  }, [size]);

  const gapClass = children ? "gap-1.5" : "";

  return (
    <>
      {isLoading && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {loader ?? <Spinner className={iconSize} />}
        </span>
      )}

      <span
        className={clsx(
          "inline-flex items-center justify-center",
          gapClass,
          isLoading && "opacity-0"
        )}
      >
        {leftIcon && (
          <span className={clsx("inline-flex shrink-0", !children && "mr-0")}>
            {leftIcon}
          </span>
        )}
        {children && <span className="inline-flex">{children}</span>}
        {rightIcon && (
          <span className={clsx("inline-flex shrink-0", !children && "ml-0")}>
            {rightIcon}
          </span>
        )}
      </span>
    </>
  );
};

const ButtonComponent = (
  {
    children,
    variant = "primary",
    size = "md",
    type = "button",
    isLoading = false,
    disabled,
    fullWidth = false,
    rounded = false,
    leftIcon,
    rightIcon,
    loader,
    className,
    onClick,
    ...props
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isLoading || disabled) {
      event.preventDefault();
      return;
    }
    if (onClick) {
      onClick(event);
    }
  };

  const computedDisabled = disabled || isLoading;

  const classes = buttonVariants({
    variant,
    size,
    fullWidth,
    rounded,
    isLoading,
    className,
  });

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={computedDisabled}
      aria-disabled={computedDisabled || undefined}
      aria-busy={isLoading || undefined}
      onClick={handleClick}
      {...props}
    >
      <ButtonInnerContent
        size={size}
        isLoading={isLoading}
        loader={loader}
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

export { buttonVariants };