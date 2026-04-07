import React, {
  forwardRef,
  useId,
  SelectHTMLAttributes,
  ReactNode,
  ChangeEvent,
  memo,
} from "react";

export type SelectOptionValue = string | number;

export interface SelectOption {
  label: string;
  value: SelectOptionValue;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  id?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: SelectOptionValue;
  defaultValue?: SelectOptionValue;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "outlined" | "filled" | "ghost";
  onChange?: (value: SelectOptionValue, event: ChangeEvent<HTMLSelectElement>) => void;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

const sizeStyles: Record<
  NonNullable<SelectProps["size"]>,
  { container: string; select: string; label: string }
> = {
  sm: {
    container: "text-xs",
    select: "px-2 py-1 text-xs rounded-md",
    label: "text-xs mb-1",
  },
  md: {
    container: "text-sm",
    select: "px-3 py-1.5 text-sm rounded-md",
    label: "text-sm mb-1.5",
  },
  lg: {
    container: "text-base",
    select: "px-3.5 py-2 text-base rounded-lg",
    label: "text-sm mb-2",
  },
};

const variantStyles: Record<
  NonNullable<SelectProps["variant"]>,
  { base: string; focus: string; disabled: string }
> = {
  outlined: {
    base:
      "border border-neutral-300 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/80 " +
      "hover:border-neutral-400 dark:hover:border-neutral-500",
    focus:
      "focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/25",
    disabled:
      "disabled:bg-neutral-100 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-500 disabled:cursor-not-allowed",
  },
  filled: {
    base:
      "border border-transparent bg-neutral-100/90 dark:bg-neutral-800/80 " +
      "hover:bg-neutral-50 dark:hover:bg-neutral-750",
    focus:
      "focus:border-primary-500 focus:bg-white dark:focus:bg-neutral-900 " +
      "dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/25",
    disabled:
      "disabled:bg-neutral-100 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-500 disabled:cursor-not-allowed",
  },
  ghost: {
    base:
      "border border-transparent bg-transparent " +
      "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/70",
    focus:
      "focus:border-primary-500 dark:focus:border-primary-400 " +
      "focus:bg-white/80 dark:focus:bg-neutral-900/80 " +
      "focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/25",
    disabled:
      "disabled:bg-transparent disabled:text-neutral-400 dark:disabled:text-neutral-500 disabled:cursor-not-allowed",
  },
};

const Select = memo(
  forwardRef<HTMLSelectElement, SelectProps>(function Select(
    {
      label,
      id: idProp,
      options,
      placeholder,
      value,
      defaultValue,
      error,
      helperText,
      fullWidth = true,
      isLoading = false,
      size = "md",
      variant = "outlined",
      startIcon,
      endIcon,
      className = "",
      disabled,
      onChange,
      required,
      ...rest
    },
    ref
  ) {
    const autoId = useId();
    const id = idProp || autoId;
    const hasError = Boolean(error);

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value;
      if (onChange) {
        onChange(newValue, event);
      }
    };

    const sizeConfig = sizeStyles[size];
    const variantConfig = variantStyles[variant];

    const containerClasses = [
      "flex flex-col",
      fullWidth ? "w-full" : "w-auto",
      sizeConfig.container,
      "min-w-[6rem]",
    ]
      .filter(Boolean)
      .join(" ");

    const labelClasses = [
      "inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-100",
      "select-none",
      sizeConfig.label,
      required ? "after:ml-0.5 after:text-red-500 after:content-['*']" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const baseFieldClasses = [
      "peer",
      "block w-full",
      sizeConfig.select,
      "appearance-none",
      "bg-clip-padding",
      "text-neutral-900 dark:text-neutral-50",
      "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
      "transition-colors duration-150 ease-out",
      "outline-none",
      "pr-9", // for dropdown icon
      startIcon ? "pl-8" : "pl-3",
      hasError
        ? "border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500/20 dark:focus:ring-red-400/25"
        : variantConfig.base + " " + variantConfig.focus,
      variant === "outlined" ? "backdrop-blur-sm" : "",
      "focus:outline-none",
      "shadow-sm",
      "dark:shadow-black/40",
      variantConfig.disabled,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const helperTextClasses = [
      "mt-1.5 text-xs",
      hasError
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-500 dark:text-neutral-400",
    ]
      .filter(Boolean)
      .join(" ");

    const iconWrapperBase =
      "pointer-events-none absolute inset-y-0 flex items-center text-neutral-400 dark:text-neutral-500";

    const dropdownIcon = (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="none"
      >
        <path
          d="M5.25 7.75L10 12.25L14.75 7.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={id} className={labelClasses}>
            {label}
          </label>
        )}

        <div className="relative inline-flex w-full items-center">
          {startIcon && (
            <span className={`undefined left-2 justify-start`}>
              <span className="mr-1 flex items-center justify-center">
                {startIcon}
              </span>
            </span>
          )}

          <select
            id={id}
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled || isLoading}
            aria-invalid={hasError || undefined}
            aria-describedby={
              helperText || error ? `undefined-helper-text` : undefined
            }
            onChange={handleChange}
            {...rest}
            className={baseFieldClasses}
          >
            {placeholder && (
              <option value="" disabled={required}>
                {isLoading ? "Loading..." : placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={String(opt.value)}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}
          </select>

          {endIcon ? (
            <span
              className={`undefined right-2 justify-end gap-1 pointer-events-none`}
            >
              <span>{endIcon}</span>
              <span className="text-neutral-300 dark:text-neutral-600">
                {dropdownIcon}
              </span>
            </span>
          ) : (
            <span
              className={`undefined right-2 justify-end text-neutral-400 dark:text-neutral-500`}
            >
              {dropdownIcon}
            </span>
          )}
        </div>

        {(helperText || error) && (
          <p id={`undefined-helper-text`} className={helperTextClasses}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  })
);

export default Select;