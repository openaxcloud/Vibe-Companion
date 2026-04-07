import React, {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useId,
  FocusEvent,
} from "react";

export type InputType = "text" | "email" | "password" | "number";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  name: string;
  type?: InputType;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  helperClassName?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

const baseInputClass =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 " +
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "transition-colors duration-150 ease-in-out";

const errorInputClass =
  "border-red-500 focus:border-red-500 focus:ring-red-500";

const containerBaseClass = "flex flex-col gap-1";

const labelBaseClass =
  "block text-sm font-medium text-gray-700 select-none cursor-pointer";

const errorTextBaseClass = "mt-1 text-xs text-red-600";

const helperTextBaseClass = "mt-1 text-xs text-gray-500";

const iconWrapperBaseClass =
  "pointer-events-none absolute inset-y-0 flex items-center text-gray-400";

const leftIconClass = "left-0 pl-3";
const rightIconClass = "right-0 pr-3";

const withLeftIconPadding = "pl-10";
const withRightIconPadding = "pr-10";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      name,
      type = "text",
      error,
      helperText,
      containerClassName = "",
      labelClassName = "",
      inputClassName = "",
      errorClassName = "",
      helperClassName = "",
      leftIcon,
      rightIcon,
      fullWidth = true,
      onBlur,
      id,
      required,
      ...rest
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = id || `undefined-undefined`;
    const hasError = Boolean(error);
    const describedByIds: string[] = [];

    if (helperText) {
      describedByIds.push(`undefined-helper`);
    }
    if (hasError) {
      describedByIds.push(`undefined-error`);
    }

    const rootClassName = [
      containerBaseClass,
      fullWidth ? "w-full" : "",
      containerClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const labelClasses = [labelBaseClass, labelClassName]
      .filter(Boolean)
      .join(" ");

    const inputClasses = [
      baseInputClass,
      hasError ? errorInputClass : "",
      leftIcon ? withLeftIconPadding : "",
      rightIcon ? withRightIconPadding : "",
      inputClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      if (onBlur) {
        onBlur(event);
      }
    };

    return (
      <div className={rootClassName}>
        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className={`undefined undefined`}>
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            name={name}
            type={type}
            ref={ref}
            aria-invalid={hasError || undefined}
            aria-describedby={
              describedByIds.length > 0 ? describedByIds.join(" ") : undefined
            }
            required={required}
            className={inputClasses}
            onBlur={handleBlur}
            {...rest}
          />

          {rightIcon && (
            <div className={`undefined undefined`}>
              {rightIcon}
            </div>
          )}
        </div>

        {hasError && (
          <p
            id={`undefined-error`}
            className={[errorTextBaseClass, errorClassName]
              .filter(Boolean)
              .join(" ")}
          >
            {error}
          </p>
        )}

        {helperText && !hasError && (
          <p
            id={`undefined-helper`}
            className={[helperTextBaseClass, helperClassName]
              .filter(Boolean)
              .join(" ")}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;