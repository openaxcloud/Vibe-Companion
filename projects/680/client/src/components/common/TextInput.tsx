import React, {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useId,
  useState,
} from "react";

export type TextInputType = "text" | "email" | "password" | "search";

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id?: string;
  label?: string;
  type?: TextInputType;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  helperTextClassName?: string;
  showPasswordToggle?: boolean;
}

const baseContainerClass =
  "flex flex-col gap-1 text-sm text-gray-900 dark:text-gray-100";
const baseLabelClass =
  "inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-200";
const baseInputWrapperClass =
  "flex items-center gap-2 rounded-md border bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed dark:disabled:bg-gray-800";
const baseInputClass =
  "flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500";
const baseErrorClass = "text-xs text-red-600 dark:text-red-400";
const baseHelperClass = "text-xs text-gray-500 dark:text-gray-400";

const errorBorderClass = "border-red-500";
const normalBorderClass = "border-gray-300 dark:border-gray-700";

const iconClass = "flex items-center justify-center text-gray-400 text-sm px-2";
const toggleButtonClass =
  "flex items-center justify-center px-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors select-none cursor-pointer";

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      id,
      label,
      type = "text",
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      containerClassName,
      labelClassName,
      inputClassName,
      errorClassName,
      helperTextClassName,
      showPasswordToggle = true,
      className,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPasswordField = type === "password";
    const effectiveType =
      isPasswordField && showPasswordToggle
        ? isPasswordVisible
          ? "text"
          : "password"
        : type;

    const handleTogglePassword = () => {
      setIsPasswordVisible((prev) => !prev);
    };

    const wrapperClasses = [
      baseInputWrapperClass,
      error ? errorBorderClass : normalBorderClass,
      fullWidth ? "w-full" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const containerClasses = [
      baseContainerClass,
      fullWidth ? "w-full" : "",
      containerClassName ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const labelClasses = [baseLabelClass, labelClassName ?? ""]
      .filter(Boolean)
      .join(" ");

    const inputClasses = [baseInputClass, inputClassName ?? ""]
      .filter(Boolean)
      .join(" ");

    const errorClasses = [baseErrorClass, errorClassName ?? ""]
      .filter(Boolean)
      .join(" ");

    const helperClasses = [baseHelperClass, helperTextClassName ?? ""]
      .filter(Boolean)
      .join(" ");

    const hasRightAdornment = rightIcon || (isPasswordField && showPasswordToggle);

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
          </label>
        )}
        <div className={wrapperClasses}>
          {leftIcon && <div className={iconClass}>{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            type={effectiveType}
            className={inputClasses}
            aria-invalid={!!error}
            aria-describedby={
              error ? `undefined-error` : helperText ? `undefined-helper` : undefined
            }
            {...rest}
          />
          {hasRightAdornment && (
            <div className="flex items-center gap-1 pr-2">
              {rightIcon && <div className={iconClass}>{rightIcon}</div>}
              {isPasswordField && showPasswordToggle && (
                <button
                  type="button"
                  onClick={handleTogglePassword}
                  className={toggleButtonClass}
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {isPasswordVisible ? "Hide" : "Show"}
                </button>
              )}
            </div>
          )}
        </div>
        {error ? (
          <p id={`undefined-error`} className={errorClasses}>
            {error}
          </p>
        ) : helperText ? (
          <p id={`undefined-helper`} className={helperClasses}>
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

export default TextInput;