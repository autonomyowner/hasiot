import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

/**
 * The panel's one dialog shell, Radix underneath.
 *
 * Radix handles what the hand-rolled version got wrong or re-implemented per
 * dialog: focus moves to the first field and is trapped, Escape and outside
 * click close it, the page behind is inert, and it is announced correctly.
 *
 * The layout is deliberately `flex flex-col`, not the `grid` shadcn ships.
 * DialogContent is capped at 90vh, and only a flex column lets the middle
 * section take the leftover height and scroll on its own — with `grid`, the
 * body kept its natural height and `overflow-hidden` simply cut the bottom off,
 * so a long form like "إضافة مكان جديد" could not be scrolled to its submit
 * button. `min-h-0` is what allows a flex child to shrink below its content.
 *
 * Callers mount it conditionally, so it is always `open` while rendered.
 */
export default function Modal({ title, subtitle, onClose, children, footer, width = '640px' }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.() }}>
      <DialogContent
        dir="rtl"
        className="text-start flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0"
        style={{ maxWidth: width }}
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
          <DialogTitle>{title}</DialogTitle>
          {subtitle
            ? <DialogDescription>{subtitle}</DialogDescription>
            /* Radix warns when a dialog has no description; this keeps the
               a11y tree correct for dialogs that genuinely have no subtitle. */
            : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>

        {/* The only scrolling region. overscroll-contain stops a flick at the
            end of the form from scrolling the page behind the dialog. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer && (
          <DialogFooter className="shrink-0 border-t bg-muted/40 px-6 py-4">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
