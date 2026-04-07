// @ts-nocheck
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

const ToastIcon = ({ variant }: { variant?: string }) => {
  const iconClass = "h-5 w-5 shrink-0"
  
  switch (variant) {
    case "success":
      return <CheckCircle2 className={`${iconClass} text-emerald-400`} />
    case "destructive":
      return <AlertCircle className={`${iconClass} text-red-400`} />
    case "warning":
      return <AlertTriangle className={`${iconClass} text-amber-400`} />
    case "info":
      return <Info className={`${iconClass} text-blue-400`} />
    default:
      return null
  }
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const icon = ToastIcon({ variant })
        return (
          <Toast key={id} variant={variant} {...props}>
            {icon}
            <div className="flex-1 grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}