import * as React from "react"
import { Slot } from "radix-ui"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

/**
 * shadcn's Badge plus the panel's own tones.
 *
 * The extra variants are the status vocabulary this admin already speaks —
 * approved / pending / rejected / neutral — kept as named variants rather than
 * ad-hoc colour classes so a status can never be spelled two different ways in
 * two different tables. Each is a tinted surface with readable ink, not a
 * saturated block.
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",

        // Panel tones
        green: "border-transparent bg-primary/10 text-primary",
        gray: "border-transparent bg-muted text-muted-foreground",
        blue: "border-transparent bg-sky-100 text-sky-800",
        yellow: "border-transparent bg-amber-100 text-amber-800",
        red: "border-transparent bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }
