import React, {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  ReactNode,
  forwardRef,
} from "react";
import clsx from "clsx";

export type InputVariant = "light" | "dark";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  id?: string;
  label?: ReactNode;
  error?: ReactNode;
  helperText?: ReactNode;
  variant?: InputVariant;
  fullWidth?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  helperTextClassName?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

const baseInputClasses =
  "block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors outline-none focus:ring-2 focus:ring-offset-0";

const variantClasses: Record<
  InputVariant,
  {
    input: string;
    label: string;
    helper: string;
    error: string;
  }
> = {
  light: {
    input:
      "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
    label: "text-slate-700",
    helper: "text-slate-500",
    error: "text-red-600",
  },
  dark: {
    input:
      "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed",
    label: "text-slate-200",
    helper: "text-slate-400",
    error: "text-red-400",
  },
};

const errorInputClasses =
  "border-red-500 focus:border-red-500 focus:ring-red-500";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      variant = "light",
      fullWidth = true,
      className,
      containerClassName,
      labelClassName,
      inputClassName,
      errorClassName,
      helperTextClassName,
      required,
      disabled,
      type = "text",
      ...rest
    },
    ref
  ) => {
    const inputId = id || rest.name || undefined;
    const hasError = Boolean(error);
    const selectedVariant = variantClasses[variant];

    return (
      <div
        className={clsx(
          "flex flex-col gap-1",
          fullWidth && "w-full",
          containerClassName
        )}
      >
        {label && (
          <label
            htmlFor={inputId}
            className={clsx(
              "mb-1 block text-sm font-medium",
              selectedVariant.label,
              labelClassName
            )}
          >
            <span>{label}</span>
            {required && (
              <span className="ml-0.5 text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <input
          id={inputId}
          ref={ref}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError
              ? `undefined-error`
              : helperText
              ? `undefined-helper`
              : undefined
          }
          disabled={disabled}
          className={clsx(
            baseInputClasses,
            selectedVariant.input,
            hasError && errorInputClasses,
            className,
            inputClassName
          )}
          {...rest}
        />

        {helperText && !hasError && (
          <p
            id={inputId ? `undefined-helper` : undefined}
            className={clsx(
              "mt-0.5 text-xs",
              selectedVariant.helper,
              helperTextClassName
            )}
          >
            {helperText}
          </p>
        )}

        {hasError && (
          <p
            id={inputId ? `undefined-error` : undefined}
            className={clsx(
              "mt-0.5 text-xs",
              selectedVariant.error,
              errorClassName
            )}
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;