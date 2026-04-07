import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[var(--ecode-border)] bg-[var(--ecode-surface)] px-3 py-2 text-sm placeholder:text-[var(--ecode-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] focus-visible:border-[var(--ecode-accent)] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }