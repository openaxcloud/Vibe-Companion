import React, {
  forwardRef,
  InputHTMLAttributes,
  Ref,
  useId,
  ReactNode,
  ChangeEvent,
} from "react";

export type InputVariant = "default" | "error" | "success" | "ghost";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  description?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  variant?: InputVariant;
  containerClassName?: string;
}

const baseInputClass =
  "block w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm " +
  "placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

const variantClasses: Record<InputVariant, string> = {
  default:
    "border-gray-300 focus-visible:border-gray-500 focus-visible:ring-blue-500",
  error:
    "border-red-500 focus-visible:border-red-600 focus-visible:ring-red-500",
  success:
    "border-emerald-500 focus-visible:border-emerald-600 focus-visible:ring-emerald-500",
  ghost:
    "border-transparent bg-transparent shadow-none focus-visible:border-gray-400 focus-visible:ring-blue-500",
};

const containerBaseClass = "flex flex-col gap-1";

const Input = forwardRef(function Input(
  props: InputProps,
  ref: Ref<HTMLInputElement>
) {
  const {
    label,
    description,
    error,
    leftIcon,
    rightIcon,
    fullWidth = true,
    variant = "default",
    className = "",
    containerClassName = "",
    id,
    onChange,
    ...rest
  } = props;

  const generatedId = useId();
  const inputId = id || generatedId;
  const describedByIds: string[] = [];

  if (description) describedByIds.push(`undefined-description`);
  if (error) describedByIds.push(`undefined-error`);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (rest.readOnly) {
      event.preventDefault();
      return;
    }
    if (onChange) onChange(event);
  };

  const inputElement = (
    <div className="relative flex items-stretch">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          {leftIcon}
        </span>
      )}

      <input
        id={inputId}
        ref={ref}
        aria-invalid={!!error || undefined}
        aria-describedby={describedByIds.length ? describedByIds.join(" ") : undefined}
        className={[
          baseInputClass,
          variantClasses[variant],
          leftIcon ? "pl-9" : "",
          rightIcon ? "pr-9" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onChange={handleChange}
        {...rest}
      />

      {rightIcon && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
          {rightIcon}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={[
        containerBaseClass,
        fullWidth ? "w-full" : "",
        containerClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}

      {inputElement}

      {description && !error && (
        <p
          id={`undefined-description`}
          className="text-xs text-gray-500"
        >
          {description}
        </p>
      )}

      {error && (
        <p
          id={`undefined-error`}
          className="text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;