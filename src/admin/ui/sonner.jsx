import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

/**
 * The panel is Arabic, always light, and has no theme switcher — so the theme is
 * pinned rather than read from next-themes, and `dir` is set here so toasts lay
 * out RTL like everything else.
 */
const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      dir="rtl"
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      }}
      {...props}
    />
  )
}

export { Toaster }
