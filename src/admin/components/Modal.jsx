import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

/**
 * The panel's one dialog shell, now Radix underneath.
 *
 * Radix handles the things the hand-rolled version got wrong or had to
 * re-implement per dialog: focus moves to the first field and is trapped,
 * Escape and outside-click close it, the page behind is inert and does not
 * scroll, and the whole thing is announced correctly.
 *
 * Callers mount it conditionally, so it is always `open` while rendered.
 */
export default function Modal({ title, subtitle, onClose, children, footer, width = '640px' }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.() }}>
      <DialogContent
        dir="rtl"
        className="text-start max-h-[90vh] gap-0 overflow-hidden p-0"
        style={{ maxWidth: width }}
      >
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>{title}</DialogTitle>
          {subtitle
            ? <DialogDescription>{subtitle}</DialogDescription>
            /* Radix warns when a dialog has no description; this keeps the
               a11y tree correct for dialogs that genuinely have no subtitle. */
            : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <DialogFooter className="border-t bg-muted/40 px-6 py-4">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
