import { useCallback, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'

/**
 * Promise-based confirmation, so a destructive handler reads top to bottom:
 *
 *   const ok = await confirm({ title, message, destructive: true })
 *   if (!ok) return
 *
 * With `reason` it doubles as the reject/cancel prompt and resolves
 * `{ reason }`; without it, it resolves `{ reason: '' }`. Cancelling always
 * resolves `null`, so `if (!ok) return` is the single guard either way.
 * `reason.initial` pre-fills the box, for a reason the operator will usually
 * keep but may edit (a report's own reason, when taking content down).
 *
 * Built on Radix's AlertDialog rather than a hand-rolled modal. Two reasons that
 * are not cosmetic: AlertDialog is the correct role for a decision the operator
 * must make (it traps focus and does not close on outside click), and the
 * hand-rolled version focused its own card on mount, stealing focus from the
 * reason box — so typed spaces scrolled the page instead of reaching the field.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const [reason, setReason] = useState('')

  const confirm = useCallback((options) => new Promise((resolve) => {
    setReason(options?.reason?.initial ?? '')
    setRequest({ options, resolve })
  }), [])

  const settle = useCallback((value) => {
    setRequest((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const options = request?.options
  const reasonRequired = options?.reason?.required && !reason.trim()

  const confirmDialog = (
    <AlertDialog
      open={!!request}
      onOpenChange={(open) => { if (!open) settle(null) }}
    >
      {request && (
        <AlertDialogContent dir="rtl" className="text-start sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            {options.message && (
              <AlertDialogDescription className="leading-7">
                {options.message}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {options.reason && (
            <div className="grid gap-2">
              <Label htmlFor="confirm-reason">{options.reason.label}</Label>
              <Textarea
                id="confirm-reason"
                rows={3}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={options.reason.placeholder || ''}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(null)}>
              {options.cancelLabel || 'إلغاء'}
            </AlertDialogCancel>
            {/* The red goes through `variant`, not className. The action
                renders via Radix Slot, which joins the Button's classes and
                its own without tailwind-merge: a `bg-destructive` className
                sat beside the default variant's `bg-primary`, and lost to it
                in the stylesheet — so «حذف نهائي», «إيقاف» and every other
                destructive confirmation showed the same green as «موافقة». */}
            <AlertDialogAction
              disabled={reasonRequired}
              variant={options.destructive ? 'destructive' : 'default'}
              onClick={() => settle({ reason: reason.trim() })}
            >
              {options.confirmLabel || 'تأكيد'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )

  return { confirm, confirmDialog }
}

export default useConfirm
