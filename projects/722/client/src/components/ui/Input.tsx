import React, {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useId,
  Ref,
} from "react";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  className?: string;
  labelClassName?: string;
  errorClassName?: string;
  containerClassName?: string;
}

const baseInputClasses =
  "block w-full rounded-md border px-3 py-2 text-sm shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "placeholder:text-gray-400 transition-colors";

const normalInputClasses =
  "border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-900";

const errorInputClasses =
  "border-red-500 focus:border-red-500 focus:ring-red-500 bg-white text-gray-900";

const iconPaddingClasses = "pl-10";
const iconContainerClasses =
  "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400";

export const Input = forwardRef(function Input(
  {
    label,
    error,
    icon,
    className = "",
    labelClassName = "",
    errorClassName = "",
    containerClassName = "",
    id,
    type = "text",
    ...rest
  }: InputProps,
  ref: Ref<HTMLInputElement>
) {
  const autoId = useId();
  const inputId = id || autoId;
  const hasError = Boolean(error);
  const hasIcon = Boolean(icon);

  const inputClasses = [
    baseInputClasses,
    hasError ? errorInputClasses : normalInputClasses,
    hasIcon ? iconPaddingClasses : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={inputId}
          className={[
            "mb-1 block text-sm font-medium text-gray-700",
            labelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {hasIcon && <div className={iconContainerClasses}>{icon}</div>}
        <input
          id={inputId}
          ref={ref}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `undefined-error` : undefined}
          className={inputClasses}
          {...rest}
        />
      </div>
      {hasError && (
        <p
          id={`undefined-error`}
          role="alert"
          className={[
            "mt-1 text-xs text-red-600",
            errorClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;