import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110",
        outline:
          "border border-border bg-surface-solid hover:bg-surface-hover-solid hover:text-foreground",
        secondary:
          "bg-surface-tertiary-solid text-foreground hover:bg-surface-hover-solid",
        ghost: "hover:bg-surface-hover-solid hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 md:h-10 min-h-[44px] md:min-h-0",
        sm: "h-9 rounded-md px-3 min-h-[44px] md:min-h-0",
        lg: "h-11 rounded-md px-8 min-h-[44px] md:min-h-0",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Button component props
 * 
 * @remarks
 * For icon-only buttons (size="icon"), you MUST provide an aria-label
 * to ensure accessibility for screen readers.
 * 
 * @example
 * ```tsx
 * // Icon-only button - aria-label is required
 * <Button size="icon" aria-label="Delete item">
 *   <TrashIcon />
 * </Button>
 * 
 * // Button with text - aria-label is optional
 * <Button>Save Changes</Button>
 * ```
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Required for icon-only buttons to provide accessible name */
  'aria-label'?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), "replit-button-press")}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
