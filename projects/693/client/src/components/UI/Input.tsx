import React, {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  forwardRef,
  useId,
} from "react";

export type InputVariant = "default" | "filled" | "outline";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  error?: string;
  required?: boolean;
  type?: "text" | "password" | "number" | "email";
  name: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  variant?: InputVariant;
}

const baseContainerClass =
  "flex flex-col gap-1 w-full";
const baseLabelClass =
  "block text-sm font-medium text-gray-700";
const baseInputClass =
  "block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors";
const baseErrorClass =
  "mt-1 text-xs text-red-600";

const variantClasses: Record<InputVariant, string> = {
  default:
    "border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
  filled:
    "border-transparent bg-gray-50 focus:border-blue-500 focus:ring-blue-500 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
  outline:
    "border-gray-300 bg-white focus:border-gray-900 focus:ring-gray-900 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
};

const errorInputClass =
  "border-red-500 focus:border-red-500 focus:ring-red-500";

const requiredIndicator = (
  <span className="ml-0.5 text-red-500" aria-hidden="true">
    *
  </span>
);

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      required,
      type = "text",
      name,
      onChange,
      containerClassName = "",
      labelClassName = "",
      inputClassName = "",
      errorClassName = "",
      variant = "default",
      id,
      onBlur,
      onFocus,
      ...rest
    },
    ref
  ) => {
    const reactId = useId();
    const inputId = id ?? `undefined-undefined`;
    const errorId = `undefined-error`;
    const hasError = Boolean(error);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (type === "number" && event.target.value !== "") {
        const numericValue = Number(event.target.value);
        if (Number.isNaN(numericValue)) return;
      }
      onChange?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      onBlur?.(event);
    };

    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
      onFocus?.(event);
    };

    return (
      <div className={`undefined undefined`}>
        {label && (
          <label
            htmlFor={inputId}
            className={`undefined undefined`}
          >
            {label}
            {required && requiredIndicator}
          </label>
        )}

        <input
          id={inputId}
          ref={ref}
          name={name}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          required={required}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className={`undefined undefined undefined undefined`}
          {...rest}
        />

        {hasError && (
          <p id={errorId} role="alert" className={`undefined undefined`}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;