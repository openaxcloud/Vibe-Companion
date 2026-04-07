import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input component props
 * 
 * @remarks
 * For accessibility, ensure inputs have associated labels via:
 * - A visible <label> element with htmlFor matching the input's id
 * - Or an aria-label attribute for screen readers
 * 
 * For error states, use aria-invalid and aria-describedby:
 * @example
 * ```tsx
 * <Input 
 *   id="email" 
 *   aria-invalid={!!error}
 *   aria-describedby={error ? "email-error" : undefined}
 * />
 * {error && <span id="email-error">{error}</span>}
 * ```
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Set to true when input has validation errors */
  'aria-invalid'?: boolean
  /** ID of element containing error message */
  'aria-describedby'?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[var(--ecode-border)] bg-[var(--ecode-surface)] px-3 py-2 text-sm placeholder:text-[var(--ecode-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] focus-visible:border-[var(--ecode-accent)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }