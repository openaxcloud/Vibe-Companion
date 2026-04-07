import React, {
  forwardRef,
  SelectHTMLAttributes,
  ReactNode,
  ChangeEvent,
  useId,
} from "react";

export type SelectOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  errorClassName?: string;
  hintClassName?: string;
  onChange?: (value: string, event: ChangeEvent<HTMLSelectElement>) => void;
}

const baseContainerClass =
  "flex flex-col gap-1 text-sm text-gray-900 dark:text-gray-100";
const baseLabelClass =
  "mb-1 font-medium text-gray-700 dark:text-gray-200 select-none";
const baseSelectWrapperClass =
  "relative flex items-center rounded-md border transition-colors bg-white dark:bg-gray-900";
const baseSelectClass =
  "block w-full appearance-none bg-transparent px-3 py-2 pr-9 text-sm leading-5 text-gray-900 dark:text-gray-100 outline-none";
const baseErrorClass = "mt-1 text-xs text-red-600 dark:text-red-400";
const baseHintClass = "mt-1 text-xs text-gray-500 dark:text-gray-400";
const disabledClass =
  "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed";
const focusRingClass =
  "focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500";
const errorRingClass =
  "border-red-500 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500";
const normalBorderClass =
  "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      label,
      error,
      hint,
      options,
      startAdornment,
      endAdornment,
      className,
      fullWidth = true,
      containerClassName,
      labelClassName,
      selectClassName,
      errorClassName,
      hintClassName,
      disabled,
      required,
      onChange,
      children,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `undefined-error`;
    const hintId = `undefined-hint`;

    const hasError = Boolean(error);
    const hasHint = Boolean(hint);

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(event.target.value, event);
      }
    };

    const containerClasses = [
      baseContainerClass,
      fullWidth ? "w-full" : "",
      containerClassName || "",
    ]
      .filter(Boolean)
      .join(" ");

    const labelClasses = [baseLabelClass, labelClassName || ""]
      .filter(Boolean)
      .join(" ");

    const wrapperClasses = [
      baseSelectWrapperClass,
      disabled ? disabledClass : normalBorderClass,
      hasError ? errorRingClass : focusRingClass,
      className || "",
    ]
      .filter(Boolean)
      .join(" ");

    const selectClasses = [
      baseSelectClass,
      disabled ? "cursor-not-allowed" : "cursor-pointer",
      startAdornment ? "pl-9" : "",
      endAdornment ? "pr-9" : "pr-9",
      selectClassName || "",
    ]
      .filter(Boolean)
      .join(" ");

    const finalErrorClass = [baseErrorClass, errorClassName || ""]
      .filter(Boolean)
      .join(" ");

    const finalHintClass = [baseHintClass, hintClassName || ""]
      .filter(Boolean)
      .join(" ");

    const describedByIds: string[] = [];
    if (hasError) describedByIds.push(errorId);
    if (hasHint) describedByIds.push(hintId);
    const ariaDescribedBy =
      describedByIds.length > 0 ? describedByIds.join(" ") : undefined;

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={selectId}
            className={labelClasses}
          >
            <span>{label}</span>
            {required && (
              <span className="ml-0.5 text-red-600 dark:text-red-400">*</span>
            )}
          </label>
        )}
        <div className={wrapperClasses}>
          {startAdornment && (
            <div className="pointer-events-none absolute left-2 flex items-center text-gray-400 dark:text-gray-500">
              {startAdornment}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            aria-invalid={hasError || undefined}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={selectClasses}
            onChange={handleChange}
            {...rest}
          >
            {options
              ? options.map((option) => (
                  <option
                    key={String(option.value)}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))
              : children}
          </select>

          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 dark:text-gray-500">
            {endAdornment ? (
              endAdornment
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>

        {hasError && (
          <p
            id={errorId}
            className={finalErrorClass}
          >
            {error}
          </p>
        )}
        {!hasError && hasHint && (
          <p
            id={hintId}
            className={finalHintClass}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;