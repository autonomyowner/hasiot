import { useCallback, useMemo, useState } from 'react'

/**
 * Checkbox selection for the three approval queues.
 *
 * The queues are live Convex subscriptions, so rows disappear underneath the
 * operator the moment anything is approved — including by them, in another tab.
 * Rather than pruning the stored set from an effect (which would cascade a
 * render on every queue update), the selection is intersected with the rows
 * actually on screen at read time. A bulk action therefore can never be handed
 * an id that has already left the queue.
 */
export function useSelection(items) {
  const [selected, setSelected] = useState(() => new Set())

  const ids = useMemo(() => (items || []).map((item) => item._id), [items])

  // Filtering in list order also means the ids arrive in the order the operator
  // sees them, which is the order the log rows end up in.
  const selectedIds = useMemo(
    () => ids.filter((id) => selected.has(id)),
    [ids, selected]
  )

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }, [ids])

  const clear = useCallback(() => setSelected(new Set()), [])

  return {
    selectedIds,
    count: selectedIds.length,
    allSelected: ids.length > 0 && selectedIds.length === ids.length,
    isSelected: (id) => selected.has(id),
    toggle,
    toggleAll,
    clear,
  }
}

/**
 * Turn a bulk mutation's `{ succeeded, failed }` into one sentence. Bulk actions
 * settle per item, so "تمت الموافقة على 12" and "تعذّر 1" are both true at once
 * and the operator needs to see both.
 */
export function describeBulkResult(result, verb) {
  const parts = []
  if (result.succeeded > 0) parts.push(`${verb} ${result.succeeded}`)
  if (result.failed?.length) parts.push(`تعذّر ${result.failed.length}`)
  return parts.join(' — ') || 'لم يتغيّر شيء'
}
