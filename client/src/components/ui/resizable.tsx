"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex items-center justify-center bg-transparent transition-colors duration-150",
      "w-[3px] hover:w-[3px] hover:bg-[var(--ide-accent,hsl(var(--primary)/0.4))] active:bg-[var(--ide-accent,hsl(var(--primary)/0.6))]",
      "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
      "data-[panel-group-direction=vertical]:h-[3px] data-[panel-group-direction=vertical]:w-full",
      "data-[panel-group-direction=vertical]:hover:bg-[var(--ide-accent,hsl(var(--primary)/0.4))]",
      "data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-3 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "[&[data-panel-group-direction=vertical]>div]:rotate-90",
      "cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-6 w-[5px] items-center justify-center rounded-full bg-[var(--ide-border,hsl(var(--border)))] opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity">
        <GripVertical className="h-3 w-3 text-[var(--ide-text-muted)]" />
      </div>
    )}
    {children}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
