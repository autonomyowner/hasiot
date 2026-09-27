import { useState } from 'react'
import { useViewer } from '../useViewer'
import { shouldRemember, steadyOf } from './steady'

/**
 * useViewer for pages holding a form: once settled, a momentary 'loading'
 * (a session refetch on returning to the tab) keeps the last settled answer,
 * so the sign-in form is never unmounted mid-way. steady.js says why.
 *
 * The remembered answer is state set during render, React's pattern for
 * keeping something from an earlier render; it settles in one extra pass.
 */
export function useSteadyViewer() {
  const viewer = useViewer()
  const [remembered, setRemembered] = useState(viewer)
  if (shouldRemember(viewer, remembered)) setRemembered(viewer)
  return steadyOf(viewer, remembered)
}

export default useSteadyViewer
